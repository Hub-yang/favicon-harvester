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
 * 生成不含目录的扁平文件名 `<域名>-<来源>-<尺寸>.<扩展名>`。
 * 单个下载由 buildFilename 补上目录前缀，ZIP 打包则直接拿它当条目名。
 */
export function buildIconBasename(domain: string, candidate: IconCandidate): string {
  // 域名可能因页面受限而取不到，此时不加前缀，避免出现前导连字符
  const namePrefix = domain ? `${domain}-` : ''

  if (candidate.width !== undefined && candidate.height !== undefined)
    return `${namePrefix}${candidate.source}-${candidate.width}x${candidate.height}.${resolveIconExtension(candidate)}`

  if (candidate.source === 'well-known' && candidate.sourceDetail)
    return `${namePrefix}${candidate.sourceDetail}`

  return `${namePrefix}${candidate.source}.${resolveIconExtension(candidate)}`
}

/**
 * 生成 downloads.download 的 filename。
 * 返回相对路径 `favicon-harvester/<域名>/<域名>-<来源>-<尺寸>.<扩展名>`，
 * Chrome 会在用户的默认下载目录下自动建出缺失的层级。
 */
export function buildFilename(domain: string, candidate: IconCandidate): string {
  // 域名缺失时只落到根目录，避免出现空目录层级
  const directory = domain ? `${DOWNLOAD_DIRECTORY}/${domain}/` : `${DOWNLOAD_DIRECTORY}/`
  return `${directory}${buildIconBasename(domain, candidate)}`
}

/**
 * 生成 ZIP 包的 filename：`favicon-harvester/<域名>-icons.zip`。
 * 刻意与 `<域名>/` 目录平级而不是套进去——包里装的就是那个目录的内容，再嵌一层只会让人多点一次。
 */
export function buildZipFilename(domain: string): string {
  return `${DOWNLOAD_DIRECTORY}/${domain ? `${domain}-` : ''}icons.zip`
}
