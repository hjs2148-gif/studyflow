import type { PlanSummary, RescheduleOption } from '../domain/plan';
import type { Subject } from '../domain/types';

/** 사용자가 제안을 선택했을 때만 호출된다. 새 Subject 값을 반환한다(원본 불변). */
export function applyOption(subject: Subject, plan: PlanSummary, option: RescheduleOption): Subject {
  if (option.kind === 'extend' && option.newEndDate) return { ...subject, endDate: option.newEndDate };
  if (option.kind === 'reduce' && option.newTarget !== undefined && subject.mode === 'amount') {
    return { ...subject, targetAmount: plan.completed + option.newTarget };
  }
  return subject;
}
