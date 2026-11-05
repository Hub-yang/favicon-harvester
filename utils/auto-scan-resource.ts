const TOTAL_BYTES = 4 * 1024 * 1024

export function createAutoScanResourceReader(pageUrl: string, signal: AbortSignal) {
  const origin = new URL(pageUrl).origin
  let remaining = TOTAL_BYTES

  return async (url: string, limit: number): Promise<{ bytes: Uint8Array<ArrayBuffer>, type: string } | undefined> => {
    signal.throwIfAborted()
    const target = new URL(url)
    if ((target.protocol !== 'http:' && target.protocol !== 'https:') || target.origin !== origin || target.username || target.password)
      throw new Error('Resource is outside the automatic scan scope')
    if (remaining <= 0)
      throw new Error('Automatic scan byte budget exhausted')

    const response = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel().catch(() => {})
      return undefined
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {})
      throw new Error('Resource could not be verified')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    let completed = false
    try {
      const advertised = Number(response.headers.get('content-length'))
      if (advertised > limit || advertised > remaining)
        throw new Error('Resource exceeds the automatic scan byte budget')
      for (;;) {
        signal.throwIfAborted()
        const { value, done } = await reader.read()
        signal.throwIfAborted()
        if (done)
          break
        size += value.byteLength
        remaining -= value.byteLength
        if (size > limit || remaining < 0)
          throw new Error('Resource exceeds the automatic scan byte budget')
        chunks.push(value)
      }
      completed = true
    }
    finally {
      if (!completed)
        void reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { bytes, type: response.headers.get('content-type') ?? '' }
  }
}
