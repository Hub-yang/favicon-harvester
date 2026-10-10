import type { DomScanResult, IconCandidate } from '../types'
import { parseSizesAttribute } from './sizes'

export function buildDomCandidates(scan: DomScanResult): IconCandidate[] {
  return scan.icons.map((icon) => {
    const size = parseSizesAttribute(icon.sizes)
    return {
      url: icon.href,
      source: 'link',
      sourceDetail: icon.rel,
      width: size?.width,
      height: size?.height,
    }
  })
}
