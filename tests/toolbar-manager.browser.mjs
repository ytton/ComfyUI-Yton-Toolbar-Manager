import assert from 'node:assert/strict'

export async function runToolbarManagerBrowserRegression(page, baseURL = 'http://127.0.0.1:8188', assetURL = 'http://127.0.0.1:8193') {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } })
  const target = await context.newPage()
  const errors = []
  const values = {}
  target.on('pageerror', error => { if (/toolbar_manager|toolbar_catalog/i.test(error.stack || error.message)) errors.push(error.message) })
  // Keep settings and workflow writes in this test session.
  await context.route(/\/(?:api\/)?settings(?:\/|$)/, async route => {
    const request = route.request()
    if (!/^\/(?:api\/)?settings(?:\/|$)/.test(new URL(request.url()).pathname)) { await route.continue(); return }
    if (request.method() === 'POST') {
      const suffix = new URL(request.url()).pathname.split('/settings/')[1]
      const data = request.postDataJSON()
      if (suffix) values[decodeURIComponent(suffix)] = data
      else Object.assign(values, data)
      await route.fulfill({ json: {} })
    } else {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), ...values } })
    }
  })
  await context.route('**/userdata/**', async route => {
    if (route.request().method() !== 'GET') await route.fulfill({ json: {} })
    else await route.continue()
  })
  await context.route('**/extensions/ComfyUI-Yton-Toolbar-Manager/**', async route => {
    const relative = new URL(route.request().url()).pathname.split('/extensions/ComfyUI-Yton-Toolbar-Manager/')[1]
    const response = await context.request.get(`${assetURL}/${relative}`)
    await route.fulfill({ response })
  })
  const install = async () => {
    await target.getByRole('button', { name: '运行', exact: true }).first().waitFor()
    await target.evaluate(async () => {
      const { getToolbarManager } = await import('/extensions/ComfyUI-Yton-Toolbar-Manager/toolbar_manager.js')
      const app = window.comfyAPI.app.app
      if (!getToolbarManager()) await app.extensions.find(extension => extension.name === 'Yton.ToolbarManager').setup()
      window.toolbarTestManager = getToolbarManager()
    })
    await target.getByRole('button', { name: '界面管理', exact: true }).waitFor()
  }
  try {
    await target.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await install()
    const nodeTypesBefore = await target.evaluate(() => Object.keys(LiteGraph.registered_node_types).sort())
    await target.evaluate(() => {
      const node = LiteGraph.createNode('YtonResolutionSelectorSimple')
      node.pos = [500, 400]
      window.comfyAPI.app.app.graph.add(node)
    })
    const graphBefore = await target.evaluate(() => window.comfyAPI.app.app.graph._nodes.map(node => [node.id, node.type]))
    await target.getByRole('button', { name: '界面管理', exact: true }).click()
    const dialog = target.getByRole('dialog', { name: '界面管理器', exact: true })
    assert.equal(await dialog.getByText('未命名入口 顶部', { exact: true }).count(), 0)
    const shareRow = dialog.locator('[data-entry-key="top:aria:Share"]')
    await shareRow.locator('input').uncheck()
    await target.waitForFunction(() => window.toolbarTestManager.entries.find(entry => entry.key === 'top:aria:Share')?.element.hasAttribute('data-ytm-hidden'))
    assert.equal(await target.locator('[aria-label="Share"]').evaluate(element => getComputedStyle(element).display), 'none')
    await target.evaluate(() => {
      const element = window.toolbarTestManager.entries.find(entry => entry.key === 'top:aria:Share').element
      const replacement = element.cloneNode(true)
      replacement.removeAttribute('data-ytm-hidden')
      replacement.style.display = 'inline-flex'
      element.replaceWith(replacement)
    })
    await target.waitForFunction(() => document.querySelector('[aria-label="Share"]')?.hasAttribute('data-ytm-hidden'))
    await target.evaluate(() => document.querySelector('[aria-label="Share"]').style.setProperty('display', 'inline-flex', 'important'))
    await target.waitForFunction(() => document.querySelector('[aria-label="Share"]')?.style.getPropertyValue('display') === 'none')
    await shareRow.locator('input').check()
    await target.waitForFunction(() => !document.querySelector('[aria-label="Share"]')?.hasAttribute('data-ytm-hidden'))
    assert.equal(await target.locator('[aria-label="Share"]').evaluate(element => element.style.getPropertyValue('display')), 'inline-flex', 'restores the original plugin display style')
    await dialog.getByRole('tab', { name: '侧边栏', exact: true }).click()
    const runningHub = dialog.locator('[data-entry-key="side:test:rh-openapi-panel-tab-button"]')
    await runningHub.locator('input').uncheck()
    await target.waitForFunction(() => document.querySelector('[data-testid="rh-openapi-panel-tab-button"]')?.hasAttribute('data-ytm-hidden'))
    await dialog.getByRole('checkbox', { name: '新入口默认隐藏', exact: true }).check()
    await target.waitForFunction(() => window.toolbarTestManager.state().blockNew)
    await target.evaluate(() => {
      const extra = document.createElement('button')
      extra.id = 'toolbar-test-new-plugin'
      extra.textContent = '测试新增插件入口'
      window.comfyAPI.app.app.menu.element.append(extra)
    })
    await target.waitForFunction(() => document.getElementById('toolbar-test-new-plugin')?.hasAttribute('data-ytm-hidden'))
    assert.equal(await target.locator('[data-testid="assets-tab-button"]').getAttribute('data-ytm-hidden'), null, 'allowlist retains the existing sidebar entries')
    await dialog.getByRole('tab', { name: '顶部', exact: true }).click()
    await dialog.getByRole('searchbox', { name: '搜索入口', exact: true }).fill('测试新增')
    const addedRow = dialog.locator('[data-entry-key="top:id:toolbar-test-new-plugin"]')
    await addedRow.locator('input').check()
    await target.waitForFunction(() => !document.getElementById('toolbar-test-new-plugin')?.hasAttribute('data-ytm-hidden'))
    await dialog.getByRole('searchbox', { name: '搜索入口', exact: true }).fill('')
    await dialog.getByRole('checkbox', { name: '启用入口管理', exact: true }).uncheck()
    await target.waitForFunction(() => !document.querySelector('[data-testid="rh-openapi-panel-tab-button"]')?.hasAttribute('data-ytm-hidden'))
    await dialog.getByRole('checkbox', { name: '启用入口管理', exact: true }).check()
    await target.waitForFunction(() => document.querySelector('[data-testid="rh-openapi-panel-tab-button"]')?.hasAttribute('data-ytm-hidden'))
    await dialog.getByRole('tab', { name: '侧边栏', exact: true }).click()
    await dialog.getByRole('button', { name: '隐藏当前列表', exact: true }).click()
    await target.waitForFunction(() => window.toolbarTestManager.entries.filter(entry => entry.area === 'side' && !entry.locked).every(entry => entry.element.hasAttribute('data-ytm-hidden')))
    assert.equal(await target.locator('[aria-label="设置 (Ctrl + ,)"]').evaluate(element => getComputedStyle(element).display === 'none'), false, 'settings remains available')
    await target.setViewportSize({ width: 800, height: 600 })
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 800 && bounds.y + bounds.height <= 600)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await target.keyboard.press('Alt+Shift+t')
    await dialog.waitFor({ state: 'visible' })
    await target.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.deepEqual(await target.evaluate(() => window.comfyAPI.app.app.graph._nodes.map(node => [node.id, node.type])), graphBefore)
    await target.reload()
    await install()
    await target.waitForFunction(() => document.querySelector('[data-testid="rh-openapi-panel-tab-button"]')?.hasAttribute('data-ytm-hidden'))
    await target.getByRole('button', { name: '界面管理', exact: true }).click()
    await target.getByRole('button', { name: '恢复全部入口', exact: true }).click()
    await target.waitForFunction(() => !document.querySelector('[data-ytm-hidden]') && !window.toolbarTestManager.state().blockNew)
    assert.deepEqual(await target.evaluate(() => Object.keys(LiteGraph.registered_node_types).sort()), nodeTypesBefore)
    assert.deepEqual(errors, [])
    return { passed: true, checks: ['顶部入口隐藏与恢复', '第三方重新插入仍隐藏', '强制覆盖插件显示样式并正确恢复', '侧边栏控制', '新插件入口默认隐藏', '暂停和恢复管理', '批量操作保留设置', '小窗口', '快捷键', '刷新保留配置', '恢复全部', '不修改工作流'] }
  } finally {
    await context.close()
  }
}
