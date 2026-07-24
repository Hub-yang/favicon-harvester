import type { IconCandidate } from '@/utils/types'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { sendMessage } from '@/utils/messaging'
import { verifyImageLoadable } from '@/utils/verify-image-loadable'

// 用户仅点击"重试"按钮的失败次数才计入，达到该次数后终止并隐藏按钮
const MAX_RETRY_COUNT = 3

export function useIconScan() {
  // 仅初次挂载扫描期间为 true，与 retrying 互不影响，避免手动重试时被"正在扫描…"横幅顶掉重试面板
  const loading = ref(true)
  const restricted = ref(false)
  const candidates = ref<IconCandidate[]>([])
  const domain = ref('')
  const retrying = ref(false)
  const retryCount = ref(0)

  const exhausted = computed(() => retryCount.value >= MAX_RETRY_COUNT)
  const showRetryPanel = computed(() => !loading.value && candidates.value.length === 0)

  async function performScan() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.url) {
      try {
        domain.value = new URL(tab.url).hostname
      }
      catch {
        domain.value = ''
      }
    }

    if (tab?.id === undefined) {
      restricted.value = false
      candidates.value = []
      return
    }

    try {
      const result = await sendMessage('scanIcons', { tabId: tab.id })
      restricted.value = result.restricted
      // 后台探测通过只代表 fetch 可达，仍需在 popup 自身上下文验证真的能渲染出来
      const verified = await Promise.all(
        result.candidates.map(async candidate => (await verifyImageLoadable(candidate.url)) ? candidate : undefined),
      )
      candidates.value = verified.filter((candidate): candidate is IconCandidate => candidate !== undefined)
    }
    catch {
      // sendMessage 自身可能因扩展上下文失效等传输层原因 reject，按"本次未获取到候选"处理
      restricted.value = false
      candidates.value = []
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      await performScan()
    }
    finally {
      loading.value = false
    }
  })

  async function runRetry() {
    if (retrying.value || exhausted.value)
      return
    retrying.value = true
    try {
      await performScan()
    }
    finally {
      retryCount.value = candidates.value.length > 0 ? 0 : retryCount.value + 1
      retrying.value = false
    }
  }

  // 防抖收敛快速连点；runRetry 内部的 retrying guard 再防止"防抖窗口外、上一次请求尚未返回"时的连点
  const retry = useDebounceFn(runRetry, 300)

  function removeCandidate(url: string) {
    candidates.value = candidates.value.filter(candidate => candidate.url !== url)
  }

  return {
    loading,
    restricted,
    candidates,
    domain,
    retrying,
    exhausted,
    showRetryPanel,
    retry,
    removeCandidate,
  }
}
