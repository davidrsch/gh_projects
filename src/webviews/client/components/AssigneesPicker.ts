/**
 * Assignees Picker Component
 * Allows users to select multiple assignees for an item
 */

import { BasePicker, BasePickerOptions } from "./BasePicker";
import { escapeHtml } from "../utils";

export interface AssigneesPickerOptions extends Omit<
  BasePickerOptions,
  "title"
> {
  field: any;
  item: any;
  currentAssignees: any[];
  onUpdate: (assigneeLogins: string[]) => void;
  onError: (error: string) => void;
}

interface AssigneeOption {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export class AssigneesPicker extends BasePicker {
  private field: any;
  private item: any;
  private currentAssignees: any[] = [];
  private availableAssignees: AssigneeOption[] = [];
  private selectedLogins: Set<string> = new Set();
  private filteredAssignees: AssigneeOption[] = [];
  private onUpdate: (assigneeLogins: string[]) => void;
  private onError: (error: string) => void;

  constructor(options: AssigneesPickerOptions) {
    super({
      ...options,
      title: "Select Assignees",
      searchPlaceholder: "Filter assignees...",
      onApply: () => {}, // Will be overridden by handleApply
    });

    this.field = options.field;
    this.item = options.item;
  this.currentAssignees = options.currentAssignees || [];
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;

    // Initialize selected assignees
    options.currentAssignees.forEach((assignee) => {
      if (assignee.login) {
        this.selectedLogins.add(assignee.login);
      }
    });

    // Load available assignees
    this.loadAvailableAssignees();
  }

  /**
   * Load available assignees from field options
   */
  private loadAvailableAssignees(): void {
    // Try to get assignees from field options and merge with current selections
    // so that already-selected assignees always remain visible in the dropdown.
    const byLogin = new Map<string, AssigneeOption>();

    const addAssignee = (source: any) => {
      if (!source) return;
      const login = source.login || source.name || "";
      if (!login) return;
      const name = source.name || source.login || "";
      const avatarUrl = source.avatarUrl || source.avatar || "";
      if (!byLogin.has(login)) {
        byLogin.set(login, { login, name, avatarUrl });
      }
    };

    if (Array.isArray(this.field.options)) {
      this.field.options.forEach(addAssignee);
    }

    if (Array.isArray(this.currentAssignees)) {
      this.currentAssignees.forEach(addAssignee);
    }

    this.availableAssignees = Array.from(byLogin.values()).sort((a, b) =>
      a.login.localeCompare(b.login),
    );

    this.filteredAssignees = [...this.availableAssignees];
  }

  /**
   * Render the content area with assignee checkboxes
   */
  protected renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = "";
    this.selectableItems = [];

    if (this.filteredAssignees.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.style.padding = "20px";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--vscode-descriptionForeground)";
      emptyState.textContent = "No assignees found";
      this.contentContainer.appendChild(emptyState);
      return;
    }

