import { normalizeColor, escapeHtml, addAlpha } from "../utils";
import { RowRenderer } from "./RowRenderer";

export class GroupRenderer {
  constructor(private fields: any[], private allItems: any[], private groupDivisors?: string[] | null) { }

  private getIconSvg(iconName: string, size: number = 14): string {
    if ((window as any).getIconSvg) {
      return (window as any).getIconSvg(iconName as any, { size });
    }
    return "";
  }

  public renderGroup(
    tbody: HTMLTableSectionElement,
    group: any,
    groupingField: any,
    rowRenderer: RowRenderer,
  ) {
    const trHeader = document.createElement("tr");
    trHeader.className = "group-header";
    const tdHeader = document.createElement("td");
    tdHeader.colSpan = this.fields.length + 1;
    tdHeader.style.padding = "8px";
    tdHeader.style.background = "var(--vscode-editor-background)";
    tdHeader.style.fontWeight = "600";
    tdHeader.style.borderTop = "1px solid var(--vscode-editorGroup-border)";
    tdHeader.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";
    tdHeader.style.position = "sticky";
    tdHeader.style.top = "32px";
    tdHeader.style.zIndex = "9";
    tdHeader.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";

    const headerContent = document.createElement("div");
    headerContent.style.display = "flex";
    headerContent.style.alignItems = "center";
    headerContent.style.gap = "8px";

    const built = buildGroupHeaderElement(this.fields, this.allItems, group, groupingField, { groupDivisors: this.groupDivisors });
    const iconExpanded = this.getIconSvg("triangle-down", 16);
    const iconCollapsed = this.getIconSvg("triangle-right", 16);

    // Apply sticky styles directly to the built element to preserve wrapper structure
    // This ensures the same DOM structure across table, board, and roadmap views
    built.style.position = "sticky";
    built.style.left = "0";
    built.style.zIndex = "12";
    built.style.background = tdHeader.style.background;
    built.style.paddingRight = "8px";

    // Append the built element directly (preserve wrapper) instead of moving children
    headerContent.appendChild(built);

    const toggleEl = built.querySelector('.group-toggle') as HTMLElement | null;

    // Note: Avatar handling and "Unassigned" rename are now handled in buildGroupHeaderElement()
    // to ensure consistency across table, board, and roadmap views.



    tdHeader.appendChild(headerContent);
    trHeader.appendChild(tdHeader);
    tbody.appendChild(trHeader);

    // Render Items
    const groupRows: HTMLTableRowElement[] = [];
    // Use a sanitized class name for group toggling (avoid spaces/special chars)
    const rawId = group && group.option && group.option.id ? String(group.option.id) : String(Math.random()).replace("0.", "_");
    const safeId = rawId.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_\-]/g, "_");
    group.items.forEach((groupItem: any) => {
      const tr = rowRenderer.createRow(groupItem.item, groupItem.index);
      try {
        tr.classList.add("group-row-" + safeId); // Add class for group toggling
      } catch (e) { }
      tbody.appendChild(tr);
      groupRows.push(tr);
    });

    // Toggle Logic
    let isCollapsed = false;
    const setCollapsed = (collapsed: boolean) => {
      isCollapsed = collapsed;
      if (toggleEl) toggleEl.innerHTML = isCollapsed ? iconCollapsed : iconExpanded;
      groupRows.forEach((row) => {
        row.style.display = isCollapsed ? "none" : "table-row";
      });
      try {
        if (isCollapsed) trHeader.classList.add("collapsed");
        else trHeader.classList.remove("collapsed");
      } catch (e) { }
    };

    if (toggleEl) {
      toggleEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setCollapsed(!isCollapsed);
      });
    }

    // Allow clicking the whole header to toggle collapse/expand for easier interaction and tests
    tdHeader.addEventListener("click", (ev) => {
      // Ignore clicks on controls inside header (e.g., links, buttons)
      const target = ev.target as HTMLElement;
      if (target && (target.tagName === "BUTTON" || target.closest("button") || target.closest("a"))) return;
      setCollapsed(!isCollapsed);
    });
  }

  // Consumers should use the shared `buildGroupHeaderElement` directly when needed.
}

function createEl(tag = "div") { return document.createElement(tag); }

