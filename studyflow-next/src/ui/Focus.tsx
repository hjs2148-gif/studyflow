import { useEffect, useMemo, useState } from 'react';
import { toDateStr } from '../domain/dates';
import { n, planFor, UNDERSTANDING_LABEL } from '../domain/insights';
import { flattenChapters, isLeaf } from '../domain/outline';
import type { Understanding } from '../domain/types';
import { newId, useStore } from '../state/store';
import type { FocusIntent, Nav } from './App';
import { Button, Choice, Empty, Field, fmtClock } from './primitives';

const UOPTS = (Object.keys(UNDERSTANDING_LABEL) as Understanding[]).map((value) => ({ value, label: UNDERSTANDING_LABEL[value] }));
/** 이 시간 이상 지난 타이머는 복구 시 직접 확인을 받는다 */
const STALE_TIMER_MS = 12 * 3600 * 1000;

export function Focus({ intent, nav }: { intent: FocusIntent | null; nav: Nav }) {
  const { data } = useStore();
  const [finishing, setFinishing] = useState<{ endedAt: number } | { manual: true } | null>(null);

  if (data.subjects.filter((s) => s.status === 'active').length === 0) {
    return (
      <section>
        <h1 className="h-title">공부</h1>
        <Empty title="공부할 과목이 없어요" body="계획 화면에서 과목을 먼저 추가해 주세요." action={<Button variant="primary" onClick={() => nav.go('plan')}>과목 추가</Button>} />
      </section>
    );
  }

  if (finishing) {
    return <FinishForm ending={finishing} onDone={() => { setFinishing(null); nav.go('today'); }} onBack={() => setFinishing(null)} />;
  }
  if (data.activeTimer) return <Running onStop={() => setFinishing({ endedAt: Date.now() })} />;
  return <Setup intent={intent} onManual={() => setFinishing({ manual: true })} />;
}

function Setup({ intent, onManual }: { intent: FocusIntent | null; onManual: () => void }) {
  const { data, today, dispatch } = useStore();
  const subjects = data.subjects.filter((s) => s.status === 'active');
  const [subjectId, setSubjectId] = useState(intent?.subjectId && subjects.some((s) => s.id === intent.subjectId) ? intent.subjectId : subjects[0].id);
  const [chapterId, setChapterId] = useState<string | null>(intent?.chapterId ?? null);
  const [predicted, setPredicted] = useState<Understanding | null>(null);

  const subject = subjects.find((s) => s.id === subjectId)!;
  const chapters = useMemo(() => flattenChapters(data.chapters, subjectId).filter((x) => isLeaf(data.chapters, x.chapter.id)), [data.chapters, subjectId]);
  const plan = planFor(data, subject, today);
  const left = Math.max(0, Math.ceil(plan.todayTarget - plan.todayDone));

  return (
    <section className="stack">
      <h1 className="h-title">공부 시작</h1>
      <Field label="과목">
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(null); }}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      {subject.mode === 'chapters' && (
        <Field label="단원" hint={chapters.length === 0 ? '계획 화면에서 이 과목의 목차를 추가하면 단원별로 기록됩니다.' : undefined}>
          <select value={chapterId ?? ''} onChange={(e) => setChapterId(e.target.value || null)}>
            <option value="">단원 선택 안 함</option>
            {chapters.map(({ chapter }) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
          </select>
        </Field>
      )}
      {plan.isStudyDayToday && plan.todayTarget > 0 && (
        <p className="muted">오늘 목표 {n(Math.ceil(plan.todayTarget))}{subject.unit} 중 {n(left)}{subject.unit} 남음</p>
      )}
      <div className="field">
        <span className="field-label">공부 전, 이 내용을 얼마나 알고 있다고 느끼나요? <em>(선택)</em></span>
        <Choice label="공부 전 이해도 예측" value={predicted} onChange={(v) => setPredicted(predicted === v ? null : v)} options={UOPTS} />
      </div>
      <Button
        variant="primary"
        block
        onClick={() => dispatch({ type: 'START_TIMER', timer: { subjectId, chapterId, startedAt: Date.now(), predictedUnderstanding: predicted } })}
      >
        타이머 시작
      </Button>
      <button className="link" onClick={onManual}>타이머 없이 기록만 남기기</button>
    </section>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [active]);
  return now;
}

function Running({ onStop }: { onStop: () => void }) {
  const { data, dispatch } = useStore();
  const t = data.activeTimer!;
  const now = useNow(true);
  const subject = data.subjects.find((s) => s.id === t.subjectId);
  const chapter = data.chapters.find((c) => c.id === t.chapterId);
  const elapsedMs = now - t.startedAt;
  const stale = elapsedMs > STALE_TIMER_MS;

  return (
    <section className="stack running">
      <p className="eyebrow">{subject?.name}{chapter ? ` · ${chapter.title}` : ''}</p>
      <div className="clock" role="timer" aria-live="off">{fmtClock(elapsedMs / 1000)}</div>
      {stale ? (
        <div className="callout callout-warn">
          <strong>타이머가 12시간 넘게 켜져 있었어요</strong>
          <p>앱을 닫은 채로 두었다면 실제 공부시간과 다를 수 있어요. 종료 후 기록 화면에서 시간을 직접 고칠 수 있습니다.</p>
        </div>
      ) : (
        <p className="muted">화면을 닫아도 시간은 계속 흐릅니다. 다시 열면 이어서 볼 수 있어요.</p>
      )}
      <Button variant="primary" block onClick={onStop}>공부 종료</Button>
      <button className="link link-danger" onClick={() => window.confirm('이 타이머를 기록 없이 버릴까요?') && dispatch({ type: 'DISCARD_TIMER' })}>
        기록 없이 취소
      </button>
    </section>
  );
}

