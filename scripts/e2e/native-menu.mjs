// FH-33 本地有界面 E2E。先 pnpm build，再指定 FH_CHROME 后运行本文件。
// FH_EXTENSION_DIR 可指向隔离的构建副本。以下操作由获准的 Codex 桌面工具执行：
// 1. FH33_READY：核对 app、pid、A 窗口与 URL。右击 A 的网页内容无障碍节点。
//    原生菜单须出现「检查」。在同一棵树中按 title 找唯一可用项，保留本次索引。
//    向 runDir 原子写入 menu.json：{ pid, title, state: 'visible' | 'missing' }。
// 2. FH33_ARMED：原子写入 select-request.json：{ pid, title }，等待 FH33_SELECT。
// 3. FH33_SELECT：只点刚定位的菜单项。工具确认操作后，原子写入
//    selection.json：{ pid, title, selected: true }。回执和阶段日志一起保留用于复核。
// 退出码 0 为通过，1 为产品断言失败，2 为环境或操作失败。

/* global chrome */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const extensionSource = path.resolve(process.env.FH_EXTENSION_DIR ?? path.join(repo, '.output/chrome-mv3'))
const abort = new AbortController()
const hostDenied = /cannot access contents of the page.*permission.*host/i

let browser
let server
let runDir

class ProbeFailure extends Error {
  constructor(code, detail, exitCode = 2) {
    super(detail)
    this.code = code
    this.exitCode = exitCode
  }
}

function log(stage, detail) {
  console.log(`FH33_${stage} ${JSON.stringify(detail)}`)
}

function expect(condition, code, detail, exitCode) {
  if (!condition)
    throw new ProbeFailure(code, detail, exitCode)
}

async function waitFor(read, timeout, code, detail, exitCode) {
  const deadline = Date.now() + timeout
  do {
    abort.signal.throwIfAborted()
    const value = await read()
    if (value)
      return value
    await delay(100, undefined, { signal: abort.signal })
  } while (Date.now() < deadline)
  throw new ProbeFailure(code, detail, exitCode)
}

async function readReceipt(file, identity, timeout = 120_000) {
  const reply = await waitFor(async () => {
    try {
      return JSON.parse(await fs.readFile(path.join(runDir, file), 'utf8'))
    }
    catch (error) {
      if (error.code !== 'ENOENT')
        throw error
      return null
    }
  }, timeout, 'DRIVER_TIMEOUT', `未收到 ${file}`)
  expect(reply.pid === identity.pid && reply.title === identity.title, 'DRIVER_IDENTITY', `${file} 与本轮 PID 或菜单标题不符`)
  return reply
}

async function inspectAccess(tabIds) {
  const access = {}
  for (const [name, tabId] of Object.entries(tabIds)) {
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: () => document.title })
      access[name] = { allowed: true, title: result.result }
    }
    catch (error) {
      access[name] = { allowed: false, error: error.message }
    }
  }
  return access
}