function renderColorDot(option: any): HTMLElement {
  const colorDot = createEl("div");
  colorDot.className = "group-color-dot";
  colorDot.style.width = "12px";
  colorDot.style.height = "12px";
  colorDot.style.borderRadius = "50%";
  colorDot.style.backgroundColor = normalizeColor(option?.color) || "gray";
  colorDot.style.marginRight = "8px";
  return colorDot;
}

function renderNameSpan(option: any, groupingField?: any): HTMLElement {
  const nameSpan = createEl("span");
  nameSpan.className = "group-name";
  nameSpan.style.fontWeight = "600";
  nameSpan.style.marginRight = "8px";
  const name = option && (option.name || option.title || option.label) ? String(option.name || option.title || option.label) : "Unassigned";
  nameSpan.textContent = name;
  return nameSpan;
}

function renderCountPill(count: number, option: any): HTMLElement {
  const countPill = createEl("span");
  const color = normalizeColor(option?.color) || "#848d97";
  countPill.className = "gh-count-pill";
  countPill.style.background = addAlpha(color, 0.12) || "transparent";
  countPill.style.color = color;
  countPill.style.border = "1px solid rgba(0,0,0,0.04)";
  countPill.style.borderRadius = "10px";
  countPill.style.padding = "2px 8px";
  countPill.style.fontSize = "11px";
  countPill.style.fontWeight = "600";
  countPill.textContent = String(count || 0);
  return countPill;
}

function renderEstimateElement(fields: any[], itemsArr: any[]): HTMLElement | null {
  if (!Array.isArray(fields)) return null;
  const estimateField =
    fields.find((f: any) => (f.dataType || f.type || "").toString().toLowerCase() === "number" && String(f.name || "").toLowerCase().includes("estimate"),)
    || fields.find((f: any) => (f.dataType || f.type || "").toString().toLowerCase() === "number");
  if (!estimateField) return null;
  const estimateFieldId = estimateField.id;
  let sum = 0;
  for (const gi of itemsArr || []) {
    const it = gi && (gi.item || gi);
    if (!it || !Array.isArray(it.fieldValues)) continue;
    const fv = it.fieldValues.find((v: any) => (v.fieldId && String(v.fieldId) === String(estimateFieldId)) || (v.fieldName && String(v.fieldName).toLowerCase().includes("estimate")) || v.type === "number",
    );
    if (fv) {
      const num = Number(fv.number != null ? fv.number : fv.value != null ? fv.value : NaN);
      if (!isNaN(num)) sum += num;
    }
  }
  if (sum > 0) {
    const el = createEl("div");
    el.style.display = "inline-block";
    el.style.padding = "2px 8px";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid var(--vscode-panel-border)";
    el.style.background = "var(--vscode-input-background)";
    el.style.color = "var(--vscode-foreground)";
    el.style.fontSize = "12px";
    el.style.lineHeight = "18px";
    el.style.marginLeft = "8px";
    el.textContent = "Estimate: " + String(sum);
    return el;
  }
  return null;
}

function renderNumericFieldSum(field: any, itemsArr: any[]): HTMLElement | null {
  if (!field) return null;
  const fieldId = field.id || field.name;
  let sum = 0;
  for (const gi of itemsArr || []) {
    const it = gi && (gi.item || gi);
    if (!it || !Array.isArray(it.fieldValues)) continue;
    const fv = it.fieldValues.find((v: any) => (v.fieldId && String(v.fieldId) === String(fieldId)) || (v.fieldName && String(v.fieldName) === String(field.name)) || v.type === "number");
    if (fv) {
      const num = Number(fv.number != null ? fv.number : fv.value != null ? fv.value : NaN);
      if (!isNaN(num)) sum += num;
    }
  }
  if (sum !== 0) {
    const el = createEl("div");
    el.style.display = "inline-block";
    el.style.padding = "2px 8px";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid var(--vscode-panel-border)";
    el.style.background = "var(--vscode-input-background)";
    el.style.color = "var(--vscode-foreground)";
    el.style.fontSize = "12px";
    el.style.lineHeight = "18px";
    el.style.marginLeft = "8px";
    el.textContent = String(field.name || fieldId) + ": " + String(sum);
    return el;
  }
  return null;
}

