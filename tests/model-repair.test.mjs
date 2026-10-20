import assert from 'node:assert/strict'
import test from 'node:test'
import { applyModelRepairs, planModelRepairs } from '../web/model_repair.js'

const definitions = {
  Loader: { input: { required: { model: [['H3/model.gguf', 'A/duplicate.safetensors', 'B/duplicate.safetensors']] } } },
  LoraLoader: { input: { required: { lora_name: [['H3/style.safetensors']] } } },
}
const node = (id, type, name, value) => ({ id, type, widgets: [{ name, value }] })

test('repairs unique model and LoRA basenames in subgraphs while preserving weights and valid paths', () => {
  const model = node(1, 'Loader', 'model', 'old/model.gguf')
  const lora = node(2, 'LoraLoader', 'lora_name', 'style.safetensors')
  const dynamic = node(3, 'Power Lora Loader (rgthree)', 'lora_1', { lora: 'style.safetensors', strength: .75, strengthTwo: .5, on: false })
  const valid = node(4, 'Loader', 'model', 'H3/model.gguf')
  let before = 0, after = 0, dirty = 0, callbacks = 0
  model.widgets[0].callback = value => { assert.equal(value, 'H3/model.gguf'); callbacks++ }
  const graph = { _nodes: [model, { id: 10, subgraph: { _nodes: [lora, dynamic] } }, valid],
    beforeChange() { before++ }, afterChange() { after++ }, setDirtyCanvas() { dirty++ } }
  const plan = planModelRepairs(graph, definitions)
  assert.deepEqual(plan.changes.map(item => item.id), ['1', '10:2', '10:3'])
  assert.equal(plan.unresolved.length, 0)
  applyModelRepairs(graph, plan.changes)
  assert.equal(model.widgets[0].value, 'H3/model.gguf')
  assert.equal(lora.widgets[0].value, 'H3/style.safetensors')
  assert.deepEqual(dynamic.widgets[0].value, { lora: 'H3/style.safetensors', strength: .75, strengthTwo: .5, on: false })
  assert.deepEqual([before, after, dirty, callbacks], [1, 1, 1, 1])
  assert.equal(planModelRepairs(graph, definitions).changes.length, 0)
})

test('duplicate basenames, absent files and empty catalogs remain unresolved; text inputs stay untouched', () => {
  const graph = { _nodes: [node(1, 'Loader', 'model', 'duplicate.safetensors'), node(2, 'Loader', 'model', 'missing.gguf'),
    node(3, 'Empty', 'model', 'absent.ckpt'), node(4, 'Text', 'text', 'model.gguf')] }
  const plan = planModelRepairs(graph, { ...definitions, Empty: { input: { required: { model: [[]] } } } })
  assert.equal(plan.changes.length, 0)
  assert.deepEqual(plan.unresolved.map(item => item.candidates.length), [2, 0, 0])
})

test('normalizes separators, honors refreshed server catalogs, and supports frontend dynamic combo widgets', () => {
  const graph = { _nodes: [node(1, 'Loader', 'model', 'H3\\model.gguf'), node(2, 'Dynamic', 'lora_2', 'style.safetensors')] }
  graph._nodes[1].widgets[0].options = { values: () => ['new/style.safetensors'] }
  const plan = planModelRepairs(graph, definitions)
  assert.deepEqual(plan.changes.map(item => item.value), ['H3/model.gguf', 'new/style.safetensors'])
  const fresh = planModelRepairs(graph, { ...definitions, Loader: { input: { required: { model: [['organized/model.gguf']] } } } })
  assert.equal(fresh.changes[0].value, 'organized/model.gguf')
})

test('a freshly emptied catalog cannot repair from stale widget options', () => {
  const item = node(1, 'Loader', 'model', 'model.gguf')
  item.widgets[0].options = { values: ['stale/model.gguf'] }
  const plan = planModelRepairs({ _nodes: [item] }, { Loader: { input: { required: { model: [[]] } } } })
  assert.equal(plan.changes.length, 0)
  assert.equal(plan.unresolved.length, 1)
})
