export interface ColumnHeaderOptions {
  fields: any[];
  sortConfig: any;
  groupingFieldName?: string;
  activeSlice: any;
  activeSlicePanelFieldId: string | null;
  onHeaderMenu: (e: MouseEvent, field: any, th: HTMLElement) => void;
  onShowFieldsMenu: (anchor: HTMLElement) => void;
  onClearGroup: (field: any) => void;
  onClearSlice: (field: any) => void;
}

export class ColumnHeaderRenderer {
  constructor(private options: ColumnHeaderOptions) {}

  /**
   * Helper to get icon SVG from registry
   */
  private getIconSvg(iconName: string): string {
    if (typeof (window as any).getIconSvg === "function") {
      return (window as any).getIconSvg(iconName);
    }
    return "";
  }

  public render(table: HTMLTableElement) {
    const thead = document.createElement("thead");
    thead.style.background = "var(--vscode-sideBar-background)";
    thead.style.position = "sticky";
    thead.style.top = "0";
    thead.style.zIndex = "10";

    const tr = document.createElement("tr");

    // Index Header
    const thIndex = document.createElement("th");
    thIndex.textContent = "#";
    this.styleHeaderCell(thIndex);
    tr.appendChild(thIndex);

    // Field Headers
    for (const field of this.options.fields) {
      const th = document.createElement("th");

      // Create header content wrapper
      const headerContent = document.createElement("div");
      headerContent.style.display = "flex";
      headerContent.style.alignItems = "center";
      headerContent.style.justifyContent = "space-between";
      headerContent.style.width = "100%";
      headerContent.style.gap = "4px";

      // Field name span
      const nameSpan = document.createElement("span");
      let headerText = field.name || field.id || "";

      // Add sort indicator if this field is sorted
      if (this.options.sortConfig?.fieldId === field.id) {
        const indicator =
          this.options.sortConfig?.direction === "ASC" ? " ↑" : " ↓";
        headerText += indicator;
      }

      nameSpan.textContent = headerText;
      nameSpan.style.flex = "1";
      nameSpan.style.overflow = "hidden";
      nameSpan.style.textOverflow = "ellipsis";
      nameSpan.style.whiteSpace = "nowrap";

      // Check if this field is grouped
      const isGrouped =
        field.name?.toLowerCase() ===
        this.options.groupingFieldName?.toLowerCase();

      // Check if this field is being sliced
      const isSliced =
        (this.options.activeSlice &&
          this.options.activeSlice.fieldId === field.id) ||
        (this.options.activeSlicePanelFieldId &&
          String(this.options.activeSlicePanelFieldId) === String(field.id));

      // Icons container (for group / slice indicators)
      const iconsContainer = document.createElement("span");
      iconsContainer.style.display = "flex";
      iconsContainer.style.alignItems = "center";
      iconsContainer.style.gap = "6px";

      // Show Group icon
      if (isGrouped) {
        const groupIcon = document.createElement("span");
        groupIcon.className = "column-group-icon";
        groupIcon.innerHTML = this.getIconSvg("rows");
        groupIcon.style.display = "inline-flex";
        groupIcon.style.alignItems = "center";
        groupIcon.style.color = "var(--vscode-foreground)";
        groupIcon.style.opacity = "0.85";
        groupIcon.title = "Grouped by this field (click to clear)";
        groupIcon.style.cursor = "pointer";
        groupIcon.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.options.onClearGroup(field);
        });
        iconsContainer.appendChild(groupIcon);
      }

      // Show Slice icon
      if (isSliced) {
        const sliceIcon = document.createElement("span");
        sliceIcon.className = "column-slice-icon";
        sliceIcon.innerHTML = this.getIconSvg("sliceby");
        sliceIcon.style.display = "inline-flex";
        sliceIcon.style.alignItems = "center";
        sliceIcon.style.color = "var(--vscode-foreground)";
        sliceIcon.style.opacity = "0.85";
        sliceIcon.title = "Sliced by this field (click to clear)";
        sliceIcon.style.cursor = "pointer";
        sliceIcon.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.options.onClearSlice(field);
        });
        iconsContainer.appendChild(sliceIcon);
      }

      // Menu button (⋮)
      const menuBtn = document.createElement("button");
      menuBtn.textContent = "⋮";
      menuBtn.style.background = "transparent";
      menuBtn.style.border = "none";
      menuBtn.style.cursor = "pointer";
      menuBtn.style.fontSize = "16px";
      menuBtn.style.padding = "2px 4px";
      menuBtn.style.color = "var(--vscode-foreground)";
      menuBtn.style.opacity = "0.6";
      menuBtn.style.borderRadius = "3px";
      menuBtn.title = `${field.name} options`;

      menuBtn.addEventListener("mouseenter", () => {
        menuBtn.style.opacity = "1";
        menuBtn.style.background = "var(--vscode-toolbar-hoverBackground)";
      });

      menuBtn.addEventListener("mouseleave", () => {
        menuBtn.style.opacity = "0.6";
        menuBtn.style.background = "transparent";
      });

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        (th as HTMLElement).style.background =
          "var(--vscode-sideBar-background)";
        this.options.onHeaderMenu(e, field, th);
      });

      headerContent.appendChild(nameSpan);
      if (isGrouped || isSliced) {
        headerContent.appendChild(iconsContainer);
      }
      headerContent.appendChild(menuBtn);
      th.appendChild(headerContent);

      th.addEventListener("pointerenter", () => {
        th.style.background = "var(--vscode-list-hoverBackground)";
      });

      th.addEventListener("pointerleave", () => {
        th.style.background = "var(--vscode-sideBar-background)";
      });

      this.styleHeaderCell(th);
      tr.appendChild(th);
    }

    // Add Field column (+)
    const thAddField = document.createElement("th");
    const addFieldBtn = document.createElement("button");
    addFieldBtn.textContent = "+";
    addFieldBtn.style.background = "transparent";
    addFieldBtn.style.border = "none";
    addFieldBtn.style.cursor = "pointer";
    addFieldBtn.style.fontSize = "18px";
    addFieldBtn.style.fontWeight = "bold";
    addFieldBtn.style.color = "var(--vscode-foreground)";
    addFieldBtn.style.width = "100%";
    addFieldBtn.style.height = "100%";
    addFieldBtn.title = "Show hidden fields";

    addFieldBtn.addEventListener("click", () =>
      this.options.onShowFieldsMenu(addFieldBtn),
    );

    thAddField.appendChild(addFieldBtn);
    this.styleHeaderCell(thAddField);
    thAddField.style.textAlign = "center";
    thAddField.style.width = "50px";
    tr.appendChild(thAddField);

    thead.appendChild(tr);
    table.appendChild(thead);
  }

  private styleHeaderCell(th: HTMLTableCellElement) {
    th.style.padding = "8px";
    th.style.textAlign = "left";
    th.style.whiteSpace = "nowrap";
    th.style.overflow = "hidden";
    th.style.textOverflow = "ellipsis";
    th.style.borderRight = "1px solid var(--vscode-panel-border)";
    th.style.borderBottom = "1px solid var(--vscode-panel-border)";
    th.style.position = "sticky";
    th.style.top = "0";
    th.style.zIndex = "11";
    th.style.background = "var(--vscode-sideBar-background)";
    th.style.height = "32px";
    th.style.boxSizing = "border-box";
  }
}
