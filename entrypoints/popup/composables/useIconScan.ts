import type { IconCandidate } from '@/utils/types'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { sendMessage } from '@/utils/messaging'
import { sortCandidatesBySize } from '@/utils/sort-candidates'
import { verifyImageLoadable } from '@/utils/verify-image-loadable'

const MAX_RETRY_COUNT = 3

export function useIconScan() {
  const loading = ref(true)
  const restricted = ref(false)
  const candidates = ref<IconCandidate[]>([])
  const domain = ref('')
  const retrying = ref(false)
  const retryCount = ref(0)
  let active = true
  let sequence = 0
  let badgeScanId: string | undefined

  const exhausted = computed(() => retryCount.value >= MAX_RETRY_COUNT)
  const showRetryPanel = computed(() => !loading.value && candidates.value.length === 0)

  function reportBadgeCount() {
    if (badgeScanId)
      void sendMessage('reportBadgeCount', { scanId: badgeScanId, count: candidates.value.length }).catch(() => {})
  }

  async function runScan(mode: 'initial' | 'rescan' | 'retry') {
    const own = ++sequence
    const current = () => active && sequence === own
    badgeScanId = undefined
    if (mode === 'retry') {
      retrying.value = true
    }
    else {
      loading.value = true
      retrying.value = false
      retryCount.value = 0
      candidates.value = []
    }

    let completed = false
    let nextDomain = ''
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!current())
        return
      if (tab?.url) {
        try {
          nextDomain = new URL(tab.url).hostname
        }
        catch {}
      }
      if (tab?.id === undefined) {
        restricted.value = false
        candidates.value = []
        domain.value = nextDomain
        completed = true
        return
      }

      const result = await sendMessage('scanIcons', { tabId: tab.id, ...(mode !== 'initial' && { force: true }) })
      if (!current())
        return
      if (result.cancelled) {
        restricted.value = false
        candidates.value = []
        domain.value = nextDomain
        return
      }
      // 后台元数据可复用，但每次都必须在 popup 上下文实际验证图片。
      const verified = await Promise.all(
        result.candidates.map(async candidate => (await verifyImageLoadable(candidate.url)) ? candidate : undefined),
      )
      if (!current())
        return
      restricted.value = result.restricted
      domain.value = nextDomain
      candidates.value = sortCandidatesBySize(verified.filter((candidate): candidate is IconCandidate => candidate !== undefined))
      badgeScanId = result.badgeScanId
      reportBadgeCount()
      completed = true
    }
    catch {
      if (current()) {
        restricted.value = false
        candidates.value = []
        domain.value = nextDomain
        completed = true
      }
    }
    finally {
      if (current()) {
        if (mode === 'retry' && completed)
          retryCount.value = candidates.value.length ? 0 : retryCount.value + 1
        loading.value = false
        retrying.value = false
      }
    }
  }

  onMounted(() => runScan('initial'))
  onUnmounted(() => {
    active = false
    sequence++
  })

  async function rescan() {
    if (!active || loading.value)
      return
    await runScan('rescan')
  }

  const retry = useDebounceFn(async () => {
    if (!active || loading.value || retrying.value || exhausted.value)
      return
    await runScan('retry')
  }, 300)

  function removeCandidate(url: string) {
    candidates.value = candidates.value.filter(candidate => candidate.url !== url)
    reportBadgeCount()
  }

  return { loading, restricted, candidates, domain, retrying, exhausted, showRetryPanel, retry, rescan, removeCandidate }
}
