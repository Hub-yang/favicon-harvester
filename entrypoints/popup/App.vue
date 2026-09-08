<script lang="ts" setup>
import { i18n } from '#i18n'
import IconCard from './components/IconCard.vue'
import IconToolbar from './components/IconToolbar.vue'
import ScanRetryPanel from './components/ScanRetryPanel.vue'
import StatusBanner from './components/StatusBanner.vue'
import { useIconScan } from './composables/useIconScan'
import { useZipDownload } from './composables/useZipDownload'

const { loading, restricted, candidates, domain, retrying, exhausted, showRetryPanel, retry, removeCandidate } = useIconScan()
const { state: zipState, skipped, run: downloadZip } = useZipDownload(candidates, domain)

const appVersion = browser.runtime.getManifest().version
</script>

<template>
  <div class="w-[300px] text-[13px]">
    <header class="flex items-center justify-between px-3 py-2 border-b border-[var(--fh-border)]">
      <div class="flex items-center gap-1">
        <span class="font-semibold">{{ i18n.t('app.title') }}</span>
        <span class="text-[11px] text-[var(--fh-muted)]">v{{ appVersion }}</span>
      </div>
      <span class="text-[11px] text-[var(--fh-muted)]">by HuberyYang</span>
    </header>

    <StatusBanner v-if="loading || restricted" :state="loading ? 'loading' : 'restricted'" />

    <IconToolbar
      v-if="candidates.length"
      :count="candidates.length"
      :state="zipState"
      :skipped="skipped"
      @download="downloadZip"
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
