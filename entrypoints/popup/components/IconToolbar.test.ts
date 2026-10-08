import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IconToolbar from './IconToolbar.vue'

type ToolbarProps = InstanceType<typeof IconToolbar>['$props']

/** 只取按钮内部的图标名，断言的是「按钮挂着哪个图标」 */
function buttonIcons(wrapper: ReturnType<typeof mountToolbar>) {
  return wrapper.get('button').findAll('[class*="i-lucide-"]').map(icon => icon.classes().find(c => c.startsWith('i-lucide-')))
}

function mountToolbar(props: Partial<ToolbarProps> = {}) {
  return mount(IconToolbar, {
    props: { count: 6, state: 'idle', skipped: 0, ...props } as ToolbarProps,
  })
}

describe('iconToolbar', () => {
  it('展示当前候选个数', () => {
    expect(mountToolbar({ count: 6 }).text()).toContain('6 个图标')
  })

  it('空闲时按钮文案为"打包下载 ZIP"且可点击', () => {
    const wrapper = mountToolbar()
    const button = wrapper.get('button')

    expect(button.text()).toBe('打包下载 ZIP')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('点击按钮向父组件抛出 download 事件', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('download')).toHaveLength(1)
  })

  it('打包中禁用按钮，避免重复触发', () => {
    const wrapper = mountToolbar({ state: 'running' })
    const button = wrapper.get('button')

    expect(button.text()).toBe('打包中…')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('全部打包成功后按钮文案为"已下载"', () => {
    expect(mountToolbar({ state: 'done' }).get('button').text()).toBe('已下载')
  })

  it('有图标取不到时如实报出跳过个数，不假装整包完整', () => {
    expect(mountToolbar({ state: 'done', skipped: 2 }).get('button').text()).toBe('已下载，跳过 2 个')
  })

  it('打包失败时按钮文案提示重试', () => {
    expect(mountToolbar({ state: 'error' }).get('button').text()).toBe('打包失败，重试')
  })

  describe('按钮图标', () => {
    it('空闲时为压缩包图标', () => {
      expect(buttonIcons(mountToolbar())).toEqual(['i-lucide-file-archive'])
    })

    it('打包中为转圈图标', () => {
      const wrapper = mountToolbar({ state: 'running' })

      expect(buttonIcons(wrapper)).toEqual(['i-lucide-loader-circle'])
      expect(wrapper.get('button [class*="i-lucide-"]').classes()).toContain('animate-spin')
    })

    it('打包完成（含有跳过）为对勾图标', () => {
      expect(buttonIcons(mountToolbar({ state: 'done' }))).toEqual(['i-lucide-check'])
      expect(buttonIcons(mountToolbar({ state: 'done', skipped: 2 }))).toEqual(['i-lucide-check'])
    })

    it('打包失败为重试图标', () => {
      expect(buttonIcons(mountToolbar({ state: 'error' }))).toEqual(['i-lucide-rotate-cw'])
    })

    it('图标对读屏隐藏', () => {
      expect(mountToolbar().get('button [class*="i-lucide-"]').attributes('aria-hidden')).toBe('true')
    })
  })
})
