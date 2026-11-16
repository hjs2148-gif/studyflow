import type { PlanSummary, RescheduleOption } from '../domain/plan';
import type { Subject } from '../domain/types';

/** 축소 제안은 분량 기반·1회독 과목에서만 적용 가능 */
export function usableOptions(subject: Subject, plan: PlanSummary): RescheduleOption[] {
  return plan.options.filter((o) => o.kind !== 'reduce' || (subject.mode === 'amount' && (subject.targetRounds ?? 1) === 1));
}

/** 사용자가 제안을 선택했을 때만 호출된다. 새 Subject 값을 반환한다(원본 불변). */
export function applyOption(subject: Subject, plan: PlanSummary, option: RescheduleOption): Subject {
  if (option.kind === 'extend' && option.newEndDate) return { ...subject, endDate: option.newEndDate };
  if (option.kind === 'reduce' && option.newTarget !== undefined && subject.mode === 'amount' && (subject.targetRounds ?? 1) === 1) {
    return { ...subject, targetAmount: plan.completed + option.newTarget };
  }
  return subject;
}
