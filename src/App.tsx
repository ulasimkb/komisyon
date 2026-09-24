import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BarChart3, Bell, Building2, CalendarDays, CheckCircle2, ChevronDown,
  Clock3, FileInput, FileSpreadsheet, FileText, Filter, History, Inbox,
  LayoutDashboard, ListChecks, Loader2, LogOut, MapPin, Menu, Pencil, PieChart, Plus, Printer, Search, Settings,
  ShieldCheck, Trash2, TriangleAlert, Upload, UserRound, Users, X, XCircle,
} from 'lucide-react'
import { createCorrespondence, createDecision, createTask, deleteDecision, getDocumentUrl, listAssignableProfiles, loadData, updateCorrespondence, updateDecision, updateTask, uploadDocument } from './lib/data'
import type { AssignableProfile } from './lib/data'
import { decisionNeedsImplementation, isOverdue } from './lib/businessRules'
import { formatLocationText, parseLocations } from './lib/locationFormatting'
import { municipalDirectorates, normalizeResponsibleUnits } from './lib/municipalUnits'
import { kutahyaNeighborhoods } from './lib/neighborhoods'
import { findSubjectTitleSuggestions, formatSubjectTitle } from './lib/subjectFormatting'
import { demoMode, isConfigured, supabase } from './lib/supabase'
import type { ApplicationStatus, Correspondence, Decision, DecisionResult, DocumentRecord, Task } from './types'
import { resultLabels, statusLabels } from './types'

type Page = 'dashboard' | 'packages' | 'decisions' | 'locations' | 'tasks' | 'units' | 'correspondence' | 'imports' | 'reports' | 'settings'
type TaskFilters = { unit: string; person: string; status: string; overdue: boolean }
type AppRole = 'admin' | 'coordinator' | 'staff' | 'controller' | 'viewer' | 'unassigned'

const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'packages', label: 'Toplantılar ve Karar Paketleri', icon: Archive },
  { id: 'decisions', label: 'Kararlar', icon: FileText },
  { id: 'locations', label: 'Konumlar ve Karar Geçmişi', icon: MapPin },
  { id: 'tasks', label: 'Görevlerim', icon: ListChecks },
  { id: 'units', label: 'Müdürlükler Arası Takip', icon: Building2 },
  { id: 'correspondence', label: 'Yazışmalar', icon: Inbox },
  { id: 'imports', label: 'Belge İçe Aktarma', icon: FileInput },
  { id: 'reports', label: 'Raporlar', icon: BarChart3 },
  { id: 'settings', label: 'Kullanıcılar ve Ayarlar', icon: Settings },
]

const taskLabels: Record<Task['status'], string> = {
  planned: 'Planlandı', in_progress: 'İşlemde', waiting_reply: 'Cevap bekleniyor', waiting_approval: 'Dış kurum onayı bekleniyor',
  completed: 'Tamamlandı', cancelled: 'Gerekçeyle iptal edildi',
}

const taskUnitOptions = [...municipalDirectorates, 'Diğer'] as const
const transportStaff = ['Fatma Nur YILDIRIM', 'Hasan COŞKUN', 'Azime ATAGÜN'] as const
type UnitChoice = typeof taskUnitOptions[number]

function initialUnitChoice(unit?: string): UnitChoice {
  return taskUnitOptions.includes(unit as UnitChoice) && unit !== 'Diğer' ? unit as UnitChoice : 'Diğer'
}

function getDecisionUnits(decision: Decision): string[] {
  return decision.result === 'rejected' ? [] : normalizeResponsibleUnits(decision.responsibleUnits, decision.responsibleUnit)
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

function optionalFormValue(form: FormData, name: string): string | undefined {
  const value = form.get(name)
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function readRole(session: { user?: { app_metadata?: Record<string, unknown> } } | null): AppRole {
  const role = session?.user?.app_metadata?.role
  return ['admin', 'coordinator', 'staff', 'controller', 'viewer'].includes(String(role)) ? role as AppRole : 'unassigned'
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selected, setSelected] = useState<Decision | null>(null)
  const [detailOrigin, setDetailOrigin] = useState<Page>('decisions')
  const [modal, setModal] = useState<'decision' | 'task' | 'correspondence' | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null)
  const [deletingDecision, setDeletingDecision] = useState<Decision | null>(null)
  const [editingCorrespondence, setEditingCorrespondence] = useState<Correspondence | null>(null)
  const [initialDecisionId, setInitialDecisionId] = useState<string | undefined>()
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({ unit: 'all', person: 'all', status: 'all', overdue: false })
  const [locationSelection, setLocationSelection] = useState('')
  const [correspondenceReplyOnly, setCorrespondenceReplyOnly] = useState(false)
  const [userRole, setUserRole] = useState<AppRole>(demoMode ? 'admin' : 'unassigned')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewingOfficialDoc, setViewingOfficialDoc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(demoMode)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    setLoading(true); setError('')
    try {
      const data = await loadData()
      setDecisions(data.decisions); setTasks(data.tasks); setCorrespondence(data.correspondence); setDocuments(data.documents)
      setSelected(current => current ? data.decisions.find(decision => decision.id === current.id) || null : null)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Veriler alınamadı.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (demoMode) { refresh(); return }
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSessionReady(Boolean(data.session)); setUserRole(readRole(data.session)); if (data.session && readRole(data.session) !== 'unassigned') refresh(); else setLoading(false) })
    return supabase.auth.onAuthStateChange((_event, session) => { setSessionReady(Boolean(session)); setUserRole(readRole(session)); if (session && readRole(session) !== 'unassigned') refresh() }).data.subscription.unsubscribe
  }, [])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr-TR') === 'k') {
        event.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR').replaceAll('ı', 'i')
    if (!q) return decisions
    const matchingDecisionIds = new Set([
      ...correspondence.filter(c => [c.documentNo, c.subject, c.unit].join(' ').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').includes(q)).map(c => c.decisionId),
      ...tasks.filter(task => [task.title, task.unit, task.assigneeName || '', task.waitingReason || '', task.nextAction || ''].join(' ').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').includes(q)).map(task => task.decisionId),
    ])
    return decisions.filter(d => matchingDecisionIds.has(d.id) || [d.packageNo, d.itemNo, d.title, d.proposal, d.summary || '', d.decisionText, d.neighborhood || '', ...d.locations, ...getDecisionUnits(d)]
      .join(' ').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').includes(q))
  }, [decisions, correspondence, tasks, query])

  const availableUnitsForDecision = (decision: Decision) => getDecisionUnits(decision).filter(unit => !tasks.some(task => task.decisionId === decision.id && task.unit.trim().toLocaleLowerCase('tr-TR') === unit.trim().toLocaleLowerCase('tr-TR')))
  const availableTaskDecisions = useMemo(
    () => decisions.filter(decision => decisionNeedsImplementation(decision) && availableUnitsForDecision(decision).length > 0),
    [decisions, tasks],
  )

  const canManageDecisions = ['admin', 'coordinator'].includes(userRole)
  const canCreateTasks = ['admin', 'coordinator', 'staff'].includes(userRole)
  const canUpdateTasks = ['admin', 'coordinator', 'staff'].includes(userRole)
  const canWriteCorrespondence = ['admin', 'coordinator', 'staff'].includes(userRole)
  const canUploadDocuments = ['admin', 'coordinator', 'staff'].includes(userRole)
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR').replaceAll('ı', 'i')
  const matchingTasks = normalizedQuery ? tasks.filter(task => [task.title, task.unit, task.assigneeName || ''].join(' ').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').includes(normalizedQuery)).slice(0, 5) : []
  const matchingCorrespondence = normalizedQuery ? correspondence.filter(item => [item.documentNo, item.subject, item.unit].join(' ').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').includes(normalizedQuery)).slice(0, 5) : []

  const openDecision = (decision: Decision) => { setDetailOrigin(page); setSelected(decision) }
  const openTaskForDecision = (decision: Decision) => {
    if (!canCreateTasks || !availableUnitsForDecision(decision).length) return
    setInitialDecisionId(decision.id); setModal('task')
  }
  const openCorrespondenceForDecision = (decision: Decision) => { setInitialDecisionId(decision.id); setModal('correspondence') }

  if (!demoMode && !isConfigured) return <SetupScreen />
  if (!sessionReady) return <LoginScreen />
  if (userRole === 'unassigned') return <div className="auth-page"><div className="auth-card"><h2>Erişim yetkisi tanımlanmamış</h2><p>Hesabınıza bir uygulama rolü atanması için yöneticinizle görüşün.</p><button className="secondary" onClick={() => supabase?.auth.signOut()}>Çıkış yap</button></div></div>

  const pageTitle = nav.find(n => n.id === page)?.label || ''
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-seal" src="/kutahya-belediyesi-amblemi.png" alt="Kütahya Belediyesi logosu" />
          <div><strong>Kütahya Belediyesi</strong><span>Ulaşım Hizmetleri Müdürlüğü</span></div>
          <button className="icon-button close-menu" onClick={() => setMobileMenu(false)} aria-label="Menüyü kapat"><X /></button>
        </div>
        <div className="product-name"><span>İl Trafik Komisyonu</span><strong>Karar Takip Sistemi</strong></div>
        <nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setSelected(null); setMobileMenu(false) }}><item.icon /><span>{item.label}</span></button>)}</nav>
        <div className="sidebar-user"><div className="avatar">UK</div><div><strong>{demoMode ? 'Ulaşım Koordinatörü' : 'Yetkili kullanıcı'}</strong><span>{demoMode ? 'Demo çalışma alanı' : `Rol: ${userRole}`}</span></div>{!demoMode && <button className="icon-button" onClick={() => supabase?.auth.signOut()} aria-label="Çıkış yap"><LogOut /></button>}</div>
        <div className="sidebar-copyright">
          <span>Uygulamanın tüm hakları</span>
          <span>Endüstri Yük. Mühendisi Emre ÖZEL'e aittir.</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Menüyü aç"><Menu /></button>
          <div className="global-search"><Search /><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)} placeholder="Karar, teklif, görev, kişi, konum veya evrak no ara…" /><kbd>Ctrl K</kbd>{searchOpen && normalizedQuery && <div className="search-results"><strong>Arama sonuçları</strong>{filtered.slice(0, 5).map(decision => <button key={`d-${decision.id}`} onMouseDown={() => { openDecision(decision); setSearchOpen(false) }}><FileText /><span><b>{decision.packageNo} / {decision.itemNo}</b>{decision.title}</span></button>)}{matchingTasks.map(task => <button key={`t-${task.id}`} onMouseDown={() => { const decision = decisions.find(item => item.id === task.decisionId); if (canUpdateTasks) setEditingTask(task); else if (decision) openDecision(decision); setSearchOpen(false) }}><ListChecks /><span><b>Görev</b>{task.title}</span></button>)}{matchingCorrespondence.map(item => <button key={`c-${item.id}`} onMouseDown={() => { const decision = decisions.find(row => row.id === item.decisionId); if (canWriteCorrespondence) setEditingCorrespondence(item); else if (decision) openDecision(decision); setSearchOpen(false) }}><Inbox /><span><b>{item.documentNo || 'Yazışma'}</b>{item.subject}</span></button>)}{!filtered.length && !matchingTasks.length && !matchingCorrespondence.length && <span className="search-empty">Eşleşen kayıt bulunamadı.</span>}</div>}</div>
          <div className="notification-wrap"><button className="icon-button notification" aria-label="Bildirimler" onClick={() => setNotificationsOpen(value => !value)}><Bell />{(tasks.some(task => isOverdue(task)) || correspondence.some(item => item.replyExpected)) && <span />}</button>{notificationsOpen && <div className="notification-panel"><strong>Takip bildirimleri</strong><button onClick={() => { setTaskFilters({ unit: 'all', person: 'all', status: 'all', overdue: true }); setPage('tasks'); setSelected(null); setNotificationsOpen(false) }}>{tasks.filter(task => isOverdue(task)).length} geciken görev</button><button onClick={() => { setCorrespondenceReplyOnly(true); setPage('correspondence'); setSelected(null); setNotificationsOpen(false) }}>{correspondence.filter(item => item.replyExpected).length} cevap bekleyen yazışma</button></div>}</div>
          {demoMode && <div className="demo-badge">Demo</div>}
        </header>
        <main>
          <div className="page-heading"><div>{selected && <button className="back" onClick={() => { setSelected(null); setPage(detailOrigin) }}><ArrowLeft /> {nav.find(item => item.id === detailOrigin)?.label || 'Kararlar'} alanına dön</button>}<h1>{selected ? `${selected.packageNo} / Karar ${selected.itemNo}` : pageTitle}</h1><p>{selected ? selected.title : pageSubtitle(page)}</p></div>
          {selected && (
            <div className="page-actions">
              <button className="secondary" onClick={() => setViewingOfficialDoc(true)} title="Resmî antetli karar tutanağını görüntüle ve PDF olarak yazdır">
                <Printer /> Resmî Tutanak (PDF)
              </button>
              {canManageDecisions && (
                <>
                  <button className="secondary" onClick={() => setEditingDecision(selected)}><Pencil /> Kararı düzenle</button>
                  <button className="danger" onClick={() => setDeletingDecision(selected)}><Trash2 /> Kararı sil</button>
                </>
              )}
            </div>
          )}
          {!selected && page === 'decisions' && canManageDecisions && <button className="primary" onClick={() => setModal('decision')}><Plus /> Yeni karar</button>}
          {!selected && page === 'tasks' && canCreateTasks && <button className="primary" onClick={() => setModal('task')}><Plus /> Yeni görev</button>}
          {!selected && page === 'correspondence' && canWriteCorrespondence && <button className="primary" onClick={() => setModal('correspondence')}><Plus /> Yazışma ekle</button>}</div>
          {error && <div className="alert error"><XCircle />{error}<button onClick={refresh}>Yeniden dene</button></div>}
          {loading ? <div className="loading"><Loader2 className="spin" /> Kayıtlar yükleniyor…</div> : selected ? <DecisionDetailView decision={selected} tasks={tasks.filter(t => t.decisionId === selected.id)} correspondence={correspondence.filter(c => c.decisionId === selected.id)} documents={documents.filter(document => document.decisionId === selected.id)} onAddTask={() => openTaskForDecision(selected)} onEditTask={setEditingTask} onAddCorrespondence={() => openCorrespondenceForDecision(selected)} onEditCorrespondence={setEditingCorrespondence} onDocumentsChanged={refresh} onViewOfficialDoc={() => setViewingOfficialDoc(true)} canAddTask={canCreateTasks && availableUnitsForDecision(selected).length > 0} canEditTask={canUpdateTasks} canWriteCorrespondence={canWriteCorrespondence} canUploadDocuments={canUploadDocuments} /> : (
            <PageContent page={page} decisions={filtered} allDecisions={decisions} tasks={tasks} correspondence={correspondence} documents={documents} onSelect={openDecision} onViewAllDecisions={() => { setPage('decisions'); setSelected(null) }} onNewDecision={() => setModal('decision')} onEditTask={setEditingTask} onEditCorrespondence={setEditingCorrespondence} taskFilters={taskFilters} onTaskFiltersChange={setTaskFilters} onViewUnitTasks={unit => { setTaskFilters({ unit, person: 'all', status: 'all', overdue: false }); setPage('tasks'); setSelected(null) }} onRefresh={refresh} locationSelection={locationSelection} onLocationSelectionChange={setLocationSelection} correspondenceReplyOnly={correspondenceReplyOnly} onCorrespondenceReplyOnlyChange={setCorrespondenceReplyOnly} canManageDecisions={canManageDecisions} canUpdateTasks={canUpdateTasks} canWriteCorrespondence={canWriteCorrespondence} canUploadDocuments={canUploadDocuments} />
          )}
        </main>
      </div>
      {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)} />}
      {modal === 'decision' && <DecisionCreateModal existingTitles={decisions.map(decision => decision.title)} onClose={() => setModal(null)} onSave={async d => { await createDecision(d); setModal(null); await refresh() }} />}
      {editingDecision && <DecisionEditModal decision={editingDecision} existingTitles={decisions.map(item => item.title)} onClose={() => setEditingDecision(null)} onSave={async d => { const updated = await updateDecision(d); setEditingDecision(null); setSelected(updated); await refresh() }} />}
      {deletingDecision && <DecisionDeleteModal decision={deletingDecision} taskCount={tasks.filter(task => task.decisionId === deletingDecision.id).length} correspondenceCount={correspondence.filter(item => item.decisionId === deletingDecision.id).length} documentCount={documents.filter(document => document.decisionId === deletingDecision.id).length} onClose={() => setDeletingDecision(null)} onDelete={async () => { await deleteDecision(deletingDecision); setDeletingDecision(null); setSelected(null); await refresh() }} />}
      {modal === 'task' && <TaskCreateModal decisions={availableTaskDecisions} tasks={tasks} role={userRole} initialDecisionId={initialDecisionId} onClose={() => { setModal(null); setInitialDecisionId(undefined) }} onSave={async t => { await createTask(t); setModal(null); setInitialDecisionId(undefined); await refresh() }} />}
      {modal === 'correspondence' && <CorrespondenceModal decisions={decisions} tasks={tasks} initialDecisionId={initialDecisionId} onClose={() => { setModal(null); setInitialDecisionId(undefined) }} onSave={async c => { await createCorrespondence(c); setModal(null); setInitialDecisionId(undefined); await refresh() }} />}
      {editingCorrespondence && <CorrespondenceModal decisions={decisions} tasks={tasks} correspondence={editingCorrespondence} onClose={() => setEditingCorrespondence(null)} onSave={async c => { await updateCorrespondence({ ...c, id: editingCorrespondence.id, sentAt: editingCorrespondence.sentAt, version: editingCorrespondence.version }); setEditingCorrespondence(null); await refresh() }} />}
      {editingTask && canUpdateTasks && <TaskStatusModal task={editingTask} role={userRole} decision={decisions.find(d => d.id === editingTask.decisionId)} onViewDecision={() => { const decision = decisions.find(d => d.id === editingTask.decisionId); setEditingTask(null); if (decision) openDecision(decision) }} onClose={() => setEditingTask(null)} onSave={async task => { await updateTask(task); setEditingTask(null); await refresh() }} />}
      {viewingOfficialDoc && selected && <OfficialDecisionModal decision={selected} tasks={tasks.filter(t => t.decisionId === selected.id)} onClose={() => setViewingOfficialDoc(false)} />}
    </div>
  )
}

