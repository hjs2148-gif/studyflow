import { addDays, countStudyDays, dayOfWeek, diffDays, maxDate } from './dates';
import type { Chapter, DateStr, StudySession, Subject } from './types';

/** 목차 기반 과목의 목표량 = 하위 단원이 없는 단원(leaf)의 목표량 합 */
export function subjectTarget(subject: Subject, chapters: Chapter[]): number {
  return roundBase(subject, chapters) * (subject.targetRounds ?? 1);
}

/** 1회독 분량 */
export function roundBase(subject: Subject, chapters: Chapter[]): number {
  if (subject.mode === 'amount') return subject.targetAmount;
  const own = chapters.filter((c) => c.subjectId === subject.id);
  const parents = new Set(own.map((c) => c.parentId).filter(Boolean));
  return own.filter((c) => !parents.has(c.id)).reduce((s, c) => s + c.targetAmount, 0);
}

export function sessionsOf(subjectId: string, sessions: StudySession[]) {
  return sessions.filter((s) => s.subjectId === subjectId);
}

export function completedAmount(subjectId: string, sessions: StudySession[], beforeDate?: DateStr): number {
  return sessionsOf(subjectId, sessions)
    .filter((s) => (beforeDate ? s.date < beforeDate : true))
    .reduce((sum, s) => sum + s.amount, 0);
}

export function progressPercent(completed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (completed / target) * 100);
}

/**
 * 학습속도(분량/분). 신뢰할 수 있는 기록이 minSessions 회 미만이면 null.
 * 학습시간 ↔ 분량 환산은 이 값이 있을 때만 한다.
 */
export function paceAmountPerMinute(subjectId: string, sessions: StudySession[], minSessions = 3): number | null {
  const valid = sessionsOf(subjectId, sessions).filter((s) => s.amount > 0 && s.durationSeconds >= 60);
  if (valid.length < minSessions) return null;
  const amount = valid.reduce((s, x) => s + x.amount, 0);
  const minutes = valid.reduce((s, x) => s + x.durationSeconds, 0) / 60;
  return minutes > 0 ? amount / minutes : null;
}

export type PlanState = 'done' | 'on_track' | 'behind' | 'overloaded' | 'overdue' | 'not_started';

export interface RescheduleOption {
  kind: 'extend' | 'reduce';
  label: string;
  /** extend: 새 종료일 / reduce: 종료일까지 현실적으로 가능한 목표량 */
  newEndDate?: DateStr;
  newTarget?: number;
}

export interface PlanSummary {
  target: number;
  completed: number;
  remaining: number;
  progress: number;
  /** ① 최초 계획 하루 권장량: 전체 목표 ÷ 전체 학습일 */
  originalDaily: number;
  /** ② 현재 진도 반영 필요 권장량: 오늘 시작 시점 남은 분량 ÷ 남은 학습일(오늘 포함) */
  requiredDaily: number;
  /** ③ 현실 권장량: 시간 예산 × 학습속도. 속도 데이터가 없으면 null */
  realisticDaily: number | null;
  remainingStudyDays: number;
  totalStudyDays: number;
  isStudyDayToday: boolean;
  /** 오늘 목표량 (공부 가능한 날이 아니면 0) */
  todayTarget: number;
  todayDone: number;
  /** 최근 속도 기준 예상 완료일. 데이터 부족 시 null */
  projectedEnd: DateStr | null;
  paceKnown: boolean;
  state: PlanState;
  options: RescheduleOption[];
}

export interface PlanInput {
  subject: Subject;
  chapters: Chapter[];
  sessions: StudySession[];
  today: DateStr;
  /** 이 과목에 배정 가능한 하루 시간(분). 모르면 undefined */
  budgetMinutes?: number;
}

const RECENT_WINDOW_DAYS = 14;
const OVERLOAD_RATIO = 1.5;

