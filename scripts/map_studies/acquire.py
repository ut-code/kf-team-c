"""Natural Earthの原本を保存する。既存ゲームの素材取得処理とは独立。"""

from pathlib import Path
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "map-studies" / "raw"
SOURCES = {
    "HYP_50M_SR.zip": "https://naturalearth.s3.amazonaws.com/50m_raster/HYP_50M_SR.zip",
    "ne_110m_admin_0_countries.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson",
}



def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url in SOURCES.items():
        target = RAW / name
        if not target.exists():
            print(f"取得: {name}", flush=True)
            part = target.with_suffix(target.suffix + ".part")
            request = urllib.request.Request(url, headers={"User-Agent": "kf-team-c-map-studies/1.0"})
            with urllib.request.urlopen(request, timeout=180) as response, part.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            part.replace(target)
        record = {"file": name, "url": url, "bytes": target.stat().st_size, "sha256": digest(target)}
        if target.suffix == ".zip":
            record["extracted"] = []
            with zipfile.ZipFile(target) as archive:
                for member in archive.infolist():
                    if Path(member.filename).suffix.lower() not in {".tif", ".tfw", ".prj"}:
                        continue
                    # 書き込み先はraw直下のファイル名に限定する。
                    destination = RAW / Path(member.filename).name
                    with archive.open(member) as source, destination.open("wb") as output:
                        while chunk := source.read(1024 * 1024):
                            output.write(chunk)
                    record["extracted"].append({"file": destination.name, "sha256": digest(destination)})
        records.append(record)
        print(f"保存済み: {name}", flush=True)
    (RAW.parent / "adopted-sources.json").write_text(json.dumps({"acquired": "2026-10-27", "sources": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
