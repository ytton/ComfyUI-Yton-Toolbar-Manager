import assert from 'node:assert/strict'
import test from 'node:test'
import { entryKey, allowedEntry } from '../web/toolbar_catalog.js'

test('stable element identity is independent of resource values and translated labels', () => {
  const before = entryKey('top', { id: 'monitor', label: 'GPU 10%' })
  assert.equal(entryKey('top', { id: 'monitor', label: 'GPU 95%' }), before)
  assert.equal(entryKey('side', { testId: 'assets-tab-button', label: '素材' }), entryKey('side', { testId: 'assets-tab-button', label: 'Assets' }))
  assert.notEqual(entryKey('top', { aria: 'Share' }), entryKey('top', { aria: 'Unload Models' }))
})

test('allowlist blocks unknown entries and explicit choices take precedence', () => {
  const items = { manager: { visible: true }, share: { visible: false } }
  assert.equal(allowedEntry('manager', items, true), true)
  assert.equal(allowedEntry('share', items, false), false)
  assert.equal(allowedEntry('new-plugin', items, true), false)
  assert.equal(allowedEntry('new-plugin', items, false), true)
})
