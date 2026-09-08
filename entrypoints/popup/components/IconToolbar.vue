<script lang="ts" setup>
import { computed } from 'vue'
import { i18n } from '#i18n'

const props = defineProps<{
  /** 当前列表里的候选个数 */
  count: number
  state: 'idle' | 'running' | 'done' | 'error'
  /** 取字节失败、没能打进包里的图标数 */
  skipped: number
}>()

defineEmits<{ download: [] }>()

const buttonLabel = computed(() => {
  switch (props.state) {
    case 'running':
      return i18n.t('toolbar.zipping')
    case 'done':
      // 部分图标取不到时如实报出来，否则用户解压后会以为插件漏了
      return props.skipped > 0 ? i18n.t('toolbar.doneSkipped', [props.skipped]) : i18n.t('toolbar.done')
    case 'error':
      return i18n.t('toolbar.zipFailed')
    default:
      return i18n.t('toolbar.downloadZip')
  }
})
</script>

<template>
  <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--fh-border)]">
    <span class="text-[12px] text-[var(--fh-muted)]">{{ i18n.t('toolbar.iconCount', count) }}</span>
    <button
      class="flex-none px-2.5 py-1 text-[12px] rounded border-0 cursor-pointer text-white bg-[var(--fh-accent)] hover:bg-[var(--fh-accent-hover)] disabled:cursor-default disabled:opacity-60"
      :disabled="state === 'running'"
      @click="$emit('download')"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>
