<script lang="ts" setup>
import type { ScanResult } from '@/utils/types'
import { computed, onMounted, ref } from 'vue'
import { sendMessage } from '@/utils/messaging'
import IconCard from './components/IconCard.vue'
import StatusBanner from './components/StatusBanner.vue'

const loading = ref(true)
const result = ref<ScanResult>()
const domain = ref('')

onMounted(async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    // 从当前页 URL 取域名，供下载文件名使用（取不到时留空，命名逻辑自行容错）
    if (tab?.url) {
      try {
        domain.value = new URL(tab.url).hostname
      }
      catch {
        domain.value = ''
      }
    }
    if (tab?.id !== undefined)
      result.value = await sendMessage('scanIcons', { tabId: tab.id })
  }
  finally {
    loading.value = false
  }
})

// 三态横幅：加载中 > 受限 > 空结果；有候选的正常态返回 undefined 不显示横幅
const bannerState = computed<'loading' | 'restricted' | 'empty' | undefined>(() => {
  if (loading.value)
    return 'loading'
  if (result.value?.restricted)
    return 'restricted'
  if (!result.value || result.value.candidates.length === 0)
    return 'empty'
  return undefined
})

const candidates = computed(() => result.value?.candidates ?? [])
</script>

<template>
  <div class="w-[360px] text-[13px]">
    <header class="px-3 py-2 font-semibold border-b border-[var(--fh-border)]">
      Favicon Harvester
    </header>

    <StatusBanner v-if="bannerState" :state="bannerState" />

    <ul class="m-0 p-0 list-none">
      <IconCard
        v-for="candidate in candidates"
        :key="candidate.url"
        :candidate="candidate"
        :domain="domain"
      />
    </ul>
  </div>
</template>
