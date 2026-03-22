import { useState, useRef, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ChatPanel from './components/ChatPanel'
import Documents from './pages/Documents'
import Timeline from './pages/Timeline'
import { listDocuments } from './services/api'

const WIDTH_KEY   = 'ffu-chat-width'
const VISIBLE_KEY = 'ffu-chat-visible'
const readWidth   = () => { try { return parseInt(localStorage.getItem(WIDTH_KEY) || '340', 10) } catch { return 340 } }
const readVisible = () => { try { return localStorage.getItem(VISIBLE_KEY) !== 'false' } catch { return true } }

export default function App() {
  const [chatWidth,   setChatWidth]   = useState(readWidth)
  const [chatVisible, setChatVisible] = useState(readVisible)
  const [pdfWidth,    setPdfWidth]    = useState(560)
  const [docs,        setDocs]        = useState([])

  const [context, setContext] = useState([])  // array of { text, source }

  const openDocByNameRef = useRef(null)
  const currentDocRef = useRef(null)   // filename of currently previewed doc
  const currentPageRef = useRef(null)  // current page number in PDF viewer

  // Ref updated every render — the keydown handler always sees the latest setters
  const actionRef = useRef(null)
  actionRef.current = { setContext, setChatVisible, currentDocRef, currentPageRef }

  const show = () => { setChatVisible(true);  try { localStorage.setItem(VISIBLE_KEY, 'true')  } catch {} }
  const hide = () => { setChatVisible(false); try { localStorage.setItem(VISIBLE_KEY, 'false') } catch {} }

  const refreshDocs = () => listDocuments().then(setDocs).catch(() => {})

  // Press "e" with text selected → send selection to chat as context.
  // No cleanup — handler must survive React StrictMode's unmount/remount cycle.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'e' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const sel = window.getSelection()?.toString().trim()
      console.log('[ctx] e pressed | selection:', sel ? `"${sel.slice(0, 60)}…"` : '(empty)', '| actionRef:', !!actionRef.current)
      if (!sel) return
      e.preventDefault()
      const source = actionRef.current?.currentDocRef?.current || ''
      const page = actionRef.current?.currentPageRef?.current || null
      actionRef.current?.setContext(prev => [...prev, { text: sel, source, page }])
      actionRef.current?.setChatVisible(true)
      try { localStorage.setItem(VISIBLE_KEY, 'true') } catch {}
      window.getSelection()?.removeAllRanges()
      console.log('[ctx] context set OK')
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [])

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { refreshDocs() }, [])

  const openDocByFilename = async (filename, page = null, quote = null) => {
    const norm = s => s.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '').trim().toLowerCase()
    const found = docs.find(d => d.filename === filename)
      || docs.find(d => norm(d.filename) === norm(filename))
    if (!found) return
    // Navigate to documents tab if not already there
    if (!location.pathname.startsWith('/documents')) {
      navigate('/documents')
      setTimeout(() => openDocByNameRef.current?.(found, page, quote), 100)
    } else {
      openDocByNameRef.current?.(found, page, quote)
    }
  }

  const handleChatWidthChange = (w) => {
    setChatWidth(w)
    try { localStorage.setItem(WIDTH_KEY, String(w)) } catch {}
  }
  const currentTab = location.pathname.startsWith('/timeline') ? 'timeline' : 'documents'

  const handleNavigateToDoc = (filename, page = null) => {
    navigate('/documents')
    if (filename) {
      setTimeout(() => openDocByFilename(filename, page), 100)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#f0efe9' }}>
      {/* Navbar */}
      <nav className="flex-shrink-0 flex items-center justify-center py-2 gap-1 z-40">
        <button
          onClick={() => navigate('/documents')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            currentTab === 'documents'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Dokument
        </button>
        <button
          onClick={() => navigate('/timeline')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            currentTab === 'timeline'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Tidslinje
        </button>
      </nav>

      <main
        className="flex-1 min-h-0"
        style={{ paddingRight: chatVisible ? `${chatWidth}px` : undefined }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/documents" replace />} />
          <Route
            path="/documents"
            element={
              <Documents
                onProcessed={refreshDocs}
                openDocByNameRef={openDocByNameRef}
                currentDocRef={currentDocRef}
                currentPageRef={currentPageRef}
                chatWidth={chatVisible ? chatWidth : 0}
                pdfWidth={pdfWidth}
                onPdfWidthChange={setPdfWidth}
              />
            }
          />
          <Route
            path="/timeline"
            element={<Timeline onNavigateToDoc={handleNavigateToDoc} />}
          />
        </Routes>
      </main>

      {chatVisible && (
        <ChatPanel
          width={chatWidth}
          onWidthChange={handleChatWidthChange}
          onOpenDoc={openDocByFilename}
          context={context}
          onClearContext={(idx) => idx != null
            ? setContext(prev => prev.filter((_, i) => i !== idx))
            : setContext([])
          }
          docs={docs}
        />
      )}

      <button
        onClick={chatVisible ? hide : show}
        className="fixed flex items-center justify-center bg-indigo-400 hover:bg-indigo-500 text-white font-semibold rounded-l-lg shadow-md overflow-hidden"
        style={{
          right: chatVisible ? `${chatWidth}px` : '0px',
          bottom: '20%',
          width: '26px',
          height: '52px',
        }}
        title={chatVisible ? 'Stäng chatt' : 'Öppna chatt'}
      >
        {/* "Chatt" label — visible when closed */}
        <span style={{
          position: 'absolute',
          writingMode: 'vertical-rl',
          fontSize: '11px',
          letterSpacing: '0.07em',
          opacity: chatVisible ? 0 : 1,
          transform: chatVisible ? 'scale(0.75)' : 'scale(1)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}>
          Chatt
        </span>
        {/* ✕ — visible when open */}
        <span style={{
          position: 'absolute',
          fontSize: '15px',
          lineHeight: 1,
          opacity: chatVisible ? 1 : 0,
          transform: chatVisible ? 'scale(1)' : 'scale(0.75)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}>
          ✕
        </span>
      </button>
    </div>
  )
}
