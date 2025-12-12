import { renderCell } from "../renderers/cellRenderer";

export class RowRenderer {
  constructor(
    private fields: any[],
    private allItems: any[],
    private onResizeStart: (
      colIndex: number,
      pageX: number,
      startWidth: number,
    ) => void,
    private onCellRendered?: (
      cell: HTMLElement,
      field: any,
      item: any,
      fieldValue: any,
    ) => void,
  ) {}

  public createRow(item: any, index: number): HTMLTableRowElement {
    const tr = document.createElement("tr");
    tr.classList.add("table-row");
    tr.setAttribute("data-gh-item-id", item.id);

    // Add row hover effect
    tr.style.transition = "background-color 0.15s ease";
    tr.addEventListener("mouseenter", () => {
      tr.style.backgroundColor = "var(--vscode-list-hoverBackground)";
    });
    tr.addEventListener("mouseleave", () => {
      tr.style.backgroundColor = "transparent";
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

      const fv = item.fieldValues.find(
        (v: any) =>
          String(v.fieldId) === String(field.id) || v.fieldName === field.name,
      );
      if (fv) {
        td.innerHTML = renderCell(fv, field, item, this.allItems);
      }

      // Attach interactive behavior if callback provided
      if (this.onCellRendered) {
        this.onCellRendered(td, field, item, fv);
      }

      // Make td position relative so we can position a resizer inside it
      td.style.position = "relative";

      // Add a small resizer handle to every cell so columns can be resized from any row
      const cellResizer = document.createElement("div");
      cellResizer.className = "column-resizer";
      cellResizer.style.position = "absolute";
      cellResizer.style.top = "0";
      cellResizer.style.right = "0";
      cellResizer.style.width = "6px";
      cellResizer.style.height = "100%";
      cellResizer.style.cursor = "col-resize";
      cellResizer.style.userSelect = "none";
      cellResizer.style.zIndex = "50";

      cellResizer.addEventListener(
        "mouseenter",
        () => (cellResizer.style.background = "var(--vscode-focusBorder)"),
      );
      cellResizer.addEventListener(
        "mouseleave",
        () => (cellResizer.style.background = "transparent"),
      );

      cellResizer.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // We need to find the table and column width.
        // Since the row is attached to the table when this runs, we can find closest table.
        const table = tr.closest("table") as HTMLTableElement | null;
        if (!table) return;

        const cols = table.querySelectorAll("col");
        const col = cols[colIndex + 1] as HTMLTableColElement | undefined; // +1 for index column
        const startWidth = col
          ? parseInt(col.style.width) || col.offsetWidth
          : td.offsetWidth;

        this.onResizeStart(colIndex + 1, e.pageX, startWidth);
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
}
