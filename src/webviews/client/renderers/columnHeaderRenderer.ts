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
        groupIcon.innerHTML =
          '<svg class="octicon octicon-rows" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M16 10.75v2.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25v-2.5C0 9.784.784 9 1.75 9h12.5c.966 0 1.75.784 1.75 1.75Zm0-8v2.5A1.75 1.75 0 0 1 14.25 7H1.75A1.75 1.75 0 0 1 0 5.25v-2.5C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75Zm-1.75-.25H1.75a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Zm0 8H1.75a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
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
        sliceIcon.innerHTML =
          '<svg class="octicon octicon-sliceby" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 1.5H6.5V5H10C10.4142 5 10.75 5.33579 10.75 5.75C10.75 6.16421 10.4142 6.5 10 6.5H6.5V7.75C6.5 8.16421 6.16421 8.5 5.75 8.5C5.33579 8.5 5 8.16421 5 7.75V6.5H1.5V14.5H5V12.75C5 12.3358 5.33579 12 5.75 12C6.16421 12 6.5 12.3358 6.5 12.75V14.5H14.5V1.5ZM5 1.5V5H1.5V1.5H5ZM0 14.5V5.75V1.5C0 0.671573 0.671573 0 1.5 0H5.75H14.5C15.3284 0 16 0.671573 16 1.5V14.5C16 15.3284 15.3284 16 14.5 16H5.75H1.5C0.671573 16 0 15.3284 0 14.5ZM9.62012 9.58516C10.8677 9.59206 11.8826 8.58286 11.8826 7.33544V6.32279C11.8826 5.90857 12.2184 5.57279 12.6326 5.57279C13.0468 5.57279 13.3826 5.90857 13.3826 6.32279V7.33544C13.3826 9.4147 11.6909 11.0966 9.61182 11.0851L9.3826 11.0839L9.3826 12.9995C9.3826 13.2178 9.12245 13.3312 8.96248 13.1827L6.07989 10.506C5.97337 10.4071 5.97337 10.2385 6.07989 10.1396L8.96248 7.46291C9.12245 7.31438 9.3826 7.42782 9.3826 7.64611V9.58384L9.62012 9.58516Z"></path></svg>';
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
