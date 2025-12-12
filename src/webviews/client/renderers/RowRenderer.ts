import { renderCell } from "../renderers/cellRenderer";
import { LabelsPicker } from "../components/LabelsPicker";
import { AssigneesPicker } from "../components/AssigneesPicker";
import { ReviewersPicker } from "../components/ReviewersPicker";
import { MilestonePicker } from "../components/MilestonePicker";

export class RowRenderer {
  private activePicker: any = null;

  constructor(
    private fields: any[],
    private allItems: any[],
    private onResizeStart: (
      colIndex: number,
      pageX: number,
      startWidth: number,
    ) => void,
    private onFieldUpdate?: (
      itemId: string,
      fieldId: string,
      value: any,
    ) => Promise<void>,
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

      // Make td position relative so we can position a resizer inside it
      td.style.position = "relative";

      // Add click handler for editable field types
      const editableTypes = ["labels", "assignees", "reviewers", "milestone"];
      if (editableTypes.includes(field.type)) {
        td.style.cursor = "pointer";
        td.setAttribute("data-field-type", field.type);
        td.setAttribute("data-field-id", field.id);
        td.setAttribute("data-item-id", item.id);
        td.setAttribute("tabindex", "0");

        td.addEventListener("click", (e) => {
          // Don't trigger on resizer
          const target = e.target as HTMLElement;
          if (target.classList.contains("column-resizer")) {
            return;
          }
          this.openFieldPicker(td, field, item, fv);
        });

        td.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.openFieldPicker(td, field, item, fv);
          }
        });
      }

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

  /**
   * Open the appropriate picker for a field
   */
  private openFieldPicker(
    anchorElement: HTMLElement,
    field: any,
    item: any,
    fieldValue: any,
  ): void {
    // Close any existing picker
    if (this.activePicker) {
      this.activePicker.hide();
      this.activePicker = null;
    }

    switch (field.type) {
      case "labels":
        this.openLabelsPicker(anchorElement, field, item, fieldValue);
        break;
      case "assignees":
        this.openAssigneesPicker(anchorElement, field, item, fieldValue);
        break;
      case "reviewers":
        this.openReviewersPicker(anchorElement, field, item, fieldValue);
        break;
      case "milestone":
        this.openMilestonePicker(anchorElement, field, item, fieldValue);
        break;
    }
  }

  /**
   * Open labels picker
   */
  private openLabelsPicker(
    anchorElement: HTMLElement,
    field: any,
    item: any,
    fieldValue: any,
  ): void {
    const currentLabels = (fieldValue && fieldValue.labels) || [];

    this.activePicker = new LabelsPicker({
      anchorElement,
      field,
      item,
      currentLabels,
      onClose: () => {
        this.activePicker = null;
      },
      onUpdate: async (labelIds: string[]) => {
        if (this.onFieldUpdate) {
          try {
            await this.onFieldUpdate(item.id, field.id, { labelIds });
            // Update will be reflected when snapshot is refreshed
          } catch (error) {
            console.error("Failed to update labels:", error);
            // Could show error UI here
          }
        }
      },
      onError: (error: string) => {
        console.error("Labels picker error:", error);
      },
    });

    this.activePicker.show();
  }

  /**
   * Open assignees picker
   */
  private openAssigneesPicker(
    anchorElement: HTMLElement,
    field: any,
    item: any,
    fieldValue: any,
  ): void {
    const currentAssignees = (fieldValue && fieldValue.assignees) || [];

    this.activePicker = new AssigneesPicker({
      anchorElement,
      field,
      item,
      currentAssignees,
      onClose: () => {
        this.activePicker = null;
      },
      onUpdate: async (assigneeLogins: string[]) => {
        if (this.onFieldUpdate) {
          try {
            await this.onFieldUpdate(item.id, field.id, { assigneeLogins });
          } catch (error) {
            console.error("Failed to update assignees:", error);
          }
        }
      },
      onError: (error: string) => {
        console.error("Assignees picker error:", error);
      },
    });

    this.activePicker.show();
  }

  /**
   * Open reviewers picker
   */
  private openReviewersPicker(
    anchorElement: HTMLElement,
    field: any,
    item: any,
    fieldValue: any,
  ): void {
    const currentReviewers = (fieldValue && fieldValue.reviewers) || [];

    this.activePicker = new ReviewersPicker({
      anchorElement,
      field,
      item,
      currentReviewers,
      onClose: () => {
        this.activePicker = null;
      },
      onUpdate: async (reviewerLogins: string[]) => {
        if (this.onFieldUpdate) {
          try {
            await this.onFieldUpdate(item.id, field.id, { reviewerLogins });
          } catch (error) {
            console.error("Failed to update reviewers:", error);
          }
        }
      },
      onError: (error: string) => {
        console.error("Reviewers picker error:", error);
      },
    });

    this.activePicker.show();
  }

  /**
   * Open milestone picker
   */
  private openMilestonePicker(
    anchorElement: HTMLElement,
    field: any,
    item: any,
    fieldValue: any,
  ): void {
    const currentMilestone = (fieldValue && fieldValue.milestone) || null;

    this.activePicker = new MilestonePicker({
      anchorElement,
      field,
      item,
      currentMilestone,
      onClose: () => {
        this.activePicker = null;
      },
      onUpdate: async (milestoneId: string | null) => {
        if (this.onFieldUpdate) {
          try {
            await this.onFieldUpdate(item.id, field.id, { milestoneId });
          } catch (error) {
            console.error("Failed to update milestone:", error);
          }
        }
      },
      onError: (error: string) => {
        console.error("Milestone picker error:", error);
      },
    });

    this.activePicker.show();
  }
}
