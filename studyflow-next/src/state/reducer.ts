import { applyReviewResult, createReview, findReview } from '../domain/review';
import type { ActiveTimer, AppData, Chapter, Exam, ReviewResult, StudySession, Subject } from '../domain/types';

export type Action =
  | { type: 'SET_EXAM'; exam: Exam }
  | { type: 'UPSERT_SUBJECT'; subject: Subject }
  | { type: 'DELETE_SUBJECT'; id: string }
  | { type: 'UPSERT_CHAPTER'; chapter: Chapter }
  | { type: 'DELETE_CHAPTER'; id: string }
  | { type: 'START_TIMER'; timer: ActiveTimer }
  | { type: 'DISCARD_TIMER' }
  | { type: 'SAVE_SESSION'; session: StudySession; reviewId: string }
  | { type: 'UPDATE_SESSION'; session: StudySession }
  | { type: 'DELETE_SESSION'; id: string }
  | { type: 'REVIEW_RESULT'; reviewId: string; result: ReviewResult; today: string }
  | { type: 'REPLACE_ALL'; data: AppData };

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

/** 단원과 모든 하위 단원 id */
function descendants(chapters: Chapter[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of chapters) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** 해당 과목·단원에 남은 학습 기록이 없고 복습 이력도 없으면 복습 일정을 정리한다 */
function pruneReview(data: AppData, subjectId: string, chapterId: string | null): AppData {
  const stillStudied = data.sessions.some((s) => s.subjectId === subjectId && s.chapterId === chapterId);
  if (stillStudied) return data;
  return {
    ...data,
    reviews: data.reviews.filter((r) => !(r.subjectId === subjectId && r.chapterId === chapterId && r.outcomes.length === 0)),
  };
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'SET_EXAM':
      return { ...state, exam: action.exam };

    case 'UPSERT_SUBJECT':
      return { ...state, subjects: upsert(state.subjects, action.subject) };

    case 'DELETE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.id),
        chapters: state.chapters.filter((c) => c.subjectId !== action.id),
        sessions: state.sessions.filter((s) => s.subjectId !== action.id),
        reviews: state.reviews.filter((r) => r.subjectId !== action.id),
        activeTimer: state.activeTimer?.subjectId === action.id ? null : state.activeTimer,
      };

    case 'UPSERT_CHAPTER':
      return { ...state, chapters: upsert(state.chapters, action.chapter) };

    case 'DELETE_CHAPTER': {
      const ids = descendants(state.chapters, action.id);
      const mine = (id: string | null) => id !== null && ids.has(id);
      return {
        ...state,
        chapters: state.chapters.filter((c) => !ids.has(c.id)),
        // 학습 기록은 보존하고 단원 연결만 해제한다 (공부한 사실을 지우지 않는다)
        sessions: state.sessions.map((s) => (mine(s.chapterId) ? { ...s, chapterId: null } : s)),
        reviews: state.reviews.filter((r) => !mine(r.chapterId)),
        activeTimer: mine(state.activeTimer?.chapterId ?? null) && state.activeTimer ? { ...state.activeTimer, chapterId: null } : state.activeTimer,
      };
    }

    case 'START_TIMER':
      return { ...state, activeTimer: action.timer };

    case 'DISCARD_TIMER':
      return { ...state, activeTimer: null };

    case 'SAVE_SESSION': {
      const { session } = action;
      const sessions = [...state.sessions, session];
      const hasReview = findReview(state.reviews, session.subjectId, session.chapterId);
      const reviews = hasReview ? state.reviews : [...state.reviews, createReview(action.reviewId, session.subjectId, session.chapterId, session.date)];
      return { ...state, sessions, reviews, activeTimer: null };
    }

    case 'UPDATE_SESSION': {
      const prev = state.sessions.find((s) => s.id === action.session.id);
      if (!prev) return state;
      let next: AppData = { ...state, sessions: state.sessions.map((s) => (s.id === action.session.id ? action.session : s)) };
      if (prev.subjectId !== action.session.subjectId || prev.chapterId !== action.session.chapterId) {
        next = pruneReview(next, prev.subjectId, prev.chapterId);
      }
      return next;
    }

    case 'DELETE_SESSION': {
      const target = state.sessions.find((s) => s.id === action.id);
      if (!target) return state;
      const next = { ...state, sessions: state.sessions.filter((s) => s.id !== action.id) };
      return pruneReview(next, target.subjectId, target.chapterId);
    }

    case 'REVIEW_RESULT':
      return {
        ...state,
        reviews: state.reviews.map((r) => (r.id === action.reviewId ? applyReviewResult(r, action.result, action.today) : r)),
      };

    case 'REPLACE_ALL':
      return action.data;
  }
}
