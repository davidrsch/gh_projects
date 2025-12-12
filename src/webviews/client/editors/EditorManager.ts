import { CellEditor } from "./CellEditor";
import { TextCellEditor } from "./TextCellEditor";
import { NumberCellEditor } from "./NumberCellEditor";
import { DateCellEditor } from "./DateCellEditor";
import { renderCell } from "../renderers/cellRenderer";

/**
 * Manages inline cell editors for the project table.
 * Handles editor lifecycle, tracks active editor, and coordinates with backend.
 */
export class EditorManager {
  private activeEditor: CellEditor | null = null;
  private projectId: string;
  private viewKey: string;
  private allItems: any[];

  constructor(projectId: string, viewKey: string, allItems: any[]) {
    this.projectId = projectId;
    this.viewKey = viewKey;
    this.allItems = allItems;
  }

  /**
   * Make a cell editable by attaching click and keyboard handlers.
   */
  public makeEditable(
    cell: HTMLTableCellElement,
    fieldValue: any,
    field: any,
    item: any,
  ): void {
    const fieldType = fieldValue?.type || field?.dataType || field?.type;

    // Only text, number, and date fields are editable
    if (!["text", "number", "date"].includes(fieldType)) {
      return;
    }

    // Mark cell as editable
    cell.dataset.editable = "true";
    cell.dataset.fieldType = fieldType;
    cell.dataset.fieldId = String(field.id);
    cell.dataset.itemId = String(item.id);

    // Add visual indicator that cell is editable
    cell.style.cursor = "pointer";
    cell.title = cell.title || "Click to edit, or press F2";

    // Track click count for double-click detection
    let clickCount = 0;
    let clickTimer: any = null;

    const handleClick = (e: MouseEvent) => {
      // Ignore clicks on resizer handles
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("column-resizer") ||
        target.closest(".column-resizer")
      ) {
        return;
      }

      clickCount++;

      if (clickCount === 1) {
        // First click: focus the cell
        cell.focus();

        // Start timer to reset click count
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 300);
      } else if (clickCount === 2) {
        // Second click: enter edit mode
        clearTimeout(clickTimer);
        clickCount = 0;
        this.enterEditMode(cell, fieldValue, field, item);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter or F2 to enter edit mode
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        this.enterEditMode(cell, fieldValue, field, item);
      }
    };

    cell.addEventListener("click", handleClick);
    cell.addEventListener("keydown", handleKeyDown);

    // Make cell focusable
    if (!cell.hasAttribute("tabindex")) {
      cell.setAttribute("tabindex", "0");
    }
  }

  /**
   * Enter edit mode for a cell.
   */
  private enterEditMode(
    cell: HTMLTableCellElement,
    fieldValue: any,
    field: any,
    item: any,
  ): void {
    // Close any active editor
    if (this.activeEditor) {
      this.activeEditor.cancel();
      this.activeEditor = null;
    }

    const fieldType = fieldValue?.type || field?.dataType || field?.type;
    const fieldId = String(field.id);
    const itemId = String(item.id);

    // Create appropriate editor
    let editor: CellEditor | null = null;

    switch (fieldType) {
      case "text":
        editor = new TextCellEditor(
          cell,
          fieldId,
          itemId,
          this.projectId,
          this.viewKey,
          fieldValue,
        );
        break;
      case "number":
        editor = new NumberCellEditor(
          cell,
          fieldId,
          itemId,
          this.projectId,
          this.viewKey,
          fieldValue,
        );
        break;
      case "date":
        editor = new DateCellEditor(
          cell,
          fieldId,
          itemId,
          this.projectId,
          this.viewKey,
          fieldValue,
        );
        break;
      default:
        return;
    }

    if (!editor) return;

    // Set up callbacks
    editor.onCommit((newValue) => {
      // Update the field value in memory
      this.updateFieldValue(item, field, newValue);

      // Re-render the cell with the new value
      const updatedFieldValue = this.getFieldValue(item, field);
      cell.innerHTML = renderCell(updatedFieldValue, field, item, this.allItems);

      // Make cell editable again
      this.makeEditable(cell, updatedFieldValue, field, item);

      this.activeEditor = null;
    });

    editor.onCancel(() => {
      // Re-render cell with original value
      cell.innerHTML = renderCell(fieldValue, field, item, this.allItems);

      // Make cell editable again
      this.makeEditable(cell, fieldValue, field, item);

      this.activeEditor = null;
    });

    // Enter edit mode
    this.activeEditor = editor;
    editor.enter();
  }

  /**
   * Update a field value in the item's field values array.
   */
  private updateFieldValue(item: any, field: any, newValue: any): void {
    const fieldId = String(field.id);
    const fieldType = field?.dataType || field?.type;

    // Find the field value object
    let fv = item.fieldValues.find(
      (v: any) =>
        String(v.fieldId) === fieldId || v.fieldName === field.name,
    );

    if (!fv) {
      // Create new field value if it doesn't exist
      fv = {
        fieldId: fieldId,
        fieldName: field.name,
        type: fieldType,
      };
      item.fieldValues.push(fv);
    }

    // Update the value based on field type
    switch (fieldType) {
      case "text":
        fv.text = newValue;
        break;
      case "number":
        fv.number = newValue;
        break;
      case "date":
        fv.date = newValue;
        break;
    }
  }

  /**
   * Get the current field value for an item.
   */
  private getFieldValue(item: any, field: any): any {
    return item.fieldValues.find(
      (v: any) =>
        String(v.fieldId) === String(field.id) || v.fieldName === field.name,
    );
  }

  /**
   * Close any active editor.
   */
  public closeActiveEditor(): void {
    if (this.activeEditor) {
      this.activeEditor.cancel();
      this.activeEditor = null;
    }
  }
}
