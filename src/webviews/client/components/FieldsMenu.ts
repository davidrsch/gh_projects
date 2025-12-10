/**
 * Fields Menu
 * Dropdown used from table plus-column. Shows project fields split into Visible / Hidden sections
 * First item is a "+ New field" button. Visible fields show a leading checkmark.
 */

export interface FieldItem {
  id: string;
  name: string;
  iconClass?: string;
  dataType?: string;
}

export interface FieldsMenuOptions {
  fields: FieldItem[];
  visibleFieldIds: Set<string>;
  onToggleVisibility?: (fieldId: string, visible: boolean) => void;
  onCreateField?: () => void;
}

export class FieldsMenu {
  private options: FieldsMenuOptions;
  private menuElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;

  constructor(options: FieldsMenuOptions) {
    this.options = options;
  }

  public show(anchorElement: HTMLElement) {
    this.hide();

    // Backdrop to detect outside clicks
    this.backdropElement = document.createElement("div");
    this.backdropElement.style.position = "fixed";
    this.backdropElement.style.top = "0";
    this.backdropElement.style.left = "0";
    this.backdropElement.style.right = "0";
    this.backdropElement.style.bottom = "0";
    this.backdropElement.style.zIndex = "998";
    this.backdropElement.addEventListener("click", () => this.hide());
    document.body.appendChild(this.backdropElement);

    // Create menu offscreen first so we can measure size and pick best placement
    this.menuElement = document.createElement("div");
    this.menuElement.className = "fields-menu";
    this.menuElement.style.position = "absolute";
    this.menuElement.style.visibility = "hidden";
    this.menuElement.style.left = "0px";
    this.menuElement.style.top = "0px";
    this.menuElement.style.background = "var(--vscode-menu-background)";
    this.menuElement.style.border = "1px solid var(--vscode-menu-border)";
    this.menuElement.style.borderRadius = "4px";
    this.menuElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    this.menuElement.style.minWidth = "220px";
    this.menuElement.style.padding = "6px 0";
    // When there are many fields, allow the menu to scroll vertically instead of growing off-screen
    this.menuElement.style.maxHeight = "60vh";
    this.menuElement.style.overflowY = "auto";
    this.menuElement.style.boxSizing = "border-box";
    this.menuElement.style.zIndex = "1000";
    this.menuElement.style.fontSize = "13px";

    // Append hidden, build, measure, then position
    document.body.appendChild(this.menuElement);
    this.buildMenu();

    const rect = anchorElement.getBoundingClientRect();
    const menuRect = this.menuElement.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Vertical placement: prefer below, otherwise above, else clamp
    let top = rect.bottom + margin;
    if (rect.bottom + menuRect.height + margin > vh) {
      // try above
      if (rect.top - menuRect.height - margin >= 0) {
        top = rect.top - menuRect.height - margin;
      } else {
        // clamp within viewport
        top = Math.max(
          margin,
          Math.min(vh - menuRect.height - margin, rect.bottom + margin),
        );
      }
    }

    // Horizontal placement: align left by default, but adjust if overflowing
    let left = rect.left;
    if (rect.left + menuRect.width + margin > vw) {
      // try align to right edge of anchor
      left = Math.max(margin, rect.right - menuRect.width);
    }
    // Clamp left
    left = Math.max(margin, Math.min(left, vw - menuRect.width - margin));

    this.menuElement.style.top = `${Math.round(top)}px`;
    this.menuElement.style.left = `${Math.round(left)}px`;
    this.menuElement.style.visibility = "visible";
  }

