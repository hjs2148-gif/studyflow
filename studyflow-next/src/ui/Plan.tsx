import { useRef, useState } from 'react';
import { addDays, diffDays, WEEKDAY_LABELS } from '../domain/dates';
import { n, planFor } from '../domain/insights';
import { flattenChapters, outlineToChapters, parseOutline } from '../domain/outline';
import { chapterCompleted, type PlanState, type PlanSummary } from '../domain/plan';
import type { Exam, Subject } from '../domain/types';
import { exportBackup, importBackup } from '../storage/backup';
import { newId, useStore } from '../state/store';
import type { Nav } from './App';
import { applyOption } from './reschedule';
import { Button, Choice, Empty, Field, ProgressBar, Sheet } from './primitives';

const STATE_LABEL: Record<PlanState, { text: string; tone: 'accent' | 'warn' | 'bad' }> = {
  done: { text: '완료', tone: 'accent' },
  on_track: { text: '순조로움', tone: 'accent' },
  behind: { text: '조금 지연', tone: 'warn' },
  overloaded: { text: '재조정 필요', tone: 'bad' },
  overdue: { text: '기간 초과', tone: 'bad' },
  not_started: { text: '시작 전', tone: 'accent' },
};

export function Plan({ nav }: { nav: Nav }) {
  const { data, today } = useStore();
  const [examOpen, setExamOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  if (!data.exam) return <ExamForm first onDone={() => {}} />;

  const detailSubject = data.subjects.find((s) => s.id === detail);
  if (detailSubject) return <SubjectDetail subject={detailSubject} onBack={() => setDetail(null)} onEdit={() => setEditing(detailSubject)} editing={editing} setEditing={setEditing} nav={nav} />;

  const left = diffDays(today, data.exam.examDate);
  return (
    <section className="stack">
      <h1 className="h-title">계획</h1>
      <div className="row">
        <div className="row-main">
          <strong>{data.exam.name}</strong>
          <span className="muted">{data.exam.examDate} · {left >= 0 ? `D-${left}` : `D+${-left}`} · 하루 {data.exam.dailyGoalMinutes}분</span>
        </div>
        <Button variant="ghost" onClick={() => setExamOpen(true)}>수정</Button>
      </div>

      <div className="block">
        <div className="block-head">
          <h3 className="h-sub">과목</h3>
          <Button onClick={() => setEditing('new')}>+ 과목 추가</Button>
        </div>
        {data.subjects.length === 0 ? (
          <Empty title="아직 과목이 없어요" body="예: 노동법 500페이지를 시험 전까지. 분량이나 목차로 등록할 수 있습니다." />
        ) : (
          <ul className="list">
            {data.subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} onOpen={() => setDetail(s.id)} />
            ))}
          </ul>
        )}
      </div>

      <DataSection />

      {examOpen && <Sheet title="시험 정보" onClose={() => setExamOpen(false)}><ExamForm onDone={() => setExamOpen(false)} /></Sheet>}
      {editing && !detailSubject && <Sheet title={editing === 'new' ? '과목 추가' : '과목 수정'} onClose={() => setEditing(null)}><SubjectForm subject={editing === 'new' ? null : editing} onDone={() => setEditing(null)} /></Sheet>}
    </section>
  );
}

function SubjectRow({ subject, onOpen }: { subject: Subject; onOpen: () => void }) {
  const { data, today } = useStore();
  const plan = planFor(data, subject, today);
  const st = STATE_LABEL[plan.state];
  return (
    <li>
      <button className="row row-btn" onClick={onOpen}>
        <div className="row-main">
          <div className="row-title">
            <strong>{subject.name}</strong>
            <span className={`pill pill-${st.tone}`}>{st.text}</span>
          </div>
          <span className="muted">
            {n(plan.completed)} / {n(plan.target)}{subject.unit} · {plan.progress.toFixed(0)}%
          </span>
          <ProgressBar value={plan.progress} tone={st.tone === 'accent' ? 'accent' : st.tone} />
        </div>
      </button>
    </li>
  );
}

