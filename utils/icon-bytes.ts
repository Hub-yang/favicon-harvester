import type { IconBytesResult } from './types'
import { bytesToBase64 } from './base64'
import { fetchWithTimeout } from './fetch-with-timeout'
import { sniffMimeFromBytes } from './mime-sniff'

/**
 * 取图标原始字节交给 popup 使用（复制图片 / 复制 Data URI）。
 * 必须跑在 background：popup 里直接 fetch 跨域图标会被 CORS 拦。
 *
 * MIME 判定与 candidate-probe 保持同一套规则——响应头优先，
 * 但 octet-stream 这种没信息量的值改用字节嗅探，否则 Data URI 会带上错误的类型。
 */
export async function fetchIconBytes(url: string, timeoutMs = 5000): Promise<IconBytesResult> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs)
    if (!response.ok)
      return { success: false, error: `HTTP ${response.status}` }

    const bytes = new Uint8Array(await response.arrayBuffer())

    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const mimeType = headerMime && headerMime !== 'application/octet-stream'
      ? headerMime
      : sniffMimeFromBytes(bytes)
    if (!mimeType)
      return { success: false, error: 'unknown MIME type' }

    return { success: true, base64: bytesToBase64(bytes), mimeType }
  }
  catch (error) {
    return { success: false, error: String(error) }
  }
}