function FinishForm({ ending, onDone, onBack }: { ending: { endedAt: number } | { manual: true }; onDone: () => void; onBack: () => void }) {
  const { data, today, dispatch } = useStore();
  const timer = data.activeTimer;
  const manual = 'manual' in ending;
  const subjects = data.subjects.filter((s) => s.status === 'active');

  const [subjectId, setSubjectId] = useState(timer?.subjectId ?? subjects[0].id);
  const [chapterId, setChapterId] = useState<string | null>(timer?.chapterId ?? null);
  const startedAt = timer?.startedAt ?? Date.now();
  const endedAt = 'endedAt' in ending ? ending.endedAt : Date.now();
  const initialMin = manual ? '' : String(Math.max(1, Math.round((endedAt - startedAt) / 60000)));
  const [minutes, setMinutes] = useState(initialMin);
  const [amount, setAmount] = useState('');
  const [recall, setRecall] = useState('');
  const [actual, setActual] = useState<Understanding | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [memo, setMemo] = useState('');

  const subject = data.subjects.find((s) => s.id === subjectId)!;
  const chapterOptions = flattenChapters(data.chapters, subjectId).filter((x) => isLeaf(data.chapters, x.chapter.id));
  const predicted = timer?.predictedUnderstanding ?? null;
  const gap = predicted && actual ? (predicted === 'explain' && actual !== 'explain') || (predicted === 'recognize' && actual === 'unsure') : false;
  const minutesNum = Number(minutes);
  const valid = minutes !== '' && minutesNum > 0 && (amount === '' || Number(amount) >= 0);

  const save = () => {
    const durationSeconds = Math.round(minutesNum * 60);
    const end = manual ? Date.now() : endedAt;
    dispatch({
      type: 'SAVE_SESSION',
      reviewId: newId('rev'),
      session: {
        id: newId('ses'),
        subjectId,
        chapterId,
        date: manual ? today : toDateStr(new Date(startedAt)),
        startTime: end - durationSeconds * 1000,
        endTime: end,
        durationSeconds,
        amount: amount === '' ? 0 : Number(amount),
        predictedUnderstanding: predicted,
        actualUnderstanding: actual,
        recallText: recall.trim(),
        focusScore: focus,
        memo: memo.trim(),
      },
    });
    onDone();
  };

  return (
    <section className="stack">
      <h1 className="h-title">기록하기</h1>
      {manual && (
        <>
          <Field label="과목">
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(null); }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {subject.mode === 'chapters' && chapterOptions.length > 0 && (
            <Field label="단원">
              <select value={chapterId ?? ''} onChange={(e) => setChapterId(e.target.value || null)}>
                <option value="">단원 선택 안 함</option>
                {chapterOptions.map(({ chapter }) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
              </select>
            </Field>
          )}
        </>
      )}
      {!manual && <p className="eyebrow">{subject.name}{chapterId ? ` · ${data.chapters.find((c) => c.id === chapterId)?.title ?? ''}` : ''}</p>}

      <div className="two">
        <Field label="공부 시간 (분)">
          <input inputMode="numeric" type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label={`공부한 분량 (${subject.unit})`}>
          <input inputMode="decimal" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className="block">
        <h3 className="h-sub">자료를 덮고 떠올려 보기 <em>(선택)</em></h3>
        <textarea rows={4} value={recall} onChange={(e) => setRecall(e.target.value)} placeholder="핵심 내용을 내 말로 적어 보세요. 복습 때 다시 보여드려요." />
        <div className="field">
          <span className="field-label">지금 이 내용을 실제로 얼마나 아나요?</span>
          <Choice label="공부 후 이해도" value={actual} onChange={(v) => setActual(actual === v ? null : v)} options={UOPTS} />
        </div>
        {gap && predicted && (
          <p className="callout callout-warn">
            공부 전에는 “{UNDERSTANDING_LABEL[predicted]}”로 예상했지만 지금은 “{UNDERSTANDING_LABEL[actual!]}”예요. 과대평가 기록으로 남겨 두고 복습 때 더 신경 쓸게요.
          </p>
        )}
      </div>

      <div className="field">
        <span className="field-label">집중도 <em>(선택)</em></span>
        <Choice label="집중도" value={focus === null ? null : String(focus)} onChange={(v) => setFocus(focus === Number(v) ? null : Number(v))} options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: String(v) }))} />
      </div>
      <Field label="메모 (선택)">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>

      <Button variant="primary" block disabled={!valid} onClick={save}>저장하고 진도에 반영</Button>
      {!valid && <p className="muted">공부 시간을 입력하면 저장할 수 있어요. 나머지는 비워도 됩니다.</p>}
      <button className="link" onClick={onBack}>돌아가기</button>
    </section>
  );
}
