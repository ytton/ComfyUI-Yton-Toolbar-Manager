const modelFile = /\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|engine|pkl|sft)$/i;
const normalize = value => value.replaceAll("\\", "/").toLowerCase();
const basename = value => normalize(value).split("/").at(-1);

function comboValues(definition) {
  if (!Array.isArray(definition)) return [];
  const values = Array.isArray(definition[0]) ? definition[0] : definition[1]?.options;
  return Array.isArray(values) ? values.filter(value => typeof value === "string" && modelFile.test(value)) : [];
}

// Only replace a missing filename when the node's current catalog has one match.
// A duplicate basename is deliberately left for the user to choose in ComfyUI.
export function planModelRepairs(graph, definitions) {
  const changes = [], unresolved = [];
  const loras = comboValues(definitions.LoraLoader?.input?.required?.lora_name);
  const visited = new Set();
  const visit = (current, prefix = "") => {
    if (visited.has(current)) return;
    visited.add(current);
    for (const node of current._nodes ?? []) {
      const id = `${prefix}${node.id}`;
      if (node.subgraph) visit(node.subgraph, `${id}:`);
      const schema = definitions[node.comfyClass || node.type]?.input;
      for (const widget of node.widgets ?? []) {
        const fields = schema?.required ?? {};
        const optional = schema?.optional ?? {};
        const definition = fields[widget.name] ?? optional[widget.name];
        let options = comboValues(definition);
        const widgetValues = typeof widget.options?.values === "function" ? widget.options.values.call(widget) : widget.options?.values;
        if (!definition && Array.isArray(widgetValues)) options = widgetValues.filter(value => typeof value === "string" && modelFile.test(value));
        const objectLora = widget.value && typeof widget.value === "object" && !Array.isArray(widget.value)
          && /lora/i.test(widget.name) && typeof widget.value.lora === "string";
        if (objectLora) options = loras;
        const value = objectLora ? widget.value.lora : widget.value;
        const isCombo = Array.isArray(fields[widget.name]?.[0]) || fields[widget.name]?.[0] === "COMBO"
          || Array.isArray(optional[widget.name]?.[0]) || optional[widget.name]?.[0] === "COMBO" || Array.isArray(widgetValues);
        if (typeof value !== "string" || !modelFile.test(value) || (!isCombo && !objectLora) || options.includes(value)) continue;
        const exact = options.filter(option => normalize(option) === normalize(value));
        const candidates = [...new Set(exact.length ? exact : options.filter(option => basename(option) === basename(value)))];
        const entry = { node, widget, id, field: widget.name, previous: value, candidates, objectLora };
        if (candidates.length === 1) changes.push({ ...entry, value: candidates[0] });
        else unresolved.push(entry);
      }
    }
  };
  visit(graph);
  return { changes, unresolved };
}

export function applyModelRepairs(graph, changes) {
  if (!changes.length) return;
  graph.beforeChange();
  try {
    for (const { node, widget, previous, value, objectLora } of changes) {
      const oldValue = widget.value;
      if ((objectLora ? oldValue.lora : oldValue) !== previous) continue;
      widget.value = objectLora ? { ...oldValue, lora: value } : value;
      widget.callback?.(widget.value);
      node.onWidgetChanged?.(widget.name, widget.value, oldValue, widget);
    }
  } finally {
    graph.afterChange();
    graph.setDirtyCanvas(true, true);
  }
}
