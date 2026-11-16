import { describe, expect, it } from 'vitest';
import { addDays, countStudyDays, diffDays, isValidDateStr, toDateStr, weekStart } from './dates';
import { buildVerdicts, calibrationGap, calibrationSummary, weakChapters, weeklyStats } from './insights';
import { paceAmountPerMinute, subjectTarget, summarizePlan } from './plan';
import { REVIEW_INTERVALS, applyReviewResult, createReview, dueReviews } from './review';
import { EMPTY_DATA, type AppData, type Chapter, type StudySession, type Subject } from './types';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const subject = (o: Partial<Subject> = {}): Subject => ({
  id: 's1', examId: 'e1', name: '행정쟁송법', mode: 'amount', targetAmount: 500, unit: '페이지',
  startDate: '2026-01-01', endDate: '2026-02-19', studyDays: ALL, status: 'active', ...o,
});

const session = (o: Partial<StudySession> = {}): StudySession => ({
  id: Math.random().toString(36), subjectId: 's1', chapterId: null, date: '2026-01-05',
  startTime: 0, endTime: 0, durationSeconds: 3600, amount: 10,
  predictedUnderstanding: null, actualUnderstanding: null, recallText: '', focusScore: null, memo: '', ...o,
});

describe('dates', () => {
  it('로컬 날짜 문자열 왕복', () => {
    expect(toDateStr(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-01-01', '2026-02-19')).toBe(49);
  });
  it('잘못된 날짜 거부', () => {
    expect(isValidDateStr('2026-02-30')).toBe(false);
    expect(isValidDateStr('2026-1-1')).toBe(false);
    expect(isValidDateStr('2026-02-28')).toBe(true);
  });
  it('학습 가능일 수 (양끝 포함)', () => {
    expect(countStudyDays('2026-01-01', '2026-02-19', ALL)).toBe(50);
    // 2026-01-05(월)~01-11(일) 평일 5일
    expect(countStudyDays('2026-01-05', '2026-01-11', WEEKDAYS)).toBe(5);
    expect(countStudyDays('2026-02-01', '2026-01-01', ALL)).toBe(0);
    expect(countStudyDays('2026-01-01', '2026-01-31', [])).toBe(0);
  });
  it('주 시작은 월요일', () => {
    expect(weekStart('2026-01-11')).toBe('2026-01-05'); // 일요일
    expect(weekStart('2026-01-05')).toBe('2026-01-05');
  });
});

describe('plan 계산', () => {
  it('지시서 예시: 500페이지 / 50일 = 하루 10페이지', () => {
    const p = summarizePlan({ subject: subject(), chapters: [], sessions: [], today: '2026-01-01' });
    expect(p.totalStudyDays).toBe(50);
    expect(p.originalDaily).toBe(10);
    expect(p.requiredDaily).toBe(10);
    expect(p.todayTarget).toBe(10);
    expect(p.state).toBe('on_track');
  });
  it('진행률·남은 분량', () => {
    const p = summarizePlan({ subject: subject(), chapters: [], sessions: [session({ amount: 50 })], today: '2026-01-06' });
    expect(p.completed).toBe(50);
    expect(p.remaining).toBe(450);
    expect(p.progress).toBe(10);
  });
  it('오늘 공부해도 오늘 목표량은 하루 동안 흔들리지 않는다', () => {
    const before = summarizePlan({ subject: subject(), chapters: [], sessions: [], today: '2026-01-01' });
    const after = summarizePlan({ subject: subject(), chapters: [], sessions: [session({ date: '2026-01-01', amount: 4 })], today: '2026-01-01' });
    expect(after.todayTarget).toBe(before.todayTarget);
    expect(after.todayDone).toBe(4);
  });
  it('쉬는 요일에는 오늘 목표가 0', () => {
    // 2026-01-04 일요일
    const p = summarizePlan({ subject: subject({ studyDays: WEEKDAYS }), chapters: [], sessions: [], today: '2026-01-04' });
    expect(p.isStudyDayToday).toBe(false);
    expect(p.todayTarget).toBe(0);
  });
  it('크게 지연되면 overloaded + 재조정 제안, 자동 변경은 없다', () => {
    const s = subject();
    const p = summarizePlan({ subject: s, chapters: [], sessions: [session({ date: '2026-01-02', amount: 5 })], today: '2026-02-10' });
    expect(p.state).toBe('overloaded');
    expect(p.requiredDaily).toBeGreaterThan(p.originalDaily * 1.5);
    expect(p.options.length).toBeGreaterThan(0);
    expect(s.endDate).toBe('2026-02-19');
  });
  it('종료일이 지나면 overdue', () => {
    const p = summarizePlan({ subject: subject(), chapters: [], sessions: [session({ amount: 100 })], today: '2026-03-01' });
    expect(p.state).toBe('overdue');
  });
  it('완료 시 done', () => {
    const p = summarizePlan({ subject: subject({ targetAmount: 10 }), chapters: [], sessions: [session({ amount: 10 })], today: '2026-01-06' });
    expect(p.state).toBe('done');
    expect(p.remaining).toBe(0);
  });
  it('속도 기록이 3회 미만이면 환산·예상완료일을 만들지 않는다', () => {
    const ss = [session(), session({ date: '2026-01-06' })];
    expect(paceAmountPerMinute('s1', ss)).toBeNull();
    const p = summarizePlan({ subject: subject(), chapters: [], sessions: ss, today: '2026-01-07', budgetMinutes: 120 });
    expect(p.realisticDaily).toBeNull();
  });
  it('속도 기록이 있으면 현실 권장량 = 속도 × 시간', () => {
    const ss = [0, 1, 2].map((i) => session({ date: addDays('2026-01-05', i), durationSeconds: 3600, amount: 12 }));
    expect(paceAmountPerMinute('s1', ss)).toBeCloseTo(0.2);
    const p = summarizePlan({ subject: subject(), chapters: [], sessions: ss, today: '2026-01-08', budgetMinutes: 60 });
    expect(p.realisticDaily).toBeCloseTo(12);
    expect(p.projectedEnd).not.toBeNull();
  });
  it('목차 기반 과목의 목표량은 leaf 단원 합', () => {
    const ch = (id: string, parentId: string | null, t: number): Chapter => ({ id, subjectId: 's1', parentId, title: id, order: 0, targetAmount: t });
    const chapters = [ch('a', null, 999), ch('a1', 'a', 30), ch('a2', 'a', 20), ch('b', null, 50)];
    expect(subjectTarget(subject({ mode: 'chapters' }), chapters)).toBe(100);
  });
});

describe('복습 간격', () => {
  const base = createReview('r1', 's1', 'c1', '2026-01-10');
  it('최초 복습은 학습 다음날', () => {
    expect(base.nextReviewDate).toBe('2026-01-11');
    expect(REVIEW_INTERVALS).toEqual([1, 3, 7, 15, 30]);
  });
  it('기억남: 1→3→7→15→30 증가 후 30일 유지', () => {
    let r = base;
    const gaps: number[] = [];
    let day = '2026-01-11';
    for (let i = 0; i < 6; i++) {
      r = applyReviewResult(r, 'remembered', day);
      gaps.push(diffDays(day, r.nextReviewDate));
      day = r.nextReviewDate;
    }
    expect(gaps).toEqual([3, 7, 15, 30, 30, 30]);
  });
  it('가물가물: 현재 간격 유지', () => {
    const r1 = applyReviewResult(base, 'remembered', '2026-01-11'); // step1 → 3일
    const r2 = applyReviewResult(r1, 'hazy', '2026-01-14');
    expect(r2.reviewStep).toBe(1);
    expect(r2.nextReviewDate).toBe('2026-01-17');
  });
  it('잊어버림: 1일로 초기화', () => {
    const r1 = applyReviewResult(applyReviewResult(base, 'remembered', '2026-01-11'), 'remembered', '2026-01-14');
    const r2 = applyReviewResult(r1, 'forgot', '2026-01-21');
    expect(r2.reviewStep).toBe(0);
    expect(r2.nextReviewDate).toBe('2026-01-22');
    expect(r2.outcomes).toHaveLength(3);
  });
  it('복습 예정 목록', () => {
    expect(dueReviews([base], '2026-01-10')).toHaveLength(0);
    expect(dueReviews([base], '2026-01-11')).toHaveLength(1);
    expect(dueReviews([base], '2026-02-11')).toHaveLength(1);
  });
});

describe('메타인지·분석', () => {
  it('예측-실제 차이 (과대평가 > 0)', () => {
    expect(calibrationGap({ predictedUnderstanding: 'explain', actualUnderstanding: 'unsure' })).toBe(2);
    expect(calibrationGap({ predictedUnderstanding: 'unsure', actualUnderstanding: 'explain' })).toBe(-2);
    expect(calibrationGap({ predictedUnderstanding: null, actualUnderstanding: 'explain' })).toBeNull();
  });
  it('표본 3개 미만이면 enough=false', () => {
    const c = calibrationSummary([session({ predictedUnderstanding: 'explain', actualUnderstanding: 'unsure' })]);
    expect(c.samples).toBe(1);
    expect(c.over).toBe(1);
    expect(c.enough).toBe(false);
  });
  const data = (o: Partial<AppData>): AppData => ({
    ...EMPTY_DATA,
    exam: { id: 'e1', name: '노무사', examDate: '2026-12-01', dailyGoalMinutes: 120 },
    subjects: [subject()],
    ...o,
  });
  it('기록 부족 시 억지 분석 대신 안내', () => {
    const v = buildVerdicts(data({}), '2026-01-03');
    expect(v[0].tone).toBe('neutral');
    expect(v[0].verdict).toContain('부족');
  });
  it('지연 판정은 판정/근거/행동을 가진다', () => {
    const v = buildVerdicts(data({ sessions: [session({ date: '2026-01-02', amount: 5 }), session({ date: '2026-01-03', amount: 5 })] }), '2026-02-10');
    expect(v[0].tone).toBe('bad');
    expect(v[0].evidence).toContain('권장량');
    expect(v[0].action.length).toBeGreaterThan(0);
  });
  it('취약 단원: 잘 모르겠음 / 복습 잊어버림', () => {
    const r = applyReviewResult(createReview('r', 's1', 'c2', '2026-01-01'), 'forgot', '2026-01-02');
    const d = data({
      chapters: [
        { id: 'c1', subjectId: 's1', parentId: null, title: '임금', order: 0, targetAmount: 10 },
        { id: 'c2', subjectId: 's1', parentId: null, title: '근로시간', order: 1, targetAmount: 10 },
      ],
      sessions: [session({ chapterId: 'c1', actualUnderstanding: 'unsure' }), session({ chapterId: 'c2', actualUnderstanding: 'explain' })],
      reviews: [r],
    });
    expect(weakChapters(d).map((w) => w.chapterId).sort()).toEqual(['c1', 'c2']);
  });
  it('주간 통계는 월~일, 목표 달성률', () => {
    const d = data({ sessions: [session({ date: '2026-01-05', durationSeconds: 3600 }), session({ date: '2026-01-11', durationSeconds: 1800 }), session({ date: '2026-01-12', durationSeconds: 9999 })] });
    const w = weeklyStats(d, '2026-01-07');
    expect(w.from).toBe('2026-01-05');
    expect(w.minutes).toBe(90);
    expect(w.goalMinutes).toBe(120 * 7);
  });
});

import { flattenChapters, outlineToChapters, parseOutline } from './outline';
describe('목차 입력', () => {
  const text = `근로기준법
  근로계약 20
  임금 40
  근로시간 30
노동조합법
  노동조합 10
  단체교섭 15`;
  it('들여쓰기와 숫자를 해석한다', () => {
    const lines = parseOutline(text);
    expect(lines).toHaveLength(7);
    expect(lines[1]).toEqual({ depth: 1, title: '근로계약', targetAmount: 20 });
    expect(lines[0].depth).toBe(0);
  });
  it('부모-자식 관계와 leaf 합계', () => {
    let i = 0;
    const chapters = outlineToChapters(parseOutline(text), 's1', () => `c${i++}`);
    expect(chapters[1].parentId).toBe(chapters[0].id);
    expect(chapters[4].parentId).toBeNull();
    expect(subjectTarget(subject({ mode: 'chapters' }), chapters)).toBe(115);
    expect(flattenChapters(chapters, 's1').map((x) => x.depth)).toEqual([0, 1, 1, 1, 0, 1, 1]);
  });
});

import { pickPriority } from './plan';
describe('오늘 추천', () => {
  it('오늘 목표를 채운 과목은 추천하지 않고, 지연 과목을 우선한다', () => {
    const a = subject({ id: 'a' });
    const b = subject({ id: 'b', name: '민법' });
    const pa = summarizePlan({ subject: a, chapters: [], sessions: [session({ subjectId: 'a', date: '2026-01-10', amount: 13 })], today: '2026-01-10' });
    const pb = summarizePlan({ subject: b, chapters: [], sessions: [], today: '2026-01-10' });
    expect(pickPriority([{ subject: a, plan: pa }, { subject: b, plan: pb }])?.subject.id).toBe('b');
    expect(pickPriority([{ subject: a, plan: pa }])).toBeUndefined();
  });
});

import { chapterInRound, roundInfo } from './plan';
describe('회독', () => {
  const s = subject({ targetAmount: 100, targetRounds: 3 });
  it('전체 목표 = 1회독 × 회독 수, 현재 회독과 회독별 소요일', () => {
    const ss = [session({ date: '2026-01-01', amount: 60 }), session({ date: '2026-01-10', amount: 50 }), session({ date: '2026-01-14', amount: 100 })];
    expect(subjectTarget(s, [])).toBe(300);
    const r = roundInfo(s, [], ss);
    expect(r.round).toBe(3);
    expect(r.inRound).toBe(10);
    expect(r.history).toEqual([{ round: 1, days: 10 }, { round: 2, days: 5 }]);
  });
  it('회독 미지정 과목은 1회독', () => {
    expect(roundInfo(subject(), [], []).rounds).toBe(1);
    expect(subjectTarget(subject(), [])).toBe(500);
  });
  it('단원의 현재 회독 진도', () => {
    const ch: Chapter = { id: 'c', subjectId: 's1', parentId: null, title: 't', order: 0, targetAmount: 20 };
    const ss = [session({ chapterId: 'c', amount: 20 }), session({ chapterId: 'c', amount: 5 })];
    expect(chapterInRound(ch, 1, ss)).toBe(20);
    expect(chapterInRound(ch, 2, ss)).toBe(5);
  });
});

import { heatmap, paceSeries, records, streaks, weekRecap } from './stats';
describe('통계 (2단계)', () => {
  const mk = (dates: string[], sub = subject({ studyDays: WEEKDAYS })) =>
    ({ ...EMPTY_DATA, subjects: [sub], sessions: dates.map((date) => session({ date })) }) as AppData;
  // 2026-01-05 월 ~ 01-09 금, 01-10 토 01-11 일(쉬는 요일), 01-12 월
  it('쉬는 요일(주말)은 연속일을 끊지 않는다', () => {
    const d = mk(['2026-01-08', '2026-01-09', '2026-01-12']);
    expect(streaks(d, '2026-01-12')).toEqual({ current: 3, longest: 3 });
  });
  it('학습일에 기록이 없으면 끊긴다', () => {
    const d = mk(['2026-01-05', '2026-01-07']); // 화요일 공백
    expect(streaks(d, '2026-01-07').longest).toBe(1);
    expect(streaks(d, '2026-01-07').current).toBe(1);
  });
  it('오늘 기록이 없어도 어제까지의 연속은 살아있고, 하루 건너뛰면 0', () => {
    const d = mk(['2026-01-05', '2026-01-06']);
    expect(streaks(d, '2026-01-07').current).toBe(2);
    expect(streaks(d, '2026-01-08').current).toBe(0);
  });
  it('기록이 없으면 0', () => {
    expect(streaks(mk([]), '2026-01-07')).toEqual({ current: 0, longest: 0 });
  });
  it('잔디: 12주 x 7일, 월요일 시작, 농도', () => {
    const g = heatmap([session({ date: '2026-01-07', durationSeconds: 100 * 60 })], '2026-01-07', 12);
    expect(g).toHaveLength(12);
    expect(g[0]).toHaveLength(7);
    const last = g[11];
    expect(last[0].date).toBe('2026-01-05');
    expect(last[2].level).toBe(3);
    expect(last[4].future).toBe(true);
  });
  it('개인 기록', () => {
    const r = records([session({ date: '2026-01-05', durationSeconds: 3600 }), session({ date: '2026-01-06', durationSeconds: 7200 }), session({ date: '2026-01-06', durationSeconds: 1800 })]);
    expect(r).toMatchObject({ bestDayMinutes: 150, bestDayDate: '2026-01-06', totalMinutes: 210, activeDays: 2 });
  });
  it('계획선 vs 실제선: 종료일 계획 = 목표, 미래의 실제는 null', () => {
    const d = { ...EMPTY_DATA, subjects: [subject()], sessions: [session({ date: '2026-01-01', amount: 5 }), session({ date: '2026-01-03', amount: 20 })] } as AppData;
    const p = paceSeries(d, d.subjects[0], '2026-01-05')!;
    expect(p.points[0].date).toBe('2026-01-01');
    expect(p.points.at(-1)!.plan).toBeCloseTo(500);
    expect(p.points.find((x) => x.date === '2026-01-03')!.actual).toBe(25);
    expect(p.points.find((x) => x.date === '2026-01-10')!.actual).toBeNull();
    expect(p.gapToday).toBeCloseTo(50 - 25); // 5일 × 10페이지 - 25
  });
  it('주간 리캡', () => {
    const d = mk(['2026-01-05', '2026-01-06', '2025-12-31']);
    const r = weekRecap(d, '2026-01-07');
    expect(r.activeDays).toBe(2);
    expect(r.minutes).toBe(120);
    expect(r.prevMinutes).toBe(60);
    expect(r.topSubjectId).toBe('s1');
  });
});
