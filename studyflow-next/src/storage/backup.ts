import { toDateStr } from '../domain/dates';
import type { AppData, StudySession, Subject } from '../domain/types';
import { sanitize } from './sanitize';

export const BACKUP_APP_ID = 'studyflow-next';

export function exportBackup(data: AppData, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP_ID, exportedAt: now.toISOString(), data }, null, 2);
}

export type ImportResult = { ok: true; data: AppData; source: 'next' | 'legacy'; note?: string } | { ok: false; error: string };

export function importBackup(text: string, today = toDateStr(new Date())): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: '올바른 JSON 파일이 아닙니다.' };
  }
  if (typeof json !== 'object' || json === null) return { ok: false, error: '백업 형식이 아닙니다.' };
  const obj = json as Record<string, unknown>;

  if (obj.app === BACKUP_APP_ID) {
    const data = sanitize(obj.data);
    return data ? { ok: true, data, source: 'next' } : { ok: false, error: '백업 데이터 구조가 올바르지 않습니다.' };
  }
  const direct = sanitize(obj);
  if (direct) return { ok: true, data: direct, source: 'next' };

  const legacy = convertLegacy(obj, today);
  if (legacy) return { ok: true, data: legacy, source: 'legacy', note: '기존 Studyflow 백업을 변환했습니다. 과목의 종료일/요일은 추정값이니 계획 화면에서 확인하세요.' };
  return { ok: false, error: '인식할 수 없는 백업 형식입니다.' };
}

const uid = (p: string, i: number) => `${p}-${i}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 기존 Studyflow 백업 변환 (best-effort).
 * 근거: 저장소 `study flow/types.ts` 의 Task / Session 구조.
 * 로컬 V2.6.x(todait_v3)의 실제 백업 구조는 확인하지 못했으므로, 해당 형태는 변환되지 않을 수 있다.
 */
export function convertLegacy(obj: Record<string, unknown>, today: string): AppData | null {
  const tasks = obj.tasks;
  const sessions = obj.sessions;
  if (!Array.isArray(tasks) || !Array.isArray(sessions)) return null;
  const settings = (typeof obj.settings === 'object' && obj.settings ? obj.settings : {}) as Record<string, unknown>;
  const examDate = typeof settings.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(settings.examDate) ? settings.examDate : null;
  const exam = examDate
    ? { id: 'exam-legacy', name: typeof settings.examName === 'string' && settings.examName ? settings.examName : '가져온 시험', examDate, dailyGoalMinutes: typeof settings.dailyGoalMinutes === 'number' ? settings.dailyGoalMinutes : 120 }
    : null;

  const idMap = new Map<string, string>();
  const subjects: Subject[] = [];
  tasks.forEach((t, i) => {
    if (typeof t !== 'object' || t === null) return;
    const r = t as Record<string, unknown>;
    const id = uid('sub', i);
    idMap.set(String(r.id), id);
    subjects.push({
      id,
      examId: exam?.id ?? '',
      name: String(r.name ?? `과목 ${i + 1}`),
      mode: 'amount',
      targetAmount: typeof r.totalAmount === 'number' ? r.totalAmount : 0,
      unit: typeof r.unit === 'string' && r.unit ? r.unit : '페이지',
      startDate: typeof r.startDate === 'string' ? r.startDate : today,
      endDate: typeof r.targetDate === 'string' ? r.targetDate : examDate ?? today,
      studyDays: [0, 1, 2, 3, 4, 5, 6],
      status: r.status === 'completed' ? 'done' : 'active',
    });
  });

  const out: StudySession[] = [];
  sessions.forEach((s, i) => {
    if (typeof s !== 'object' || s === null) return;
    const r = s as Record<string, unknown>;
    const subjectId = idMap.get(String(r.taskId));
    if (!subjectId || typeof r.timestamp !== 'number') return;
    const dur = typeof r.duration === 'number' ? r.duration : 0;
    out.push({
      id: uid('ses', i),
      subjectId,
      chapterId: null,
      date: toDateStr(new Date(r.timestamp)),
      startTime: r.timestamp - dur * 1000,
      endTime: r.timestamp,
      durationSeconds: dur,
      amount: typeof r.amount === 'number' ? r.amount : 0,
      predictedUnderstanding: null,
      actualUnderstanding: null,
      recallText: typeof r.keyword === 'string' ? r.keyword : '',
      focusScore: null,
      memo: '',
    });
  });
  return { schemaVersion: 1, exam, subjects, chapters: [], sessions: out, reviews: [], activeTimer: null };
}
