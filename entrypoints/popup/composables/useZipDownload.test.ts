import type { IconCandidate, ZipDownloadResult } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { sendMessage } from '@/utils/messaging'
import { useZipDownload } from './useZipDownload'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn() }))

const CANDIDATE_A: IconCandidate = { url: 'https://example.com/a.png', source: 'link', width: 32, height: 32 }
const CANDIDATE_B: IconCandidate = { url: 'https://example.com/b.png', source: 'manifest', width: 16, height: 16 }

function mountZip(candidates: IconCandidate[]) {
  const Harness = defineComponent({
    setup: () => useZipDownload(ref(candidates), ref('example.com')),
    template: '<div />',
  })
  return mount(Harness)
}

function mockZipResult(result: { success: boolean, packed?: number, skipped?: number, error?: string }) {
  vi.mocked(sendMessage).mockResolvedValue(result as Awaited<ReturnType<typeof sendMessage>>)
}

describe('useZipDownload', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('把整份候选列表和域名一次性交给 background 打包，而不是逐个请求', async () => {
    mockZipResult({ success: true, packed: 2, skipped: 0 })

    const wrapper = mountZip([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('downloadIconsZip', {
      candidates: [CANDIDATE_A, CANDIDATE_B],
      domain: 'example.com',
    })
  })

  it('打包成功后进入 done，跳过数为 0', async () => {
    mockZipResult({ success: true, packed: 2, skipped: 0 })

    const wrapper = mountZip([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('done')
    expect(wrapper.vm.skipped).toBe(0)
  })

  it('部分图标取不到时仍算成功，但记录跳过数供面板提示', async () => {
    mockZipResult({ success: true, packed: 1, skipped: 1 })

    const wrapper = mountZip([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('done')
    expect(wrapper.vm.skipped).toBe(1)
  })

  it('打包失败时进入 error', async () => {
    mockZipResult({ success: false, error: 'all icons failed to fetch' })

    const wrapper = mountZip([CANDIDATE_A])
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('error')
  })

  it('sendMessage 本身 reject（如扩展上下文失效）也进入 error 而不是抛出去', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('Extension context invalidated'))

    const wrapper = mountZip([CANDIDATE_A])
    await expect(wrapper.vm.run()).resolves.toBeUndefined()

    expect(wrapper.vm.state).toBe('error')
  })

  it('打包途中重复触发不会叠加发出重复请求', async () => {
    let resolveZip: (value: ZipDownloadResult) => void = () => {}
    vi.mocked(sendMessage).mockImplementation(() => new Promise<ZipDownloadResult>((resolve) => {
      resolveZip = resolve
    }) as ReturnType<typeof sendMessage>)

    const wrapper = mountZip([CANDIDATE_A])
    wrapper.vm.run()
    await flushPromises()
    expect(wrapper.vm.state).toBe('running')

    wrapper.vm.run()
    await flushPromises()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    resolveZip({ success: true, packed: 1, skipped: 0 })
    await flushPromises()
  })

  it('失败后再次触发会重置状态重新打包', async () => {
    mockZipResult({ success: false, error: 'boom' })

    const wrapper = mountZip([CANDIDATE_A])
    await wrapper.vm.run()
    expect(wrapper.vm.state).toBe('error')

    mockZipResult({ success: true, packed: 1, skipped: 0 })
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('done')
    expect(wrapper.vm.skipped).toBe(0)
  })

  it('没有候选时不发任何请求，状态保持 idle', async () => {
    const wrapper = mountZip([])
    await wrapper.vm.run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state).toBe('idle')
  })
})
