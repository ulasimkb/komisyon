import { describe, expect, it } from 'vitest'
import { availableReportYears, buildAnnualReport } from './annualReport'
import type { Decision, DecisionResult, Task } from '../types'

let next = 0
const decision = (packageNo: string, date: string, title: string, result: DecisionResult, extra: Partial<Decision> = {}): Decision => ({
  id: `d${++next}`, packageNo, itemNo: String(next), date, title, proposal: '', decisionText: '', result,
  scope: 'Doğrudan görev', locations: [], responsibleUnits: result === 'rejected' ? [] : ['Ulaşım Hizmetleri Müdürlüğü'], ...extra,
})
const task = (decisionId: string, status: Task['status'], dueDate?: string): Task => ({ id: `t${++next}`, decisionId, title: 'İş', unit: 'Ulaşım Hizmetleri Müdürlüğü', status, dueDate, priority: 'normal' })

const decisions = [
  decision('2026/01', '2026-01-06', 'KASİS', 'rejected', { neighborhood: 'Cumhuriyet' }),
  decision('2026/01', '2026-01-06', 'KASİS', 'rejected', { neighborhood: 'Cumhuriyet' }),
  decision('2026/01', '2026-01-06', 'KASİS', 'accepted', { applicationStatus: 'completed' }),
  decision('2026/02', '2026-03-10', 'KAVŞAK', 'conditional', { neighborhood: 'Yeni', applicationStatus: 'in_progress' }),
  decision('2026/02', '2026-03-10', 'PARK YASAĞI', 'postponed'),
  decision('2025/04', '2025-11-20', 'KAVŞAK', 'accepted'),
]
const tasks = [task(decisions[2].id, 'completed'), task(decisions[3].id, 'in_progress', '2026-02-01'), task(decisions[5].id, 'planned')]
const report = buildAnnualReport(decisions, tasks, 2026, new Date('2026-10-16T12:00:00Z'))

describe('yıllık faaliyet raporu', () => {
  it('yalnızca seçilen yılın kararlarını ve görevlerini sayar', () => {
    expect(report.decisionCount).toBe(5)
    expect(report.meetingCount).toBe(2)
    expect(report.tasks).toEqual({ total: 2, completed: 1, open: 1, overdue: 1 })
  })
  it('içinde bulunulan yılın dönem sonu bugündür', () => {
    expect(report.periodEnd).toBe('2026-10-16')
    expect(buildAnnualReport(decisions, tasks, 2025, new Date('2026-10-16T12:00:00Z')).periodEnd).toBe('2025-12-31')
  })
  it('toplantıları paket numarasına ve ilk karar tarihine göre özetler', () => {
    expect(report.meetings).toEqual([
      { packageNo: '2026/01', date: '2026-01-06', total: 3, accepted: 1, rejected: 2, other: 0 },
      { packageNo: '2026/02', date: '2026-03-10', total: 2, accepted: 1, rejected: 0, other: 1 },
    ])
  })
  it('konuları ret oranıyla birlikte sıralar', () => {
    expect(report.topics[0]).toEqual({ topic: 'KASİS', total: 3, accepted: 1, rejected: 2, rejectionRate: 66.7 })
  })
  it('özet cümlelerini Türkçe yüzde biçimiyle ve eksiz yazar', () => {
    expect(report.highlights[0]).toBe('2026 yılında İl Trafik Komisyonu 2 toplantıda toplam 5 karar almıştır.')
    expect(report.highlights[1]).toContain('%40 oranında kabul')
    expect(report.highlights.join(' ')).toContain('KASİS olup bu konudaki 3 talepten 2 tanesi (%66,7) reddedilmiştir.')
  })
  it('uygulama durumunu yalnızca uygulama gerektiren kararlar için sayar', () => {
    expect(report.implementation.required).toBe(3)
    expect(report.implementation.byStatus.map(row => [row.label, row.count])).toEqual([['Tamamlandı', 1], ['Devam ediyor', 1], ['Hiç başlamamış', 1]])
  })
  it('rapor yıllarını yeniden eskiye listeler', () => {
    expect(availableReportYears(decisions)).toEqual([2026, 2025])
  })
})
