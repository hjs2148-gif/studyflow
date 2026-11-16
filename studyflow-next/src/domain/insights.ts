import { addDays, dayOfWeek, weekStart } from './dates';
import { summarizePlan, type PlanSummary } from './plan';
import type { AppData, Chapter, DateStr, StudySession, Subject, Understanding } from './types';

export const UNDERSTANDING_SCORE: Record<Understanding, number> = { explain: 2, recognize: 1, unsure: 0 };
export const UNDERSTANDING_LABEL: Record<Understanding, string> = {
  explain: '안 보고 설명할 수 있음',
  recognize: '보면 알아볼 수 있음',
  unsure: '아직 잘 모르겠음',
};

/** 예측 - 실제. 양수면 과대평가, 음수면 과소평가 */
export function calibrationGap(s: Pick<StudySession, 'predictedUnderstanding' | 'actualUnderstanding'>): number | null {
  if (!s.predictedUnderstanding || !s.actualUnderstanding) return null;
  return UNDERSTANDING_SCORE[s.predictedUnderstanding] - UNDERSTANDING_SCORE[s.actualUnderstanding];
}

export interface Calibration {
  samples: number;
  over: number;
  under: number;
  accurate: number;
  enough: boolean;
}

export const MIN_CALIBRATION_SAMPLES = 3;

export function calibrationSummary(sessions: StudySession[]): Calibration {
  const gaps = sessions.map(calibrationGap).filter((g): g is number => g !== null);
  const over = gaps.filter((g) => g > 0).length;
  const under = gaps.filter((g) => g < 0).length;
  return { samples: gaps.length, over, under, accurate: gaps.length - over - under, enough: gaps.length >= MIN_CALIBRATION_SAMPLES };
}

export function minutesOn(sessions: StudySession[], from: DateStr, to: DateStr): number {
  return Math.round(
    sessions.filter((s) => s.date >= from && s.date <= to).reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
  );
}

export interface WeeklyStats {
  from: DateStr;
  to: DateStr;
  minutes: number;
  goalMinutes: number;
  attainment: number | null;
}

/** 이번 주(월~일) 학습시간. 목표 = 하루 목표 × 학습 가능일 수(활성 과목 중 하나라도 공부 가능한 요일) */
export function weeklyStats(data: AppData, today: DateStr): WeeklyStats {
  const from = weekStart(today);
  const to = addDays(from, 6);
  const minutes = minutesOn(data.sessions, from, to);
  const dailyGoal = data.exam?.dailyGoalMinutes ?? 0;
  const active = data.subjects.filter((s) => s.status === 'active');
  const days = new Set<number>();
  active.forEach((s) => s.studyDays.forEach((d) => days.add(d)));
  let studyDayCount = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (days.has(dayOfWeek(d))) studyDayCount++;
  }
  const goalMinutes = dailyGoal * studyDayCount;
  return { from, to, minutes, goalMinutes, attainment: goalMinutes > 0 ? minutes / goalMinutes : null };
}

/** 과목 시간 예산: 하루 목표시간을 오늘 공부 가능한 활성 과목 수로 균등 분배 (단순 가정) */
export function budgetFor(data: AppData, today: DateStr): number | undefined {
  const goal = data.exam?.dailyGoalMinutes;
  if (!goal) return undefined;
  const dow = dayOfWeek(today);
  const n = data.subjects.filter((s) => s.status === 'active' && s.studyDays.includes(dow)).length || 1;
  return goal / n;
}

export function planFor(data: AppData, subject: Subject, today: DateStr): PlanSummary {
  return summarizePlan({
    subject,
    chapters: data.chapters,
    sessions: data.sessions,
    today,
    budgetMinutes: budgetFor(data, today),
  });
}

export interface WeakChapter {
  subjectId: string;
  chapterId: string | null;
  title: string;
  reason: string;
}

