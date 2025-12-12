import { CellEditor } from "./CellEditor";

/**
 * Inline editor for date fields.
 * Provides a text input with date validation and a clear button.
 */
export class DateCellEditor extends CellEditor {
  private container: HTMLDivElement | null = null;
  private input: HTMLInputElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;

  protected async createEditor(): Promise<HTMLElement> {
    this.container = document.createElement("div");
    this.container.className = "cell-editor-date";
    this.container.style.display = "flex";
    this.container.style.alignItems = "center";
    this.container.style.gap = "4px";
    this.container.style.width = "100%";
    this.container.style.height = "100%";

    // Create date input
    this.input = document.createElement("input");
    this.input.type = "date"; // HTML5 date picker
    this.input.className = "cell-editor-input";

    // Parse original value
    const dateValue =
      this.originalValue?.date ||
      this.originalValue?.startDate ||
      this.originalValue?.dueOn;
    if (dateValue) {
      try {
        // Convert to YYYY-MM-DD format for input
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          this.input.value = date.toISOString().split("T")[0];
        }
      } catch (e) {
        // Invalid date, leave empty
      }
    }

    // Style the input to match VS Code theme
    this.input.style.flex = "1";
    this.input.style.minWidth = "0";
    this.input.style.border = "1px solid var(--vscode-focusBorder)";
    this.input.style.background = "var(--vscode-input-background)";
    this.input.style.color = "var(--vscode-input-foreground)";
    this.input.style.padding = "4px 8px";
    this.input.style.fontSize = "13px";
    this.input.style.fontFamily = "var(--vscode-font-family)";
    this.input.style.outline = "none";
    this.input.style.boxSizing = "border-box";

    // Create clear button
    this.clearBtn = document.createElement("button");
    this.clearBtn.textContent = "×";
    this.clearBtn.title = "Clear date";
    this.clearBtn.className = "cell-editor-clear";
    this.clearBtn.style.flex = "0 0 auto";
    this.clearBtn.style.width = "24px";
    this.clearBtn.style.height = "24px";
    this.clearBtn.style.border = "1px solid var(--vscode-button-border)";
    this.clearBtn.style.background = "var(--vscode-button-secondaryBackground)";
    this.clearBtn.style.color = "var(--vscode-button-secondaryForeground)";
    this.clearBtn.style.borderRadius = "3px";
    this.clearBtn.style.cursor = "pointer";
    this.clearBtn.style.fontSize = "18px";
    this.clearBtn.style.lineHeight = "1";
    this.clearBtn.style.padding = "0";
    this.clearBtn.style.display = "flex";
    this.clearBtn.style.alignItems = "center";
    this.clearBtn.style.justifyContent = "center";

    this.clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.input) {
        this.input.value = "";
        this.input.focus();
      }
    });

    this.clearBtn.addEventListener("mouseenter", () => {
      if (this.clearBtn) {
        this.clearBtn.style.background =
          "var(--vscode-button-secondaryHoverBackground)";
      }
    });

    this.clearBtn.addEventListener("mouseleave", () => {
      if (this.clearBtn) {
        this.clearBtn.style.background =
          "var(--vscode-button-secondaryBackground)";
      }
    });

    this.container.appendChild(this.input);
    this.container.appendChild(this.clearBtn);

    return this.container;
  }

  protected getValue(): any {
    if (!this.input) return null;

    const value = this.input.value.trim();

    // Empty string - return original value instead of null
    // (GitHub API doesn't support clearing fields via this mutation)
    // Note: We preserve the original value rather than defaulting to today's date
    // to avoid unexpected data changes when user clears and then cancels.
    if (value === "") {
      const originalDate =
        this.originalValue?.date ||
        this.originalValue?.startDate ||
        this.originalValue?.dueOn;
      // If there was no original date, this should not happen as the input
      // would show empty initially. But if it does, we keep the empty input
      // and validation will catch it.
      return originalDate || null;
    }

    // Return ISO 8601 date string
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  protected focusEditor(): void {
    if (this.input) {
      this.input.focus();
    }
  }

  protected validate(value: any): { valid: boolean; message?: string } {
    // Null is valid (empty field)
    if (value === null) {
      return { valid: true };
    }

    // Check if it's a valid ISO 8601 date string
    if (typeof value === "string") {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return { valid: true };
        }
      } catch (e) {
        // Invalid date
      }
    }

    return {
      valid: false,
      message: "Please enter a valid date or leave empty",
    };
  }
}
