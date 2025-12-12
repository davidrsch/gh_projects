/**
 * Labels Picker Component
 * Allows users to select multiple labels for an item
 */

import { BasePicker, BasePickerOptions } from "./BasePicker";
import { escapeHtml, normalizeColor, addAlpha } from "../utils";

export interface LabelsPickerOptions extends Omit<BasePickerOptions, "title"> {
  field: any;
  item: any;
  currentLabels: any[];
  onUpdate: (labelIds: string[]) => void;
  onError: (error: string) => void;
}

interface LabelOption {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export class LabelsPicker extends BasePicker {
  private field: any;
  private item: any;
  private availableLabels: LabelOption[] = [];
  private selectedLabelIds: Set<string> = new Set();
  private filteredLabels: LabelOption[] = [];
  private onUpdate: (labelIds: string[]) => void;
  private onError: (error: string) => void;

  constructor(options: LabelsPickerOptions) {
    super({
      ...options,
      title: "Select Labels",
      searchPlaceholder: "Filter labels...",
      onApply: () => {}, // Will be overridden by handleApply
    });

    this.field = options.field;
    this.item = options.item;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;

    // Initialize selected labels
    options.currentLabels.forEach((label) => {
      if (label.id) {
        this.selectedLabelIds.add(String(label.id));
      }
    });

    // Load available labels
    this.loadAvailableLabels();
  }

  /**
   * Load available labels from field options
   */
  private loadAvailableLabels(): void {
    const repoName =
      (this.item.content &&
        this.item.content.repository &&
        this.item.content.repository.nameWithOwner) ||
      (this.item.repository && this.item.repository.nameWithOwner) ||
      null;

    let labels: any[] = [];

    // Try repo-scoped options first
    if (
      repoName &&
      this.field.repoOptions &&
      this.field.repoOptions[repoName]
    ) {
      labels = this.field.repoOptions[repoName];
    } else if (this.field.options) {
      // Fallback to field-level options
      labels = this.field.options;
    }

    this.availableLabels = labels.map((label) => ({
      id: String(label.id || label.name),
      name: label.name || "",
      color: label.color || label.colour || "#999999",
      description: label.description || "",
    }));

    this.filteredLabels = [...this.availableLabels];
  }

  /**
   * Render the content area with label checkboxes
   */
  protected renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = "";
    this.selectableItems = [];

    if (this.filteredLabels.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.style.padding = "20px";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--vscode-descriptionForeground)";
      emptyState.textContent = "No labels found";
      this.contentContainer.appendChild(emptyState);
      return;
    }

    this.filteredLabels.forEach((label) => {
      const item = this.createLabelItem(label);
      this.contentContainer?.appendChild(item);
      this.selectableItems.push(item);
    });
  }

  /**
   * Create a label item with checkbox
   */
  private createLabelItem(label: LabelOption): HTMLElement {
    const item = document.createElement("div");
    item.className = "label-item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.padding = "8px 12px";
    item.style.cursor = "pointer";
    item.style.gap = "8px";

    item.addEventListener("mouseenter", () => {
      item.style.background = "var(--vscode-list-hoverBackground)";
    });
    item.addEventListener("mouseleave", () => {
      if (item.style.background !== "var(--vscode-list-focusBackground)") {
        item.style.background = "transparent";
      }
    });

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.selectedLabelIds.has(label.id);
    checkbox.style.cursor = "pointer";
    checkbox.style.flexShrink = "0";

    // Color swatch
    const normalizedColor = normalizeColor(label.color) || "#999999";
    const hasHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedColor);
    const bg = hasHex ? addAlpha(normalizedColor, 0.12) || "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.06)";

    const swatch = document.createElement("span");
    swatch.style.width = "16px";
    swatch.style.height = "16px";
    swatch.style.borderRadius = "2px";
    swatch.style.background = bg;
    swatch.style.border = `1px solid ${normalizedColor}`;
    swatch.style.flexShrink = "0";

    // Label info
    const info = document.createElement("div");
    info.style.flex = "1";
    info.style.minWidth = "0";
    info.style.display = "flex";
    info.style.flexDirection = "column";
    info.style.gap = "2px";

    const nameEl = document.createElement("div");
    nameEl.textContent = label.name;
    nameEl.style.fontSize = "13px";
    nameEl.style.color = "var(--vscode-foreground)";
    nameEl.style.overflow = "hidden";
    nameEl.style.textOverflow = "ellipsis";
    nameEl.style.whiteSpace = "nowrap";

    info.appendChild(nameEl);

    if (label.description) {
      const descEl = document.createElement("div");
      descEl.textContent = label.description;
      descEl.style.fontSize = "11px";
      descEl.style.color = "var(--vscode-descriptionForeground)";
      descEl.style.overflow = "hidden";
      descEl.style.textOverflow = "ellipsis";
      descEl.style.whiteSpace = "nowrap";
      info.appendChild(descEl);
    }

    item.appendChild(checkbox);
    item.appendChild(swatch);
    item.appendChild(info);

    // Toggle on click
    item.addEventListener("click", (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      this.toggleLabel(label.id, checkbox.checked);
    });

    checkbox.addEventListener("change", () => {
      this.toggleLabel(label.id, checkbox.checked);
    });

    return item;
  }

  /**
   * Toggle label selection
   */
  private toggleLabel(labelId: string, selected: boolean): void {
    if (selected) {
      this.selectedLabelIds.add(labelId);
    } else {
      this.selectedLabelIds.delete(labelId);
    }
  }

  /**
   * Handle search/filter
   */
  protected handleSearch(): void {
    const searchTerm = this.searchInput?.value.toLowerCase() || "";

    if (!searchTerm) {
      this.filteredLabels = [...this.availableLabels];
    } else {
      this.filteredLabels = this.availableLabels.filter(
        (label) =>
          label.name.toLowerCase().includes(searchTerm) ||
          (label.description &&
            label.description.toLowerCase().includes(searchTerm)),
      );
    }

    this.renderContent();
  }

  /**
   * Handle Apply action
   */
  protected handleApply(): void {
    const labelIds = Array.from(this.selectedLabelIds);
    this.onUpdate(labelIds);
    this.close();
  }

  /**
   * Handle Clear All action
   */
  protected handleClearAll(): void {
    this.selectedLabelIds.clear();
    this.renderContent();
  }
}
