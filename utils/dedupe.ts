import type { IconCandidate } from './types'

/** 调用方需保证传入顺序已按 link > manifest > well-known > tab 优先级排列 */
export function dedupeByAbsoluteUrl(candidates: IconCandidate[]): IconCandidate[] {
  const seen = new Map<string, IconCandidate>()

  for (const candidate of candidates) {
    if (!seen.has(candidate.url))
      seen.set(candidate.url, candidate)
  }

  return [...seen.values()]
}
