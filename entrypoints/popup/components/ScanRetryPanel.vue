<script lang="ts" setup>
// no-results：本次扫描 0 个可展示候选，提供重试入口；exhausted：连续 3 次手动重试仍失败，终止提示，不再提供按钮
type PanelState = 'no-results' | 'exhausted'

defineProps<{ state: PanelState, retrying: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 px-3 py-6 text-[12px] text-[var(--fh-muted)]">
    <span v-if="state === 'no-results'">未能获取到可展示的图标</span>
    <span v-else>当前网站暂无可获取的图标</span>

    <button
      v-if="state === 'no-results'"
      class="px-2.5 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
      :disabled="retrying"
      @click="$emit('retry')"
    >
      {{ retrying ? '重试中…' : '重试' }}
    </button>
  </div>
</template>
