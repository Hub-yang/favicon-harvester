import type { DomScanResult, IconCandidate } from '../types'
import { parseSizesAttribute } from './sizes'

export function buildDomCandidates(scan: DomScanResult): IconCandidate[] {
  return scan.icons.map((icon) => {
    const declared = parseSizesAttribute(icon.sizes)
    return {
      url: icon.href,
      source: 'link',
      sourceDetail: icon.rel,
      width: declared[0]?.width,
      height: declared[0]?.height,
      ...(declared.length > 0 && { declaredSizes: declared }),
    }
  })
}
