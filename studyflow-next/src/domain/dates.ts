import type { DateStr } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 로컬 'YYYY-MM-DD' (toISOString 은 UTC 라 한국 새벽에 하루 어긋나므로 쓰지 않는다) */
export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 로컬 자정 Date */
export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDate(s)) === s;
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n); // 로컬 달력 기준이라 DST 영향 없음
  return toDateStr(d);
}

/** b - a (일). 둘 다 로컬 달력 날짜 */
export function diffDays(a: DateStr, b: DateStr): number {
  const da = parseDate(a);
  const db = parseDate(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

export function dayOfWeek(s: DateStr): number {
  return parseDate(s).getDay();
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a >= b ? a : b;
}

/** from~to(양끝 포함) 사이 학습 가능 요일에 해당하는 날 수 */
export function countStudyDays(from: DateStr, to: DateStr, studyDays: number[]): number {
  if (from > to || studyDays.length === 0) return 0;
  const set = new Set(studyDays);
  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (set.has(dayOfWeek(d))) count++;
  }
  return count;
}

/** 해당 날짜가 속한 주의 월요일 */
export function weekStart(s: DateStr): DateStr {
  const dow = dayOfWeek(s);
  return addDays(s, -((dow + 6) % 7));
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
