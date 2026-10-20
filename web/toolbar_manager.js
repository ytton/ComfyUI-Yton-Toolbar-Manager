import { app } from '../../scripts/app.js'
import { collectEntries, applyEntries, allowedEntry } from './toolbar_catalog.js'
import { repairWorkflowModels } from './model_repair_panel.js'

const PREFIX = 'Yton.ToolbarManager'
const IDS = { enabled: `${PREFIX}.Enabled`, blockNew: `${PREFIX}.BlockNew`, items: `${PREFIX}.Items` }
let manager

function control(tag, className, content) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (content) element.textContent = content
  return element
}

class ToolbarManager {
  entries = []
  roots = []
  scanFrame = 0
  saving = Promise.resolve()
  area = 'all'
  query = ''
  signature = ''

  constructor() {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = new URL('./toolbar_manager.css', import.meta.url).href
    document.head.append(stylesheet)
    this.button = control('button', 'comfyui-button ytm-open', '界面管理')
    this.button.type = 'button'
    this.button.title = '管理顶部和侧边栏入口（Alt+Shift+T）'
    this.button.setAttribute('aria-label', '界面管理')
    this.button.dataset.ytmOwned = ''
    this.button.addEventListener('click', () => this.open())
    this.observer = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('[data-ytm-owned]') && (record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE)))) this.scheduleScan()
    })
    this.rootObserver = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && !node.closest?.('[data-ytm-owned]') && (this.roots.some(root => node === root || node.contains(root)) || node.matches?.('.comfyui-body-top, .side-tool-bar-container') || node.querySelector?.('.comfyui-body-top, .side-tool-bar-container'))))) this.scheduleScan()
    })
    this.rootObserver.observe(document.body, { childList: true, subtree: true })
    this.scan()
  }

  state() {
    const setting = app.extensionManager.setting
    return { enabled: setting.get(IDS.enabled), blockNew: setting.get(IDS.blockNew), items: setting.get(IDS.items) }
  }

  scheduleScan() {
    if (!this.scanFrame) this.scanFrame = requestAnimationFrame(() => { this.scanFrame = 0; this.scan() })
  }

  scan() {
    const top = app.menu.element
    const topExtra = document.getElementById('comfyui-body-top')
    const side = document.querySelector('[data-testid="side-toolbar"]')
    const roots = [top, topExtra, side].filter(root => root?.isConnected)
    if (roots.length !== this.roots.length || roots.some((root, i) => root !== this.roots[i])) {
      this.observer.disconnect()
      this.roots = roots
      for (const root of roots) this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'data-testid', 'aria-label', 'title', 'class', 'style'] })
    }
    if (top?.isConnected && this.button.parentElement !== top) top.append(this.button)
    this.entries = [...(top ? collectEntries(top, 'top') : []), ...(topExtra ? collectEntries(topExtra, 'top') : []), ...(side ? collectEntries(side, 'side') : [])]
    const { items, enabled, blockNew } = this.state()
    applyEntries(this.entries, items, enabled, blockNew)
    for (const group of top?.querySelectorAll('.comfyui-button-group') || []) {
      const entries = this.entries.filter(entry => group.contains(entry.element))
      group.toggleAttribute('data-ytm-empty', entries.length > 0 && entries.every(entry => entry.element.hasAttribute('data-ytm-hidden')))
    }
    const signature = JSON.stringify(this.entries.map(({ key, label }) => [key, label]))
    if (this.dialog?.open && signature !== this.signature) this.renderList()
    this.signature = signature
  }

  async save(id, value) {
    this.saving = this.saving.catch(() => {}).then(() => app.extensionManager.setting.set(id, typeof value === 'function' ? value(app.extensionManager.setting.get(id)) : value))
    try {
      await this.saving
      this.scan()
      this.renderList()
      if (this.status) this.status.textContent = '已保存'
    } catch (error) {
      if (this.status) this.status.textContent = `保存失败：${error.message}`
    }
  }

  async setBlockNew(value) {
    this.pendingBlockNew = value
    this.blockNew.disabled = true
    try {
      if (value) {
        await this.save(IDS.items, items => {
          const current = { ...items }
          for (const entry of this.entries) if (!(entry.key in current)) current[entry.key] = { label: entry.label, area: entry.area, visible: true }
          return current
        })
      }
      await this.save(IDS.blockNew, value)
    } finally {
      this.pendingBlockNew = undefined
      this.blockNew.disabled = false
      this.renderList()
    }
  }

  async setVisible(entries, visible) {
    await this.save(IDS.items, current => {
      const items = { ...current }
      for (const entry of entries.filter(entry => !entry.locked)) items[entry.key] = { label: entry.label, area: entry.area, visible }
      return items
    })
  }

  filteredEntries() {
    const seen = new Set()
    return this.entries.filter(entry => {
      if (seen.has(entry.key)) return false
      seen.add(entry.key)
      return (this.area === 'all' || entry.area === this.area) && (!this.query || entry.label.toLowerCase().includes(this.query))
    })
  }

  renderList() {
    if (!this.list) return
    const { items, enabled, blockNew } = this.state()
    this.enabled.checked = enabled
    this.blockNew.checked = this.pendingBlockNew ?? blockNew
    this.list.replaceChildren()
    const entries = this.filteredEntries()
    for (const entry of entries) {
      const row = control('label', 'ytm-entry')
      row.dataset.entryKey = entry.key
      const checkbox = control('input')
      checkbox.type = 'checkbox'
      checkbox.checked = entry.locked || allowedEntry(entry.key, items, blockNew)
      checkbox.disabled = entry.locked
      checkbox.addEventListener('change', () => this.setVisible([entry], checkbox.checked))
      const name = control('span', 'ytm-entry-name', entry.label)
      name.title = entry.label
      const area = control('span', 'ytm-entry-area', entry.locked ? '保留设置入口' : entry.area === 'top' ? '顶部' : '侧边栏')
      row.append(checkbox, name, area)
      this.list.append(row)
    }
    if (!entries.length) this.list.append(control('p', 'ytm-empty', '没有匹配的入口'))
    this.count.textContent = `${entries.length} 个入口`
  }

  open() {
    this.scan()
    if (this.dialog?.open) return
    if (!this.dialog) this.createDialog()
    this.renderList()
    this.dialog.showModal()
    this.search.focus()
  }

  createDialog() {
    this.dialog = control('dialog', 'ytm-dialog')
    this.dialog.dataset.ytmOwned = ''
    this.dialog.setAttribute('aria-label', '界面管理器')
    const heading = control('header', 'ytm-header')
    const title = control('h2', '', '界面管理器')
    const close = control('button', 'ytm-button', '关闭')
    close.type = 'button'
    close.addEventListener('click', () => this.dialog.close())
    const actions = control('div', 'ytm-header-actions')
    const repair = control('button', 'ytm-button', '智能填充缺失模型 / LoRA')
    repair.type = 'button'
    repair.title = '根据本地模型列表回填分类目录中的唯一同名文件'
    repair.addEventListener('click', () => repairWorkflowModels(repair, this.status))
    actions.append(repair, close)
    heading.append(title, actions)
    const description = control('p', 'ytm-description', '取消勾选会强制隐藏入口，工作流节点继续可用。')
    const options = control('div', 'ytm-options')
    const option = (labelText, onChange) => {
      const label = control('label')
      const checkbox = control('input')
      checkbox.type = 'checkbox'
      checkbox.addEventListener('change', () => onChange(checkbox.checked))
      label.append(checkbox, document.createTextNode(labelText))
      options.append(label)
      return checkbox
    }
    this.enabled = option('启用入口管理', value => this.save(IDS.enabled, value))
    this.blockNew = option('新入口默认隐藏', value => this.setBlockNew(value))
    this.blockNew.parentElement.title = '保留当前入口，之后新增的入口需要在这里勾选才会显示。'
    const toolbar = control('div', 'ytm-filter')
    const tabs = control('div', 'ytm-tabs')
    tabs.setAttribute('role', 'tablist')
    for (const [area, label] of [['all', '全部'], ['top', '顶部'], ['side', '侧边栏']]) {
      const button = control('button', 'ytm-button', label)
      button.type = 'button'
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', String(this.area === area))
      button.addEventListener('click', () => {
        this.area = area
        for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab === button))
        this.renderList()
      })
      tabs.append(button)
    }
    this.search = control('input', 'ytm-search')
    this.search.type = 'search'
    this.search.placeholder = '搜索入口名称'
    this.search.setAttribute('aria-label', '搜索入口')
    this.search.addEventListener('input', () => { this.query = this.search.value.trim().toLowerCase(); this.renderList() })
    toolbar.append(tabs, this.search)
    this.list = control('div', 'ytm-list')
    const footer = control('footer', 'ytm-footer')
    this.count = control('span', 'ytm-count')
    this.status = control('span', 'ytm-status')
    this.status.setAttribute('role', 'status')
    const show = control('button', 'ytm-button', '显示当前列表')
    show.addEventListener('click', () => this.setVisible(this.filteredEntries(), true))
    const hide = control('button', 'ytm-button', '隐藏当前列表')
    hide.addEventListener('click', () => this.setVisible(this.filteredEntries(), false))
    const reset = control('button', 'ytm-button', '恢复全部入口')
    reset.addEventListener('click', async () => { await this.save(IDS.blockNew, false); await this.save(IDS.items, {}) })
    footer.append(this.count, this.status, show, hide, reset)
    this.dialog.append(heading, description, options, toolbar, this.list, footer)
    this.dialog.addEventListener('click', event => { if (event.target === this.dialog) { const bounds = this.dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.dialog.close() } })
    document.body.append(this.dialog)
  }
}

app.registerExtension({
  name: 'Yton.ToolbarManager',
  settings: [
    { id: IDS.enabled, name: '启用入口管理', category: ['Yton 界面管理', '入口', '启用'], type: 'boolean', defaultValue: true, onChange: () => manager?.scheduleScan() },
    { id: IDS.blockNew, name: '新入口默认隐藏', type: 'hidden', defaultValue: false, onChange: () => manager?.scheduleScan() },
    { id: IDS.items, name: '入口显示配置', type: 'hidden', defaultValue: {}, onChange: () => manager?.scheduleScan() },
  ],
  commands: [{ id: `${PREFIX}.Open`, label: '打开界面管理器', function: () => manager?.open() }],
  keybindings: [{ combo: { key: 'T', alt: true, shift: true }, commandId: `${PREFIX}.Open` }],
  async setup() {
    app.ui.settings.addSetting({
      id: `${PREFIX}.OpenSettings`, name: '管理顶部和侧边栏入口', category: ['Yton 界面管理', '入口', '管理'],
      type: () => { const button = control('button', 'ytm-button', '打开界面管理器'); button.addEventListener('click', () => manager.open()); return button },
    })
    manager = new ToolbarManager()
  },
})

export function getToolbarManager() { return manager }
