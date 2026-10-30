"""実人口グリッドから4,000点を人口比例抽出し、国別の公表統計を対応させる。"""

import hashlib
import json
import math
import zipfile
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "data"
SOURCE = ROOT / "data" / "statistics"
OUTPUT = ROOT / "src" / "game" / "data" / "world.json"
YEAR = 2020
COUNT = 4000
CANDIDATES = 1600
from region_boundaries import load_region_parts


def observation(code):
    raw = json.loads((SOURCE / f"{code}.json").read_text(encoding="utf-8"))
    return {
        row["countryiso3code"]: row["value"] for row in raw[1] if row["countryiso3code"]
    }


def keep_candidates(existing, incoming):
    combined = np.concatenate([existing, incoming])
    if len(combined) > CANDIDATES:
        combined = combined[np.argpartition(combined[:, 0], -CANDIDATES)[-CANDIDATES:]]
    return combined


if __name__ == "__main__":
    parts = load_region_parts()
    countries = json.loads((SOURCE / "countries.json").read_text(encoding="utf-8"))[1]
    wb_countries = {
        country["id"]: country
        for country in countries
        if country["region"]["id"] != "NA"
    }
    indicator_names = {
        "population": "SP.POP.TOTL",
        "young": "SP.POP.0014.TO.ZS",
        "working": "SP.POP.1564.TO.ZS",
        "older": "SP.POP.65UP.TO.ZS",
        "internet": "IT.NET.USER.ZS",
        "urban": "SP.URB.TOTL.IN.ZS",
        "employment": "SL.EMP.TOTL.SP.ZS",
        "services": "SL.SRV.EMPL.ZS",
        "industry": "SL.IND.EMPL.ZS",
        "agriculture": "SL.AGR.EMPL.ZS",
    }
    indicators = {name: observation(code) for name, code in indicator_names.items()}
    feature_codes = []
    feature_areas = []
    shapes = []
    for code, area, geometry in parts:
        feature_codes.append(code)
        feature_areas.append(area)
        rings = (
            geometry["coordinates"]
            if geometry["type"] == "Polygon"
            else [ring for polygon in geometry["coordinates"] for ring in polygon]
        )
        latitudes = [point[1] for ring in rings for point in ring]
        shapes.append((geometry, len(feature_codes), min(latitudes), max(latitudes)))
    region_ids = np.array([-1] + feature_areas, dtype=np.int16)
    codes = np.array([""] + feature_codes)
    # 国境はGHSLと同じ約1km格子へ窓ごとに照合。海岸を含む人口セルも保持する。
    reservoirs = [np.empty((0, 6), dtype=np.float64) for _ in range(37)]
    area_totals = np.zeros(37)
    area_country_totals = np.zeros((37, len(codes)))
    rng = np.random.default_rng(2030)
    source_total = 0.0
    domain_total = 0.0
    assigned_total = 0.0
    archive = CACHE / "GHS_POP_2020_30ss.zip"
    with zipfile.ZipFile(archive) as zipped:
        tif_name = next(name for name in zipped.namelist() if name.endswith(".tif"))
        tif_path = CACHE / tif_name
        if not tif_path.exists():
            print("人口グリッドを展開", tif_name, flush=True)
            with zipped.open(tif_name) as source, tif_path.open("wb") as target:
                while block := source.read(4 * 1024 * 1024):
                    target.write(block)
    with rasterio.open(tif_path) as source:
        print("入力グリッド", source.width, source.height, source.transform, flush=True)
        longitudes = (
            source.transform.c + (np.arange(source.width) + 0.5) * source.transform.a
        )
        for row in range(0, source.height, 128):
            height = min(128, source.height - row)
            data = source.read(
                1, window=Window(0, row, source.width, height), out_dtype="float32"
            )
            data = np.maximum(data, 0)
            source_total += float(data.sum(dtype=np.float64))
            latitudes = (
                source.transform.f
                + (np.arange(row, row + height) + 0.5) * source.transform.e
            )
            valid_lat = (latitudes >= -60) & (latitudes <= 75)
            if not valid_lat.any():
                continue
            domain_total += float(data[valid_lat].sum(dtype=np.float64))
            relevant = [
                (geometry, index)
                for geometry, index, south, north in shapes
                if north >= latitudes.min() - 0.01 and south <= latitudes.max() + 0.01
            ]
            ids = (
                rasterize(
                    relevant,
                    out_shape=(height, source.width),
                    transform=source.window_transform(
                        Window(0, row, source.width, height)
                    ),
                    all_touched=True,
                    dtype="uint16",
                )
                if relevant
                else np.zeros((height, source.width), dtype=np.uint16)
            )
            valid = (data > 0) & (ids > 0) & valid_lat[:, None]
            rr, cc = np.nonzero(valid)
            values = data[rr, cc].astype(np.float64)
            country_ids = ids[rr, cc]
            assigned_total += float(values.sum())
            longitude = longitudes[cc]
            latitude = latitudes[rr]
            area_ids = region_ids[country_ids]
            area_totals += np.bincount(area_ids, weights=values, minlength=37)
            np.add.at(area_country_totals, (area_ids, country_ids), values)
            # 重み付き非復元抽出。中心や乱数のジッターで架空の居住地を作らない。
            keys = np.log(rng.uniform(np.finfo(float).tiny, 1, len(values))) / values
            for area_id in np.unique(area_ids):
                take = np.flatnonzero(area_ids == area_id)
                if len(take) > CANDIDATES:
                    take = take[np.argpartition(keys[take], -CANDIDATES)[-CANDIDATES:]]
                incoming = np.column_stack(
                    [
                        keys[take],
                        longitude[take],
                        latitude[take],
                        country_ids[take],
                        values[take],
                        np.full(len(take), area_id),
                    ]
                )
                reservoirs[area_id] = keep_candidates(reservoirs[area_id], incoming)
            if row % 2048 == 0:
                print("集計行", row, "/", source.height, flush=True)
    if (area_totals <= 0).any():
        raise ValueError("人口のない小地域があります")
    fractions = area_totals / area_totals.sum() * COUNT
    quotas = np.floor(fractions).astype(int)
    quotas[np.argsort(-(fractions - quotas))[: COUNT - int(quotas.sum())]] += 1
    if (quotas == 0).any():
        raise ValueError("人口点がない小地域があります")
    selected_strata = []
    for area_id, rows in enumerate(reservoirs):
        masses = {
            code: float(area_country_totals[area_id, codes == code].sum())
            for code in sorted(set(codes[1:]))
        }
        masses = {code: mass for code, mass in masses.items() if mass > 0}
        expected = {
            code: mass / area_totals[area_id] * int(quotas[area_id])
            for code, mass in masses.items()
        }
        counts = {code: int(math.floor(value)) for code, value in expected.items()}
        remaining = int(quotas[area_id]) - sum(counts.values())
        for code in sorted(
            counts, key=lambda code: expected[code] - counts[code], reverse=True
        )[:remaining]:
            counts[code] += 1
        for code, count in counts.items():
            if count == 0:
                continue
            candidates = rows[codes[rows[:, 3].astype(int)] == code]
            if len(candidates) < count:
                raise ValueError(f"人口比に必要な候補が不足: {code}")
            selected_strata.append(candidates[np.argsort(-candidates[:, 0])[:count]])
    selected = np.concatenate(selected_strata)
    profiles = {}
    for code in sorted(set(codes[1:])):
        profile = {name: values.get(code) for name, values in indicators.items()}
        profile["name"] = wb_countries[code]["name"] if code in wb_countries else code
        profile["year"] = YEAR
        profiles[code] = profile
    for code, observed in json.loads(
        (SOURCE / "supplemental-observations.json").read_text(encoding="utf-8-sig")
    ).items():
        profiles[code].update(observed)
    points = []
    for _, lon, lat, country_id, cell_population, area_id in selected:
        code = str(codes[int(country_id)])
        points.append(
            {
                "longitude": round(float(lon), 6),
                "latitude": round(float(lat), 6),
                "country": code,
                "area": int(area_id),
                "cellPopulation": round(float(cell_population), 2),
                "density": round(
                    float(cell_population)
                    / (111.195 / 120) ** 2
                    / max(math.cos(math.radians(lat)), 0.01),
                    2,
                ),
            }
        )
    # 年齢は国別の3区分を層化して割り当てる。区分内の位置は経年更新用のモデル値。
    for code in sorted({point["country"] for point in points}):
        members = [point for point in points if point["country"] == code]
        rng.shuffle(members)
        profile = profiles[code]
        shares = [profile[name] for name in ["young", "working", "older"]]
        if any(value is None for value in shares):
            for point in members:
                point["age"] = None
                point["weight"] = round(
                    float(area_totals[point["area"]]) / int(quotas[point["area"]]), 3
                )
            continue
        shares = np.array(shares) / sum(shares)
        for index, point in enumerate(members):
            q = (index + 0.5) / len(members)
            cohort = int(np.searchsorted(np.cumsum(shares), q))
            lower = sum(shares[:cohort])
            position = (q - lower) / shares[cohort]
            point["age"] = round(
                [0, 15, 65][cohort] + position * [15, 50, 25][cohort], 3
            )
            point["weight"] = round(
                float(area_totals[point["area"]]) / int(quotas[point["area"]]), 3
            )
    area_statistics = []
    for area_id in range(37):
        regional = [point for point in points if point["area"] == area_id]
        available_mass = [
            (mass, profiles[str(codes[index])]["internet"])
            for index, mass in enumerate(area_country_totals[area_id])
            if mass > 0 and profiles[str(codes[index])]["internet"] is not None
        ]
        if not available_mass:
            raise ValueError("小地域のインターネット統計が全て欠測です")
        digital = (
            sum(mass * value for mass, value in available_mass)
            / sum(mass for mass, value in available_mass)
            / 100
        )
        area_statistics.append(
            {
                "population": float(area_totals[area_id]) / 1e6,
                "digital": digital,
                "longitude": max(regional, key=lambda point: point["cellPopulation"])[
                    "longitude"
                ],
                "latitude": max(regional, key=lambda point: point["cellPopulation"])[
                    "latitude"
                ],
            }
        )
    result = {
        "referenceYear": YEAR,
        "areas": area_statistics,
        "countries": profiles,
        "points": points,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(
        json.dumps(
            result, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
    )
    report = {
        "referenceYear": YEAR,
        "points": len(points),
        "sourceGlobalPopulation": source_total,
        "mapDomainPopulation": domain_total,
        "countryAssignedPopulation": assigned_total,
        "coverageOfSource": assigned_total / source_total,
        "areaPointCounts": quotas.tolist(),
        "subdivisionsSha256": hashlib.sha256(
            (CACHE / "states-provinces-10m.geojson").read_bytes()
        ).hexdigest(),
        "divisionRulesSha256": hashlib.sha256(
            (SOURCE / "small-region-divisions.json").read_bytes()
        ).hexdigest(),
        "sampledCountries": len({point["country"] for point in points}),
        "missingAgePoints": sum(point["age"] is None for point in points),
        "missingInternetPoints": sum(
            profiles[point["country"]]["internet"] is None for point in points
        ),
        "missingEmploymentPoints": sum(
            profiles[point["country"]]["employment"] is None for point in points
        ),
        "outputSha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
        "boundariesSha256": hashlib.sha256(
            (CACHE / "countries-10m.geojson").read_bytes()
        ).hexdigest(),
    }
    (SOURCE / "processing.json").write_bytes(
        json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8")
    )
    print(json.dumps(report, ensure_ascii=False), flush=True)
