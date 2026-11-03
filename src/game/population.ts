import { geographicDistance, project } from '../map/geometry.ts';
import socialProfiles from './data/social-profiles.json' with { type: 'json' };
import world from './data/world.json' with { type: 'json' };
import type { Population } from './types.ts';

export interface SocialProfile {
    population: number | null;
    young: number | null;
    working: number | null;
    older: number | null;
    digital: number | null;
    urban: number | null;
    education: number | null;
    educationYear: number | null;
    income: number | null;
    incomeYear: number | null;
}
export const SOCIAL_PROFILES: Record<string, SocialProfile> = socialProfiles;
export function randomSource(seed: number) {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4_294_967_296;
    };
}
const score = (value: number) => Math.max(0, Math.min(100, value));

function ageFromDistribution(quantile: number, profile: SocialProfile, fallback: number | null) {
    if (profile.young === null || profile.working === null || profile.older === null)
        return fallback;
    const young = profile.young / 100;
    const working = profile.working / 100;
    if (quantile < young) return (quantile / Math.max(young, 0.001)) * 15;
    if (quantile < young + working)
        return 15 + ((quantile - young) / Math.max(working, 0.001)) * 50;
    return 65 + ((quantile - young - working) / Math.max(profile.older / 100, 0.001)) * 24;
}

function countrySampling() {
    const countries = new Map<string, number[]>();
    world.points.forEach((point, id) => {
        const ids = countries.get(point.country) ?? [];
        ids.push(id);
        countries.set(point.country, ids);
    });
    const urban = new Set<number>();
    const quantiles = new Map<number, number>();
    const countryWeights = new Map<string, number>();
    const urbanFractions = new Map<string, number>();
    for (const [code, ids] of countries) {
        const total = ids.reduce((sum, id) => sum + world.points[id].weight, 0);
        countryWeights.set(code, total);
        let cumulative = 0;
        ids.forEach((id) => {
            quantiles.set(id, (cumulative + world.points[id].weight / 2) / total);
            cumulative += world.points[id].weight;
        });
        const ranked = [...ids].sort((a, b) => world.points[b].density - world.points[a].density);
        const target = ((SOCIAL_PROFILES[code].urban ?? 0) / 100) * total;
        let urbanWeight = 0;
        for (const id of ranked) {
            const weight = world.points[id].weight;
            if (urbanWeight + weight / 2 < target) {
                urban.add(id);
                urbanWeight += weight;
            }
        }
        urbanFractions.set(code, urbanWeight / total);
    }
    return { urban, quantiles, countryWeights, urbanFractions };
}

/** 公表値から国別初期条件を作る。心理値・社会的つながり・都市補正は明示したモデル。 */
export function createPopulation(seed = 2030): Population[] {
    const random = randomSource(seed);
    const sample = countrySampling();
    const points = world.points.map((source, id): Population => {
        const country = world.countries[source.country as keyof typeof world.countries];
        const profile = SOCIAL_PROFILES[source.country];
        const employment = country.employment === null ? null : country.employment / 100;
        const age = ageFromDistribution(sample.quantiles.get(id)!, profile, source.age);
        const urban = sample.urban.has(id);
        const urbanFraction = sample.urbanFractions.get(source.country)!;
        // 全国平均を維持した都市・地方シナリオ。都市別の実測接続率ではない。
        let digital = profile.digital;
        if (digital !== null && urbanFraction > 0 && urbanFraction < 1) {
            const urbanRuralGap = Math.min(
                10,
                (100 - digital) / (1 - urbanFraction),
                digital / urbanFraction,
            );
            digital += (urban ? 1 - urbanFraction : -urbanFraction) * urbanRuralGap;
        }
        const economic =
            profile.income === null
                ? null
                : score(
                      (Math.log(Math.max(200, profile.income) / 200) / Math.log(90000 / 200)) * 100,
                  );
        const employed =
            age !== null &&
            age >= 15 &&
            employment !== null &&
            (id * 0.61803398875) % 1 < employment;
        const online = digital !== null && (id * 0.41421356237) % 1 < digital / 100;
        const field =
            age !== null && age < 15
                ? 0
                : age !== null && age >= 65
                  ? 3
                  : employed
                    ? 1
                    : online
                      ? 2
                      : 4;
        let sector: Population['sector'] = null;
        if (
            employed &&
            country.agriculture !== null &&
            country.industry !== null &&
            country.services !== null
        ) {
            const share =
                ((id * 0.73205080757) % 1) *
                (country.agriculture + country.industry + country.services);
            sector =
                share < country.agriculture
                    ? 'agriculture'
                    : share < country.agriculture + country.industry
                      ? 'industry'
                      : 'services';
        }
        // 特定国の信頼・警戒を実測したと見なさない。全地域共通の仮定＋再現可能な個体差。
        const baseline = {
            trust: 44 + (random() - 0.5) * 12,
            autonomy: 82 + (random() - 0.5) * 12,
            vigilance: 34 + (random() - 0.5) * 12,
            conformity: 48 + (random() - 0.5) * 24,
        };
        return {
            id,
            area: source.area,
            ...project(source.longitude, source.latitude),
            age,
            country: source.country,
            weight:
                profile.population === null
                    ? source.weight
                    : (source.weight / sample.countryWeights.get(source.country)!) *
                      profile.population,
            density: source.density,
            cellPopulation: source.cellPopulation,
            internet: profile.digital === null ? null : profile.digital / 100,
            employment,
            sector,
            field,
            susceptibility: 0.75 + ((digital ?? 50) / 100) * 0.2,
            stage: 0,
            progress: 0,
            neighbors: [],
            digital,
            education: profile.education,
            economic,
            social: score(
                35 +
                    Math.min(1, Math.log10(Math.max(1, source.density)) / 4) * 30 +
                    (random() - 0.5) * 14,
            ),
            urban,
            baseline,
            ...baseline,
            schoolExposure: 0,
            demographicSource: profile.population === null ? 'GHSL/WDI' : 'WPP2024',
        };
    });
    for (const point of points) {
        point.neighbors = points
            .filter((other) => other.id !== point.id && other.area === point.area)
            .map((other) => ({
                id: other.id,
                distance: geographicDistance(world.points[point.id], world.points[other.id]),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .map((other) => other.id);
    }
    return points;
}
