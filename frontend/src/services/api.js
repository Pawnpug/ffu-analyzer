import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  },
)

export const listDocuments      = () => api.get('/documents')
export const getDocument        = (id) => api.get(`/documents/${id}`)
export const getDocumentFileUrl = (id) => `/api/documents/${id}/file`
export const getDocumentTags    = (id) => api.get(`/documents/${id}/tags`)
export const getAllTags         = () => api.get('/tags')
export const getTimeline       = () => api.get('/timeline')

/**
 * Stream document processing (extract) via SSE.
 * Events: onPhase(phase, total), onExtracted(filename, count, total),
 *         onDone(count), onError(message)
 */
export async function streamProcess({ onPhase, onExtracted, onTagged, onDone, onError }) {
  let res
  try {
    res = await fetch('/api/process', { method: 'POST' })
  } catch (e) {
    onError?.(e.message); return
  }
  if (!res.ok) { onError?.(`HTTP ${res.status}`); return }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6))
        if      (ev.type === 'phase')     onPhase?.(ev.phase, ev.total)
        else if (ev.type === 'extracted') onExtracted?.(ev.filename, ev.count, ev.total)
        else if (ev.type === 'tagged')   onTagged?.(ev.filename, ev.count, ev.total)
        else if (ev.type === 'done')      onDone?.(ev.count)
        else if (ev.type === 'error')     onError?.(ev.message)
      } catch { /* ignore malformed line */ }
    }
  }
}

/**
 * Stream a chat message via SSE.
 * Calls onDelta(text) for each streamed text chunk,
 *        onReading(docName) when the model fetches a document,
 *        onDone(sources[]) when the response is complete,
 *        onError(message) on failure.
 */
export async function sendChatMessage(message, history, { onDelta, onReading, onDone, onError, signal, documentIds }) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, document_ids: documentIds || [] }),
      signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') { onDone?.([]); return }
    onError?.(e.message); return
  }
  if (!res.ok) {
    onError?.(`HTTP ${res.status}`)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    let done, value
    try { ({ done, value } = await reader.read()) }
    catch (e) { if (e.name === 'AbortError') { onDone?.([]); return } throw e }
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6))
        if      (ev.type === 'delta')   onDelta?.(ev.text)
        else if (ev.type === 'reading') onReading?.(ev.document)
        else if (ev.type === 'done')    onDone?.(ev.sources ?? [])
        else if (ev.type === 'error')   onError?.(ev.message)
      } catch { /* ignore malformed line */ }
    }
  }
}
