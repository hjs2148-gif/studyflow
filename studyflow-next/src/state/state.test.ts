import { describe, expect, it } from 'vitest';
import { EMPTY_DATA, type AppData, type StudySession } from '../domain/types';
import { createLocalRepository, STORAGE_KEY } from '../storage/repository';
import { exportBackup, importBackup } from '../storage/backup';
import { reducer } from './reducer';

const mem = (init: Record<string, string> = {}) => {
  const m = { ...init };
  return { m, getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } };
};

const base: AppData = {
  ...EMPTY_DATA,
  exam: { id: 'e', name: '공인노무사', examDate: '2026-10-31', dailyGoalMinutes: 180 },
  subjects: [{ id: 's', examId: 'e', name: '노동법', mode: 'chapters', targetAmount: 0, unit: '페이지', startDate: '2026-01-01', endDate: '2026-06-30', studyDays: [1, 2, 3, 4, 5], status: 'active' }],
  chapters: [
    { id: 'p', subjectId: 's', parentId: null, title: '근로기준법', order: 0, targetAmount: 0 },
    { id: 'c', subjectId: 's', parentId: 'p', title: '임금', order: 0, targetAmount: 40 },
  ],
};
const ses = (o: Partial<StudySession> = {}): StudySession => ({
  id: 'x1', subjectId: 's', chapterId: 'c', date: '2026-01-05', startTime: 0, endTime: 1, durationSeconds: 1800, amount: 10,
  predictedUnderstanding: 'explain', actualUnderstanding: 'unsure', recallText: '', focusScore: null, memo: '', ...o,
});

describe('reducer', () => {
  it('세션 저장 시 복습이 생성되고 타이머가 해제된다', () => {
    const s0 = reducer(base, { type: 'START_TIMER', timer: { subjectId: 's', chapterId: 'c', startedAt: 1, predictedUnderstanding: null } });
    const s1 = reducer(s0, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    expect(s1.activeTimer).toBeNull();
    expect(s1.reviews).toHaveLength(1);
    expect(s1.reviews[0].nextReviewDate).toBe('2026-01-06');
  });
  it('같은 단원을 또 공부해도 복습은 중복 생성되지 않는다', () => {
    let s = reducer(base, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    s = reducer(s, { type: 'SAVE_SESSION', session: ses({ id: 'x2' }), reviewId: 'r2' });
    expect(s.reviews).toHaveLength(1);
  });
  it('세션 삭제 시 마지막 기록이면 복습 일정도 정리', () => {
    let s = reducer(base, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    s = reducer(s, { type: 'DELETE_SESSION', id: 'x1' });
    expect(s.sessions).toHaveLength(0);
    expect(s.reviews).toHaveLength(0);
  });
  it('복습 이력이 있으면 세션 삭제해도 복습은 남긴다', () => {
    let s = reducer(base, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    s = reducer(s, { type: 'REVIEW_RESULT', reviewId: 'r1', result: 'remembered', today: '2026-01-06' });
    s = reducer(s, { type: 'DELETE_SESSION', id: 'x1' });
    expect(s.reviews).toHaveLength(1);
  });
  it('단원 삭제: 하위 단원·복습 삭제, 학습 기록은 보존(단원 연결만 해제)', () => {
    let s = reducer(base, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    s = reducer(s, { type: 'DELETE_CHAPTER', id: 'p' });
    expect(s.chapters).toHaveLength(0);
    expect(s.reviews).toHaveLength(0);
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].chapterId).toBeNull();
  });
  it('과목 삭제는 다른 과목 데이터에 영향이 없다', () => {
    const two: AppData = { ...base, subjects: [...base.subjects, { ...base.subjects[0], id: 's2', name: '민법' }], sessions: [ses(), ses({ id: 'y', subjectId: 's2', chapterId: null })] };
    const s = reducer(two, { type: 'DELETE_SUBJECT', id: 's' });
    expect(s.subjects.map((x) => x.id)).toEqual(['s2']);
    expect(s.sessions.map((x) => x.id)).toEqual(['y']);
  });
});

describe('저장소', () => {
  it('저장 → 재로드(새로고침) 시 동일', () => {
    const st = mem();
    const repo = createLocalRepository(st);
    expect(repo.save(base)).toEqual({ ok: true });
    expect(createLocalRepository(st).load().data).toEqual(base);
  });
  it('기존 todait_v3 키는 건드리지 않는다', () => {
    const st = mem({ todait_v3: 'legacy-data' });
    createLocalRepository(st).save(base);
    expect(st.m.todait_v3).toBe('legacy-data');
    expect(Object.keys(st.m)).toContain(STORAGE_KEY);
  });
  it('손상된 데이터는 덮어쓰지 않고 격리한다', () => {
    const st = mem({ [STORAGE_KEY]: '{broken' });
    const r = createLocalRepository(st).load();
    expect(r.warning).toBeTruthy();
    expect(st.m[STORAGE_KEY]).toBe('{broken');
    expect(Object.entries(st.m).some(([k, v]) => k.includes('corrupt') && v === '{broken')).toBe(true);
  });
  it('용량 초과 시 오류를 반환한다', () => {
    const repo = createLocalRepository({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
    expect(repo.save(base).ok).toBe(false);
  });
});

describe('백업', () => {
  it('내보내기 → 가져오기 왕복에서 데이터 손실 없음', () => {
    const data = reducer(base, { type: 'SAVE_SESSION', session: ses(), reviewId: 'r1' });
    const r = importBackup(exportBackup(data));
    expect(r.ok && r.data).toEqual(data);
  });
  it('잘못된 파일 거부', () => {
    expect(importBackup('nope').ok).toBe(false);
    expect(importBackup('{"a":1}').ok).toBe(false);
  });
  it('기존 Studyflow(Task/Session) 형식 변환', () => {
    const legacy = {
      tasks: [{ id: 't1', name: '행정법', totalAmount: 300, currentAmount: 30, unit: '쪽', status: 'active', targetDate: '2026-05-01' }],
      sessions: [{ id: 'q', taskId: 't1', duration: 1800, amount: 12, mode: 'stopwatch', timestamp: new Date(2026, 0, 5, 10).getTime(), keyword: '처분' }],
      settings: { examName: '노무사', examDate: '2026-10-31', dailyGoalMinutes: 150 },
    };
    const r = importBackup(JSON.stringify(legacy), '2026-01-01');
    expect(r.ok && r.source).toBe('legacy');
    if (r.ok) {
      expect(r.data.subjects[0].targetAmount).toBe(300);
      expect(r.data.sessions[0].subjectId).toBe(r.data.subjects[0].id);
      expect(r.data.sessions[0].date).toBe('2026-01-05');
      expect(r.data.sessions[0].amount).toBe(12);
    }
  });
});
