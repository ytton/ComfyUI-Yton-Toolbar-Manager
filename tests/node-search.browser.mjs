import assert from 'node:assert/strict'

export async function runNodeSearchBrowserRegression(page, baseURL = 'http://127.0.0.1:8188') {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const target = await context.newPage()
  const errors = []
  target.on('pageerror', error => {
    if (/node_search/i.test(error.stack || error.message)) errors.push(error.message)
  })
  // Test fixtures and UI state stay in this isolated browser session.
  await context.route(/\/(?:api\/)?settings(?:\/|$)/, async route => {
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} })
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...await response.json(), 'Comfy.Locale': 'zh', 'Comfy.NodeSearchBoxImpl': 'default' } })
  })
  await context.route('**/userdata/**', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({ json: {} }))
  await context.route('**/object_info', async route => {
    const response = await route.fetch()
    const data = await response.json()
    const categories = ['Zeta Pack/Images', 'Apt_Preset/Images', 'EasyUse/Images', '🥇️FastUse/Images', '🎡MTB节点/Images', '🛩️RG节点/Images', 'Yuan Tool/Images', '实用工具/Images', '中文包/Images', 'Alpha Pack/Images']
    for (const [index, category] of categories.entries()) {
      const name = `YtonSearchFixture${index}`
      data[name] = { ...data.PreviewImage, name, display_name: `测试节点 ${index}`, category, python_module: 'custom_nodes.test_fixture' }
    }
    await route.fulfill({ response, json: data })
  })
  const openSearch = async () => {
    await target.evaluate(() => document.dispatchEvent(new CustomEvent('litegraph:canvas', {
      detail: { subType: 'empty-double-click', originalEvent: { canvasX: 300, canvasY: 300, pointerType: 'mouse' } },
    })))
    const toggle = target.locator('[data-testid="toggle-category-sidebar"]')
    await toggle.waitFor()
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await target.getByRole('searchbox', { name: '搜索包名', exact: true }).waitFor({ state: 'visible' })
  }
  const visibleNames = () => target.locator('#node-search-category-sidebar [role="tree"] > div > button:visible').allTextContents()
  const search = target.getByRole('searchbox', { name: '搜索包名', exact: true })
  try {
    await target.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await target.waitForFunction(() => !!window.comfyAPI?.app?.app?.canvas)
    await target.locator('#splash-loader').waitFor({ state: 'hidden' })
    await target.locator('[aria-labelledby="global-workflow-template-selector"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await target.keyboard.press('Escape')
    await openSearch()
    const names = await visibleNames()
    const fixtureNames = ['Alpha Pack', 'Apt_Preset', 'EasyUse', '🥇️FastUse', '🎡MTB节点', '🛩️RG节点', 'Yuan Tool', 'Zeta Pack', '实用工具', '中文包']
    assert.deepEqual(names.filter(name => fixtureNames.includes(name)), fixtureNames)
    assert.equal(await target.locator('#node-search-category-sidebar').evaluate(sidebar => {
      const search = sidebar.querySelector('input').getBoundingClientRect()
      const tree = sidebar.querySelector('[role="tree"]').getBoundingClientRect()
      return search.bottom <= tree.top
    }), true, 'package filter sits above the package list')
    await search.fill('PACK')
    assert.deepEqual(await visibleNames(), ['Alpha Pack', 'Zeta Pack'])
    assert.equal(await target.locator('[role="search"] [role="combobox"]').inputValue(), '', 'package search leaves node search independent')
    const nodeCount = await target.evaluate(() => window.comfyAPI.app.app.graph._nodes.length)
    await target.keyboard.press('Enter')
    assert.equal(await target.evaluate(() => window.comfyAPI.app.app.graph._nodes.length), nodeCount, 'Enter in the filter does not insert a node')
    await target.keyboard.press('ArrowDown')
    assert.equal(await target.evaluate(() => document.activeElement.textContent), 'Alpha Pack')
    await target.keyboard.press('ArrowDown')
    assert.equal(await target.evaluate(() => document.activeElement.textContent), 'Zeta Pack', 'navigation follows visible alphabetical order')
    await target.locator('[data-testid="category-Alpha Pack"]').click()
    assert.equal(await target.locator('[data-testid="category-Alpha Pack"]').getAttribute('aria-expanded'), 'true')
    await target.locator('[data-testid="category-Alpha Pack/Images"]').click()
    assert.match((await target.locator('[data-testid="result-item"]').allTextContents()).join(), /测试节点 9/)
    assert.equal(await search.inputValue(), 'PACK', 'native category updates preserve the filter')
    await search.fill('none-xyz')
    assert.deepEqual(await visibleNames(), [])
    assert.equal(await target.locator('.ytm-package-empty').isVisible(), true)
    await search.fill('中文')
    assert.deepEqual(await visibleNames(), ['中文包'])
    await search.fill('')
    assert.deepEqual(await visibleNames(), names, 'clearing restores every package in sorted order')
    await target.locator('[data-testid="search-category-comfy"]').click()
    assert.equal(await search.count(), 1, 'source filtering retains one package input')
    await target.locator('[data-testid="search-category-comfy"]').click()
    await target.waitForFunction(() => !!document.querySelector('[data-testid="category-Alpha Pack"]'))
    assert.deepEqual(await visibleNames(), names, 'sorting survives native tree replacement')
    await target.setViewportSize({ width: 800, height: 600 })
    assert.equal(await search.evaluate(input => {
      const bounds = input.getBoundingClientRect()
      return bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.right <= innerWidth && bounds.y >= 0 && bounds.bottom <= innerHeight
    }), true, 'filter fits a small window')
    await target.setViewportSize({ width: 1440, height: 1000 })
    await target.keyboard.press('Escape')
    await target.locator('[role="search"]').waitFor({ state: 'detached' })
    await openSearch()
    assert.equal(await search.count(), 1, 'reopening creates one filter')
    await target.locator('[data-testid="category-Alpha Pack"]').click()
    await target.locator('[data-testid="category-Alpha Pack/Images"]').click()
    await target.locator('[data-testid="result-item"]').first().click()
    await target.waitForFunction(count => window.comfyAPI.app.app.graph._nodes.length === count + 1, nodeCount)
    await target.locator('[role="search"]').waitFor({ state: 'detached' })
    assert.equal(await target.locator('[role="search"]').isVisible(), false, 'native node insertion still works')
    await target.reload({ waitUntil: 'domcontentloaded' })
    await target.locator('#splash-loader').waitFor({ state: 'hidden' })
    await target.locator('[aria-labelledby="global-workflow-template-selector"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await target.keyboard.press('Escape')
    await openSearch()
    assert.equal(await search.count(), 1, 'extension loads automatically after refresh')
    assert.deepEqual(errors, [])
    return { passed: true, checks: ['alphabetical order', 'Chinese names last', 'filter placement', 'case-insensitive package filter', 'independent node search', 'Enter safety', 'keyboard navigation', 'category expansion', 'native category updates', 'empty state', 'Chinese filter', 'clear filter', 'tree replacement', 'reopen', 'node insertion', 'small viewport', 'refresh'] }
  } finally {
    await context.close()
  }
}
