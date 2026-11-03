import { START_DAY, START_MONTH, START_YEAR } from './data.ts';

/** 各月の開始日は公開日に揃え、30日がない月はその月の末日とする。 */
function monthStart(month: number) {
    const target = START_MONTH - 1 + month;
    const lastDay = new Date(Date.UTC(START_YEAR, target + 1, 0)).getUTCDate();
    return Date.UTC(START_YEAR, target, Math.min(START_DAY, lastDay));
}

export function calendarParts(month: number, fraction: number) {
    const start = monthStart(month);
    const end = monthStart(month + 1);
    const date = new Date(start + (end - start) * Math.max(0, Math.min(1, fraction)));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