function getEffectiveGroupDivisorsForFields(fields: any[]): string[] | null {
  try {
    const vs = (window as any).__viewStates || {};
    for (const k of Object.keys(vs)) {
      try {
        const st = vs[k];
        if (!st || !st.fields) continue;
        const stIds = (st.fields || []).map((f: any) => String(f.id));
        const fIds = (fields || []).map((f: any) => String(f.id));
        const common = fIds.filter((id: string) => stIds.indexOf(id) >= 0).length;
        if (common > 0) {
          // found a likely matching view state
          return st.groupDivisors === undefined ? null : st.groupDivisors;
        }
      } catch (e) { }
    }
  } catch (e) { }
  return null;
}

function extractParentFromItem(it: any, groupingField: any): any {
  if (!it) return null;
  const candidates: any[] = [];
  if (Array.isArray(it.fieldValues)) candidates.push(it.fieldValues);
  if (it.content && Array.isArray(it.content.fieldValues)) candidates.push(it.content.fieldValues);
  if (it.raw && it.raw.itemContent && Array.isArray(it.raw.itemContent.fieldValues)) candidates.push(it.raw.itemContent.fieldValues);
  for (const cvs of candidates) {
    const pfv = cvs.find((v: any) => String(v.fieldId) === String(groupingField?.id) || String(v.fieldName) === String(groupingField?.name) || String(v.type) === "parent_issue");
    if (pfv) return pfv.parent || pfv.parentIssue || pfv.issue || pfv.item || pfv.value || null;
  }
  return it.parent || it.parentIssue || it.issue || it.item || it.value || null;
}

function renderParentProgress(group: any, groupingField: any, allItems: any[]): HTMLElement | null {
  if (!groupingField || String((groupingField.dataType || groupingField.type) || "").toLowerCase() !== "parent_issue") return null;
  try {
    let parentMeta: any = null;
    if (group && group.option) parentMeta = group.option.parent || group.option.parentIssue || group.option.issue || parentMeta;
    if (!parentMeta && group.items && group.items.length > 0) {
      const firstRaw = group.items[0];
      const first = firstRaw && firstRaw.item ? firstRaw.item : firstRaw;
      parentMeta = extractParentFromItem(first, groupingField) || parentMeta;
    }
    if (!parentMeta) return null;
    const identifiers: string[] = [];
    const pushIf = (v: any) => { if (v !== undefined && v !== null && v !== "") identifiers.push(String(v)); };
    pushIf(parentMeta && parentMeta.number); pushIf(parentMeta && parentMeta.id); pushIf(parentMeta && parentMeta.url); pushIf(parentMeta && parentMeta.title);
    if (group && group.option) { pushIf(group.option.id); pushIf(group.option.name); pushIf(group.option.title); }
    const found = (allItems || []).find((A: any) => {
      const d = (A && (A.content || (A.raw && A.raw.itemContent))) || A || null; if (!d) return false;
      const M: string[] = []; const tryPush = (x: any) => { if (x !== undefined && x !== null && x !== "") M.push(String(x)); };
      tryPush(d.number); tryPush(d.id); tryPush(d.url); tryPush(d.title); tryPush(d.name);
      if (d.raw) { tryPush(d.raw.number); tryPush(d.raw.id); tryPush(d.raw.url); }
      if (d.itemContent && typeof d.itemContent === 'object') { tryPush(d.itemContent.number); tryPush(d.itemContent.id); tryPush(d.itemContent.url); tryPush(d.itemContent.title); tryPush(d.itemContent.name); }
      for (const o of identifiers) { for (const m of M) { if (o && m && String(o) === String(m)) return true; } }
      return false;
    });
    // Progress bar calculation - don't require finding the parent in allItems,
    // we can calculate progress directly from group items
    let done = 0, total = 0; const itemsList = group.items || [];
    const isDoneByHeuristics = (it: any) => {
      try {
        const content = it && (it.content || (it.raw && it.raw.itemContent));
        if (content) {
          const state = (content.state || (content.merged ? "MERGED" : undefined) || "").toString().toUpperCase(); if (state === "CLOSED" || state === "MERGED") return true;
        }
        if (Array.isArray(it.fieldValues)) {
          const ss = it.fieldValues.find((v: any) => v && v.type === "single_select" && v.option && v.option.name && ["done", "closed", "completed", "finished"].includes(String(v.option.name).toLowerCase())); if (ss) return true;
          const percentFV = it.fieldValues.find((v: any) => v && (String(v.fieldName || "").toLowerCase().includes("progress") || String(v.fieldName || "").toLowerCase().includes("percent")));
          if (percentFV && percentFV.number != null) { const pct = Number(percentFV.number || 0); if (pct >= 100) return true; }
        }
      } catch (e) { }
      return false;
    };
    for (const gi of itemsList) { const it = gi.item || gi; if (!it) continue; total++; if (isDoneByHeuristics(it)) done++; }
    if (total > 0) { const pct = Math.round((done / total) * 100); const progWrapper = createEl("div"); progWrapper.className = "group-progress"; progWrapper.style.display = "inline-flex"; progWrapper.style.alignItems = "center"; progWrapper.style.gap = "8px"; progWrapper.style.marginLeft = "8px"; const bar = createEl("div"); bar.style.display = "inline-block"; bar.style.width = "120px"; bar.style.height = "12px"; bar.style.background = "transparent"; bar.style.border = "1px solid var(--vscode-focusBorder)"; bar.style.borderRadius = "6px"; bar.style.overflow = "hidden"; const fill = createEl("div"); fill.style.height = "100%"; fill.style.width = String(pct) + "%"; fill.style.background = "var(--vscode-focusBorder)"; bar.appendChild(fill); progWrapper.appendChild(bar); return progWrapper; }
  } catch (e) { }
  return null;
}

