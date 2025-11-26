import { renderCell } from "../renderers/cellRenderer";
import { normalizeColor, getContrastColor } from "../utils";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { SlicePanel } from "./SlicePanel";
import type { SortConfig } from "../utils/tableSorting";

export interface TableOptions {
    groupingFieldName?: string;
    sortConfig?: SortConfig | null;
    viewKey?: string;
    hiddenFields?: string[];
    onSortChange?: (config: SortConfig) => void;
    onGroupChange?: (fieldName: string) => void;
    onSliceChange?: (field: any) => void;
}

export class ProjectTable {
    private container: HTMLElement;
    private allFields: any[]; // All fields including hidden
    private fields: any[]; // Visible fields only
    private items: any[];
    private options: TableOptions;
    private hiddenFieldIds: Set<string>;
    private activeMenu: ColumnHeaderMenu | null = null;
    private activeSlicePanel: SlicePanel | null = null;

    constructor(container: HTMLElement, fields: any[], items: any[], options: TableOptions = {}) {
        this.container = container;
        this.allFields = fields;
        this.options = options;
        this.items = items;

        // Load hidden fields from options or localStorage
        const hiddenFromStorage = this.loadHiddenFields();
        const hiddenFromOptions = options.hiddenFields || [];
        this.hiddenFieldIds = new Set([...hiddenFromStorage, ...hiddenFromOptions]);

        // Filter visible fields
        this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));

        // Load and apply field order if stored
        this.applyFieldOrder();
    }

    public render() {
        this.container.innerHTML = "";

        const tableContainer = document.createElement("div");
        tableContainer.style.overflowX = "auto";
        tableContainer.style.overflowY = "auto";
        tableContainer.style.width = "100%";
        tableContainer.style.display = "block";
        tableContainer.style.height = "100%"; // Let it grow

        const table = document.createElement("table");
        table.style.borderCollapse = "separate";
        table.style.borderSpacing = "0";
        table.style.tableLayout = "fixed";
        table.style.width = "max-content";

        this.renderColGroup(table);
        this.renderHeader(table);
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
            colgroup.appendChild(col);
        }

        // Add Field column
        const colAddField = document.createElement("col");
        colAddField.style.width = "50px";
        colgroup.appendChild(colAddField);

        table.appendChild(colgroup);
    }

    private renderHeader(table: HTMLTableElement) {
        const thead = document.createElement("thead");
        thead.style.background = "var(--vscode-editor-background)";
        thead.style.position = "sticky";
        thead.style.top = "0";
        thead.style.zIndex = "10";

        const tr = document.createElement("tr");

        // Index Header
        const thIndex = document.createElement("th");
        thIndex.textContent = "#";
        this.styleHeaderCell(thIndex);
        tr.appendChild(thIndex);

        // Field Headers
        for (const field of this.fields) {
            const th = document.createElement("th");

            // Create header content wrapper
            const headerContent = document.createElement('div');
            headerContent.style.display = 'flex';
            headerContent.style.alignItems = 'center';
            headerContent.style.justifyContent = 'space-between';
            headerContent.style.width = '100%';
            headerContent.style.gap = '4px';

            // Field name span
            const nameSpan = document.createElement('span');
            let headerText = field.name || field.id || "";

            // Add sort indicator if this field is sorted
            if (this.options.sortConfig?.fieldId === field.id) {
                const indicator = this.options.sortConfig?.direction === 'ASC' ? ' ↑' : ' ↓';
                headerText += indicator;
            }

            nameSpan.textContent = headerText;
            nameSpan.style.flex = '1';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.whiteSpace = 'nowrap';

            // Check if this field is grouped
            const isGrouped = field.name?.toLowerCase() === this.options.groupingFieldName?.toLowerCase();

            // Check if this field is being sliced (we'll add this state later)
            const isSliced = false; // TODO: Track active slice field

            // Icons container (for filter/group indicators)
            const iconsContainer = document.createElement('span');
            iconsContainer.style.display = 'flex';
            iconsContainer.style.alignItems = 'center';
            iconsContainer.style.gap = '2px';

            // Add filter/funnel icon if grouped or sliced
            if (isGrouped || isSliced) {
                const filterIcon = document.createElement('span');
                filterIcon.textContent = '▼'; // Down arrow
                filterIcon.style.fontSize = '10px';
                filterIcon.style.color = 'var(--vscode-foreground)';
                filterIcon.style.opacity = '0.7';
                filterIcon.title = isGrouped ? 'Grouped by this field' : 'Sliced by this field';
                iconsContainer.appendChild(filterIcon);
            }

            // Menu button (⋮)
            const menuBtn = document.createElement('button');
            menuBtn.textContent = '⋮';
            menuBtn.style.background = 'transparent';
            menuBtn.style.border = 'none';
            menuBtn.style.cursor = 'pointer';
            menuBtn.style.fontSize = '16px';
            menuBtn.style.padding = '2px 4px';
            menuBtn.style.color = 'var(--vscode-foreground)';
            menuBtn.style.opacity = '0.6';
            menuBtn.style.borderRadius = '3px';
            menuBtn.title = `${field.name} options`;

            // Hover effects
            menuBtn.addEventListener('mouseenter', () => {
                menuBtn.style.opacity = '1';
                menuBtn.style.background = 'var(--vscode-toolbar-hoverBackground)';
            });

            menuBtn.addEventListener('mouseleave', () => {
                menuBtn.style.opacity = '0.6';
                menuBtn.style.background = 'transparent';
            });

            // Click handler for menu
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showHeaderMenu(e, field, th);
            });

            headerContent.appendChild(nameSpan);
            // Add icon indicator BETWEEN name and menu (only if grouped/sliced)
            if (isGrouped || isSliced) {
                headerContent.appendChild(iconsContainer);
            }
            headerContent.appendChild(menuBtn);
            th.appendChild(headerContent);

            // Header hover state
            th.addEventListener('mouseenter', () => {
                th.style.background = 'var(--vscode-list-hoverBackground)';
            });

            th.addEventListener('mouseleave', () => {
                th.style.background = 'var(--vscode-editor-background)';
            });

            this.styleHeaderCell(th);
            tr.appendChild(th);
        }

        // Add Field column (+)
        const thAddField = document.createElement("th");
        const addFieldBtn = document.createElement('button');
        addFieldBtn.textContent = '+';
        addFieldBtn.style.background = 'transparent';
        addFieldBtn.style.border = 'none';
        addFieldBtn.style.cursor = 'pointer';
        addFieldBtn.style.fontSize = '18px';
        addFieldBtn.style.fontWeight = 'bold';
        addFieldBtn.style.color = 'var(--vscode-foreground)';
        addFieldBtn.style.width = '100%';
        addFieldBtn.style.height = '100%';
        addFieldBtn.title = 'Show hidden fields';

        addFieldBtn.addEventListener('click', () => this.showHiddenFieldsMenu(addFieldBtn));

        thAddField.appendChild(addFieldBtn);
        this.styleHeaderCell(thAddField);
        thAddField.style.textAlign = 'center';
        thAddField.style.width = '50px';
        tr.appendChild(thAddField);

        thead.appendChild(tr);
        table.appendChild(thead);
    }

    private styleHeaderCell(th: HTMLTableCellElement) {
        th.style.padding = "6px";
        th.style.textAlign = "left";
        th.style.whiteSpace = "nowrap";
        th.style.overflow = "hidden";
        th.style.textOverflow = "ellipsis";
        th.style.borderRight = "1px solid var(--vscode-editorGroup-border)";
        th.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";
        th.style.position = "sticky";
        th.style.top = "0";
        th.style.zIndex = "11";
        th.style.background = "var(--vscode-editor-background)";
        th.style.height = "32px"; // Enforce fixed height
        th.style.boxSizing = "border-box";
    }

    private renderBody(table: HTMLTableElement) {
        const tbody = document.createElement("tbody");

        // Check for grouping
        const groupingField = this.getGroupingField();

        if (groupingField) {
            this.renderGroupedRows(tbody, groupingField);
        } else {
            this.renderFlatRows(tbody, this.items);
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

    private renderGroupedRows(tbody: HTMLTableSectionElement, groupingField: any) {
        // Group items
        const groups = this.groupItems(this.items, groupingField);

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

            // Toggle Button
            const toggleBtn = document.createElement("vscode-button");
            toggleBtn.setAttribute("appearance", "icon");
            toggleBtn.textContent = "-"; // Use icon if available
            toggleBtn.style.width = "20px";
            toggleBtn.style.height = "20px";
            toggleBtn.style.cursor = "pointer";

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

            headerContent.appendChild(toggleBtn);
            headerContent.appendChild(colorDot);
            headerContent.appendChild(nameSpan);
            headerContent.appendChild(countBadge);

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
            toggleBtn.addEventListener("click", () => {
                const isCollapsed = toggleBtn.textContent === "+";
                toggleBtn.textContent = isCollapsed ? "-" : "+";
                groupRows.forEach(row => {
                    row.style.display = isCollapsed ? "table-row" : "none";
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

        const groups: any[] = options.map((opt: any) => ({ option: opt, items: [] }));
        const unassigned: any[] = [];

        items.forEach((item, index) => {
            const fv = item.fieldValues.find((v: any) => v.fieldId === field.id || v.fieldName === field.name);
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
                        (matchId && g.option.id === matchId) ||
                        (matchName && (g.option.name === matchName || g.option.title === matchName))
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

    private createRow(item: any, index: number): HTMLTableRowElement {
        const tr = document.createElement("tr");
        tr.setAttribute("data-gh-item-id", item.id);

        // Index Cell
        const tdIndex = document.createElement("td");
        tdIndex.textContent = String(index + 1);
        this.styleCell(tdIndex);
        tr.appendChild(tdIndex);

        // Field Cells
        for (const field of this.fields) {
            const td = document.createElement("td");
            this.styleCell(td);

            const fv = item.fieldValues.find((v: any) => v.fieldId === field.id || v.fieldName === field.name);
            if (fv) {
                td.innerHTML = renderCell(fv, field, item, this.items);
            }
            tr.appendChild(td);
        }

        return tr;
    }

    private styleCell(td: HTMLTableCellElement) {
        td.style.padding = "6px";
        td.style.borderRight = "1px solid var(--vscode-editorGroup-border)";
        td.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";
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
        const canGroup = ['single_select', 'iteration'].includes(dataType);
        const canSlice = (field.name?.toLowerCase() || '') !== 'title';

        // Create and show menu
        this.activeMenu = new ColumnHeaderMenu(field, {
            canGroup,
            canSlice,
            canFilter: false, // Optional feature for later
            onSort: (direction) => this.handleSort(field, direction),
            onGroup: () => this.handleGroup(field),
            onSlice: () => this.handleSlice(field),
            onHide: () => this.hideField(field.id),
            onMove: (direction) => this.handleMove(field, direction)
        });

        this.activeMenu.show(headerElement);
    }

    private showHiddenFieldsMenu(anchorElement: HTMLElement) {
        // Hide any existing menu
        if (this.activeMenu) {
            this.activeMenu.hide();
        }

        // Get hidden fields
        const hiddenFields = this.allFields.filter(f => this.hiddenFieldIds.has(f.id));

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
        backdrop.addEventListener('click', () => {
            menu.remove();
            backdrop.remove();
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
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
        if (this.options.onGroupChange && field.name) {
            this.options.onGroupChange(field.name);
        }
    }

    private handleSlice(field: any) {
        // Close existing panel
        if (this.activeSlicePanel) {
            this.activeSlicePanel.close();
            this.activeSlicePanel = null;
        }

        // Create and show new panel in the table container (left side)
        this.activeSlicePanel = new SlicePanel(this.container, field, this.items);
        this.activeSlicePanel.render();

        // Make sure the slice panel appears before the table
        const table = this.container.querySelector('table');
        if (table) {
            const sliceEl = this.container.querySelector('.slice-panel');
            if (sliceEl) {
                this.container.insertBefore(sliceEl, table);
            }
        }

        this.activeSlicePanel.onValueSelect((value) => {
            // Filter table by this value
            // TODO: Integrate with filter bar for proper filtering
            console.log(`Filter by ${field.name}:`, value);
        });

        // Notify parent
        if (this.options.onSliceChange) {
            this.options.onSliceChange(field);
        }
    }

    public hideField(fieldId: string) {
        this.hiddenFieldIds.add(fieldId);
        this.saveHiddenFields();
        this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
        this.render();
    }

    public showField(fieldId: string) {
        this.hiddenFieldIds.delete(fieldId);
        this.saveHiddenFields();
        this.fields = this.allFields.filter(f => !this.hiddenFieldIds.has(f.id));
        this.render();
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
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    private saveHiddenFields() {
        const key = this.getStorageKey('hiddenFields');
        if (!key) return;

        localStorage.setItem(key, JSON.stringify(Array.from(this.hiddenFieldIds)));
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
                const field = this.fields.find(f => f.id === fieldId);
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

                startX = e.pageX;
                startWidth = th.offsetWidth;

                const onMouseMove = (e: MouseEvent) => {
                    const newWidth = Math.max(50, startWidth + (e.pageX - startX));
                    th.style.width = `${newWidth}px`;
                    th.style.minWidth = `${newWidth}px`;
                    th.style.maxWidth = `${newWidth}px`;
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    // Save column width
                    const fieldIndex = index - 1; // Adjust for index column
                    if (fieldIndex >= 0 && fieldIndex < this.fields.length) {
                        this.saveColumnWidth(this.fields[fieldIndex].id, th.offsetWidth);
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
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

    private restoreColumnWidths(table: HTMLTableElement) {
        const key = this.getStorageKey('columnWidths');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            if (!stored) return;

            const widths = JSON.parse(stored);
            const headers = table.querySelectorAll('th');

            this.fields.forEach((field, index) => {
                const width = widths[field.id];
                if (width) {
                    const th = headers[index + 1] as HTMLElement; // +1 for index column
                    if (th) {
                        th.style.width = `${width}px`;
                        th.style.minWidth = `${width}px`;
                        th.style.maxWidth = `${width}px`;
                    }
                }
            });
        } catch (e) { }
    }
}