function pageSubtitle(page: Page) {
  const map: Record<Page, string> = {
    dashboard: 'Kararların ve uygulama süreçlerinin güncel görünümü', packages: 'Toplantı, üst karar numarası ve kaynak belgeler',
    decisions: 'Komisyon kararlarını sonuç, konum ve uygulama durumuna göre izleyin', locations: 'Bir konumla ilgili tüm kararları geçmişiyle birlikte görün',
    tasks: 'Size ve biriminize atanan uygulama işlerini takip edin', units: 'Diğer müdürlüklerle yürütülen işleri ve beklemeleri yönetin',
    correspondence: 'Gelen ve giden resmî yazıları kararlarla ilişkilendirin', imports: 'Kaynak belgeleri güvenli biçimde yükleyin ve kayda bağlayın',
    reports: 'Yönetim ve operasyon raporlarını filtreleyin', settings: 'Kullanıcı, birim, rol ve tanımlı ad sözlükleri',
  }; return map[page]
}

function PageContent(props: { page: Page; decisions: Decision[]; allDecisions: Decision[]; tasks: Task[]; correspondence: Correspondence[]; documents: DocumentRecord[]; onSelect: (d: Decision) => void; onViewAllDecisions: () => void; onNewDecision: () => void; onEditTask: (t: Task) => void; onEditCorrespondence: (c: Correspondence) => void; taskFilters: TaskFilters; onTaskFiltersChange: (filters: TaskFilters) => void; onViewUnitTasks: (unit: string) => void; onRefresh: () => Promise<void>; locationSelection: string; onLocationSelectionChange: (value: string) => void; correspondenceReplyOnly: boolean; onCorrespondenceReplyOnlyChange: (value: boolean) => void; canManageDecisions: boolean; canUpdateTasks: boolean; canWriteCorrespondence: boolean; canUploadDocuments: boolean }) {
  switch (props.page) {
    case 'dashboard': return <Dashboard decisions={props.allDecisions} tasks={props.tasks} correspondence={props.correspondence} onSelect={props.onSelect} onViewAll={props.onViewAllDecisions} />
    case 'decisions': return <DecisionsTable decisions={props.decisions} onSelect={props.onSelect} onNew={props.canManageDecisions ? props.onNewDecision : undefined} />
    case 'packages': return <Packages decisions={props.allDecisions} onSelect={props.onSelect} />
    case 'locations': return <Locations decisions={props.decisions} onSelect={props.onSelect} selectedKey={props.locationSelection} onSelectedKeyChange={props.onLocationSelectionChange} />
    case 'tasks': return <Tasks tasks={props.tasks} decisions={props.allDecisions} onEdit={props.onEditTask} onViewDecision={props.onSelect} filters={props.taskFilters} onFiltersChange={props.onTaskFiltersChange} canEdit={props.canUpdateTasks} />
    case 'units': return <UnitTracking tasks={props.tasks} decisions={props.allDecisions} onViewTasks={props.onViewUnitTasks} onSelectDecision={props.onSelect} onEditTask={props.onEditTask} canEditTasks={props.canUpdateTasks} />
    case 'correspondence': return <CorrespondenceList items={props.correspondence} decisions={props.allDecisions} tasks={props.tasks} onSelectDecision={props.onSelect} onEdit={props.onEditCorrespondence} canEdit={props.canWriteCorrespondence} replyOnly={props.correspondenceReplyOnly} onReplyOnlyChange={props.onCorrespondenceReplyOnlyChange} />
    case 'imports': return <ImportPanel decisions={props.allDecisions} documents={props.documents} onRefresh={props.onRefresh} onSelectDecision={props.onSelect} canUpload={props.canUploadDocuments} />
    case 'reports': return <Reports decisions={props.allDecisions} tasks={props.tasks} />
    case 'settings': return <SettingsPanel decisions={props.allDecisions} />
  }
}

