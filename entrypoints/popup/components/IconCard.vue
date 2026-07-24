<script lang="ts" setup>
import type { IconCandidate } from '@/utils/types'
import { computed, ref } from 'vue'
import { buildFilename, resolveIconExtension } from '@/utils/icon-naming'
import { sendMessage } from '@/utils/messaging'

const props = defineProps<{ candidate: IconCandidate, domain: string }>()

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'
const downloadState = ref<DownloadState>('idle')
const imageFailed = ref(false)

// 来源的中文/可读标签
const SOURCE_LABEL: Record<IconCandidate['source'], string> = {
  'link': 'DOM link',
  'manifest': 'manifest',
  'well-known': 'well-known',
  'tab': '浏览器兜底',
}

// 下载按钮各状态文案
const BUTTON_LABEL: Record<DownloadState, string> = {
  idle: '下载',
  downloading: '下载中…',
  done: '已下载',
  error: '重试',
}

// 尺寸展示：有宽高显示 W×H，否则回退到 sourceDetail 或"尺寸未知"
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
  const result = await sendMessage('downloadIcon', { url: props.candidate.url, filename })
  downloadState.value = result.success ? 'done' : 'error'
}
</script>

<template>
  <li class="flex items-center gap-3 px-3 py-2">
    <!-- 缩略图：棋盘格底衬 + object-contain，img 直连候选 URL 不受 CORS 限制 -->
    <div class="fh-checker flex-none w-10 h-10 rounded flex items-center justify-center overflow-hidden">
      <img
        v-if="!imageFailed"
        :src="candidate.url"
        alt=""
        class="max-w-full max-h-full object-contain"
        @error="imageFailed = true"
      >
      <span v-else class="text-[10px] text-[var(--fh-muted)]">失败</span>
    </div>

    <!-- 尺寸 + 来源 -->
    <div class="flex-1 min-w-0">
      <div class="truncate text-[var(--fh-text)]">
        {{ sizeLabel }}
      </div>
      <div class="text-[11px] text-[var(--fh-muted)]">
        {{ SOURCE_LABEL[candidate.source] }} · {{ formatLabel }}
      </div>
    </div>

    <!-- 下载按钮 -->
    <button
      class="flex-none px-2.5 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
      :disabled="downloadState === 'downloading'"
      @click="handleDownload"
    >
      {{ BUTTON_LABEL[downloadState] }}
    </button>
  </li>
</template>
