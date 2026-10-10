import type { IconCandidate } from './types'
import { fetchWithTimeout } from './fetch-with-timeout'
import { parseIcoFrameSizes } from './ico-frames'
import { resolveIconExtension } from './icon-naming'
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

    // 与格式标签同源判定：服务器回 image/ico 这类非标准头时，卡片照样写着 ICO，帧尺寸也不能缺
    const frameSizes = resolveIconExtension({ ...candidate, mimeType }) === 'ico' ? parseIcoFrameSizes(bytes) : undefined

    return {
      ...candidate,
      mimeType,
      byteLength: bytes.length,
      width: measured?.width ?? candidate.width,
      height: measured?.height ?? candidate.height,
      // 只有一种尺寸时卡片第一行已经写全了，不带字段，避免重复展示
      ...(frameSizes && frameSizes.length > 1 && { frameSizes }),
    }
  }
  catch {
    return undefined
  }
}
