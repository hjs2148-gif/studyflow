import { useState } from 'react';
import { parseDate } from '../domain/dates';
import { buildVerdicts, calibrationGap, calibrationSummary, MIN_CALIBRATION_SAMPLES, n, planFor, titleOf, UNDERSTANDING_LABEL, weakChapters, weeklyStats, type Verdict } from '../domain/insights';
import { dueReviews } from '../domain/review';
import type { StudySession } from '../domain/types';
import { useStore } from '../state/store';
import type { Nav } from './App';
import { Button, Empty, Field, ProgressBar, Sheet, fmtMinutes } from './primitives';

export function Insights({ nav }: { nav: Nav }) {
  const { data, today } = useStore();
  const [editing, setEditing] = useState<StudySession | null>(null);

  if (!data.exam || data.sessions.length === 0) {
    return (
      <section className="stack">
        <h1 className="h-title">분석</h1>
        <Empty
          title="아직 분석할 기록이 없어요"
          body="공부를 한 번 기록하면 이번 주 학습시간과 과목별 진도를 볼 수 있어요. 분석은 기록이 쌓일수록 정확해집니다."
          action={<Button variant="primary" onClick={() => nav.go('focus')}>첫 공부 시작</Button>}
        />
      </section>
    );
  }

  const week = weeklyStats(data, today);
  const verdicts = buildVerdicts(data, today);
  const weak = weakChapters(data);
  const cal = calibrationSummary(data.sessions);
  const upcoming = [...data.reviews].filter((r) => r.nextReviewDate > today).sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate)).slice(0, 5);
  const dueCount = dueReviews(data.reviews, today).length;
  const recent = [...data.sessions].sort((a, b) => b.endTime - a.endTime).slice(0, 10);

  return (
    <section className="stack">
      <h1 className="h-title">분석</h1>

      <div className="block">
        <h3 className="h-sub">이번 주</h3>
        <div className="stat">
          <strong>{fmtMinutes(week.minutes)}</strong>
          <span className="muted">
            {week.goalMinutes > 0 ? `목표 ${fmtMinutes(week.goalMinutes)} 중 ${Math.round((week.attainment ?? 0) * 100)}%` : '목표 시간이 설정되지 않았어요'}
          </span>
        </div>
        {week.goalMinutes > 0 && <ProgressBar value={(week.attainment ?? 0) * 100} />}
      </div>

      <div className="block">
        <h3 className="h-sub">판정과 다음 행동</h3>
        {verdicts.length === 0 ? <p className="muted">진행 중인 과목이 없어요.</p> : verdicts.map((v, i) => <VerdictCard key={i} v={v} />)}
      </div>

      <div className="block">
        <h3 className="h-sub">과목별</h3>
        <ul className="list">
          {data.subjects.map((s) => {
            const plan = planFor(data, s, today);
            const minutes = Math.round(data.sessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.durationSeconds, 0) / 60);
            return (
              <li key={s.id} className="row row-col">
                <div className="row-title"><strong>{s.name}</strong><span className="muted">누적 {fmtMinutes(minutes)}</span></div>
                <ProgressBar value={plan.progress} tone={plan.state === 'overloaded' || plan.state === 'overdue' ? 'bad' : plan.state === 'behind' ? 'warn' : 'accent'} />
                <span className="muted">
                  {plan.progress.toFixed(0)}% · 남은 {n(plan.remaining)}{s.unit}
                  {plan.projectedEnd && plan.remaining > 0 ? ` · 예상 완료 ${plan.projectedEnd} (종료일 ${s.endDate})` : ' · 예상 완료일은 기록이 더 필요해요'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="block">
        <h3 className="h-sub">내가 아는 정도 vs 실제</h3>
        {!cal.enough ? (
          <p className="muted">공부 전 예측과 공부 후 평가를 함께 남긴 기록이 {cal.samples}건이에요. {MIN_CALIBRATION_SAMPLES}건 이상 쌓이면 과대·과소평가 경향을 보여드릴게요.</p>
        ) : (
          <>
            <p>
              {cal.samples}건 중 <strong>{cal.over}건</strong>은 예상보다 실제 이해가 낮았고, {cal.accurate}건은 비슷했고, {cal.under}건은 예상보다 높았어요.
            </p>
            <p className="muted">자기평가 결과일 뿐 실제 시험 점수와는 다를 수 있어요. {cal.over > cal.samples / 2 ? '공부 직후 자료를 덮고 설명해 보는 습관이 도움이 됩니다.' : ''}</p>
          </>
        )}
      </div>

      <div className="block">
        <h3 className="h-sub">취약 단원</h3>
        {weak.length === 0 ? <p className="muted">지금은 눈에 띄는 취약 단원이 없어요. (이해도 평가를 남긴 기록 기준)</p> : (
          <ul className="list">{weak.map((w, i) => (
            <li key={i} className="row"><div className="row-main"><strong>{w.title}</strong><span className="muted">{w.reason}</span></div>
              <Button variant="ghost" onClick={() => nav.go('focus', { subjectId: w.subjectId, chapterId: w.chapterId })}>공부</Button></li>
          ))}</ul>
        )}
      </div>

      <div className="block">
        <h3 className="h-sub">복습 예정</h3>
        <p className="muted">오늘 복습 {dueCount}건{dueCount > 0 && <> · <button className="link inline" onClick={() => nav.go('today')}>오늘 화면에서 하기</button></>}</p>
        {upcoming.length > 0 && <ul className="list">{upcoming.map((r) => <li key={r.id} className="row"><div className="row-main"><span>{titleOf(data.subjects, data.chapters, r.subjectId, r.chapterId)}</span></div><span className="muted">{r.nextReviewDate}</span></li>)}</ul>}
      </div>

      <div className="block">
        <h3 className="h-sub">최근 기록</h3>
        <ul className="list">
          {recent.map((s) => {
            const gap = calibrationGap(s);
            return (
              <li key={s.id} className="row">
                <div className="row-main">
                  <strong>{titleOf(data.subjects, data.chapters, s.subjectId, s.chapterId)}</strong>
                  <span className="muted">
                    {parseDate(s.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} · {fmtMinutes(s.durationSeconds / 60)} · {n(s.amount)}{data.subjects.find((x) => x.id === s.subjectId)?.unit ?? ''}
                    {s.actualUnderstanding ? ` · ${UNDERSTANDING_LABEL[s.actualUnderstanding]}` : ''}{gap !== null && gap > 0 ? ' · 과대평가' : ''}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => setEditing(s)}>수정</Button>
              </li>
            );
          })}
        </ul>
      </div>

      {editing && <SessionEditor session={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function VerdictCard({ v }: { v: Verdict }) {
  return (
    <article className={`verdict verdict-${v.tone}`}>
      <h4>{v.verdict}</h4>
      <p><span className="tag">근거</span> {v.evidence}</p>
      <p><span className="tag">다음 행동</span> {v.action}</p>
    </article>
  );
}

function SessionEditor({ session, onClose }: { session: StudySession; onClose: () => void }) {
  const { dispatch } = useStore();
  const [minutes, setMinutes] = useState(String(Math.round(session.durationSeconds / 60)));
  const [amount, setAmount] = useState(String(session.amount));
  const [memo, setMemo] = useState(session.memo);
  const valid = Number(minutes) > 0 && Number(amount) >= 0;
  return (
    <Sheet title="학습 기록 수정" onClose={onClose}>
      <div className="stack-sm">
        <div className="two">
          <Field label="시간 (분)"><input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <Field label="분량"><input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <Field label="메모"><input value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
        <Button variant="primary" block disabled={!valid} onClick={() => { dispatch({ type: 'UPDATE_SESSION', session: { ...session, durationSeconds: Math.round(Number(minutes) * 60), amount: Number(amount), memo: memo.trim() } }); onClose(); }}>저장</Button>
        <Button variant="danger" block onClick={() => { if (window.confirm('이 학습 기록을 삭제할까요? 진도와 통계가 함께 바뀝니다.')) { dispatch({ type: 'DELETE_SESSION', id: session.id }); onClose(); } }}>기록 삭제</Button>
      </div>
    </Sheet>
  );
}
