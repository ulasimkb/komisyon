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

export function isOverdue(task: Task, today = new Date()): boolean {
  if (!task.dueDate || ['completed', 'cancelled'].includes(task.status)) return false
  const endOfDueDate = new Date(`${task.dueDate}T23:59:59`)
  return endOfDueDate < today
}
