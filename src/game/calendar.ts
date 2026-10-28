import calendar from './data/simulation/calendar.json' with { type: 'json' };

/** tickは開始日からの経過日数。UTCで計算し、端末の時差や夏時間の影響を受けない。 */
export function gameDate(tick: number) {
    const date = new Date(`${calendar.startDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + tick);
    const iso = date.toISOString().slice(0, 10);
    return { iso, label: iso.replaceAll('-', '.') };
}
