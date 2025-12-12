/**
 * Manages keyboard navigation within the project table.
 * Handles arrow key navigation between cells, Enter/F2 for edit mode,
 * and Tab for moving between interactive elements.
 */
export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export interface NavigationCallbacks {
  onEnterEditMode?: (cell: HTMLElement, position: CellPosition) => void;
  onExitEditMode?: (commit: boolean) => void;
  onCellFocus?: (cell: HTMLElement, position: CellPosition) => void;
}

export class TableKeyboardNavigator {
  private table: HTMLTableElement;
  private callbacks: NavigationCallbacks;
  private activePosition: CellPosition | null = null;
  private editMode: boolean = false;

  constructor(table: HTMLTableElement, callbacks: NavigationCallbacks = {}) {
    this.table = table;
    this.callbacks = callbacks;
    this.attachKeyboardHandlers();
  }

  /**
   * Attach keyboard event handlers to the table
   */
  private attachKeyboardHandlers() {
    this.table.addEventListener("keydown", (e) => this.handleTableKeyDown(e));
    
    // Handle focus on cells to track active position
    this.table.addEventListener("focusin", (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TD" || target.tagName === "TH") {
        this.updateActivePosition(target);
      }
    });
  }

  /**
   * Main keyboard event handler for table navigation
   */
  private handleTableKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    
    // Don't handle if we're in an input/textarea/select (except for Escape)
    if (
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT") &&
      e.key !== "Escape"
    ) {
      return;
    }

    // If in edit mode, handle edit-specific keys
    if (this.editMode) {
      this.handleEditModeKeys(e);
      return;
    }

    // Handle navigation keys
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        this.handleArrowNavigation(e.key);
        break;

      case "Enter":
      case "F2":
        e.preventDefault();
        this.enterEditMode();
        break;

      case "Tab":
        // Let default Tab behavior work for moving between interactive elements
        // Only prevent if we want custom Tab handling
        break;

      case " ":
        // Space key - check if cell is interactive
        const cell = this.getActiveCell();
        if (cell && cell.classList.contains("interactive-cell")) {
          e.preventDefault();
          this.enterEditMode();
        }
        break;
    }
  }

  /**
   * Handle keys while in edit mode
   */
  private handleEditModeKeys(e: KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.exitEditMode(false);
        break;

      case "Enter":
        // Only handle Enter if not in a textarea or multiline input
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") {
          e.preventDefault();
          this.exitEditMode(true);
        }
        break;
    }
  }

  /**
   * Handle arrow key navigation
   */
  private handleArrowNavigation(key: string) {
    if (!this.activePosition) {
      // Start from first data cell
      this.activePosition = { rowIndex: 0, colIndex: 0 };
    }

    const { rowIndex, colIndex } = this.activePosition;
    let newPosition = { ...this.activePosition };

    switch (key) {
      case "ArrowUp":
        newPosition.rowIndex = Math.max(0, rowIndex - 1);
        break;
      case "ArrowDown":
        newPosition.rowIndex = rowIndex + 1;
        break;
      case "ArrowLeft":
        newPosition.colIndex = Math.max(0, colIndex - 1);
        break;
      case "ArrowRight":
        newPosition.colIndex = colIndex + 1;
        break;
    }

    this.moveToCell(newPosition);
  }

  /**
   * Move focus to a specific cell position
   */
  private moveToCell(position: CellPosition) {
    const tbody = this.table.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr[data-gh-item-id]"));
    if (position.rowIndex >= rows.length) return;

    const row = rows[position.rowIndex] as HTMLTableRowElement;
    const cells = Array.from(row.querySelectorAll("td"));
    
    if (position.colIndex >= cells.length) return;

    const cell = cells[position.colIndex] as HTMLTableCellElement;
    if (!cell) return;

    // Update active position
    this.activePosition = position;

    // Focus the cell
    cell.focus();

    // Scroll into view if needed (try/catch for test environments without full DOM API)
    try {
      cell.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    } catch (e) {
      // TypeError in environments like jsdom that don't support scrollIntoView options
    }

    // Notify callback
    if (this.callbacks.onCellFocus) {
      this.callbacks.onCellFocus(cell, position);
    }
  }

  /**
   * Update active position based on focused cell
   */
  private updateActivePosition(cell: HTMLElement) {
    const row = cell.closest("tr[data-gh-item-id]") as HTMLTableRowElement;
    if (!row) return;

    const tbody = this.table.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr[data-gh-item-id]"));
    const rowIndex = rows.indexOf(row);
    if (rowIndex === -1) return;

    const cells = Array.from(row.querySelectorAll("td"));
    const colIndex = cells.indexOf(cell as HTMLTableCellElement);
    if (colIndex === -1) return;

    this.activePosition = { rowIndex, colIndex };
  }

  /**
   * Enter edit mode for the active cell
   */
  private enterEditMode() {
    const cell = this.getActiveCell();
    if (!cell || !this.activePosition) return;

    // Check if cell is editable (has interactive-cell class or contains input)
    const isEditable =
      cell.classList.contains("interactive-cell") ||
      cell.querySelector("input, textarea, select");

    if (!isEditable) return;

    this.editMode = true;

    // Notify callback
    if (this.callbacks.onEnterEditMode) {
      this.callbacks.onEnterEditMode(cell, this.activePosition);
    }
  }

  /**
   * Exit edit mode
   */
  private exitEditMode(commit: boolean) {
    this.editMode = false;

    // Notify callback
    if (this.callbacks.onExitEditMode) {
      this.callbacks.onExitEditMode(commit);
    }

    // Return focus to the cell
    const cell = this.getActiveCell();
    if (cell) {
      cell.focus();
    }
  }

  /**
   * Get the currently active cell
   */
  private getActiveCell(): HTMLTableCellElement | null {
    if (!this.activePosition) return null;

    const tbody = this.table.querySelector("tbody");
    if (!tbody) return null;

    const rows = Array.from(tbody.querySelectorAll("tr[data-gh-item-id]"));
    const row = rows[this.activePosition.rowIndex] as HTMLTableRowElement;
    if (!row) return null;

    const cells = Array.from(row.querySelectorAll("td"));
    return cells[this.activePosition.colIndex] as HTMLTableCellElement || null;
  }

  /**
   * Make all cells in the table focusable
   */
  public makeCellsFocusable() {
    const tbody = this.table.querySelector("tbody");
    if (!tbody) return;

    const cells = tbody.querySelectorAll("td");
    cells.forEach((cell) => {
      const td = cell as HTMLTableCellElement;
      // Only make cells focusable if they don't already have tabIndex set
      if (!td.hasAttribute("tabindex")) {
        td.tabIndex = -1; // Focusable but not in tab order
      }
    });

    // Make the first cell in the first row tabbable
    const firstRow = tbody.querySelector("tr[data-gh-item-id]");
    if (firstRow) {
      const firstCell = firstRow.querySelector("td") as HTMLTableCellElement;
      if (firstCell) {
        firstCell.tabIndex = 0; // Tabbable
      }
    }
  }

  /**
   * Clean up event listeners
   */
  public destroy() {
    // Event listeners are attached directly to table, will be cleaned up with table
  }

  /**
   * Manually set edit mode (used by external components)
   */
  public setEditMode(enabled: boolean) {
    this.editMode = enabled;
  }

  /**
   * Get current edit mode state
   */
  public isInEditMode(): boolean {
    return this.editMode;
  }
}
