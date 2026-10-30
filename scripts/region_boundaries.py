"""人口集計・地図描画に共通の小地域境界。国内分割は州・省境を用いる。"""

import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely import make_valid, union_all

ROOT = Path(__file__).resolve().parents[1]

# 小地域の区切りはゲームの設計。人口や社会指標の値を手入力しない。
AREA_GROUPS = {
    2: "CAN GRL SPM",
    3: "MEX GTM BLZ SLV HND NIC CRI PAN",
    4: "MAF BMU CUB HTI DOM JAM BHS PRI TTO ATG BHS BRB DMA GRD KNA LCA VCT AIA ABW BES BLM CUW CYM GLP MSR MTQ SXM TCA VGB VIR",
    5: "COL VEN GUY SUR ECU PER BOL",
    6: "BRA",
    7: "ARG CHL URY PRY FLK SGS",
    8: "FRA DEU BEL NLD LUX CHE AUT LIE MCO",
    9: "ALA GBR IRL DNK SWE NOR FIN ISL FRO SJM GGY IMN JEY",
    10: "ESP PRT ITA GRC ALB HRV BIH MKD MNE SRB XKX MLT AND SMR VAT GIB",
    11: "POL CZE SVK HUN ROU BGR MDA UKR BLR LTU LVA EST SVN",
    13: "KAZ UZB TKM KGZ TJK MNG ARM AZE GEO",
    15: "MAR DZA TUN LBY ESH",
    16: "EGY SDN SSD",
    17: "TUR IRN IRQ SYR LBN ISR PSE JOR SAU YEM OMN ARE QAT BHR KWT CYP",
    18: "SEN MLI MRT BEN NER NGA TGO GHA CIV GIN GNB LBR SLE BFA GMB CPV SHN",
    19: "CMR CAF TCD COG COD GAB GNQ STP",
    20: "ETH DJI ERI SOM KEN UGA RWA BDI TZA MDG COM MUS SYC REU MYT",
    21: "ZAF LSO SWZ ZWE BWA NAM ZMB MWI MOZ AGO",
    22: "PAK AFG",
    24: "LKA MDV",
    25: "BGD NPL BTN",
    26: "TWN HKG MAC",
    28: "JPN",
    29: "KOR PRK",
    30: "THA MMR LAO KHM",
    31: "VNM",
    32: "MYS SGP BRN",
    33: "IDN TLS",
    34: "PHL",
    35: "AUS",
    36: "NZL PNG FJI SLB VUT NCL WSM ASM TON TUV KIR MHL FSM PLW NRU GUM MNP PYF WLF COK NIU TKL PCN NFK",
}
ALIASES = {
    "ESB": "CYP",
    "SOL": "SOM",
    "KOS": "XKX",
    "USG": "CUB",
    "CYN": "CYP",
    "CNM": "CYP",
    "KAS": "IND",
    "WSB": "CYP",
    "SPI": "CHL",
    "BRT": "EGY",
    "PGA": "PHL",
    "BJN": "COL",
    "SER": "COL",
    "SCR": "PHL",
}
AREA_BY_COUNTRY = {
    country: area
    for area, countries in AREA_GROUPS.items()
    for country in countries.split()
}


def load_region_parts():
    divisions = json.loads(
        (ROOT / "data/statistics/small-region-divisions.json").read_text(
            encoding="utf-8"
        )
    )
    countries = json.loads(
        (ROOT / "tmp/data/countries-10m.geojson").read_text(encoding="utf-8")
    )["features"]
    provinces = json.loads(
        (ROOT / "tmp/data/states-provinces-10m.geojson").read_text(encoding="utf-8")
    )["features"]
    grouped = {}
    for feature in countries:
        props = feature["properties"]
        country = (
            props["ISO_A3_EH"]
            if props["ISO_A3_EH"] != "-99"
            else ALIASES[props["ADM0_A3"]]
        )
        if (
            props["CONTINENT"] == "Antarctica"
            or country in ["HMD", "ATF", "BVT", "IOT", "UMI"]
            or country in divisions
        ):
            continue
        grouped.setdefault((country, AREA_BY_COUNTRY[country]), []).append(
            make_valid(shape(feature["geometry"]))
        )
    seen = {country: set() for country in divisions}
    for feature in provinces:
        props = feature["properties"]
        country = props["adm0_a3"]
        if country not in divisions:
            continue
        province = props["iso_3166_2"]
        area = divisions[country][province]["area"]
        seen[country].add(province)
        grouped.setdefault((country, area), []).append(
            make_valid(shape(feature["geometry"]))
        )
    for country in divisions:
        if seen[country] != set(divisions[country]):
            raise ValueError(f"行政区の定義と原本が一致しません: {country}")
    return [
        (country, area, mapping(union_all(parts)))
        for (country, area), parts in grouped.items()
    ]
