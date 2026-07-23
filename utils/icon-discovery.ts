import type { DomScanResult, IconCandidate, ScanResult } from './types'
import { probeCandidate } from './candidate-probe'
import { buildDomCandidates } from './candidate-sources/dom-candidates'
import { fetchManifestCandidates } from './candidate-sources/manifest-candidates'
import { buildTabFavIconCandidate } from './candidate-sources/tab-favicon-candidate'
import { buildWellKnownCandidates } from './candidate-sources/well-known-candidates'
import { dedupeByAbsoluteUrl } from './dedupe'
import { checkRestrictedUrl } from './restricted-pages'

function buildFallbackCandidates(favIconUrl: string | undefined): IconCandidate[] {
  const candidate = buildTabFavIconCandidate(favIconUrl)
  return candidate ? [candidate] : []
}

export async function discoverIcons(tab: Browser.tabs.Tab): Promise<ScanResult> {
  if (!tab.url || tab.id === undefined || checkRestrictedUrl(tab.url))
    return { restricted: true, candidates: buildFallbackCandidates(tab.favIconUrl) }

  let scan: DomScanResult
  try {
    const results = await browser.scripting.executeScript<[], DomScanResult>({
      target: { tabId: tab.id },
      files: ['/scan-dom-icons.js'],
    })
    const result = results[0]?.result
    if (!result)
      throw new Error('scan-dom-icons.js returned no result')
    scan = result
  }
  catch {
    return { restricted: true, candidates: buildFallbackCandidates(tab.favIconUrl) }
  }

  const origin = new URL(tab.url).origin
  const manifestCandidates = scan.manifestHref ? await fetchManifestCandidates(scan.manifestHref) : []
  const tabFavIconCandidate = buildTabFavIconCandidate(tab.favIconUrl)

  const orderedCandidates: IconCandidate[] = [
    ...buildDomCandidates(scan),
    ...manifestCandidates,
    ...buildWellKnownCandidates(origin),
    ...(tabFavIconCandidate ? [tabFavIconCandidate] : []),
  ]

  const deduped = dedupeByAbsoluteUrl(orderedCandidates)
  const probed = await Promise.all(deduped.map(candidate => probeCandidate(candidate)))
  const candidates = probed.filter((candidate): candidate is IconCandidate => candidate !== undefined)

  return { restricted: false, candidates }
}
