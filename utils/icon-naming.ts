import type { IconCandidate } from './types'

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const KNOWN_URL_EXTENSIONS = new Set(['png', 'svg', 'ico', 'jpg', 'jpeg', 'gif', 'webp'])
const DEFAULT_EXTENSION = 'png'

export function resolveIconExtension(candidate: IconCandidate): string {
  if (candidate.mimeType) {
    const mappedExtension = MIME_EXTENSION_MAP[candidate.mimeType.toLowerCase()]
    if (mappedExtension)
      return mappedExtension
  }

  const pathExtension = /\.([a-z0-9]+)$/i.exec(new URL(candidate.url).pathname)?.[1]?.toLowerCase()
  if (pathExtension && KNOWN_URL_EXTENSIONS.has(pathExtension))
    return pathExtension === 'jpeg' ? 'jpg' : pathExtension

  return DEFAULT_EXTENSION
}

/** 下载根目录，避免图标散落在用户的下载目录顶层 */
const DOWNLOAD_DIRECTORY = 'favicon-harvester'

/**
 * 生成 downloads.download 的 filename。
 * 返回相对路径 `favicon-harvester/<域名>/<域名>-<来源>-<尺寸>.<扩展名>`，
 * Chrome 会在用户的默认下载目录下自动建出缺失的层级。
 */
export function buildFilename(domain: string, candidate: IconCandidate): string {
  // 域名可能因页面受限而取不到，此时只落到根目录，避免出现空目录层级和前导连字符
  const directory = domain ? `${DOWNLOAD_DIRECTORY}/${domain}/` : `${DOWNLOAD_DIRECTORY}/`
  const namePrefix = domain ? `${domain}-` : ''

  if (candidate.width !== undefined && candidate.height !== undefined)
    return `${directory}${namePrefix}${candidate.source}-${candidate.width}x${candidate.height}.${resolveIconExtension(candidate)}`

  if (candidate.source === 'well-known' && candidate.sourceDetail)
    return `${directory}${namePrefix}${candidate.sourceDetail}`

  return `${directory}${namePrefix}${candidate.source}.${resolveIconExtension(candidate)}`
}