function renderIterationElement(group: any, groupingField: any): HTMLElement | null {
  if (!groupingField) return null;
  try {
    const dtype = String((groupingField.dataType || groupingField.type) || "").toLowerCase(); if (dtype !== "iteration") return null;
    const opt = group.option || {}; let iterText: string | null = null; const start = opt.startDate || (opt.start && opt.startDate) || null; const duration = opt.duration || opt.length || null;
    if (start && duration) { try { const s = new Date(start); const days = Number(duration) || 0; const e = new Date(s.getTime() + days * 24 * 60 * 60 * 1000); const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" }); const eStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric" }); iterText = `${sStr} — ${eStr}`; } catch (e) { iterText = null; } }
    if (!iterText) iterText = opt.title || opt.name ? String(opt.title || opt.name) : null;
    if (iterText) { const iterEl = createEl("div"); iterEl.style.color = "var(--vscode-descriptionForeground)"; iterEl.style.fontSize = "12px"; iterEl.style.marginLeft = "8px"; iterEl.textContent = String(iterText).slice(0, 120); return iterEl; }
  } catch (e) { }
  return null;
}

function getIconSvg(iconName: string, size: number = 14): string {
  if ((window as any).getIconSvg) return (window as any).getIconSvg(iconName as any, { size });
  return "";
}

