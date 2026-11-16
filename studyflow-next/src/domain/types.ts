/** 날짜는 모두 사용자 로컬 기준 'YYYY-MM-DD' 문자열로 다룬다. */
export type DateStr = string;

export interface Exam {
  id: string;
  name: string;
  examDate: DateStr;
  /** 하루 목표 학습시간(분) */
  dailyGoalMinutes: number;
}

/** amount: 분량 기반(페이지 등) / chapters: 목차 기반 */
export type SubjectMode = 'amount' | 'chapters';
export type SubjectStatus = 'active' | 'paused' | 'done';

export interface Subject {
  id: string;
  examId: string;
  name: string;
  mode: SubjectMode;
  /** 분량 기반: 직접 입력한 목표량. 목차 기반: 단원 목표량의 합으로 계산(저장값은 무시). */
  targetAmount: number;
  unit: string;
  startDate: DateStr;
  endDate: DateStr;
  /** 학습 가능 요일. 0=일 … 6=토 */
  studyDays: number[];
  status: SubjectStatus;
}

export interface Chapter {
  id: string;
  subjectId: string;
  parentId: string | null;
  title: string;
  order: number;
  targetAmount: number;
}

/** 이해도 3단계. 자기보고이며 객관적 점수가 아니다. */
export type Understanding = 'explain' | 'recognize' | 'unsure';

export interface StudySession {
  id: string;
  subjectId: string;
  chapterId: string | null;
  date: DateStr;
  /** epoch ms */
  startTime: number;
  endTime: number;
  durationSeconds: number;
  amount: number;
  predictedUnderstanding: Understanding | null;
  actualUnderstanding: Understanding | null;
  recallText: string;
  /** 1~5, 선택 */
  focusScore: number | null;
  memo: string;
}

export type ReviewResult = 'remembered' | 'hazy' | 'forgot';

export interface ReviewOutcome {
  date: DateStr;
  result: ReviewResult;
}

export interface Review {
  id: string;
  subjectId: string;
  chapterId: string | null;
  /** REVIEW_INTERVALS 의 인덱스. nextReviewDate 를 정할 때 쓴 간격 */
  reviewStep: number;
  nextReviewDate: DateStr;
  lastReviewDate: DateStr | null;
  outcomes: ReviewOutcome[];
}

/** 진행 중인 타이머. 새로고침 후에도 startedAt 으로 복구한다. */
export interface ActiveTimer {
  subjectId: string;
  chapterId: string | null;
  startedAt: number;
  predictedUnderstanding: Understanding | null;
}

export interface AppData {
  schemaVersion: 1;
  exam: Exam | null;
  subjects: Subject[];
  chapters: Chapter[];
  sessions: StudySession[];
  reviews: Review[];
  activeTimer: ActiveTimer | null;
}

export const EMPTY_DATA: AppData = {
  schemaVersion: 1,
  exam: null,
  subjects: [],
  chapters: [],
  sessions: [],
  reviews: [],
  activeTimer: null,
};
