<script lang="ts" setup>
import { i18n } from '#i18n'
import IconCard from './components/IconCard.vue'
import IconToolbar from './components/IconToolbar.vue'
import ScanRetryPanel from './components/ScanRetryPanel.vue'
import StatusBanner from './components/StatusBanner.vue'
import { useIconScan } from './composables/useIconScan'
import { useZipDownload } from './composables/useZipDownload'

const { loading, restricted, candidates, domain, retrying, exhausted, showRetryPanel, retry, rescan, removeCandidate } = useIconScan()
const { state: zipState, skipped, run: downloadZip } = useZipDownload(candidates, domain)

function rescanIfIdle() {
  if (zipState.value !== 'running')
    void rescan()
}

async function openAutoScanSettings() {
  try {
    await browser.runtime.openOptionsPage()
  }
  catch {
    // 设置也可从 Chrome 扩展管理打开。
  }
}

const appVersion = browser.runtime.getManifest().version
</script>

<template>
  <div class="w-[300px] text-[13px]">
    <header class="flex items-center justify-between px-3 py-2 border-b border-[var(--fh-border)]">
      <div class="flex items-center gap-1">
        <span class="font-semibold">{{ i18n.t('app.title') }}</span>
        <span class="text-[11px] text-[var(--fh-muted)]">v{{ appVersion }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-[var(--fh-muted)]">by HuberyYang</span>
        <button
          type="button"
          class="size-7 shrink-0 inline-flex items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fh-muted)] cursor-pointer hover:bg-[var(--fh-settings-hover)] hover:text-[var(--fh-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fh-accent-hover)]"
          :aria-label="i18n.t('autoScan.settings')"
          :title="i18n.t('autoScan.settings')"
          @click="openAutoScanSettings"
        >
          <span class="i-lucide-settings size-4" aria-hidden="true" />
        </button>
      </div>
    </header>

    <StatusBanner v-if="loading || restricted" :state="loading ? 'loading' : 'restricted'" />

    <IconToolbar
      v-if="candidates.length"
      :count="candidates.length"
      :state="zipState"
      :skipped="skipped"
      @download="downloadZip"
      @rescan="rescanIfIdle"
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
