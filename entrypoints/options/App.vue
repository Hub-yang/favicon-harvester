<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { i18n } from '#i18n'
import {
  AUTO_SCAN_ENABLED_KEY,
  AUTO_SCAN_HOST_PATTERNS,
  readAutoScanEnabled,
  readAutoScanOrigins,
  writeAutoScanEnabled,
} from '@/utils/auto-scan-settings'
import { sendMessage } from '@/utils/messaging'

const ready = ref(false)
const busy = ref(false)
const enabled = ref(false)
const authorized = ref(false)
const feedback = ref<'denied' | 'saveFailed' | 'revokeFailed' | undefined>()
let revision = 0

async function refresh() {
  const current = ++revision
  try {
    const [setting, origins] = await Promise.all([readAutoScanEnabled(), readAutoScanOrigins()])
    if (current === revision) {
      enabled.value = setting
      authorized.value = origins.length > 0
      ready.value = true
    }
  }
  catch {
    if (current === revision) {
      ready.value = false
      feedback.value = 'saveFailed'
    }
  }
}

async function enable() {
  if (!ready.value || busy.value)
    return
  busy.value = true
  feedback.value = undefined
  try {
    if (!await browser.permissions.request({ origins: [...AUTO_SCAN_HOST_PATTERNS] })) {
      feedback.value = 'denied'
      return
    }
    if (!(await readAutoScanOrigins()).length) {
      feedback.value = 'denied'
      return
    }
    await writeAutoScanEnabled(true)
    await refresh()
  }
  catch {
    feedback.value = 'saveFailed'
  }
  finally {
    busy.value = false
  }
}

async function disable() {
  if (!ready.value || busy.value)
    return
  busy.value = true
  feedback.value = undefined
  try {
    await sendMessage('pauseAutoScan').catch(() => {})
    await writeAutoScanEnabled(false)
    ++revision
    enabled.value = false
    try {
      const origins = await readAutoScanOrigins()
      if (origins.length && (!await browser.permissions.remove({ origins }) || (await readAutoScanOrigins()).length))
        feedback.value = 'revokeFailed'
    }
    catch {
      feedback.value = 'revokeFailed'
    }
  }
  catch {
    feedback.value = 'saveFailed'
  }
  finally {
    busy.value = false
  }
}

async function closeOptions() {
  const tab = await browser.tabs.getCurrent()
  if (tab?.id !== undefined)
    await browser.tabs.remove(tab.id)
}

const onSettingChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
  if (area === 'local' && changes[AUTO_SCAN_ENABLED_KEY])
    void refresh()
}

onMounted(() => {
  browser.storage.onChanged.addListener(onSettingChanged)
  browser.permissions.onAdded.addListener(refresh)
  browser.permissions.onRemoved.addListener(refresh)
  void refresh()
})
onUnmounted(() => {
  ++revision
  browser.storage.onChanged.removeListener(onSettingChanged)
  browser.permissions.onAdded.removeListener(refresh)
  browser.permissions.onRemoved.removeListener(refresh)
})
</script>

<template>
  <main class="mx-auto max-w-xl px-6 py-10 text-base">
    <h1 class="text-2xl font-semibold">
      {{ i18n.t('autoScan.title') }}
    </h1>
    <p class="my-4 leading-relaxed">
      {{ i18n.t('autoScan.description') }}
    </p>
    <p class="mb-6 leading-relaxed">
      {{ i18n.t('autoScan.toolbarHint') }}
    </p>
    <p v-if="enabled && !authorized" class="mb-3">
      {{ i18n.t('autoScan.noSiteAccess') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <button
        v-if="!enabled || !authorized"
        type="button"
        data-action="enable"
        class="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        :disabled="!ready || busy"
        @click="enable"
      >
        {{ i18n.t('autoScan.enable') }}
      </button>
      <button
        v-if="enabled"
        type="button"
        data-action="disable"
        class="rounded-md border px-4 py-2 disabled:opacity-50"
        :disabled="!ready || busy"
        @click="disable"
      >
        {{ i18n.t('autoScan.disable') }}
      </button>
      <button
        v-else
        type="button"
        class="rounded-md border px-4 py-2 disabled:opacity-50"
        :disabled="busy"
        @click="closeOptions"
      >
        {{ i18n.t('autoScan.later') }}
      </button>
    </div>
    <p v-if="feedback" class="mt-4" role="status">
      {{ i18n.t(`autoScan.${feedback}`) }}
    </p>
  </main>
</template>