  public hide() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
  }

  private buildMenu() {
    if (!this.menuElement) return;

    // Header
    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.padding = "6px 12px";
    title.style.fontWeight = "600";
    title.style.color = "var(--vscode-descriptionForeground)";
    title.style.fontSize = "12px";
    title.style.textTransform = "uppercase";

    const icon = document.createElement("i");
    icon.className = "octicon octicon-note";
    icon.style.marginRight = "8px";
    title.appendChild(icon);

    const label = document.createElement("span");
    label.textContent = "Fields";
    title.appendChild(label);

    this.menuElement.appendChild(title);
    this.addSeparator();

    // + New field
    const newField = document.createElement("div");
    newField.style.display = "flex";
    newField.style.alignItems = "center";
    newField.style.padding = "6px 12px";
    newField.style.cursor = "pointer";
    newField.style.color = "var(--vscode-menu-foreground)";
    newField.innerHTML = `<span style="margin-right:8px;font-weight:700">+</span><span>New field</span>`;
    newField.addEventListener("mouseenter", () => {
      newField.style.background = "var(--vscode-menu-selectionBackground)";
      newField.style.color = "var(--vscode-menu-selectionForeground)";
    });
    newField.addEventListener("mouseleave", () => {
      newField.style.background = "transparent";
      newField.style.color = "var(--vscode-menu-foreground)";
    });
    newField.addEventListener("click", () => {
      this.options.onCreateField?.();
      this.hide();
    });
    this.menuElement.appendChild(newField);

    this.addSeparator();

    const visible = this.options.fields.filter((f) =>
      this.options.visibleFieldIds.has(f.id),
    );
    const hidden = this.options.fields.filter(
      (f) => !this.options.visibleFieldIds.has(f.id),
    );

    this.addSectionHeader("Visible fields");
    if (visible.length === 0) this.addEmptyRow("No visible fields");
    else visible.forEach((f) => this.addFieldRow(f, true));

    this.addSeparator();

    this.addSectionHeader("Hidden fields");
    if (hidden.length === 0) this.addEmptyRow("No hidden fields");
    else hidden.forEach((f) => this.addFieldRow(f, false));
  }

  private addSectionHeader(text: string) {
    if (!this.menuElement) return;
    const h = document.createElement("div");
    h.textContent = text;
    h.style.padding = "6px 12px";
    h.style.fontSize = "11px";
    h.style.fontWeight = "600";
    h.style.color = "var(--vscode-descriptionForeground)";
    h.style.textTransform = "uppercase";
    this.menuElement.appendChild(h);
  }
  private addEmptyRow(text: string) {
    if (!this.menuElement) return;
    const r = document.createElement("div");
    r.textContent = text;
    r.style.padding = "6px 12px";
    r.style.color = "var(--vscode-menu-foreground)";
    r.style.opacity = "0.8";
    this.menuElement.appendChild(r);
  }

  private addFieldRow(field: FieldItem, visible: boolean) {
    if (!this.menuElement) return;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.padding = "6px 12px";
    row.style.cursor = "pointer";
    row.style.color = "var(--vscode-menu-foreground)";

    if (visible) {
      const c = document.createElement("span");
      c.textContent = "✓";
      c.style.marginRight = "8px";
      c.style.color = "var(--vscode-menu-selectionForeground)";
      row.appendChild(c);
    } else {
      const s = document.createElement("span");
      s.style.display = "inline-block";
      s.style.width = "14px";
      s.style.marginRight = "8px";
      row.appendChild(s);
    }

    // Determine icon SVG based on field dataType or provided iconClass. Use placeholder tokens for octicon paths so user can replace them later.
    const iconHtml = this.getIconForField(field);
    const icon = document.createElement("span");
    icon.innerHTML = iconHtml;
    icon.style.marginRight = "8px";
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    row.appendChild(icon);
    const label = document.createElement("span");
    label.textContent = field.name;
    label.style.flex = "1";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    row.appendChild(label);

    row.addEventListener("mouseenter", () => {
      row.style.background = "var(--vscode-menu-selectionBackground)";
      row.style.color = "var(--vscode-menu-selectionForeground)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "transparent";
      row.style.color = "var(--vscode-menu-foreground)";
    });
    row.addEventListener("click", () => {
      const newVisible = !visible;
      this.options.onToggleVisibility?.(field.id, newVisible);
      if (newVisible) this.options.visibleFieldIds.add(field.id);
      else this.options.visibleFieldIds.delete(field.id);
      this.menuElement && ((this.menuElement.innerHTML = ""), this.buildMenu());
    });

    this.menuElement.appendChild(row);
  }

  private addSeparator() {
    if (!this.menuElement) return;
    const s = document.createElement("div");
    s.style.height = "1px";
    s.style.background = "var(--vscode-menu-separatorBackground)";
    s.style.margin = "6px 0";
    this.menuElement.appendChild(s);
  }

  /**
   * Return inline SVG HTML for the given field using the icon registry.
   */
  private getIconForField(field: FieldItem): string {
    const dataType = (field.dataType || "").toString().toLowerCase();

    // If getIconNameForDataType is available from the icon registry, use it
    if (typeof (window as any).getIconNameForDataType === "function" && typeof (window as any).getIconSvg === "function") {
      const iconName = (window as any).getIconNameForDataType(dataType);
      return (window as any).getIconSvg(iconName);
    }

    // Fallback: use provided CSS iconClass if available
    if (field.iconClass) {
      return `<i class="${field.iconClass}"></i>`;
    }

    // Ultimate fallback: empty span
    return '<span></span>';
  }
}

export default FieldsMenu;
