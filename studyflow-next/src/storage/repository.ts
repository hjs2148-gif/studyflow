import { EMPTY_DATA, type AppData } from '../domain/types';
import { sanitize } from './sanitize';

/** 기존 Studyflow(todait_v3)와 절대 겹치지 않는 별도 저장 키 */
export const STORAGE_KEY = 'studyflow_next_v1';
export const PRE_IMPORT_KEY = 'studyflow_next_v1_pre_import';

export interface LoadResult {
  data: AppData;
  /** 사용자에게 보여줄 경고 (손상된 데이터 격리 등) */
  warning?: string;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** 향후 Firestore 등으로 교체할 수 있도록 저장소 인터페이스를 분리한다. */
export interface Repository {
  load(): LoadResult;
  save(data: AppData): SaveResult;
  /** 가져오기 직전 현재 데이터를 한 번 더 보관 */
  snapshotBeforeImport(data: AppData): void;
}

export function createLocalRepository(storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage): Repository {
  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return { data: EMPTY_DATA, warning: '브라우저 저장소에 접근할 수 없어 기록이 저장되지 않습니다. 시크릿 모드인지 확인하세요.' };
      }
      if (!raw) return { data: EMPTY_DATA };
      try {
        const data = sanitize(JSON.parse(raw));
        if (!data) throw new Error('invalid shape');
        return { data };
      } catch {
        // 손상된 원본은 덮어쓰지 않고 별도 키로 격리한다.
        const quarantineKey = `${STORAGE_KEY}_corrupt_${Date.now()}`;
        try {
          storage.setItem(quarantineKey, raw);
        } catch {
          /* 격리 실패 시에도 원본 키는 그대로 둔다 */
        }
        return {
          data: EMPTY_DATA,
          warning: `저장된 데이터를 읽을 수 없어 원본을 '${quarantineKey}'에 보관했습니다. 새로 시작하거나 백업을 가져오세요.`,
        };
      }
    },
    save(data) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true };
      } catch {
        return { ok: false, error: '저장 공간이 부족하거나 저장이 차단되었습니다. 백업 파일을 내려받아 두세요.' };
      }
    },
    snapshotBeforeImport(data) {
      try {
        storage.setItem(PRE_IMPORT_KEY, JSON.stringify(data));
      } catch {
        /* 보조 보관 실패는 가져오기 자체를 막지 않는다 */
      }
    },
  };
}
