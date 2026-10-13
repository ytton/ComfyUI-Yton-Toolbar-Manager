import test from 'node:test'
import assert from 'node:assert/strict'
import { comparePackageNames, matchesPackageName } from '../web/node_search_catalog.js'

test('package names sort alphabetically without emoji prefixes, with Chinese names last', () => {
  const names = ['模型', 'Yuan Tool', '🥇️FastUse', '实用工具', '🎡MTB节点', 'EasyUse', '__frontend_only__', 'Apt_Preset', '🛩️RG节点']
  assert.deepEqual(names.sort(comparePackageNames), ['Apt_Preset', 'EasyUse', '🥇️FastUse', '__frontend_only__', '🎡MTB节点', '🛩️RG节点', 'Yuan Tool', '模型', '实用工具'])
  assert.ok(comparePackageNames('Pack2', 'Pack10') < 0)
  assert.equal(comparePackageNames('EasyUse', 'easyuse'), 0)
})

test('package filter accepts case-insensitive, Chinese and normalized full-width text', () => {
  assert.ok(matchesPackageName('EasyUse', '  EASY  '))
  assert.ok(matchesPackageName('实用工具', '工具'))
  assert.ok(matchesPackageName('ＭＴＢ节点', 'mtb'))
  assert.ok(matchesPackageName('🥇️FastUse', ''))
  assert.equal(matchesPackageName('EasyUse', 'Yuan'), false)
})
