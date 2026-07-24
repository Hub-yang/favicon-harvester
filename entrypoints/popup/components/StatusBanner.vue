<script lang="ts" setup>
// 纯展示组件：加载中 / 受限页面两态提示条；空结果/重试由 ScanRetryPanel 承担
type BannerState = 'loading' | 'restricted'

defineProps<{ state: BannerState }>()

const TEXT: Record<BannerState, string> = {
  loading: '正在扫描当前页面的图标…',
  restricted: '当前页面受限，仅显示浏览器兜底图标',
}
</script>

<template>
  <div
    class="px-3 py-2 text-[12px] border-b border-[var(--fh-border)]"
    :class="state === 'restricted'
      ? 'bg-[var(--fh-warn-bg)] text-[var(--fh-warn-text)]'
      : 'text-[var(--fh-muted)]'"
  >
    {{ TEXT[state] }}
  </div>
</template>
