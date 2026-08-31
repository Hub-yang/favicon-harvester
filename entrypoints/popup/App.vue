<script lang="ts" setup>
import IconCard from './components/IconCard.vue'
import IconToolbar from './components/IconToolbar.vue'
import ScanRetryPanel from './components/ScanRetryPanel.vue'
import StatusBanner from './components/StatusBanner.vue'
import { useBatchDownload } from './composables/useBatchDownload'
import { useIconScan } from './composables/useIconScan'

const { loading, restricted, candidates, domain, retrying, exhausted, showRetryPanel, retry, removeCandidate } = useIconScan()
const { state: batchState, completed, failedCount, run: downloadAll } = useBatchDownload(candidates, domain)

const appVersion = browser.runtime.getManifest().version
</script>

<template>
  <div class="w-[300px] text-[13px]">
    <header class="flex items-center justify-between px-3 py-2 border-b border-[var(--fh-border)]">
      <div class="flex items-center gap-1">
        <span class="font-semibold">图标提取器</span>
        <span class="text-[11px] text-[var(--fh-muted)]">v{{ appVersion }}</span>
      </div>
      <!-- 作者信息：当前为纯文本，后续替换为主页链接 <a :href="..."> -->
      <span class="text-[11px] text-[var(--fh-muted)]">by HuberyYang</span>
    </header>

    <StatusBanner v-if="loading || restricted" :state="loading ? 'loading' : 'restricted'" />

    <IconToolbar
      v-if="candidates.length"
      :count="candidates.length"
      :state="batchState"
      :completed="completed"
      :failed-count="failedCount"
      @download="downloadAll"
    />

    <ul v-if="candidates.length" class="m-0 p-0 list-none divide-y divide-[var(--fh-border)]">
      <IconCard
        v-for="candidate in candidates"
        :key="candidate.url"
        :candidate="candidate"
        :domain="domain"
        @load-error="removeCandidate"
      />
    </ul>

    <ScanRetryPanel
      v-if="showRetryPanel"
      :state="exhausted ? 'exhausted' : 'no-results'"
      :retrying="retrying"
      @retry="retry"
    />
  </div>
</template>