/** 취약 단원: 가장 최근 이해도가 '모르겠음' 이거나 최근 복습에서 '잊어버림' */
export function weakChapters(data: AppData): WeakChapter[] {
  const out: WeakChapter[] = [];
  const keys = new Map<string, { subjectId: string; chapterId: string | null }>();
  data.sessions.forEach((s) => keys.set(`${s.subjectId}::${s.chapterId ?? ''}`, { subjectId: s.subjectId, chapterId: s.chapterId }));
  for (const { subjectId, chapterId } of keys.values()) {
    const rel = data.sessions
      .filter((s) => s.subjectId === subjectId && s.chapterId === chapterId && s.actualUnderstanding)
      .sort((a, b) => b.endTime - a.endTime);
    const latest = rel[0];
    const review = data.reviews.find((r) => r.subjectId === subjectId && r.chapterId === chapterId);
    const lastOutcome = review?.outcomes[review.outcomes.length - 1];
    let reason = '';
    if (lastOutcome?.result === 'forgot') reason = '최근 복습에서 잊어버림';
    else if (latest?.actualUnderstanding === 'unsure' && !(lastOutcome && lastOutcome.result === 'remembered'))
      reason = '최근 학습 후에도 잘 모르겠음';
    if (reason) out.push({ subjectId, chapterId, title: titleOf(data.subjects, data.chapters, subjectId, chapterId), reason });
  }
  return out;
}

export function titleOf(subjects: Subject[], chapters: Chapter[], subjectId: string, chapterId: string | null) {
  const sub = subjects.find((s) => s.id === subjectId)?.name ?? '(삭제된 과목)';
  if (!chapterId) return sub;
  const ch = chapters.find((c) => c.id === chapterId)?.title ?? '(삭제된 단원)';
  return `${sub} · ${ch}`;
}

export interface Verdict {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  verdict: string;
  evidence: string;
  action: string;
}

/** 판정 → 근거 → 다음 행동. 기록이 부족하면 억지로 분석하지 않는다. */
export function buildVerdicts(data: AppData, today: DateStr): Verdict[] {
  const out: Verdict[] = [];
  for (const subject of data.subjects.filter((s) => s.status === 'active')) {
    const plan = planFor(data, subject, today);
    const count = data.sessions.filter((s) => s.subjectId === subject.id).length;
    if (plan.state === 'done') continue;
    if (plan.state === 'not_started') continue;
    if (count < 2 && plan.state !== 'overdue') {
      out.push({
        tone: 'neutral',
        verdict: `${subject.name}: 분석할 기록이 아직 부족합니다.`,
        evidence: `학습 기록 ${count}회. 2회 이상 쌓이면 속도와 지연 여부를 판단합니다.`,
        action: '오늘 한 번 공부하고 분량을 기록해 보세요.',
      });
      continue;
    }
    if (plan.state === 'overloaded' || plan.state === 'overdue') {
      out.push({
        tone: 'bad',
        verdict: `${subject.name} 진도가 현실적인 범위를 넘어 지연되고 있습니다.`,
        evidence: `하루 권장량이 최초 ${n(plan.originalDaily)}${subject.unit}에서 ${n(plan.requiredDaily)}${subject.unit}로 늘었습니다.${plan.realisticDaily !== null ? ` 학습속도 기준 하루 가능량은 약 ${n(plan.realisticDaily)}${subject.unit}입니다.` : ''}`,
        action: plan.options[0]?.label ?? '계획 화면에서 기간이나 목표량 재조정을 검토하세요.',
      });
    } else if (plan.state === 'behind') {
      out.push({
        tone: 'warn',
        verdict: `${subject.name} 진도가 계획보다 조금 늦습니다.`,
        evidence: `하루 권장량이 ${n(plan.originalDaily)}${subject.unit}에서 ${n(plan.requiredDaily)}${subject.unit}로 늘었습니다.`,
        action: '이번 주 이 과목을 먼저 배치해 보세요.',
      });
    } else {
      out.push({
        tone: 'good',
        verdict: `${subject.name}은(는) 계획대로 진행 중입니다.`,
        evidence: `진행률 ${plan.progress.toFixed(0)}%, 남은 ${n(plan.remaining)}${subject.unit}.${plan.projectedEnd ? ` 최근 속도 기준 예상 완료일은 ${plan.projectedEnd}입니다.` : ''}`,
        action: `오늘 목표 ${n(plan.todayTarget)}${subject.unit}를 이어가세요.`,
      });
    }
  }
  return out;
}

export function n(x: number): string {
  return Number.isInteger(x) ? String(x) : (Math.round(x * 10) / 10).toString();
}