export function buildGroupHeaderElement(fields: any[], allItems: any[], group: any, groupingField: any, options?: { hideToggle?: boolean; viewKey?: string; groupDivisors?: string[] | null }): HTMLElement {
  // Normalize grouping field: callers may pass a minimal field or an option-like object.
  const groupingFieldDef = (groupingField && (groupingField.dataType || groupingField.type))
    ? groupingField
    : (Array.isArray(fields) ? fields.find((f: any) => String(f.id) === String(groupingField?.id) || String(f.name) === String(groupingField?.name)) : groupingField) || groupingField;
  const header = document.createElement("div");
  // Provide both the legacy `group-header` class and the newer `group-header-div`
  // so table/board/roadmap styles/selectors match the same element.
  header.className = "group-header group-header-div";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.padding = "8px";
  header.style.background = "var(--vscode-sideBar-background)";

  // Toggle placeholder (only render if hideToggle is not set)
  if (!options?.hideToggle) {
    const toggleSpan = document.createElement("span");
    toggleSpan.className = "group-toggle";
    toggleSpan.style.cursor = "pointer";
    toggleSpan.style.marginRight = "8px";
    // Provide a visible default icon so board/roadmap show the toggle correctly
    try { toggleSpan.innerHTML = getIconSvg('triangle-down', 16); } catch (e) { }
    header.appendChild(toggleSpan);
  }

  // Color / Name / Count (use shared renderers)
  const colorDot = renderColorDot(group.option || {});
  // also add board-specific class for backward compatibility
  colorDot.classList.add('board-card-color-dot');
  header.appendChild(colorDot);
  const nameSpan = renderNameSpan(group.option || {}, groupingFieldDef);
  // add board title class for compatibility
  nameSpan.classList.add('board-card-title');
  header.appendChild(nameSpan);
  // Determine group divisors configuration: explicit array = render selected pills; undefined/null = render nothing
  let effectiveDivisors: string[] | null | undefined = undefined;
  try {
    if (options && Object.prototype.hasOwnProperty.call(options, 'groupDivisors')) {
      effectiveDivisors = options!.groupDivisors;
    } else if (options && options.viewKey) {
      try {
        const vs = (window as any).__viewStates || {};
        effectiveDivisors = vs[options.viewKey] ? vs[options.viewKey].groupDivisors : undefined;
      } catch (e) { effectiveDivisors = undefined; }
    }
  } catch (e) { effectiveDivisors = undefined; }

  if (Array.isArray(effectiveDivisors)) {
    // Only render Count if explicitly selected (__count__)
    if (effectiveDivisors.find((x: any) => String(x) === '__count__')) {
      const countPill = renderCountPill((group.items && group.items.length) || 0, group.option || {});
      countPill.classList.add('board-card-count');
      header.appendChild(countPill);
    }
    // For each selected numeric field, render a summed pill
    try {
      const numericFields = (fields || []).filter((f: any) => String((f.dataType || f.type || '').toLowerCase()) === 'number' || String(f.name || '').toLowerCase().includes('estimate'));
      for (const sel of effectiveDivisors) {
        if (String(sel) === '__count__') continue;
        const f = numericFields.find((nf: any) => String(nf.id) === String(sel) || String(nf.name) === String(sel));
        if (f) {
          const el = renderNumericFieldSum(f, group.items || []);
          if (el) {
            el.classList.add('board-card-estimate');
            header.appendChild(el);
          }
        }
      }
    } catch (e) { }
  }

  // Avatar handling: if option has avatar data or groupingField is assignees,
  // try to replace the color dot with an avatar image (works for table/board/roadmap)
  try {
    const opt = group && group.option ? group.option : {};
    const shouldShowAvatar = opt && (opt.avatarUrl || opt.avatar || opt.imageUrl || opt.login)
      || (opt && opt.name && String((groupingFieldDef && (groupingFieldDef.dataType || groupingFieldDef.type) || "").toLowerCase()) === "assignees");
    if (shouldShowAvatar) {
      let avatarUrl = opt.avatarUrl || opt.avatar || opt.imageUrl || null;
      if (!avatarUrl && Array.isArray(group.items)) {
        for (const gi of group.items || []) {
          const it = gi && (gi.item || gi);
          if (!it || !Array.isArray(it.fieldValues)) continue;
          const fv = it.fieldValues.find((v: any) => v && (v.type === "assignees" || String(v.fieldId) === String(groupingFieldDef && groupingFieldDef.id)));
          if (fv && fv.assignees && Array.isArray(fv.assignees)) {
            const match = fv.assignees.find((a: any) => String(a.login || a.name) === String(opt.name || opt.id));
            if (match && (match.avatarUrl || match.avatar)) { avatarUrl = match.avatarUrl || match.avatar; break; }
          }
        }
      }
      if (avatarUrl && colorDot && colorDot.parentNode) {
        const avatarEl = document.createElement("span");
        avatarEl.innerHTML = '<span title="' + escapeHtml((opt && (opt.login || opt.name)) || "Assignee") + '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' + escapeHtml(avatarUrl) + ');border:2px solid var(--vscode-editor-background)"></span>';
        colorDot.parentNode.replaceChild(avatarEl, colorDot);
      }
    }
  } catch (e) { }

  // If this group corresponds to 'Unassigned', rename to 'No <fieldname>' for all views
  try {
    if (group && group.option && (group.option.name === "Unassigned" || group.option.title === "Unassigned")) {
      if (nameSpan) nameSpan.textContent = "No " + (groupingFieldDef && (groupingFieldDef.name || groupingFieldDef.title) ? (groupingFieldDef.name || groupingFieldDef.title) : "value");
    }
  } catch (e) { }

  try {
    const parentEl = renderParentProgress(group, groupingFieldDef, allItems);
    if (parentEl) header.appendChild(parentEl);
  } catch (e) { }

  try {
    const iterEl = renderIterationElement(group, groupingFieldDef);
    if (iterEl) header.appendChild(iterEl);
  } catch (e) { }
  return header;
}
