/**
 * Column Header Dropdown Menu Component
 * Shows context menu when clicking column header with actions like sort, group, slice, hide, move
 */

export interface MenuOptions {
  canGroup: boolean;
  canSlice: boolean;
  canFilter: boolean;
  isGrouped?: boolean;
  isSliced?: boolean;
  currentSort?: "ASC" | "DESC" | null;
  onSort?: (direction: "ASC" | "DESC") => void;
  onGroup?: () => void;
  onSlice?: () => void;
  onClearGroup?: () => void;
  onClearSlice?: () => void;
  onClearSort?: () => void;
  onHide?: () => void;
  onMove?: (direction: "left" | "right") => void;
  onFilter?: () => void;
  // positional info for disabling move actions
  isFirst?: boolean;
  isLast?: boolean;
}

export class ColumnHeaderMenu {
  private field: any;
  private options: MenuOptions;
  private menuElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;

  constructor(field: any, options: MenuOptions) {
    this.field = field;
    this.options = options;
  }

  /**
   * Helper to get icon SVG from registry
   */
  private getIconSvg(iconName: string): string {
    if (window.getIconSvg) {
      return window.getIconSvg(iconName as any);
    }
    return "";
  }

  /**
   * Show the menu anchored below the header element
   */
  public show(anchorElement: HTMLElement): void {
    // Hide any existing menu
    this.hide();

    // Create backdrop to detect outside clicks
    this.backdropElement = document.createElement("div");
    this.backdropElement.style.position = "fixed";
    this.backdropElement.style.top = "0";
    this.backdropElement.style.left = "0";
    this.backdropElement.style.right = "0";
    this.backdropElement.style.bottom = "0";
    this.backdropElement.style.zIndex = "999";
    this.backdropElement.addEventListener("click", () => this.hide());
    document.body.appendChild(this.backdropElement);

    // Create menu
    this.menuElement = document.createElement("div");
    this.menuElement.className = "column-header-menu";
    this.menuElement.style.position = "absolute";
    this.menuElement.style.background = "var(--vscode-menu-background)";
    this.menuElement.style.border = "1px solid var(--vscode-menu-border)";
    this.menuElement.style.borderRadius = "4px";
    this.menuElement.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
    this.menuElement.style.minWidth = "180px";
    this.menuElement.style.padding = "4px 0";
    this.menuElement.style.zIndex = "1000";
    this.menuElement.style.fontSize = "13px";

    // Position below anchor
    const rect = anchorElement.getBoundingClientRect();
    this.menuElement.style.top = `${rect.bottom + 4}px`;
    this.menuElement.style.left = `${rect.left}px`;

    // Build menu items
    this.buildMenuItems();

    document.body.appendChild(this.menuElement);
  }

  /**
   * Hide and remove the menu
   */
  public hide(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
  }

  /**
   * Build menu items based on options
   */
  private buildMenuItems(): void {
    if (!this.menuElement) return;

    // Header
    this.addMenuItem("Select column", null, { isHeader: true });
    this.addSeparator();

    // Sort options (always available). If the column is currently sorted, show an 'x' clear button
    this.addMenuItem(
      "Sort ascending",
      () => {
        this.options.onSort?.("ASC");
        this.hide();
      },
      {
        icon: this.getIconSvg("sort-asc"),
        showClear: !!(this.options.currentSort === "ASC"),
        clearAction: this.options.onClearSort,
      },
    );

    this.addMenuItem(
      "Sort descending",
      () => {
        this.options.onSort?.("DESC");
        this.hide();
      },
      {
        icon: this.getIconSvg("sort-desc"),
        showClear: !!(this.options.currentSort === "DESC"),
        clearAction: this.options.onClearSort,
      },
    );

    this.addSeparator();

    // Group by (conditional)
    if (this.options.canGroup) {
      this.addMenuItem(
        "Group by values",
        () => {
          this.options.onGroup?.();
          this.hide();
        },
        {
          icon: this.getIconSvg("rows"),
          showClear: !!this.options.isGrouped,
          clearAction: this.options.onClearGroup,
        },
      );
    }

    // Slice by (conditional)
    if (this.options.canSlice) {
      this.addMenuItem(
        "Slice by values",
        () => {
          this.options.onSlice?.();
          this.hide();
        },
        {
          icon: this.getIconSvg("sliceby"),
          showClear: !!this.options.isSliced,
          clearAction: this.options.onClearSlice,
        },
      );
    }

    // Filter (conditional)
    if (this.options.canFilter) {
      this.addMenuItem("Filter by values...", () => {
        this.options.onFilter?.();
        this.hide();
      });
    }

    // Always available actions
    if (
      this.options.canGroup ||
      this.options.canSlice ||
      this.options.canFilter
    ) {
      this.addSeparator();
    }

    // Do not show hide for title fields
    const isTitle = !!(
      this.field &&
      (this.field.type === "title" ||
        String(this.field.name || "").toLowerCase() === "title" ||
        String(this.field.id || "").toLowerCase() === "title")
    );
    if (!isTitle) {
      this.addMenuItem(
        "Hide field",
        () => {
          this.options.onHide?.();
          this.hide();
        },
        {
          icon: this.getIconSvg("eye-closed"),
        },
      );
    }

    this.addSeparator();

    const disableLeft = !!this.options.isFirst;
    const disableRight = !!this.options.isLast;

    this.addMenuItem(
      "Move left",
      () => {
        if (disableLeft) return;
        this.options.onMove?.("left");
        this.hide();
      },
      {
        icon: this.getIconSvg("arrow-left"),
        disabled: disableLeft,
      },
    );

    this.addMenuItem(
      "Move right",
      () => {
        if (disableRight) return;
        this.options.onMove?.("right");
        this.hide();
      },
      {
        icon: this.getIconSvg("arrow-right"),
        disabled: disableRight,
      },
    );
  }

