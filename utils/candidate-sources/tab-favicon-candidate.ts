import type { IconCandidate } from '../types'

export function buildTabFavIconCandidate(favIconUrl: string | undefined): IconCandidate | undefined {
  if (!favIconUrl)
    return undefined

  return { url: favIconUrl, source: 'tab' }
}
