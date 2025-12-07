import { renderCell } from "../renderers/cellRenderer";
import { normalizeColor, getContrastColor, escapeHtml } from "../utils";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ColumnHeaderRenderer } from "../renderers/columnHeaderRenderer";
import FieldsMenu from "./FieldsMenu";
import { SlicePanel } from "./SlicePanel";
import type { SortConfig } from "../utils/tableSorting";
import { sortItems } from "../utils/tableSorting";

export interface TableOptions {
    groupingFieldName?: string;
    sortConfig?: SortConfig | null;
    viewKey?: string;
    hiddenFields?: string[];
    onSortChange?: (config: SortConfig) => void;
    onGroupChange?: (fieldName: string) => void;
    onSliceChange?: (field: any) => void;
    onHiddenFieldsChange?: (hiddenIds: string[]) => void;
}

export class ProjectTable {
    private container: HTMLElement;
    private allFields: any[]; // All fields including hidden
    private fields: any[]; // Visible fields only
    private items: any[];
    private options: TableOptions;
    private hiddenFieldIds: Set<string>;
    private activeMenu: ColumnHeaderMenu | null = null;
    private activeFieldsMenu: FieldsMenu | null = null;
    private activeSlicePanel: SlicePanel | null = null;
    private activeSlice: { fieldId: string, value: any } | null = null;
    // Track which field the active slice panel is for (panel may be open before a value is selected)
    private activeSlicePanelFieldId: string | null = null;

