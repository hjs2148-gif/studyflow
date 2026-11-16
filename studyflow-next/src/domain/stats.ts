import { addDays, dayOfWeek, maxDate, weekStart } from './dates';
import { summarizePlan } from './plan';
import type { AppData, DateStr, StudySession, Subject } from './types';

export interface DayTotal {
  minutes: number;
  amount: number;
}

export function dailyTotals(sessions: StudySession[]): Map<DateStr, DayTotal> {
  const m = new Map<DateStr, DayTotal>();
  for (const s of sessions) {
    const cur = m.get(s.date) ?? { minutes: 0, amount: 0 };
    cur.minutes += s.durationSeconds / 60;
    cur.amount += s.amount;
    m.set(s.date, cur);
  }
  return m;
}

/** 학습 가능일 = 진행 중 과목 중 하나라도 공부하는 요일. 쉬는 요일은 연속일을 끊지 않는다. */
export function studyWeekdays(data: AppData): Set<number> {
  const set = new Set<number>();
  data.subjects.filter((s) => s.status === 'active').forEach((s) => s.studyDays.forEach((d) => set.add(d)));
  return set;
}

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * 연속 학습일. 기록(시간 또는 분량)이 있는 날만 센다.
 * 쉬는 요일은 건너뛰고, 학습일에 기록이 없으면 끊긴다. 오늘 기록이 아직 없어도 어제까지의 연속은 유지한다.
 */
export function streaks(data: AppData, today: DateStr): Streaks {
  const totals = dailyTotals(data.sessions);
  const days = studyWeekdays(data);
  const done = (d: DateStr) => {
    const t = totals.get(d);
    return !!t && (t.minutes > 0 || t.amount > 0);
  };
  const dates = [...totals.keys()].filter(done).sort();
  if (dates.length === 0) return { current: 0, longest: 0 };

  // 학습일(기록이 있으면 요일 무관하게 학습일로 인정) 사이의 간격이 모두 쉬는 요일이면 연속
  const isOff = (d: DateStr) => !days.has(dayOfWeek(d)) && !done(d);
  const gapOnlyRest = (a: DateStr, b: DateStr) => {
    for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (!isOff(d)) return false;
    return true;
  };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = gapOnlyRest(dates[i - 1], dates[i]) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const last = dates[dates.length - 1];
  const alive = gapOnlyRest(last, today) || last === today || (!done(today) && gapOnlyRest(last, addDays(today, 1)));
  if (!alive) return { current: 0, longest };
  let current = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (gapOnlyRest(dates[i - 1], dates[i])) current++;
    else break;
  }
  return { current, longest };
}

export interface HeatCell {
  date: DateStr;
  minutes: number;
  /** 0~4 농도 */
  level: number;
  future: boolean;
}

/** 월요일 시작, 최근 weeks 주 격자 (열 = 주, 행 = 월~일) */
export function heatmap(sessions: StudySession[], today: DateStr, weeks = 12): HeatCell[][] {
  const totals = dailyTotals(sessions);
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const minutes = Math.round(totals.get(date)?.minutes ?? 0);
      const amount = totals.get(date)?.amount ?? 0;
      const level = minutes === 0 && amount === 0 ? 0 : minutes < 30 ? 1 : minutes < 90 ? 2 : minutes < 180 ? 3 : 4;
      col.push({ date, minutes, level, future: date > today });
    }
    cols.push(col);
  }
  return cols;
}

export interface Records {
  bestDayMinutes: number;
  bestDayDate: DateStr | null;
  totalMinutes: number;
  activeDays: number;
}

export function records(sessions: StudySession[]): Records {
  const totals = dailyTotals(sessions);
  let best = 0;
  let bestDate: DateStr | null = null;
  let total = 0;
  for (const [d, t] of totals) {
    total += t.minutes;
    if (t.minutes > best) {
      best = t.minutes;
      bestDate = d;
    }
  }
  return { bestDayMinutes: Math.round(best), bestDayDate: bestDate, totalMinutes: Math.round(total), activeDays: totals.size };
}

export interface PacePoint {
  date: DateStr;
  plan: number;
  /** 오늘까지만 값이 있다 */
  actual: number | null;
}

export interface PaceSeries {
  points: PacePoint[];
  target: number;
  /** 오늘 시점 계획선 - 실제 (양수면 계획보다 적게 한 것) */
  gapToday: number;
}

/** 계획선(최초 계획 기준 누적) vs 실제선(누적 완료량). 시작일~종료일 */
export function paceSeries(data: AppData, subject: Subject, today: DateStr): PaceSeries | null {
  const plan = summarizePlan({ subject, chapters: data.chapters, sessions: data.sessions, today });
  if (plan.target <= 0 || plan.totalStudyDays === 0) return null;
  const perDay = plan.originalDaily;
  const days = new Set(subject.studyDays);
  const byDate = new Map<DateStr, number>();
  data.sessions.filter((s) => s.subjectId === subject.id).forEach((s) => byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.amount));
  const lastDate = maxDate(subject.endDate, today);
  const points: PacePoint[] = [];
  let planAcc = 0;
  let actualAcc = 0;
  for (let d = subject.startDate; d <= lastDate; d = addDays(d, 1)) {
    if (days.has(dayOfWeek(d)) && d <= subject.endDate) planAcc += perDay;
    actualAcc += byDate.get(d) ?? 0;
    points.push({ date: d, plan: Math.min(planAcc, plan.target), actual: d <= today ? actualAcc : null });
  }
  const todayPt = points.find((p) => p.date === today) ?? points[points.length - 1];
  const gapToday = todayPt.plan - (todayPt.actual ?? 0);
  return { points, target: plan.target, gapToday };
}

export interface WeekRecap {
  minutes: number;
  prevMinutes: number;
  topSubjectId: string | null;
  activeDays: number;
}

export function weekRecap(data: AppData, today: DateStr): WeekRecap {
  const from = weekStart(today);
  const prevFrom = addDays(from, -7);
  const inRange = (s: StudySession, a: DateStr, b: DateStr) => s.date >= a && s.date <= b;
  const cur = data.sessions.filter((s) => inRange(s, from, addDays(from, 6)));
  const prev = data.sessions.filter((s) => inRange(s, prevFrom, addDays(prevFrom, 6)));
  const sum = (ss: StudySession[]) => Math.round(ss.reduce((a, s) => a + s.durationSeconds, 0) / 60);
  const bySubject = new Map<string, number>();
  cur.forEach((s) => bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + s.durationSeconds));
  const top = [...bySubject.entries()].sort((a, b) => b[1] - a[1])[0];
  return { minutes: sum(cur), prevMinutes: sum(prev), topSubjectId: top ? top[0] : null, activeDays: new Set(cur.map((s) => s.date)).size };
}
