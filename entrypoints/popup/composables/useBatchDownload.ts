import type { Ref } from 'vue'
import type { IconCandidate } from '@/utils/types'
import { ref } from 'vue'
import { buildFilename } from '@/utils/icon-naming'
import { sendMessage } from '@/utils/messaging'

type BatchState = 'idle' | 'running' | 'done' | 'error'

/**
 * 批量下载当前列表里的全部候选。
 * 串行而非并行：既能逐个推进进度，也避免同名文件同时写入产生竞态。
 */
export function useBatchDownload(candidates: Ref<IconCandidate[]>, domain: Ref<string>) {
  const state = ref<BatchState>('idle')
  const completed = ref(0)
  const failedCount = ref(0)

  async function downloadOne(candidate: IconCandidate): Promise<boolean> {
    try {
      const result = await sendMessage('downloadIcon', {
        url: candidate.url,
        filename: buildFilename(domain.value, candidate),
      })
      return result.success
    }
    catch {
      // sendMessage 自身可能因扩展上下文失效等传输层原因 reject，计为该项失败并继续后续项
      return false
    }
  }

  async function run() {
    if (state.value === 'running' || candidates.value.length === 0)
      return

    state.value = 'running'
    completed.value = 0
    failedCount.value = 0

    // 快照一份，避免下载途中列表因死链摘除而变化导致遍历错位
    for (const candidate of [...candidates.value]) {
      if (!await downloadOne(candidate))
        failedCount.value += 1
      completed.value += 1
    }

    state.value = failedCount.value > 0 ? 'error' : 'done'
  }

  return { state, completed, failedCount, run }
}