function ExamForm({ first, onDone }: { first?: boolean; onDone: () => void }) {
  const { data, today, dispatch } = useStore();
  const e = data.exam;
  const [name, setName] = useState(e?.name ?? '');
  const [date, setDate] = useState(e?.examDate ?? '');
  const [goal, setGoal] = useState(String(e?.dailyGoalMinutes ?? 180));
  const valid = name.trim() && date && Number(goal) > 0;
  const submit = () => {
    const exam: Exam = { id: e?.id ?? newId('exam'), name: name.trim(), examDate: date, dailyGoalMinutes: Math.round(Number(goal)) };
    dispatch({ type: 'SET_EXAM', exam });
    onDone();
  };
  return (
    <section className={first ? 'stack' : 'stack-sm'}>
      {first && (
        <>
          <h1 className="h-title">Studyflow Next</h1>
          <p className="muted lead">시험일까지 무엇을 공부할지 정하고, 기록하고, 이해했는지 확인하는 앱이에요. 먼저 준비 중인 시험을 알려 주세요.</p>
        </>
      )}
      <Field label="시험 이름"><input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="예: 공인노무사 1차" /></Field>
      <Field label="시험일"><input type="date" min={first ? today : undefined} value={date} onChange={(ev) => setDate(ev.target.value)} /></Field>
      <Field label="하루 목표 학습시간 (분)" hint="현실적으로 매일 낼 수 있는 시간을 적어 주세요."><input type="number" inputMode="numeric" min="10" value={goal} onChange={(ev) => setGoal(ev.target.value)} /></Field>
      <Button variant="primary" block disabled={!valid} onClick={submit}>{first ? '시작하기' : '저장'}</Button>
    </section>
  );
}

function SubjectForm({ subject, onDone }: { subject: Subject | null; onDone: () => void }) {
  const { data, today, dispatch } = useStore();
  const exam = data.exam!;
  const [name, setName] = useState(subject?.name ?? '');
  const [mode, setMode] = useState<Subject['mode']>(subject?.mode ?? 'amount');
  const [target, setTarget] = useState(String(subject?.targetAmount ?? ''));
  const [unit, setUnit] = useState(subject?.unit ?? '페이지');
  const [start, setStart] = useState(subject?.startDate ?? today);
  const [end, setEnd] = useState(subject?.endDate ?? addDays(exam.examDate, -14) < today ? exam.examDate : addDays(exam.examDate, -14));
  const [days, setDays] = useState<number[]>(subject?.studyDays ?? [1, 2, 3, 4, 5, 6]);

  const errors: string[] = [];
  if (!name.trim()) errors.push('과목 이름을 입력하세요');
  if (mode === 'amount' && !(Number(target) > 0)) errors.push('목표 분량을 입력하세요');
  if (!start || !end || end < start) errors.push('종료일은 시작일 이후여야 해요');
  if (days.length === 0) errors.push('공부할 요일을 하나 이상 고르세요');

  const submit = () => {
    dispatch({
      type: 'UPSERT_SUBJECT',
      subject: {
        id: subject?.id ?? newId('sub'),
        examId: exam.id,
        name: name.trim(),
        mode,
        targetAmount: mode === 'amount' ? Number(target) : 0,
        unit: unit.trim() || '페이지',
        startDate: start,
        endDate: end,
        studyDays: [...days].sort(),
        status: subject?.status ?? 'active',
      },
    });
    onDone();
  };
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className="stack-sm">
      <Field label="과목 이름"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 노동법" /></Field>
      <div className="field">
        <span className="field-label">등록 방식</span>
        <Choice label="등록 방식" value={mode} onChange={setMode} options={[{ value: 'amount', label: '분량 기반' }, { value: 'chapters', label: '목차 기반' }]} />
        <span className="field-hint">{mode === 'amount' ? '전체 페이지 수처럼 하나의 숫자로 관리해요.' : '저장 후 목차를 입력하면 단원별 목표를 합산합니다.'}</span>
      </div>
      <div className="two">
        {mode === 'amount' && <Field label="전체 목표 분량"><input type="number" inputMode="decimal" min="1" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>}
        <Field label="단위"><input value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
      </div>
      <div className="two">
        <Field label="시작일"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="field">
        <span className="field-label">공부할 요일</span>
        <div className="days">
          {WEEKDAY_LABELS.map((l, d) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} className={`day${days.includes(d) ? ' is-on' : ''}`} onClick={() => toggleDay(d)}>{l}</button>
          ))}
        </div>
      </div>
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <Button variant="primary" block disabled={errors.length > 0} onClick={submit}>저장</Button>
    </div>
  );
}

