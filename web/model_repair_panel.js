import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'
import { applyModelRepairs, planModelRepairs } from './model_repair.js'

export async function repairWorkflowModels(button, status) {
  button.disabled = true
  status.textContent = '正在检查模型路径…'
  const graph = app.rootGraph
  const workflow = app.extensionManager.workflow.activeWorkflow
  try {
    const response = await api.fetchApi('/object_info')
    if (!response.ok) throw new Error(`读取模型列表失败：${response.status}`)
    const definitions = await response.json()
    if (graph !== app.rootGraph || workflow !== app.extensionManager.workflow.activeWorkflow) throw new Error('工作流已切换，请重新检查')
    const { changes, unresolved } = planModelRepairs(graph, definitions)
    applyModelRepairs(graph, changes)
    if (changes.length) await workflow?.changeTracker.captureCanvasState()
    status.textContent = `已回填 ${changes.length} 项，待处理 ${unresolved.length} 项`
    const dialog = document.createElement('dialog')
    dialog.className = 'ytm-dialog ytm-model-results'
    dialog.dataset.ytmOwned = ''
    dialog.setAttribute('aria-label', '模型路径回填结果')
    const header = document.createElement('header')
    header.className = 'ytm-header'
    const title = document.createElement('h2')
    title.textContent = status.textContent
    const close = document.createElement('button')
    close.className = 'ytm-button'
    close.textContent = '关闭'
    close.onclick = () => dialog.close()
    header.append(title, close)
    const list = document.createElement('div')
    list.className = 'ytm-model-list'
    for (const item of [...changes, ...unresolved]) {
      const row = document.createElement('div')
      row.className = 'ytm-model-row'
      const name = document.createElement('strong')
      name.textContent = `${item.id} · ${item.node.title || item.node.type} · ${item.field}`
      const path = document.createElement('span')
      path.textContent = item.value ? `${item.previous} → ${item.value}` : `${item.previous}：${item.candidates.length ? '存在多个同名文件，请手动选择' : '未找到同名文件'}`
      row.append(name, path)
      if (!item.value && item.candidates.length) {
        const candidates = document.createElement('span')
        candidates.textContent = item.candidates.join('\n')
        row.append(candidates)
      }
      list.append(row)
    }
    if (!list.childElementCount) list.textContent = '当前工作流没有需要回填的模型路径。'
    dialog.append(header, list)
    dialog.addEventListener('close', () => dialog.remove(), { once: true })
    document.body.append(dialog)
    dialog.showModal()
  } catch (error) {
    status.textContent = `回填失败：${error.message}`
    status.title = status.textContent
  } finally { button.disabled = false }
}
