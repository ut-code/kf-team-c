import concurrent.futures
import hashlib
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "data"
CACHE.mkdir(parents=True, exist_ok=True)
OUTPUT = ROOT / "data" / "statistics"
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE = "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E2020_GLOBE_R2023A_4326_30ss/V1-0/"
INDICATORS = [
    "SP.POP.TOTL",
    "SP.POP.0014.TO.ZS",
    "SP.POP.1564.TO.ZS",
    "SP.POP.65UP.TO.ZS",
    "IT.NET.USER.ZS",
    "SP.URB.TOTL.IN.ZS",
    "SL.EMP.TOTL.SP.ZS",
    "SL.SRV.EMPL.ZS",
    "SL.IND.EMPL.ZS",
    "SL.AGR.EMPL.ZS",
]


def download(url, path):
    print("取得開始:", path.name, flush=True)
    with urllib.request.urlopen(url, timeout=120) as source, path.open("wb") as target:
        total = 0
        milestone = 0
        while chunk := source.read(1024 * 1024):
            target.write(chunk)
            total += len(chunk)
            if total // (50 * 1024 * 1024) > milestone:
                milestone = total // (50 * 1024 * 1024)
                print(path.name, total // (1024 * 1024), "MB", flush=True)
    print("取得完了:", path.name, total, flush=True)


def fetch_indicator(code):
    url = f"https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&date=2020&per_page=1000"
    path = OUTPUT / f"{code}.json"
    download(url, path)
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or data[0]["pages"] != 1:
        raise ValueError(code)
    return {
        "indicator": code,
        "url": url,
        "year": 2020,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "lastUpdated": data[0]["lastupdated"],
    }


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(fetch_indicator, code) for code in INDICATORS]
        country = pool.submit(
            download,
            "https://api.worldbank.org/v2/country?format=json&per_page=400",
            OUTPUT / "countries.json",
        )
        ghsl_path = CACHE / "GHS_POP_2020_30ss.zip"
        if ghsl_path.exists():
            with zipfile.ZipFile(ghsl_path):
                pass
        ghsl = (
            pool.submit(
                download,
                BASE + "GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.zip",
                ghsl_path,
            )
            if not ghsl_path.exists()
            else None
        )
        boundaries_url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"
        boundaries = pool.submit(
            download, boundaries_url, CACHE / "countries-10m.geojson"
        )
        subdivisions_url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"
        subdivisions = pool.submit(
            download, subdivisions_url, CACHE / "states-provinces-10m.geojson"
        )
        copyright_job = pool.submit(
            download, BASE + "copyright.txt", OUTPUT / "GHSL-copyright.txt"
        )
        metadata = [job.result() for job in jobs]
        country.result()
        copyright_job.result()
        boundaries.result()
        subdivisions.result()
        if ghsl:
            ghsl.result()
    (OUTPUT / "sources.json").write_text(
        json.dumps(
            {
                "referenceYear": 2020,
                "retrieved": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "worldbank": metadata,
                "boundaries": {
                    "url": boundaries_url,
                    "sha256": hashlib.sha256(
                        (CACHE / "countries-10m.geojson").read_bytes()
                    ).hexdigest(),
                },
                "subdivisions": {
                    "url": subdivisions_url,
                    "sha256": hashlib.sha256(
                        (CACHE / "states-provinces-10m.geojson").read_bytes()
                    ).hexdigest(),
                },
                "supplemental": {
                    "file": "supplemental-observations.json",
                    "sha256": hashlib.sha256(
                        (OUTPUT / "supplemental-observations.json").read_bytes()
                    ).hexdigest(),
                },
                "ghsl": {
                    "url": BASE + "GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.zip",
                    "sha256": hashlib.sha256(ghsl_path.read_bytes()).hexdigest(),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
