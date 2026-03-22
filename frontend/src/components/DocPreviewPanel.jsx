import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { getDocumentFileUrl } from '../services/api'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

function clearHighlights(container) {
  container?.querySelectorAll('.hl-overlay').forEach(el => el.remove())
}

function applyHighlight(quote, container, findAll = false) {
  if (!container || !quote) return
  const textLayer = container.querySelector('.react-pdf__Page__textContent')
  if (!textLayer) return

  clearHighlights(container)

  const spans = Array.from(textLayer.querySelectorAll('span'))
  let accumulated = ''
  const ranges = []
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    const t = span.textContent || ''
    // Insert space only between spans on different lines (line breaks).
    // Same-line spans (kerning splits) are joined without a space.
    if (i > 0 && accumulated.length > 0) {
      const prevRect = spans[i - 1].getBoundingClientRect()
      const currRect = span.getBoundingClientRect()
      if (Math.abs(currRect.top - prevRect.top) > 2) {
        accumulated += ' '
      }
    }
    ranges.push({ start: accumulated.length, end: accumulated.length + t.length, span })
    accumulated += t
  }

  // Build normalized text with a position map back to accumulated
  // Aggressively strip invisible chars and normalize all whitespace variants
  const clean = accumulated.normalize('NFC').replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
  const lc = clean.toLowerCase()
  const normChars = []
  const normToOrig = []
  let lastSpace = true
  for (let i = 0; i < lc.length; i++) {
    if (/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]/.test(lc[i])) {
      if (!lastSpace) { normChars.push(' '); normToOrig.push(i); lastSpace = true }
    } else {
      normChars.push(lc[i]); normToOrig.push(i); lastSpace = false
    }
  }
  if (normChars.length && normChars[normChars.length - 1] === ' ') { normChars.pop(); normToOrig.pop() }
  const haystack = normChars.join('')
  const needle = quote.normalize('NFC').replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '').toLowerCase().replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ').trim()

  // Find match positions, mapping back to original accumulated offsets
  // If full needle doesn't match, try progressively shorter substrings (word-by-word from end)
  let searchNeedle = needle
  let matches = []
  while (searchNeedle.length >= 1) {
    let searchFrom = 0
    while (true) {
      const idx = haystack.indexOf(searchNeedle, searchFrom)
      if (idx < 0) break
      matches.push({ idx: normToOrig[idx], end: normToOrig[idx + searchNeedle.length - 1] + 1 })
      if (!findAll) break
      searchFrom = idx + 1
    }
    if (matches.length) break
    // Remove last word and retry
    const shorter = searchNeedle.replace(/\s+\S+\s*$/, '')
    if (shorter === searchNeedle) break
    searchNeedle = shorter
  }
  if (!matches.length) return

  // Create lime overlay divs positioned over only the matched characters
  const pageDiv = container.querySelector('.react-pdf__Page')
  if (!pageDiv) return
  const pageRect = pageDiv.getBoundingClientRect()

  // Collect all highlight rects, then merge overlapping ones to avoid color stacking
  const allRects = []
  for (const { idx, end } of matches) {
    for (const { start, end: sEnd, span } of ranges) {
      if (sEnd <= idx || start >= end) continue
      const textNode = span.firstChild
      if (!textNode || textNode.nodeType !== 3) continue
      const charStart = Math.max(0, idx - start)
      const charEnd = Math.min(textNode.length, end - start)
      const range = document.createRange()
      range.setStart(textNode, charStart)
      range.setEnd(textNode, charEnd)
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue
        const pad = 1
        allRects.push({
          left: r.left - pageRect.left - pad,
          top: r.top - pageRect.top,
          right: r.left - pageRect.left + r.width + pad,
          bottom: r.top - pageRect.top + r.height,
        })
      }
    }
  }

  // Merge rects that overlap or touch (same row)
  allRects.sort((a, b) => a.top - b.top || a.left - b.left)
  const merged = []
  for (const r of allRects) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(r.top - last.top) < 2 && r.left <= last.right) {
      last.right = Math.max(last.right, r.right)
      last.bottom = Math.max(last.bottom, r.bottom)
    } else {
      merged.push({ ...r })
    }
  }

  const outerPad = 3
  for (const r of merged) {
    const overlay = document.createElement('div')
    overlay.className = 'hl-overlay'
    overlay.style.cssText =
      `position:absolute;` +
      `left:${r.left - outerPad}px;` +
      `top:${r.top - 0.25}px;` +
      `width:${r.right - r.left + outerPad * 2}px;` +
      `height:${r.bottom - r.top + 0.5}px;` +
      `background:rgba(168,85,247,0.3);` +
      `border-radius:3px;` +
      `pointer-events:none;` +
      `z-index:5;`
    pageDiv.appendChild(overlay)
  }

}

