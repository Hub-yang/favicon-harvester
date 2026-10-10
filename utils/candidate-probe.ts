import type { IconCandidate } from './types'
import { fetchWithTimeout } from './fetch-with-timeout'
import { parseIcoFrameSizes } from './ico-frames'
import { measureRasterSize } from './image-size'
import { sniffMimeFromBytes } from './mime-sniff'
import { parseSvgSize } from './svg-size'

const ICO_MIME_TYPES = new Set(['image/x-icon', 'image/vnd.microsoft.icon'])

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

    // 只有一种尺寸时卡片上已经写全了，不带字段，避免重复展示
    const frameSizes = ICO_MIME_TYPES.has(mimeType) ? parseIcoFrameSizes(bytes) : undefined

    return {
      ...candidate,
      mimeType,
      byteLength: bytes.length,
      width: measured?.width ?? candidate.width,
      height: measured?.height ?? candidate.height,
      ...(frameSizes && frameSizes.length > 1 && { frameSizes }),
    }
  }
  catch {
    return undefined
  }
}