    this.filteredAssignees.forEach((assignee) => {
      const item = this.createAssigneeItem(assignee);
      this.contentContainer?.appendChild(item);
      this.selectableItems.push(item);
    });
  }

  /**
   * Create an assignee item with checkbox
   */
  private createAssigneeItem(assignee: AssigneeOption): HTMLElement {
    const item = document.createElement("div");
    item.className = "assignee-item";
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
    checkbox.checked = this.selectedLogins.has(assignee.login);
    checkbox.style.cursor = "pointer";
    checkbox.style.flexShrink = "0";

    // Avatar or initials
    const avatar = document.createElement("span");
    avatar.style.width = "24px";
    avatar.style.height = "24px";
    avatar.style.borderRadius = "50%";
    avatar.style.flexShrink = "0";
    avatar.style.display = "inline-flex";
    avatar.style.alignItems = "center";
    avatar.style.justifyContent = "center";
    avatar.style.fontSize = "11px";
    avatar.style.fontWeight = "600";

    if (assignee.avatarUrl) {
      avatar.style.backgroundImage = `url(${escapeHtml(assignee.avatarUrl)})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.border = "1px solid var(--vscode-panel-border)";
    } else {
      // Show initials
      const initials = (assignee.name || assignee.login || "")
        .split(" ")
        .map((part) => part[0] || "")
        .join("")
        .toUpperCase()
        .slice(0, 2);
      avatar.textContent = initials;
      avatar.style.background = "#777";
      avatar.style.color = "#fff";
    }

    // User info
    const info = document.createElement("div");
    info.style.flex = "1";
    info.style.minWidth = "0";
    info.style.display = "flex";
    info.style.flexDirection = "column";

    const loginEl = document.createElement("div");
    loginEl.textContent = assignee.login;
    loginEl.style.fontSize = "13px";
    loginEl.style.color = "var(--vscode-foreground)";
    loginEl.style.overflow = "hidden";
    loginEl.style.textOverflow = "ellipsis";
    loginEl.style.whiteSpace = "nowrap";

    info.appendChild(loginEl);

    if (assignee.name && assignee.name !== assignee.login) {
      const nameEl = document.createElement("div");
      nameEl.textContent = assignee.name;
      nameEl.style.fontSize = "11px";
      nameEl.style.color = "var(--vscode-descriptionForeground)";
      nameEl.style.overflow = "hidden";
      nameEl.style.textOverflow = "ellipsis";
      nameEl.style.whiteSpace = "nowrap";
      info.appendChild(nameEl);
    }

    item.appendChild(checkbox);
    item.appendChild(avatar);
    item.appendChild(info);

    // Optional: open profile in browser from within the picker
    if (assignee.login) {
      const profileUrl = `https://github.com/${assignee.login}`;
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.alignItems = "center";
      actions.style.marginLeft = "auto";
      actions.style.flexShrink = "0";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "assignee-open-button";
      openBtn.textContent = "↗";
      openBtn.title = "Open GitHub profile";
      openBtn.style.fontSize = "11px";
      openBtn.style.padding = "2px 4px";
      openBtn.style.cursor = "pointer";
      openBtn.style.border = "none";
      openBtn.style.background = "transparent";
      openBtn.style.color = "var(--vscode-textLink-foreground)";

      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          const messaging = (window as any).APP_MESSAGING;
          if (messaging && typeof messaging.postMessage === "function") {
            messaging.postMessage({ command: "openUrl", url: profileUrl });
          }
        } catch (err) {
          // Swallow errors in picker context
        }
      });

      actions.appendChild(openBtn);
      item.appendChild(actions);
    }

    // Toggle on click
    item.addEventListener("click", (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      this.toggleAssignee(assignee.login, checkbox.checked);
    });

    checkbox.addEventListener("change", () => {
      this.toggleAssignee(assignee.login, checkbox.checked);
    });

    return item;
  }

  /**
   * Toggle assignee selection
   */
  private toggleAssignee(login: string, selected: boolean): void {
    if (selected) {
      this.selectedLogins.add(login);
    } else {
      this.selectedLogins.delete(login);
    }
  }

  /**
   * Handle search/filter
   */
  protected handleSearch(): void {
    const searchTerm = this.searchInput?.value.toLowerCase() || "";

    if (!searchTerm) {
      this.filteredAssignees = [...this.availableAssignees];
    } else {
      this.filteredAssignees = this.availableAssignees.filter(
        (assignee) =>
          assignee.login.toLowerCase().includes(searchTerm) ||
          (assignee.name && assignee.name.toLowerCase().includes(searchTerm)),
      );
    }

    this.renderContent();
  }

  /**
   * Handle Apply action
   */
  protected handleApply(): void {
    const logins = Array.from(this.selectedLogins);
    this.onUpdate(logins);
    this.close();
  }

  /**
   * Handle Clear All action
   */
  protected handleClearAll(): void {
    this.selectedLogins.clear();
    this.renderContent();
  }
}
