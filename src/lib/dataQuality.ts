import type { Decision } from '../types'

export type DataQualityIssue = 'scope' | 'location' | 'neighborhood'

export interface DataQualityGroup {
  issue: DataQualityIssue
  title: string
  note: string
  decisions: Decision[]
}

/** Formdaki varsayılan seçenek; değiştirilmeden kaydedilen kararlarda kapsam belirsiz kalır. */
export const pendingScope = 'Değerlendirme bekliyor'

/** Düzeltilmesi gereken eksik bilgileri gruplar. Boş gruplar listelenmez. */
export function findDataQualityIssues(decisions: Decision[]): DataQualityGroup[] {
  const newestFirst = (items: Decision[]) => [...items].sort((a, b) => b.date.localeCompare(a.date) || b.packageNo.localeCompare(a.packageNo, 'tr', { numeric: true }) || (Number(b.itemNo) || 0) - (Number(a.itemNo) || 0))
  const groups: DataQualityGroup[] = [
    {
      issue: 'scope',
      title: 'Müdürlük ilgisi belirlenmemiş',
      note: 'Kapsam "Değerlendirme bekliyor" olarak kalmış. Reddedilen kararlar hariç.',
      decisions: decisions.filter(decision => decision.result !== 'rejected' && decision.scope === pendingScope),
    },
    {
      issue: 'location',
      title: 'Konum girilmemiş',
      note: 'Bu kararlar konum karar geçmişinde görünmüyor.',
      decisions: decisions.filter(decision => !decision.locations.length),
    },
    {
      issue: 'neighborhood',
      title: 'Mahalle girilmemiş',
      note: 'İl geneli kararlar için mahalle gerekmeyebilir.',
      decisions: decisions.filter(decision => !decision.neighborhood),
    },
  ]
  return groups.filter(group => group.decisions.length > 0).map(group => ({ ...group, decisions: newestFirst(group.decisions) }))
}
