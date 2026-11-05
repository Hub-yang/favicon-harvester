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

export type IconPageSnapshot
  = | { restricted: true }
    | { restricted: false, documentId?: string, scan: DomScanResult }

export async function readIconPage(tab: Browser.tabs.Tab): Promise<IconPageSnapshot> {
  if (!tab.url || tab.id === undefined || checkRestrictedUrl(tab.url))
    return { restricted: true }

  try {
    const results = await browser.scripting.executeScript<[], DomScanResult>({
      target: { tabId: tab.id },
      files: ['/scan-dom-icons.js'],
    })
    const result = results[0]
    if (!result?.result)
      return { restricted: true }
    return { restricted: false, documentId: result.documentId, scan: result.result }
  }
  catch {
    return { restricted: true }
  }
}

interface DiscoveryPolicy {
  manifest: typeof fetchManifestCandidates
  probe: (candidates: IconCandidate[]) => Promise<(IconCandidate | undefined)[]>
}

export async function discoverIcons(tab: Browser.tabs.Tab, page?: IconPageSnapshot, policy?: DiscoveryPolicy): Promise<ScanResult> {
  const snapshot = page ?? await readIconPage(tab)
  if (snapshot.restricted || !tab.url)
    return { restricted: true, candidates: buildFallbackCandidates(tab.favIconUrl) }

  const scan = snapshot.scan
  const origin = new URL(tab.url).origin
  const manifestCandidates = scan.manifestHref ? await (policy?.manifest ?? fetchManifestCandidates)(scan.manifestHref) : []
  const tabFavIconCandidate = buildTabFavIconCandidate(tab.favIconUrl)

  const orderedCandidates: IconCandidate[] = [
    ...buildDomCandidates(scan),
    ...manifestCandidates,
    ...buildWellKnownCandidates(origin),
    ...(tabFavIconCandidate ? [tabFavIconCandidate] : []),
  ]

  const deduped = dedupeByAbsoluteUrl(orderedCandidates)
  const probed = policy ? await policy.probe(deduped) : await Promise.all(deduped.map(candidate => probeCandidate(candidate)))
  const candidates = probed.filter((candidate): candidate is IconCandidate => candidate !== undefined)

  return { restricted: false, candidates }
}
