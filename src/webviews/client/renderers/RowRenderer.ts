import { renderCell } from "../renderers/cellRenderer";

// Pickers (copilot)
import { LabelsPicker } from "../components/LabelsPicker";
import { AssigneesPicker } from "../components/AssigneesPicker";
import { ReviewersPicker } from "../components/ReviewersPicker";
import { MilestonePicker } from "../components/MilestonePicker";

// Main branch editor manager
import { EditorManager } from "../editors/EditorManager";

export class RowRenderer {
  private editorManager: EditorManager | null = null;
  private activePicker: any = null;
  private onFieldUpdate?: (
    itemId: string,
    fieldId: string,
    value: any,
  ) => Promise<void>;

  constructor(
    private fields: any[],
    private allItems: any[],
    private onResizeStart: (
      colIndex: number,
      pageX: number,
      startWidth: number,
    ) => void,

    // main branch callback
    private onCellRendered?: (
      cell: HTMLElement,
      field: any,
      item: any,
      fieldValue: any,
    ) => void,

    // optional project context
    private projectId?: string,
    private viewKey?: string,
    onFieldUpdate?: (
      itemId: string,
      fieldId: string,
      value: any,
    ) => Promise<void>,
  ) {
    this.onFieldUpdate = onFieldUpdate;
    if (projectId && viewKey) {
      this.editorManager = new EditorManager(projectId, viewKey, allItems);
    }
  }

  public createRow(item: any, index: number): HTMLTableRowElement {
    const tr = document.createElement("tr");
    tr.classList.add("table-row");
    tr.setAttribute("data-gh-item-id", item.id);
    tr.setAttribute("role", "row");
    // aria-rowindex is 1-based and accounts for header row (header is row 1, data starts at 2)
    tr.setAttribute("aria-rowindex", String(index + 2));

    tr.style.transition = "background-color 0.15s ease";
    tr.addEventListener("mouseenter", () => {
      tr.style.backgroundColor = "var(--vscode-list-hoverBackground)";
    });
    tr.addEventListener("mouseleave", () => {
      tr.style.backgroundColor = "transparent";
    });

    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(index + 1);
    tdIndex.setAttribute("role", "gridcell");
    tdIndex.setAttribute("aria-colindex", "1");
    tdIndex.setAttribute("aria-label", `Row ${index + 1}`);
    this.styleCell(tdIndex);
    tr.appendChild(tdIndex);

    // Render all field cells
    for (let colIndex = 0; colIndex < this.fields.length; colIndex++) {
      const field = this.fields[colIndex];
      const td = document.createElement("td");
      this.styleCell(td);

      // Add ARIA attributes for accessibility
      td.setAttribute("role", "gridcell");
      td.setAttribute("aria-colindex", String(colIndex + 2)); // +2 because index column is 1

      // Add field label for screen readers
      const fieldLabel = field.name || field.id || "Field";
      td.setAttribute("aria-label", fieldLabel);

      const fv = item.fieldValues.find(
        (v: any) =>
          String(v.fieldId) === String(field.id) || v.fieldName === field.name,
      );

      if (fv) {
        td.innerHTML = renderCell(fv, field, item, this.allItems);
      }

      // Main branch editor system: attach inline editors for text/number/date
      if (this.editorManager) {
        this.editorManager.makeEditable(td, fv, field, item);
      }

      // Indicate if cell is editable and wire up pickers for supported field types
      const dataType = String(field.dataType || field.type || "").toUpperCase();
      const isSingleSelectOrIteration =
        dataType === "SINGLE_SELECT" || dataType === "ITERATION";

      const isPickerField =
        dataType === "LABELS" ||
        dataType === "ASSIGNEES" ||
        dataType === "REVIEWERS" ||
        dataType === "MILESTONE";

      if (isSingleSelectOrIteration || isPickerField) {
        td.setAttribute("aria-readonly", "false");
      } else {
        td.setAttribute("aria-readonly", "true");
      }

      // For labels/assignees/reviewers/milestone, open the appropriate picker
      if (isPickerField) {
        td.style.cursor = "pointer";

        const handleClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (
            target.classList.contains("column-resizer") ||
            target.closest(".column-resizer")
          ) {
            return;
          }

          e.stopPropagation();
          this.openFieldPicker(td, field, item, fv);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            this.openFieldPicker(td, field, item, fv);
          }
        };

        td.addEventListener("click", handleClick);
        td.addEventListener("keydown", handleKeyDown);

        if (!td.hasAttribute("tabindex")) {
          td.setAttribute("tabindex", "0");
        }
      }

      // Allow external callback (used by InteractiveCellManager for single_select/iteration)
      if (this.onCellRendered) {
        this.onCellRendered(td, field, item, fv);
      }

      // Add column resizer
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

    const dataType = String(field.dataType || field.type || "").toUpperCase();

    switch (dataType) {
      case "LABELS":
        this.openLabelsPicker(anchorElement, field, item, fieldValue);
        break;
      case "ASSIGNEES":
        this.openAssigneesPicker(anchorElement, field, item, fieldValue);
        break;
      case "REVIEWERS":
        this.openReviewersPicker(anchorElement, field, item, fieldValue);
        break;
      case "MILESTONE":
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
