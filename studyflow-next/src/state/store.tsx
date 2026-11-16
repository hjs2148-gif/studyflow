import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { toDateStr } from '../domain/dates';
import type { AppData } from '../domain/types';
import { createLocalRepository, type Repository } from '../storage/repository';
import { reducer, type Action } from './reducer';

interface Store {
  data: AppData;
  dispatch: (a: Action) => void;
  /** 로컬 기준 오늘. 자정이 지나거나 앱이 다시 보일 때 갱신 */
  today: string;
  notice: string | null;
  dismissNotice: () => void;
  repo: Repository;
}

const Ctx = createContext<Store | null>(null);

export const newId = (p = 'id') =>
  `${p}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export function StoreProvider({ children, repo: injected }: { children: ReactNode; repo?: Repository }) {
  const repo = useMemo(() => injected ?? createLocalRepository(), [injected]);
  const [initial] = useState(() => repo.load());
  const [data, rawDispatch] = useReducer(reducer, initial.data);
  const [notice, setNotice] = useState<string | null>(initial.warning ?? null);
  const [today, setToday] = useState(() => toDateStr(new Date()));
  // 손상 데이터를 격리한 직후 빈 상태로 덮어쓰기 저장하지 않도록, 사용자 변경이 있을 때만 저장한다.
  const dirty = useRef(false);

  const dispatch = (a: Action) => {
    dirty.current = true;
    rawDispatch(a);
  };

  useEffect(() => {
    if (!dirty.current) return;
    const r = repo.save(data);
    if (!r.ok) setNotice(r.error);
  }, [data, repo]);

  useEffect(() => {
    const refresh = () => setToday(toDateStr(new Date()));
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const value: Store = { data, dispatch, today, notice, dismissNotice: () => setNotice(null), repo };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 가 필요합니다');
  return v;
}
