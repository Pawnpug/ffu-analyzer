import { useState, useEffect } from 'react'
import { getDocumentTags } from '../services/api'

const CATEGORIES = [
  {
    key: 'date',
    label: 'Viktiga datum',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    chipClass: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
    pageClass: 'text-amber-400',
  },
  {
    key: 'entity',
    label: 'Aktörer',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    chipClass: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',
    pageClass: 'text-sky-400',
  },
  {
    key: 'risk',
    label: 'Risker',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    chipClass: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
    pageClass: 'text-red-400',
  },
]

export default function TagsPanel({ docId, onNavigateToPage, onClose }) {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    if (!docId) { setTags([]); return }
    setLoading(true)
    getDocumentTags(docId).then(setTags).catch(() => setTags([])).finally(() => setLoading(false))
  }, [docId])

  const grouped = {}
  for (const c of CATEGORIES) grouped[c.key] = []
  for (const t of tags) grouped[t.category]?.push(t)

  const isEmpty = tags.length === 0

  return (
    <div className="card !p-0 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
      <div className="px-3 py-2 border-b border-[#dddcd6] flex-shrink-0 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Taggar</span>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Dölj taggar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      <div className="overflow-y-auto p-3 space-y-1 flex-1 min-h-0">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-slate-400">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span className="text-xs text-slate-400">Laddar taggar…</span>
          </div>
        )}

        {!loading && isEmpty && (
          <p className="text-xs text-slate-400 text-center py-8">Inga taggar. Bearbeta dokument för att generera.</p>
        )}

        {!loading && !isEmpty && CATEGORIES.map(cat => {
          const items = grouped[cat.key]
          if (!items.length) return null
          const isOpen = !collapsed[cat.key]
          return (
            <div key={cat.key}>
              <button
                onClick={() => toggle(cat.key)}
                className="flex items-center gap-1.5 w-full py-1.5 hover:bg-slate-50 rounded-lg px-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-slate-300 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                >
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                <span className="text-slate-400">{cat.icon}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{cat.label}</span>
                <span className="text-[9px] text-slate-300 ml-auto">{items.length}</span>
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-1.5 pl-1 pb-2 pt-1">
                  {items.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => onNavigateToPage?.(tag.page)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${cat.chipClass}`}
                      title={`Gå till sida ${tag.page}`}
                    >
                      <span>{tag.label}</span>
                      <span className={`text-[9px] ${cat.pageClass}`}>s.{tag.page}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
