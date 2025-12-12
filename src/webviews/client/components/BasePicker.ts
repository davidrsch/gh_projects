/**
 * Base Picker Component
 * Provides common functionality for all picker components including:
 * - Popover positioning and lifecycle
 * - Keyboard navigation
 * - Search/filter functionality
 * - Backdrop handling
 */

export interface BasePickerOptions {
  anchorElement: HTMLElement;
  title: string;
  onClose: () => void;
  onApply?: () => void;
  searchPlaceholder?: string;
  minWidth?: string;
  maxHeight?: string;
}

export abstract class BasePicker {
  protected pickerElement: HTMLElement | null = null;
  protected backdropElement: HTMLElement | null = null;
  protected searchInput: HTMLInputElement | null = null;
  protected contentContainer: HTMLElement | null = null;
  protected options: BasePickerOptions;
  protected focusedIndex: number = -1;
  protected selectableItems: HTMLElement[] = [];

  constructor(options: BasePickerOptions) {
    this.options = options;
  }

  /**
   * Show the picker anchored to the provided element
   */
  public show(): void {
    this.hide();

    // Create backdrop
    this.backdropElement = document.createElement("div");
    this.backdropElement.style.position = "fixed";
    this.backdropElement.style.top = "0";
    this.backdropElement.style.left = "0";
    this.backdropElement.style.right = "0";
    this.backdropElement.style.bottom = "0";
    this.backdropElement.style.zIndex = "999";
    this.backdropElement.addEventListener("click", () => this.close());
    document.body.appendChild(this.backdropElement);

    // Create picker container
    this.pickerElement = document.createElement("div");
    this.pickerElement.className = "field-picker";
    this.pickerElement.style.position = "absolute";
    this.pickerElement.style.background = "var(--vscode-menu-background)";
    this.pickerElement.style.border = "1px solid var(--vscode-menu-border)";
    this.pickerElement.style.borderRadius = "4px";
    this.pickerElement.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
    this.pickerElement.style.minWidth = this.options.minWidth || "280px";
    this.pickerElement.style.maxWidth = "400px";
    this.pickerElement.style.zIndex = "1000";
    this.pickerElement.style.display = "flex";
    this.pickerElement.style.flexDirection = "column";
    this.pickerElement.style.overflow = "hidden";

    // Position below anchor
    const rect = this.options.anchorElement.getBoundingClientRect();
    this.pickerElement.style.top = `${rect.bottom + 4}px`;
    this.pickerElement.style.left = `${rect.left}px`;

    // Build picker structure
    this.buildHeader();
    this.buildSearchBox();
    this.buildContent();
    this.buildFooter();

    document.body.appendChild(this.pickerElement);

    // Focus search input if available
    if (this.searchInput) {
      setTimeout(() => this.searchInput?.focus(), 0);
    }

    // Setup keyboard navigation
    this.setupKeyboardNavigation();
  }

  /**
   * Hide and cleanup the picker
   */
  public hide(): void {
    if (this.pickerElement) {
      this.pickerElement.remove();
      this.pickerElement = null;
    }
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
    this.searchInput = null;
    this.contentContainer = null;
    this.selectableItems = [];
    this.focusedIndex = -1;
  }

  /**
   * Close picker and trigger onClose callback
   */
  protected close(): void {
    this.hide();
    this.options.onClose();
  }

  /**
   * Build the header section
   */
  private buildHeader(): void {
    if (!this.pickerElement) return;

    const header = document.createElement("div");
    header.style.padding = "12px";
    header.style.borderBottom = "1px solid var(--vscode-menu-separatorBackground)";
    header.style.fontWeight = "600";
    header.style.fontSize = "13px";
    header.style.color = "var(--vscode-foreground)";
    header.textContent = this.options.title;

    this.pickerElement.appendChild(header);
  }

