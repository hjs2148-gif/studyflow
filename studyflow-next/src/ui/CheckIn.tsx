import { useState } from 'react';
import { n } from '../domain/insights';
import { flattenChapters, isLeaf } from '../domain/outline';
import { chapterInRound, roundInfo } from '../domain/plan';
import type { Subject } from '../domain/types';
import { newId, useStore } from '../state/store';
import { Button, Field, Sheet } from './primitives';

/** 타이머 없이 진도만 빠르게 체크. 시간 0분짜리 기록으로 저장된다. */
export function CheckIn({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { data, today, dispatch } = useStore();
  const info = roundInfo(subject, data.chapters, data.sessions);
  const [pos, setPos] = useState('');

  const record = (amount: number, chapterId: string | null) => {
    const now = Date.now();
    dispatch({
      type: 'SAVE_SESSION',
      reviewId: newId('rev'),
      session: { id: newId('ses'), subjectId: subject.id, chapterId, date: today, startTime: now, endTime: now, durationSeconds: 0, amount, predictedUnderstanding: null, actualUnderstanding: null, recallText: '', focusScore: null, memo: '빠른 체크' },
    });
  };

  const title = `${subject.name} 진도 체크${info.rounds > 1 ? ` · ${info.round}회독` : ''}`;

  if (subject.mode === 'chapters') {
    const leaves = flattenChapters(data.chapters, subject.id).filter((x) => isLeaf(data.chapters, x.chapter.id));
    return (
      <Sheet title={title} onClose={onClose}>
        {leaves.length === 0 ? (
          <p className="muted">계획 화면에서 목차를 먼저 추가해 주세요.</p>
        ) : (
          <ul className="list">
            {leaves.map(({ chapter }) => {
              const done = chapterInRound(chapter, info.round, data.sessions);
              const complete = done >= chapter.targetAmount;
              return (
                <li key={chapter.id}>
                  <label className="row check-row">
                    <input type="checkbox" checked={complete} disabled={complete} onChange={() => record(chapter.targetAmount - done, chapter.id)} />
                    <span className="row-main">{chapter.title}</span>
                    <span className="muted">{n(done)}/{n(chapter.targetAmount)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted check-note">체크하면 남은 분량이 완료 처리됩니다. 잘못 체크했다면 분석 화면의 최근 기록에서 삭제하세요.</p>
      </Sheet>
    );
  }

  const posNum = Number(pos);
  const delta = posNum - info.inRound;
  const valid = pos !== '' && delta > 0 && posNum <= info.base;
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack-sm">
        <Field label={`어디까지 했나요? (${subject.unit})`} hint={`지금 ${n(info.inRound)} / ${n(info.base)}${subject.unit}`}>
          <input type="number" inputMode="decimal" min="0" step="any" value={pos} autoFocus onChange={(e) => setPos(e.target.value)} placeholder={String(info.inRound)} />
        </Field>
        {pos !== '' && !valid && <p className="error-text">{delta <= 0 ? '현재 위치보다 큰 값을 입력하세요.' : `1회독 분량(${n(info.base)})을 넘을 수 없어요.`}</p>}
        <Button variant="primary" block disabled={!valid} onClick={() => { record(delta, null); onClose(); }}>
          {valid ? `+${n(delta)}${subject.unit} 기록` : '기록'}
        </Button>
      </div>
    </Sheet>
  );
}
