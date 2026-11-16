import { n } from '../domain/insights';
import { diffDays, parseDate } from '../domain/dates';
import type { HeatCell, PaceSeries } from '../domain/stats';

const ROWS = ['월', '', '수', '', '금', '', ''];

export function Heatmap({ cols }: { cols: HeatCell[][] }) {
  return (
    <div className="heat" role="img" aria-label="최근 12주 학습 잔디">
      <div className="heat-days">{ROWS.map((r, i) => <span key={i}>{r}</span>)}</div>
      <div className="heat-grid">
        {cols.map((col, i) => (
          <div key={i} className="heat-col">
            {col.map((c) => (
              <span key={c.date} className={`heat-cell heat-${c.future ? 'f' : c.level}`} title={`${c.date} ${c.minutes}분`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaceChart({ series, today, unit }: { series: PaceSeries; today: string; unit: string }) {
  const W = 320;
  const H = 140;
  const pad = { l: 6, r: 6, t: 8, b: 8 };
  const pts = series.points;
  const x = (i: number) => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / series.target) * (H - pad.t - pad.b);
  const plan = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`).join(' ');
  const actualPts = pts.filter((p) => p.actual !== null);
  const actual = actualPts.map((p) => `${x(pts.indexOf(p)).toFixed(1)},${y(p.actual!).toFixed(1)}`).join(' ');
  const todayIdx = Math.max(0, Math.min(pts.length - 1, diffDays(pts[0].date, today)));
  const ahead = series.gapToday <= 0;
  return (
    <figure className="pace">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="누적 계획선과 실제선">
        <polyline points={plan} className="pace-plan" fill="none" />
        {actual && <polyline points={actual} className="pace-actual" fill="none" />}
        <line x1={x(todayIdx)} x2={x(todayIdx)} y1={pad.t} y2={H - pad.b} className="pace-today" />
      </svg>
      <figcaption className="muted">
        <span className="legend-line legend-plan" /> 계획 <span className="legend-line legend-actual" /> 실제 ·{' '}
        {actualPts.length === 0 ? '아직 기록이 없어요' : ahead ? `계획선보다 ${n(Math.round(-series.gapToday * 10) / 10)}${unit} 위`  : `계획선보다 ${n(Math.round(series.gapToday * 10) / 10)}${unit} 아래`}
      </figcaption>
    </figure>
  );
}

export function fmtShort(date: string) {
  return parseDate(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}
