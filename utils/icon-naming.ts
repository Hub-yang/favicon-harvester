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

function resolveExtension(candidate: IconCandidate): string {
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

export function buildFilename(domain: string, candidate: IconCandidate): string {
  if (candidate.width !== undefined && candidate.height !== undefined)
    return `${domain}-${candidate.source}-${candidate.width}x${candidate.height}.${resolveExtension(candidate)}`

  if (candidate.source === 'well-known' && candidate.sourceDetail)
    return `${domain}-${candidate.sourceDetail}`

  return `${domain}-${candidate.source}.${resolveExtension(candidate)}`
}
