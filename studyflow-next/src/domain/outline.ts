import type { Chapter } from './types';

export interface OutlineLine {
  depth: number;
  title: string;
  targetAmount: number;
}

/**
 * 들여쓰기(공백 2칸 또는 탭) 목차 텍스트 → 줄 목록.
 * 줄 끝의 숫자는 목표량. 예: "  임금 40"
 */
export function parseOutline(text: string): OutlineLine[] {
  const lines: OutlineLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = raw.match(/^([ \t]*)(.*)$/)!;
    const indent = m[1].replace(/\t/g, '  ').length;
    let title = m[2].trim().replace(/^[-*•]\s*/, '');
    let targetAmount = 0;
    const amt = title.match(/^(.*?)\s+(\d+(?:\.\d+)?)$/);
    if (amt) {
      title = amt[1].trim();
      targetAmount = Number(amt[2]);
    }
    if (title) lines.push({ depth: Math.floor(indent / 2), title, targetAmount });
  }
  return lines;
}

/** 줄 목록 → Chapter[]. 깊이가 갑자기 깊어지면 바로 위 단계의 자식으로 취급 */
export function outlineToChapters(
  lines: OutlineLine[],
  subjectId: string,
  newId: () => string,
  startOrder = 0,
): Chapter[] {
  const out: Chapter[] = [];
  const stack: { depth: number; id: string }[] = [];
  lines.forEach((line, i) => {
    while (stack.length && stack[stack.length - 1].depth >= line.depth) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const id = newId();
    out.push({ id, subjectId, parentId, title: line.title, order: startOrder + i, targetAmount: line.targetAmount });
    stack.push({ depth: line.depth, id });
  });
  return out;
}

/** 표시 순서(깊이 우선)로 정렬된 단원 + 깊이 */
export function flattenChapters(chapters: Chapter[], subjectId: string): { chapter: Chapter; depth: number }[] {
  const mine = chapters.filter((c) => c.subjectId === subjectId).sort((a, b) => a.order - b.order);
  const out: { chapter: Chapter; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of mine.filter((x) => x.parentId === parentId)) {
      out.push({ chapter: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function isLeaf(chapters: Chapter[], id: string) {
  return !chapters.some((c) => c.parentId === id);
}