async function run() {
  const chromePath = process.env.FH_CHROME
  expect(process.platform === 'darwin' && chromePath && path.isAbsolute(chromePath), 'ENV_CHROME', '在 macOS 上设置 FH_CHROME 为 Chrome for Testing 的绝对可执行路径')
  const executablePath = await fs.realpath(chromePath)
  const suffix = '/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  expect(executablePath.endsWith(suffix), 'ENV_CHROME', '请选择 Chrome for Testing，当前路径不符合测试应用的结构')
  await fs.access(executablePath, fs.constants.X_OK)
  const app = executablePath.slice(0, -'/Contents/MacOS/Google Chrome for Testing'.length)
  const manifestPath = path.join(extensionSource, 'manifest.json')
  expect(await fs.stat(manifestPath).catch(() => null), 'ENV_BUILD', `缺少 ${manifestPath}，请先运行 pnpm build`)
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  const { version } = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'))
  expect(manifest.manifest_version === 3 && manifest.version === version, 'ENV_BUILD', '构建必须为与 package.json 同版本的 Chrome MV3')
  expect(!manifest.host_permissions?.length, 'ENV_PERMISSION', '构建声明了必需站点权限')
  runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fh33-native-'))
  const extension = path.join(runDir, 'extension')
  await fs.cp(extensionSource, extension, { recursive: true })
  const assetPaths = (await fs.readdir(extension, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(extension, path.join(entry.parentPath, entry.name)))
    .sort()
  const sha256 = {}
  for (const file of assetPaths)
    sha256[file] = createHash('sha256').update(await fs.readFile(path.join(extension, file))).digest('hex')
  log('BUILD', { extensionSource, version, sha256, runDir })

  const fixtures = {
    A: { route: '/fh33/a', icon: '/fh33-only-a.png', size: 32 },
    B: { route: '/fh33/b', icon: '/fh33-only-b.png', size: 48 },
  }
  for (const [name, fixture] of Object.entries(fixtures)) {
    fixture.title = `FH33 测试窗口 ${name}`
    fixture.image = await fs.readFile(path.join(extension, `icons/${fixture.size}.png`))
  }
  const requests = []
  server = http.createServer((request, response) => {
    const route = new URL(request.url, 'http://localhost').pathname
    requests.push(route)
    const fixture = Object.values(fixtures).find(item => item.route === route || item.icon === route)
    if (!fixture) {
      response.writeHead(404).end()
      return
    }
    if (route === fixture.icon) {
      response.writeHead(200, { 'Content-Type': 'image/png' }).end(fixture.image)
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html>
      <html lang="zh-CN"><head><meta charset="utf-8"><title>${fixture.title}</title>
      <link rel="apple-touch-icon" href="${fixture.icon}" sizes="${fixture.size}x${fixture.size}"></head>
      <body><h1 id="fixture">${fixture.title}</h1></body></html>`)
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const urls = { A: `http://127.0.0.1:${port}${fixtures.A.route}`, B: `http://localhost:${port}${fixtures.B.route}` }
  browser = await puppeteer.launch({
    executablePath,
    headless: false,
    pipe: true,
    userDataDir: path.join(runDir, 'profile'),
    defaultViewport: null,
    enableExtensions: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    args: [
      '--enable-unsafe-extension-debugging',
      '--no-proxy-server',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      '-AppleLanguages',
      '(zh-CN)',
      '--lang=zh-CN',
    ],
  })
  const id = await browser.installExtension(extension)
  const prefix = `chrome-extension://${id}/`
  const isWorker = target => target.type() === 'service_worker' && target.url() === prefix + manifest.background.service_worker
  const isPopup = target => target.url() === prefix + manifest.action.default_popup
  const oldTarget = await browser.waitForTarget(isWorker, { timeout: 12_000 })
  const worker = await oldTarget.worker()
  expect(worker, 'ENV_WORKER', '无法连接首次启动的 worker')

  const { windows, tabIds } = await worker.evaluate(async (urls) => {
    const a = await chrome.windows.create({ url: urls.A, width: 870, height: 620, left: 50, top: 70 })
    const b = await chrome.windows.create({ url: urls.B, width: 780, height: 520, left: 125, top: 95 })
    return { windows: { A: a.id, B: b.id }, tabIds: { A: a.tabs[0].id, B: b.tabs[0].id } }
  }, urls)
  const pages = {}
  for (const [name, url] of Object.entries(urls)) {
    const target = await browser.waitForTarget(item => item.url() === url, { timeout: 12_000 })
    pages[name] = await target.asPage()
    await pages[name].waitForSelector('#fixture', { timeout: 12_000 })
    assert.equal(await pages[name].title(), fixtures[name].title)
  }

  const setup = await worker.evaluate(async ({ windows, tabIds }) => {
    // 首装设置页可能落在测试窗口，保留窗口创建时返回的夹具 tab。
    for (const { id, tabs } of await chrome.windows.getAll({ populate: true })) {
      if (!Object.values(windows).includes(id)) {
        await chrome.windows.remove(id)
        continue
      }
      const extraTabs = tabs.filter(tab => !Object.values(tabIds).includes(tab.id))
      if (extraTabs.length)
        await chrome.tabs.remove(extraTabs.map(tab => tab.id))
    }
    return {
      locale: chrome.i18n.getUILanguage(),
      title: chrome.i18n.getMessage('contextMenu_scanPage'),
      permissions: await chrome.permissions.getAll(),
      options: await chrome.storage.local.get('autoScanEnabled'),
    }
  }, { windows, tabIds })
  const baseline = await worker.evaluate(inspectAccess, tabIds)
  expect(setup.locale.startsWith('zh') && setup.title === '提取此页图标', 'ENV_LOCALE', '测试浏览器的中文菜单标题不符合预期')
  expect(setup.options.autoScanEnabled !== true && !setup.permissions.origins?.length, 'ENV_PERMISSION', '自动扫描或可选站点权限不符合隔离基线')
  expect(Object.values(baseline).every(result => !result.allowed && hostDenied.test(result.error)), 'ENV_PERMISSION', `预选权限基线异常 ${JSON.stringify(baseline)}`)

  await worker.evaluate(id => chrome.windows.update(id, { focused: true }), windows.A)
  await pages.A.bringToFront()
  const readWindows = () => worker.evaluate(async () => (await chrome.windows.getAll({ populate: true })).map(({ id, focused, tabs }) => ({
    id,
    focused,
    activeTab: tabs.find(tab => tab.active)?.id,
    tabCount: tabs.length,
  })))
  const isFocusedA = (values) => {
    const a = values.find(window => window.id === windows.A)
    const b = values.find(window => window.id === windows.B)
    return values.length === 2 && a?.focused === true && b?.focused === false
      && a.tabCount === 1 && b.tabCount === 1 && a.activeTab === tabIds.A && b.activeTab === tabIds.B
  }
  await waitFor(async () => isFocusedA(await readWindows()), 5000, 'ENV_FOCUS', '无法核对仅测试窗口 A 活动')
  const identity = { pid: browser.process().pid, title: setup.title }
  log('READY', { ...identity, app, runDir, version: await browser.version(), urls, windows, tabIds, baseline })

  const menu = await readReceipt('menu.json', identity)
  expect(menu.state !== 'missing', 'MENU_ITEM_MISSING', '原生菜单存在，但缺少目标项', 1)
  expect(menu.state === 'visible', 'DRIVER_STATE', 'menu.json 必须确认原生菜单状态')
  expect(isFocusedA(await readWindows()), 'ENV_FOCUS', '菜单展开后窗口焦点异常')

  const popupPages = new Map()
  const pageErrors = []
  const observePopup = (target) => {
    if (!isPopup(target) || popupPages.has(target))
      return
    popupPages.set(target, target.asPage().then((page) => {
      page.on('pageerror', (error) => {
        pageErrors.push(error.message)
        log('POPUP_PAGE_ERROR', error.message)
      })
      page.on('console', (message) => {
        if (message.type() === 'error')
          log('POPUP_CONSOLE_ERROR', message.text())
      })
      return page
    }).catch((error) => {
      log('POPUP_ATTACH_ERROR', error.message)
      return null
    }))
  }
  browser.on('targetcreated', observePopup)
  browser.on('targetchanged', observePopup)

  let destroyed = false
  let selecting = false
  let earlyWorker = false
  const restarted = new Set()
  browser.on('targetdestroyed', (target) => {
    if (target === oldTarget)
      destroyed = true
  })
  const onTarget = (target) => {
    if (!isWorker(target) || target === oldTarget)
      return
    if (!selecting)
      earlyWorker = true
    restarted.add(target)
  }
  browser.on('targetcreated', onTarget)
  browser.on('targetchanged', onTarget)
  const closed = await Promise.race([
    worker.close().then(() => true),
    delay(5000, false, { ref: false, signal: abort.signal }),
  ])
  expect(closed, 'ENV_WORKER', '终止旧 worker 超时')
  await waitFor(() => destroyed, 5000, 'ENV_WORKER', '旧 worker 未终止')
  const verifyCold = () => {
    const state = { workerPresent: browser.targets().some(isWorker), popupPresent: browser.targets().some(isPopup), earlyWorker }
    expect(!state.workerPresent && !state.popupPresent && !state.earlyWorker, 'WORKER_ALREADY_RUNNING', JSON.stringify(state))
    return state
  }
  log('ARMED', { ...verifyCold(), destroyed })
  await readReceipt('select-request.json', identity, 20_000)
  const beforeSelection = verifyCold()
  selecting = true
  log('SELECT', beforeSelection)
  const selection = await readReceipt('selection.json', identity, 20_000)
  expect(selection.selected === true, 'DRIVER_STATE', '桌面工具未确认已选择菜单项')

  await waitFor(() => restarted.size || browser.targets().some(target => target !== oldTarget && isWorker(target)), 10_000, 'WORKER_NOT_WOKEN', '选择原生菜单后没有新 worker', 1)
  log('WORKER_RESTARTED', { observed: restarted.size })
  const popup = await waitFor(async () => {
    for (const target of browser.targets().filter(isPopup)) {
      observePopup(target)
      const page = await popupPages.get(target)
      if (!page || page.isClosed())
        continue
      const isAction = await page.evaluate(async () => {
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['POPUP'] })
        return contexts.some(context => context.documentUrl === location.href)
          && chrome.extension.getViews({ type: 'popup' }).includes(window)
      })
      if (isAction)
        return page
    }
    return null
  }, 15_000, 'POPUP_MISSING', '选择原生菜单后没有真正的扩展 popup', 1)
  log('POPUP', { url: popup.url() })
  const after = await popup.evaluate(inspectAccess, tabIds)
  log('ACCESS', after)
  expect(after.A.allowed && after.A.title === fixtures.A.title, 'ACTIVE_TAB_NOT_GRANTED', '被点击页面 A 未获得访问权', 1)
  expect(!after.B.allowed && hostDenied.test(after.B.error), 'ACTIVE_TAB_LEAK', 'B 未按预期被权限检查拒绝', 1)

  const activeTab = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return { id: tab?.id, windowId: tab?.windowId, url: tab?.url }
  })
  expect(activeTab.id === tabIds.A && activeTab.windowId === windows.A && activeTab.url === urls.A, 'SCAN_OBJECT_MISMATCH', JSON.stringify(activeTab), 1)
  const iconA = new URL(fixtures.A.icon, urls.A).href
  const iconB = new URL(fixtures.B.icon, urls.B).href
  let snapshot
  const cards = await waitFor(async () => {
    snapshot = await popup.evaluate(() => ({
      text: document.querySelector('#app')?.textContent.trim().slice(0, 500),
      cards: Array.from(document.querySelectorAll('li'), (row) => {
        const image = row.querySelector('img')
        return { src: image?.src, loaded: image?.complete && image?.naturalWidth > 0, source: row.querySelector('[data-testid="icon-source-format"]')?.textContent?.trim() }
      }),
    }))
    const shown = snapshot.cards
    return shown.some(card => card.src === iconA && card.loaded && card.source === 'DOM link · PNG') && shown.every(card => card.src !== iconB) && shown
  }, 10_000, 'SCAN_OBJECT_MISMATCH', 'popup 未显示可加载的 A 页 DOM 图标，或出现 B 图标', 1).catch((error) => {
    log('SCAN_DOM', { activeTab, ...snapshot })
    throw error
  })
  expect(pageErrors.length === 0, 'POPUP_ERROR', JSON.stringify(pageErrors), 1)
  log('PASS', { activeTab, cards, requests })
}

function cancel() {
  abort.abort(new ProbeFailure('CANCELLED', '本轮已取消'))
}

process.once('SIGINT', cancel)
process.once('SIGTERM', cancel)
try {
  await run()
}
catch (error) {
  log(error instanceof ProbeFailure ? error.code : 'ENV_FAILURE', error.message)
  process.exitCode = error instanceof ProbeFailure ? error.exitCode : 2
}
finally {
  try {
    if (browser)
      await browser.close()
  }
  finally {
    server?.closeAllConnections()
    if (server?.listening)
      await new Promise(resolve => server.close(resolve))
    if (runDir) {
      await fs.rm(runDir, { recursive: true, force: true })
      log('CLEANED', runDir)
    }
  }
}
