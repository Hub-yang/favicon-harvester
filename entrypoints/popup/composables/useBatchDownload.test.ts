import type { IconCandidate } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { sendMessage } from '@/utils/messaging'
import { useBatchDownload } from './useBatchDownload'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn() }))

const CANDIDATE_A: IconCandidate = { url: 'https://example.com/a.png', source: 'link', width: 32, height: 32 }
const CANDIDATE_B: IconCandidate = { url: 'https://example.com/b.png', source: 'manifest', width: 16, height: 16 }

function mountBatch(candidates: IconCandidate[]) {
  const Harness = defineComponent({
    setup: () => useBatchDownload(ref(candidates), ref('example.com')),
    template: '<div />',
  })
  return mount(Harness)
}

/** 让 sendMessage 的每次调用都返回一个可由测试手动兑现的 promise，用于观察串行行为 */
function controllableSendMessage() {
  const resolvers: ((value: { success: boolean }) => void)[] = []
  vi.mocked(sendMessage).mockImplementation(() => new Promise((resolve) => {
    resolvers.push(resolve)
  }) as ReturnType<typeof sendMessage>)
  return resolvers
}

describe('useBatchDownload', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('逐个下载全部候选，文件名与单个下载共用 buildFilename 规则', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(sendMessage).toHaveBeenNthCalledWith(1, 'downloadIcon', {
      url: 'https://example.com/a.png',
      filename: 'example.com-link-32x32.png',
    })
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'downloadIcon', {
      url: 'https://example.com/b.png',
      filename: 'example.com-manifest-16x16.png',
    })
  })

  it('串行执行：前一个下载未返回时不会发出下一个请求', async () => {
    const resolvers = controllableSendMessage()

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    wrapper.vm.run()
    await flushPromises()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.state).toBe('running')
    expect(wrapper.vm.completed).toBe(0)

    resolvers[0]({ success: true })
    await flushPromises()

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.completed).toBe(1)

    resolvers[1]({ success: true })
    await flushPromises()

    expect(wrapper.vm.completed).toBe(2)
    expect(wrapper.vm.state).toBe('done')
  })

  it('全部成功后进入 done 且失败数为 0', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('done')
    expect(wrapper.vm.failedCount).toBe(0)
  })

  it('部分失败时进入 error 并记录失败个数，且不中断剩余下载', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ success: false, error: 'boom' } as Awaited<ReturnType<typeof sendMessage>>)
      .mockResolvedValueOnce({ success: true } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.state).toBe('error')
    expect(wrapper.vm.failedCount).toBe(1)
  })

  it('sendMessage 本身 reject（如扩展上下文失效）计为失败而非让整批崩掉', async () => {
    vi.mocked(sendMessage)
      .mockRejectedValueOnce(new Error('Extension context invalidated'))
      .mockResolvedValueOnce({ success: true } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()

    expect(wrapper.vm.state).toBe('error')
    expect(wrapper.vm.failedCount).toBe(1)
    expect(wrapper.vm.completed).toBe(2)
  })

  it('进行中重复触发不会叠加发出重复请求', async () => {
    const resolvers = controllableSendMessage()

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    wrapper.vm.run()
    await flushPromises()
    wrapper.vm.run()
    await flushPromises()

    expect(sendMessage).toHaveBeenCalledTimes(1)

    resolvers[0]({ success: true })
    resolvers[1]?.({ success: true })
    await flushPromises()
  })

  it('失败后再次触发会重置进度与失败数重新跑一遍', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ success: false, error: 'boom' } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountBatch([CANDIDATE_A, CANDIDATE_B])
    await wrapper.vm.run()
    expect(wrapper.vm.failedCount).toBe(2)

    vi.mocked(sendMessage).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof sendMessage>>)
    await wrapper.vm.run()

    expect(wrapper.vm.failedCount).toBe(0)
    expect(wrapper.vm.state).toBe('done')
  })

  it('没有候选时不发任何请求，状态保持 idle', async () => {
    const wrapper = mountBatch([])
    await wrapper.vm.run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state).toBe('idle')
  })
})
