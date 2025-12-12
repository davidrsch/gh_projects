/**
 * Milestone Picker Component
 * Allows users to select a single milestone for an item
 */

import { BasePicker, BasePickerOptions } from "./BasePicker";
import { escapeHtml } from "../utils";

export interface MilestonePickerOptions extends Omit<
  BasePickerOptions,
  "title"
> {
  field: any;
  item: any;
  currentMilestone: any;
  onUpdate: (milestoneId: string | null) => void;
  onError: (error: string) => void;
}

interface MilestoneOption {
  id: string;
  title: string;
  dueOn?: string;
  state?: string;
}

export class MilestonePicker extends BasePicker {
  private field: any;
  private item: any;
  private availableMilestones: MilestoneOption[] = [];
  private selectedMilestoneId: string | null = null;
  private filteredMilestones: MilestoneOption[] = [];
  private onUpdate: (milestoneId: string | null) => void;
  private onError: (error: string) => void;

  constructor(options: MilestonePickerOptions) {
    super({
      ...options,
      title: "Select Milestone",
      searchPlaceholder: "Filter milestones...",
      onApply: undefined, // Milestone selection is immediate, no apply button needed
    });

    this.field = options.field;
    this.item = options.item;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;

    // Initialize selected milestone
    if (options.currentMilestone && options.currentMilestone.id) {
      this.selectedMilestoneId = String(options.currentMilestone.id);
    }

    // Load available milestones
    this.loadAvailableMilestones();
  }

  /**
   * Load available milestones from field options
   */
  private loadAvailableMilestones(): void {
    let milestones: any[] = [];

    // Try to get repo-specific milestones
    const repoName =
      (this.item.content &&
        this.item.content.repository &&
        this.item.content.repository.nameWithOwner) ||
      (this.item.repository && this.item.repository.nameWithOwner) ||
      null;

    if (
      repoName &&
      this.field.repoOptions &&
      this.field.repoOptions[repoName]
    ) {
      milestones = this.field.repoOptions[repoName];
    } else if (this.field.options) {
      milestones = this.field.options;
    }

    this.availableMilestones = milestones.map((milestone) => ({
      id: String(milestone.id || milestone.title),
      title: milestone.title || "",
      dueOn: milestone.dueOn || milestone.due_on || "",
      state: milestone.state || "",
    }));

    this.filteredMilestones = [...this.availableMilestones];
  }

  /**
   * Render the content area with milestone options
   */
  protected renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = "";
    this.selectableItems = [];

    // Add "No milestone" option
    const clearItem = this.createClearMilestoneItem();
    this.contentContainer.appendChild(clearItem);
    this.selectableItems.push(clearItem);

    if (this.filteredMilestones.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.style.padding = "20px";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--vscode-descriptionForeground)";
      emptyState.textContent = "No milestones found";
      this.contentContainer.appendChild(emptyState);
      return;
    }

    // Add separator
    const separator = document.createElement("div");
    separator.style.height = "1px";
    separator.style.background = "var(--vscode-menu-separatorBackground)";
    separator.style.margin = "4px 0";
    this.contentContainer.appendChild(separator);

    this.filteredMilestones.forEach((milestone) => {
      const item = this.createMilestoneItem(milestone);
      if (this.contentContainer) {
        this.contentContainer.appendChild(item);
      }
      this.selectableItems.push(item);
    });
  }

  /**
   * Create "No milestone" option
   */
  private createClearMilestoneItem(): HTMLElement {
    const item = document.createElement("div");
    item.className = "milestone-item";
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

    // Radio button indicator
    const radio = document.createElement("span");
    radio.style.width = "16px";
    radio.style.height = "16px";
    radio.style.borderRadius = "50%";
    radio.style.border = "2px solid var(--vscode-input-border)";
    radio.style.flexShrink = "0";
    radio.style.display = "inline-flex";
    radio.style.alignItems = "center";
    radio.style.justifyContent = "center";

    if (this.selectedMilestoneId === null) {
      const dot = document.createElement("span");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.background = "var(--vscode-focusBorder)";
      radio.appendChild(dot);
    }

    const label = document.createElement("span");
    label.textContent = "No milestone";
    label.style.fontSize = "13px";
    label.style.color = "var(--vscode-descriptionForeground)";
    label.style.fontStyle = "italic";

    item.appendChild(radio);
    item.appendChild(label);

    item.addEventListener("click", () => {
      this.selectMilestone(null);
    });

    return item;
  }

  /**
   * Create a milestone item
   */
  private createMilestoneItem(milestone: MilestoneOption): HTMLElement {
    const item = document.createElement("div");
    item.className = "milestone-item";
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

    // Radio button indicator
    const radio = document.createElement("span");
    radio.style.width = "16px";
    radio.style.height = "16px";
    radio.style.borderRadius = "50%";
    radio.style.border = "2px solid var(--vscode-input-border)";
    radio.style.flexShrink = "0";
    radio.style.display = "inline-flex";
    radio.style.alignItems = "center";
    radio.style.justifyContent = "center";

    if (this.selectedMilestoneId === milestone.id) {
      const dot = document.createElement("span");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.background = "var(--vscode-focusBorder)";
      radio.appendChild(dot);
    }

    // Milestone info
    const info = document.createElement("div");
    info.style.flex = "1";
    info.style.minWidth = "0";
    info.style.display = "flex";
    info.style.flexDirection = "column";
    info.style.gap = "2px";

    const titleEl = document.createElement("div");
    titleEl.textContent = milestone.title;
    titleEl.style.fontSize = "13px";
    titleEl.style.color = "var(--vscode-foreground)";
    titleEl.style.overflow = "hidden";
    titleEl.style.textOverflow = "ellipsis";
    titleEl.style.whiteSpace = "nowrap";

    info.appendChild(titleEl);

    // Add due date if available
    if (milestone.dueOn) {
      try {
        const dueDate = new Date(milestone.dueOn);
        if (!isNaN(dueDate.getTime())) {
          const formatted = dueDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const dueEl = document.createElement("div");
          dueEl.textContent = `Due ${formatted}`;
          dueEl.style.fontSize = "11px";
          dueEl.style.color = "var(--vscode-descriptionForeground)";
          info.appendChild(dueEl);
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    item.appendChild(radio);
    item.appendChild(info);

    item.addEventListener("click", () => {
      this.selectMilestone(milestone.id);
    });

    return item;
  }

  /**
   * Select a milestone (immediately commits the change)
   */
  private selectMilestone(milestoneId: string | null): void {
    this.selectedMilestoneId = milestoneId;
    this.onUpdate(milestoneId);
    this.close();
  }

  /**
   * Handle search/filter
   */
  protected handleSearch(): void {
    const searchTerm = this.searchInput?.value.toLowerCase() || "";

    if (!searchTerm) {
      this.filteredMilestones = [...this.availableMilestones];
    } else {
      this.filteredMilestones = this.availableMilestones.filter((milestone) =>
        milestone.title.toLowerCase().includes(searchTerm),
      );
    }

    this.renderContent();
  }

  /**
   * Handle Apply action (not used for milestone picker)
   */
  protected handleApply(): void {
    // Not used - milestone selection is immediate
  }

  /**
   * Handle Clear All action
   */
  protected handleClearAll(): void {
    this.selectMilestone(null);
  }
}
