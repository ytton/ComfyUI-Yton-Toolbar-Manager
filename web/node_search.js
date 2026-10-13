import { app } from '../../scripts/app.js'
import { comparePackageNames, matchesPackageName } from './node_search_catalog.js'

const SIDEBAR = '#node-search-category-sidebar'

class PackageBrowser {
  frame = 0

  constructor(sidebar) {
    this.sidebar = sidebar
    this.tree = sidebar.querySelector(':scope > [role="tree"]')
    this.query = ''
    this.filter = document.createElement('div')
    this.filter.className = 'ytm-package-filter'
    this.input = document.createElement('input')
    this.input.type = 'search'
    this.input.placeholder = '搜索包名…'
    this.input.setAttribute('aria-label', '搜索包名')
    this.input.autocomplete = 'off'
    this.input.spellcheck = false
    this.filter.append(this.input)
    this.empty = document.createElement('div')
    this.empty.className = 'ytm-package-empty'
    this.empty.textContent = '没有匹配的包'
    this.empty.setAttribute('role', 'status')
    this.empty.hidden = true
    sidebar.classList.add('ytm-package-sidebar')
    sidebar.insertBefore(this.filter, this.tree)
    this.tree.append(this.empty)
    this.input.addEventListener('input', () => {
      this.query = this.input.value
      this.update()
      this.tree.scrollTop = 0
    })
    // Keep typing and navigation in the package filter out of node-search hotkeys.
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Escape') return
      event.stopPropagation()
      if (event.key === 'Enter') event.preventDefault()
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.rows().find(({ row }) => !row.hidden)?.button.focus()
      }
    })
    this.observer = new MutationObserver(() => this.schedule())
    this.observe()
    this.update()
  }

  rows() {
    return [...this.tree.children].flatMap(row => {
      const button = row.querySelector(':scope > button[role="treeitem"]')
      return button ? [{ row, button, name: button.textContent.trim() }] : []
    })
  }

  observe() {
    this.observer.observe(this.tree, { childList: true, subtree: true, characterData: true })
  }

  schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.update()
    })
  }

  update() {
    if (!this.sidebar.isConnected) return
    this.observer.disconnect()
    const rows = this.rows()
    const sorted = [...rows].sort((a, b) => comparePackageNames(a.name, b.name))
    if (rows.some(({ row }, index) => row !== sorted[index].row)) {
      const focused = document.activeElement
      const scrollTop = this.tree.scrollTop
      for (const { row } of sorted) this.tree.append(row)
      if (focused !== document.activeElement && this.tree.contains(focused)) focused.focus({ preventScroll: true })
      this.tree.scrollTop = scrollTop
    }
    let visibleCount = 0
    for (const { row, name } of sorted) {
      row.hidden = !matchesPackageName(name, this.query)
      if (!row.hidden) visibleCount++
    }
    this.empty.hidden = visibleCount > 0
    this.observe()
  }

  dispose() {
    this.observer.disconnect()
    cancelAnimationFrame(this.frame)
  }
}

app.registerExtension({
  name: 'Yton.NodeSearchPackages',
  setup() {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = new URL('./node_search.css', import.meta.url).href
    document.head.append(stylesheet)
    let browser
    const mount = () => {
      const sidebar = document.querySelector(SIDEBAR)
      if (sidebar === browser?.sidebar) return
      browser?.dispose()
      browser = sidebar?.querySelector(':scope > [role="tree"]') ? new PackageBrowser(sidebar) : undefined
    }
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === Node.ELEMENT_NODE && (node.matches(SIDEBAR) || node.querySelector(SIDEBAR))
      ))) mount()
    }).observe(document.body, { childList: true, subtree: true })
    mount()
  },
})