  /**
   * Build the search box
   */
  private buildSearchBox(): void {
    if (!this.pickerElement || !this.options.searchPlaceholder) return;

    const searchContainer = document.createElement("div");
    searchContainer.style.padding = "8px 12px";
    searchContainer.style.borderBottom = "1px solid var(--vscode-menu-separatorBackground)";

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = this.options.searchPlaceholder;
    this.searchInput.style.width = "100%";
    this.searchInput.style.padding = "6px 8px";
    this.searchInput.style.border = "1px solid var(--vscode-input-border)";
    this.searchInput.style.background = "var(--vscode-input-background)";
    this.searchInput.style.color = "var(--vscode-input-foreground)";
    this.searchInput.style.borderRadius = "2px";
    this.searchInput.style.fontSize = "13px";
    this.searchInput.style.boxSizing = "border-box";

    this.searchInput.addEventListener("input", () => this.handleSearch());
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    searchContainer.appendChild(this.searchInput);
    this.pickerElement.appendChild(searchContainer);
  }

  /**
   * Build the content area
   */
  private buildContent(): void {
    if (!this.pickerElement) return;

    this.contentContainer = document.createElement("div");
    this.contentContainer.className = "picker-content";
    this.contentContainer.style.maxHeight = this.options.maxHeight || "300px";
    this.contentContainer.style.overflowY = "auto";
    this.contentContainer.style.padding = "4px 0";

    this.renderContent();

    this.pickerElement.appendChild(this.contentContainer);
  }

  /**
   * Build the footer with action buttons
   */
  private buildFooter(): void {
    if (!this.pickerElement) return;

    const footer = document.createElement("div");
    footer.style.padding = "8px 12px";
    footer.style.borderTop = "1px solid var(--vscode-menu-separatorBackground)";
    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.justifyContent = "flex-end";

    // Clear All button
    const clearBtn = this.createButton("Clear All", () => {
      this.handleClearAll();
    });
    clearBtn.style.marginRight = "auto";
    footer.appendChild(clearBtn);

    // Apply button
    if (this.options.onApply) {
      const applyBtn = this.createButton("Apply", () => {
        this.handleApply();
      });
      applyBtn.style.background = "var(--vscode-button-background)";
      applyBtn.style.color = "var(--vscode-button-foreground)";
      applyBtn.addEventListener("mouseenter", () => {
        applyBtn.style.background = "var(--vscode-button-hoverBackground)";
      });
      applyBtn.addEventListener("mouseleave", () => {
        applyBtn.style.background = "var(--vscode-button-background)";
      });
      footer.appendChild(applyBtn);
    }

    this.pickerElement.appendChild(footer);
  }

  /**
   * Create a button element
   */
  protected createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.style.padding = "6px 12px";
    btn.style.border = "1px solid var(--vscode-button-border)";
    btn.style.borderRadius = "2px";
    btn.style.background = "var(--vscode-button-secondaryBackground)";
    btn.style.color = "var(--vscode-button-secondaryForeground)";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "13px";

    btn.addEventListener("click", onClick);

    return btn;
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    if (!this.pickerElement) return;

    this.pickerElement.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          this.navigateDown();
          break;
        case "ArrowUp":
          e.preventDefault();
          this.navigateUp();
          break;
        case "Enter":
          e.preventDefault();
          this.handleEnter();
          break;
        case "Escape":
          e.preventDefault();
          this.close();
          break;
      }
    });
  }

  /**
   * Navigate to next item
   */
  private navigateDown(): void {
    if (this.selectableItems.length === 0) return;

    this.focusedIndex = (this.focusedIndex + 1) % this.selectableItems.length;
    this.updateFocus();
  }

  /**
   * Navigate to previous item
   */
  private navigateUp(): void {
    if (this.selectableItems.length === 0) return;

    this.focusedIndex =
      this.focusedIndex <= 0
        ? this.selectableItems.length - 1
        : this.focusedIndex - 1;
    this.updateFocus();
  }

  /**
   * Update focus highlight
   */
  private updateFocus(): void {
    this.selectableItems.forEach((item, index) => {
      if (index === this.focusedIndex) {
        item.style.background = "var(--vscode-list-focusBackground)";
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.style.background = "transparent";
      }
    });
  }

  /**
   * Handle Enter key
   */
  private handleEnter(): void {
    if (
      this.focusedIndex >= 0 &&
      this.focusedIndex < this.selectableItems.length
    ) {
      this.selectableItems[this.focusedIndex].click();
    }
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract renderContent(): void;
  protected abstract handleSearch(): void;
  protected abstract handleApply(): void;
  protected abstract handleClearAll(): void;
}
