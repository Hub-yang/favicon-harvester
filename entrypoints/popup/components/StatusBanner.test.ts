import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBanner from './StatusBanner.vue'

describe('statusBanner', () => {
  it('loading 态显示扫描中文案', () => {
    const wrapper = mount(StatusBanner, { props: { state: 'loading' } })

    expect(wrapper.text()).toBe('正在扫描当前页面的图标…')
  })

  it('restricted 态显示受限文案并带告警底色 class', () => {
    const wrapper = mount(StatusBanner, { props: { state: 'restricted' } })

    expect(wrapper.text()).toBe('当前页面受限，仅显示浏览器兜底图标')
    expect(wrapper.classes()).toContain('bg-[var(--fh-warn-bg)]')
  })

  it('empty 态显示未找到文案，且不带告警底色', () => {
    const wrapper = mount(StatusBanner, { props: { state: 'empty' } })

    expect(wrapper.text()).toBe('未找到任何图标')
    expect(wrapper.classes()).not.toContain('bg-[var(--fh-warn-bg)]')
  })
})
