import assert from 'node:assert/strict'

export async function runModelRepairBrowserRegression(page, baseURL = 'http://127.0.0.1:8192') {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } })
  const target = await context.newPage()
  try {
    await target.goto(baseURL)
    await target.getByRole('button', { name: '界面管理', exact: true }).waitFor()
    const before = await target.evaluate(async () => {
      const { app } = await import('/scripts/app.js')
      await app.loadApiJson({
        '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'review-model.safetensors' } },
        '2': { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: 'review-lora.safetensors', strength_model: .65, strength_clip: .4 } },
        '3': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'duplicate.safetensors' } },
      }, '模型路径回填验证')
      return app.rootGraph.serialize()
    })
    await target.getByRole('button', { name: '界面管理', exact: true }).click()
    await target.getByRole('button', { name: '智能填充缺失模型 / LoRA', exact: true }).click()
    const results = target.getByRole('dialog', { name: '模型路径回填结果', exact: true })
    await results.waitFor()
    assert.ok((await results.innerText()).includes('已回填 2 项，待处理 1 项'))
    const actual = await target.evaluate(async () => {
      const { app } = await import('/scripts/app.js')
      return { graph: app.rootGraph.serialize(), prompt: (await app.graphToPrompt()).output }
    })
    assert.match(actual.prompt['1'].inputs.ckpt_name, /^H3[\\/]review-model.safetensors$/)
    assert.match(actual.prompt['2'].inputs.lora_name, /^H3[\\/]review-lora.safetensors$/)
    assert.equal(actual.prompt['2'].inputs.strength_model, .65)
    assert.equal(actual.prompt['2'].inputs.strength_clip, .4)
    assert.equal(actual.prompt['3'].inputs.ckpt_name, 'duplicate.safetensors')
    assert.deepEqual(actual.graph.links, before.links)
    const geometry = graph => graph.nodes.map(({ id, pos, size }) => ({ id, pos, size }))
    assert.deepEqual(geometry(actual.graph), geometry(before))
    for (const [width, height] of [[640, 720], [1920, 1080]]) {
      await target.setViewportSize({ width, height })
      assert.ok(await results.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight
      }))
    }
    await results.getByRole('button', { name: '关闭', exact: true }).click()
    return { passed: true, repaired: 2, unresolved: 1, weightsAndLinksPreserved: true }
  } finally { await context.close() }
}
