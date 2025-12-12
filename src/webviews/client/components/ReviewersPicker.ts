/**
 * Reviewers Picker Component
 * Allows users to select multiple reviewers (users and teams) for a pull request
 */

import { BasePicker, BasePickerOptions } from "./BasePicker";
import { escapeHtml } from "../utils";

export interface ReviewersPickerOptions extends Omit<
  BasePickerOptions,
  "title"
> {
  field: any;
  item: any;
  currentReviewers: any[];
  onUpdate: (reviewerLogins: string[]) => void;
  onError: (error: string) => void;
}

interface ReviewerOption {
  login: string;
  name?: string;
  avatarUrl?: string;
  kind?: string; // 'User' or 'Team'
}

export class ReviewersPicker extends BasePicker {
  private field: any;
  private item: any;
  private currentReviewers: any[] = [];
  private availableReviewers: ReviewerOption[] = [];
  private selectedLogins: Set<string> = new Set();
  private filteredReviewers: ReviewerOption[] = [];
  private onUpdate: (reviewerLogins: string[]) => void;
  private onError: (error: string) => void;

  constructor(options: ReviewersPickerOptions) {
    super({
      ...options,
      title: "Select Reviewers",
      searchPlaceholder: "Filter reviewers...",
      onApply: () => {}, // Will be overridden by handleApply
    });

    this.field = options.field;
    this.item = options.item;
  this.currentReviewers = options.currentReviewers || [];
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;

    // Initialize selected reviewers
    options.currentReviewers.forEach((reviewer) => {
      if (reviewer.login) {
        this.selectedLogins.add(reviewer.login);
      }
    });

    // Load available reviewers
    this.loadAvailableReviewers();
  }

  /**
   * Load available reviewers from field options
   */
  private loadAvailableReviewers(): void {
    const byLogin = new Map<string, ReviewerOption>();

    const addReviewer = (source: any) => {
      if (!source) return;
      const login = source.login || source.name || "";
      if (!login) return;
      const name = source.name || source.login || "";
      const avatarUrl = source.avatarUrl || source.avatar || "";
      const kind = source.kind || source.__typename || "User";
      if (!byLogin.has(login)) {
        byLogin.set(login, { login, name, avatarUrl, kind });
      }
    };

    if (Array.isArray(this.field.options)) {
      this.field.options.forEach(addReviewer);
    }

    if (Array.isArray(this.currentReviewers)) {
      this.currentReviewers.forEach(addReviewer);
    }

    this.availableReviewers = Array.from(byLogin.values()).sort((a, b) =>
      a.login.localeCompare(b.login),
    );

    this.filteredReviewers = [...this.availableReviewers];
  }

  /**
   * Render the content area with reviewer checkboxes
   */
  protected renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = "";
    this.selectableItems = [];

    if (this.filteredReviewers.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.style.padding = "20px";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--vscode-descriptionForeground)";
      emptyState.textContent = "No reviewers found";
      this.contentContainer.appendChild(emptyState);
      return;
    }

    this.filteredReviewers.forEach((reviewer) => {
      const item = this.createReviewerItem(reviewer);
      this.contentContainer?.appendChild(item);
      this.selectableItems.push(item);
    });
  }

  /**
   * Create a reviewer item with checkbox
   */
  private createReviewerItem(reviewer: ReviewerOption): HTMLElement {
    const item = document.createElement("div");
    item.className = "reviewer-item";
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
    checkbox.checked = this.selectedLogins.has(reviewer.login);
    checkbox.style.cursor = "pointer";
    checkbox.style.flexShrink = "0";

    // Avatar or team icon
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

    const isTeam =
      reviewer.kind &&
      (reviewer.kind.toLowerCase().includes("team") ||
        reviewer.kind === "Team");

    if (reviewer.avatarUrl) {
      avatar.style.backgroundImage = `url(${escapeHtml(reviewer.avatarUrl)})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.border = "1px solid var(--vscode-panel-border)";
    } else {
      // Show initials or team icon
      if (isTeam) {
        const TEAM_ICON = "&#128101;"; // 👥 Two person silhouette emoji
        avatar.innerHTML = TEAM_ICON;
        avatar.style.background = "#555";
        avatar.style.color = "#fff";
      } else {
        const initials = (reviewer.name || reviewer.login || "")
          .split(" ")
          .map((part) => part[0] || "")
          .join("")
          .toUpperCase()
          .slice(0, 2);
        avatar.textContent = initials;
        avatar.style.background = "#777";
        avatar.style.color = "#fff";
      }
    }

    // Reviewer info
    const info = document.createElement("div");
    info.style.flex = "1";
    info.style.minWidth = "0";
    info.style.display = "flex";
    info.style.flexDirection = "column";

    const loginEl = document.createElement("div");
    loginEl.textContent = reviewer.login;
    loginEl.style.fontSize = "13px";
    loginEl.style.color = "var(--vscode-foreground)";
    loginEl.style.overflow = "hidden";
    loginEl.style.textOverflow = "ellipsis";
    loginEl.style.whiteSpace = "nowrap";

    info.appendChild(loginEl);

    if (reviewer.name && reviewer.name !== reviewer.login) {
      const nameEl = document.createElement("div");
      nameEl.textContent = reviewer.name;
      nameEl.style.fontSize = "11px";
      nameEl.style.color = "var(--vscode-descriptionForeground)";
      nameEl.style.overflow = "hidden";
      nameEl.style.textOverflow = "ellipsis";
      nameEl.style.whiteSpace = "nowrap";
      info.appendChild(nameEl);
    }

    // Show kind badge for teams
    if (isTeam) {
      const kindBadge = document.createElement("span");
      kindBadge.textContent = "Team";
      kindBadge.style.fontSize = "10px";
      kindBadge.style.padding = "2px 6px";
      kindBadge.style.background = "var(--vscode-badge-background)";
      kindBadge.style.color = "var(--vscode-badge-foreground)";
      kindBadge.style.borderRadius = "2px";
      kindBadge.style.marginLeft = "auto";
      kindBadge.style.flexShrink = "0";
      item.appendChild(kindBadge);
    }

    item.appendChild(checkbox);
    item.appendChild(avatar);
    item.appendChild(info);

    // Optional: open profile/team page in browser from within the picker
    if (reviewer.login) {
      const profileUrl = `https://github.com/${reviewer.login}`;
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.alignItems = "center";
      actions.style.marginLeft = "auto";
      actions.style.flexShrink = "0";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "reviewer-open-button";
      openBtn.textContent = "↗";
      openBtn.title = isTeam
        ? "Open GitHub team page"
        : "Open GitHub profile";
      openBtn.style.fontSize = "11px";
      openBtn.style.padding = "2px 4px";
      openBtn.style.cursor = "pointer";
      openBtn.style.border = "none";
      openBtn.style.background = "transparent";
      openBtn.style.color = "var(--vscode-textLink-foreground)";

      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          const messaging = (window as any).__APP_MESSAGING__;
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
      this.toggleReviewer(reviewer.login, checkbox.checked);
    });

    checkbox.addEventListener("change", () => {
      this.toggleReviewer(reviewer.login, checkbox.checked);
    });

    return item;
  }

  /**
   * Toggle reviewer selection
   */
  private toggleReviewer(login: string, selected: boolean): void {
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
      this.filteredReviewers = [...this.availableReviewers];
    } else {
      this.filteredReviewers = this.availableReviewers.filter(
        (reviewer) =>
          reviewer.login.toLowerCase().includes(searchTerm) ||
          (reviewer.name && reviewer.name.toLowerCase().includes(searchTerm)),
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
