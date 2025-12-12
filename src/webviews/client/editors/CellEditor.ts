// Constants
const UPDATE_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Base class for inline cell editors in the project table.
 * Provides common functionality for entering/exiting edit mode,
 * keyboard handling, and messaging with the extension backend.
 */
export abstract class CellEditor {
  protected cell: HTMLTableCellElement;
  protected fieldId: string;
  protected fieldType: string;
  protected itemId: string;
  protected projectId: string;
  protected viewKey: string;
  protected originalValue: any;
  protected editorElement: HTMLElement | null = null;
  protected isActive = false;
  protected onCommitCallback?: (value: any) => void;
  protected onCancelCallback?: () => void;

  constructor(
    cell: HTMLTableCellElement,
    fieldId: string,
    fieldType: string,
    itemId: string,
    projectId: string,
    viewKey: string,
    originalValue: any,
  ) {
    this.cell = cell;
    this.fieldId = fieldId;
    this.fieldType = fieldType;
    this.itemId = itemId;
    this.projectId = projectId;
    this.viewKey = viewKey;
    this.originalValue = originalValue;
  }

  /**
   * Enter edit mode by replacing cell content with an editor.
   */
  public async enter(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    // Store original content
    const originalContent = this.cell.innerHTML;

    // Create editor element
    this.editorElement = await this.createEditor();
    if (!this.editorElement) {
      this.isActive = false;
      return;
    }

    // Replace cell content with editor
    this.cell.innerHTML = "";
    this.cell.appendChild(this.editorElement);
    this.cell.classList.add("editing");

    // Attach keyboard handlers
    this.attachKeyboardHandlers();

    // Focus the editor
    this.focusEditor();
  }

  /**
   * Exit edit mode and restore the original cell content.
   */
  public exit(): void {
    if (!this.isActive) return;
    this.isActive = false;

    this.cell.classList.remove("editing", "loading", "error");
    this.editorElement = null;
  }

  /**
   * Commit the current value and persist to backend.
   */
  public async commit(): Promise<void> {
    if (!this.isActive || !this.editorElement) return;

    const newValue = this.getValue();

    // Validate the value
    const validation = this.validate(newValue);
    if (!validation.valid) {
      this.showError(validation.message || "Invalid value");
      return;
    }

    // Show loading state
    this.cell.classList.add("loading");
    if (this.editorElement) {
      this.editorElement.style.opacity = "0.6";
    }

    try {
      // Send update message to backend
      await this.sendUpdate(newValue);

      // On success, exit edit mode and notify callback
      this.exit();
      if (this.onCommitCallback) {
        this.onCommitCallback(newValue);
      }
    } catch (error) {
      // On error, show error state and remain in edit mode
      this.cell.classList.remove("loading");
      if (this.editorElement) {
        this.editorElement.style.opacity = "1";
      }
      this.showError(
        error instanceof Error ? error.message : "Failed to update field",
      );
    }
  }

  /**
   * Cancel editing and restore the original value.
   */
  public cancel(): void {
    if (!this.isActive) return;
    this.exit();
    if (this.onCancelCallback) {
      this.onCancelCallback();
    }
  }

  /**
   * Set callback to be called when the value is committed.
   */
  public onCommit(callback: (value: any) => void): void {
    this.onCommitCallback = callback;
  }

  /**
   * Set callback to be called when editing is cancelled.
   */
  public onCancel(callback: () => void): void {
    this.onCancelCallback = callback;
  }

  /**
   * Create the editor element for this field type.
   * Must be implemented by subclasses.
   */
  protected abstract createEditor(): Promise<HTMLElement>;

  /**
   * Get the current value from the editor.
   * Must be implemented by subclasses.
   */
  protected abstract getValue(): any;

  /**
   * Focus the editor element.
   * Must be implemented by subclasses.
   */
  protected abstract focusEditor(): void;

  /**
   * Validate the value before committing.
   * Returns {valid: true} if valid, or {valid: false, message: string} if invalid.
   */
  protected validate(value: any): { valid: boolean; message?: string } {
    return { valid: true };
  }

  /**
   * Attach common keyboard handlers (Esc to cancel, Enter to commit).
   */
  protected attachKeyboardHandlers(): void {
    if (!this.editorElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.commit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        this.commit().then(() => {
          // Move to next cell
          this.moveToNextCell(e.shiftKey);
        });
      }
    };

