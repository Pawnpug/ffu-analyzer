import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { listDocuments, streamProcess, getDocument } from '../services/api'
import { DocPdfPane } from '../components/DocPreviewPanel'
import TagsPanel from '../components/TagsPanel'

const RefreshIcon = ({ spinning }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? 'animate-spin' : ''}>
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

// ── Field-mode document row ──────────────────────────────────────────────────
function FieldDocRow({ doc, selected, onClick }) {
  const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
  const displayName = doc.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 transition-all px-4 py-3 ${
        selected ? 'border-indigo-400 bg-indigo-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex-shrink-0 ${isExcel ? 'text-emerald-500' : 'text-red-400'}`}>
          {isExcel
            ? <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          }
        </span>
        <span className="text-sm font-medium text-slate-900 truncate">{displayName}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 ml-auto ${selected ? 'text-indigo-500' : 'text-slate-300'}`}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </button>
  )
}

// ── Field mode view ─────────────────────────────────────────────────────────
function FieldModeView({ docs, previewDoc, onSelectDoc, targetPage, targetQuote, currentPageRef }) {
  return (
    <div className="flex gap-4 h-full">
      {/* Left: document list */}
      <div className="flex-shrink-0 flex flex-col h-full" style={{ width: '300px' }}>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {docs.map(doc => (
            <FieldDocRow
              key={doc.id}
              doc={doc}
              selected={previewDoc?.id === doc.id}
              onClick={() => onSelectDoc(doc)}
            />
          ))}
        </div>
      </div>

      {/* Right: document viewer */}
      <div className="flex-1 h-full min-w-0">
        {previewDoc ? (
          <DocPdfPane doc={previewDoc} targetPage={targetPage} targetQuote={targetQuote} currentPageRef={currentPageRef} />
        ) : (
          <div className="card flex flex-col items-center justify-center h-full text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 mb-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm text-slate-400">Välj ett dokument</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Document row ───────────────────────────────────────────────────────────────
function DocumentRow({ doc, selected, onClick }) {
  const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
  const displayName = doc.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')

  return (
    <button
      onClick={onClick}
      className={`card overflow-hidden !p-0 w-full text-left transition-all group ${
        selected ? '!border-indigo-400 shadow-sm' : 'hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className={`flex-shrink-0 ${isExcel ? 'text-emerald-500' : 'text-red-400'}`}>
          {isExcel
            ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          }
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-slate-900 truncate block">{displayName}</span>
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 transition-colors ${selected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </button>
  )
}

// ── Empty states ───────────────────────────────────────────────────────────────
function EmptyState({ onProcess, processing, processStatus }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#dddcd6] flex items-center justify-center mb-4 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700 mb-1">Inga dokument än</p>
      <p className="text-xs text-slate-400 mb-6 max-w-xs">
        Lägg PDF-filer i mappen <code className="bg-slate-100 px-1 rounded text-slate-600">backend/data/</code> och klicka sedan på bearbeta.
      </p>
      <button onClick={onProcess} disabled={processing} className="btn-accent">
        {processing ? <><RefreshIcon spinning /> {processStatus || 'Bearbetar…'}</> : <>Bearbeta dokument</>}
      </button>
    </div>
  )
}

function PanelPlaceholder({ icon, label }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center h-full">
      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-[#dddcd6] flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function ProcessingBar({ pct, label, phase }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black flex flex-col" style={{ height: '40px' }}>
      <div
        className="h-[3px] bg-white transition-all duration-300 ease-out flex-shrink-0"
        style={{ width: `${pct}%` }}
      />
      <div className="flex items-center gap-3 px-4 flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex-shrink-0">
          {phase === 'extract' ? 'Extraherar' : phase === 'tagging' ? 'Taggar' : 'Bearbetar'}
        </span>
        <span className="text-[11px] text-white truncate flex-1 min-w-0">{label || '…'}</span>
        <span className="text-[11px] tabular-nums text-white/40 flex-shrink-0">{pct}%</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Documents({ onProcessed, openDocByNameRef, currentDocRef, currentPageRef, chatWidth = 0, pdfWidth, onPdfWidthChange }) {
  const [docs,          setDocs]          = useState([])
  const [processing,    setProcessing]    = useState(false)
  const [processStatus, setProcessStatus] = useState('')
  const [loaded,        setLoaded]        = useState(false)
  const [progress,      setProgress]      = useState(null) // null | { pct, label, phase }
  const [previewDoc,    setPreviewDoc]    = useState(null)
  const [targetPage,    setTargetPage]    = useState(null)
  const [targetQuote,   setTargetQuote]   = useState(null)
  const [docListWidth,  setDocListWidth]  = useState(240)
  const [typeFilter,    setTypeFilter]    = useState('all') // 'all' | 'pdf' | 'excel'
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [docSearch,     setDocSearch]     = useState('')
  const [tagsVisible,   setTagsVisible]  = useState(() => { try { return localStorage.getItem('ffu-tags-visible') !== 'false' } catch { return true } })
  const [docListVisible, setDocListVisible] = useState(() => { try { return localStorage.getItem('ffu-doclist-visible') !== 'false' } catch { return true } })
  const [docViewVisible, setDocViewVisible] = useState(() => { try { return localStorage.getItem('ffu-docview-visible') !== 'false' } catch { return true } })
  const [viewMode, setViewMode] = useState(() => { try { return localStorage.getItem('ffu-view-mode') || 'desktop' } catch { return 'desktop' } })
  const settingsRef  = useRef(null)
  const filterBarRef = useRef(null)

  const makeResizeHandler = (getCurrent, setter, min, max) => (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = getCurrent()
    const onMove = (ev) => setter(Math.max(min, Math.min(max, startW + (ev.clientX - startX))))
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const load = async () => {
    try {
      const data = await listDocuments()
      setDocs(data)
    } catch {
      toast.error('Kunde inte hämta dokument')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!settingsOpen) return
    const handler = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [settingsOpen])

  const handleSelectDoc = useCallback(async (doc, page = null, quote = null) => {
    // Clear then re-set so effects re-trigger even for the same value
    setTargetPage(null)
    setTargetQuote(null)
    requestAnimationFrame(() => {
      setTargetPage(page)
      setTargetQuote(quote)
    })
    const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
    if (isExcel) {
      try { setPreviewDoc(await getDocument(doc.id)) }
      catch { setPreviewDoc(doc) }
    } else {
      setPreviewDoc(doc)
    }
  }, [previewDoc])

  useEffect(() => {
    if (openDocByNameRef) openDocByNameRef.current = handleSelectDoc
  }, [openDocByNameRef, handleSelectDoc])

  useEffect(() => {
    if (currentDocRef) currentDocRef.current = previewDoc?.filename || null
  }, [currentDocRef, previewDoc])

  const handleProcess = async () => {
    setProcessing(true)
    setProcessStatus('Förbereder…')
    setProgress({ pct: 0, label: '', phase: 'extract' })
    try {
      await streamProcess({
        onPhase: (phase, total) => {
          const label = phase === 'tagging' ? 'Taggar' : 'Extraherar'
          setProcessStatus(`${label} dokument… (0 / ${total})`)
          setProgress({ pct: 0, label: '', phase })
        },
        onExtracted: (filename, count, total) => {
          setProcessStatus(`Extraherar dokument… (${count} / ${total})`)
          setProgress({ pct: Math.round(count / total * 100), label: filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, ''), phase: 'extract' })
        },
        onTagged: (filename, count, total) => {
          setProcessStatus(`Taggar dokument… (${count} / ${total})`)
          setProgress({ pct: Math.round(count / total * 100), label: filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, ''), phase: 'tagging' })
        },
        onDone: async (count) => {
          setProgress({ pct: 100, label: '', phase: 'tagging' })
          toast.success(`${count} dokument bearbetade`)
          await load()
          setPreviewDoc(null)
          onProcessed?.()
          setTimeout(() => setProgress(null), 800)
        },
        onError: (msg) => { toast.error(`Fel: ${msg}`); setProgress(null) },
      })
    } catch (e) {
      toast.error(`Fel: ${e.message}`)
      setProgress(null)
    } finally {
      setProcessing(false)
      setProcessStatus('')
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshIcon spinning />
        <span className="ml-2 text-sm text-slate-500">Laddar…</span>
      </div>
    )
  }

  const pdfIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  )

  return (
    <div className="pr-6 page-enter h-full overflow-hidden" style={{ paddingLeft: '50px', paddingTop: progress ? '40px' : '10px' }}>
      {progress && <ProcessingBar pct={progress.pct} label={progress.label} phase={progress.phase} />}
      {/* Settings gear — fixed top-left */}
      <div className="fixed top-3 left-3 z-50" ref={settingsRef}>
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className={`p-2 rounded-lg transition-colors ${settingsOpen ? 'text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
          title="Inställningar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {settingsOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-52 card !p-2 shadow-lg z-50 space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-0.5">Visningsläge</p>
            <button
              onClick={() => {
                const next = viewMode === 'desktop' ? 'field' : 'desktop'
                setViewMode(next)
                try { localStorage.setItem('ffu-view-mode', next) } catch {}
                setSettingsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {viewMode === 'desktop' ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Byt till Fält-läge
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Byt till Skrivbordsläge
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <EmptyState onProcess={handleProcess} processing={processing} processStatus={processStatus} />
      ) : viewMode === 'field' ? (
        <FieldModeView
          docs={docs}
          previewDoc={previewDoc}
          onSelectDoc={handleSelectDoc}
          targetPage={targetPage}
          targetQuote={targetQuote}
          currentPageRef={currentPageRef}
        />
      ) : (
        <div className="flex items-start h-full pb-2">

          {/* Col 1: document list or collapsed icon */}
          {docListVisible ? (
            <div className="flex-shrink-0 flex flex-col h-full" style={{ width: `${docListWidth}px` }}>
              {/* Header with collapse chevron */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dokument</span>
                <button
                  onClick={() => { setDocListVisible(false); try { localStorage.setItem('ffu-doclist-visible', 'false') } catch {} }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Dölj dokumentlista"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
              </div>
              {/* Filter toggles */}
              <div ref={filterBarRef} className="flex gap-1.5 mb-2">
                <button
                  onClick={() => setTypeFilter(f => f === 'pdf' ? 'all' : 'pdf')}
                  title="Visa bara PDF"
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                    typeFilter === 'pdf'
                      ? 'bg-red-50 border-red-300 text-red-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-400'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  PDF
                </button>
                <button
                  onClick={() => setTypeFilter(f => f === 'excel' ? 'all' : 'excel')}
                  title="Visa bara Excel"
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                    typeFilter === 'excel'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200 hover:text-emerald-400'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/>
                  </svg>
                  Excel
                </button>
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`flex items-center px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                    typeFilter === 'all'
                      ? 'bg-slate-100 border-slate-300 text-slate-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                  }`}
                >
                  Visa alla
                </button>
              </div>

              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Sök dokument…"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder-slate-400 mb-1.5"
              />

              <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                {docs
                  .filter(doc => {
                    if (typeFilter !== 'all') {
                      const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
                      if (typeFilter === 'excel' ? !isExcel : isExcel) return false
                    }
                    if (docSearch) return doc.filename.toLowerCase().includes(docSearch.toLowerCase())
                    return true
                  })
                  .map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      selected={previewDoc?.id === doc.id}
                      onClick={() => handleSelectDoc(doc)}
                    />
                  ))
                }
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setDocListVisible(true); try { localStorage.setItem('ffu-doclist-visible', 'true') } catch {} }}
              className="flex-shrink-0 self-start p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
              title="Visa dokumentlista"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          )}

          {/* Handle: between doc list and PDF */}
          {docListVisible && docViewVisible && (
            <div
              className="flex-shrink-0 w-1.5 self-stretch cursor-col-resize mx-1 rounded group"
              style={{ userSelect: 'none' }}
              onMouseDown={(e) => {
                const minW = filterBarRef.current
                  ? Math.ceil(filterBarRef.current.getBoundingClientRect().width)
                  : 140
                makeResizeHandler(() => docListWidth, setDocListWidth, minW, 520)(e)
              }}
            >
              <div className="h-full w-full rounded group-hover:bg-indigo-300 transition-colors" />
            </div>
          )}

          {/* Col 2: PDF viewer or collapsed icon */}
          {docViewVisible ? (
            <div className="flex-shrink-0 h-full" style={{ width: `${pdfWidth}px` }}>
              {previewDoc
                ? <DocPdfPane doc={previewDoc} targetPage={targetPage} targetQuote={targetQuote} currentPageRef={currentPageRef}
                    onClose={() => { setDocViewVisible(false); try { localStorage.setItem('ffu-docview-visible', 'false') } catch {} }}
                  />
                : <PanelPlaceholder icon={pdfIcon} label="Välj ett dokument" />
              }
            </div>
          ) : (
            <button
              onClick={() => { setDocViewVisible(true); try { localStorage.setItem('ffu-docview-visible', 'true') } catch {} }}
              className="flex-shrink-0 self-start p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
              title="Visa dokumentvy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
          )}

          {/* Handle: right of PDF */}
          {docViewVisible && (
            <div
              className="flex-shrink-0 w-1.5 self-stretch cursor-col-resize mx-1 rounded group"
              style={{ userSelect: 'none' }}
              onMouseDown={(e) => {
                e.preventDefault()
                const startX    = e.clientX
                const startPdfW = pdfWidth
                const chatLeft  = window.innerWidth - chatWidth
                const maxPdf    = Math.max(300, chatLeft - (docListVisible ? docListWidth : 40) - 40)
                const onMove = (ev) => {
                  onPdfWidthChange(Math.max(300, Math.min(maxPdf, startPdfW + (ev.clientX - startX))))
                }
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              <div className="h-full w-full rounded group-hover:bg-indigo-300 transition-colors" />
            </div>
          )}

          {/* Tag icon — only visible when tags are collapsed */}
          {previewDoc && !tagsVisible && (
            <button
              onClick={() => { setTagsVisible(true); try { localStorage.setItem('ffu-tags-visible', 'true') } catch {} }}
              className="flex-shrink-0 self-start p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
              title="Visa taggar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </button>
          )}

          {/* Col 3: Tags panel */}
          {previewDoc && tagsVisible && (
            <div className="flex-1 min-w-[200px] max-w-[300px] h-full overflow-y-auto">
              <TagsPanel
                docId={previewDoc.id}
                onNavigateToPage={(page) => {
                  setTargetPage(page)
                  setTargetQuote(null)
                }}
                onClose={() => { setTagsVisible(false); try { localStorage.setItem('ffu-tags-visible', 'false') } catch {} }}
              />
            </div>
          )}

        </div>
      )}
    </div>
  )
}
