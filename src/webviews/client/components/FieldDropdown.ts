import { escapeHtml, normalizeColor, addAlpha } from "../utils";

export interface DropdownOption {
  id: string | null; // null for "Clear" option
  label: string;
  description?: string;
  color?: string;
  metadata?: any; // Additional data like iteration dates
}

export interface DropdownConfig {
  options: DropdownOption[];
  currentValue: string | null; // ID of currently selected option
  anchorElement: HTMLElement;
  onSelect: (optionId: string | null) => void;
  onClose: () => void;
  title?: string;
  emptyMessage?: string;
}

/**
 * Reusable dropdown component for field value selection.
 * Supports keyboard navigation and proper positioning.
 */
export class FieldDropdown {
  private container: HTMLElement;
  private backdrop: HTMLElement;
  private config: DropdownConfig;
  private selectedIndex: number = 0;
  private mounted: boolean = false;

  constructor(config: DropdownConfig) {
    this.config = config;
    this.container = this.createDropdown();
    this.backdrop = this.createBackdrop();
    
    // Find currently selected index
    this.selectedIndex = Math.max(
      0,
      this.config.options.findIndex((opt) => opt.id === this.config.currentValue)
    );
  }

  private createBackdrop(): HTMLElement {
    const backdrop = document.createElement("div");
    backdrop.className = "field-dropdown-backdrop";
    backdrop.style.position = "fixed";
    backdrop.style.top = "0";
    backdrop.style.left = "0";
    backdrop.style.right = "0";
    backdrop.style.bottom = "0";
    backdrop.style.zIndex = "999";
    backdrop.style.background = "transparent";

    backdrop.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });

    // Handle escape key
    backdrop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });

    return backdrop;
  }

  private createDropdown(): HTMLElement {
    const dropdown = document.createElement("div");
    dropdown.className = "field-dropdown";
    dropdown.style.position = "absolute";
    dropdown.style.background = "var(--vscode-menu-background)";
    dropdown.style.border = "1px solid var(--vscode-menu-border)";
    dropdown.style.borderRadius = "4px";
    dropdown.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    dropdown.style.minWidth = "200px";
    dropdown.style.maxWidth = "350px";
    dropdown.style.maxHeight = "400px";
    dropdown.style.overflowY = "auto";
    dropdown.style.zIndex = "1000";
    dropdown.style.fontSize = "13px";

    // Add title if provided
    if (this.config.title) {
      const title = document.createElement("div");
      title.className = "field-dropdown-title";
      title.textContent = this.config.title;
      title.style.padding = "8px 12px";
      title.style.fontWeight = "600";
      title.style.borderBottom = "1px solid var(--vscode-menu-separatorBackground)";
      title.style.color = "var(--vscode-descriptionForeground)";
      title.style.fontSize = "11px";
      title.style.textTransform = "uppercase";
      dropdown.appendChild(title);
    }

    // Add options
    if (this.config.options.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "field-dropdown-empty";
      emptyMsg.textContent = this.config.emptyMessage || "No options available";
      emptyMsg.style.padding = "12px";
      emptyMsg.style.color = "var(--vscode-descriptionForeground)";
      emptyMsg.style.fontStyle = "italic";
      dropdown.appendChild(emptyMsg);
    } else {
      this.config.options.forEach((option, index) => {
        const item = this.createOptionElement(option, index);
        dropdown.appendChild(item);
      });
    }

    // Keyboard navigation
    dropdown.addEventListener("keydown", (e) => {
      this.handleKeyDown(e);
    });

    dropdown.tabIndex = 0; // Make focusable

    return dropdown;
  }

  private createOptionElement(option: DropdownOption, index: number): HTMLElement {
    const item = document.createElement("div");
    item.className = "field-dropdown-option";
    item.dataset.index = String(index);
    item.style.padding = "8px 12px";
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "8px";
    item.style.color = "var(--vscode-menu-foreground)";
    item.style.transition = "background-color 0.1s ease";

    // Highlight if selected
    if (option.id === this.config.currentValue) {
      item.style.background = "var(--vscode-menu-selectionBackground)";
      item.style.color = "var(--vscode-menu-selectionForeground)";
      item.classList.add("selected");
    }

    // Color swatch (for single-select options)
    if (option.color) {
      const swatch = document.createElement("div");
      swatch.className = "field-dropdown-swatch";
      const normalizedColor = normalizeColor(option.color) || "#999";
      swatch.style.width = "16px";
      swatch.style.height = "16px";
      swatch.style.borderRadius = "3px";
      swatch.style.background = normalizedColor;
      swatch.style.border = "1px solid rgba(0,0,0,0.2)";
      swatch.style.flexShrink = "0";
      item.appendChild(swatch);
    }

    // Label and description container
    const textContainer = document.createElement("div");
    textContainer.style.flex = "1";
    textContainer.style.minWidth = "0";

    const label = document.createElement("div");
    label.className = "field-dropdown-label";
    label.textContent = option.label;
    label.style.fontWeight = option.id === null ? "600" : "normal";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.style.whiteSpace = "nowrap";
    textContainer.appendChild(label);

    // Description or metadata
    if (option.description || option.metadata) {
      const desc = document.createElement("div");
      desc.className = "field-dropdown-description";
      desc.textContent = option.description || (option.metadata?.dateRange || "");
      desc.style.fontSize = "11px";
      desc.style.color = "var(--vscode-descriptionForeground)";
      desc.style.overflow = "hidden";
      desc.style.textOverflow = "ellipsis";
      desc.style.whiteSpace = "nowrap";
      desc.style.marginTop = "2px";
      textContainer.appendChild(desc);
    }

    item.appendChild(textContainer);

    // Hover effect
    item.addEventListener("mouseenter", () => {
      this.highlightOption(index);
    });

    // Click handler
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectOption(option.id);
    });

    return item;
  }

  private highlightOption(index: number) {
    // Remove highlight from all options
    const items = this.container.querySelectorAll(".field-dropdown-option");
    items.forEach((item) => {
      const el = item as HTMLElement;
      if (!el.classList.contains("selected")) {
        el.style.background = "transparent";
        el.style.color = "var(--vscode-menu-foreground)";
      }
    });

    // Highlight the new option
    this.selectedIndex = index;
    const targetItem = items[index] as HTMLElement;
    if (targetItem && !targetItem.classList.contains("selected")) {
      targetItem.style.background = "var(--vscode-list-hoverBackground)";
      targetItem.style.color = "var(--vscode-menu-foreground)";
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.config.options.length - 1
        );
        this.highlightOption(this.selectedIndex);
        this.scrollToOption(this.selectedIndex);
        break;

      case "ArrowUp":
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.highlightOption(this.selectedIndex);
        this.scrollToOption(this.selectedIndex);
        break;

      case "Enter":
        e.preventDefault();
        const selectedOption = this.config.options[this.selectedIndex];
        if (selectedOption) {
          this.selectOption(selectedOption.id);
        }
        break;

      case "Escape":
        e.preventDefault();
        this.close();
        break;
    }
  }

  private scrollToOption(index: number) {
    const items = this.container.querySelectorAll(".field-dropdown-option");
    const item = items[index] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  private selectOption(optionId: string | null) {
    this.config.onSelect(optionId);
    this.close();
  }

  private close() {
    if (!this.mounted) return;
    this.mounted = false;
    
    if (this.container.parentElement) {
      this.container.remove();
    }
    if (this.backdrop.parentElement) {
      this.backdrop.remove();
    }
    
    this.config.onClose();
  }

  public show() {
    if (this.mounted) return;
    
    this.mounted = true;
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.container);

    // Position dropdown relative to anchor
    this.positionDropdown();

    // Focus dropdown for keyboard navigation
    setTimeout(() => {
      this.container.focus();
      // Scroll to selected option
      if (this.selectedIndex >= 0) {
        this.scrollToOption(this.selectedIndex);
      }
    }, 0);

    // Reposition on scroll/resize
    window.addEventListener("scroll", this.handleScroll, true);
    window.addEventListener("resize", this.handleResize);
  }

  private handleScroll = () => {
    this.positionDropdown();
  };

  private handleResize = () => {
    this.positionDropdown();
  };

  private positionDropdown() {
    const anchorRect = this.config.anchorElement.getBoundingClientRect();
    const dropdownRect = this.container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = anchorRect.bottom + 4;
    let left = anchorRect.left;

    // Flip above if not enough space below
    if (top + dropdownRect.height > viewportHeight && anchorRect.top > dropdownRect.height) {
      top = anchorRect.top - dropdownRect.height - 4;
    }

    // Adjust horizontal position if overflowing
    if (left + dropdownRect.width > viewportWidth) {
      left = Math.max(4, viewportWidth - dropdownRect.width - 4);
    }

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  public destroy() {
    window.removeEventListener("scroll", this.handleScroll, true);
    window.removeEventListener("resize", this.handleResize);
    this.close();
  }
}
