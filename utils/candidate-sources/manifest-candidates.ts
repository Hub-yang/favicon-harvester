import type { IconCandidate } from '../types'
import { parseSizesAttribute } from './sizes'

interface WebManifestIcon {
  src?: unknown
  sizes?: unknown
  purpose?: unknown
}

interface WebManifest {
  icons?: unknown
}

function isWebManifestIcon(value: unknown): value is WebManifestIcon {
  return typeof value === 'object' && value !== null
}

export async function fetchManifestCandidates(manifestHref: string): Promise<IconCandidate[]> {
  try {
    const response = await fetch(manifestHref)
    if (!response.ok)
      return []

    const manifest = await response.json() as WebManifest
    if (!Array.isArray(manifest.icons))
      return []

    const candidates: IconCandidate[] = []
    for (const icon of manifest.icons) {
      if (!isWebManifestIcon(icon) || typeof icon.src !== 'string' || !icon.src)
        continue

      const size = typeof icon.sizes === 'string' ? parseSizesAttribute(icon.sizes) : undefined
      candidates.push({
        url: new URL(icon.src, manifestHref).toString(),
        source: 'manifest',
        sourceDetail: typeof icon.purpose === 'string' ? icon.purpose : undefined,
        width: size?.width,
        height: size?.height,
      })
    }

    return candidates
  }
  catch {
    return []
  }
}
