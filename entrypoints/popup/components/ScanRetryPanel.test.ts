import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ScanRetryPanel from './ScanRetryPanel.vue'

describe('scanRetryPanel', () => {
  it('no-results 态渲染可点击的重试按钮，点击触发 retry', async () => {
    const wrapper = mount(ScanRetryPanel, { props: { state: 'no-results', retrying: false } })

    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.text()).toBe('重试')

    await button.trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('no-results 态 + retrying 时按钮禁用且文案变为"重试中…"', () => {
    const wrapper = mount(ScanRetryPanel, { props: { state: 'no-results', retrying: true } })

    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('重试中…')
  })

  it('exhausted 态显示终止文案且不渲染按钮', () => {
    const wrapper = mount(ScanRetryPanel, { props: { state: 'exhausted', retrying: false } })

    expect(wrapper.text()).toContain('当前网站暂无可获取的图标')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
