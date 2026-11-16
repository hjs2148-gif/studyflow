import { useState } from 'react';
import { diffDays, parseDate } from '../domain/dates';
import { n, planFor, titleOf } from '../domain/insights';
import { pickPriority, type PlanSummary } from '../domain/plan';
import { dueReviews, latestRecall } from '../domain/review';
import type { ReviewResult, Review, Subject } from '../domain/types';
import { useStore } from '../state/store';
import type { Nav } from './App';
import { CheckIn } from './CheckIn';
import { applyOption, usableOptions } from './reschedule';
import { Button, Empty, ProgressBar, fmtMinutes } from './primitives';

export function Today({ nav }: { nav: Nav }) {
  const { data, today, dispatch } = useStore();
  const { exam } = data;
  const [checking, setChecking] = useState<Subject | null>(null);

  if (!exam) {
    return (
      <section>
        <h1 className="h-title">시작하기</h1>
        <Empty
          title="먼저 시험을 등록해 주세요"
          body="시험명과 시험일, 하루 목표시간을 정하면 오늘 무엇을 공부할지 계산해 드립니다."
          action={<Button variant="primary" onClick={() => nav.go('plan')}>시험 등록하기</Button>}
        />
      </section>
    );
  }

  const dday = diffDays(today, exam.examDate);
  const active = data.subjects.filter((s) => s.status === 'active');
  const items = active.map((subject) => ({ subject, plan: planFor(data, subject, today) }));
  const todayItems = items.filter((i) => i.plan.isStudyDayToday && i.plan.state !== 'done');
  const priority = pickPriority(items);
  const todayMinutes = Math.round(
    data.sessions.filter((s) => s.date === today).reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
  );
  const due = dueReviews(data.reviews, today);
  const stressed = items.filter((i) => i.plan.state === 'overloaded' || i.plan.state === 'overdue');

  const goalPct = exam.dailyGoalMinutes > 0 ? (todayMinutes / exam.dailyGoalMinutes) * 100 : 0;
  const dateLabel = parseDate(today).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <section className="stack">
      <header className="today-head">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="h-title">{exam.name}</h1>
        </div>
        <div className="dday" aria-label="시험까지 남은 날">
          <strong>{dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day' : `D+${-dday}`}</strong>
        </div>
      </header>

      <div className="goal">
        <div className="goal-row">
          <span>오늘 학습시간</span>
          <span>
            <strong>{fmtMinutes(todayMinutes)}</strong> / {fmtMinutes(exam.dailyGoalMinutes)}
          </span>
        </div>
        <ProgressBar value={goalPct} />
      </div>

      {data.activeTimer && (
        <button className="callout callout-warn callout-btn" onClick={() => nav.go('focus')}>
          <strong>공부 타이머가 진행 중이에요</strong>
          <span>눌러서 이어서 보기</span>
        </button>
      )}

      {data.subjects.length === 0 ? (
        <Empty
          title="과목을 추가하면 오늘 할 일이 만들어져요"
          body="과목, 목표 분량, 종료일을 입력하면 하루 권장량을 계산합니다."
          action={<Button variant="primary" onClick={() => nav.go('plan')}>과목 추가하기</Button>}
        />
      ) : (
        <>
          {priority ? (
            <div className="hero">
              <p className="eyebrow">지금 가장 먼저</p>
              <h2>{priority.subject.name}</h2>
              <p className="hero-sub">{heroLine(priority.plan, priority.subject)}</p>
              <Button variant="primary" block onClick={() => nav.go('focus', { subjectId: priority.subject.id, chapterId: null })}>
                지금 공부 시작
              </Button>
            </div>
          ) : (
            <div className="hero hero-quiet">
              <p className="eyebrow">오늘</p>
              <h2>{todayItems.length === 0 ? '오늘은 예정된 학습이 없어요' : '오늘 목표를 모두 채웠어요'}</h2>
              <p className="hero-sub">복습할 단원이 있다면 아래에서 확인하세요. 더 공부하고 싶다면 바로 시작할 수 있습니다.</p>
              <Button variant="secondary" block onClick={() => nav.go('focus')}>공부 시작</Button>
            </div>
          )}

          {stressed.map(({ subject, plan }) => (
            <RescheduleCard key={subject.id} subject={subject} plan={plan} />
          ))}

          {todayItems.length > 0 && (
            <div className="block">
              <h3 className="h-sub">오늘 공부할 과목</h3>
              <ul className="list">
                {todayItems.map(({ subject, plan }) => {
                  const left = Math.max(0, plan.todayTarget - plan.todayDone);
                  return (
                    <li key={subject.id} className="row">
                      <div className="row-main">
                        <strong>{subject.name}</strong>
                        <span className="muted">
                          목표 {n(Math.ceil(plan.todayTarget))}
                          {subject.unit} · 남은 {n(Math.ceil(left))}
                          {subject.unit}
                        </span>
                        <ProgressBar value={plan.todayTarget > 0 ? (plan.todayDone / plan.todayTarget) * 100 : 0} />
                      </div>
                      <Button variant="ghost" onClick={() => setChecking(subject)}>체크</Button>
                      <Button variant="ghost" onClick={() => nav.go('focus', { subjectId: subject.id, chapterId: null })}>시작</Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {checking && <CheckIn subject={checking} onClose={() => setChecking(null)} />}

      <div className="block">
        <h3 className="h-sub">오늘 복습 {due.length > 0 && <span className="count">{due.length}</span>}</h3>
        {due.length === 0 ? (
          <p className="muted">오늘 복습할 단원이 없습니다. 공부한 단원은 다음 날부터 복습 일정이 잡혀요.</p>
        ) : (
          <ul className="list">
            {due.map((r) => (
              <ReviewRow key={r.id} review={r} onResult={(res) => dispatch({ type: 'REVIEW_RESULT', reviewId: r.id, result: res, today })} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function heroLine(plan: PlanSummary, subject: Subject): string {
  const left = Math.max(0, Math.ceil(plan.todayTarget - plan.todayDone));
  const base = `오늘 ${n(Math.ceil(plan.todayTarget))}${subject.unit} 중 ${n(left)}${subject.unit} 남았어요.`;
  if (plan.state === 'overloaded') return `${base} 계획이 많이 밀려 있어요. 아래에서 조정할 수 있습니다.`;
  if (plan.state === 'behind') return `${base} 계획보다 조금 늦은 과목이에요.`;
  return base;
}

function ReviewRow({ review, onResult }: { review: Review; onResult: (r: ReviewResult) => void }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const recall = latestRecall(data.sessions, review.subjectId, review.chapterId);
  return (
    <li className="row row-col">
      <button className="row-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <strong>{titleOf(data.subjects, data.chapters, review.subjectId, review.chapterId)}</strong>
        <span className="muted">{review.lastReviewDate ? `${review.reviewStep + 1}회차 복습` : '첫 복습'}</span>
      </button>
      {open && (
        <div className="review-body">
          <p className="muted">자료를 보지 않고 핵심을 먼저 떠올려 보세요. 그다음 결과를 고르세요.</p>
          {recall && (
            <details>
              <summary>지난번에 적어 둔 내용 보기</summary>
              <p className="recall">{recall}</p>
            </details>
          )}
          <div className="review-actions">
            <Button variant="primary" onClick={() => onResult('remembered')}>기억남</Button>
            <Button onClick={() => onResult('hazy')}>가물가물</Button>
            <Button variant="danger" onClick={() => onResult('forgot')}>잊어버림</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function RescheduleCard({ subject, plan }: { subject: Subject; plan: PlanSummary }) {
  const { dispatch } = useStore();
  const options = usableOptions(subject, plan);
  return (
    <div className="callout callout-warn">
      <strong>{subject.name}: 일정 재조정을 권해요</strong>
      <p>
        하루 권장량이 최초 {n(plan.originalDaily)}
        {subject.unit}에서 {n(plan.requiredDaily)}
        {subject.unit}로 커졌습니다.
        {plan.realisticDaily !== null && ` 실제 학습속도로는 하루 약 ${n(plan.realisticDaily)}${subject.unit}가 현실적이에요.`} 무리해서 따라잡기보다 계획을 바꾸는 편이 지속하기 좋습니다. 아무것도 자동으로 바뀌지 않아요.
      </p>
      {options.length === 0 && <p className="muted">계획 화면에서 기간이나 목표량을 직접 조정해 주세요.</p>}
      <div className="stack-sm">
        {options.map((o) => (
          <Button
            key={o.kind}
            block
            onClick={() => {
              if (window.confirm(`${o.label}\n\n이대로 변경할까요?`)) dispatch({ type: 'UPSERT_SUBJECT', subject: applyOption(subject, plan, o) });
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
