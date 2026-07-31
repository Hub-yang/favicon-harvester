import type { IconCandidate } from './types'
import { fetchWithTimeout } from './fetch-with-timeout'
import { measureRasterSize } from './image-size'
import { sniffMimeFromBytes } from './mime-sniff'
import { parseSvgSize } from './svg-size'

export async function probeCandidate(candidate: IconCandidate, timeoutMs = 5000): Promise<IconCandidate | undefined> {
  try {
    const response = await fetchWithTimeout(candidate.url, timeoutMs)
    if (!response.ok)
      return undefined

    const bytes = new Uint8Array(await response.arrayBuffer())

    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const mimeType = headerMime && headerMime !== 'application/octet-stream'
      ? headerMime
      : sniffMimeFromBytes(bytes)
    if (!mimeType)
      return undefined

    const measured = mimeType === 'image/svg+xml'
      ? parseSvgSize(new TextDecoder().decode(bytes))
      : await measureRasterSize(new Blob([bytes], { type: mimeType }))

    return {
      ...candidate,
      mimeType,
      width: measured?.width ?? candidate.width,
      height: measured?.height ?? candidate.height,
    }
  }
  catch {
    return undefined
  }
}
