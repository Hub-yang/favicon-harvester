<script lang="ts" setup>
import type { IconCandidate } from '@/utils/types'
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { buildFilename, resolveIconExtension } from '@/utils/icon-naming'
import { sendMessage } from '@/utils/messaging'

const props = defineProps<{ candidate: IconCandidate, domain: string }>()
const emit = defineEmits<{ loadError: [url: string] }>()

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'
const downloadState = ref<DownloadState>('idle')

type CopyState = 'idle' | 'copied' | 'error'
const copyState = ref<CopyState>('idle')

/** 复制结果提示的停留时长，到点回落为 idle，便于连续复制多个图标 */
const COPY_FEEDBACK_MS = 1500

const SOURCE_LABEL: Record<IconCandidate['source'], string> = {
  'link': 'DOM link',
  'manifest': 'manifest',
  'well-known': 'well-known',
  'tab': '浏览器兜底',
}

const BUTTON_LABEL: Record<DownloadState, string> = {
  idle: '下载',
  downloading: '下载中…',
  done: '已下载',
  error: '重试',
}

const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  error: '失败',
}

const sizeLabel = computed(() => {
  const { width, height, sourceDetail } = props.candidate
  if (width !== undefined && height !== undefined)
    return `${width}×${height}`
  return sourceDetail ?? '尺寸未知'
})

// 格式标签：与下载文件名的扩展名同源，保证显示格式与实际下载扩展名一致
const formatLabel = computed(() => resolveIconExtension(props.candidate).toUpperCase())

async function handleDownload() {
  if (downloadState.value === 'downloading')
    return
  downloadState.value = 'downloading'
  // 文件名由统一的 buildFilename 计算，domain 由父组件算好传入，避免重复命名逻辑
  const filename = buildFilename(props.domain, props.candidate)
  try {
    const result = await sendMessage('downloadIcon', { url: props.candidate.url, filename })
    downloadState.value = result.success ? 'done' : 'error'
  }
  catch {
    // sendMessage 自身可能因扩展上下文失效等传输层原因 reject，非 downloadIconFile 内部错误
    downloadState.value = 'error'
  }
}

// 重复点击时重新计时，而不是让上一次的定时器提前把提示清掉
const { start: scheduleCopyReset } = useTimeoutFn(() => {
  copyState.value = 'idle'
}, COPY_FEEDBACK_MS, { immediate: false })

async function handleCopy() {
  try {
    // popup 属于扩展页面，用户手势下的 writeText 无需声明 clipboardWrite 权限
    await navigator.clipboard.writeText(props.candidate.url)
    copyState.value = 'copied'
  }
  catch {
    // 剪贴板可能因浏览器策略拒绝写入，给出可见反馈而非静默失败
    copyState.value = 'error'
  }
  scheduleCopyReset()
}
</script>

<template>
  <li class="flex items-center gap-3 px-3 py-2">
    <!-- img 直连候选 URL，不走 fetch，因此不受 CORS 限制 -->
    <div class="fh-checker flex-none w-10 h-10 rounded flex items-center justify-center overflow-hidden">
      <img
        :src="candidate.url"
        alt=""
        class="max-w-full max-h-full object-contain"
        @error="emit('loadError', candidate.url)"
      >
    </div>

    <div class="flex-1 min-w-0">
      <div class="truncate text-[var(--fh-text)]">
        {{ sizeLabel }}
      </div>
      <div class="text-[11px] text-[var(--fh-muted)]">
        {{ SOURCE_LABEL[candidate.source] }} · {{ formatLabel }}
      </div>
    </div>

    <div class="flex-none flex flex-col gap-1 w-[58px]">
      <button
        data-testid="download-button"
        class="px-2 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
        :disabled="downloadState === 'downloading'"
        @click="handleDownload"
      >
        {{ BUTTON_LABEL[downloadState] }}
      </button>
      <button
        data-testid="copy-button"
        class="px-2 py-1 text-[12px] rounded cursor-pointer bg-transparent border border-solid border-[var(--fh-border)] text-[var(--fh-muted)] hover:border-[var(--fh-accent)] hover:text-[var(--fh-accent)]"
        @click="handleCopy"
      >
        {{ COPY_LABEL[copyState] }}
      </button>
    </div>
  </li>
</template>
