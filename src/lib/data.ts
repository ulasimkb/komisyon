import { demoCorrespondence, demoDecisions, demoTasks } from '../demoData'
import type { Correspondence, Decision, DocumentRecord, Task } from '../types'
import { decisionNeedsImplementation, deriveApplicationStatus, validateTaskForStatus } from './businessRules'
import { normalizeResponsibleUnits } from './municipalUnits'
import { demoMode, supabase } from './supabase'

// Anahtar sürümü değiştiğinde daha önce tarayıcıda saklanan örnek kayıtlar yeniden yüklenmez.
const keys = { decisions: 'itk-demo-v2-decisions', tasks: 'itk-demo-v2-tasks', correspondence: 'itk-demo-v2-correspondence', documents: 'itk-demo-v2-documents' }
const demoDocumentDatabase = 'itk-demo-document-files'

function openDemoDocumentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(demoDocumentDatabase, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files') }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Yerel belge deposu açılamadı.'))
  })
}

async function writeDemoDocument(id: string, file: File): Promise<void> {
  const database = await openDemoDocumentDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite')
    transaction.objectStore('files').put(file, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error('Belge yerel depoya kaydedilemedi.'))
  })
  database.close()
}

async function readDemoDocument(id: string): Promise<Blob | undefined> {
  const database = await openDemoDocumentDatabase()
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction('files', 'readonly').objectStore('files').get(id)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(new Error('Belge yerel depodan okunamadı.'))
  })
  database.close()
  return file
}

function localRead<T>(key: string, initial: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) { localStorage.setItem(key, JSON.stringify(initial)); return initial }
  return JSON.parse(raw) as T
}

function localWrite<T>(key: string, value: T): void { localStorage.setItem(key, JSON.stringify(value)) }

export async function loadData() {
  if (demoMode) {
    const tasks = localRead<Task[]>(keys.tasks, demoTasks)
    const decisions = localRead<Decision[]>(keys.decisions, demoDecisions).map(decision => ({
      ...decision,
      responsibleUnits: decision.result === 'rejected' ? [] : normalizeResponsibleUnits(decision.responsibleUnits, decision.responsibleUnit),
      applicationStatus: deriveApplicationStatus(decision.result, tasks.filter(task => task.decisionId === decision.id), decision.scope),
    }))
    localWrite(keys.decisions, decisions)
    return { decisions, tasks, correspondence: localRead<Correspondence[]>(keys.correspondence, demoCorrespondence), documents: localRead<DocumentRecord[]>(keys.documents, []) }
  }
  if (!supabase) throw new Error('Supabase bağlantı anahtarı yapılandırılmamış.')
  const [d, t, c, docs] = await Promise.all([
    supabase.from('decisions').select('*, decision_locations(locations(name))').order('decision_date', { ascending: false }),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('correspondence').select('*').order('document_date', { ascending: false }),
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
  ])
  if (d.error || t.error || c.error || docs.error) throw d.error || t.error || c.error || docs.error
  return {
    decisions: (d.data || []).map((x: any): Decision => ({
      id: x.id, packageNo: x.package_no, itemNo: x.item_no, date: x.decision_date, title: x.title,
      proposal: x.proposal_text || '', decisionText: x.decision_text, summary: x.summary || undefined, result: x.result,
      conditions: x.conditions || undefined, scope: x.scope, neighborhood: x.neighborhood_name || undefined,
      locations: x.decision_locations?.map((l: any) => l.locations?.name).filter(Boolean) || [],
      responsibleUnits: normalizeResponsibleUnits(x.responsible_unit_names, x.responsible_unit_name),
      responsibleUnit: x.responsible_unit_name || undefined, applicationStatus: x.application_status || undefined,
      sourceReference: x.source_reference || undefined, version: x.version,
    })),
    tasks: (t.data || []).map((x: any) => ({ id: x.id, decisionId: x.decision_id, title: x.title, unit: x.responsible_unit_name, assigneeName: x.assigned_person_name || undefined, status: x.status, dueDate: x.target_end_date || undefined, actualStartDate: x.actual_start_date || undefined, actualEndDate: x.actual_end_date || undefined, waitingReason: x.waiting_reason || undefined, nextAction: x.next_action || undefined, completionDescription: x.completion_description || undefined, cancellationReason: x.cancellation_reason || undefined, priority: x.priority, version: x.version })),
    correspondence: (c.data || []).map((x: any) => ({ id: x.id, decisionId: x.decision_id, taskId: x.task_id || undefined, direction: x.direction, status: x.status, documentNo: x.document_no || '', date: x.document_date, subject: x.subject, unit: x.counterparty_unit, replyExpected: x.reply_expected, sentAt: x.sent_at || undefined, version: x.version })),
    documents: (docs.data || []).map((x: any): DocumentRecord => ({ id: x.id, decisionId: x.decision_id || undefined, name: x.original_name, path: x.storage_path, uploadedAt: x.created_at })),
  }
}

