import type { IconCandidate, IconZipResult } from './types'
import { strToU8, zipSync } from 'fflate'
import { base64ToBytes, bytesToBase64 } from './base64'
import { fetchIconBytes } from './icon-bytes'
import { buildIconBasename } from './icon-naming'
import { dedupeEntryNames } from './zip-entry-name'

/** icons.json 里单个图标的记录，供解压后回溯每个文件的出处 */
interface IconManifestEntry {
  file: string
  url: string
  source: IconCandidate['source']
  sourceDetail?: string
  width?: number
  height?: number
  mimeType?: string
}

interface FetchedIcon {
  candidate: IconCandidate
  bytes: Uint8Array
  mimeType?: string
}

/**
 * 取回全部候选的字节。
 * 与 icon-discovery 的探测阶段一样用 Promise.all 全量并行：候选本来就只有个位数，
 * 每个请求自带超时，再套一层并发池只是增加没人受益的复杂度。
 */
async function fetchAll(candidates: IconCandidate[]): Promise<(FetchedIcon | undefined)[]> {
  return Promise.all(candidates.map(async (candidate) => {
    try {
      const result = await fetchIconBytes(candidate.url)
      if (!result.success || !result.base64)
        return undefined

      return { candidate, bytes: base64ToBytes(result.base64), mimeType: result.mimeType }
    }
    catch {
      // 传输层异常（如扩展上下文失效）只跳过这一个图标，不拖垮整包
      return undefined
    }
  }))
}

/**
 * 把候选图标打成一个 ZIP，返回可直接交给 downloads.download 的 data URL。
 *
 * 为什么是 data URL：MV3 的 service worker 里没有 URL.createObjectURL，
 * 而 popup 侧生成的 blob URL 生命周期绑在 popup 上，面板一关下载就断。
 * data URL 自包含，交给 background 之后 popup 关不关都不影响。
 *
 * 为什么是 zipSync 而不是 zip：fflate 的异步 API 内部靠 `new Worker(URL.createObjectURL(...))`，
 * 在 service worker 里会直接抛。
 */
export async function buildIconZipDataUrl(candidates: IconCandidate[], domain: string): Promise<IconZipResult> {
  if (candidates.length === 0)
    return { success: false, error: 'no candidates' }

  const fetched = await fetchAll(candidates)
  const packed = fetched.filter((icon): icon is FetchedIcon => icon !== undefined)
  const skipped = fetched.length - packed.length
  if (packed.length === 0)
    return { success: false, error: 'all icons failed to fetch', packed: 0, skipped }

  // 命名规则与单个下载共用，重名在打包前消解——ZIP 条目重名各家解压工具行为不一致
  const entryNames = dedupeEntryNames(packed.map(icon => buildIconBasename(domain, icon.candidate)))

  const files: Record<string, Uint8Array> = {}
  const manifestEntries: IconManifestEntry[] = []
  packed.forEach((icon, index) => {
    const file = entryNames[index]!
    files[file] = icon.bytes
    manifestEntries.push({
      file,
      url: icon.candidate.url,
      source: icon.candidate.source,
      sourceDetail: icon.candidate.sourceDetail,
      width: icon.candidate.width,
      height: icon.candidate.height,
      mimeType: icon.mimeType ?? icon.candidate.mimeType,
    })
  })

  files['icons.json'] = strToU8(JSON.stringify({
    site: domain,
    generatedAt: new Date().toISOString(),
    icons: manifestEntries,
  }, null, 2))

  try {
    const zipped = zipSync(files)
    return {
      success: true,
      dataUrl: `data:application/zip;base64,${bytesToBase64(zipped)}`,
      packed: packed.length,
      skipped,
    }
  }
  catch (error) {
    return { success: false, error: String(error) }
  }
}
