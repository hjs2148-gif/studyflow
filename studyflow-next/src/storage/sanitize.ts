import { isValidDateStr } from '../domain/dates';
import type { AppData, ReviewResult, SubjectStatus, Understanding } from '../domain/types';

const U: Understanding[] = ['explain', 'recognize', 'unsure'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const und = (v: unknown): Understanding | null => (U.includes(v as Understanding) ? (v as Understanding) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * 알 수 없는 JSON 을 AppData 로 검증·정규화한다. 구조가 아예 다르면 null.
 * 잘못된 항목은 조용히 고쳐 쓰지 않고 버린다(날짜 등 핵심값이 깨진 레코드).
 */
export function sanitize(raw: unknown): AppData | null {
  if (!isObj(raw) || raw.schemaVersion !== 1) return null;
  const examRaw = raw.exam;
  const exam =
    isObj(examRaw) && isValidDateStr(examRaw.examDate)
      ? { id: str(examRaw.id), name: str(examRaw.name), examDate: examRaw.examDate, dailyGoalMinutes: num(examRaw.dailyGoalMinutes, 120) }
      : null;

  const subjects = arr(raw.subjects).flatMap((s) => {
    if (!isObj(s) || !isValidDateStr(s.startDate) || !isValidDateStr(s.endDate) || !str(s.id)) return [];
    return [
      {
        id: str(s.id),
        examId: str(s.examId),
        name: str(s.name),
        mode: s.mode === 'chapters' ? ('chapters' as const) : ('amount' as const),
        targetAmount: num(s.targetAmount),
        unit: str(s.unit, '페이지'),
        startDate: s.startDate,
        endDate: s.endDate,
        studyDays: arr(s.studyDays).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6),
        ...(typeof s.targetRounds === 'number' ? { targetRounds: Math.max(1, Math.round(num(s.targetRounds, 1))) } : {}),
        status: (s.status === 'paused' || s.status === 'done' ? s.status : 'active') as SubjectStatus,
      },
    ];
  });
  const subjectIds = new Set(subjects.map((s) => s.id));

  const chapters = arr(raw.chapters).flatMap((c) =>
    isObj(c) && str(c.id) && subjectIds.has(str(c.subjectId))
      ? [{ id: str(c.id), subjectId: str(c.subjectId), parentId: typeof c.parentId === 'string' ? c.parentId : null, title: str(c.title), order: num(c.order), targetAmount: num(c.targetAmount) }]
      : [],
  );

  const sessions = arr(raw.sessions).flatMap((s) =>
    isObj(s) && str(s.id) && subjectIds.has(str(s.subjectId)) && isValidDateStr(s.date)
      ? [
          {
            id: str(s.id),
            subjectId: str(s.subjectId),
            chapterId: typeof s.chapterId === 'string' ? s.chapterId : null,
            date: s.date,
            startTime: num(s.startTime),
            endTime: num(s.endTime),
            durationSeconds: Math.max(0, num(s.durationSeconds)),
            amount: Math.max(0, num(s.amount)),
            predictedUnderstanding: und(s.predictedUnderstanding),
            actualUnderstanding: und(s.actualUnderstanding),
            recallText: str(s.recallText),
            focusScore: typeof s.focusScore === 'number' ? s.focusScore : null,
            memo: str(s.memo),
          },
        ]
      : [],
  );

  const reviews = arr(raw.reviews).flatMap((r) =>
    isObj(r) && str(r.id) && subjectIds.has(str(r.subjectId)) && isValidDateStr(r.nextReviewDate)
      ? [
          {
            id: str(r.id),
            subjectId: str(r.subjectId),
            chapterId: typeof r.chapterId === 'string' ? r.chapterId : null,
            reviewStep: Math.min(4, Math.max(0, num(r.reviewStep))),
            nextReviewDate: r.nextReviewDate,
            lastReviewDate: isValidDateStr(r.lastReviewDate) ? r.lastReviewDate : null,
            outcomes: arr(r.outcomes).flatMap((o) =>
              isObj(o) && isValidDateStr(o.date) && (o.result === 'remembered' || o.result === 'hazy' || o.result === 'forgot')
                ? [{ date: o.date, result: o.result as ReviewResult }]
                : [],
            ),
          },
        ]
      : [],
  );

  const t = raw.activeTimer;
  const activeTimer =
    isObj(t) && subjectIds.has(str(t.subjectId)) && typeof t.startedAt === 'number'
      ? { subjectId: str(t.subjectId), chapterId: typeof t.chapterId === 'string' ? t.chapterId : null, startedAt: t.startedAt, predictedUnderstanding: und(t.predictedUnderstanding) }
      : null;

  return { schemaVersion: 1, exam, subjects, chapters, sessions, reviews, activeTimer };
}