    this.editorElement.addEventListener("keydown", handleKeyDown);
  }

  /**
   * Send update message to the extension backend.
   */
  protected async sendUpdate(newValue: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = `update-${Date.now()}-${Math.random()}`;
      let timeoutId: number | undefined;

      // Normalized handler that works for both raw window messages and the
      // __APP_MESSAGING__ shim, which forwards just the data object.
      const handleResponse = (eventOrData: any) => {
        const msg =
          eventOrData &&
          typeof eventOrData === "object" &&
          "data" in eventOrData
            ? (eventOrData as MessageEvent).data
            : eventOrData;

        if (!msg || msg.command !== "updateFieldValueResponse") {
          return;
        }
        if (msg.id !== messageId) {
          return;
        }

        window.removeEventListener(
          "message",
          handleResponse as unknown as EventListener,
        );

        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }

        if (msg.success) {
          resolve();
        } else {
          reject(new Error(msg.error || "Update failed"));
        }
      };

      const messaging = (window as any).__APP_MESSAGING__;

      if (messaging && typeof messaging.onMessage === "function") {
        try {
          messaging.onMessage(handleResponse);
        } catch (e) {
          // Ignore and rely on window listener below.
        }
      }

      window.addEventListener(
        "message",
        handleResponse as unknown as EventListener,
      );

      // Send the update message
      const message = {
        command: "updateFieldValue",
        id: messageId,
        projectId: this.projectId,
        itemId: this.itemId,
        fieldId: this.fieldId,
        fieldType: this.fieldType,
        newValue,
        viewKey: this.viewKey,
      };

      if (messaging && typeof messaging.postMessage === "function") {
        messaging.postMessage(message);
      } else {
        const vscode = (window as any).vscodeApi;
        if (vscode && typeof vscode.postMessage === "function") {
          vscode.postMessage(message);
        } else {
          window.removeEventListener(
            "message",
            handleResponse as unknown as EventListener,
          );
          reject(new Error("No messaging API available"));
          return;
        }
      }

      // Timeout after configured duration
      timeoutId = window.setTimeout(() => {
        window.removeEventListener(
          "message",
          handleResponse as unknown as EventListener,
        );
        reject(new Error("Update timeout"));
      }, UPDATE_TIMEOUT_MS);
    });
  }

  /**
   * Show an error message near the cell.
   */
  protected showError(message: string): void {
    this.cell.classList.add("error");

    // Create error tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "cell-editor-error";
    tooltip.textContent = message;
    tooltip.style.position = "absolute";
    tooltip.style.top = "100%";
    tooltip.style.left = "0";
    tooltip.style.background = "var(--vscode-inputValidation-errorBackground)";
    tooltip.style.border =
      "1px solid var(--vscode-inputValidation-errorBorder)";
    tooltip.style.color = "var(--vscode-inputValidation-errorForeground)";
    tooltip.style.padding = "4px 8px";
    tooltip.style.borderRadius = "3px";
    tooltip.style.fontSize = "12px";
    tooltip.style.zIndex = "1000";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.marginTop = "2px";

    this.cell.style.position = "relative";
    this.cell.appendChild(tooltip);

    // Remove error after 3 seconds
    setTimeout(() => {
      this.cell.classList.remove("error");
      if (tooltip.parentElement) {
        tooltip.remove();
      }
    }, 3000);
  }

  /**
   * Move focus to the next or previous editable cell.
   */
  protected moveToNextCell(reverse: boolean): void {
    const row = this.cell.parentElement as HTMLTableRowElement;
    if (!row) return;

    const cells = Array.from(row.cells);
    const currentIndex = cells.indexOf(this.cell);

    if (reverse) {
      // Move to previous cell
      for (let i = currentIndex - 1; i >= 0; i--) {
        const cell = cells[i];
        if (cell.dataset.editable === "true") {
          // Just focus the cell; user can press Enter/F2 to edit
          (cell as HTMLTableCellElement).focus();
          return;
        }
      }
    } else {
      // Move to next cell
      for (let i = currentIndex + 1; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.dataset.editable === "true") {
          // Just focus the cell; user can press Enter/F2 to edit
          (cell as HTMLTableCellElement).focus();
          return;
        }
      }
    }
  }
}