  /**
   * Add a menu item
   */
  private addMenuItem(
    label: string,
    onClick: (() => void) | null,
    options?: {
      isHeader?: boolean;
      icon?: string;
      showClear?: boolean;
      clearAction?: (() => void) | null;
      disabled?: boolean;
    },
  ): void {
    if (!this.menuElement) return;
    const item = document.createElement("div");
    item.className = "menu-item";

    if (options?.isHeader) {
      item.textContent = label;
      item.style.padding = "6px 12px";
      item.style.fontWeight = "600";
      item.style.color = "var(--vscode-descriptionForeground)";
      item.style.fontSize = "11px";
      item.style.textTransform = "uppercase";
      item.style.cursor = "default";
      this.menuElement.appendChild(item);
      return;
    }

    // Non-header item layout: optional icon on left, label, optional clear 'x' button on the right
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.padding = "6px 12px";
    item.style.cursor = "pointer";
    item.style.color = "var(--vscode-menu-foreground)";

    // Left icon
    if (options?.icon) {
      const iconEl = document.createElement("span");
      iconEl.className = "menu-item-icon";
      iconEl.style.display = "inline-block";
      iconEl.style.width = "14px";
      iconEl.style.marginRight = "8px";
      iconEl.style.flex = "0 0 auto";
      // allow callers to pass either a short glyph or full SVG string
      iconEl.innerHTML = options.icon;
      item.appendChild(iconEl);
    }

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.flex = "1";
    labelEl.style.whiteSpace = "nowrap";
    labelEl.style.overflow = "hidden";
    labelEl.style.textOverflow = "ellipsis";

    item.appendChild(labelEl);

    // Optional clear 'x' button
    if (options?.showClear && options?.clearAction) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "✕";
      clearBtn.title = "Clear";
      clearBtn.style.border = "none";
      clearBtn.style.background = "transparent";
      clearBtn.style.cursor = "pointer";
      clearBtn.style.padding = "2px 6px";
      clearBtn.style.marginLeft = "8px";
      clearBtn.style.color = "var(--vscode-menu-foreground)";

      clearBtn.addEventListener("mouseenter", () => {
        clearBtn.style.color = "var(--vscode-menu-selectionForeground)";
        clearBtn.style.background = "var(--vscode-menu-selectionBackground)";
      });
      clearBtn.addEventListener("mouseleave", () => {
        clearBtn.style.color = "var(--vscode-menu-foreground)";
        clearBtn.style.background = "transparent";
      });

      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        options.clearAction && options.clearAction();
        this.hide();
      });

      item.appendChild(clearBtn);
    }

    // Disabled state
    if (options?.disabled) {
      item.style.opacity = "0.5";
      item.style.cursor = "default";
    }

    if (onClick) {
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--vscode-menu-selectionBackground)";
        item.style.color = "var(--vscode-menu-selectionForeground)";
      });

      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.color = "var(--vscode-menu-foreground)";
      });

      item.addEventListener("click", () => {
        if (options?.disabled) return;
        onClick();
      });
    }

    this.menuElement.appendChild(item);
  }

  /**
   * Add menu separator
   */
  private addSeparator(): void {
    if (!this.menuElement) return;

    const separator = document.createElement("div");
    separator.style.height = "1px";
    separator.style.background = "var(--vscode-menu-separatorBackground)";
    separator.style.margin = "4px 0";

    this.menuElement.appendChild(separator);
  }
}
