import type { ApplicationStatus, Decision, DecisionResult, Task } from '../types'

export function canCreateImplementationTask(result: DecisionResult, scope?: string): boolean {
  return result !== 'rejected' && scope !== 'Bilgi amaçlı' && scope !== 'Görev alanı dışında'
}

export function decisionNeedsImplementation(decision: Pick<Decision, 'result' | 'scope'>): boolean {
  return canCreateImplementationTask(decision.result, decision.scope)
}

export function validateTaskForStatus(task: Pick<Task, 'status' | 'actualEndDate' | 'completionDescription' | 'cancellationReason' | 'waitingReason'>): string | undefined {
  if (task.status === 'completed' && (!task.actualEndDate || !task.completionDescription?.trim())) return 'Tamamlanan görev için bitiş tarihi ve tamamlanma açıklaması zorunludur.'
  if (task.status === 'cancelled' && !task.cancellationReason?.trim()) return 'İptal edilen görev için iptal gerekçesi zorunludur.'
  if (['waiting_reply', 'waiting_approval'].includes(task.status) && !task.waitingReason?.trim()) return 'Bekleyen görev için bekleme nedeni zorunludur.'
  return undefined
}

export function deriveApplicationStatus(result: DecisionResult, tasks: Task[], scope?: string): ApplicationStatus | undefined {
  if (result === 'rejected') return undefined
  if (scope === 'Bilgi amaçlı' || scope === 'Görev alanı dışında') return 'not_required'
  const mandatory = tasks.filter(t => t.status !== 'cancelled')
  if (!mandatory.length) return 'not_started'
  if (mandatory.every(t => t.status === 'completed')) return 'completed'
  if (mandatory.some(t => t.status === 'completed')) return 'partial'
  if (mandatory.some(t => t.status !== 'planned')) return 'in_progress'
  return 'not_started'
}

/** Üst karar numarası "Yıl/sıra" biçiminde olmalıdır: 2026/01. Veritabanındaki decisions_package_no_format kuralıyla aynıdır. */
export const packageNoPattern = '20[0-9]{2}/[0-9]{2}'
export const packageNoFormatMessage = 'Üst karar numarasını yıl/sıra biçiminde girin (örnek: 2026/01).'
export function isValidPackageNo(value: string): boolean {
  return new RegExp(`^${packageNoPattern}$`).test(value.trim())
}

export function isOverdue(task: Task, today = new Date()): boolean {
  if (!task.dueDate || ['completed', 'cancelled'].includes(task.status)) return false
  const endOfDueDate = new Date(`${task.dueDate}T23:59:59`)
  return endOfDueDate < today
}