// Parse markdown content into sheets: [{ name, headers, rows }]
function parseSheets(content) {
  const sheets = []
  let current = null
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      current = { name: line.slice(3).trim(), headers: [], rows: [] }
      sheets.push(current)
    } else if (line.startsWith('| ') && current) {
      const cells = line.split('|').filter((_, j, arr) => j > 0 && j < arr.length - 1).map(c => c.trim())
      if (cells.every(c => /^-+$/.test(c))) continue // separator row
      if (!current.headers.length) current.headers = cells
      else current.rows.push(cells)
    }
  }
  return sheets
}

function normalizeForSearch(s) {
  return s.normalize('NFC').replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function SpreadsheetViewer({ content, targetPage, targetQuote }) {
  const sheets = parseSheets(content)
  const [activeSheet, setActiveSheet] = useState(0)
  const highlightRef = useRef(null)
  const scrollContainerRef = useRef(null)

  // Navigate to sheet when targetPage changes (page is 1-based)
  useEffect(() => {
    if (targetPage != null && sheets.length > 0) {
      const idx = Math.max(0, Math.min(targetPage - 1, sheets.length - 1))
      setActiveSheet(idx)
    }
  }, [targetPage, sheets.length])

  // Scroll to highlighted cell — only scroll the table container, not ancestors
  useEffect(() => {
    const timer = setTimeout(() => {
      const cell = highlightRef.current
      const container = scrollContainerRef.current
      if (!cell || !container) return
      const cellRect = cell.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      container.scrollTo({
        left: container.scrollLeft + (cellRect.left - containerRect.left) - containerRect.width / 2 + cellRect.width / 2,
        top: container.scrollTop + (cellRect.top - containerRect.top) - containerRect.height / 2 + cellRect.height / 2,
        behavior: 'smooth',
      })
    }, 50)
    return () => clearTimeout(timer)
  }, [activeSheet, targetQuote])

  if (!sheets.length) return <p className="text-xs text-slate-400 p-4">Tomt dokument.</p>

  const sheet = sheets[activeSheet]

  // Find matching cells for highlight
  const needle = targetQuote ? normalizeForSearch(targetQuote) : null
  const matchesCell = (cellText) => {
    if (!needle || !cellText) return false
    const hay = normalizeForSearch(String(cellText))
    if (!hay) return false
    // Cell contains the quoted text, or the quoted text contains the full cell value (min 4 chars)
    return hay.includes(needle) || (hay.length >= 4 && needle.includes(hay))
  }

  let firstMatchFound = false

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-0 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={`px-4 py-2 text-xs font-medium border-r border-slate-200 transition-colors ${
                i === activeSheet
                  ? 'bg-white text-slate-900 border-b-white -mb-px'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {sheets.length === 1 && (
        <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <span className="text-xs font-medium text-slate-500">{sheet.name}</span>
        </div>
      )}

      {/* Table */}
      <div ref={scrollContainerRef} className="overflow-auto flex-1 min-h-0">
        <table className="border-collapse text-xs w-full" style={{ minWidth: 'max-content' }}>
          <thead>
            {/* Column letters */}
            <tr>
              <th className="sticky top-0 left-0 z-20 w-8 bg-slate-100 border border-slate-200" />
              {sheet.headers.map((_, j) => (
                <th key={j} className="sticky top-0 z-10 bg-slate-100 border border-slate-200 px-2 py-1 text-center font-medium text-slate-400 min-w-[90px]">
                  {String.fromCharCode(65 + j)}
                </th>
              ))}
            </tr>
            {/* Header row */}
            <tr>
              <td className="sticky top-[29px] left-0 z-20 w-8 bg-slate-100 border border-slate-200 text-center text-slate-400 font-medium">1</td>
              {sheet.headers.map((cell, j) => {
                const isMatch = matchesCell(cell)
                const isFirst = isMatch && !firstMatchFound
                if (isFirst) firstMatchFound = true
                return (
                  <td key={j}
                    ref={isFirst ? highlightRef : undefined}
                    className={`sticky top-[29px] z-10 border border-slate-300 px-2 py-1.5 font-semibold whitespace-nowrap ${
                      isMatch ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-[#e8f0fe] text-slate-700'
                    }`}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="sticky left-0 z-10 w-8 bg-slate-100 border border-slate-200 text-center text-slate-400 font-medium text-[10px]">
                  {i + 2}
                </td>
                {sheet.headers.map((_, j) => {
                  const cellVal = row[j] ?? ''
                  const isMatch = matchesCell(cellVal)
                  const isFirst = isMatch && !firstMatchFound
                  if (isFirst) firstMatchFound = true
                  return (
                    <td key={j}
                      ref={isFirst ? highlightRef : undefined}
                      className={`border border-slate-200 px-2 py-1.5 whitespace-nowrap max-w-[240px] truncate ${
                        isMatch ? 'bg-purple-100 text-purple-800 border-purple-300' : 'text-slate-700'
                      }`}
                    >
                      {cellVal}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PDF / Excel viewer pane ────────────────────────────────────────────────────
export function DocPdfPane({ doc, targetPage, targetQuote, currentPageRef, onClose }) {
  const [numPages, setNumPages]     = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom]             = useState(1)
  const [pdfWidth, setPdfWidth]     = useState(500)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selTip, setSelTip]         = useState(null) // { x, y } or null
  const searchInputRef = useRef(null)
  const containerRef  = useRef(null)
  const targetQuoteRef = useRef(null)
  const searchTermRef = useRef('')

  const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
  const fileUrl = getDocumentFileUrl(doc.id)

  useEffect(() => {
    if (isExcel) return
    const obs = new ResizeObserver(() => {
      if (containerRef.current) setPdfWidth(containerRef.current.clientWidth - 32)
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [isExcel])

  useEffect(() => {
    if (!targetPage || !numPages) return
    setPageNumber(Math.max(1, Math.min(targetPage, numPages)))
  }, [targetPage, numPages])

  useEffect(() => {
    if (currentPageRef) currentPageRef.current = pageNumber
  }, [currentPageRef, pageNumber])

  // Clear highlights when document changes
  useEffect(() => {
    targetQuoteRef.current = null
    clearHighlights(containerRef.current)
  }, [doc.id])

  // When a citation is clicked, pipe the quote into the search bar
  useEffect(() => {
    targetQuoteRef.current = targetQuote
    if (!targetQuote) return
    setSearchTerm(targetQuote)
    setSearchOpen(true)
  }, [targetQuote])

  // Search: highlight all matches of searchTerm on current page
  useEffect(() => {
    searchTermRef.current = searchTerm
    if (!searchTerm) { clearHighlights(containerRef.current); return }
    const timer = setTimeout(() => {
      applyHighlight(searchTerm, containerRef.current, true)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchTerm, pageNumber])

  // Clear search when doc changes
  useEffect(() => { setSearchTerm(''); setSearchOpen(false) }, [doc.id])

  // Ctrl+wheel zoom
  useEffect(() => {
    if (isExcel) return
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(z => Math.max(0.5, Math.min(2.5, +(z - e.deltaY * 0.002).toFixed(2))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [isExcel])

  // Show tooltip when user selects text in the document
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim()
        if (text && text.length > 1 && el.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          setSelTip({ x: rect.left + rect.width / 2 - elRect.left, y: rect.top - elRect.top - 6 })
        } else {
          setSelTip(null)
        }
      }, 10)
    }
    const onMouseDown = () => setSelTip(null)
    const onSelChange = () => {
      const text = window.getSelection()?.toString().trim()
      if (!text) setSelTip(null)
    }
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('selectionchange', onSelChange)
    return () => { el.removeEventListener('mouseup', onMouseUp); el.removeEventListener('mousedown', onMouseDown); document.removeEventListener('selectionchange', onSelChange) }
  }, [doc.id])

  const handleRenderSuccess = () => {
    // Re-apply highlight after page render — use refs to avoid stale closures
    const term = searchTermRef.current
    if (term) {
      setTimeout(() => applyHighlight(term, containerRef.current, true), 100)
    } else if (targetQuoteRef.current) {
      setTimeout(() => applyHighlight(targetQuoteRef.current, containerRef.current), 100)
    }
  }

  return (
    <div className="card !p-0 overflow-hidden flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#dddcd6] flex-shrink-0">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate" style={{ maxWidth: searchOpen ? '120px' : undefined, flex: searchOpen ? '0 0 auto' : '1 1 0' }} title={doc.filename}>
          {doc.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')}
        </span>
        {!isExcel && (
          searchOpen ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearchTerm(''); setSearchOpen(false) } }}
                  placeholder="Sök på sidan…"
                  className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <button
                onClick={() => { setSearchTerm(''); setSearchOpen(false) }}
                className="btn-secondary !px-1.5 !py-0.5 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
              className="btn-secondary !px-1.5 !py-0.5"
              title="Sök på sidan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          )
        )}
        {!isExcel && (
          <>
            {numPages && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="btn-secondary !px-1.5 !py-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="text-[10px] text-slate-500 tabular-nums w-12 text-center">{pageNumber} / {numPages}</span>
                <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="btn-secondary !px-1.5 !py-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Dölj dokumentvy">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Content — userSelect:text overrides the parent flex row's none */}
      <div ref={containerRef} style={{ userSelect: 'text', position: 'relative' }} className={`flex-1 min-h-0 ${isExcel ? 'flex flex-col overflow-hidden' : 'overflow-y-auto px-4 py-4'}`}>
        {selTip && (
          <div
            className="absolute z-50 px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-[10px] font-medium shadow-lg whitespace-nowrap pointer-events-none"
            style={{ left: selTip.x, top: selTip.y, transform: 'translate(-50%, -100%)' }}
          >
            Tryck <kbd className="px-1 py-0.5 rounded bg-blue-200 text-black text-[9px] font-bold">E</kbd> för att lägga till i chatten
          </div>
        )}
        {isExcel ? (
          <SpreadsheetViewer content={doc.content || ''} targetPage={targetPage} targetQuote={targetQuote} />
        ) : (
          <div className="flex flex-col items-center">
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); if (!targetPage) setPageNumber(1) }}
              loading={<div className="flex items-center gap-2 py-12 text-slate-400 text-xs"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-slate-400"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Laddar PDF…</div>}
              error={<p className="text-xs text-red-500 py-8 text-center">Kunde inte ladda PDF-filen.</p>}
            >
              <Page
                pageNumber={pageNumber}
                width={Math.round(pdfWidth * zoom)}
                renderAnnotationLayer
                renderTextLayer
                onRenderSuccess={handleRenderSuccess}
                className="shadow rounded overflow-hidden"
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}
