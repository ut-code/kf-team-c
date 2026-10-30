import { START_YEAR } from './data.ts';

export function daysInMonth(month: number) {
    return new Date(
        Date.UTC(START_YEAR + Math.floor(month / 12), (month % 12) + 1, 0),
    ).getUTCDate();
}

export function calendarParts(month: number, fraction: number) {
    const day = Math.min(daysInMonth(month), Math.floor(fraction * daysInMonth(month)) + 1);
    return { year: START_YEAR + Math.floor(month / 12), month: (month % 12) + 1, day };
}
