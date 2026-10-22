import { describe, expect, it } from 'vitest'
import { findDataQualityIssues } from './dataQuality'
import type { Decision } from '../types'

const decision = (id: string, extra: Partial<Decision> = {}): Decision => ({
  id, packageNo: '2026/01', itemNo: id, date: '2026-01-06', title: 'KASİS', proposal: '', decisionText: '', result: 'accepted',
  scope: 'Doğrudan görev', neighborhood: 'Cumhuriyet', locations: ['Atatürk Bulvarı'], ...extra,
})

describe('eksik bilgiler', () => {
  it('eksiksiz kararlarda grup döndürmez', () => {
    expect(findDataQualityIssues([decision('1')])).toEqual([])
  })
  it('belirsiz kapsamı reddedilen kararlarda saymaz', () => {
    const groups = findDataQualityIssues([
      decision('1', { scope: 'Değerlendirme bekliyor' }),
      decision('2', { scope: 'Değerlendirme bekliyor', result: 'rejected' }),
    ])
    expect(groups.map(group => [group.issue, group.decisions.map(d => d.id)])).toEqual([['scope', ['1']]])
  })
  it('konum ve mahalle eksiğini reddedilen kararlarda da sayar', () => {
    const groups = findDataQualityIssues([decision('1', { locations: [], neighborhood: undefined, result: 'rejected' })])
    expect(groups.map(group => group.issue)).toEqual(['location', 'neighborhood'])
  })
  it('kararları yeniden eskiye sıralar', () => {
    const [group] = findDataQualityIssues([
      decision('1', { locations: [], date: '2026-01-06' }),
      decision('2', { locations: [], date: '2026-03-10' }),
    ])
    expect(group.decisions.map(d => d.id)).toEqual(['2', '1'])
  })
})