    constructor(container: HTMLElement, fields: any[], items: any[], options: TableOptions = {}) {
        this.container = container;
        // Normalize all field ids to strings to avoid type mismatches
        this.allFields = (fields || []).map(f => ({ ...f, id: String(f.id) }));
        this.options = options;
        this.items = items;

        // Load hidden fields from options or localStorage
        const hiddenFromStorage = this.loadHiddenFields().map(id => String(id));
        const hiddenFromOptions = (options.hiddenFields || []).map(id => String(id));
        this.hiddenFieldIds = new Set<string>([...hiddenFromStorage, ...hiddenFromOptions]);

        // Filter visible fields (ids already normalized on allFields)
        this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));

        // Debug: log initial hidden/visible sets
        try {
            console.debug('[ProjectTable] init: allFieldIds=', this.allFields.map(f => f.id));
            console.debug('[ProjectTable] init: hiddenFieldIds=', Array.from(this.hiddenFieldIds));
            console.debug('[ProjectTable] init: visibleFieldIds=', this.fields.map(f => f.id));
        } catch (e) { }

        // Also forward debug info to the extension output channel so it's visible
        try {
            const dbg = { allFieldIds: this.allFields.map((f: any) => String(f.id)), hiddenFieldIds: Array.from(this.hiddenFieldIds), visibleFieldIds: this.fields.map((f: any) => String(f.id)) };
            if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === 'function') {
                (window as any).__APP_MESSAGING__.postMessage({ command: 'debugLog', level: 'debug', message: 'ProjectTable init', data: dbg, viewKey: this.options.viewKey });
            }
        } catch (e) { }

        // Load and apply field order if stored
        this.applyFieldOrder();
    }

    public render() {
        // Preserve slice panel if it exists
        const existingSlicePanel = this.container.querySelector('.slice-panel');

        this.container.innerHTML = "";

        // Re-add slice panel if it existed
        if (existingSlicePanel) {
            this.container.appendChild(existingSlicePanel);
        }

        const tableContainer = document.createElement("div");
        tableContainer.className = "table-wrapper";
        tableContainer.style.overflowX = "auto";
        tableContainer.style.overflowY = "auto";
        tableContainer.style.width = "100%";
        tableContainer.style.display = "block";
        tableContainer.style.height = "100%"; // Let it grow

        const table = document.createElement("table");
        table.style.borderCollapse = "separate";
        table.style.borderSpacing = "0";
        // Use fixed layout so explicit <col> widths are honored and columns can be
        // resized smaller than their content (content will be ellipsised).
        table.style.tableLayout = "fixed";
        // Let container control horizontal scrolling while table fills width
        table.style.width = "100%";

        this.renderColGroup(table);
        new ColumnHeaderRenderer({
            fields: this.fields,
            sortConfig: this.options.sortConfig,
            groupingFieldName: this.options.groupingFieldName,
            activeSlice: this.activeSlice,
            activeSlicePanelFieldId: this.activeSlicePanelFieldId,
            onHeaderMenu: this.showHeaderMenu.bind(this),
            onShowFieldsMenu: this.showFieldsMenu.bind(this),
            onClearGroup: this.clearGroup.bind(this),
            onClearSlice: this.clearSlice.bind(this)
        }).render(table);
        this.renderBody(table);

        tableContainer.appendChild(table);
        this.container.appendChild(tableContainer);

        // Post-render: adjust column widths based on content (simple heuristic)
        // This was in the original code, we can keep it or improve it.
        // For now, let's keep the sticky header logic and resizers.
        this.setupResizers(table);
    }

    private renderColGroup(table: HTMLTableElement) {
        const colgroup = document.createElement("colgroup");
        // Index column
        const colIndex = document.createElement("col");
        colIndex.style.width = "40px";
        colgroup.appendChild(colIndex);

        for (const field of this.fields) {
            const col = document.createElement("col");
            col.style.width = "150px"; // Default width
            // Attach field id so resizer can update the correct <col>
            col.dataset.fieldId = field.id;
            colgroup.appendChild(col);
        }

        // Add Field column
        const colAddField = document.createElement("col");
        colAddField.style.width = "50px";
        colgroup.appendChild(colAddField);

        table.appendChild(colgroup);
    }



    private showFieldsMenu(anchorElement: HTMLElement) {
        // Hide existing menus
        if (this.activeMenu) { this.activeMenu.hide(); this.activeMenu = null; }
        if (this.activeFieldsMenu) { this.activeFieldsMenu.hide(); this.activeFieldsMenu = null; }

        // Build visible id set from hiddenFieldIds to ensure consistent detection (normalize ids)
        const visibleSet = new Set<string>(this.allFields.filter(f => !this.hiddenFieldIds.has(String(f.id))).map(f => String(f.id)));

        // Debug: log current hidden/visible sets before showing menu
        try {
            console.debug('[ProjectTable] showFieldsMenu: hiddenFieldIds=', Array.from(this.hiddenFieldIds));
            console.debug('[ProjectTable] showFieldsMenu: allFieldIds=', this.allFields.map(f => f.id));
        } catch (e) { }

        const menu = new FieldsMenu({
            fields: this.allFields.map(f => ({ id: f.id, name: f.name, iconClass: f.iconClass, dataType: (f.dataType || f.type) })),
            visibleFieldIds: visibleSet,
            onToggleVisibility: (fieldId: string, visible: boolean) => {
                if (visible) this.showField(fieldId);
                else this.hideField(fieldId);
            },
            onCreateField: () => {
                // Placeholder: open create field flow if available
                try { console.log('Create field requested'); } catch (e) { }
            }
        });

        this.activeFieldsMenu = menu;
        menu.show(anchorElement);
    }



    private renderBody(table: HTMLTableElement) {
        const tbody = document.createElement("tbody");

        // Apply sorting
        let displayItems = this.items;
        if (this.options.sortConfig) {
            displayItems = sortItems(this.items, this.fields, this.options.sortConfig);
        }

        // Apply Slice Filter
        if (this.activeSlice) {
            displayItems = displayItems.filter(item => {
                const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(this.activeSlice!.fieldId));
                if (!fv) return this.activeSlice!.value === null; // Match empty if value is null

                // Extract value logic similar to SlicePanel
                let val = null;
                if (fv.text !== undefined) val = fv.text;
                else if (fv.title !== undefined) val = fv.title;
                else if (fv.number !== undefined) val = fv.number;
                else if (fv.date !== undefined) val = fv.date;
                else if (fv.option) val = fv.option.name;
                else if (fv.iteration) val = fv.iteration.title;
                else val = fv.value;

                return val === this.activeSlice!.value;
            });
        }

        // Check for grouping
        const groupingField = this.getGroupingField();

        if (groupingField) {
            this.renderGroupedRows(tbody, groupingField, displayItems);
        } else {
            this.renderFlatRows(tbody, displayItems);
        }

        table.appendChild(tbody);
    }

    private getGroupingField() {
        // Logic to determine grouping field from options or view details
        // Passed via options.groupingFieldName or similar
        if (this.options.groupingFieldName) {
            return this.fields.find(f =>
                (f.name && f.name.toLowerCase() === this.options.groupingFieldName?.toLowerCase()) ||
                (f.id && f.id === this.options.groupingFieldName)
            );
        }
        return null;
    }

    private renderFlatRows(tbody: HTMLTableSectionElement, items: any[]) {
        items.forEach((item, index) => {
            const tr = this.createRow(item, index);
            tbody.appendChild(tr);
        });
    }

    private renderGroupedRows(tbody: HTMLTableSectionElement, groupingField: any, items: any[]) {
        // Group items
        const groups = this.groupItems(items, groupingField);

        for (const group of groups) {
            // Render Group Header
            const trHeader = document.createElement("tr");
            const tdHeader = document.createElement("td");
            tdHeader.colSpan = this.fields.length + 1;
            tdHeader.style.padding = "8px";
            tdHeader.style.background = "var(--vscode-editor-background)"; // Ensure opaque background
            tdHeader.style.fontWeight = "600";
            tdHeader.style.borderTop = "1px solid var(--vscode-editorGroup-border)";
            tdHeader.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";
            tdHeader.style.position = "sticky";
            tdHeader.style.top = "32px"; // Matches fixed header height
            tdHeader.style.zIndex = "9";
            tdHeader.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)"; // Add shadow for better separation

            // Group Header Content
            const headerContent = document.createElement("div");
            headerContent.style.display = "flex";
            headerContent.style.alignItems = "center";
            headerContent.style.gap = "8px";
            const field = groupingField;

            // Helper: find estimate field id (best-effort)
            const estimateField = this.fields.find(f => (f.dataType && String(f.dataType).toLowerCase() === 'number') && String(f.name || '').toLowerCase().includes('estimate')) ||
                this.fields.find(f => (f.dataType && String(f.dataType).toLowerCase() === 'number'));
            const estimateFieldId = estimateField ? estimateField.id : null;

            const sumEstimate = (itemsArr: any[]) => {
                if (!estimateFieldId) return 0;
                let sum = 0;
                for (const gi of itemsArr) {
                    const it = gi.item || gi;
                    if (!it || !Array.isArray(it.fieldValues)) continue;
                    const fv = it.fieldValues.find((v: any) => (v.fieldId && String(v.fieldId) === String(estimateFieldId)) || (v.fieldName && String(v.fieldName).toLowerCase().includes('estimate')) || v.type === 'number');
                    if (fv) {
                        const num = Number(fv.number != null ? fv.number : (fv.value != null ? fv.value : NaN));
                        if (!isNaN(num)) sum += num;
                    }
                }
                return sum;
            };

            const formatEstimate = (n: number) => {
                if (!isFinite(n)) return "";
                return String(n);
            };

            // Toggle Button
            const toggleBtn = document.createElement("span");
            // SVG Icons for GitHub-like look
            const iconExpanded = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-down"><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"></path></svg>`;
            const iconCollapsed = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-right"><path d="M8.573 4.604a.25.25 0 01.427-.177l3.396 3.396a.25.25 0 010 .354l-3.396 3.396a.25.25 0 01-.427-.177V4.604z"></path></svg>`;

            toggleBtn.innerHTML = iconExpanded;
            toggleBtn.style.cursor = "pointer";
            toggleBtn.style.userSelect = "none";
            toggleBtn.style.display = "inline-flex";
            toggleBtn.style.alignItems = "center";
            toggleBtn.style.justifyContent = "center";
            toggleBtn.style.width = "16px";
            toggleBtn.style.height = "16px";
            toggleBtn.style.fill = "var(--vscode-foreground)";
            toggleBtn.style.opacity = "0.7";

            // Group Name & Color
            const colorDot = document.createElement("div");
            colorDot.style.width = "12px";
            colorDot.style.height = "12px";
            colorDot.style.borderRadius = "50%";
            colorDot.style.backgroundColor = normalizeColor(group.option.color) || "gray";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = group.option.name || group.option.title || "Unassigned";

            const countBadge = document.createElement("vscode-badge");
            countBadge.textContent = String(group.items.length);

            // We'll keep the left-hand part of the group header (toggle, avatar/color, name, count)
            // in a sticky left pane so it remains visible when horizontally scrolling.
            const leftPane = document.createElement('div');
            leftPane.style.display = 'flex';
            leftPane.style.alignItems = 'center';
            leftPane.style.gap = '8px';
            leftPane.style.position = 'sticky';
            leftPane.style.left = '0';
            leftPane.style.zIndex = '12';
            leftPane.style.background = tdHeader.style.background;
            leftPane.style.paddingRight = '8px';

            const rightPane = document.createElement('div');
            rightPane.style.display = 'flex';
            rightPane.style.alignItems = 'center';
            rightPane.style.gap = '8px';
            rightPane.style.flex = '1';

            leftPane.appendChild(toggleBtn);

            // For parent_issue, try to extract parent metadata from the first child item
            let parentMeta: any = null;
            let resolvedParentItem: any = null;
            if (String(groupingField.dataType || '').toLowerCase() === 'parent_issue') {
                const first = (group.items && group.items[0]) ? (group.items[0].item || group.items[0]) : null;
                if (first && Array.isArray(first.fieldValues)) {
                    const pfv = first.fieldValues.find((v: any) => String(v.fieldId) === String(groupingField.id) || v.fieldName === groupingField.name || v.type === 'parent_issue');
                    if (pfv) {
                        parentMeta = pfv.parent || pfv.parentIssue || pfv.issue || pfv.item || pfv.value || null;
                    }
                }

                // Try to resolve the full parent item from the current items snapshot (this.items)
                if (parentMeta && Array.isArray(this.items)) {
                    try {
                        const identifiers: string[] = [];
                        if (parentMeta.number) identifiers.push(String(parentMeta.number));
                        if (parentMeta.id) identifiers.push(String(parentMeta.id));
                        if (parentMeta.url) identifiers.push(String(parentMeta.url));
                        if (parentMeta.title) identifiers.push(String(parentMeta.title));
                        // search in this.items for a matching content/raw identifiers
                        const found = this.items.find((A: any) => {
                            const d = (A && (A.content || (A.raw && A.raw.itemContent))) || null;
                            if (!d) return false;
                            const M: string[] = [];
                            if (d.number) M.push(String(d.number));
                            if (d.id) M.push(String(d.id));
                            if (d.url) M.push(String(d.url));
                            if (d.title) M.push(String(d.title));
                            if (d.name) M.push(String(d.name));
                            if (d.raw && d.raw.number) M.push(String(d.raw.number));
                            if (d.raw && d.raw.id) M.push(String(d.raw.id));
                            if (d.raw && d.raw.url) M.push(String(d.raw.url));
                            for (let o of identifiers) {
                                for (let m of M) {
                                    if (o && m && String(o) === String(m)) return true;
                                }
                            }
                            return false;
                        });
                        if (found) resolvedParentItem = found;
                    } catch (e) { }
                }
            }

            // Avatar / color dot / repo icon depending on field type
            if ((group.option && group.option.avatarUrl) || (group.option && group.option.login) || (group.option && group.option.name && (String(groupingField.dataType || '').toLowerCase() === 'assignees'))) {
                // Try to render avatar for assignees
                const avatarEl = document.createElement('span');
                const avatarUrl = (group.option && (group.option.avatarUrl || group.option.avatar || group.option.imageUrl)) || (() => {
                    // try to find in items
                    for (const gi of group.items) {
                        const it = gi.item || gi;
                        if (!it || !Array.isArray(it.fieldValues)) continue;
                        const fv = it.fieldValues.find((v: any) => v.type === 'assignees' || (String(v.fieldId) === String(groupingField.id)));
                        if (fv && fv.assignees && Array.isArray(fv.assignees)) {
                            const match = fv.assignees.find((a: any) => String(a.login || a.name) === String(group.option.name || group.option.id));
                            if (match && (match.avatarUrl || match.avatar)) return match.avatarUrl || match.avatar;
                        }
                    }
                    return null;
                })();
                if (avatarUrl) {
                    avatarEl.innerHTML = '<span title="' + (escapeHtml((group.option && (group.option.login || group.option.name)) || 'Assignee')) + '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' + escapeHtml(avatarUrl) + ');border:2px solid var(--vscode-editor-background)"></span>';
                    leftPane.appendChild(avatarEl);
                } else {
                    leftPane.appendChild(colorDot);
                }
            } else if (String(groupingField.dataType || '').toLowerCase() === 'repository') {
                // repository icon
                const repoIcon = document.createElement('span');
                repoIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/></svg>';
                leftPane.appendChild(repoIcon);
            } else {
                leftPane.appendChild(colorDot);
            }

            // Name
            // For parent_issue, prefer the resolved parent item's title if available, else use parentMeta
            if (resolvedParentItem) {
                // Try to extract title and status color from resolved parent
                const content = resolvedParentItem.content || (resolvedParentItem.raw && resolvedParentItem.raw.itemContent) || null;
                if (content) {
                    // title
                    try {
                        if (content.title) nameSpan.textContent = String(content.title);
                        else if (content.name) nameSpan.textContent = String(content.name);
                        else if (content.number) nameSpan.textContent = String(content.number);
                    } catch (e) { }

                    // Try to get status color from parent's fieldValues (single_select status)
                    if (Array.isArray(resolvedParentItem.fieldValues)) {
                        const statusFV = resolvedParentItem.fieldValues.find((v: any) => v && v.type === 'single_select' && v.option && v.option.name);
                        if (statusFV && statusFV.option) {
                            // If option has color, use it; otherwise try map by name
                            try {
                                const c = statusFV.option.color || statusFV.option.id || statusFV.option.name || null;
                                if (c) colorDot.style.backgroundColor = normalizeColor(c) || colorDot.style.backgroundColor;
                            } catch (e) { }
                        }
                    }
                }
            } else if (parentMeta) {
                nameSpan.textContent = parentMeta.title || parentMeta.name || parentMeta.number || parentMeta.id || nameSpan.textContent;
                if (parentMeta.color) {
                    try { colorDot.style.backgroundColor = normalizeColor(parentMeta.color) || colorDot.style.backgroundColor; } catch (e) { }
                }
            }
            leftPane.appendChild(nameSpan);

            // Count circle (placed before estimate pill)
            const countCircle = document.createElement('span');
            countCircle.style.display = 'inline-flex';
            countCircle.style.alignItems = 'center';
            countCircle.style.justifyContent = 'center';
            countCircle.style.width = '22px';
            countCircle.style.height = '22px';
            countCircle.style.borderRadius = '50%';
            countCircle.style.background = 'var(--vscode-input-background)';
            countCircle.style.border = '1px solid var(--vscode-panel-border)';
            countCircle.style.color = 'var(--vscode-foreground)';
            countCircle.style.fontSize = '12px';
            countCircle.style.fontWeight = '600';
            countCircle.style.minWidth = '22px';
            countCircle.style.boxSizing = 'border-box';
            countCircle.textContent = String(group.items.length || 0);
            leftPane.appendChild(countCircle);

            // Estimate pill and optional extra info
            const estSum = sumEstimate(group.items || []);
            if (estSum && estSum > 0) {
                const estEl = document.createElement('div');
                estEl.style.display = 'inline-block';
                estEl.style.padding = '2px 8px';
                estEl.style.borderRadius = '999px';
                estEl.style.border = '1px solid var(--vscode-panel-border)';
                estEl.style.background = 'var(--vscode-input-background)';
                estEl.style.color = 'var(--vscode-foreground)';
                estEl.style.fontSize = '12px';
                estEl.style.lineHeight = '18px';
                estEl.style.marginLeft = '8px';
                estEl.textContent = 'Estimate: ' + formatEstimate(estSum);
                // Put estimate pill into the left sticky pane so it remains visible when horizontally scrolling
                leftPane.appendChild(estEl);

                // If parent_issue, show completed/amount + progress bar (only for real parents)
                if (String(groupingField.dataType || '').toLowerCase() === 'parent_issue' && !(group.option && (group.option.name === 'Unassigned' || group.option.title === 'Unassigned'))) {
                    const completedNames = ['done', 'closed', 'completed', 'finished'];

                    // Helper: robust done detection for a single item
                    const isDoneByHeuristics = (it: any) => {
                        try {
                            const content = it && (it.content || (it.raw && it.raw.itemContent));
                            if (content) {
                                const state = (content.state || (content.merged ? 'MERGED' : undefined) || '').toString().toUpperCase();
                                if (state === 'CLOSED' || state === 'MERGED') return true;
                            }

                            if (Array.isArray(it.fieldValues)) {
                                // single_select status matching
                                const ss = it.fieldValues.find((v: any) => v && v.type === 'single_select' && v.option && v.option.name && completedNames.includes(String(v.option.name).toLowerCase()));
                                if (ss) return true;

                                // numeric percent-like or explicit done flag
                                const percentFV = it.fieldValues.find((v: any) => v && (String(v.fieldName || '').toLowerCase().includes('progress') || String(v.fieldName || '').toLowerCase().includes('percent') || v.type === 'number' && (String(v.fieldName || '').toLowerCase().includes('progress'))));
                                if (percentFV && percentFV.number != null) {
                                    const pct = Number(percentFV.number || 0);
                                    if (pct >= 100) return true;
                                }
                            }

                            if (content && (content.labels && Array.isArray(content.labels.nodes))) {
                                const labs = content.labels.nodes.map((l: any) => String(l.name || '').toLowerCase());
                                for (const cn of completedNames) if (labs.includes(cn)) return true;
                            }
                        } catch (e) { }
                        return false;
                    };

                    // Prefer parent-provided aggregate if available
                    let done = 0;
                    let total = 0;
                    if (resolvedParentItem && Array.isArray(resolvedParentItem.fieldValues)) {
                        const agg = resolvedParentItem.fieldValues.find((v: any) => v && (v.type === 'sub_issues_progress' || (v.total != null && v.done != null)));
                        if (agg && agg.total != null) {
                            total = Number(agg.total || 0);
                            done = Number(agg.done || 0);
                        }
                    }

                    // If no parent aggregate found, compute from children
                    if (!total) {
                        for (const gi of group.items) {
                            const it = gi.item || gi;
                            if (!it) continue;
                            total++;
                            if (isDoneByHeuristics(it)) done++;
                        }
                    }

                    // show completed/total BEFORE progress bar
                    const doneText = document.createElement('div');
                    doneText.style.color = 'var(--vscode-descriptionForeground)';
                    doneText.style.fontSize = '12px';
                    doneText.style.marginLeft = '8px';
                    doneText.style.fontVariantNumeric = 'tabular-nums';
                    doneText.textContent = `${done}/${total}`;
                    // Keep completed/total near the left sticky area so it stays visible
                    leftPane.appendChild(doneText);

                    // show progress bar
                    const progWrapper = document.createElement('div');
                    progWrapper.style.display = 'inline-flex';
                    progWrapper.style.alignItems = 'center';
                    progWrapper.style.gap = '8px';
                    progWrapper.style.marginLeft = '8px';
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const bar = document.createElement('div');
                    bar.style.display = 'inline-block';
                    bar.style.width = '120px';
                    bar.style.height = '12px';
                    bar.style.background = 'transparent';
                    bar.style.border = '1px solid var(--vscode-focusBorder)';
                    bar.style.borderRadius = '6px';
                    bar.style.overflow = 'hidden';
                    const fill = document.createElement('div');
                    fill.style.height = '100%';
                    fill.style.width = String(pct) + '%';
                    fill.style.background = 'var(--vscode-focusBorder)';
                    bar.appendChild(fill);
                    progWrapper.appendChild(bar);
                    // Progress bar is useful summary info — keep it in the sticky left pane
                    leftPane.appendChild(progWrapper);
                }
            }

            // Single-select: show option description if available
            if (String(groupingField.dataType || '').toLowerCase() === 'single_select') {
                try {
                    const opt = (groupingField.options || []).find((o: any) => String(o.name) === String(group.option && group.option.name));
                    if (opt && opt.description) {
                        const descEl = document.createElement('div');
                        descEl.style.color = 'var(--vscode-descriptionForeground)';
                        descEl.style.fontSize = '12px';
                        descEl.style.marginLeft = '8px';
                        descEl.textContent = String(opt.description).slice(0, 120);
                        // Keep description fixed in the left sticky pane so it remains visible
                        leftPane.appendChild(descEl);
                    }
                } catch (e) { }
            }

            // Iteration: append iteration range (start - end) if startDate/duration available, else title
            if (String(groupingField.dataType || '').toLowerCase() === 'iteration') {
                try {
                    const opt = group.option || {};
                    let iterText: string | null = null;
                    const start = opt.startDate || (opt.start && opt.startDate) || null;
                    const duration = opt.duration || opt.length || null;
                    if (start && duration) {
                        try {
                            const s = new Date(start);
                            const days = Number(duration) || 0;
                            const e = new Date(s.getTime() + days * 24 * 60 * 60 * 1000);
                            const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            iterText = `${sStr} — ${eStr}`;
                        } catch (e) { iterText = null; }
                    }
                    if (!iterText) {
                        iterText = (opt.title || opt.name) ? String(opt.title || opt.name) : null;
                    }
                    if (iterText) {
                        const iterEl = document.createElement('div');
                        iterEl.style.color = 'var(--vscode-descriptionForeground)';
                        iterEl.style.fontSize = '12px';
                        iterEl.style.marginLeft = '8px';
                        iterEl.textContent = String(iterText).slice(0, 120);
                        // Keep iteration info fixed in the left sticky pane
                        leftPane.appendChild(iterEl);
                    }
                } catch (e) { }
            }

            // If this group corresponds to 'Unassigned', rename to 'No <fieldname>'
            if (group.option && (group.option.name === 'Unassigned' || group.option.title === 'Unassigned')) {
                nameSpan.textContent = 'No ' + (groupingField.name || 'value');
            }

            // Compose header: leftPane (sticky) + rightPane (scrolling content)
            headerContent.appendChild(leftPane);
            headerContent.appendChild(rightPane);

            tdHeader.appendChild(headerContent);
            trHeader.appendChild(tdHeader);
            tbody.appendChild(trHeader);

            // Render Items
            const groupRows: HTMLTableRowElement[] = [];
            group.items.forEach((groupItem: any) => {
                const tr = this.createRow(groupItem.item, groupItem.index);
                tr.classList.add("group-row-" + group.option.id); // Add class for group toggling
                tbody.appendChild(tr);
                groupRows.push(tr);
            });

            // Toggle Logic
            let isCollapsed = false;
            toggleBtn.addEventListener("click", () => {
                isCollapsed = !isCollapsed;
                toggleBtn.innerHTML = isCollapsed ? iconCollapsed : iconExpanded;
                groupRows.forEach(row => {
                    row.style.display = isCollapsed ? "none" : "table-row";
                });
            });
        }
    }

    private groupItems(items: any[], field: any) {
        // Normalize options: Single Select uses .options, Iteration uses .configuration.iterations
        let options: any[] = [];
        const dType = (field.dataType || "").toLowerCase();
        if (dType === "single_select") {
            options = field.options || [];
        } else if (dType === "iteration") {
            options = (field.configuration && field.configuration.iterations) || [];
        }
        // If we have explicit options (single select/iteration), use them to group.
        if (options && options.length > 0) {
            const groups: any[] = options.map((opt: any) => ({ option: opt, items: [] }));
            const unassigned: any[] = [];

            items.forEach((item, index) => {
                const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(field.id) || v.fieldName === field.name);
                let placed = false;

                if (fv) {
                    // Match logic
                    let matchId: string | null = null;
                    let matchName: string | null = null;

                    if (dType === "single_select") {
                        matchId = fv.optionId || (fv.option && fv.option.id);
                        matchName = fv.name || (fv.option && fv.option.name);
                    } else if (dType === "iteration") {
                        matchId = fv.iterationId || (fv.iteration && fv.iteration.id) || fv.id;
                        matchName = fv.title || (fv.iteration && fv.iteration.title);
                    }

                    if (matchId || matchName) {
                        const group = groups.find((g: any) =>
                            (matchId && String(g.option.id) === String(matchId)) ||
                            (matchName && (String(g.option.name) === String(matchName) || String(g.option.title) === String(matchName)))
                        );
                        if (group) {
                            group.items.push({ item, index });
                            placed = true;
                        }
                    }
                }

                if (!placed) {
                    unassigned.push({ item, index });
                }
            });

            if (unassigned.length > 0) {
                groups.push({ option: { name: "Unassigned", title: "Unassigned", color: "GRAY" }, items: unassigned });
            }

            return groups.filter((g: any) => g.items.length > 0);
        }

        // Fallback grouping: build groups based on actual item values (useful for assignees, repository, date, number, etc.)
        const map = new Map<string, { option: any, items: any[] }>();
        const unassignedFallback: any[] = [];

        items.forEach((item, index) => {
            const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(field.id) || v.fieldName === field.name);
            let val: any = null;
            if (fv) {
                // Text/title/number/date straightforward
                if (fv.text !== undefined) val = fv.text;
                else if (fv.title !== undefined) val = fv.title;
                else if (fv.number !== undefined) val = fv.number;
                else if (fv.date !== undefined) val = fv.date;
                // single_select / option
                else if (fv.option) val = fv.option.name || fv.option.title || fv.option.id;
                // iteration
                else if (fv.iteration) val = fv.iteration.title || fv.iteration.id;
                // parent_issue - try parent/parentIssue/issue/item/value/raw
                else if (fv.parent || fv.parentIssue || fv.issue || fv.item || fv.value) {
                    const p = fv.parent || fv.parentIssue || fv.issue || fv.item || fv.value;
                    if (p) {
                        // Prefer number, then id, then url, then title
                        val = p.number || p.id || (p.raw && (p.raw.number || p.raw.id)) || p.url || p.title || p.name || null;
                    }
                }
                // assignees
                else if (fv.assignees) val = Array.isArray(fv.assignees) ? fv.assignees.map((a: any) => a.login || a.name).join(", ") : fv.assignees;
                // repository
                else if (fv.repository) val = fv.repository.nameWithOwner || fv.repository.name || fv.repository.full_name || fv.repository.id;
                // milestone
                else if (fv.milestone) val = fv.milestone.title || fv.milestone.id || fv.milestone.name;
                else val = fv.value !== undefined ? fv.value : null;
            }

            if (val === null || val === undefined || val === "") {
                unassignedFallback.push({ item, index });
                return;
            }

            const key = String(val);
            if (!map.has(key)) {
                map.set(key, { option: { id: key, name: key, title: key }, items: [] });
            }
            map.get(key)!.items.push({ item, index });
        });

        const groupsArr = Array.from(map.values());
        if (unassignedFallback.length > 0) {
            groupsArr.push({ option: { name: "Unassigned", title: "Unassigned", color: "GRAY" }, items: unassignedFallback });
        }

        return groupsArr;
    }

    private createRow(item: any, index: number): HTMLTableRowElement {
        const tr = document.createElement("tr");
        tr.setAttribute("data-gh-item-id", item.id);

        // Add row hover effect
        tr.style.transition = "background-color 0.15s ease";
        tr.addEventListener('mouseenter', () => {
            tr.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
        });
        tr.addEventListener('mouseleave', () => {
            tr.style.backgroundColor = 'transparent';
        });

        // Index Cell
        const tdIndex = document.createElement("td");
        tdIndex.textContent = String(index + 1);
        this.styleCell(tdIndex);
        tr.appendChild(tdIndex);

        // Field Cells
        for (let colIndex = 0; colIndex < this.fields.length; colIndex++) {
            const field = this.fields[colIndex];
            const td = document.createElement("td");
            this.styleCell(td);

            const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(field.id) || v.fieldName === field.name);
            if (fv) {
                td.innerHTML = renderCell(fv, field, item, this.items);
            }

            // Make td position relative so we can position a resizer inside it
            td.style.position = 'relative';

            // Add a small resizer handle to every cell so columns can be resized from any row
            const cellResizer = document.createElement('div');
            cellResizer.className = 'column-resizer';
            cellResizer.style.position = 'absolute';
            cellResizer.style.top = '0';
            cellResizer.style.right = '0';
            cellResizer.style.width = '6px';
            cellResizer.style.height = '100%';
            cellResizer.style.cursor = 'col-resize';
            cellResizer.style.userSelect = 'none';
            cellResizer.style.zIndex = '50';

            cellResizer.addEventListener('mouseenter', () => cellResizer.style.background = 'var(--vscode-focusBorder)');
            cellResizer.addEventListener('mouseleave', () => cellResizer.style.background = 'transparent');

            cellResizer.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const table = this.container.querySelector('table') as HTMLTableElement | null;
                if (!table) return;
                const cols = table.querySelectorAll('col');
                const col = cols[colIndex + 1] as HTMLTableColElement | undefined; // +1 for index column
                const startWidth = col ? (parseInt(col.style.width) || col.offsetWidth) : (td.offsetWidth);
                this.beginColumnResize(table, colIndex + 1, e.pageX, startWidth);
            });

            td.appendChild(cellResizer);
            tr.appendChild(td);
        }

        return tr;
    }

    private styleCell(td: HTMLTableCellElement) {
        td.style.padding = "8px";
        td.style.borderRight = "1px solid var(--vscode-panel-border)";
        td.style.borderBottom = "1px solid var(--vscode-panel-border)";
        td.style.whiteSpace = "nowrap";
        td.style.overflow = "hidden";
        td.style.textOverflow = "ellipsis";
    }

    private showHeaderMenu(event: MouseEvent, field: any, headerElement: HTMLElement) {
        event.stopPropagation();

        // Hide existing menu
        if (this.activeMenu) {
            this.activeMenu.hide();
        }

        // Determine capabilities based on field type
        const dataType = (field.dataType || '').toLowerCase();
        // Mapping of GitHub ProjectV2 field data types to allowed operations
        // Groupable: assignees, single_select, parent_issue, iteration, number, date, milestone, repository
        const groupableTypes = new Set([
            'assignees',
            'single_select',
            'parent_issue',
            'iteration',
            'number',
            'date',
            'milestone',
            'repository'
        ]);

        // Sliceable: same as groupable, plus labels (multi-value) which can be sliced but not grouped
        const sliceableTypes = new Set([
            'assignees',
            'single_select',
            'parent_issue',
            'iteration',
            'number',
            'date',
            'milestone',
            'repository',
            'labels'
        ]);

        const canGroup = groupableTypes.has(dataType);
        const canSlice = sliceableTypes.has(dataType);

        // Determine current state (grouped/sliced/sorted)
        const isGrouped = !!(this.options.groupingFieldName && field.name && field.name.toLowerCase() === this.options.groupingFieldName.toLowerCase());
        const isSliced = !!((this.activeSlice && this.activeSlice.fieldId === field.id) || (this.activeSlicePanelFieldId && String(this.activeSlicePanelFieldId) === String(field.id)));
        const currentSort = (this.options.sortConfig && this.options.sortConfig.fieldId === field.id) ? this.options.sortConfig.direction : null;

        // Create and show menu
        const fieldIndex = this.fields.findIndex(f => f.id === field.id);
        const isFirst = fieldIndex === 0;
        const isLast = fieldIndex === this.fields.length - 1;

        this.activeMenu = new ColumnHeaderMenu(field, {
            canGroup,
            canSlice,
            canFilter: false, // Optional feature for later
            isGrouped,
            isSliced,
            currentSort,
            isFirst,
            isLast,
            onSort: (direction) => this.handleSort(field, direction),
            onClearSort: () => this.clearSort(field),
            onGroup: () => this.handleGroup(field),
            onClearGroup: () => this.clearGroup(field),
            onSlice: () => this.handleSlice(field),
            onClearSlice: () => this.clearSlice(field),
            onHide: () => this.hideField(field.id),
            onMove: (direction) => this.handleMove(field, direction)
        });

        this.activeMenu.show(headerElement);
    }

    private clearGroup(field: any) {
        // Clear local grouping state and notify parent
        this.options.groupingFieldName = undefined;
        if (this.options.onGroupChange) {
            try {
                // Notify parent that grouping was cleared
                this.options.onGroupChange('');
            } catch (e) { }
        }
        this.render();
    }

    private clearSlice(field: any) {
        this.activeSlice = null;
        if (this.activeSlicePanel) {
            this.activeSlicePanel.close();
            this.activeSlicePanel = null;
        }
        this.activeSlicePanelFieldId = null;
        // Reset container layout
        this.container.style.display = 'block';
        this.render();
        if (this.options.onSliceChange) {
            this.options.onSliceChange(null as any);
        }
    }

    private clearSort(field: any) {
        // Remove sort from storage and options; notify parent
        const key = this.getStorageKey('sortConfig');
        if (key) localStorage.removeItem(key);
        if (this.options.onSortChange) {
            this.options.onSortChange(null as any);
        }
    }

    private showHiddenFieldsMenu(anchorElement: HTMLElement) {
        // Hide any existing menu
        if (this.activeMenu) {
            this.activeMenu.hide();
        }

        // Get hidden fields
        const hiddenFields = this.allFields.filter(f => this.hiddenFieldIds.has(String(f.id)));

        if (hiddenFields.length === 0) {
            // Show message that no fields are hidden
            const message = document.createElement('div');
            message.textContent = 'No hidden fields';
            message.style.position = 'absolute';
            message.style.background = 'var(--vscode-menu-background)';
            message.style.border = '1px solid var(--vscode-menu-border)';
            message.style.borderRadius = '4px';
            message.style.padding = '12px';
            message.style.fontSize = '13px';
            message.style.color = 'var(--vscode-descriptionForeground)';
            message.style.zIndex = '1000';

            const rect = anchorElement.getBoundingClientRect();
            message.style.top = `${rect.bottom + 4}px`;
            message.style.left = `${rect.left}px`;

            document.body.appendChild(message);

            setTimeout(() => message.remove(), 2000);
            return;
        }

        // Create simple menu for hidden fields
        const menu = document.createElement('div');
        menu.style.position = 'absolute';
        menu.style.background = 'var(--vscode-menu-background)';
        menu.style.border = '1px solid var(--vscode-menu-border)';
        menu.style.borderRadius = '4px';
        menu.style.padding = '4px 0';
        menu.style.minWidth = '180px';
        menu.style.zIndex = '1000';
        menu.style.fontSize = '13px';

        const rect = anchorElement.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${rect.left}px`;

        // Header
        const header = document.createElement('div');
        header.textContent = 'Show field';
        header.style.padding = '6px 12px';
        header.style.fontWeight = '600';
        header.style.color = 'var(--vscode-descriptionForeground)';
        header.style.fontSize = '11px';
        header.style.textTransform = 'uppercase';
        menu.appendChild(header);

        const separator = document.createElement('div');
        separator.style.height = '1px';
        separator.style.background = 'var(--vscode-menu-separatorBackground)';
        separator.style.margin = '4px 0';
        menu.appendChild(separator);

        // Field items
        hiddenFields.forEach(field => {
            const item = document.createElement('div');
            item.textContent = field.name || field.id;
            item.style.padding = '6px 12px';
            item.style.cursor = 'pointer';
            item.style.color = 'var(--vscode-menu-foreground)';

            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--vscode-menu-selectionBackground)';
                item.style.color = 'var(--vscode-menu-selectionForeground)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
                item.style.color = 'var(--vscode-menu-foreground)';
            });

            item.addEventListener('click', () => {
                this.showField(field.id);
                menu.remove();
                backdrop.remove();
            });

            menu.appendChild(item);
        });

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.right = '0';
        backdrop.style.bottom = '0';
        backdrop.style.zIndex = '999';

        // Clicking the backdrop closes the menu
        backdrop.addEventListener('click', () => {
            if (menu.parentElement) menu.remove();
            if (backdrop.parentElement) backdrop.remove();
        });

        // Append to body
        document.body.appendChild(menu);
        document.body.appendChild(backdrop);

        // End of showHiddenFieldsMenu
    }

    private handleSort(field: any, direction: 'ASC' | 'DESC') {
        const sortConfig: SortConfig = {
            fieldId: field.id,
            direction
        };

        // Save to localStorage
        this.saveSortConfig(sortConfig);

        // Notify parent component
        if (this.options.onSortChange) {
            this.options.onSortChange(sortConfig);
        }
    }

    private handleGroup(field: any) {
        // Update local grouping state so the UI reflects the change immediately
        if (field && field.name) {
            this.options.groupingFieldName = field.name;
            this.render();
            if (this.options.onGroupChange) {
                try {
                    this.options.onGroupChange(field.name);
                } catch (e) { }
            }
        }
    }

    private handleSlice(field: any) {
        // Close existing panel
        if (this.activeSlicePanel) {
            this.activeSlicePanel.close();
            this.activeSlicePanel = null;
        }

        // Create and show new panel in the container (left side)
        this.activeSlicePanel = new SlicePanel(this.container, field, this.items, this.allFields);
        this.activeSlicePanel.render();
        // Remember which field the panel belongs to so header menu can show an "unslice" button
        try { this.activeSlicePanelFieldId = String(field.id); } catch (e) { this.activeSlicePanelFieldId = null; }

        // Make sure the slice panel appears before the table wrapper
        const tableWrapper = this.container.querySelector('.table-wrapper');
        if (tableWrapper) {
            const sliceEl = this.container.querySelector('.slice-panel');
            if (sliceEl) {
                this.container.insertBefore(sliceEl, tableWrapper);
            }
        }

        // Setup layout: container should use flexbox to show panel + table side by side
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'row';
        this.container.style.gap = '0';

        // Re-render so header reflects the active slice panel (shows slice icon)
        // We preserve the existing slice panel in render(), so this is safe.
        this.render();

        this.activeSlicePanel.onValueSelect((value) => {
            // Filter table by this value
            this.activeSlice = { fieldId: field.id, value };
            this.render();
        });

        // Handle field change
        this.activeSlicePanel.onFieldChange((newField) => {
            // Update active slice field
            this.activeSlice = null; // Reset slice value when changing field
            this.handleSlice(newField); // Re-render with new field

            // Notify parent
            if (this.options.onSliceChange) {
                this.options.onSliceChange(newField);
            }
        });

        // Notify parent
        if (this.options.onSliceChange) {
            this.options.onSliceChange(field);
        }
    }

    public hideField(fieldId: string) {
        const fid = String(fieldId);
        this.hiddenFieldIds.add(fid);
        try { console.debug('[ProjectTable] hideField -> added', fid, 'hiddenFieldIds=', Array.from(this.hiddenFieldIds)); } catch (e) { }
        // If a parent callback is provided (e.g. tableViewFetcher managing Save/Discard),
        // notify it instead of immediately persisting to localStorage. This allows hide/unhide
        // to be treated as an unsaved view-level change which can be saved/discarded by the user.
        if (this.options.onHiddenFieldsChange) {
            // update in-memory state and notify parent (do not persist to localStorage yet)
            this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
            // Re-apply stored field order so the UI appears consistent after toggling
            try { this.applyFieldOrder(); } catch (e) { }
            try { this.options.onHiddenFieldsChange(Array.from(this.hiddenFieldIds)); } catch (e) { }
            this.render();
        } else {
            this.saveHiddenFields();
            this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
            try { this.applyFieldOrder(); } catch (e) { }
            this.render();
        }
    }

    public showField(fieldId: string) {
        const fid = String(fieldId);
        this.hiddenFieldIds.delete(fid);
        try { console.debug('[ProjectTable] showField -> removed', fid, 'hiddenFieldIds=', Array.from(this.hiddenFieldIds)); } catch (e) { }
        if (this.options.onHiddenFieldsChange) {
            this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
            try { this.applyFieldOrder(); } catch (e) { }
            try { this.options.onHiddenFieldsChange(Array.from(this.hiddenFieldIds)); } catch (e) { }
            this.render();
        } else {
            this.saveHiddenFields();
            this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
            try { this.applyFieldOrder(); } catch (e) { }
            this.render();
        }
    }

    private handleMove(field: any, direction: 'left' | 'right') {
        const currentIndex = this.fields.findIndex(f => f.id === field.id);

        if (direction === 'left' && currentIndex > 0) {
            // Swap with previous
            [this.fields[currentIndex], this.fields[currentIndex - 1]] =
                [this.fields[currentIndex - 1], this.fields[currentIndex]];
        } else if (direction === 'right' && currentIndex < this.fields.length - 1) {
            // Swap with next
            [this.fields[currentIndex], this.fields[currentIndex + 1]] =
                [this.fields[currentIndex + 1], this.fields[currentIndex]];
        }

        this.saveFieldOrder();
        this.render();
    }

    // LocalStorage persistence methods
    private getStorageKey(suffix: string): string {
        return this.options.viewKey ? `ghProjects.table.${this.options.viewKey}.${suffix}` : '';
    }

    private loadHiddenFields(): string[] {
        const key = this.getStorageKey('hiddenFields');
        if (!key) return [];

        try {
            const stored = localStorage.getItem(key);
            const arr = stored ? JSON.parse(stored) : [];
            // Normalize stored ids to strings
            const normalized = (arr || []).map((id: any) => String(id));
            try { console.debug('[ProjectTable] loadHiddenFields ->', normalized); } catch (e) { }
            return normalized;
        } catch (e) {
            return [];
        }
    }

    private saveHiddenFields() {
        const key = this.getStorageKey('hiddenFields');
        if (!key) return;

        const arr = Array.from(this.hiddenFieldIds).map(id => String(id));
        try { console.debug('[ProjectTable] saveHiddenFields ->', arr); } catch (e) { }
        localStorage.setItem(key, JSON.stringify(arr));
    }

    private saveSortConfig(config: SortConfig) {
        const key = this.getStorageKey('sortConfig');
        if (!key) return;

        localStorage.setItem(key, JSON.stringify(config));
    }

    private saveFieldOrder() {
        const key = this.getStorageKey('fieldOrder');
        if (!key) return;

        const order = this.fields.map(f => f.id);
        localStorage.setItem(key, JSON.stringify(order));
    }

    private applyFieldOrder() {
        const key = this.getStorageKey('fieldOrder');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            if (!stored) return;

            const order: string[] = JSON.parse(stored);
            const orderedFields: any[] = [];

            // Add fields in stored order
            for (const fieldId of order) {
                const field = this.fields.find(f => String(f.id) === String(fieldId));
                if (field) {
                    orderedFields.push(field);
                }
            }

            // Add any new fields not in stored order
            for (const field of this.fields) {
                if (!orderedFields.find(f => f.id === field.id)) {
                    orderedFields.push(field);
                }
            }

            this.fields = orderedFields;
        } catch (e) {
            // Ignore errors, use default order
        }
    }

    private setupResizers(table: HTMLTableElement) {
        const headers = table.querySelectorAll('th');

        headers.forEach((th, index) => {
            // Skip index column
            if (index === 0) return;

            // Create resizer element
            const resizer = document.createElement('div');
            resizer.className = 'column-resizer';
            resizer.style.position = 'absolute';
            resizer.style.top = '0';
            resizer.style.right = '0';
            resizer.style.width = '4px';
            resizer.style.height = '100%';
            resizer.style.cursor = 'col-resize';
            resizer.style.userSelect = 'none';
            resizer.style.zIndex = '100';

            // Visual feedback on hover
            resizer.addEventListener('mouseenter', () => {
                resizer.style.background = 'var(--vscode-focusBorder)';
            });

            resizer.addEventListener('mouseleave', () => {
                resizer.style.background = 'transparent';
            });

            // Resize logic
            let startX = 0;
            let startWidth = 0;

            resizer.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const cols = table.querySelectorAll('col');
                const col = cols[index] as HTMLTableColElement | undefined; // index aligns with th
                const startW = col ? (parseInt(col.style.width) || col.offsetWidth) : th.offsetWidth;
                this.beginColumnResize(table, index, e.pageX, startW);
            });

            // Make th position relative for absolute positioning
            (th as HTMLElement).style.position = 'relative';
            th.appendChild(resizer);
        });

        // Restore column widths from localStorage
        this.restoreColumnWidths(table);
    }

    private saveColumnWidth(fieldId: string, width: number) {
        const key = this.getStorageKey('columnWidths');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            const widths = stored ? JSON.parse(stored) : {};
            widths[fieldId] = width;
            localStorage.setItem(key, JSON.stringify(widths));
        } catch (e) { }
    }

    /**
     * Centralized column resizing logic. `colIndex` is the index into the <col> nodeList
     * (including the index column at 0).
     */
    private beginColumnResize(table: HTMLTableElement, colIndex: number, startX: number, startWidth: number) {
        const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(20, startWidth + (e.pageX - startX));
            const cols = table.querySelectorAll('col');
            const col = cols[colIndex] as HTMLTableColElement | undefined;
            if (col) {
                col.style.width = `${newWidth}px`;
                col.style.minWidth = `${newWidth}px`;
                col.style.maxWidth = `${newWidth}px`;
            }
        };

        const onMouseUp = (e?: MouseEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Save mapping to field id (colIndex - 1 => fields)
            const fieldIndex = colIndex - 1;
            if (fieldIndex >= 0 && fieldIndex < this.fields.length) {
                const cols = table.querySelectorAll('col');
                const col = cols[colIndex] as HTMLTableColElement | undefined;
                const widthToSave = col ? (parseInt(col.style.width) || col.offsetWidth) : undefined;
                if (widthToSave) {
                    this.saveColumnWidth(this.fields[fieldIndex].id, widthToSave);
                }
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private restoreColumnWidths(table: HTMLTableElement) {
        const key = this.getStorageKey('columnWidths');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            if (!stored) return;

            const widths = JSON.parse(stored);
            const cols = table.querySelectorAll('col');

            this.fields.forEach((field, index) => {
                const width = widths[field.id];
                if (width) {
                    const col = cols[index + 1] as HTMLTableColElement; // +1 for index column
                    if (col) {
                        col.style.width = `${width}px`;
                        col.style.minWidth = `${width}px`;
                        col.style.maxWidth = `${width}px`;
                    }
                }
            });
        } catch (e) { }
    }
}
