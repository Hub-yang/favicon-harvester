import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IconToolbar from './IconToolbar.vue'

type ToolbarProps = InstanceType<typeof IconToolbar>['$props']

function mountToolbar(props: Partial<ToolbarProps> = {}) {
  return mount(IconToolbar, {
    props: { count: 6, state: 'idle', completed: 0, failedCount: 0, ...props } as ToolbarProps,
  })
}

describe('iconToolbar', () => {
  it('展示当前候选个数', () => {
    expect(mountToolbar({ count: 6 }).text()).toContain('6 个图标')
  })

  it('空闲时按钮文案为"全部下载"且可点击', () => {
    const wrapper = mountToolbar()
    const button = wrapper.get('button')

    expect(button.text()).toBe('全部下载')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('点击按钮向父组件抛出 download 事件', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('download')).toHaveLength(1)
  })

  it('下载中展示进度并禁用按钮，避免重复触发', () => {
    const wrapper = mountToolbar({ state: 'running', completed: 3 })
    const button = wrapper.get('button')

    expect(button.text()).toBe('下载中 3/6…')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('全部成功后按钮文案为"已下载"', () => {
    expect(mountToolbar({ state: 'done', completed: 6 }).get('button').text()).toBe('已下载')
  })

  it('存在失败项时按钮文案报出失败个数并提示重试', () => {
    expect(mountToolbar({ state: 'error', completed: 6, failedCount: 2 }).get('button').text()).toBe('2 个失败，重试')
  })
})