function Dashboard({ decisions, tasks, correspondence, onSelect, onViewAll }: { decisions: Decision[]; tasks: Task[]; correspondence: Correspondence[]; onSelect: (d: Decision) => void; onViewAll: () => void }) {
  const actionable = decisions.filter(decision => decisionNeedsImplementation(decision) && decision.applicationStatus !== 'completed')
  const metrics = [
    { label: 'Takip kapsamındaki karar', value: decisions.length, icon: FileText, tone: 'navy' },
    { label: 'Uygulama gerektiren', value: actionable.length, icon: ListChecks, tone: 'blue' },
    { label: 'Cevap veya onay bekleyen', value: tasks.filter(t => ['waiting_reply','waiting_approval'].includes(t.status)).length, icon: Clock3, tone: 'amber' },
    { label: 'Geciken görev', value: tasks.filter(task => isOverdue(task)).length, icon: CalendarDays, tone: 'green' },
  ]

  const subjectDistribution = useMemo(() => {
    if (!decisions.length) return []
    const counts: Record<string, number> = {}
    decisions.forEach(d => {
      const title = (d.title && d.title.trim()) || 'BELİRTİLMEMİŞ'
      counts[title] = (counts[title] || 0) + 1
    })
    const total = decisions.length
    const sorted = Object.entries(counts)
      .map(([title, count]) => ({
        title,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)

    const palette = [
      '#0b192c',
      '#1e3e62',
      '#b4843a',
      '#059669',
      '#d97706',
      '#475569',
      '#2563eb',
      '#7c3aed',
    ]

    const limit = 6
    if (sorted.length > limit) {
      const top = sorted.slice(0, limit - 1).map((item, idx) => ({
        ...item,
        color: palette[idx % palette.length],
        subItems: undefined as typeof sorted | undefined,
      }))
      const otherItems = sorted.slice(limit - 1)
      const otherCount = otherItems.reduce((sum, item) => sum + item.count, 0)
      const otherPercentage = Math.round((otherCount / total) * 1000) / 10
      top.push({
        title: 'DİĞER KONULAR',
        count: otherCount,
        percentage: otherPercentage,
        color: '#94a3b8',
        subItems: otherItems,
      })
      return top
    }

    return sorted.map((item, idx) => ({
      ...item,
      color: palette[idx % palette.length],
      subItems: undefined as typeof sorted | undefined,
    }))
  }, [decisions])

  const resultDistribution = useMemo(() => {
    if (!decisions.length) return []
    const total = decisions.length
    const accepted = decisions.filter(d => d.result === 'accepted').length
    const partial = decisions.filter(d => d.result === 'partial' || d.result === 'conditional').length
    const rejected = decisions.filter(d => d.result === 'rejected').length
    const other = decisions.filter(d => !['accepted', 'partial', 'conditional', 'rejected'].includes(d.result)).length

    const items = [
      {
        id: 'accepted',
        title: 'KABUL EDİLEN',
        count: accepted,
        percentage: total ? Math.round((accepted / total) * 1000) / 10 : 0,
        color: '#059669',
      },
      {
        id: 'partial',
        title: 'KISMEN KABUL EDİLEN',
        count: partial,
        percentage: total ? Math.round((partial / total) * 1000) / 10 : 0,
        color: '#d97706',
      },
      {
        id: 'rejected',
        title: 'REDDEDİLEN',
        count: rejected,
        percentage: total ? Math.round((rejected / total) * 1000) / 10 : 0,
        color: '#dc2626',
      },
    ]

    if (other > 0) {
      items.push({
        id: 'other',
        title: 'DİĞER / ERTELENEN',
        count: other,
        percentage: total ? Math.round((other / total) * 1000) / 10 : 0,
        color: '#64748b',
      })
    }

    return items
  }, [decisions])

  return <>
    <section className="metric-grid">{metrics.map(m => <article className={`metric ${m.tone}`} key={m.label}><div className="metric-icon"><m.icon /></div><div><strong>{m.value}</strong><span>{m.label}</span></div></article>)}</section>

    {subjectDistribution.length > 0 && (
      <section className="panel subject-distribution-panel">
        <div className="panel-title">
          <div>
            <h2>Kısa Konu Başlıklarının Yüzde Dağılımı</h2>
            <p>Kararların konu başlıklarına göre oransal ağırlığı ve dağılımı ({decisions.length} karar)</p>
          </div>
          <BarChart3 />
        </div>
        <div className="distribution-stacked-bar" title="Konu başlıkları yüzde dağılımı">
          {subjectDistribution.map(item => (
            <div
              key={item.title}
              className={`distribution-bar-segment ${item.subItems ? 'has-popup' : ''}`}
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.title}: %${item.percentage} (${item.count} karar)`}
            >
              {item.subItems && (
                <div className="distribution-popup bar-popup">
                  <div className="distribution-popup-header">
                    <strong>{item.title} ({item.count} Karar, %{item.percentage})</strong>
                    <span>{item.subItems.length} Farklı Konu</span>
                  </div>
                  <div className="distribution-popup-list">
                    {item.subItems.map(sub => (
                      <div key={sub.title} className="distribution-popup-row">
                        <span className="popup-sub-title" title={sub.title}>{sub.title}</span>
                        <span className="popup-sub-stats">
                          <span>{sub.count} karar</span>
                          <strong>%{sub.percentage}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="distribution-legend-grid">
          {subjectDistribution.map(item => (
            <div
              className={`distribution-legend-item ${item.subItems ? 'has-popup' : ''}`}
              key={item.title}
              tabIndex={item.subItems ? 0 : undefined}
            >
              <div className="distribution-legend-left">
                <span className="distribution-legend-color" style={{ backgroundColor: item.color }} />
                <span className="distribution-legend-title" title={item.title}>
                  {item.title}
                  {item.subItems && (
                    <span className="distribution-legend-badge">+{item.subItems.length} konu</span>
                  )}
                </span>
              </div>
              <div className="distribution-legend-stats">
                <span className="distribution-legend-count">{item.count} karar</span>
                <strong className="distribution-legend-percent">%{item.percentage}</strong>
              </div>
              {item.subItems && (
                <div className="distribution-popup legend-popup">
                  <div className="distribution-popup-header">
                    <strong>{item.title} DAĞILIMI</strong>
                    <span>Toplam {item.count} Karar (%{item.percentage})</span>
                  </div>
                  <div className="distribution-popup-list">
                    {item.subItems.map(sub => (
                      <div key={sub.title} className="distribution-popup-row">
                        <span className="popup-sub-title" title={sub.title}>{sub.title}</span>
                        <span className="popup-sub-stats">
                          <span>{sub.count} karar</span>
                          <strong>%{sub.percentage}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    )}

    {resultDistribution.length > 0 && (
      <section className="panel result-distribution-panel">
        <div className="panel-title">
          <div>
            <h2>Karar Sonuçlarının Yüzde Dağılımı</h2>
            <p>Kararların kabul, kısmen kabul ve ret oranları ({decisions.length} karar)</p>
          </div>
          <PieChart />
        </div>
        <div className="distribution-stacked-bar" title="Karar sonuçları yüzde dağılımı">
          {resultDistribution.map(item => (
            <div
              key={item.id}
              className="distribution-bar-segment"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.title}: %${item.percentage} (${item.count} karar)`}
            />
          ))}
        </div>
        <div className="distribution-legend-grid result-legend-grid">
          {resultDistribution.map(item => (
            <div className="distribution-legend-item" key={item.id}>
              <div className="distribution-legend-left">
                <span className="distribution-legend-color" style={{ backgroundColor: item.color }} />
                <span className="distribution-legend-title">{item.title}</span>
              </div>
              <div className="distribution-legend-stats">
                <span className="distribution-legend-count">{item.count} karar</span>
                <strong className="distribution-legend-percent" style={{ color: item.color }}>%{item.percentage}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="dashboard-grid">
      <article className="panel focus-panel"><div className="panel-title"><div><h2>Öncelikli takip</h2><p>İşlem bekleyen kararlar</p></div><button onClick={onViewAll}>Tümünü gör</button></div>
        <div className="focus-list">{actionable.slice(0,4).map(d => <button key={d.id} onClick={() => onSelect(d)}><span className="decision-no">{d.packageNo}<b>{d.itemNo}</b></span><span className="focus-copy"><strong>{d.title}</strong><small><MapPin />{d.locations.join(', ')}</small></span><StatusBadge value={d.applicationStatus || 'not_started'} /></button>)}</div>
      </article>
      <article className="panel pulse"><div className="panel-title"><div><h2>Operasyon özeti</h2><p>Tüm açık kayıtlar</p></div><CalendarDays /></div>
        <div className="pulse-row"><span>Aktif görev</span><strong>{tasks.filter(t => !['completed','cancelled'].includes(t.status)).length}</strong></div>
        <div className="pulse-row"><span>Gönderilmiş yazı</span><strong>{correspondence.filter(c => c.status === 'sent').length}</strong></div>
        <div className="pulse-row"><span>Hedef tarihi olmayan iş</span><strong>{tasks.filter(t => !t.dueDate && !['completed','cancelled'].includes(t.status)).length}</strong></div>
        <div className="progress-label"><span>Tamamlanan görevler</span><b>{tasks.length ? Math.round(tasks.filter(t => t.status === 'completed').length / tasks.length * 100) : 0}%</b></div><div className="progress"><i style={{width: `${tasks.length ? tasks.filter(t => t.status === 'completed').length / tasks.length * 100 : 0}%`}} /></div>
      </article>
    </section>
    <section className="panel"><div className="panel-title"><div><h2>Son kararlar</h2><p>Kaynak belgesiyle birlikte güncel kayıtlar</p></div></div><DecisionsTable decisions={decisions.slice(0,5)} onSelect={onSelect} compact /></section>
  </>
}

type DecisionSortField = 'decisionNo' | 'title' | 'result' | 'status'
type SortOrder = 'asc' | 'desc'

function DecisionsTable({ decisions, onSelect, compact, onNew }: { decisions: Decision[]; onSelect: (d: Decision) => void; compact?: boolean; onNew?: () => void }) {
  const [result, setResult] = useState('all')
  const [sortField, setSortField] = useState<DecisionSortField>('decisionNo')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: DecisionSortField) => {
    if (sortField === field) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'decisionNo' ? 'desc' : 'asc')
    }
  }

  const filteredRows = result === 'all' ? decisions : decisions.filter(d => d.result === result)

  const rows = useMemo(() => {
    const list = [...filteredRows]
    return list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'decisionNo') {
        const pkgCmp = (a.packageNo || '').localeCompare(b.packageNo || '', undefined, { numeric: true, sensitivity: 'base' })
        if (pkgCmp !== 0) {
          cmp = pkgCmp
        } else {
          const itemA = parseInt(a.itemNo, 10) || 0
          const itemB = parseInt(b.itemNo, 10) || 0
          if (itemA !== itemB) {
            cmp = itemA - itemB
          } else {
            cmp = (a.date || '').localeCompare(b.date || '')
          }
        }
      } else if (sortField === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '', 'tr', { sensitivity: 'base' })
        if (cmp === 0) {
          const locA = [a.neighborhood ? `${a.neighborhood} Mahallesi` : '', ...a.locations].filter(Boolean).join(' ')
          const locB = [b.neighborhood ? `${b.neighborhood} Mahallesi` : '', ...b.locations].filter(Boolean).join(' ')
          cmp = locA.localeCompare(locB, 'tr', { sensitivity: 'base' })
        }
      } else if (sortField === 'result') {
        const labelA = resultLabels[a.result] || ''
        const labelB = resultLabels[b.result] || ''
        cmp = labelA.localeCompare(labelB, 'tr', { sensitivity: 'base' })
      } else if (sortField === 'status') {
        const statusA = a.result === 'rejected' ? 'Ret kararı' : (statusLabels[a.applicationStatus || 'not_started'] || '')
        const statusB = b.result === 'rejected' ? 'Ret kararı' : (statusLabels[b.applicationStatus || 'not_started'] || '')
        cmp = statusA.localeCompare(statusB, 'tr', { sensitivity: 'base' })
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortField, sortOrder])

  const renderSortIcon = (field: DecisionSortField) => {
    if (sortField !== field) return <ArrowUpDown className="th-sort-icon" />
    return sortOrder === 'asc' ? <ArrowUp className="th-sort-icon" /> : <ArrowDown className="th-sort-icon" />
  }

  return <div className={compact ? '' : 'panel table-panel'}>{!compact && <div className="table-tools"><div className="select-wrap"><Filter /><select value={result} onChange={e => setResult(e.target.value)}><option value="all">Tüm karar sonuçları</option>{Object.entries(resultLabels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select><ChevronDown /></div><span>{rows.length} kayıt</span></div>}
    {rows.length ? <div className="table-scroll"><table className="decisions-table"><colgroup><col className="decision-column" /><col className="subject-column" /><col className="result-column" /><col className="status-column" /><col className="proposal-column" /></colgroup><thead><tr>
      <th className={`sortable ${sortField === 'decisionNo' ? 'active' : ''}`} onClick={() => handleSort('decisionNo')} title="Karar numarasına göre sırala"><span className="th-content">Karar {renderSortIcon('decisionNo')}</span></th>
      <th className={`sortable ${sortField === 'title' ? 'active' : ''}`} onClick={() => handleSort('title')} title="Konu başlığına göre sırala"><span className="th-content">Konu ve konum {renderSortIcon('title')}</span></th>
      <th className={`sortable ${sortField === 'result' ? 'active' : ''}`} onClick={() => handleSort('result')} title="Karar sonucuna göre sırala"><span className="th-content">Sonuç {renderSortIcon('result')}</span></th>
      <th className={`sortable ${sortField === 'status' ? 'active' : ''}`} onClick={() => handleSort('status')} title="Uygulama durumuna göre sırala"><span className="th-content">Uygulama durumu {renderSortIcon('status')}</span></th>
      <th>Teklif metni</th>
    </tr></thead><tbody>{rows.map(d => <tr key={d.id} onClick={() => onSelect(d)}><td><b>{d.packageNo}</b><span>Madde {d.itemNo} · {formatDate(d.date)}</span></td><td><strong>{d.title}</strong><span>{[d.neighborhood ? `${d.neighborhood} Mahallesi` : '', ...d.locations].filter(Boolean).join(' · ') || 'Konum belirtilmemiş'}</span></td><td><ResultBadge value={d.result} /></td><td>{d.result === 'rejected' ? <span className="muted">— Ret kararı</span> : <StatusBadge value={d.applicationStatus || 'not_started'} />}</td><td title={d.proposal}><span className="proposal-preview">{d.proposal || '—'}</span></td></tr>)}</tbody></table></div> : <Empty icon={Search} title="Eşleşen karar bulunamadı" text="Arama veya filtreyi değiştirin ya da yeni bir karar kaydedin." action={onNew} />}</div>
}

function Packages({ decisions, onSelect }: { decisions: Decision[]; onSelect: (d: Decision) => void }) {
  const groups = Object.entries(groupBy(decisions, d => d.packageNo))
    .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))

  return groups.length ? (
    <div className="package-grid">
      {groups.map(([no, ds]) => {
        const sortedDs = [...ds].sort((a, b) => {
          const numA = parseInt(a.itemNo, 10) || 0
          const numB = parseInt(b.itemNo, 10) || 0
          if (numA !== numB) return numA - numB
          return a.itemNo.localeCompare(b.itemNo, undefined, { numeric: true })
        })
        const packageResult: DecisionResult = sortedDs.every(d => d.result === 'rejected')
          ? 'rejected'
          : sortedDs.every(d => d.result === 'accepted')
            ? 'accepted'
            : 'partial'

        return (
          <article className="package-card" key={no}>
            <div className="package-head">
              <div className="folder-mark"><FileText /></div>
              <div><span>Üst karar numarası</span><strong>{no}</strong></div>
              <ResultBadge value={packageResult} />
            </div>
            <div className="package-meta">
              <span><CalendarDays />{formatDate(sortedDs[0]?.date || ds[0]?.date)}</span>
              <span><FileText />{sortedDs.length} karar maddesi</span>
            </div>
            <div className="package-items">
              {sortedDs.map(d => (
                <button key={d.id} onClick={() => onSelect(d)}>
                  <b>Karar {d.itemNo}</b>
                  <span>{d.title}</span>
                </button>
              ))}
            </div>
          </article>
        )
      })}
    </div>
  ) : (
    <div className="panel">
      <Empty icon={Archive} title="Karar paketi bulunmuyor" text="İlk karar kaydedildiğinde üst karar numarasına göre paket burada oluşur." />
    </div>
  )
}

function Locations({ decisions, onSelect, selectedKey, onSelectedKeyChange }: { decisions: Decision[]; onSelect: (d: Decision) => void; selectedKey: string; onSelectedKeyChange: (value: string) => void }) {
  const neighborhoodEntries = Object.entries(groupBy(decisions.filter(decision => decision.neighborhood).map(decision => ({ name: decision.neighborhood!, decision })), row => row.name)).sort((a,b) => a[0].localeCompare(b[0], 'tr'))
  const locationEntries = Object.entries(groupBy(decisions.flatMap(decision => decision.locations.map(name => ({ name, decision }))), row => row.name)).sort((a,b) => a[0].localeCompare(b[0], 'tr'))
  const entries = [
    ...neighborhoodEntries.map(([name, rows]) => ({ key: `neighborhood:${name}`, name: `${name} Mahallesi`, type: 'neighborhood' as const, decisions: rows.map(row => row.decision) })),
    ...locationEntries.map(([name, rows]) => ({ key: `location:${name}`, name, type: 'location' as const, decisions: rows.map(row => row.decision) })),
  ]
  useEffect(() => {
    if (!selectedKey && entries[0]?.key) onSelectedKeyChange(entries[0].key)
    else if (selectedKey && !entries.some(entry => entry.key === selectedKey)) onSelectedKeyChange(entries[0]?.key || '')
  }, [entries, selectedKey, onSelectedKeyChange])
  const selectedEntry = entries.find(entry => entry.key === selectedKey)
  const timeline = [...(selectedEntry?.decisions || [])].sort((a, b) => b.date.localeCompare(a.date))
  const renderEntries = (items: typeof entries, type: 'neighborhood' | 'location') => items.filter(item => item.type === type).map(item => <button className={`location-row ${selectedKey === item.key ? 'active' : ''}`} key={item.key} onClick={() => onSelectedKeyChange(item.key)}><div className="pin">{type === 'neighborhood' ? <Building2 /> : <MapPin />}</div><div><strong>{item.name}</strong><span>{type === 'neighborhood' ? 'Kütahya Merkez' : 'Cadde, kavşak veya mevki'} · {item.decisions.length} karar</span></div></button>)
  return <div className="location-layout separated-locations">
    <div className="panel location-list"><div className="panel-title"><div><h2>Mahalleler</h2><p>{neighborhoodEntries.length} mahallede karar kaydı</p></div></div>{neighborhoodEntries.length ? renderEntries(entries, 'neighborhood') : <Empty icon={Building2} title="Mahalle kaydı bulunmuyor" text="Mahalle seçilmiş kararlar burada listelenir." />}</div>
    <div className="panel location-list"><div className="panel-title"><div><h2>Konumlar</h2><p>{locationEntries.length} cadde, kavşak veya mevki</p></div></div>{locationEntries.length ? renderEntries(entries, 'location') : <Empty icon={MapPin} title="Konum kaydı bulunmuyor" text="Kararlara eklenen konumlar burada listelenir." />}</div>
    <div className="panel timeline"><div className="panel-title"><div><h2>{selectedEntry ? `${selectedEntry.name} karar geçmişi` : 'Karar geçmişi'}</h2><p>{selectedEntry ? (selectedEntry.type === 'neighborhood' ? 'Seçilen mahalleye bağlı kararlar' : 'Seçilen konuma bağlı kararlar') : 'Soldaki mahalle veya konumlardan birini seçin'}</p></div></div>{timeline.map(decision => <button className="timeline-item" key={decision.id} onClick={() => onSelect(decision)}><time>{formatDate(decision.date)}</time><i /><div><strong>{decision.title}</strong><span>{decision.packageNo} · Karar {decision.itemNo}</span><ResultBadge value={decision.result} /></div></button>)}{!timeline.length && <Empty icon={History} title="Karar geçmişi seçilmedi" text="Bir mahalle veya konum seçtiğinizde ilişkili kararlar burada görünür." />}</div>
  </div>
}

function Tasks({ tasks, decisions, onEdit, onViewDecision, filters, onFiltersChange, canEdit }: { tasks: Task[]; decisions: Decision[]; onEdit: (task: Task) => void; onViewDecision: (decision: Decision) => void; filters: TaskFilters; onFiltersChange: (filters: TaskFilters) => void; canEdit: boolean }) {
  const units = [...new Set([...tasks.map(task => task.unit), ...decisions.flatMap(getDecisionUnits)])].sort((a, b) => a.localeCompare(b, 'tr'))
  const people = [...new Set(tasks.filter(task => filters.unit === 'all' || task.unit === filters.unit).map(task => task.assigneeName).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'tr'))
  const filteredTasks = tasks.filter(task =>
    (filters.unit === 'all' || task.unit === filters.unit) &&
    (filters.person === 'all' || task.assigneeName === filters.person) &&
    (filters.status === 'all' || task.status === filters.status) &&
    (!filters.overdue || isOverdue(task)))
  const columns: { key: Task['status']; label: string }[] = [
    {key:'planned',label:'Planlandı'}, {key:'in_progress',label:'İşlemde'}, {key:'waiting_reply',label:'Cevap bekliyor'},
    {key:'waiting_approval',label:'Onay bekliyor'},
    {key:'completed',label:'Tamamlandı'}, {key:'cancelled',label:'İptal edildi'},
  ]
  const setFilter = (key: keyof TaskFilters, value: string) => onFiltersChange({ ...filters, [key]: value })
  return <>
    <div className="panel task-filter-panel">
      <div className="task-filter-copy"><Filter /><div><strong>Görevleri filtrele</strong><span>{filteredTasks.length} / {tasks.length} görev gösteriliyor</span></div></div>
      <div className="task-filters">
        <select value={filters.unit} onChange={e => onFiltersChange({ ...filters, unit: e.target.value, person: 'all' })} aria-label="Müdürlüğe göre filtrele"><option value="all">Tüm müdürlükler</option>{units.map(unit => <option value={unit} key={unit}>{unit}</option>)}</select>
        <select value={filters.person} onChange={e => setFilter('person', e.target.value)} aria-label="Sorumlu kişiye göre filtrele"><option value="all">Tüm sorumlu kişiler</option>{people.map(person => <option value={person} key={person}>{person}</option>)}</select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} aria-label="Duruma göre filtrele"><option value="all">Tüm durumlar</option>{Object.entries(taskLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        {filters.overdue && <span className="active-filter"><Clock3 /> Yalnızca gecikenler</span>}
        {(filters.unit !== 'all' || filters.person !== 'all' || filters.status !== 'all' || filters.overdue) && <button className="secondary" onClick={() => onFiltersChange({ unit: 'all', person: 'all', status: 'all', overdue: false })}><X /> Filtreleri temizle</button>}
      </div>
    </div>
    <div className="kanban">{columns.map(col => <section key={col.key}><header><span>{col.label}</span><b>{filteredTasks.filter(t => t.status === col.key).length}</b></header>{filteredTasks.filter(t => t.status === col.key).map(t => { const d = decisions.find(x => x.id === t.decisionId); return <article className="task-card" key={t.id}><div className={`priority ${t.priority}`} />{d ? <button className="task-decision-link" onClick={() => onViewDecision(d)}>{d.packageNo} · Karar {d.itemNo}</button> : <small>Karar</small>}<strong>{t.title}</strong><span className="assignee"><UserRound />{t.assigneeName || 'Sorumlu kişi belirlenmedi'}</span><span><Building2 />{t.unit}</span><span className={!t.dueDate ? 'no-date' : ''}><CalendarDays />{t.dueDate ? formatDate(t.dueDate) : 'Hedef tarih belirlenmemiş'}</span>{canEdit && <button className="edit-hint" onClick={() => onEdit(t)}><Pencil /> Görevi düzenle</button>}</article>})}</section>)}</div>
  </>
}

function UnitTracking({ tasks, decisions, onViewTasks, onSelectDecision, onEditTask, canEditTasks }: { tasks: Task[]; decisions: Decision[]; onViewTasks: (unit: string) => void; onSelectDecision: (decision: Decision) => void; onEditTask: (task: Task) => void; canEditTasks: boolean }) {
  const units = [...new Set([...tasks.map(task => task.unit), ...decisions.flatMap(getDecisionUnits)])].sort((a, b) => a.localeCompare(b, 'tr'))
  if (!units.length) return <div className="panel"><Empty icon={Building2} title="Müdürlük takibi henüz başlamadı" text="Sorumlu müdürlük içeren bir karar veya görev eklendiğinde birimler burada görünür." /></div>
  return <div className="unit-grid">{units.map(unit => {
    const rows = tasks.filter(task => task.unit === unit)
    const assignedDecisions = decisions.filter(decision => getDecisionUnits(decision).includes(unit))
    const relatedDecisionIds = new Set([...assignedDecisions.map(decision => decision.id), ...rows.map(task => task.decisionId)])
    const relatedDecisions = decisions.filter(decision => relatedDecisionIds.has(decision.id))
    const decisionsWithoutTask = assignedDecisions.filter(decision => decisionNeedsImplementation(decision) && !rows.some(task => task.decisionId === decision.id && task.status !== 'cancelled'))
    return <article className="panel unit-card" key={unit}>
      <div className="unit-card-head"><div className="unit-icon"><Building2 /></div><div className="unit-title"><h2>{unit}</h2><p>{relatedDecisions.length} sorumlu karar · {rows.length} bağlı görev</p></div><button className="secondary unit-card-action" onClick={() => onViewTasks(unit)}>Görevleri gör <ListChecks /></button></div>
      <div className="unit-stats"><div><strong>{rows.filter(t => ['waiting_reply','waiting_approval'].includes(t.status)).length}</strong><span>Bekleyen</span></div><div><strong>{rows.filter(t => t.status === 'in_progress').length}</strong><span>İşlemde</span></div><div><strong>{decisionsWithoutTask.length}</strong><span>Görev açılmamış</span></div></div>
      {decisionsWithoutTask.length > 0 && <div className="unassigned-decisions"><strong>Görev bekleyen kararlar</strong>{decisionsWithoutTask.map(decision => <button key={decision.id} onClick={() => onSelectDecision(decision)}><span>{decision.packageNo} / {decision.itemNo}</span>{decision.title}</button>)}</div>}
      {rows.slice(0, 4).map(t => <button className="unit-task" key={t.id} onClick={() => { const decision = decisions.find(d => d.id === t.decisionId); if (canEditTasks) onEditTask(t); else if (decision) onSelectDecision(decision) }}><span>{t.title}<small>{t.assigneeName || 'Sorumlu kişi belirlenmedi'}</small></span><b>{taskLabels[t.status]}</b></button>)}
    </article>
  })}</div>
}

function CorrespondenceList({ items, decisions, tasks, onSelectDecision, onEdit, canEdit, replyOnly, onReplyOnlyChange }: { items: Correspondence[]; decisions: Decision[]; tasks: Task[]; onSelectDecision: (d: Decision) => void; onEdit: (c: Correspondence) => void; canEdit: boolean; replyOnly: boolean; onReplyOnlyChange: (value: boolean) => void }) {
  const [direction, setDirection] = useState('all')
  const rows = items.filter(item => (direction === 'all' || item.direction === direction) && (!replyOnly || item.replyExpected))
  return <div className="panel table-panel"><div className="table-tools"><div className="select-wrap"><Filter /><select value={direction} onChange={e => setDirection(e.target.value)}><option value="all">Tüm yazışmalar</option><option value="incoming">Gelen</option><option value="outgoing">Giden</option></select><ChevronDown /></div>{replyOnly && <button className="secondary" onClick={() => onReplyOnlyChange(false)}><X /> Cevap filtresini kaldır</button>}<span>{rows.length} kayıt</span></div><div className="table-scroll"><table><thead><tr><th>Tür / Durum</th><th>Evrak</th><th>Konu</th><th>İlgili karar</th><th>Bağlı görev</th><th>Karşı birim</th><th></th></tr></thead><tbody>{rows.map(c => { const d = decisions.find(x => x.id === c.decisionId); const task = tasks.find(x => x.id === c.taskId); return <tr key={c.id}><td><span className={`document-direction ${c.direction}`}>{c.direction === 'outgoing' ? 'Giden' : 'Gelen'}</span><span>{c.status === 'draft' ? 'Taslak' : c.status === 'sent' ? 'Gönderildi' : 'Alındı'}</span></td><td><b>{c.documentNo || 'Sayı girilmedi'}</b><span>{formatDate(c.date)}</span></td><td><strong>{c.subject}</strong>{c.replyExpected && <span className="waiting-text"><Clock3 /> Cevap bekleniyor</span>}</td><td>{d ? <button className="table-link" onClick={() => onSelectDecision(d)}>{d.packageNo} / {d.itemNo}</button> : '—'}</td><td>{task ? <span title={task.title}>{task.title}</span> : '—'}</td><td>{c.unit}</td><td>{canEdit && <button className="icon-button" onClick={() => onEdit(c)} aria-label="Yazışmayı düzenle"><Pencil /></button>}</td></tr>})}</tbody></table></div>{!rows.length && <Empty icon={Inbox} title="Yazışma bulunmuyor" text="Seçilen ölçütlerde kararlarla ilişkili yazışma bulunamadı." />}</div>
}

function ImportPanel({ decisions, documents, onRefresh, onSelectDecision, canUpload }: { decisions: Decision[]; documents: DocumentRecord[]; onRefresh: () => Promise<void>; onSelectDecision: (decision: Decision) => void; canUpload: boolean }) {
  const [file, setFile] = useState<File | null>(null); const [decisionId, setDecisionId] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const upload = async () => { if (!file || !decisionId) return; setBusy(true); setMessage(''); try { await uploadDocument(file, decisionId); await onRefresh(); setFile(null); setMessage('Belge seçilen karara bağlandı.') } catch(e) { setMessage(e instanceof Error ? e.message : 'Yükleme başarısız.') } finally { setBusy(false) } }
  const openDocument = async (document: DocumentRecord) => { if (!document.path) { setMessage('Bu eski kayıtta dosya içeriği bulunmuyor. Belgeyi yeniden yükleyin.'); return } try { const url = await getDocumentUrl(document.path); window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { setMessage(error instanceof Error ? error.message : 'Belge açılamadı.') } }
  return <div className="import-layout">{canUpload && <section className="panel upload-panel"><div className="upload-icon"><Upload /></div><h2>Belgeyi karara bağlayın</h2><p>Belgeyi seçin ve hangi komisyon kararına ait olduğunu belirtin.</p><Field label="Bağlı karar"><select value={decisionId} onChange={e => setDecisionId(e.target.value)} required><option value="">Karar seçin</option>{decisions.map(d => <option value={d.id} key={d.id}>{d.packageNo} / {d.itemNo} — {d.title}</option>)}</select></Field><label className="dropzone"><input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.kmz" onChange={e => setFile(e.target.files?.[0] || null)} /><FileInput /><strong>{file ? file.name : 'Dosya seçin veya buraya bırakın'}</strong><span>PDF, DOCX, JPG, PNG veya KMZ · en fazla 25 MB</span></label><button className="primary wide" disabled={!file || !decisionId || busy} onClick={upload}>{busy ? <Loader2 className="spin" /> : <Upload />}{busy ? 'Yükleniyor…' : 'Belgeyi yükle ve ilişkilendir'}</button>{message && <div className="alert info"><CheckCircle2 />{message}</div>}</section>}<section className="panel import-info"><h2>Yüklenen belgeler</h2>{documents.length ? <div className="document-list">{documents.map(document => { const decision = decisions.find(d => d.id === document.decisionId); return <div className="document-list-row" key={document.id}><button onClick={() => openDocument(document)}><FileText /><span><strong>{document.name}</strong><small>{document.uploadedAt ? formatDate(document.uploadedAt.slice(0, 10)) : 'Yükleme tarihi yok'}</small></span></button>{decision && <button className="table-link" onClick={() => onSelectDecision(decision)}>{decision.packageNo} / {decision.itemNo} — {decision.title}</button>}</div> })}</div> : <Empty icon={FileInput} title="Belge yüklenmemiş" text="Yüklenen belgeler burada bağlı karar bilgisiyle görünür." />}{message && !canUpload && <div className="alert info">{message}</div>}</section></div>
}

function Reports({ decisions, tasks }: { decisions: Decision[]; tasks: Task[] }) {
  const exports = [{title:'Aylık karar durum raporu',desc:'Karar sonucu ve uygulama ilerlemesi',icon:FileSpreadsheet,headers:['Tarih','Üst karar no','Madde no','Konu','Sonuç','Uygulama durumu'],rows:decisions.map(d=>[d.date,d.packageNo,d.itemNo,d.title,resultLabels[d.result],d.applicationStatus?statusLabels[d.applicationStatus]:''])},{title:'Müdürlük bazlı bekleyen işler',desc:'Birim, bekleme nedeni ve sonraki işlem',icon:Building2,headers:['Müdürlük','Sorumlu kişi','Görev','Durum','Bekleme nedeni','Sonraki işlem'],rows:tasks.filter(t=>!['completed','cancelled'].includes(t.status)).map(t=>[t.unit,t.assigneeName||'',t.title,taskLabels[t.status],t.waitingReason||'',t.nextAction||''])},{title:'Konum karar geçmişi',desc:'Konumlara ilişkin kronolojik kararlar',icon:MapPin,headers:['Konum','Tarih','Üst karar no','Madde no','Konu','Sonuç'],rows:decisions.flatMap(d=>[...(d.neighborhood?[`${d.neighborhood} Mahallesi`]:[]),...d.locations].map(location=>[location,d.date,d.packageNo,d.itemNo,d.title,resultLabels[d.result]]))},{title:'Geciken işler',desc:'Hedef tarihi geçen açık görevler',icon:Clock3,headers:['Hedef tarih','Müdürlük','Sorumlu kişi','Görev','Durum'],rows:tasks.filter(t=>isOverdue(t)).map(t=>[t.dueDate||'',t.unit,t.assigneeName||'',t.title,taskLabels[t.status]])}]
  return <><div className="report-summary"><div><span>Kabul edilen</span><strong>{decisions.filter(d => d.result === 'accepted').length}</strong></div><div><span>Reddedilen</span><strong>{decisions.filter(d => d.result === 'rejected').length}</strong></div><div><span>Açık görev</span><strong>{tasks.filter(t => !['completed','cancelled'].includes(t.status)).length}</strong></div><div><span>Tamamlanan</span><strong>{tasks.filter(t => t.status === 'completed').length}</strong></div></div><div className="report-grid">{exports.map(x => <article className="panel report-card" key={x.title}><x.icon /><div><h2>{x.title}</h2><p>{x.desc}</p></div><button className="secondary" onClick={() => downloadCsv(x.title, x.headers, x.rows)}>CSV indir</button></article>)}</div><div className="alert info"><BarChart3 />Rapor dosyalarında üretim tarihi, sütun başlıkları ve kayıt referansları yer alır.</div></>
}

function SettingsPanel({ decisions }: { decisions: Decision[] }) { const [open, setOpen] = useState(''); const cards = [{id:'users',icon:Users,title:'Kullanıcılar ve roller',desc:'Ulaşım personeli ve rol modeli',items:[...transportStaff,'Yönetici · Koordinatör · Personel · Kontrol · Görüntüleyici']},{id:'units',icon:Building2,title:'Müdürlükler',desc:'Görev atanabilen belediye müdürlükleri',items:[...municipalDirectorates]},{id:'locations',icon:MapPin,title:'Konum ad sözlüğü',desc:'Kayıtlarda kullanılan mahalle ve konumlar',items:[...kutahyaNeighborhoods,...new Set(decisions.flatMap(d=>d.locations))]},{id:'access',icon:ShieldCheck,title:'Erişim ve işlem geçmişi',desc:'Yetki ve denetim ilkeleri',items:['Karar değişiklikleri sürüm numarasıyla korunur.','Görevler sorumlu müdürlük ve kişiye bağlanır.','Belgelere süreli, özel bağlantıyla erişilir.','Canlı ortamda tüm değişiklikler denetim günlüğüne yazılır.']}]; return <div className="settings-grid">{cards.map(card=><article className={`panel setting-card ${open===card.id?'expanded':''}`} key={card.id}><card.icon /><div><h2>{card.title}</h2><p>{card.desc}</p>{open===card.id&&<div className="settings-list">{card.items.map(item=><span key={item}>{item}</span>)}</div>}</div><button className="secondary" onClick={()=>setOpen(open===card.id?'':card.id)}>{open===card.id?'Kapat':'Listeyi aç'}</button></article>)}</div> }

function DecisionDetailView({ decision: d, tasks, correspondence, documents, onAddTask, onEditTask, onAddCorrespondence, onEditCorrespondence, onDocumentsChanged, onViewOfficialDoc, canAddTask, canEditTask, canWriteCorrespondence, canUploadDocuments }: { decision: Decision; tasks: Task[]; correspondence: Correspondence[]; documents: DocumentRecord[]; onAddTask: () => void; onEditTask: (task: Task) => void; onAddCorrespondence: () => void; onEditCorrespondence: (item: Correspondence) => void; onDocumentsChanged: () => Promise<void>; onViewOfficialDoc?: () => void; canAddTask: boolean; canEditTask: boolean; canWriteCorrespondence: boolean; canUploadDocuments: boolean }) {
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentBusy, setDocumentBusy] = useState(false)
  const [documentMessage, setDocumentMessage] = useState('')
  const uploadDecisionDocument = async () => {
    if (!documentFile) return
    setDocumentBusy(true); setDocumentMessage('')
    try {
      await uploadDocument(documentFile, d.id)
      await onDocumentsChanged()
      setDocumentFile(null)
      setDocumentMessage('Belge bu karara bağlandı.')
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : 'Belge yüklenemedi.')
    } finally { setDocumentBusy(false) }
  }
  const openDocument = async (document: DocumentRecord) => { if (!document.path) { setDocumentMessage('Bu eski demo kaydında dosya içeriği bulunmuyor. Belgeyi yeniden yükleyin.'); return } try { const url = await getDocumentUrl(document.path); window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { setDocumentMessage(error instanceof Error ? error.message : 'Belge açılamadı.') } }
  return <div className="detail-layout">
    <section className="detail-main">
      <article className="panel decision-summary">
        <div className="summary-top">
          <ResultBadge value={d.result} />
          {d.result !== 'rejected' && <StatusBadge value={d.applicationStatus || 'not_started'} />}
        </div>
        <div className="location-chips">{d.neighborhood && <span><Building2 />{d.neighborhood} Mahallesi</span>}{d.locations.map(location => <span key={location}><MapPin />{location}</span>)}</div>
        {d.result === 'rejected'
          ? <div className="rejection-note"><XCircle /><div><strong>Uygulama takibi gerekmiyor</strong><span>Ret kararlarında görev ve uygulama durumu tutulmaz.</span></div></div>
          : !decisionNeedsImplementation(d)
            ? <div className="alert info auto-status-note"><CheckCircle2 /><span><strong>Uygulama görevi gerektirmiyor</strong>{d.scope} kapsamındaki bu karar bilgi ve karar geçmişinde izlenir.</span></div>
            : <div className="alert info auto-status-note"><ListChecks /><span><strong>Uygulama durumu görevlerden hesaplanır</strong> Görevlerim alanındaki ilerleme bu karara otomatik yansır.</span></div>}
      </article>
      <article className="panel prose"><h2>Teklif metni</h2><p>{d.proposal}</p><h2>Kararın özgün metni</h2><p>{d.decisionText}</p>{d.conditions && <><h2>Ön koşullar</h2><div className="condition"><Clock3 />{d.conditions}</div></>}</article>
      {decisionNeedsImplementation(d) && <article className="panel"><div className="panel-title"><div><h2>Görevler</h2><p>{tasks.length} uygulama görevi</p></div>{canAddTask && <button className="secondary" onClick={onAddTask}><Plus /> Görev ekle</button>}</div>{tasks.map(task => canEditTask ? <button className="detail-row interactive" key={task.id} onClick={() => onEditTask(task)}><CheckCircle2 /><div><strong>{task.title}</strong><span>{task.assigneeName || 'Sorumlu kişi belirlenmedi'} · {task.unit} · {taskLabels[task.status]}</span></div><b>{task.dueDate ? formatDate(task.dueDate) : 'Tarih yok'}</b><Pencil /></button> : <div className="detail-row" key={task.id}><CheckCircle2 /><div><strong>{task.title}</strong><span>{task.assigneeName || 'Sorumlu kişi belirlenmedi'} · {task.unit} · {taskLabels[task.status]}</span></div><b>{task.dueDate ? formatDate(task.dueDate) : 'Tarih yok'}</b></div>)}{!tasks.length && <Empty icon={ListChecks} title="Görev açılmamış" text="Kararın uygulama durumu, görev açılana kadar Hiç başlamamış olarak görünür." action={canAddTask ? onAddTask : undefined} />}</article>}
      <article className="panel"><div className="panel-title"><div><h2>Yazışmalar</h2><p>Karara veya göreve bağlı resmî evraklar</p></div>{canWriteCorrespondence && <button className="secondary" onClick={onAddCorrespondence}><Plus /> Yazışma ekle</button>}</div>{correspondence.map(item => { const task = tasks.find(row => row.id === item.taskId); const content = <><Inbox /><div><strong>{item.subject}</strong><span>{item.documentNo || 'Evrak sayısı yok'} · {item.unit}{task ? ` · Görev: ${task.title}` : ''}</span></div><b>{formatDate(item.date)}</b>{canWriteCorrespondence && <Pencil />}</>; return canWriteCorrespondence ? <button className="detail-row interactive" key={item.id} onClick={() => onEditCorrespondence(item)}>{content}</button> : <div className="detail-row" key={item.id}>{content}</div> })}{!correspondence.length && <Empty icon={Inbox} title="Yazışma eklenmemiş" text="Bu karara bağlı gelen veya giden evrak bulunmuyor." action={canWriteCorrespondence ? onAddCorrespondence : undefined} />}</article>
      <article className="panel"><div className="panel-title"><div><h2>Bağlı belgeler ve ekler</h2><p>{documents.length} belge bu karara bağlı</p></div>{canUploadDocuments && <><button className="secondary document-picker" onClick={() => documentInputRef.current?.click()}><Upload /> Belge seç</button><input ref={documentInputRef} className="document-file-input" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.kmz" onChange={event => { setDocumentFile(event.target.files?.[0] || null); setDocumentMessage(''); event.target.value = '' }} /></>}</div>{canUploadDocuments && documentFile && <div className="document-upload-bar"><FileInput /><div><strong>{documentFile.name}</strong><span>PDF, DOCX, JPG, PNG veya KMZ · en fazla 25 MB</span></div><button className="primary" onClick={uploadDecisionDocument} disabled={documentBusy}>{documentBusy ? <Loader2 className="spin" /> : <Upload />}{documentBusy ? 'Yükleniyor…' : 'Yükle ve bağla'}</button></div>}{documentMessage && <div className="alert info"><CheckCircle2 />{documentMessage}</div>}{documents.map(document => <button className="detail-row interactive" key={document.id} onClick={() => openDocument(document)} disabled={!document.path}><FileText /><div><strong>{document.name}</strong><span>{document.uploadedAt ? new Date(document.uploadedAt).toLocaleString('tr-TR') : 'Yükleme tarihi yok'}</span></div><b>{document.path ? 'Görüntüle' : 'İçerik yok'}</b></button>)}{!documents.length && <Empty icon={FileInput} title="Belge eklenmemiş" text={canUploadDocuments ? 'Yukarıdaki Belge seç düğmesiyle bu karara PDF, DOCX, JPG, PNG veya KMZ ekleyebilirsiniz.' : 'Bu karara henüz belge eklenmemiş.'} />}</article>
    </section>
    <aside className="detail-side"><article className="panel fact-card"><h2>Karar bilgileri</h2><dl><div><dt>Karar tarihi</dt><dd>{formatDate(d.date)}</dd></div><div><dt>Üst karar no</dt><dd>{d.packageNo}</dd></div><div><dt>Madde</dt><dd>Karar {d.itemNo}</dd></div><div><dt>Mahalle</dt><dd>{d.neighborhood ? `${d.neighborhood} Mahallesi` : 'Belirlenmedi'}</dd></div><div><dt>Müdürlük ilgisi</dt><dd>{d.scope}</dd></div><div><dt>Sorumlu müdürlükler</dt><dd>{getDecisionUnits(d).join(', ') || 'Belirlenmedi'}</dd></div></dl></article><article className="panel history-card"><History /><div><strong>İşlem geçmişi korunuyor</strong><span>Değişiklikler kullanıcı ve zaman bilgisiyle kaydedilir.</span></div></article></aside>
  </div>
}

function DecisionCreateModal({ existingTitles, onClose, onSave }: { existingTitles: string[]; onClose: () => void; onSave: (decision: Omit<Decision,'id'>) => Promise<void> }) {
  const [result, setResult] = useState<DecisionResult>('accepted')
  const [decisionText, setDecisionText] = useState('')
  const [responsibleUnits, setResponsibleUnits] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const normalizedText = decisionText.toLocaleLowerCase('tr-TR')
  const hasKabulune = normalizedText.includes('kabulüne')
  const hasReddine = normalizedText.includes('reddine')
  const showKabuluneWarning = result === 'rejected' && hasKabulune
  const showReddineWarning = result === 'accepted' && hasReddine

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr('')
    const form = new FormData(e.currentTarget)
    try {
      if (showKabuluneWarning) {
        if (!window.confirm('Kararın özgün metninde "kabulüne" ifadesi yer almasına rağmen karar sonucu "Reddedildi" olarak seçildi. Yine de bu şekilde kaydetmek istiyor musunuz?')) {
          setBusy(false)
          return
        }
      } else if (showReddineWarning) {
        if (!window.confirm('Kararın özgün metninde "reddine" ifadesi yer almasına rağmen karar sonucu "Kabul Edildi" olarak seçildi. Yine de bu şekilde kaydetmek istiyor musunuz?')) {
          setBusy(false)
          return
        }
      }
      if (result !== 'rejected' && responsibleUnits.length === 0) throw new Error('En az bir sorumlu müdürlük seçin.')
      await onSave({
        packageNo: String(form.get('packageNo')), itemNo: String(form.get('itemNo')), date: String(form.get('date')),
        title: formatSubjectTitle(String(form.get('title'))), proposal: String(form.get('proposal')), decisionText,
        result, conditions: result === 'conditional' ? String(form.get('conditions')) : undefined, scope: String(form.get('scope')),
        neighborhood: String(form.get('neighborhood')),
        locations: parseLocations(String(form.get('locations'))),
        responsibleUnits: result === 'rejected' ? [] : responsibleUnits,
        responsibleUnit: result === 'rejected' ? undefined : responsibleUnits[0],
      })
    } catch (error) { setErr(errorMessage(error, 'Karar kaydedilemedi.')); setBusy(false) }
  }
  return <Modal title="Yeni karar kaydı" subtitle="Kararı kaydedin; uygulama ilerlemesini görevler üzerinden takip edin" onClose={onClose}>
    <form onSubmit={submit} className="form">
      <div className="form-row"><Field label="Üst karar numarası"><input name="packageNo" placeholder="2026/01" required /></Field><Field label="Madde numarası"><input name="itemNo" placeholder="3" required /></Field><Field label="Karar tarihi"><input name="date" type="date" required /></Field></div>
      <SubjectTitleField existingTitles={existingTitles} />
      <Field label="Teklif metni"><textarea name="proposal" rows={3} required /></Field>
      <Field label="Kararın özgün tam metni"><textarea name="decisionText" value={decisionText} onChange={e => setDecisionText(e.target.value)} rows={4} required /></Field>
      <div className="form-row two"><Field label="Karar sonucu"><select value={result} onChange={e => setResult(e.target.value as DecisionResult)}>{Object.entries(resultLabels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></Field><Field label="Müdürlük ilgisi"><select name="scope"><option>Değerlendirme bekliyor</option><option>Doğrudan görev</option><option>Koordinasyon görevi</option><option>Bilgi amaçlı</option><option>Görev alanı dışında</option></select></Field></div>
      {showKabuluneWarning && (
        <div className="alert warning">
          <TriangleAlert />
          <div>
            <strong>Sonuç ve Metin Uyuşmazlığı:</strong>
            <span> Kararın özgün metninde <em>“kabulüne”</em> ifadesi yer alıyor, ancak karar sonucu <em>“Reddedildi”</em> seçildi. Lütfen sonucu kontrol edin.</span>
          </div>
        </div>
      )}
      {showReddineWarning && (
        <div className="alert warning">
          <TriangleAlert />
          <div>
            <strong>Sonuç ve Metin Uyuşmazlığı:</strong>
            <span> Kararın özgün metninde <em>“reddine”</em> ifadesi yer alıyor, ancak karar sonucu <em>“Kabul Edildi”</em> seçildi. Lütfen sonucu kontrol edin.</span>
          </div>
        </div>
      )}
      {result === 'rejected' ? <div className="alert rejection"><XCircle />Ret kararı için uygulama durumu ve görev oluşturulmaz.</div> : <><div className="alert info"><ListChecks />Karar, görev açılana kadar “Hiç başlamamış” görünür. Sonraki durumlar görevlerden otomatik hesaplanır.</div><MultiUnitSelect selected={responsibleUnits} onChange={setResponsibleUnits} /></>}
      {result === 'conditional' && <Field label="Ön koşul veya dış onay"><textarea name="conditions" rows={2} required /></Field>}
      <NeighborhoodSelect />
      <LocationsField />
      {err && <div className="alert error"><XCircle />{err}</div>}
      <FormActions onClose={onClose} busy={busy} />
    </form>
  </Modal>
}

function DecisionEditModal({ decision, existingTitles, onClose, onSave }: { decision: Decision; existingTitles: string[]; onClose: () => void; onSave: (decision: Decision) => Promise<void> }) {
  const [result, setResult] = useState<DecisionResult>(decision.result)
  const [decisionText, setDecisionText] = useState(decision.decisionText || '')
  const [responsibleUnits, setResponsibleUnits] = useState<string[]>(getDecisionUnits(decision))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const normalizedText = decisionText.toLocaleLowerCase('tr-TR')
  const hasKabulune = normalizedText.includes('kabulüne')
  const hasReddine = normalizedText.includes('reddine')
  const showKabuluneWarning = result === 'rejected' && hasKabulune
  const showReddineWarning = result === 'accepted' && hasReddine

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr('')
    const f = new FormData(e.currentTarget)
    try {
      if (showKabuluneWarning) {
        if (!window.confirm('Kararın özgün metninde "kabulüne" ifadesi yer almasına rağmen karar sonucu "Reddedildi" olarak seçildi. Yine de bu şekilde kaydetmek istiyor musunuz?')) {
          setBusy(false)
          return
        }
      } else if (showReddineWarning) {
        if (!window.confirm('Kararın özgün metninde "reddine" ifadesi yer almasına rağmen karar sonucu "Kabul Edildi" olarak seçildi. Yine de bu şekilde kaydetmek istiyor musunuz?')) {
          setBusy(false)
          return
        }
      }
      if (result !== 'rejected' && responsibleUnits.length === 0) throw new Error('En az bir sorumlu müdürlük seçin.')
      await onSave({
        ...decision,
        packageNo: String(f.get('packageNo')), itemNo: String(f.get('itemNo')), date: String(f.get('date')),
        title: formatSubjectTitle(String(f.get('title'))), proposal: String(f.get('proposal')), decisionText,
        result, conditions: result === 'conditional' ? String(f.get('conditions')) : undefined,
        scope: String(f.get('scope')), neighborhood: String(f.get('neighborhood')),
        locations: parseLocations(String(f.get('locations'))),
        responsibleUnits: result === 'rejected' ? [] : responsibleUnits,
        responsibleUnit: result === 'rejected' ? undefined : responsibleUnits[0],
        applicationStatus: result === 'rejected' ? undefined : decision.applicationStatus,
      })
    } catch (e) { setErr(errorMessage(e, 'Karar güncellenemedi.')); setBusy(false) }
  }
  return <Modal title="Kararı düzenle" subtitle="Mevcut karar bilgilerini güncelleyin" onClose={onClose}>
    <form onSubmit={submit} className="form">
      <div className="form-row"><Field label="Üst karar numarası"><input name="packageNo" defaultValue={decision.packageNo} required /></Field><Field label="Madde numarası"><input name="itemNo" defaultValue={decision.itemNo} required /></Field><Field label="Karar tarihi"><input name="date" type="date" defaultValue={decision.date} required /></Field></div>
      <SubjectTitleField defaultValue={decision.title} existingTitles={existingTitles} />
      <Field label="Teklif metni"><textarea name="proposal" defaultValue={decision.proposal} rows={3} required /></Field>
      <Field label="Kararın özgün tam metni"><textarea name="decisionText" value={decisionText} onChange={e => setDecisionText(e.target.value)} rows={4} required /></Field>
      <div className="form-row two"><Field label="Karar sonucu"><select value={result} onChange={e => setResult(e.target.value as DecisionResult)}>{Object.entries(resultLabels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></Field><Field label="Müdürlük ilgisi"><select name="scope" defaultValue={decision.scope}><option>Değerlendirme bekliyor</option><option>Doğrudan görev</option><option>Koordinasyon görevi</option><option>Bilgi amaçlı</option><option>Görev alanı dışında</option></select></Field></div>
      {showKabuluneWarning && (
        <div className="alert warning">
          <TriangleAlert />
          <div>
            <strong>Sonuç ve Metin Uyuşmazlığı:</strong>
            <span> Kararın özgün metninde <em>“kabulüne”</em> ifadesi yer alıyor, ancak karar sonucu <em>“Reddedildi”</em> seçildi. Lütfen sonucu kontrol edin.</span>
          </div>
        </div>
      )}
      {showReddineWarning && (
        <div className="alert warning">
          <TriangleAlert />
          <div>
            <strong>Sonuç ve Metin Uyuşmazlığı:</strong>
            <span> Kararın özgün metninde <em>“reddine”</em> ifadesi yer alıyor, ancak karar sonucu <em>“Kabul Edildi”</em> seçildi. Lütfen sonucu kontrol edin.</span>
          </div>
        </div>
      )}
      {result === 'rejected' ? <div className="alert rejection"><XCircle />Karar reddedildiğinde açık görevler gerekçesiyle iptal edilir; tamamlanmış ve iptal edilmiş görevlerin geçmişi korunur.</div> : <><div className="alert info"><ListChecks />Uygulama durumu Görevlerim alanındaki ilerlemeye göre otomatik güncellenir.</div><MultiUnitSelect selected={responsibleUnits} onChange={setResponsibleUnits} /></>}
      {result === 'conditional' && <Field label="Ön koşul veya dış onay"><textarea name="conditions" defaultValue={decision.conditions} rows={2} required /></Field>}
      <NeighborhoodSelect defaultValue={decision.neighborhood} />
      <LocationsField defaultValue={decision.locations.join(', ')} />
      {err && <div className="alert error"><XCircle />{err}</div>}
      <FormActions onClose={onClose} busy={busy} />
    </form>
  </Modal>
}

function DecisionDeleteModal({ decision, taskCount, correspondenceCount, documentCount, onClose, onDelete }: { decision: Decision; taskCount: number; correspondenceCount: number; documentCount: number; onClose: () => void; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const remove = async () => {
    setBusy(true); setErr('')
    try { await onDelete() }
    catch (error) { setErr(errorMessage(error, 'Karar silinemedi.')); setBusy(false) }
  }
  return <Modal title="Kararı sil" subtitle={`${decision.packageNo} / Karar ${decision.itemNo} — ${decision.title}`} onClose={onClose}>
    <div className="form delete-confirmation">
      <div className="alert rejection"><Trash2 /><div><strong>Bu işlem geri alınamaz.</strong><span>Karar ve kararın işlem kayıtları kalıcı olarak silinecek.</span></div></div>
      <div className="delete-impact"><div><strong>{taskCount}</strong><span>bağlı görev silinecek</span></div><div><strong>{correspondenceCount}</strong><span>yazışma silinecek</span></div><div><strong>{documentCount}</strong><span>belge karardan ayrılacak</span></div></div>
      <p>Konum geçmişi, karar paketleri, müdürlük takibi, raporlar ve gösterge sayıları otomatik olarak güncellenecek. Yüklenen dosyalar kaybolmayacak; Belge İçe Aktarma alanında ilişkisiz olarak korunacak.</p>
      {err && <div className="alert error"><XCircle />{err}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Vazgeç</button><button type="button" className="danger" onClick={remove} disabled={busy}>{busy ? <Loader2 className="spin" /> : <Trash2 />}{busy ? 'Siliniyor…' : 'Kararı ve bağlı kayıtları sil'}</button></div>
    </div>
  </Modal>
}

function TaskCreateModal({ decisions, tasks, role, initialDecisionId, onClose, onSave }: { decisions: Decision[]; tasks: Task[]; role: AppRole; initialDecisionId?: string; onClose:()=>void; onSave:(task:Omit<Task,'id'>)=>Promise<void> }) {
  const availableUnits = (decision?: Decision) => decision ? getDecisionUnits(decision).filter(unit => !tasks.some(task => task.decisionId === decision.id && task.unit.trim().toLocaleLowerCase('tr-TR') === unit.trim().toLocaleLowerCase('tr-TR'))) : []
  const defaultDecisionId = initialDecisionId && decisions.some(decision => decision.id === initialDecisionId) ? initialDecisionId : decisions[0]?.id || ''
  const suggestedUnit = availableUnits(decisions.find(decision => decision.id === defaultDecisionId))[0]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [unitChoice, setUnitChoice] = useState<UnitChoice>(suggestedUnit ? initialUnitChoice(suggestedUnit) : 'Ulaşım Hizmetleri Müdürlüğü')
  const [otherUnit, setOtherUnit] = useState(suggestedUnit && initialUnitChoice(suggestedUnit) === 'Diğer' ? suggestedUnit : '')
  const [assigneeId, setAssigneeId] = useState('')
  const [assigneeName, setAssigneeName] = useState('')
  const [decisionId, setDecisionId] = useState(defaultDecisionId)
  const [status, setStatus] = useState<Task['status']>('planned')
  const [actualStartDate, setActualStartDate] = useState('')
  const selectedDecision = decisions.find(d => d.id === decisionId)
  const changeDecision = (id: string) => { setDecisionId(id); const unit = availableUnits(decisions.find(d => d.id === id))[0]; if (unit) { setUnitChoice(initialUnitChoice(unit)); setOtherUnit(initialUnitChoice(unit) === 'Diğer' ? unit : ''); setAssigneeId(''); setAssigneeName('') } }
  const changeStatus = (next: Task['status']) => { setStatus(next); if (next !== 'planned' && !actualStartDate) setActualStartDate(todayValue()) }
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr('')
    const f = new FormData(e.currentTarget)
    try {
      await onSave({ decisionId, title: String(f.get('title')), unit: unitChoice === 'Diğer' ? otherUnit.trim() : unitChoice, assigneeId: assigneeId || undefined, assigneeName, status, dueDate: optionalFormValue(f, 'dueDate'), actualStartDate: actualStartDate || undefined, actualEndDate: optionalFormValue(f, 'actualEndDate'), waitingReason: optionalFormValue(f, 'waitingReason'), nextAction: optionalFormValue(f, 'nextAction'), completionDescription: optionalFormValue(f, 'completionDescription'), cancellationReason: optionalFormValue(f, 'cancellationReason'), priority: String(f.get('priority')) as Task['priority'] })
    } catch (e) { setErr(errorMessage(e, 'Görev kaydedilemedi.')); setBusy(false) }
  }
  if (!decisions.length) return <Modal title="Yeni uygulama görevi" subtitle="Her sorumlu müdürlük için bir görev oluşturulabilir" onClose={onClose}><Empty icon={ListChecks} title="Görev atanabilecek karar yok" text="Uygulama gerektiren kararlardaki tüm sorumlu müdürlüklere görev atanmış." /></Modal>
  return <Modal title="Yeni uygulama görevi" subtitle="Görevi müdürlük ve sorumlu kişiyle ilişkilendirin" onClose={onClose}>
    <form className="form" onSubmit={submit}>
      <Field label="Bağlı karar"><select value={decisionId} onChange={e => changeDecision(e.target.value)} required><option value="">Karar seçin</option>{decisions.map(d => <option value={d.id} key={d.id}>{d.packageNo} / {d.itemNo} — {d.title}</option>)}</select></Field>
      {selectedDecision && <div className="task-context"><FileText /><div><span>Görev atanmamış müdürlükler</span><strong>{availableUnits(selectedDecision).join(', ')}</strong><small>Bu karar için yalnızca henüz görev açılmamış müdürlükler seçilebilir.</small></div></div>}
      <Field label="Görev başlığı"><input name="title" required /></Field>
      {selectedDecision ? <AssignmentFields unitChoice={unitChoice} setUnitChoice={setUnitChoice} otherUnit={otherUnit} setOtherUnit={setOtherUnit} assigneeId={assigneeId} setAssigneeId={setAssigneeId} onAssigneeName={setAssigneeName} allowedUnits={availableUnits(selectedDecision)} /> : <div className="alert info"><ListChecks />Sorumlu müdürlüğü seçebilmek için önce bağlı kararı seçin.</div>}
      <div className="form-row two"><Field label="Durum"><select value={status} onChange={e => changeStatus(e.target.value as Task['status'])}>{Object.entries(taskLabels).filter(([key]) => role !== 'staff' || key === 'planned').map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></Field><Field label="Öncelik"><select name="priority"><option value="normal">Normal</option><option value="high">Yüksek</option><option value="low">Düşük</option></select></Field></div>
      {status !== 'planned' && <Field label="Gerçek başlangıç tarihi"><input type="date" value={actualStartDate} onChange={e => setActualStartDate(e.target.value)} required /></Field>}
      <Field label="Hedef bitiş tarihi"><input type="date" name="dueDate" /></Field>
      {['waiting_reply','waiting_approval'].includes(status) && <Field label="Bekleme nedeni"><textarea name="waitingReason" rows={2} required /></Field>}
      {status !== 'planned' && <Field label="Sonraki işlem"><textarea name="nextAction" rows={2} /></Field>}
      {status === 'completed' && <div className="completion-fields"><Field label="Gerçekleşme tarihi"><input type="date" name="actualEndDate" defaultValue={todayValue()} required /></Field><Field label="Gerçekleşme açıklaması"><textarea name="completionDescription" rows={3} required /></Field></div>}
      {status === 'cancelled' && <Field label="İptal gerekçesi"><textarea name="cancellationReason" rows={3} required /></Field>}
      {err && <div className="alert error"><XCircle />{err}</div>}
      <FormActions onClose={onClose} busy={busy} />
    </form>
  </Modal>
}

function AssignmentFields({ unitChoice, setUnitChoice, otherUnit, setOtherUnit, assigneeId, setAssigneeId, onAssigneeName, allowedUnits }: { unitChoice: UnitChoice; setUnitChoice: (value: UnitChoice) => void; otherUnit: string; setOtherUnit: (value: string) => void; assigneeId: string; setAssigneeId: (value: string) => void; onAssigneeName: (value: string) => void; allowedUnits?: string[] }) {
  const [people, setPeople] = useState<AssignableProfile[]>([])
  const [peopleError, setPeopleError] = useState('')
  const unit = unitChoice === 'Diğer' ? otherUnit.trim() : unitChoice
  useEffect(() => {
    let active = true
    setPeople([]); setPeopleError('')
    if (unit) listAssignableProfiles(unit).then(rows => { if (active) setPeople(rows) }).catch(error => { if (active) setPeopleError(errorMessage(error, 'Kullanıcılar yüklenemedi.')) })
    return () => { active = false }
  }, [unit])
  const changeUnit = (value: UnitChoice) => { setUnitChoice(value); setAssigneeId(''); onAssigneeName('') }
  const visibleUnits = allowedUnits?.length ? [...new Set(allowedUnits.map(initialUnitChoice))] : [...taskUnitOptions]
  return <div className="assignment-fields">
    <div className="form-row two">
      <Field label="Sorumlu birim"><select value={unitChoice} onChange={e => changeUnit(e.target.value as UnitChoice)}>{visibleUnits.map(unit => <option key={unit}>{unit}</option>)}</select></Field>
       <Field label="Sorumlu kişi (isteğe bağlı)"><select value={assigneeId} onChange={e => { const id = e.target.value; setAssigneeId(id); onAssigneeName(people.find(person => person.id === id)?.fullName || '') }}><option value="">Kişi seçilmedi</option>{people.map(person => <option value={person.id} key={person.id}>{person.fullName}</option>)}</select><small>{peopleError || (!people.length ? 'Bu müdürlükte atanabilir kullanıcı hesabı bulunmuyor.' : 'Kişi hesap kimliğiyle atanır.')}</small></Field>
    </div>
    {unitChoice === 'Diğer' && <Field label="Diğer müdürlük adı"><input value={otherUnit} onChange={e => { setOtherUnit(e.target.value); setAssigneeId(''); onAssigneeName('') }} placeholder="Müdürlük adını yazın" required /></Field>}
  </div>
}

function MultiUnitSelect({ selected, onChange }: { selected: string[]; onChange: (units: string[]) => void }) {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
  const visibleUnits = municipalDirectorates.filter(unit => unit.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
  const toggle = (unit: string) => onChange(selected.includes(unit) ? selected.filter(value => value !== unit) : [...selected, unit])

  return <fieldset className="multi-unit-selector">
    <legend>Sorumlu müdürlükler <b aria-hidden="true">*</b></legend>
    <details className="multi-unit-dropdown">
      <summary><span>{selected.length ? `${selected.length} müdürlük seçildi` : 'Müdürlük seçin'}</span><ChevronDown /></summary>
      <div className="multi-unit-menu">
        <div className="multi-unit-toolbar">
          <label className="multi-unit-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Müdürlük ara…" aria-label="Müdürlük ara" /></label>
          <span>{selected.length ? `${selected.length} seçim` : 'Seçim yapılmadı'}</span>
        </div>
        <div className="multi-unit-list">
          {visibleUnits.map((unit, index) => <label className={`multi-unit-option ${index < 2 && !search ? 'priority-unit' : ''}`} key={unit}>
            <input type="checkbox" aria-label={unit} checked={selected.includes(unit)} onChange={() => toggle(unit)} />
            <span>{unit}</span>
          </label>)}
          {!visibleUnits.length && <div className="multi-unit-empty">Aramayla eşleşen müdürlük bulunamadı.</div>}
        </div>
      </div>
    </details>
    {selected.length > 0 && <div className="selected-unit-chips">{selected.map(unit => <button type="button" key={unit} onClick={() => toggle(unit)} title="Seçimi kaldır">{unit}<X /></button>)}</div>}
    <small>Menüyü açarak birden fazla müdürlük seçebilirsiniz.</small>
  </fieldset>
}

function TaskStatusModal({ task, role, decision, onViewDecision, onClose, onSave }: { task: Task; role: AppRole; decision?: Decision; onViewDecision: () => void; onClose: () => void; onSave: (task: Task) => Promise<void> }) {
  const [status, setStatus] = useState<Task['status']>(task.status)
  const [actualStartDate, setActualStartDate] = useState(task.actualStartDate || '')
  const [unitChoice, setUnitChoice] = useState<UnitChoice>(initialUnitChoice(task.unit))
  const [otherUnit, setOtherUnit] = useState(initialUnitChoice(task.unit) === 'Diğer' ? task.unit : '')
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '')
  const [assigneeName, setAssigneeName] = useState(task.assigneeName || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const waiting = ['waiting_reply', 'waiting_approval'].includes(status)
  const completion = status === 'completed'

  const changeStatus = (next: Task['status']) => {
    setStatus(next)
    if (next !== 'planned' && !actualStartDate) setActualStartDate(todayValue())
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr('')
    const f = new FormData(e.currentTarget)
    try {
      await onSave({
        ...task,
        unit: role === 'staff' ? task.unit : unitChoice === 'Diğer' ? otherUnit.trim() : unitChoice,
        assigneeId: role === 'staff' ? task.assigneeId : assigneeId === (task.assigneeId || '') ? task.assigneeId : assigneeId || null,
        assigneeName: role === 'staff' ? task.assigneeName : assigneeName,
        status,
        actualStartDate: actualStartDate || undefined,
        dueDate: optionalFormValue(f, 'dueDate'),
        waitingReason: waiting ? optionalFormValue(f, 'waitingReason') : undefined,
        nextAction: optionalFormValue(f, 'nextAction'),
        actualEndDate: completion ? optionalFormValue(f, 'actualEndDate') : undefined,
        completionDescription: completion ? optionalFormValue(f, 'completionDescription') : undefined,
        cancellationReason: status === 'cancelled' ? optionalFormValue(f, 'cancellationReason') : undefined,
        priority: String(f.get('priority')) as Task['priority'],
      })
    } catch (e) { setErr(errorMessage(e, 'Görev durumu güncellenemedi.')); setBusy(false) }
  }

  return <Modal title="Görev durumunu güncelle" subtitle="Başlangıç, bekleme ve gerçekleşme bilgilerini kaydedin" onClose={onClose}>
    <form className="form" onSubmit={submit}>
      <div className="task-context"><ListChecks /><div><span>{decision ? `${decision.packageNo} / Karar ${decision.itemNo}` : 'Bağlı karar'}</span><strong>{task.title}</strong><small>{task.assigneeName || 'Sorumlu kişi belirlenmedi'} · {task.unit}</small></div>{decision && <button type="button" className="secondary" onClick={onViewDecision}>Kararı aç</button>}</div>
      {role === 'staff' ? <div className="alert info"><Building2 />{task.unit} · {task.assigneeName || 'Sorumlu kişi belirlenmedi'}</div> : <AssignmentFields unitChoice={unitChoice} setUnitChoice={setUnitChoice} otherUnit={otherUnit} setOtherUnit={setOtherUnit} assigneeId={assigneeId} setAssigneeId={setAssigneeId} onAssigneeName={setAssigneeName} allowedUnits={decision ? [...new Set([task.unit, ...getDecisionUnits(decision)])] : undefined} />}
      <div className="form-row two">
        <Field label="Görev durumu"><select value={status} onChange={e => changeStatus(e.target.value as Task['status'])}>{Object.entries(taskLabels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></Field>
        <Field label="Gerçek başlangıç tarihi"><input type="date" value={actualStartDate} onChange={e => setActualStartDate(e.target.value)} required={status !== 'planned'} /><small>{status === 'planned' ? 'İş henüz başlamadıysa boş bırakılabilir.' : 'Başlatılan görevlerde zorunludur.'}</small></Field>
      </div>
      <div className="form-row two"><Field label="Hedef bitiş tarihi"><input type="date" name="dueDate" defaultValue={task.dueDate} /></Field><Field label="Öncelik"><select name="priority" defaultValue={task.priority}><option value="normal">Normal</option><option value="high">Yüksek</option><option value="low">Düşük</option></select></Field></div>
      {waiting && <Field label="Bekleme nedeni"><textarea name="waitingReason" defaultValue={task.waitingReason} rows={2} required placeholder="Beklenen cevap veya onayı açıklayın" /></Field>}
      <Field label="Sonraki işlem"><textarea name="nextAction" defaultValue={task.nextAction} rows={2} placeholder="Görev için yapılacak sıradaki işlemi yazın" /></Field>
      {completion && <div className="completion-fields"><Field label="Gerçekleşme tarihi"><input type="date" name="actualEndDate" defaultValue={task.actualEndDate || todayValue()} required /></Field><Field label="Gerçekleşme açıklaması"><textarea name="completionDescription" defaultValue={task.completionDescription} rows={3} required /></Field></div>}
      {status === 'cancelled' && <Field label="İptal gerekçesi"><textarea name="cancellationReason" defaultValue={task.cancellationReason} rows={3} required /></Field>}
      {err && <div className="alert error"><XCircle />{err}</div>}
      <FormActions onClose={onClose} busy={busy} />
    </form>
  </Modal>
}

function CorrespondenceModal({ decisions, tasks, initialDecisionId, correspondence, onClose, onSave }: { decisions:Decision[]; tasks:Task[]; initialDecisionId?:string; correspondence?:Correspondence; onClose:()=>void; onSave:(c:Omit<Correspondence,'id'>)=>Promise<void> }) {
  const [busy,setBusy]=useState(false); const [err,setErr]=useState(''); const [status,setStatus]=useState<Correspondence['status']>(correspondence?.status||'draft')
  const [decisionId,setDecisionId]=useState(correspondence?.decisionId||initialDecisionId||'')
  const [taskId,setTaskId]=useState(correspondence?.taskId||'')
  const relatedTasks=tasks.filter(task=>task.decisionId===decisionId)
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setErr('');const f=new FormData(e.currentTarget);try{await onSave({decisionId,taskId:taskId||undefined,direction:String(f.get('direction')) as Correspondence['direction'],status,documentNo:String(f.get('documentNo')),date:String(f.get('date')),subject:String(f.get('subject')),unit:String(f.get('unit')),replyExpected:f.get('replyExpected')==='on',sentAt:correspondence?.sentAt})}catch(e){setErr(errorMessage(e, 'Yazışma kaydedilemedi.'));setBusy(false)}}
  return <Modal title={correspondence?'Yazışmayı düzenle':'Yazışma ekle'} subtitle="Yazışmayı karara ve gerekirse uygulama görevine bağlayın" onClose={onClose}><form className="form" onSubmit={submit}><Field label="Bağlı karar"><select value={decisionId} onChange={e=>{setDecisionId(e.target.value);setTaskId('')}} required><option value="">Karar seçin</option>{decisions.map(d=><option value={d.id} key={d.id}>{d.packageNo} / {d.itemNo} — {d.title}</option>)}</select></Field><Field label="Bağlı görev (isteğe bağlı)"><select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">Karara genel olarak bağlı</option>{relatedTasks.map(task=><option value={task.id} key={task.id}>{task.title} — {taskLabels[task.status]}</option>)}</select></Field><div className="form-row two"><Field label="Yazışma yönü"><select name="direction" defaultValue={correspondence?.direction||'outgoing'}><option value="outgoing">Giden</option><option value="incoming">Gelen</option></select></Field><Field label="Kayıt durumu"><select value={status} onChange={e=>setStatus(e.target.value as Correspondence['status'])}><option value="draft">Taslak hazırlandı</option><option value="sent">Resmî yazı gönderildi</option><option value="received">Resmî yazı alındı</option></select></Field></div><Field label="Konu"><input name="subject" defaultValue={correspondence?.subject} required /></Field><div className="form-row two"><Field label="Evrak sayısı"><input name="documentNo" defaultValue={correspondence?.documentNo} required={status==='sent'} /></Field><Field label="Evrak tarihi"><input name="date" type="date" defaultValue={correspondence?.date||todayValue()} required /></Field></div><Field label="Gönderen / alıcı birim"><input name="unit" defaultValue={correspondence?.unit} required /></Field><label className="checkbox"><input name="replyExpected" type="checkbox" defaultChecked={correspondence?.replyExpected} />Bu yazı için cevap bekleniyor</label>{err&&<div className="alert error"><XCircle />{err}</div>}<FormActions onClose={onClose} busy={busy}/></form></Modal>
}

function OfficialDecisionModal({ decision, tasks, onClose }: { decision: Decision; tasks: Task[]; onClose: () => void }) {
  const units = getDecisionUnits(decision)
  const printDoc = () => {
    window.print()
  }

  return (
    <div className="modal-layer official-doc-modal-layer" role="dialog" aria-modal="true">
      <div className="modal official-doc-modal">
        <div className="official-doc-toolbar no-print">
          <h3><FileText /> Resmî Karar Tutanağı Önizleme</h3>
          <div className="official-doc-toolbar-actions">
            <button className="primary" onClick={printDoc}>
              <Printer /> Yazdır / PDF Olarak Kaydet
            </button>
            <button className="secondary" onClick={onClose}>
              <X /> Kapat
            </button>
          </div>
        </div>
        <div className="official-doc-scroll">
          <div className="official-doc-page">
            <img className="official-doc-watermark" src="/kutahya-belediyesi-amblemi.png" alt="" aria-hidden="true" />
            <header className="official-doc-header">
              <img className="official-doc-logo" src="/kutahya-belediyesi-amblemi.png" alt="Kütahya Belediyesi Logosu" />
              <div className="official-doc-header-sub">T.C.</div>
              <div className="official-doc-header-title">KÜTAHYA BELEDİYE BAŞKANLIĞI</div>
              <div className="official-doc-header-unit">Ulaşım Hizmetleri Müdürlüğü</div>
              <div className="official-doc-header-decree">İL TRAFİK KOMİSYONU KARAR TUTANAĞI</div>
            </header>

            <table className="official-doc-meta-table">
              <tbody>
                <tr>
                  <td className="label-cell">Üst Karar No / Paket</td>
                  <td className="value-cell"><strong>{decision.packageNo}</strong></td>
                  <td className="label-cell">Karar Madde No</td>
                  <td className="value-cell"><strong>Karar {decision.itemNo}</strong></td>
                </tr>
                <tr>
                  <td className="label-cell">Karar Tarihi</td>
                  <td className="value-cell">{formatDate(decision.date)}</td>
                  <td className="label-cell">Karar Sonucu</td>
                  <td className="value-cell">
                    <ResultBadge value={decision.result} />
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">Konu ve Başlık</td>
                  <td className="value-cell" colSpan={3}><strong>{decision.title}</strong></td>
                </tr>
                <tr>
                  <td className="label-cell">Mahalle / Konum</td>
                  <td className="value-cell" colSpan={3}>
                    {[decision.neighborhood ? `${decision.neighborhood} Mahallesi` : '', ...decision.locations].filter(Boolean).join(', ') || 'İl Geneli / Konum Belirtilmemiş'}
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">Sorumlu Müdürlük(ler)</td>
                  <td className="value-cell" colSpan={3}>
                    {units.length ? units.join(', ') : 'Belirtilmedi'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="official-doc-section">
              <h4 className="official-doc-section-title">1. TEKLİF VE TALEP METNİ</h4>
              <div className="official-doc-section-body">{decision.proposal || 'Teklif metni bulunmuyor.'}</div>
            </div>

            <div className="official-doc-section">
              <h4 className="official-doc-section-title">2. KOMİSYON KARARI VE HÜKÜM</h4>
              <div className="official-doc-section-body">{decision.decisionText}</div>
              {decision.conditions && (
                <div className="official-doc-condition-box">
                  <strong>Ön Koşul ve Dış Kurum Onayı:</strong> {decision.conditions}
                </div>
              )}
              <div className="official-doc-verdict-closing">
                İl Trafik Komisyonu Başkanlığınca karar verilmiştir.
              </div>
            </div>

            {decision.result !== 'rejected' && tasks.length > 0 && (
              <div className="official-doc-section">
                <h4 className="official-doc-section-title">3. SAHA UYGULAMA GÖREVLERİ</h4>
                <div className="official-doc-section-body">
                  {tasks.map(task => (
                    <div key={task.id} style={{ marginBottom: '6px' }}>
                      • <strong>{task.title}</strong> ({task.unit} {task.assigneeName ? `— ${task.assigneeName}` : ''}) — <em>{taskLabels[task.status]}</em>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <footer className="official-doc-footer">
              <span>Evrak Üretim Tarihi: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Kütahya Belediyesi İl Trafik Komisyonu Karar Takip Sistemi</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

function Modal({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:React.ReactNode}) { return <div className="modal-layer" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose}><X /></button></div>{children}</div></div> }
function SubjectTitleField({ defaultValue = '', existingTitles }: { defaultValue?: string; existingTitles: string[] }) {
  const [value, setValue] = useState(() => formatSubjectTitle(defaultValue))
  const suggestions = findSubjectTitleSuggestions(value, existingTitles)
  return <div className="field subject-title-field">
    <label htmlFor="decision-title">Kısa konu başlığı</label>
    <div className="subject-title-input">
      <input id="decision-title" name="title" value={value} onChange={event => setValue(formatSubjectTitle(event.target.value))} autoComplete="off" aria-autocomplete="list" aria-controls="subject-title-suggestions" aria-expanded={suggestions.length > 0} required />
      {suggestions.length > 0 && <div className="subject-title-suggestions" id="subject-title-suggestions" role="listbox" aria-label="Önceki konu başlıkları">
        <span>Önceki başlıklardan eşleşenler</span>
        {suggestions.map(title => <button type="button" role="option" aria-selected="false" key={title} onMouseDown={event => event.preventDefault()} onClick={() => setValue(title)}>{title}</button>)}
      </div>}
    </div>
    <small>Başlık otomatik olarak büyük harfe dönüştürülür.</small>
  </div>
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="field"><span>{label}</span>{children}</label> }
function NeighborhoodSelect({ defaultValue = '' }: { defaultValue?: string }) { return <Field label="Mahalle (isteğe bağlı)"><select name="neighborhood" defaultValue={defaultValue}><option value="">İl geneli / Belirtilmemiş</option>{kutahyaNeighborhoods.map(neighborhood => <option value={neighborhood} key={neighborhood}>{neighborhood} Mahallesi</option>)}</select></Field> }
function LocationsField({ defaultValue = '' }: { defaultValue?: string }) { const [value, setValue] = useState(() => formatLocationText(defaultValue)); return <Field label="Konumlar"><input name="locations" value={value} onChange={event => setValue(formatLocationText(event.target.value))} placeholder="Meydan Kavşağı, Osmanlı Caddesi" /><small>Birden fazla konumu virgülle ayırın. Sözcükler otomatik biçimlendirilir.</small></Field> }
function FormActions({onClose,busy}:{onClose:()=>void;busy:boolean}) { return <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Vazgeç</button><button className="primary" disabled={busy}>{busy?<Loader2 className="spin"/>:<CheckCircle2/>}{busy?'Kaydediliyor…':'Kaydet'}</button></div> }
function ResultBadge({value}:{value:DecisionResult}) { return <span className={`badge result-${value}`}>{value==='rejected'?<XCircle/>:<CheckCircle2/>}{resultLabels[value]}</span> }
function StatusBadge({value}:{value:ApplicationStatus}) { return <span className={`badge status-${value}`}><Clock3 />{statusLabels[value]}</span> }
function Empty({icon:Icon,title,text,action}:{icon:typeof Search;title:string;text:string;action?:()=>void}) { return <div className="empty"><Icon/><strong>{title}</strong><span>{text}</span>{action&&<button className="secondary" onClick={action}>Kayıt ekle</button>}</div> }
function formatDate(date:string) { if(!date)return '—'; return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(`${date}T12:00:00`)) }
function todayValue() { return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date()) }
function groupBy<T>(items:T[], key:(item:T)=>string):Record<string,T[]> { return items.reduce<Record<string,T[]>>((acc,item)=>{ const group=key(item); (acc[group] ||= []).push(item); return acc },{}) }
function downloadCsv(title: string, headers: string[], rows: (string | number)[][]) { const escape = (value: string | number) => `"${String(value).replaceAll('"','""')}"`; const content = `\uFEFF${[['Rapor',title],['Üretim tarihi',todayValue()],[],headers,...rows].map(row=>row.map(escape).join(';')).join('\r\n')}`; const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download=`${title.toLocaleLowerCase('tr-TR').replaceAll(' ','-')}.csv`; link.click(); URL.revokeObjectURL(url) }

function LoginScreen() { const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');const{error}=await supabase!.auth.signInWithPassword({email,password});if(error){setError('Giriş bilgileri doğrulanamadı.');setBusy(false)}};return <div className="auth-page"><div className="auth-brand"><img className="brand-seal large" src="/kutahya-belediyesi-amblemi.png" alt="Kütahya Belediyesi logosu"/><h1>İl Trafik Komisyonu<br/>Karar Takip Sistemi</h1><p>Kütahya Belediyesi Ulaşım Hizmetleri Müdürlüğü</p></div><form className="auth-card" onSubmit={submit}><h2>Yetkili girişi</h2><p>Kurum hesabınızla devam edin.</p><Field label="E-posta adresi"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Parola"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></Field>{error&&<div className="alert error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?<Loader2 className="spin"/>:<ShieldCheck/>}Giriş yap</button></form></div> }
function SetupScreen() { return <div className="setup-page"><div className="setup-card"><div className="setup-icon"><Settings /></div><h1>Supabase bağlantısı hazırlanmalı</h1><p>Uygulama kodu hazır. Canlı kayıtları kullanmak için proje publishable anahtarını <code>.env</code> dosyasına ekleyin ve migration dosyasını Supabase SQL Editor üzerinden çalıştırın.</p><pre>VITE_SUPABASE_URL=https://fhbrazpnbmgyfpqmfjej.supabase.co{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=...</pre><span>Gizli veya service_role anahtarını tarayıcı yapılandırmasına eklemeyin.</span></div></div> }

export default App
