import type { IconCandidate } from '../types'

const WELL_KNOWN_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
]

export function buildWellKnownCandidates(origin: string): IconCandidate[] {
  return WELL_KNOWN_PATHS.map(path => ({
    url: `${origin}${path}`,
    source: 'well-known',
    sourceDetail: path.slice(1),
  }))
}
