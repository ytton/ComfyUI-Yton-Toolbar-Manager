const ACTIONS = 'button, a[role="button"], [role="button"]'
const suppressedDisplay = new WeakMap()

function text(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function entryKey(area, { testId, id, aria, icon, title, label, className }) {
  const identity = testId ? `test:${testId}` : id ? `id:${id}` : aria ? `aria:${aria}`
    : icon ? `icon:${icon}` : title ? `title:${title}` : label ? `text:${label}` : `class:${className}`
  return `${area}:${identity}`
}

export function allowedEntry(key, items, blockNew) {
  return key in items ? items[key].visible : !blockNew
}

export function collectEntries(root, area) {
  const candidates = []
  if (area === 'side') {
    candidates.push(...root.querySelectorAll(ACTIONS))
  } else {
    for (const child of root.children) {
      if (child.matches('[data-ytm-owned], script, style, hr')) continue
      const actions = [...child.querySelectorAll(ACTIONS)]
      if (!actions.length && child.classList.contains('comfyui-button-group')) continue
      if (child.matches(ACTIONS) || child.id || !actions.length) candidates.push(child)
      else candidates.push(...actions)
    }
  }
  return candidates.filter(element => !element.closest('[data-ytm-owned]')).map(element => {
    const icon = [...(element.querySelector('i')?.classList || [])].find(name => name.startsWith('icon-[') || name.startsWith('mdi-') || name.startsWith('pi-')) || ''
    const aria = text(element.getAttribute('aria-label'))
    const title = text(element.getAttribute('title') || element.querySelector('[title]')?.getAttribute('title'))
    const label = text(element.textContent)
    const attributes = { testId: element.dataset.testid, id: element.id, aria, icon, title, label, className: element.className }
    return {
      key: entryKey(area, attributes), area, element,
      label: (area === 'side' ? aria || title || label : label && label.length < 50 && !element.id ? label : title || aria || label || element.id || icon || '未命名入口').slice(0,140),
      locked: element.matches('.comfy-settings-btn') || icon === 'icon-[lucide--settings]',
    }
  })
}

export function applyEntries(entries, items, enabled, blockNew) {
  for (const entry of entries) {
    const hidden = enabled && !entry.locked && !allowedEntry(entry.key, items, blockNew)
    const element = entry.element
    const current = { value: element.style.getPropertyValue('display'), priority: element.style.getPropertyPriority('display') }
    const suppressed = current.value === 'none' && current.priority === 'important'
    if (hidden) {
      if (!suppressedDisplay.has(element) || !suppressed) suppressedDisplay.set(element, current)
      element.setAttribute('data-ytm-hidden', '')
      if (!suppressed) element.style.setProperty('display', 'none', 'important')
    } else {
      const original = suppressedDisplay.get(element)
      element.removeAttribute('data-ytm-hidden')
      if (original && suppressed) {
        if (original.value) element.style.setProperty('display', original.value, original.priority)
        else element.style.removeProperty('display')
      }
      suppressedDisplay.delete(element)
    }
  }
}