export function summarizePlan({ subject, chapters, sessions, today, budgetMinutes }: PlanInput): PlanSummary {
  const target = subjectTarget(subject, chapters);
  const completed = completedAmount(subject.id, sessions);
  const completedBeforeToday = completedAmount(subject.id, sessions, today);
  const todayDone = completed - completedBeforeToday;
  const remaining = Math.max(0, target - completed);
  const progress = progressPercent(completed, target);

  const totalStudyDays = countStudyDays(subject.startDate, subject.endDate, subject.studyDays);
  const originalDaily = totalStudyDays > 0 ? target / totalStudyDays : 0;

  const from = maxDate(today, subject.startDate);
  const remainingStudyDays = countStudyDays(from, subject.endDate, subject.studyDays);
  const isStudyDayToday =
    subject.studyDays.includes(dayOfWeek(today)) && today >= subject.startDate && today <= subject.endDate;

  const remainingAtDayStart = Math.max(0, target - completedBeforeToday);
  const requiredDaily = remainingStudyDays > 0 ? remainingAtDayStart / remainingStudyDays : remainingAtDayStart;

  const pace = paceAmountPerMinute(subject.id, sessions);
  const realisticDaily =
    pace !== null && budgetMinutes !== undefined && budgetMinutes > 0 ? pace * budgetMinutes : null;

  const projectedEnd = projectEnd({ subject, remaining, sessions, today });
  const paceKnown = projectedEnd !== null;

  let state: PlanState;
  if (target > 0 && remaining === 0) state = 'done';
  else if (today < subject.startDate) state = 'not_started';
  else if (remainingStudyDays === 0) state = 'overdue';
  else if (
    originalDaily > 0 &&
    (requiredDaily > originalDaily * OVERLOAD_RATIO || (realisticDaily !== null && requiredDaily > realisticDaily * 1.15))
  )
    state = 'overloaded';
  else if (originalDaily > 0 && requiredDaily > originalDaily * 1.1) state = 'behind';
  else state = 'on_track';

  const todayTarget = isStudyDayToday && remaining > 0 ? requiredDaily : 0;

  const options =
    state === 'overloaded' || state === 'overdue' || state === 'behind'
      ? buildOptions({ subject, remaining, remainingStudyDays, originalDaily, realisticDaily, today, unit: subject.unit })
      : [];

  return {
    target,
    completed,
    remaining,
    progress,
    originalDaily,
    requiredDaily,
    realisticDaily,
    remainingStudyDays,
    totalStudyDays,
    isStudyDayToday,
    todayTarget,
    todayDone,
    projectedEnd,
    paceKnown,
    state,
    options,
  };
}

/** 최근 14일 학습 가능일당 평균 완료량으로 완료일을 추정. 기록이 없으면 null */
function projectEnd(args: {
  subject: Subject;
  remaining: number;
  sessions: StudySession[];
  today: DateStr;
}): DateStr | null {
  const { subject, remaining, sessions, today } = args;
  if (remaining <= 0) return today;
  const windowStart = maxDate(addDays(today, -(RECENT_WINDOW_DAYS - 1)), subject.startDate);
  const studyDaysInWindow = countStudyDays(windowStart, today, subject.studyDays);
  const recent = sessionsOf(subject.id, sessions).filter((s) => s.date >= windowStart && s.date <= today);
  const recentAmount = recent.reduce((s, x) => s + x.amount, 0);
  if (recent.length < 2 || studyDaysInWindow === 0 || recentAmount <= 0) return null;
  const perStudyDay = recentAmount / studyDaysInWindow;
  const daysNeeded = Math.ceil(remaining / perStudyDay);
  const set = new Set(subject.studyDays);
  if (set.size === 0) return null;
  let d = today;
  let counted = 0;
  for (let i = 0; i < 3650 && counted < daysNeeded; i++) {
    d = addDays(d, 1);
    if (set.has(dayOfWeek(d))) counted++;
  }
  return d;
}

