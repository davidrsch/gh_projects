import { CellEditor } from "./CellEditor";

/**
 * Inline editor for text fields.
 * Provides a single-line text input with support for empty strings.
 */
export class TextCellEditor extends CellEditor {
  private input: HTMLInputElement | null = null;

  protected async createEditor(): Promise<HTMLElement> {
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.value = this.originalValue?.text || "";
    this.input.className = "cell-editor-input";

    // Style the input to match VS Code theme
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

    return this.input;
  }

  protected getValue(): any {
    return this.input ? this.input.value : null;
  }

  protected focusEditor(): void {
    if (this.input) {
      this.input.focus();
      // Select all text for easy replacement
      this.input.select();
    }
  }

  protected validate(value: any): { valid: boolean; message?: string } {
    // Text fields can be empty, so any string is valid
    return { valid: true };
  }
}
