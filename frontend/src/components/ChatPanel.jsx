import { useState, useEffect, useRef, useCallback } from 'react'
import { sendChatMessage } from '../services/api'

const CHAT_KEY = 'ffu-chat-history'

const readChat  = () => {
  try {
    const msgs = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]')
    return msgs.map(m => {
      if (!m.context) return m
      let ctx = Array.isArray(m.context) ? m.context : [m.context]
      ctx = ctx.map(c => typeof c === 'string' ? { text: c, source: '' } : c)
      return { ...m, context: ctx }
    })
  } catch { return [] }
}
const writeChat = (msgs) => {
  const stable = msgs.filter((m) => !m._append && !m.reading)
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(stable)) } catch {}
}

const CITE_RE = /(【[^】\]]+[】\]])/

function parseCite(token) {
  // With page: 【filename, s.N, "quote"】 or 【filename, s.N】 (also accepts ] as closing)
  const m = token.match(/^【([^,】\]]+),\s*s\.(\d+)([\s\S]*?)[】\]]$/)
  if (m) {
    const page = parseInt(m[2], 10)
    if (isNaN(page)) return null
    let quote = null
    if (m[3]) {
      quote = m[3]
        .replace(/^,\s*/, '')
        .replace(/^[\u201c\u201d"'\u2018\u2019\s]+/, '')
        .replace(/[\u201c\u201d"'\u2018\u2019\s]+$/, '')
        .trim()
      if (!quote) quote = null
    }
    return { filename: m[1].trim(), page, quote }
  }
  // Without page: 【filename】
  const m2 = token.match(/^【([^】\]]+)[】\]]$/)
  if (m2) return { filename: m2[1].trim(), page: null, quote: null }
  return null
}

function renderLine(line, key, onCiteClick) {
  const withCites = line.split(CITE_RE)
  const result = []
  for (let i = 0; i < withCites.length; i++) {
    const token = withCites[i]
    const cite = parseCite(token)
    if (cite) {
      if (cite.quote) {
        // Quote citation — purple highlight
        result.push(
          <span
            key={`c${i}`}
            onClick={() => onCiteClick?.(cite.filename, cite.page, cite.quote)}
            role="button"
            tabIndex={0}
            className="text-[11px] font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer rounded-sm px-0.5"
            style={{ boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
            title={`${cite.filename}, sida ${cite.page}`}
          >
            "{cite.quote}" s.{cite.page}
          </span>
        )
      } else {
        // Source-only reference — red/green document chip
        const isExcel = /\.(xlsx|xls|xlsm)$/i.test(cite.filename)
        const chipClass = isExcel
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : 'bg-red-50 border border-red-200 text-red-800 hover:bg-red-100'
        const displayName = cite.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')
        result.push(
          <span
            key={`c${i}`}
            onClick={() => onCiteClick?.(cite.filename, cite.page, cite.quote)}
            role="button"
            tabIndex={0}
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${chipClass} transition-colors cursor-pointer rounded-md px-1.5 py-0.5 mx-0.5`}
            title={cite.filename}
          >
            {isExcel
              ? <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            }
            {displayName}
          </span>
        )
      }
    } else {
      const parts = token.split(/(\*\*[^*]+\*\*)/g)
      parts.forEach((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          result.push(<strong key={`b${i}-${j}`}>{part.slice(2, -2)}</strong>)
        } else {
          result.push(part)
        }
      })
    }
  }
  return <p key={key}>{result}</p>
}

function AssistantContent({ content, onCiteClick }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <p key={i} className="font-semibold text-slate-900 mt-1">{line.slice(4)}</p>
        if (line.startsWith('## '))  return <p key={i} className="font-semibold text-slate-900 mt-1">{line.slice(3)}</p>
        if (line.startsWith('# '))   return <p key={i} className="font-semibold text-slate-900 mt-1">{line.slice(2)}</p>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="pl-2 before:content-['·'] before:mr-1.5 before:text-slate-400">{renderLine(line.slice(2), `l${i}`, onCiteClick)}</p>
        if (line.match(/^\d+\. /))
          return renderLine(line, i, onCiteClick)
        if (line === '') return <div key={i} className="h-1" />
        return renderLine(line, i, onCiteClick)
      })}
    </div>
  )
}

function SourceBadges({ sources, onOpenDoc }) {
  if (!sources?.length) return null
  return (
    <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-1">
      <span className="text-[10px] text-slate-400 w-full mb-0.5">Källa — klicka för att öppna</span>
      {sources.map((name) => (
        <button
          key={name}
          onClick={() => onOpenDoc?.(name)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors"
          title={`Öppna ${name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          {name}
        </button>
      ))}
    </div>
  )
}

// ── Icons ──
const PdfIcon = ({ size = 10, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)
const ExcelIcon = ({ size = 10, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/>
  </svg>
)

function DocIcon({ filename, size = 10 }) {
  const isExcel = /\.(xlsx|xls|xlsm)$/i.test(filename)
  return isExcel
    ? <ExcelIcon size={size} className="text-emerald-500 flex-shrink-0" />
    : <PdfIcon size={size} className="text-red-400 flex-shrink-0" />
}

// ── Mention input ─────────────────────────────────────────────────────────────
// Uses a contentEditable div. Document mentions are inserted as inline chip spans
// with data-doc-id / data-doc-filename attributes and contentEditable=false.

function MentionInput({ docs, onSend, disabled, taggedDocs, setTaggedDocs }) {
  const editorRef = useRef(null)
  const [mentionState, setMentionState] = useState(null) // null | { query, startOffset, startNode }
  const [mentionIdx, setMentionIdx] = useState(0)
  const mentionRef = useRef(null)
  const isEmpty = useRef(true)

  // Filtered docs for the mention popup
  const filteredDocs = mentionState
    ? docs.filter(d => d.filename.toLowerCase().includes(mentionState.query.toLowerCase()))
    : []

  // Close mention on outside click
  useEffect(() => {
    if (!mentionState) return
    const handler = (e) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target) &&
          editorRef.current && !editorRef.current.contains(e.target)) {
        setMentionState(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mentionState])

  // Clamp mentionIdx
  useEffect(() => {
    if (mentionState && mentionIdx >= filteredDocs.length) {
      setMentionIdx(Math.max(0, filteredDocs.length - 1))
    }
  }, [filteredDocs.length, mentionIdx, mentionState])

  // Scroll active item into view
  useEffect(() => {
    if (!mentionRef.current) return
    const active = mentionRef.current.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [mentionIdx])

  const getTextContent = () => {
    // Extract plain text, replacing chip elements with empty string
    const el = editorRef.current
    if (!el) return ''
    let text = ''
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        text += node.textContent
      } else if (node.nodeName === 'BR') {
        text += '\n'
      } else if (node.dataset?.docId) {
        // skip chips in text
      } else {
        text += node.textContent || ''
      }
    }
    return text
  }

  const getDocIds = () => {
    const el = editorRef.current
    if (!el) return []
    const ids = []
    for (const node of el.childNodes) {
      if (node.dataset?.docId) {
        ids.push({ id: parseInt(node.dataset.docId, 10), filename: node.dataset.docFilename })
      }
    }
    return ids
  }

  const insertDocChip = useCallback((doc) => {
    const el = editorRef.current
    if (!el) return

    // Remove the @query text
    const sel = window.getSelection()
    if (mentionState) {
      // Find and remove @query from the text
      // Walk through text nodes to find the @ that started this mention
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const idx = node.textContent.lastIndexOf('@')
        if (idx >= 0) {
          // Remove from @ to current cursor
          const before = node.textContent.slice(0, idx)
          const after = node.textContent.slice(idx + 1 + mentionState.query.length)
          node.textContent = before
          // Create the chip
          const chip = createChipElement(doc)
          // Insert chip after the remaining text node
          if (node.textContent === '' && node.previousSibling) {
            node.parentNode.insertBefore(chip, node)
            // Add a space after
            const space = document.createTextNode('\u00A0')
            node.parentNode.insertBefore(space, node)
            // If the text node is now empty, we can leave it for cursor positioning
            // Place cursor after the space
            const range = document.createRange()
            range.setStartAfter(space)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          } else {
            // Insert chip after this text node
            const nextSibling = node.nextSibling
            node.parentNode.insertBefore(chip, nextSibling)
            // Re-add remaining text + space
            const spaceAndAfter = document.createTextNode('\u00A0' + after)
            node.parentNode.insertBefore(spaceAndAfter, chip.nextSibling)
            const range = document.createRange()
            range.setStart(spaceAndAfter, 1)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
          break
        }
      }
    }

    setMentionState(null)
    setMentionIdx(0)
    isEmpty.current = false
    // Add to taggedDocs
    setTaggedDocs(prev => {
      if (prev.some(d => d.id === doc.id)) return prev
      return [...prev, { id: doc.id, filename: doc.filename }]
    })
  }, [mentionState, setTaggedDocs])

  const createChipElement = (doc) => {
    const isExcel = /\.(xlsx|xls|xlsm)$/i.test(doc.filename)
    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.docId = doc.id
    chip.dataset.docFilename = doc.filename
    chip.className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium mx-0.5 cursor-default whitespace-nowrap max-w-full ${
      isExcel
        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        : 'bg-red-50 border border-red-200 text-red-800'
    }`
    // Build icon via innerHTML (static SVG only, no user data)
    const iconSvg = isExcel
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    chip.innerHTML = iconSvg
    // Use textContent for the filename to prevent XSS
    const label = document.createElement('span')
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis'
    label.textContent = doc.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')
    chip.appendChild(label)
    return chip
  }

  const handleInput = () => {
    const el = editorRef.current
    if (!el) return

    // Check if empty
    const text = el.textContent.trim()
    isEmpty.current = text === '' && !el.querySelector('[data-doc-id]')

    // Detect @mention
    const sel = window.getSelection()
    if (!sel.rangeCount) { setMentionState(null); return }
    const range = sel.getRangeAt(0)
    if (!range.collapsed) { setMentionState(null); return }
    const node = range.startContainer
    if (node.nodeType !== 3) { setMentionState(null); return }
    const textBefore = node.textContent.slice(0, range.startOffset)
    // Find last @ not preceded by a word char
    const atMatch = textBefore.match(/(^|[\s])@([^\s]*)$/)
    if (atMatch) {
      setMentionState({ query: atMatch[2] })
      setMentionIdx(0)
    } else {
      setMentionState(null)
    }
  }

  const handleKeyDown = (e) => {
    // Mention navigation
    if (mentionState && filteredDocs.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIdx(i => (i + 1) % filteredDocs.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx(i => (i - 1 + filteredDocs.length) % filteredDocs.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertDocChip(filteredDocs[mentionIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionState(null)
        return
      }
    }

    // Send on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey && !mentionState) {
      e.preventDefault()
      handleSend()
      return
    }

    // Backspace: delete whole chip if cursor is right after one
    if (e.key === 'Backspace') {
      const sel = window.getSelection()
      if (!sel.rangeCount) return
      const range = sel.getRangeAt(0)
      if (!range.collapsed) return
      const node = range.startContainer
      const offset = range.startOffset

      // Case 1: cursor at start of a text node, previous sibling is a chip
      if (node.nodeType === 3 && offset === 0) {
        let prev = node.previousSibling
        if (prev?.dataset?.docId) {
          e.preventDefault()
          const docId = parseInt(prev.dataset.docId, 10)
          prev.remove()
          setTaggedDocs(p => p.filter(d => d.id !== docId))
          return
        }
      }
      // Case 2: cursor in the editor itself (not in a text node), offset points after a chip
      if (node === editorRef.current && offset > 0) {
        const prev = node.childNodes[offset - 1]
        if (prev?.dataset?.docId) {
          e.preventDefault()
          const docId = parseInt(prev.dataset.docId, 10)
          prev.remove()
          setTaggedDocs(p => p.filter(d => d.id !== docId))
          return
        }
      }
    }
  }

  const handleSend = () => {
    const text = getTextContent().trim()
    if (!text && !taggedDocs.length) return
    if (disabled) return
    const docIds = [...taggedDocs]
    onSend(text, docIds)
    // Clear editor
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
      isEmpty.current = true
    }
  }

  // Prevent pasting HTML — paste plain text only
  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="relative">
      <div className="relative rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-indigo-300 overflow-hidden">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder="Ställ en fråga… Skriv @ för att bifoga dokument"
          className="chat-editor w-full px-3 py-2.5 text-sm text-slate-900 bg-transparent focus:outline-none leading-5"
          style={{ maxHeight: '120px', minHeight: '36px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        />
      </div>

      {/* Mention dropdown */}
      {mentionState && filteredDocs.length > 0 && (
        <div ref={mentionRef} className="absolute bottom-full left-0 mb-1 w-72 card !p-0 shadow-lg z-50 max-h-48 overflow-y-auto">
          {filteredDocs.map((d, i) => (
            <button
              key={d.id}
              data-active={i === mentionIdx ? 'true' : undefined}
              onMouseDown={(e) => { e.preventDefault(); insertDocChip(d) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                i === mentionIdx ? 'bg-indigo-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <DocIcon filename={d.filename} size={12} />
              <span className="truncate flex-1">{d.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')}</span>
              <span className="text-[10px] text-slate-400">{d.filename.match(/\.[^.]+$/)?.[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────
export default function ChatPanel({ width, onWidthChange, onOpenDoc, context, onClearContext, docs = [] }) {
  const [messages, setMessages] = useState(readChat)
  const [loading,  setLoading]  = useState(false)
  const [taggedDocs, setTaggedDocs] = useState([])
  const bottomRef   = useRef(null)
  const abortRef    = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Debounce localStorage write to avoid thrashing on every streaming delta
    const timer = setTimeout(() => writeChat(messages), 300)
    return () => clearTimeout(timer)
  }, [messages])

  const send = async (text, docIds) => {
    if ((!text && !docIds?.length) || loading) return

    const capturedContext = context?.length ? context : null
    const capturedDocs = docIds?.length ? docIds : null
    onClearContext?.()
    setTaggedDocs([])

    const userMsg = { role: 'user', content: text, context: capturedContext, taggedDocs: capturedDocs }
    const history = messages.map((m) => ({
      role: m.role,
      content: m.context?.length
        ? `[Kontext från dokument]\n${m.context.map(c => {
            const label = [c.source, c.page ? `s.${c.page}` : ''].filter(Boolean).join(', ')
            return label ? `[${label}]: "${c.text}"` : `"${c.text}"`
          }).join('\n')}\n\n${m.content}`
        : m.content,
    }))
    const next = [...messages, userMsg]

    const placeholder = { role: 'assistant', content: '', sources: [], reading: null }
    setMessages([...next, placeholder])
    setLoading(true)

    const appendDelta = (chunk) =>
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        copy[copy.length - 1] = { ...last, content: (last.content || '') + chunk }
        return copy
      })

    const updateLast = (patch) =>
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch }
        return copy
      })

    const controller = new AbortController()
    abortRef.current = controller

    const apiMessage = capturedContext
      ? `[Kontext från dokument]\n${capturedContext.map(c => {
          const label = [c.source, c.page ? `s.${c.page}` : ''].filter(Boolean).join(', ')
          return label ? `[${label}]: "${c.text}"` : `"${c.text}"`
        }).join('\n')}\n\n${text}`
      : text

    await sendChatMessage(apiMessage, history, {
      signal:    controller.signal,
      documentIds: capturedDocs?.map(d => d.id) || [],
      onDelta:   (chunk) => appendDelta(chunk),
      onReading: (doc)   => updateLast({ reading: doc }),
      onDone:    (srcs)  => { abortRef.current = null; updateLast({ reading: null, sources: srcs }); setLoading(false) },
      onError:   (msg)   => { abortRef.current = null; updateLast({ content: `Fel: ${msg}`, reading: null }); setLoading(false) },
    })
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault()
    const startX     = e.clientX
    const startChatW = width
    const maxChat    = Math.floor(window.innerWidth * 0.45)

    const onMove = (ev) => {
      const newChat = Math.max(280, Math.min(maxChat, startChatW + (startX - ev.clientX)))
      onWidthChange(newChat)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="fixed right-0 bottom-0 flex flex-col border-l border-[#dddcd6]"
      style={{ top: '0px', width: `${width}px`, backgroundColor: '#f0efe9', zIndex: 30 }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400 transition-colors"
        onMouseDown={handleResizeMouseDown}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3 border border-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">Inga meddelanden än</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            // Skip rendering the empty assistant placeholder — the brick spinner handles it
            const isEmptyAssistant = msg.role === 'assistant' && !msg.content && !msg.reading
            if (isEmptyAssistant && loading && i === messages.length - 1) return null
            return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm"
                style={{ backgroundColor: msg.role === 'user' ? '#e0e7ff' : '#f8f7f3' }}
              >
                {msg.role === 'user'
                  ? <>
                      {msg.taggedDocs?.length > 0 && (
                        <div className="mb-1.5 space-y-1">
                          {msg.taggedDocs.map((d, j) => {
                            const isExcel = /\.(xlsx|xls|xlsm)$/i.test(d.filename)
                            return (
                              <div key={j} className="flex">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full ${
                                  isExcel
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                    : 'bg-red-50 border border-red-200 text-red-800'
                                }`}>
                                  <DocIcon filename={d.filename} />
                                  <span className="truncate">{d.filename.replace(/\.(pdf|xlsx|xls|xlsm)$/i, '')}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {msg.context?.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-0.5">
                          {msg.context.map((item, j) => (
                            <div key={j} className="inline-flex px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 max-w-full">
                              <div className="min-w-0">
                                {(item.source || item.page) && (
                                  <p className="text-[9px] font-medium text-blue-400 truncate mb-0.5">
                                    {item.source}{item.source && item.page ? ', ' : ''}{item.page ? `s.${item.page}` : ''}
                                  </p>
                                )}
                                <p className="text-xs text-blue-700 leading-relaxed line-clamp-3">{item.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </>
                  : <>
                      {msg.reading && (
                        <p className="text-xs text-slate-400 italic mb-1.5 flex items-center gap-1">
                          <span className="animate-spin inline-block">🧱</span>
                          Läser {msg.reading}…
                        </p>
                      )}
                      {msg.content && (
                        <AssistantContent
                          content={msg.content}
                          onCiteClick={(filename, page, quote) => onOpenDoc?.(filename, page, quote)}
                        />
                      )}
                    </>
                }
              </div>
            </div>
            )
          })
        )}
        {loading && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.reading && (
          <div className="flex justify-start -mt-1">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <span className="text-lg animate-spin inline-block">🧱</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[#dddcd6] flex-shrink-0">
        {context?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-0.5">
            <div className="flex items-center justify-between px-1 w-full">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Kontext</p>
              {context.length > 1 && (
                <button
                  onClick={() => onClearContext()}
                  className="text-[10px] text-blue-300 hover:text-blue-500 transition-colors"
                >
                  Rensa alla
                </button>
              )}
            </div>
            {context.map((item, i) => (
              <div key={i} className="inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 max-w-full">
                <div className="min-w-0">
                  {(item.source || item.page) && (
                    <p className="text-[9px] font-medium text-blue-400 truncate mb-0.5">
                      {item.source}{item.source && item.page ? ', ' : ''}{item.page ? `s.${item.page}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-blue-700 leading-relaxed line-clamp-3">{item.text}</p>
                </div>
                <button
                  onClick={() => onClearContext(i)}
                  className="flex-shrink-0 text-blue-300 hover:text-blue-500 transition-colors mt-0.5"
                  title="Ta bort"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <MentionInput
            docs={docs}
            onSend={send}
            disabled={loading}
            taggedDocs={taggedDocs}
            setTaggedDocs={setTaggedDocs}
          />
          {loading ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="w-full h-9 rounded-xl bg-red-400 hover:bg-red-500 flex items-center justify-center transition-colors"
              title="Stoppa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="white">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => {
                // Trigger send from the MentionInput
                // We need to read from the editor directly
                const editor = document.querySelector('.chat-editor')
                if (!editor) return
                let text = ''
                for (const node of editor.childNodes) {
                  if (node.nodeType === 3) text += node.textContent
                  else if (node.nodeName === 'BR') text += '\n'
                  else if (!node.dataset?.docId) text += node.textContent || ''
                }
                text = text.trim()
                if (!text && !taggedDocs.length) return
                send(text, [...taggedDocs])
                editor.innerHTML = ''
              }}
              disabled={loading}
              className="w-full h-9 rounded-xl bg-indigo-400 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Skicka"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); try { localStorage.setItem(CHAT_KEY, '[]') } catch {} }}
            className="w-full mt-1.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            Rensa chatt
          </button>
        )}
      </div>
    </div>
  )
}
