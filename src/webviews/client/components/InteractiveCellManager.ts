import { FieldDropdown, DropdownOption } from "./FieldDropdown";

export interface CellUpdateRequest {
  itemId: string;
  fieldId: string;
  value: string | null; // optionId for single_select, iterationId for iteration, null for clear
  projectId: string;
  viewKey: string;
}

export interface InteractiveCellConfig {
  onUpdateRequest: (request: CellUpdateRequest) => Promise<void>;
  onUpdateSuccess: (request: CellUpdateRequest) => void;
  onUpdateError: (request: CellUpdateRequest, error: string) => void;
}

/**
 * Manages interactive behavior for single-select and iteration cells.
 * Handles click events, dropdown display, and update requests.
 */
const ERROR_TOOLTIP_DURATION_MS = 3000;

export class InteractiveCellManager {
  private config: InteractiveCellConfig;
  private activeDropdown: FieldDropdown | null = null;
  private updatingCells: Set<string> = new Set(); // Track cells being updated

  constructor(config: InteractiveCellConfig) {
    this.config = config;
  }

  /**
   * Attach interactive behavior to a table cell.
   */
  public attachToCell(
    cell: HTMLElement,
    field: any,
    item: any,
    currentValue: any,
    projectId: string,
    viewKey: string,
  ) {
    const fieldType = field.dataType || field.type;

    if (fieldType !== "SINGLE_SELECT" && fieldType !== "ITERATION") {
      return; // Only handle single_select and iteration fields
    }

    // Make cell clickable
    cell.style.cursor = "pointer";
    cell.style.userSelect = "none";
    cell.classList.add("interactive-cell");

    // Add click handler
    const clickHandler = (e: MouseEvent) => {
      e.stopPropagation();

      // Don't open if cell is being updated
      const cellKey = this.getCellKey(item.id, field.id);
      if (this.updatingCells.has(cellKey)) {
        return;
      }

      this.openDropdownForCell(
        cell,
        field,
        item,
        currentValue,
        projectId,
        viewKey,
      );
    };

    cell.addEventListener("click", clickHandler);

    // Add keyboard handler
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();

        const cellKey = this.getCellKey(item.id, field.id);
        if (this.updatingCells.has(cellKey)) {
          return;
        }

        this.openDropdownForCell(
          cell,
          field,
          item,
          currentValue,
          projectId,
          viewKey,
        );
      }
    };

    cell.addEventListener("keydown", keyHandler);

    // Make cell focusable
    cell.tabIndex = 0;

    // Add hover effect
    cell.addEventListener("mouseenter", () => {
      const cellKey = this.getCellKey(item.id, field.id);
      if (!this.updatingCells.has(cellKey)) {
        cell.style.outline = "1px solid var(--vscode-focusBorder)";
        cell.style.outlineOffset = "-1px";
      }
    });

    cell.addEventListener("mouseleave", () => {
      cell.style.outline = "none";
    });
  }

  private openDropdownForCell(
    cell: HTMLElement,
    field: any,
    item: any,
    currentValue: any,
    projectId: string,
    viewKey: string,
  ) {
    // Close existing dropdown
    if (this.activeDropdown) {
      this.activeDropdown.destroy();
      this.activeDropdown = null;
    }

    const fieldType = field.dataType || field.type;
    let options: DropdownOption[] = [];
    let currentValueId: string | null = null;

    if (fieldType === "SINGLE_SELECT") {
      options = this.buildSingleSelectOptions(field, currentValue);
      currentValueId = currentValue?.option?.id || null;
    } else if (fieldType === "ITERATION") {
      options = this.buildIterationOptions(field, currentValue);
      currentValueId = currentValue?.iterationId || null;
    }

    this.activeDropdown = new FieldDropdown({
      options,
      currentValue: currentValueId,
      anchorElement: cell,
      title: field.name,
      emptyMessage:
        fieldType === "SINGLE_SELECT"
          ? "No options configured"
          : "No iterations configured",
      onSelect: async (optionId) => {
        await this.handleOptionSelect(
          optionId,
          item.id,
          field.id,
          projectId,
          viewKey,
          cell,
        );
      },
      onClose: () => {
        this.activeDropdown = null;
      },
    });

    this.activeDropdown.show();
  }

  private buildSingleSelectOptions(
    field: any,
    currentValue: any,
  ): DropdownOption[] {
    const options: DropdownOption[] = [];

    // Add "Clear" option
    options.push({
      id: null,
      label: "Clear",
      color: undefined,
    });

    // Add field options
    if (field.options && Array.isArray(field.options)) {
      field.options.forEach((opt: any) => {
        options.push({
          id: opt.id,
          label: opt.name || opt.id,
          description: opt.description,
          color: opt.color,
        });
      });
    }

    return options;
  }

  private buildIterationOptions(
    field: any,
    currentValue: any,
  ): DropdownOption[] {
    const options: DropdownOption[] = [];

    // Add "Clear" option
    options.push({
      id: null,
      label: "No iteration",
      color: undefined,
    });

    // Add iteration options
    if (
      field.configuration &&
      field.configuration.iterations &&
      Array.isArray(field.configuration.iterations)
    ) {
      field.configuration.iterations.forEach((iter: any) => {
        const dateRange = this.formatIterationDateRange(iter);
        options.push({
          id: iter.id,
          label: iter.title || "Untitled Iteration",
          metadata: { dateRange },
        });
      });
    }

    return options;
  }

  private formatIterationDateRange(iteration: any): string {
    if (!iteration.startDate) {
      return "";
    }

    try {
      const start = new Date(iteration.startDate);
      const startStr = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Calculate end date if duration is provided
      if (iteration.duration) {
        const end = new Date(start);
        end.setDate(end.getDate() + iteration.duration);
        const endStr = end.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        return `${startStr} - ${endStr}`;
      }

      return startStr;
    } catch (e) {
      return "";
    }
  }

  private async handleOptionSelect(
    optionId: string | null,
    itemId: string,
    fieldId: string,
    projectId: string,
    viewKey: string,
    cell: HTMLElement,
  ) {
    const cellKey = this.getCellKey(itemId, fieldId);

    // Mark cell as updating
    this.updatingCells.add(cellKey);
    this.showCellLoading(cell);

    const request: CellUpdateRequest = {
      itemId,
      fieldId,
      value: optionId,
      projectId,
      viewKey,
    };

    try {
      await this.config.onUpdateRequest(request);
      this.config.onUpdateSuccess(request);
      this.hideCellLoading(cell);
    } catch (error: any) {
      const errorMsg = error?.message || String(error) || "Update failed";
      this.config.onUpdateError(request, errorMsg);
      this.showCellError(cell, errorMsg);
    } finally {
      this.updatingCells.delete(cellKey);
    }
  }

  private getCellKey(itemId: string, fieldId: string): string {
    return `${itemId}:${fieldId}`;
  }

  private showCellLoading(cell: HTMLElement) {
    cell.style.opacity = "0.6";
    cell.style.pointerEvents = "none";
    cell.classList.add("updating");
  }

  private hideCellLoading(cell: HTMLElement) {
    cell.style.opacity = "1";
    cell.style.pointerEvents = "auto";
    cell.classList.remove("updating");
  }

  private showCellError(cell: HTMLElement, errorMsg: string) {
    this.hideCellLoading(cell);

    // Add error styling
    cell.style.outline = "2px solid var(--vscode-errorForeground)";
    cell.style.outlineOffset = "-2px";

    // Show error tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "cell-error-tooltip";
    tooltip.textContent = errorMsg;
    tooltip.style.position = "absolute";
    tooltip.style.background = "var(--vscode-inputValidation-errorBackground)";
    tooltip.style.border =
      "1px solid var(--vscode-inputValidation-errorBorder)";
    tooltip.style.color = "var(--vscode-inputValidation-errorForeground)";
    tooltip.style.padding = "6px 10px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "12px";
    tooltip.style.zIndex = "1001";
    tooltip.style.maxWidth = "300px";
    tooltip.style.wordWrap = "break-word";
    tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

    const cellRect = cell.getBoundingClientRect();
    tooltip.style.top = `${cellRect.bottom + 4}px`;
    tooltip.style.left = `${cellRect.left}px`;

    document.body.appendChild(tooltip);

    // Remove error styling and tooltip after configured duration
    setTimeout(() => {
      cell.style.outline = "none";
      tooltip.remove();
    }, ERROR_TOOLTIP_DURATION_MS);
  }

  public destroy() {
    if (this.activeDropdown) {
      this.activeDropdown.destroy();
      this.activeDropdown = null;
    }
    this.updatingCells.clear();
  }
}