function SubjectDetail({ subject, onBack, onEdit, editing, setEditing, nav }: { subject: Subject; onBack: () => void; onEdit: () => void; editing: Subject | 'new' | null; setEditing: (s: Subject | 'new' | null) => void; nav: Nav }) {
  const { data, today, dispatch } = useStore();
  const plan = planFor(data, subject, today);
  const st = STATE_LABEL[plan.state];
  const rows = flattenChapters(data.chapters, subject.id);
  const [outline, setOutline] = useState('');
  const [adding, setAdding] = useState(false);

  const parsed = parseOutline(outline);
  const addOutline = () => {
    const maxOrder = data.chapters.filter((c) => c.subjectId === subject.id).reduce((m, c) => Math.max(m, c.order), -1);
    outlineToChapters(parsed, subject.id, () => newId('ch'), maxOrder + 1).forEach((chapter) => dispatch({ type: 'UPSERT_CHAPTER', chapter }));
    setOutline('');
    setAdding(false);
  };
  const remove = () => {
    const count = data.sessions.filter((s) => s.subjectId === subject.id).length;
    if (window.confirm(`'${subject.name}' 과목을 삭제할까요?\n단원, 복습 일정과 학습 기록 ${count}건이 함께 삭제되며 되돌릴 수 없습니다.`)) {
      dispatch({ type: 'DELETE_SUBJECT', id: subject.id });
      onBack();
    }
  };

  return (
    <section className="stack">
      <button className="link" onClick={onBack}>← 과목 목록</button>
      <header className="row">
        <div className="row-main">
          <h1 className="h-title">{subject.name}</h1>
          <span className="muted">{subject.startDate} ~ {subject.endDate} · {subject.studyDays.map((d) => WEEKDAY_LABELS[d]).join('')}</span>
        </div>
        <span className={`pill pill-${st.tone}`}>{st.text}</span>
      </header>

      <div className="block">
        <ProgressBar value={plan.progress} tone={st.tone} />
        <p className="muted">완료 {n(plan.completed)} / 전체 {n(plan.target)}{subject.unit} ({plan.progress.toFixed(0)}%) · 남은 {n(plan.remaining)}{subject.unit}</p>
      </div>

      <PlanNumbers plan={plan} unit={subject.unit} />

      {plan.options.length > 0 && (
        <div className="callout callout-warn">
          <strong>재조정 제안</strong>
          <p>선택하기 전에는 아무것도 바뀌지 않아요.</p>
          <div className="stack-sm">
            {plan.options.filter((o) => !(o.kind === 'reduce' && subject.mode === 'chapters')).map((o) => (
              <Button key={o.kind} block onClick={() => window.confirm(`${o.label}\n\n이대로 변경할까요?`) && dispatch({ type: 'UPSERT_SUBJECT', subject: applyOption(subject, plan, o) })}>{o.label}</Button>
            ))}
          </div>
        </div>
      )}

      {subject.mode === 'chapters' && (
        <div className="block">
          <div className="block-head">
            <h3 className="h-sub">목차</h3>
            <Button onClick={() => setAdding((a) => !a)}>{adding ? '닫기' : '+ 목차 추가'}</Button>
          </div>
          {adding && (
            <div className="stack-sm">
              <p className="muted">한 줄에 하나씩. 공백 2칸 들여쓰면 하위 단원, 줄 끝 숫자는 목표 {subject.unit}입니다.</p>
              <textarea rows={8} value={outline} onChange={(e) => setOutline(e.target.value)} placeholder={'근로기준법\n  근로계약 20\n  임금 40\n노동조합법\n  단체교섭 15'} spellCheck={false} className="mono" />
              <Button variant="primary" block disabled={parsed.length === 0} onClick={addOutline}>{parsed.length}개 단원 추가</Button>
            </div>
          )}
          {rows.length === 0 && !adding ? (
            <Empty title="목차가 비어 있어요" body="단원을 추가하면 단원별 목표와 진도, 복습이 연결됩니다." />
          ) : (
            <ul className="list">
              {rows.map(({ chapter, depth }) => {
                const done = chapterCompleted(chapter.id, data.sessions);
                const isParent = data.chapters.some((c) => c.parentId === chapter.id);
                return (
                  <li key={chapter.id} className="row chapter" style={{ paddingLeft: 12 + depth * 18 }}>
                    <div className="row-main">
                      <span className={isParent ? 'chapter-parent' : ''}>{chapter.title}</span>
                      {!isParent && (
                        <>
                          <span className="muted">{n(done)} / {n(chapter.targetAmount)}{subject.unit}</span>
                          <ProgressBar value={chapter.targetAmount > 0 ? (done / chapter.targetAmount) * 100 : 0} />
                        </>
                      )}
                    </div>
                    {!isParent && <Button variant="ghost" onClick={() => nav.go('focus', { subjectId: subject.id, chapterId: chapter.id })}>공부</Button>}
                    <button className="icon-btn" aria-label={`${chapter.title} 삭제`} onClick={() => window.confirm(`'${chapter.title}' 단원을 삭제할까요? 학습 기록은 남고 단원 연결만 해제됩니다.`) && dispatch({ type: 'DELETE_CHAPTER', id: chapter.id })}>✕</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="row-actions">
        <Button onClick={onEdit}>과목 수정</Button>
        <Button variant="danger" onClick={remove}>과목 삭제</Button>
      </div>
      {editing && editing !== 'new' && editing.id === subject.id && (
        <Sheet title="과목 수정" onClose={() => setEditing(null)}><SubjectForm subject={subject} onDone={() => setEditing(null)} /></Sheet>
      )}
    </section>
  );
}

function PlanNumbers({ plan, unit }: { plan: PlanSummary; unit: string }) {
  if (plan.target <= 0) return <p className="muted">목표 분량이 아직 0이에요. 목차를 추가하거나 목표를 입력하세요.</p>;
  return (
    <dl className="numbers">
      <div><dt>최초 계획</dt><dd>하루 {n(round1(plan.originalDaily))}{unit}</dd><small>전체 목표 ÷ 전체 학습일 ({plan.totalStudyDays}일)</small></div>
      <div><dt>현재 필요량</dt><dd>하루 {n(round1(plan.requiredDaily))}{unit}</dd><small>남은 분량 ÷ 남은 학습일 ({plan.remainingStudyDays}일)</small></div>
      <div>
        <dt>현실 가능량</dt>
        <dd>{plan.realisticDaily !== null ? `하루 ${n(round1(plan.realisticDaily))}${unit}` : '기록 부족'}</dd>
        <small>{plan.realisticDaily !== null ? '내 학습속도 × 하루 배정 시간' : '분량이 기록된 학습이 3회 이상 쌓이면 계산해요'}</small>
      </div>
      <div><dt>예상 완료일</dt><dd>{plan.projectedEnd ?? '기록 부족'}</dd><small>{plan.projectedEnd ? '최근 14일 속도 기준 추정' : '최근 2회 이상의 분량 기록이 필요해요'}</small></div>
    </dl>
  );
}
const round1 = (x: number) => Math.round(x * 10) / 10;

function DataSection() {
  const { data, dispatch, repo } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const download = () => {
    const blob = new Blob([exportBackup(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `studyflow-next-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: '백업 파일을 내려받았어요.' });
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const res = importBackup(await f.text());
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    const d = res.data;
    const summary = `과목 ${d.subjects.length}개, 학습 기록 ${d.sessions.length}건, 복습 ${d.reviews.length}건`;
    if (!window.confirm(`${summary}을(를) 가져옵니다.\n현재 데이터는 가져오기 전에 자동 보관되고, 같은 내용으로 교체됩니다. 계속할까요?`)) return;
    repo.snapshotBeforeImport(data);
    dispatch({ type: 'REPLACE_ALL', data: d });
    setMsg({ ok: true, text: `${summary}을(를) 가져왔어요. ${res.note ?? ''}` });
  };

  return (
    <div className="block">
      <h3 className="h-sub">데이터 백업</h3>
      <p className="muted">기록은 이 기기의 브라우저에만 저장돼요. 정기적으로 백업 파일을 내려받아 두세요. 기존 Studyflow 백업 파일도 가져올 수 있습니다.</p>
      <div className="row-actions">
        <Button onClick={download}>백업 내려받기</Button>
        <Button onClick={() => file.current?.click()}>백업 가져오기</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {msg && <p className={msg.ok ? 'muted' : 'error-text'} role="status">{msg.text}</p>}
    </div>
  );
}