function buildOptions(a: {
  subject: Subject;
  remaining: number;
  remainingStudyDays: number;
  originalDaily: number;
  realisticDaily: number | null;
  today: DateStr;
  unit: string;
}): RescheduleOption[] {
  const out: RescheduleOption[] = [];
  const perDay = a.realisticDaily && a.realisticDaily > 0 ? a.realisticDaily : a.originalDaily;
  if (perDay > 0 && a.remaining > 0) {
    const daysNeeded = Math.ceil(a.remaining / perDay);
    const set = new Set(a.subject.studyDays);
    let d = maxDate(a.today, a.subject.startDate);
    let counted = 0;
    // 오늘 이전은 지났으므로 오늘부터 센다 (오늘이 학습일이면 오늘 포함)
    if (set.has(dayOfWeek(d))) counted++;
    for (let i = 0; i < 3650 && counted < daysNeeded; i++) {
      d = addDays(d, 1);
      if (set.has(dayOfWeek(d))) counted++;
    }
    if (set.size > 0 && d > a.subject.endDate) {
      out.push({
        kind: 'extend',
        newEndDate: d,
        label: `종료일을 ${d}(으)로 ${diffDays(a.subject.endDate, d)}일 연장 (하루 약 ${fmt(perDay)}${a.unit} 유지)`,
      });
    }
  }
  if (a.remainingStudyDays > 0 && perDay > 0) {
    const reachable = Math.floor(perDay * a.remainingStudyDays);
    if (reachable < a.remaining) {
      out.push({
        kind: 'reduce',
        newTarget: reachable,
        label: `종료일까지 현실적으로 가능한 약 ${reachable}${a.unit}만 목표로 조정하고 나머지는 후순위`,
      });
    }
  }
  return out;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 단원별 완료량 */
export function chapterCompleted(chapterId: string, sessions: StudySession[]): number {
  return sessions.filter((s) => s.chapterId === chapterId).reduce((sum, s) => sum + s.amount, 0);
}

/** 오늘 추천 1개: 오늘 목표가 가장 많이 남은 과목, 지연/과부하 과목 우선 */
export function pickPriority(items: { subject: Subject; plan: PlanSummary }[]) {
  const rank = (p: PlanSummary) =>
    (p.state === 'overloaded' || p.state === 'overdue' ? 2 : p.state === 'behind' ? 1 : 0) * 1000 +
    Math.max(0, p.todayTarget - p.todayDone);
  return items
    .filter((i) => i.plan.state !== 'done' && i.plan.state !== 'not_started' && i.plan.isStudyDayToday && i.plan.todayTarget - i.plan.todayDone > 0)
    .sort((a, b) => rank(b.plan) - rank(a.plan))[0];
}

export interface RoundInfo {
  rounds: number;
  /** 현재 회독 (1부터) */
  round: number;
  base: number;
  /** 현재 회독에서 완료한 분량 */
  inRound: number;
  /** 끝낸 회독별 소요일 */
  history: { round: number; days: number }[];
}

export function roundInfo(subject: Subject, chapters: Chapter[], sessions: StudySession[]): RoundInfo {
  const rounds = subject.targetRounds ?? 1;
  const base = roundBase(subject, chapters);
  const mine = sessionsOf(subject.id, sessions).sort((a, b) => a.date.localeCompare(b.date) || a.endTime - b.endTime);
  const completed = mine.reduce((s, x) => s + x.amount, 0);
  if (base <= 0) return { rounds, round: 1, base, inRound: 0, history: [] };
  const round = Math.min(rounds, Math.floor(completed / base) + 1);
  const inRound = Math.min(base, completed - (round - 1) * base);
  const history: RoundInfo['history'] = [];
  let cum = 0;
  let from = mine[0]?.date;
  for (const s of mine) {
    cum += s.amount;
    while (history.length < rounds && cum >= (history.length + 1) * base) {
      history.push({ round: history.length + 1, days: diffDays(from!, s.date) + 1 });
      from = s.date;
    }
  }
  return { rounds, round, base, inRound, history };
}

/** 현재 회독 기준 단원 완료량 */
export function chapterInRound(chapter: Chapter, round: number, sessions: StudySession[]): number {
  const t = chapter.targetAmount;
  return Math.max(0, Math.min(t, chapterCompleted(chapter.id, sessions) - (round - 1) * t));
}
