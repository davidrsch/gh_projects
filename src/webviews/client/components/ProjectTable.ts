import { renderCell } from "../renderers/cellRenderer";
import { normalizeColor, getContrastColor } from "../utils";

export class ProjectTable {
    private container: HTMLElement;
    private fields: any[];
    private items: any[];
    private options: any;

    constructor(container: HTMLElement, fields: any[], items: any[], options: any = {}) {
        this.container = container;
        this.fields = fields;
        this.items = items;
        this.options = options;
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
            th.textContent = field.name || field.id || "";
            this.styleHeaderCell(th);
            tr.appendChild(th);
        }

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
                (f.name && f.name.toLowerCase() === this.options.groupingFieldName.toLowerCase()) ||
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
            tdHeader.style.background = "var(--vscode-sideBar-background)";
            tdHeader.style.fontWeight = "600";
            tdHeader.style.borderTop = "1px solid var(--vscode-editorGroup-border)";
            tdHeader.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";

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

    private setupResizers(table: HTMLTableElement) {
        // ... (Resizer logic) ...
        // Can be copied from original or implemented cleanly
    }
}
