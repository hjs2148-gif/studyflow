import { useState } from 'react';
import { useStore } from '../state/store';
import { Focus } from './Focus';
import { Insights } from './Insights';
import { Plan } from './Plan';
import { Today } from './Today';

export type Tab = 'today' | 'plan' | 'focus' | 'insights';
export interface FocusIntent {
  subjectId: string;
  chapterId: string | null;
}
export interface Nav {
  go: (tab: Tab, intent?: FocusIntent | null) => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: '오늘', icon: '◐' },
  { id: 'plan', label: '계획', icon: '▤' },
  { id: 'focus', label: '공부', icon: '●' },
  { id: 'insights', label: '분석', icon: '◭' },
];

export function App() {
  const { data, notice, dismissNotice } = useStore();
  const [tab, setTab] = useState<Tab>(() => (data.activeTimer ? 'focus' : data.exam ? 'today' : 'plan'));
  const [intent, setIntent] = useState<FocusIntent | null>(null);

  const nav: Nav = {
    go: (t, i = null) => {
      setIntent(i);
      setTab(t);
      window.scrollTo(0, 0);
    },
  };
  const running = !!data.activeTimer;

  return (
    <div className="app">
      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>
          <button className="icon-btn" onClick={dismissNotice} aria-label="알림 닫기">✕</button>
        </div>
      )}
      <main className="screen">
        {tab === 'today' && <Today nav={nav} />}
        {tab === 'plan' && <Plan nav={nav} />}
        {tab === 'focus' && <Focus intent={intent} nav={nav} />}
        {tab === 'insights' && <Insights nav={nav} />}
      </main>
      <nav className="tabbar" aria-label="메인 메뉴">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' is-on' : ''}`} onClick={() => nav.go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'focus' && running && <span className="tab-dot" aria-label="진행 중" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
