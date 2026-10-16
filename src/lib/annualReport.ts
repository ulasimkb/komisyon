import type { ApplicationStatus, Decision, DecisionResult, Task } from '../types'
import { resultLabels } from '../types'
import { decisionNeedsImplementation, isOverdue } from './businessRules'
import { normalizeResponsibleUnits } from './municipalUnits'
import { formatPercent, percentOf } from './numberFormatting'

export interface CountRow { label: string; count: number; share: number }
export interface MeetingRow { packageNo: string; date: string; total: number; accepted: number; rejected: number; other: number }
export interface TopicRow { topic: string; total: number; accepted: number; rejected: number; rejectionRate: number }

export interface AnnualReport {
  year: number
  periodStart: string
  periodEnd: string
  decisionCount: number
  meetingCount: number
  results: CountRow[]
  meetings: MeetingRow[]
  topics: TopicRow[]
  neighborhoods: CountRow[]
  units: CountRow[]
  implementation: { required: number; byStatus: CountRow[] }
  tasks: { total: number; completed: number; open: number; overdue: number }
  highlights: string[]
}

const TOPIC_LIMIT = 12
const NEIGHBORHOOD_LIMIT = 10
const resultOrder: DecisionResult[] = ['accepted', 'conditional', 'partial', 'rejected', 'postponed', 'other']
const implementationOrder: ApplicationStatus[] = ['completed', 'partial', 'in_progress', 'not_started']
const implementationLabels: Record<ApplicationStatus, string> = {
  completed: 'Tamamlandı', partial: 'Kısmen tamamlandı', in_progress: 'Devam ediyor', not_started: 'Hiç başlamamış', not_required: 'Uygulama gerektirmiyor',
}

const isAccepted = (result: DecisionResult) => result === 'accepted' || result === 'partial' || result === 'conditional'
const topicOf = (decision: Decision) => decision.title?.trim() || 'BELİRTİLMEMİŞ'
const yearOf = (date: string) => Number(date.slice(0, 4))

function countRows(labels: string[], total: number): CountRow[] {
  const counts = new Map<string, number>()
  labels.forEach(label => counts.set(label, (counts.get(label) || 0) + 1))
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: percentOf(count, total) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'))
}

/** Kararların bulunduğu yıllar, yeniden eskiye. */
export function availableReportYears(decisions: Decision[]): number[] {
  return [...new Set(decisions.map(decision => yearOf(decision.date)).filter(year => year >= 2000 && year <= 2099))].sort((a, b) => b - a)
}

