"""国連WPP・ITU・UNESCO UIS・World Bankの2020年初期条件を生成する。

人口・年齢比率はWPPの公式CSV・Excel、ITU・UISはWorld Bankの配信APIを利用。
欠測は補間せずnull。2015〜2020年の教育・所得は最新の利用可能年を明記する。
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import csv
import gzip
import hashlib
import json
import urllib.request
import zipfile
import xml.etree.ElementTree as ElementTree
import shutil

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp/data/social'
REFERENCE_YEAR = 2020
SOURCES = {
    'population.csv.gz': 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz',
    'age.xlsx': 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/EXCEL_FILES/2_Population/WPP2024_POP_F03_1_POPULATION_SELECT_AGE_GROUPS_BOTH_SEXES.xlsx',
    'education.json': 'https://api.worldbank.org/v2/country/all/indicator/SE.SEC.CUAT.LO.ZS?date=2015:2020&format=json&per_page=20000',
    'income.json': 'https://api.worldbank.org/v2/country/all/indicator/NY.GNP.PCAP.PP.KD?date=2015:2020&format=json&per_page=20000',
    'education-metadata.json': 'https://api.worldbank.org/v2/indicator/SE.SEC.CUAT.LO.ZS?format=json',
}
for indicator in ['SP.POP.0014.TO.ZS', 'SP.POP.1564.TO.ZS', 'SP.POP.65UP.TO.ZS', 'IT.NET.USER.ZS']:
    SOURCES[f'{indicator}-metadata.json'] = f'https://api.worldbank.org/v2/indicator/{indicator}?format=json'


def acquire_source(item):
    filename, url = item
    destination = CACHE / filename
    if not destination.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'DEPENDENCY-statistics/1.0'})
        temporary = destination.with_suffix(destination.suffix + '.part')
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open('wb') as output:
            shutil.copyfileobj(response, output)
        temporary.replace(destination)
    with destination.open('rb') as source:
        checksum = hashlib.file_digest(source, 'sha256').hexdigest()
    return filename, {'url': url, 'sha256': checksum}


def read_age_distribution():
    """WPPのEstimatesシートから2020年の0–14/15–64/65+人口を抽出。"""
    namespace = {'sheet': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    result = {}
    with zipfile.ZipFile(CACHE / 'age.xlsx') as workbook:
        shared = ElementTree.fromstring(workbook.read('xl/sharedStrings.xml'))
        strings = [''.join(node.itertext()) for node in shared.findall('sheet:si', namespace)]
        for _, row in ElementTree.iterparse(workbook.open('xl/worksheets/sheet7.xml'), events=['end']):
            if not row.tag.endswith('}row'):
                continue
            cells = {}
            for cell in row.findall('sheet:c', namespace):
                value = cell.find('sheet:v', namespace)
                if value is None:
                    continue
                column = ''.join(character for character in cell.attrib['r'] if character.isalpha())
                cells[column] = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
            if cells.get('K') == str(REFERENCE_YEAR) and cells.get('F'):
                total = float(cells['L'])
                result[cells['F']] = {name: float(cells[column]) / total * 100 for name, column in [('young', 'O'), ('working', 'AV'), ('older', 'BK')]}
            row.clear()
    if len(result) < 200:
        raise ValueError('Incomplete WPP age table')
    return result


def latest_observations(filename):
    metadata, observations = json.loads((CACHE / filename).read_text())
    if metadata['pages'] != 1:
        raise ValueError(f'Incomplete response: {filename}')
    result = {}
    for observation in observations:
        country = observation['countryiso3code']
        if observation['value'] is None or not country:
            continue
        year = int(observation['date'])
        if country not in result or result[country]['year'] < year:
            result[country] = {'value': observation['value'], 'year': year}
    return result


def build_profiles():
    CACHE.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        manifest = dict(executor.map(acquire_source, SOURCES.items()))
    population = {}
    with gzip.open(CACHE / 'population.csv.gz', 'rt', encoding='utf-8-sig') as source:
        for row in csv.DictReader(source):
            if row['Time'] == str(REFERENCE_YEAR) and row['ISO3_code']:
                population[row['ISO3_code']] = float(row['TPopulation1July']) * 1000
    ages = read_age_distribution()
    education = latest_observations('education.json')
    income = latest_observations('income.json')
    world = json.loads((ROOT / 'src/game/data/world.json').read_text())
    profiles = {}
    for code, country in world['countries'].items():
        profiles[code] = {
            'population': population.get(code),
            **ages.get(code, {key: country[key] for key in ['young', 'working', 'older']}),
            'digital': country['internet'], 'urban': country['urban'],
            'education': education.get(code, {}).get('value'),
            'educationYear': education.get(code, {}).get('year'),
            'income': income.get(code, {}).get('value'),
            'incomeYear': income.get(code, {}).get('year'),
        }
    output = ROOT / 'src/game/data/social-profiles.json'
    output.write_text(json.dumps(profiles, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
    report = {
        'referenceYear': REFERENCE_YEAR,
        'retrieved': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sources': manifest,
        'existingSources': 'sources.json (ITU internet/World Bank urbanization; age fallback only when absent from WPP2024)',
        'educationIndicator': json.loads((CACHE / 'education-metadata.json').read_text())[1][0],
        'ageMetadata': [json.loads((CACHE / f'{code}-metadata.json').read_text())[1][0] for code in ['SP.POP.0014.TO.ZS', 'SP.POP.1564.TO.ZS', 'SP.POP.65UP.TO.ZS']],
        'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'coverageCountries': {key: sum(profile[key] is not None for profile in profiles.values()) for key in ['population', 'digital', 'education', 'income']},
        'missingData': 'No cross-country or future-year imputation. UI retains null. Simulation uses an explicitly assumed neutral score of 50 when a normalized characteristic is missing.',
        'normalization': {'digital': 'ITU internet percentage, 0..100', 'education': 'UIS lower-secondary attainment percentage, population 25+; national proxy for all cohorts', 'economic': '100 * clamp(log(GNI per capita PPP constant 2021 international $ / 200) / log(90000/200), 0, 1)', 'urban': 'Density rank weighted to national World Bank urban share; digital urban/rural adjustment mean-preserving and constrained to 0..100. Other characteristics are not assigned invented urban/rural statistics.'},
    }
    (ROOT / 'data/statistics/social-sources.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(report['coverageCountries'])


if __name__ == '__main__':
    build_profiles()
