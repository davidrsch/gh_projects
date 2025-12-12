import { CellEditor } from "./CellEditor";

/**
 * Inline editor for number fields.
 * Validates numeric input and allows clearing to null.
 */
export class NumberCellEditor extends CellEditor {
  private input: HTMLInputElement | null = null;

  protected async createEditor(): Promise<HTMLElement> {
    this.input = document.createElement("input");
    this.input.type = "text"; // Use text to allow validation
    this.input.value =
      this.originalValue?.number !== undefined &&
      this.originalValue?.number !== null
        ? String(this.originalValue.number)
        : "";
    this.input.className = "cell-editor-input";

    // Style the input to match VS Code theme and right-align for numbers
    this.input.style.width = "100%";
    this.input.style.height = "100%";
    this.input.style.border = "1px solid var(--vscode-focusBorder)";
    this.input.style.background = "var(--vscode-input-background)";
    this.input.style.color = "var(--vscode-input-foreground)";
    this.input.style.padding = "4px 8px";
    this.input.style.fontSize = "13px";
    this.input.style.fontFamily = "var(--vscode-font-family)";
    this.input.style.outline = "none";
    this.input.style.boxSizing = "border-box";
    this.input.style.textAlign = "right";
    this.input.style.fontVariantNumeric = "tabular-nums";

    // Add input validation to prevent non-numeric characters
    this.input.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      let value = target.value;

      // Allow empty string
      if (value === "") return;

      // Remove any invalid characters first
      value = value.replace(/[^0-9.-]/g, "");

      // Ensure minus sign is only at the beginning
      const minusCount = (value.match(/-/g) || []).length;
      if (minusCount > 0) {
        const hasMinus = value.startsWith("-");
        value = value.replace(/-/g, "");
        if (hasMinus) {
          value = "-" + value;
        }
      }

      // Ensure only one decimal point
      const decimalCount = (value.match(/\./g) || []).length;
      if (decimalCount > 1) {
        const parts = value.split(".");
        value = parts[0] + "." + parts.slice(1).join("");
      }

      target.value = value;
    });

    return this.input;
  }

  protected getValue(): any {
    if (!this.input) return null;

    const value = this.input.value.trim();

    // Empty string - return original value instead of null
    // (GitHub API doesn't support clearing fields via this mutation)
    if (value === "") {
      return this.originalValue?.number !== undefined &&
        this.originalValue?.number !== null
        ? this.originalValue.number
        : 0;
    }

    // Parse as number
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  protected focusEditor(): void {
    if (this.input) {
      this.input.focus();
      // Select all text for easy replacement
      this.input.select();
    }
  }

  protected validate(value: any): { valid: boolean; message?: string } {
    // Null is valid (empty field)
    if (value === null) {
      return { valid: true };
    }

    // Check if it's a valid number
    if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
      return { valid: true };
    }

    return {
      valid: false,
      message: "Please enter a valid number or leave empty",
    };
  }
}
