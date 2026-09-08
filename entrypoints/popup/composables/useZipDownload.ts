import type { Ref } from 'vue'
import type { IconCandidate } from '@/utils/types'
import { ref } from 'vue'
import { sendMessage } from '@/utils/messaging'

type ZipState = 'idle' | 'running' | 'done' | 'error'

/**
 * 把当前列表里的全部候选打成一个 ZIP 下载。
 *
 * 只发一条消息：取字节、打包、发起下载都在 background 完成，
 * 因此面板在打包途中被关掉也不影响下载落盘——这是它相对逐个下载的主要优势。
 * 代价是没有逐项进度，只能给一个「打包中」的整体状态。
 */
export function useZipDownload(candidates: Ref<IconCandidate[]>, domain: Ref<string>) {
  const state = ref<ZipState>('idle')
  const skipped = ref(0)

  async function run() {
    if (state.value === 'running' || candidates.value.length === 0)
      return

    state.value = 'running'
    skipped.value = 0

    try {
      const result = await sendMessage('downloadIconsZip', {
        // 快照一份，避免打包途中列表因死链摘除而变化
        candidates: [...candidates.value],
        domain: domain.value,
      })
      skipped.value = result.skipped ?? 0
      state.value = result.success ? 'done' : 'error'
    }
    catch {
      // sendMessage 自身可能因扩展上下文失效等传输层原因 reject
      state.value = 'error'
    }
  }

  return { state, skipped, run }
}