export async function createDecision(input: Omit<Decision, 'id'>): Promise<Decision> {
  const responsibleUnits = input.result === 'rejected' ? [] : normalizeResponsibleUnits(input.responsibleUnits, input.responsibleUnit)
  if (demoMode) {
    const next = { ...input, responsibleUnits, responsibleUnit: responsibleUnits[0], applicationStatus: deriveApplicationStatus(input.result, [], input.scope), id: crypto.randomUUID() }
    localWrite(keys.decisions, [next, ...localRead<Decision[]>(keys.decisions, demoDecisions)])
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const { data, error } = await supabase.rpc('save_decision_with_locations', {
    p_id: null, p_expected_version: null, p_package_no: input.packageNo, p_item_no: input.itemNo,
    p_decision_date: input.date, p_title: input.title, p_proposal_text: input.proposal, p_decision_text: input.decisionText,
    p_result: input.result, p_conditions: input.conditions || null, p_scope: input.scope, p_neighborhood_name: input.neighborhood || null,
    p_responsible_unit_names: responsibleUnits, p_locations: input.locations,
  }).single()
  if (error) throw error
  const saved = data as unknown as { id: string; version: number }
  return { ...input, responsibleUnits, responsibleUnit: responsibleUnits[0], applicationStatus: deriveApplicationStatus(input.result, [], input.scope), id: saved.id, version: saved.version }
}

export async function updateDecision(input: Decision): Promise<Decision> {
  const responsibleUnits = input.result === 'rejected' ? [] : normalizeResponsibleUnits(input.responsibleUnits, input.responsibleUnit)
  if (demoMode) {
    const currentTasks = localRead<Task[]>(keys.tasks, demoTasks)
    if (['Bilgi amaçlı', 'Görev alanı dışında'].includes(input.scope) && currentTasks.some(task => task.decisionId === input.id && !['completed', 'cancelled'].includes(task.status))) {
      throw new Error('Aktif görevi bulunan karar uygulama gerektirmeyen kapsama alınamaz.')
    }
    const relatedTasks = currentTasks.filter(task => task.decisionId === input.id)
    if (input.result !== 'rejected') {
      const incompatibleTask = relatedTasks.find(task => task.status !== 'cancelled' && !responsibleUnits.includes(task.unit))
      if (incompatibleTask) throw new Error(`${incompatibleTask.unit} müdürlüğüne bağlı görev bulunduğu için bu müdürlük karardan çıkarılamaz.`)
    }
    const updatedTasks = input.result === 'rejected'
      ? currentTasks.map(task => task.decisionId === input.id && !['completed', 'cancelled'].includes(task.status)
        ? { ...task, status: 'cancelled' as const, cancellationReason: task.cancellationReason || 'Karar sonucu Reddedildi olarak düzeltildi.', version: (task.version || 1) + 1 }
        : task)
      : currentTasks
    if (input.result === 'rejected') localWrite(keys.tasks, updatedTasks)
    const next = { ...input, responsibleUnits, responsibleUnit: responsibleUnits[0], applicationStatus: deriveApplicationStatus(input.result, updatedTasks.filter(task => task.decisionId === input.id), input.scope), version: (input.version || 1) + 1 }
    localWrite(keys.decisions, localRead<Decision[]>(keys.decisions, demoDecisions).map(decision => decision.id === input.id ? next : decision))
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const { data, error } = await supabase.rpc('save_decision_with_locations', {
    p_id: input.id, p_expected_version: input.version || null, p_package_no: input.packageNo, p_item_no: input.itemNo,
    p_decision_date: input.date, p_title: input.title, p_proposal_text: input.proposal, p_decision_text: input.decisionText,
    p_result: input.result, p_conditions: input.conditions || null, p_scope: input.scope, p_neighborhood_name: input.neighborhood || null,
    p_responsible_unit_names: responsibleUnits, p_locations: input.locations,
  }).single()
  if (error) throw error
  const saved = data as unknown as { id: string; version: number }
  return { ...input, responsibleUnits, responsibleUnit: responsibleUnits[0], version: saved.version }
}

export async function deleteDecision(input: Decision): Promise<void> {
  if (demoMode) {
    const relatedTaskIds = new Set(localRead<Task[]>(keys.tasks, demoTasks).filter(task => task.decisionId === input.id).map(task => task.id))
    localWrite(keys.decisions, localRead<Decision[]>(keys.decisions, demoDecisions).filter(decision => decision.id !== input.id))
    localWrite(keys.tasks, localRead<Task[]>(keys.tasks, demoTasks).filter(task => task.decisionId !== input.id))
    localWrite(keys.correspondence, localRead<Correspondence[]>(keys.correspondence, demoCorrespondence).filter(item => item.decisionId !== input.id && !relatedTaskIds.has(item.taskId || '')))
    localWrite(keys.documents, localRead<DocumentRecord[]>(keys.documents, []).map(document => document.decisionId === input.id ? { ...document, decisionId: undefined } : document))
    return
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  let query = supabase.from('decisions').delete().eq('id', input.id)
  if (input.version) query = query.eq('version', input.version)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Karar silinemedi. Kayıt başka bir kullanıcı tarafından değiştirilmiş veya zaten silinmiş olabilir.')
}

export async function createTask(input: Omit<Task, 'id'>): Promise<Task> {
  const validationError = validateTaskForStatus(input)
  if (validationError) throw new Error(validationError)
  if (demoMode) {
    const decisions = localRead<Decision[]>(keys.decisions, demoDecisions)
    const decision = decisions.find(d => d.id === input.decisionId)
    if (!decision || !decisionNeedsImplementation(decision)) throw new Error('Bu karar uygulama görevi gerektirmiyor.')
    if (!normalizeResponsibleUnits(decision.responsibleUnits, decision.responsibleUnit).includes(input.unit)) throw new Error('Görev müdürlüğü, kararın sorumlu müdürlüklerinden biri olmalıdır.')
    const currentTasks = localRead<Task[]>(keys.tasks, demoTasks)
    if (currentTasks.some(task => task.decisionId === input.decisionId && task.unit.trim().toLocaleLowerCase('tr-TR') === input.unit.trim().toLocaleLowerCase('tr-TR'))) throw new Error('Bu karar ve müdürlük için daha önce görev atanmış.')
    const next = { ...input, id: crypto.randomUUID() }
    const updatedTasks = [next, ...currentTasks]
    localWrite(keys.tasks, updatedTasks)
    localWrite(keys.decisions, decisions.map(item => item.id === decision.id
      ? { ...item, applicationStatus: deriveApplicationStatus(item.result, updatedTasks.filter(task => task.decisionId === item.id), item.scope) }
      : item))
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const { data, error } = await supabase.from('tasks').insert({ decision_id: input.decisionId, title: input.title, responsible_unit_name: input.unit, assigned_person_name: input.assigneeName || null, status: input.status, target_end_date: input.dueDate || null, actual_start_date: input.actualStartDate || null, actual_end_date: input.actualEndDate || null, waiting_reason: input.waitingReason || null, next_action: input.nextAction || null, completion_description: input.completionDescription || null, cancellation_reason: input.cancellationReason || null, priority: input.priority }).select('id').single()
  if (error) throw error
  return { ...input, id: data.id }
}

export async function updateTask(input: Task): Promise<Task> {
  const validationError = validateTaskForStatus(input)
  if (validationError) throw new Error(validationError)
  if (demoMode) {
    const currentTasks = localRead<Task[]>(keys.tasks, demoTasks)
    const decision = localRead<Decision[]>(keys.decisions, demoDecisions).find(item => item.id === input.decisionId)
    if (!decision || !normalizeResponsibleUnits(decision.responsibleUnits, decision.responsibleUnit).includes(input.unit)) throw new Error('Görev müdürlüğü, kararın sorumlu müdürlüklerinden biri olmalıdır.')
    const next = { ...input, version: (input.version || 1) + 1 }
    const updatedTasks = currentTasks.map(task => task.id === input.id ? next : task)
    localWrite(keys.tasks, updatedTasks)

    const currentDecisions = localRead<Decision[]>(keys.decisions, demoDecisions)
    const updatedDecisions = currentDecisions.map(decision => decision.id === input.decisionId
      ? { ...decision, applicationStatus: deriveApplicationStatus(decision.result, updatedTasks.filter(task => task.decisionId === decision.id), decision.scope) }
      : decision)
    localWrite(keys.decisions, updatedDecisions)
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const payload = {
    status: input.status,
    responsible_unit_name: input.unit,
    assigned_person_name: input.assigneeName || null,
    target_end_date: input.dueDate || null,
    actual_start_date: input.actualStartDate || null,
    actual_end_date: input.actualEndDate || null,
    waiting_reason: input.waitingReason || null,
    next_action: input.nextAction || null,
    completion_description: input.completionDescription || null,
    cancellation_reason: input.cancellationReason || null,
    priority: input.priority,
    version: (input.version || 1) + 1,
    updated_at: new Date().toISOString(),
  }
  let query = supabase.from('tasks').update(payload).eq('id', input.id)
  if (input.version) query = query.eq('version', input.version)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Görev başka bir kullanıcı tarafından değiştirildi. Güncel kaydı açıp tekrar deneyin.')
  return { ...input, version: payload.version }
}

export async function createCorrespondence(input: Omit<Correspondence, 'id'>): Promise<Correspondence> {
  if (input.status === 'sent' && !input.documentNo.trim()) throw new Error('Gönderilen yazışma için evrak sayısı zorunludur.')
  if (demoMode) {
    const next = { ...input, id: crypto.randomUUID() }
    localWrite(keys.correspondence, [next, ...localRead<Correspondence[]>(keys.correspondence, demoCorrespondence)])
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const { data, error } = await supabase.from('correspondence').insert({ decision_id: input.decisionId, task_id: input.taskId || null, direction: input.direction, status: input.status, document_no: input.documentNo || null, document_date: input.date, subject: input.subject, counterparty_unit: input.unit, reply_expected: input.replyExpected, sent_at: input.status === 'sent' ? new Date().toISOString() : null }).select('id').single()
  if (error) throw error
  return { ...input, id: data.id }
}

export async function updateCorrespondence(input: Correspondence): Promise<Correspondence> {
  if (input.status === 'sent' && !input.documentNo.trim()) throw new Error('Gönderilen yazışma için evrak sayısı zorunludur.')
  if (demoMode) {
    const next = { ...input, version: (input.version || 1) + 1 }
    localWrite(keys.correspondence, localRead<Correspondence[]>(keys.correspondence, demoCorrespondence).map(item => item.id === input.id ? next : item))
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const payload = { decision_id: input.decisionId, task_id: input.taskId || null, direction: input.direction, status: input.status, document_no: input.documentNo || null, document_date: input.date, subject: input.subject, counterparty_unit: input.unit, reply_expected: input.replyExpected, sent_at: input.status === 'sent' ? input.sentAt || new Date().toISOString() : null, version: (input.version || 1) + 1 }
  let query = supabase.from('correspondence').update(payload).eq('id', input.id)
  if (input.version) query = query.eq('version', input.version)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Yazışma başka bir kullanıcı tarafından değiştirildi. Güncel kaydı açıp tekrar deneyin.')
  return { ...input, version: payload.version }
}

export async function uploadDocument(file: File, decisionId?: string) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'kmz'].includes(ext || '')) throw new Error('Yalnızca PDF, DOCX, JPG, PNG ve KMZ dosyaları yüklenebilir.')
  if (!file.size) throw new Error('Boş dosya yüklenemez.')
  if (file.size > 25 * 1024 * 1024) throw new Error('Dosya boyutu 25 MB sınırını aşıyor.')
  if (demoMode) {
    const id = crypto.randomUUID()
    await writeDemoDocument(id, file)
    const next: DocumentRecord = { id, decisionId, name: file.name, path: `demo:${id}`, simulated: true, uploadedAt: new Date().toISOString() }
    localWrite(keys.documents, [next, ...localRead<DocumentRecord[]>(keys.documents, [])])
    return next
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const path = `${decisionId || 'imports'}/${crypto.randomUUID()}.${ext}`
  const contentType = ext === 'kmz' ? 'application/vnd.google-earth.kmz' : file.type
  const { error } = await supabase.storage.from('commission-documents').upload(path, file, { upsert: false, contentType })
  if (error) throw error
  const { data: record, error: recordError } = await supabase.from('documents').insert({ decision_id: decisionId || null, storage_path: path, original_name: file.name, mime_type: contentType, size_bytes: file.size }).select('id,created_at').single()
  if (recordError) throw recordError
  return { id: record.id, decisionId, name: file.name, path, uploadedAt: record.created_at } as DocumentRecord
}

export async function getDocumentUrl(path: string): Promise<string> {
  if (demoMode) {
    const id = path.startsWith('demo:') ? path.slice(5) : ''
    if (!id) throw new Error('Bu demo kaydında dosya içeriği bulunmuyor.')
    const file = await readDemoDocument(id)
    if (!file) throw new Error('Belge yerel depoda bulunamadı. Belgeyi yeniden yükleyin.')
    return URL.createObjectURL(file)
  }
  if (!supabase) throw new Error('Supabase yapılandırılmamış.')
  const { data, error } = await supabase.storage.from('commission-documents').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}
