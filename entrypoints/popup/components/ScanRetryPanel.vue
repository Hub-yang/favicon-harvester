<script lang="ts" setup>
import { i18n } from '#i18n'

// no-results：本次扫描 0 个可展示候选，提供重试入口；exhausted：连续 3 次手动重试仍失败，终止提示，不再提供按钮
type PanelState = 'no-results' | 'exhausted'

defineProps<{ state: PanelState, retrying: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 px-3 py-6 text-[12px] text-[var(--fh-muted)]">
    <span v-if="state === 'no-results'">{{ i18n.t('retry.noResults') }}</span>
    <span v-else>{{ i18n.t('retry.empty') }}</span>

    <button
      v-if="state === 'no-results'"
      class="px-2.5 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
      :disabled="retrying"
      @click="$emit('retry')"
    >
      {{ retrying ? i18n.t('retry.retrying') : i18n.t('retry.retry') }}
    </button>
  </div>
</template>
