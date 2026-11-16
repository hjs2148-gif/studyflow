import { addDays } from './dates';
import type { DateStr, Review, ReviewResult, StudySession } from './types';

/** 초기 운영 규칙. 최적의 기억 유지 간격이라고 단정하지 않는다. */
export const REVIEW_INTERVALS = [1, 3, 7, 15, 30] as const;

export function reviewKey(subjectId: string, chapterId: string | null) {
  return `${subjectId}::${chapterId ?? ''}`;
}

export function findReview(reviews: Review[], subjectId: string, chapterId: string | null) {
  return reviews.find((r) => r.subjectId === subjectId && r.chapterId === chapterId);
}

/** 학습 후 최초 복습 일정 생성 (이미 있으면 그대로 둔다) */
export function createReview(id: string, subjectId: string, chapterId: string | null, studyDate: DateStr): Review {
  return {
    id,
    subjectId,
    chapterId,
    reviewStep: 0,
    nextReviewDate: addDays(studyDate, REVIEW_INTERVALS[0]),
    lastReviewDate: null,
    outcomes: [],
  };
}

/**
 * 복습 결과 반영.
 * 기억남: 간격 한 단계 증가 / 가물가물: 현재 간격 유지 / 잊어버림: 1일로 초기화
 */
export function applyReviewResult(review: Review, result: ReviewResult, today: DateStr): Review {
  const last = REVIEW_INTERVALS.length - 1;
  let step = review.reviewStep;
  if (result === 'remembered') step = Math.min(step + 1, last);
  else if (result === 'forgot') step = 0;
  return {
    ...review,
    reviewStep: step,
    nextReviewDate: addDays(today, REVIEW_INTERVALS[step]),
    lastReviewDate: today,
    outcomes: [...review.outcomes, { date: today, result }],
  };
}

export function dueReviews(reviews: Review[], today: DateStr): Review[] {
  return reviews.filter((r) => r.nextReviewDate <= today).sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
}

/** 복습 자기점검에 보여줄 가장 최근 인출 메모 */
export function latestRecall(sessions: StudySession[], subjectId: string, chapterId: string | null): string {
  const hit = sessions
    .filter((s) => s.subjectId === subjectId && s.chapterId === chapterId && s.recallText.trim())
    .sort((a, b) => b.endTime - a.endTime)[0];
  return hit?.recallText ?? '';
}
