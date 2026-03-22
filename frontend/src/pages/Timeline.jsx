import { useEffect, useState, useRef } from 'react'
import { getTimeline } from '../services/api'

const MONTHS_SV = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function parseDate(str) {
  // Search anywhere in the string for date patterns
  let m
  // ISO: 2024-03-15
  m = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  // Swedish written: 15 mars 2024, juni 2022
  m = str.match(/(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s+(\d{4})/i)
  if (m) {
    const day = +m[1], year = +m[3]
    const mon = m[2].toLowerCase().slice(0, 3)
    const mi = MONTHS_SV.indexOf(mon)
    if (mi >= 0) return new Date(year, mi, day)
  }
  // Swedish month + year without day: mars 2024, juni 2022
  m = str.match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s+(\d{4})/i)
  if (m) {
    const mon = m[1].toLowerCase().slice(0, 3)
    const mi = MONTHS_SV.indexOf(mon)
    if (mi >= 0) return new Date(+m[2], mi, 1)
  }
  // dd/mm/yyyy or dd.mm.yyyy
  m = str.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  // yyyy-mm
  m = str.match(/(\d{4})-(\d{1,2})(?!\d)/)
  if (m && !str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)) return new Date(+m[1], +m[2] - 1, 1)
  return null
}

function formatDate(d) {
  return `${d.getDate()} ${MONTHS_SV[d.getMonth()]} ${d.getFullYear()}`
}

function classifyDate(label) {
  const l = label.toLowerCase()
  if (/beslut|antagen|godkän/.test(l))                         return 'decision'
  if (/senast|deadline|färdigställ|slut/.test(l))              return 'deadline'
  if (/start|entreprenad|uppstart/.test(l))                    return 'start'
  if (/fält|inventering|undersök|utred|avläsning/.test(l))     return 'investigation'
  if (/mottagen|kompletter|inkom/.test(l))                     return 'submission'
  return 'other'
}

const DATE_COLORS = {
  decision:      { bg: '#EDE9FE', border: '#A78BFA', dot: '#7C3AED', label: 'Beslut' },
  deadline:      { bg: '#FEE2E2', border: '#F87171', dot: '#DC2626', label: 'Deadline' },
  start:         { bg: '#DBEAFE', border: '#60A5FA', dot: '#2563EB', label: 'Start' },
  investigation: { bg: '#FEF3C7', border: '#FBBF24', dot: '#D97706', label: 'Utredning' },
  submission:    { bg: '#DCFCE7', border: '#4ADE80', dot: '#16A34A', label: 'Inlämning' },
  other:         { bg: '#F1F5F9', border: '#94A3B8', dot: '#64748B', label: 'Övrigt' },
}

export default function Timeline({ onNavigateToDoc }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    getTimeline()
      .then(data => {
        // Parse and sort by date
        const parsed = data
          .map(ev => {
            const _date = parseDate(ev.date)
            // Extract context label: strip the date portion from the original label
            let _label = ev.date
              .replace(/\d{4}-\d{1,2}-\d{1,2}/g, '')
              .replace(/\d{1,2}[./]\d{1,2}[./]\d{4}/g, '')
              .replace(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s+\d{4}/gi, '')
              .replace(/\d{1,2}\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s+\d{4}/gi, '')
              .replace(/\s+/g, ' ').trim()
            const _type = classifyDate(ev.date)
            return { ...ev, _date, _label: _label || null, _type }
          })
          .filter(ev => ev._date)
          .sort((a, b) => a._date - b._date)
        setEvents(parsed)
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  // Group events by month/year
  const groups = []
  let lastKey = ''
  for (const ev of events) {
    const key = `${ev._date.getFullYear()}-${ev._date.getMonth()}`
    if (key !== lastKey) {
      groups.push({ key, label: `${MONTHS_SV[ev._date.getMonth()].charAt(0).toUpperCase() + MONTHS_SV[ev._date.getMonth()].slice(1)} ${ev._date.getFullYear()}`, events: [] })
      lastKey = key
    }
    groups[groups.length - 1].events.push(ev)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#f0efe9' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-slate-400"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span className="ml-2 text-sm text-slate-400">Laddar tidslinje...</span>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#f0efe9' }}>
        <p className="text-sm font-medium text-slate-500 mb-1">Inga datum hittade</p>
        <p className="text-xs text-slate-400">Bearbeta dokument i Dokument-fliken for att extrahera datum.</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" style={{ backgroundColor: '#f0efe9' }}>
      <div className="max-w-3xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700">Tidslinje</h2>
          <p className="text-xs text-slate-400 mt-1">{events.length} datum fran {new Set(events.map(e => e.filename)).size} dokument</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.values(DATE_COLORS).map(c => (
              <div key={c.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.dot }} />
                <span className="text-[11px] text-slate-400">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-300" />

          {groups.map(group => (
            <div key={group.key} className="mb-6">
              {/* Month label */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-[15px] h-[15px] rounded-full bg-white border-2 border-slate-300 flex-shrink-0 z-10" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
              </div>

              {/* Events in this month */}
              <div className="ml-[7px] pl-6 border-l border-transparent space-y-2">
                {group.events.map((ev, i) => {
                  const colors = DATE_COLORS[ev._type]
                  return (
                    <button
                      key={`${ev.document_id}-${ev.date}-${i}`}
                      onClick={() => onNavigateToDoc?.(ev.filename, ev.page)}
                      className="w-full text-left group relative flex items-start gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-white/60"
                    >
                      {/* Dot on the line */}
                      <div className="absolute -left-6 top-[11px] w-[9px] h-[9px] rounded-full border-2 flex-shrink-0"
                        style={{ backgroundColor: colors.dot, borderColor: colors.border }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-700">{formatDate(ev._date)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: colors.bg, color: colors.dot }}
                          >
                            {colors.label}
                          </span>
                        </div>
                        <div className="mt-1">
                          {ev._label && (
                            <span className="text-xs text-slate-500">{ev._label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            {ev.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')}
                          </span>
                          {ev.page && (
                            <span className="text-[10px] text-slate-300">s. {ev.page}</span>
                          )}
                        </div>
                      </div>

                      {/* Arrow on hover */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-slate-500 mt-1.5 flex-shrink-0 transition-colors">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
