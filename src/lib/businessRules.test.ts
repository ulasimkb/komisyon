import { describe, expect, it } from 'vitest'
import { canCreateImplementationTask, deriveApplicationStatus, isOverdue, validateTaskForStatus } from './businessRules'
import type { Task } from '../types'

const task = (status: Task['status'], dueDate?: string): Task => ({ id: crypto.randomUUID(), decisionId: 'decision', title: 'İş', unit: 'Ulaşım', status, dueDate, priority: 'normal' })

describe('karar uygulama kuralları', () => {
  it('reddedilen karara uygulama görevi açılmaz', () => expect(canCreateImplementationTask('rejected')).toBe(false))
  it('bilgi amaçlı karara uygulama görevi açılmaz', () => expect(canCreateImplementationTask('accepted', 'Bilgi amaçlı')).toBe(false))
  it('görev alanı dışındaki karara uygulama görevi açılmaz', () => expect(canCreateImplementationTask('accepted', 'Görev alanı dışında')).toBe(false))
  it('reddedilen kararın uygulama durumu yoktur', () => expect(deriveApplicationStatus('rejected', [])).toBeUndefined())
  it('bilgi amaçlı karar uygulama gerektirmez', () => expect(deriveApplicationStatus('accepted', [], 'Bilgi amaçlı')).toBe('not_required'))
  it('bir iş tamamlanınca karar kısmen tamamlanır', () => expect(deriveApplicationStatus('accepted', [task('completed'), task('planned')])).toBe('partial'))
  it('bir iş başlatılınca karar devam ediyor olur', () => expect(deriveApplicationStatus('accepted', [task('in_progress'), task('planned')])).toBe('in_progress'))
  it('hedef tarihi olmayan iş gecikmiş sayılmaz', () => expect(isOverdue(task('in_progress'), new Date('2026-09-15'))).toBe(false))
  it('tamamlanan görevde sonuç bilgilerini zorunlu tutar', () => expect(validateTaskForStatus(task('completed'))).toContain('bitiş tarihi'))
  it('iptal edilen görevde gerekçe ister', () => expect(validateTaskForStatus(task('cancelled'))).toContain('iptal gerekçesi'))
})
