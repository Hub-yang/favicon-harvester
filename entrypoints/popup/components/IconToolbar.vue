<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  /** 当前列表里的候选个数，同时作为批量下载的进度分母 */
  count: number
  state: 'idle' | 'running' | 'done' | 'error'
  completed: number
  failedCount: number
}>()

defineEmits<{ download: [] }>()

const buttonLabel = computed(() => {
  switch (props.state) {
    case 'running':
      return `下载中 ${props.completed}/${props.count}…`
    case 'done':
      return '已下载'
    case 'error':
      return `${props.failedCount} 个失败，重试`
    default:
      return '全部下载'
  }
})
</script>

<template>
  <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--fh-border)]">
    <span class="text-[12px] text-[var(--fh-muted)]">{{ count }} 个图标</span>
    <button
      class="flex-none px-2.5 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
      :disabled="state === 'running'"
      @click="$emit('download')"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>
