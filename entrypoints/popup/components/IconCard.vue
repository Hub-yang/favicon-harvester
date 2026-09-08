<script lang="ts" setup>
import type { IconCandidate } from '@/utils/types'
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { i18n } from '#i18n'
import { base64ToBlob } from '@/utils/base64'
import { buildFilename, resolveIconExtension } from '@/utils/icon-naming'
import { buildLinkTag } from '@/utils/link-tag'
import { sendMessage } from '@/utils/messaging'

const props = defineProps<{ candidate: IconCandidate, domain: string }>()
const emit = defineEmits<{ loadError: [url: string] }>()

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'
const downloadState = ref<DownloadState>('idle')

/** 四种复制形态，顺序即展开行里的排列顺序 */
type CopyKind = 'url' | 'image' | 'data-uri' | 'link-tag'
const COPY_KINDS: CopyKind[] = ['url', 'image', 'data-uri', 'link-tag']

const expanded = ref(false)
/** 只记录"哪个选项"处于"什么反馈态"，避免点了图片却在链接上显示已复制 */
const copyFeedback = ref<{ kind: CopyKind, state: 'copied' | 'error' } | null>(null)

/** 复制结果提示的停留时长，到点回落，便于连续复制多个图标 */
const COPY_FEEDBACK_MS = 1500

/** 系统剪贴板只接受 PNG；其他格式要塞进去就得转码，与"保留原始格式"的约束冲突 */
const PNG_MIME = 'image/png'

const SOURCE_LABEL: Record<IconCandidate['source'], string> = {
  'link': 'DOM link',
  'manifest': 'manifest',
  'well-known': 'well-known',
  'tab': i18n.t('card.sourceTab'),
}

const BUTTON_LABEL: Record<DownloadState, string> = {
  idle: i18n.t('card.download'),
  downloading: i18n.t('card.downloading'),
  done: i18n.t('card.downloaded'),
  error: i18n.t('card.retry'),
}

const COPY_KIND_LABEL: Record<CopyKind, string> = {
  'url': i18n.t('card.copyUrl'),
  'image': i18n.t('card.copyImage'),
  'data-uri': i18n.t('card.copyDataUri'),
  'link-tag': i18n.t('card.copyLinkTag'),
}

const canCopyImage = computed(() => props.candidate.mimeType === PNG_MIME)

const sizeLabel = computed(() => {
  const { width, height, sourceDetail } = props.candidate
  if (width !== undefined && height !== undefined)
    return `${width}×${height}`
  return sourceDetail ?? i18n.t('card.unknownSize')
})

// 格式标签：与下载文件名的扩展名同源，保证显示格式与实际下载扩展名一致
const formatLabel = computed(() => resolveIconExtension(props.candidate).toUpperCase())

function copyKindLabel(kind: CopyKind): string {
  if (copyFeedback.value?.kind !== kind)
    return COPY_KIND_LABEL[kind]

  return copyFeedback.value.state === 'copied' ? i18n.t('card.copied') : i18n.t('card.copyFailed')
}

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
  copyFeedback.value = null
}, COPY_FEEDBACK_MS, { immediate: false })

/** 图标字节只能由 background 取——popup 里 fetch 跨域图标会被 CORS 拦 */
async function requestIconBytes(): Promise<{ base64: string, mimeType: string }> {
  const result = await sendMessage('fetchIconBytes', { url: props.candidate.url })
  if (!result.success || result.base64 === undefined || result.mimeType === undefined)
    throw new Error(result.error ?? 'fetchIconBytes failed')

  return { base64: result.base64, mimeType: result.mimeType }
}

async function writeToClipboard(kind: CopyKind): Promise<void> {
  // popup 属于扩展页面，用户手势下的剪贴板写入无需声明 clipboardWrite 权限
  switch (kind) {
    case 'url':
      await navigator.clipboard.writeText(props.candidate.url)
      break
    case 'link-tag':
      await navigator.clipboard.writeText(buildLinkTag(props.candidate))
      break
    case 'data-uri': {
      const { base64, mimeType } = await requestIconBytes()
      await navigator.clipboard.writeText(`data:${mimeType};base64,${base64}`)
      break
    }
    case 'image': {
      const { base64 } = await requestIconBytes()
      await navigator.clipboard.write([new ClipboardItem({ [PNG_MIME]: base64ToBlob(base64, PNG_MIME) })])
      break
    }
  }
}

async function handleCopy(kind: CopyKind) {
  try {
    await writeToClipboard(kind)
    copyFeedback.value = { kind, state: 'copied' }
  }
  catch {
    // 取字节失败、剪贴板被浏览器策略拒绝都归到这里，给出可见反馈而非静默失败
    copyFeedback.value = { kind, state: 'error' }
  }
  scheduleCopyReset()
}
</script>

<template>
  <li class="px-3 py-2">
    <div class="flex items-center gap-3">
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
          @click="expanded = !expanded"
        >
          {{ i18n.t('card.copy') }}{{ expanded ? '▴' : '▾' }}
        </button>
      </div>
    </div>

    <!-- 展开行走文档流而非浮层：popup 高度有限，绝对定位的菜单在末尾卡片上会被裁掉 -->
    <div v-if="expanded" class="flex gap-1 mt-2">
      <button
        v-for="kind in COPY_KINDS"
        :key="kind"
        :data-testid="`copy-option-${kind}`"
        class="flex-1 min-w-0 truncate px-1 py-1 text-[11px] rounded cursor-pointer bg-transparent border border-solid border-[var(--fh-border)] text-[var(--fh-muted)] hover:border-[var(--fh-accent)] hover:text-[var(--fh-accent)] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--fh-border)] disabled:hover:text-[var(--fh-muted)]"
        :disabled="kind === 'image' && !canCopyImage"
        :title="kind === 'image' && !canCopyImage ? i18n.t('card.copyImageOnlyPng') : undefined"
        @click="handleCopy(kind)"
      >
        {{ copyKindLabel(kind) }}
      </button>
    </div>
  </li>
</template>
