export type DecisionResult = 'accepted' | 'rejected' | 'partial' | 'conditional' | 'postponed' | 'other'
export type ApplicationStatus = 'not_started' | 'in_progress' | 'partial' | 'completed' | 'not_required'

export interface Decision {
  id: string
  packageNo: string
  itemNo: string
  date: string
  title: string
  proposal: string
  decisionText: string
  summary?: string
  result: DecisionResult
  conditions?: string
  scope: string
  neighborhood?: string
  locations: string[]
  responsibleUnits?: string[]
  responsibleUnit?: string
  applicationStatus?: ApplicationStatus
  sourceReference?: string
  version?: number
}

export interface Task {
  id: string
  decisionId: string
  title: string
  unit: string
  assigneeId?: string | null
  assigneeName?: string
  status: 'planned' | 'in_progress' | 'waiting_reply' | 'waiting_approval' | 'completed' | 'cancelled'
  dueDate?: string
  actualStartDate?: string
  actualEndDate?: string
  waitingReason?: string
  nextAction?: string
  completionDescription?: string
  cancellationReason?: string
  priority: 'low' | 'normal' | 'high'
  version?: number
}

export interface Correspondence {
  id: string
  decisionId: string
  taskId?: string
  direction: 'incoming' | 'outgoing'
  status: 'draft' | 'sent' | 'received'
  documentNo: string
  date: string
  subject: string
  unit: string
  replyExpected: boolean
  sentAt?: string
  version?: number
}

export interface DocumentRecord {
  id: string
  decisionId?: string
  name: string
  path?: string
  uploadedAt?: string
  simulated?: boolean
}

export const resultLabels: Record<DecisionResult, string> = {
  accepted: 'Kabul Edildi', rejected: 'Reddedildi', partial: 'Kısmen Kabul Edildi',
  conditional: 'Şartlı Kabul Edildi', postponed: 'Ertelendi', other: 'Diğer',
}

export const statusLabels: Record<ApplicationStatus, string> = {
  not_started: 'Hiç başlamamış', in_progress: 'Devam ediyor', partial: 'Kısmen tamamlandı',
  completed: 'Tamamlandı', not_required: 'Uygulama gerektirmiyor',
}
