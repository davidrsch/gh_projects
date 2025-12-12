import { renderCell } from "../renderers/cellRenderer";
import { EditorManager } from "../editors/EditorManager";

export class RowRenderer {
  private editorManager: EditorManager | null = null;

  constructor(
    private fields: any[],
    private allItems: any[],
    private onResizeStart: (
      colIndex: number,
      pageX: number,
      startWidth: number,
    ) => void,

    // From copilot/implement-interactive-table-cells
    private onCellRendered?: (
      cell: HTMLElement,
      field: any,
      item: any,
      fieldValue: any,
    ) => void,

    // From main branch
    private projectId?: string,
    private viewKey?: string,
  ) {
    // Initialize EditorManager when possible
    if (projectId && viewKey) {
      this.editorManager = new EditorManager(projectId, viewKey, allItems);
    }
  }

  public createRow(item: any, index: number): HTMLTableRowElement {
    const tr = document.createElement("tr");
    tr.classList.add("table-row");
    tr.setAttribute("data-gh-item-id", item.id);

    tr.style.transition = "background-color 0.15s ease";
    tr.addEventListener("mouseenter", () => {
      tr.style.backgroundColor = "var(--vscode-list-hoverBackground)";
    });
    tr.addEventListener("mouseleave", () => {
      tr.style.backgroundColor = "transparent";
    });

    // Index cell
    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(index + 1);
    this.styleCell(tdIndex);
    tr.appendChild(tdIndex);

    // Field cells
    for (let colIndex = 0; colIndex < this.fields.length; colIndex++) {
      const field = this.fields[colIndex];
      const td = document.createElement("td");
      this.styleCell(td);

      const fv = item.fieldValues.find(
        (v: any) =>
          String(v.fieldId) === String(field.id) ||
          v.fieldName === field.name,
      );

      if (fv) {
        td.innerHTML = renderCell(fv, field, item, this.allItems);

        // Make cell editable
        if (this.editorManager) {
          this.editorManager.makeEditable(td, fv, field, item);
        }
      }

      // Run interactive callback
      if (this.onCellRendered) {
        this.onCellRendered(td, field, item, fv);
      }

      // Column resizer UI
      td.style.position = "relative";

      const resizer = document.createElement("div");
      resizer.className = "column-resizer";
      resizer.style.position = "absolute";
      resizer.style.top = "0";
      resizer.style.right = "0";
      resizer.style.width = "6px";
      resizer.style.height = "100%";
      resizer.style.cursor = "col-resize";
      resizer.style.userSelect = "none";
      resizer.style.zIndex = "50";

      resizer.addEventListener(
        "mouseenter",
        () => (resizer.style.background = "var(--vscode-focusBorder)"),
      );
      resizer.addEventListener(
        "mouseleave",
        () => (resizer.style.background = "transparent"),
      );

      resizer.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const table = tr.closest("table") as HTMLTableElement | null;
        if (!table) return;

        const cols = table.querySelectorAll("col");
        const col = cols[colIndex + 1] as HTMLTableColElement | undefined;
        const startWidth = col
          ? parseInt(col.style.width) || col.offsetWidth
          : td.offsetWidth;

        this.onResizeStart(colIndex + 1, e.pageX, startWidth);
      });

      td.appendChild(resizer);
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
}