export function buildAnnualReport(allDecisions: Decision[], allTasks: Task[], year: number, today = new Date()): AnnualReport {
  const decisions = allDecisions.filter(decision => yearOf(decision.date) === year)
  const decisionIds = new Set(decisions.map(decision => decision.id))
  const tasks = allTasks.filter(task => decisionIds.has(task.decisionId))
  const total = decisions.length
  const todayValue = today.toISOString().slice(0, 10)
  const periodEnd = `${year}-12-31` < todayValue ? `${year}-12-31` : todayValue

  const results = resultOrder
    .map(result => ({ label: resultLabels[result], count: decisions.filter(d => d.result === result).length }))
    .filter(row => row.count > 0)
    .map(row => ({ ...row, share: percentOf(row.count, total) }))

  const packages = new Map<string, Decision[]>()
  decisions.forEach(decision => packages.set(decision.packageNo, [...(packages.get(decision.packageNo) || []), decision]))
  const meetings = [...packages.entries()]
    .map(([packageNo, items]) => ({
      packageNo,
      date: items.map(item => item.date).sort()[0],
      total: items.length,
      accepted: items.filter(item => isAccepted(item.result)).length,
      rejected: items.filter(item => item.result === 'rejected').length,
      other: items.filter(item => !isAccepted(item.result) && item.result !== 'rejected').length,
    }))
    .sort((a, b) => a.packageNo.localeCompare(b.packageNo, 'tr', { numeric: true }))

  const topicGroups = new Map<string, Decision[]>()
  decisions.forEach(decision => topicGroups.set(topicOf(decision), [...(topicGroups.get(topicOf(decision)) || []), decision]))
  const toTopicRow = (topic: string, items: Decision[]): TopicRow => {
    const rejected = items.filter(item => item.result === 'rejected').length
    return { topic, total: items.length, accepted: items.filter(item => isAccepted(item.result)).length, rejected, rejectionRate: percentOf(rejected, items.length) }
  }
  const sortedTopics = [...topicGroups.entries()].map(([topic, items]) => toTopicRow(topic, items))
    .sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic, 'tr'))
  const topics = sortedTopics.length > TOPIC_LIMIT
    ? [...sortedTopics.slice(0, TOPIC_LIMIT - 1), toTopicRow(`DİĞER KONULAR (${sortedTopics.length - TOPIC_LIMIT + 1})`,
        sortedTopics.slice(TOPIC_LIMIT - 1).flatMap(row => topicGroups.get(row.topic) || []))]
    : sortedTopics

  const neighborhoods = countRows(decisions.map(decision => decision.neighborhood ? `${decision.neighborhood} Mahallesi` : 'İl geneli / belirtilmemiş'), total)
    .slice(0, NEIGHBORHOOD_LIMIT)

  const unitDecisions = decisions.filter(decision => decision.result !== 'rejected')
  const units = countRows(unitDecisions.flatMap(decision => normalizeResponsibleUnits(decision.responsibleUnits, decision.responsibleUnit)), unitDecisions.length)

  const requiringImplementation = decisions.filter(decisionNeedsImplementation)
  const byStatus = implementationOrder
    .map(status => ({ label: implementationLabels[status], count: requiringImplementation.filter(d => (d.applicationStatus || 'not_started') === status).length }))
    .filter(row => row.count > 0)
    .map(row => ({ ...row, share: percentOf(row.count, requiringImplementation.length) }))

  const taskSummary = {
    total: tasks.length,
    completed: tasks.filter(task => task.status === 'completed').length,
    open: tasks.filter(task => !['completed', 'cancelled'].includes(task.status)).length,
    overdue: tasks.filter(task => isOverdue(task, today)).length,
  }

  const highlights: string[] = []
  if (total) {
    const acceptedCount = decisions.filter(d => isAccepted(d.result)).length
    const rejectedCount = decisions.filter(d => d.result === 'rejected').length
    highlights.push(`${year} yılında İl Trafik Komisyonu ${meetings.length} toplantıda toplam ${total} karar almıştır.`)
    highlights.push(`Kararlar ${formatPercent(percentOf(acceptedCount, total))} oranında kabul (kısmen ve şartlı kabul dahil), ${formatPercent(percentOf(rejectedCount, total))} oranında ret ile sonuçlanmıştır.`)
    const topTopic = sortedTopics[0]
    highlights.push(`En sık görüşülen konu ${topTopic.topic} olmuştur (${topTopic.total} karar).`)
    const mostRejected = sortedTopics.filter(row => row.total >= 3 && row.rejected > 0).sort((a, b) => b.rejectionRate - a.rejectionRate || b.total - a.total)[0]
    if (mostRejected) highlights.push(`Ret oranı en yüksek konu ${mostRejected.topic} olup bu konudaki ${mostRejected.total} talepten ${mostRejected.rejected} tanesi (${formatPercent(mostRejected.rejectionRate)}) reddedilmiştir.`)
    const topNeighborhood = neighborhoods.find(row => !row.label.startsWith('İl geneli'))
    if (topNeighborhood) highlights.push(`En çok karar alınan yer ${topNeighborhood.label} olmuştur (${topNeighborhood.count} karar).`)
    if (requiringImplementation.length) {
      const completed = requiringImplementation.filter(d => d.applicationStatus === 'completed').length
      const notStarted = requiringImplementation.filter(d => (d.applicationStatus || 'not_started') === 'not_started').length
      highlights.push(`Uygulama gerektiren ${requiringImplementation.length} karardan ${completed} tanesi tamamlanmış, ${notStarted} tanesi için henüz uygulamaya başlanmamıştır.`)
    }
  }

  return {
    year, periodStart: `${year}-01-01`, periodEnd, decisionCount: total, meetingCount: meetings.length,
    results, meetings, topics, neighborhoods, units,
    implementation: { required: requiringImplementation.length, byStatus },
    tasks: taskSummary, highlights,
  }
}
