import { renderCell } from "../renderers/cellRenderer";
import { normalizeColor, getContrastColor, escapeHtml } from "../utils";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ColumnHeaderRenderer } from "../renderers/columnHeaderRenderer";
import FieldsMenu from "./FieldsMenu";
import { SlicePanel } from "./SlicePanel";
import type { SortConfig } from "../utils/tableSorting";
import { sortItems } from "../utils/tableSorting";
import { GroupDataService } from "../services/GroupDataService";
import { RowRenderer } from "../renderers/RowRenderer";
import { GroupRenderer } from "../renderers/GroupRenderer";
import { TableResizer } from "./TableResizer";

export interface TableOptions {
  groupingFieldName?: string;
  sortConfig?: SortConfig | null;
  viewKey?: string;
  hiddenFields?: string[];
  onSortChange?: (config: SortConfig) => void;
  onGroupChange?: (fieldName: string) => void;
  onSliceChange?: (field: any) => void;
  onHiddenFieldsChange?: (hiddenIds: string[]) => void;
}

export class ProjectTable {
  private container: HTMLElement;
  private allFields: any[]; // All fields including hidden
  private fields: any[]; // Visible fields only
  private items: any[];
  private options: TableOptions;
  private hiddenFieldIds: Set<string>;
  private activeMenu: ColumnHeaderMenu | null = null;
  private activeFieldsMenu: FieldsMenu | null = null;
  private activeSlicePanel: SlicePanel | null = null;
  private activeSlice: { fieldId: string; value: any } | null = null;
  // Track which field the active slice panel is for (panel may be open before a value is selected)
  private activeSlicePanelFieldId: string | null = null;
  private tableResizer: TableResizer | null = null;

  constructor(
    container: HTMLElement,
    fields: any[],
    items: any[],
    options: TableOptions = {},
  ) {
    this.container = container;
    // Normalize all field ids to strings to avoid type mismatches
    this.allFields = (fields || []).map((f) => ({ ...f, id: String(f.id) }));
    this.options = options;
    this.items = items;

    // Load hidden fields from options or localStorage
    const hiddenFromStorage = this.loadHiddenFields().map((id) => String(id));
    const hiddenFromOptions = (options.hiddenFields || []).map((id) =>
      String(id),
    );
    this.hiddenFieldIds = new Set<string>([
      ...hiddenFromStorage,
      ...hiddenFromOptions,
    ]);

    // Filter visible fields (ids already normalized on allFields)
    this.fields = this.allFields.filter((f) => !this.hiddenFieldIds.has(f.id));

    // Debug: log initial hidden/visible sets
    try {
      console.debug(
        "[ProjectTable] init: allFieldIds=",
        this.allFields.map((f) => f.id),
      );
      console.debug(
        "[ProjectTable] init: hiddenFieldIds=",
        Array.from(this.hiddenFieldIds),
      );
      console.debug(
        "[ProjectTable] init: visibleFieldIds=",
        this.fields.map((f) => f.id),
      );
    } catch (e) {}

    // Also forward debug info to the extension output channel so it's visible
    try {
      const dbg = {
        allFieldIds: this.allFields.map((f: any) => String(f.id)),
        hiddenFieldIds: Array.from(this.hiddenFieldIds),
        visibleFieldIds: this.fields.map((f: any) => String(f.id)),
      };
      if (
        (window as any).__APP_MESSAGING__ &&
        typeof (window as any).__APP_MESSAGING__.postMessage === "function"
      ) {
        (window as any).__APP_MESSAGING__.postMessage({
          command: "debugLog",
          level: "debug",
          message: "ProjectTable init",
          data: dbg,
          viewKey: this.options.viewKey,
        });
      }
    } catch (e) {}

    // Load and apply field order if stored
    this.applyFieldOrder();
  }

  public render() {
    // Preserve slice panel if it exists
    const existingSlicePanel = this.container.querySelector(".slice-panel");

    this.container.innerHTML = "";

    // Re-add slice panel if it existed
    if (existingSlicePanel) {
      this.container.appendChild(existingSlicePanel);
    }

    const tableContainer = document.createElement("div");
    tableContainer.className = "table-wrapper";
    tableContainer.style.overflowX = "auto";
    tableContainer.style.overflowY = "auto";
    tableContainer.style.width = "100%";
    tableContainer.style.display = "block";
    tableContainer.style.height = "100%"; // Let it grow

    const table = document.createElement("table");
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";
    // Use fixed layout so explicit <col> widths are honored and columns can be
    // resized smaller than their content (content will be ellipsised).
    table.style.tableLayout = "fixed";
    // Let container control horizontal scrolling while table fills width
    table.style.width = "100%";

    this.renderColGroup(table);
    new ColumnHeaderRenderer({
      fields: this.fields,
      sortConfig: this.options.sortConfig,
      groupingFieldName: this.options.groupingFieldName,
      activeSlice: this.activeSlice,
      activeSlicePanelFieldId: this.activeSlicePanelFieldId,
      onHeaderMenu: this.showHeaderMenu.bind(this),
      onShowFieldsMenu: this.showFieldsMenu.bind(this),
      onClearGroup: this.clearGroup.bind(this),
      onClearSlice: this.clearSlice.bind(this),
    }).render(table);
    this.renderBody(table);

    tableContainer.appendChild(table);
    this.container.appendChild(tableContainer);

    // Post-render: adjust column widths based on content (simple heuristic)
    // This was in the original code, we can keep it or improve it.
    // For now, let's keep the sticky header logic and resizers.
    this.tableResizer = new TableResizer(table, this.fields, this.options);
    this.tableResizer.setupResizers();
  }

  private renderColGroup(table: HTMLTableElement) {
    const colgroup = document.createElement("colgroup");
    // Index column
    const colIndex = document.createElement("col");
    colIndex.style.width = "40px";
    colgroup.appendChild(colIndex);

    for (const field of this.fields) {
      const col = document.createElement("col");
      col.style.width = "150px"; // Default width
      // Attach field id so resizer can update the correct <col>
      col.dataset.fieldId = field.id;
      colgroup.appendChild(col);
    }

    // Add Field column
    const colAddField = document.createElement("col");
    colAddField.style.width = "50px";
    colgroup.appendChild(colAddField);

    table.appendChild(colgroup);
  }

  private showFieldsMenu(anchorElement: HTMLElement) {
    // Hide existing menus
    if (this.activeMenu) {
      this.activeMenu.hide();
      this.activeMenu = null;
    }
    if (this.activeFieldsMenu) {
      this.activeFieldsMenu.hide();
      this.activeFieldsMenu = null;
    }

    // Build visible id set from hiddenFieldIds to ensure consistent detection (normalize ids)
    const visibleSet = new Set<string>(
      this.allFields
        .filter((f) => !this.hiddenFieldIds.has(String(f.id)))
        .map((f) => String(f.id)),
    );

    // Debug: log current hidden/visible sets before showing menu
    try {
      console.debug(
        "[ProjectTable] showFieldsMenu: hiddenFieldIds=",
        Array.from(this.hiddenFieldIds),
      );
      console.debug(
        "[ProjectTable] showFieldsMenu: allFieldIds=",
        this.allFields.map((f) => f.id),
      );
    } catch (e) {}

    const menu = new FieldsMenu({
      fields: this.allFields.map((f) => ({
        id: f.id,
        name: f.name,
        iconClass: f.iconClass,
        dataType: f.dataType || f.type,
      })),
      visibleFieldIds: visibleSet,
      onToggleVisibility: (fieldId: string, visible: boolean) => {
        if (visible) this.showField(fieldId);
        else this.hideField(fieldId);
      },
      onCreateField: () => {
        // Placeholder: open create field flow if available
        try {
          console.log("Create field requested");
        } catch (e) {}
      },
    });

    this.activeFieldsMenu = menu;
    menu.show(anchorElement);
  }

  private renderBody(table: HTMLTableElement) {
    const tbody = document.createElement("tbody");

    // Apply sorting
    let displayItems = this.items;
    if (this.options.sortConfig) {
      displayItems = sortItems(
        this.items,
        this.fields,
        this.options.sortConfig,
      );
    }

    // Apply Slice Filter
    if (this.activeSlice) {
      displayItems = displayItems.filter((item) => {
        const fv = item.fieldValues.find(
          (v: any) => String(v.fieldId) === String(this.activeSlice!.fieldId),
        );
        if (!fv) return this.activeSlice!.value === null; // Match empty if value is null

        // Extract value logic similar to SlicePanel
        let val = null;
        if (fv.text !== undefined) val = fv.text;
        else if (fv.title !== undefined) val = fv.title;
        else if (fv.number !== undefined) val = fv.number;
        else if (fv.date !== undefined) val = fv.date;
        else if (fv.option) val = fv.option.name;
        else if (fv.iteration) val = fv.iteration.title;
        else val = fv.value;

        return val === this.activeSlice!.value;
      });
    }

    // Check for grouping
    const groupingField = this.getGroupingField();
    const rowRenderer = new RowRenderer(
      this.fields,
      this.items,
      (colIndex, pageX, startWidth) => {
        if (this.tableResizer) {
          this.tableResizer.beginColumnResize(colIndex, pageX, startWidth);
        }
      },
    );

    if (groupingField) {
      this.renderGroupedRows(tbody, groupingField, displayItems, rowRenderer);
    } else {
      this.renderFlatRows(tbody, displayItems, rowRenderer);
    }

    table.appendChild(tbody);
  }

  private getGroupingField() {
    // Logic to determine grouping field from options or view details
    // Passed via options.groupingFieldName or similar
    if (this.options.groupingFieldName) {
      return this.fields.find(
        (f) =>
          (f.name &&
            f.name.toLowerCase() ===
              this.options.groupingFieldName?.toLowerCase()) ||
          (f.id && f.id === this.options.groupingFieldName),
      );
    }
    return null;
  }

  private renderFlatRows(
    tbody: HTMLTableSectionElement,
    items: any[],
    rowRenderer: RowRenderer,
  ) {
    items.forEach((item, index) => {
      const tr = rowRenderer.createRow(item, index);
      tbody.appendChild(tr);
    });
  }

  private renderGroupedRows(
    tbody: HTMLTableSectionElement,
    groupingField: any,
    items: any[],
    rowRenderer: RowRenderer,
  ) {
    // Group items
    const groups = GroupDataService.groupItems(items, groupingField);
    const groupRenderer = new GroupRenderer(this.fields, this.items);

    for (const group of groups) {
      groupRenderer.renderGroup(tbody, group, groupingField, rowRenderer);
    }
  }

  private showHeaderMenu(
    event: MouseEvent,
    field: any,
    headerElement: HTMLElement,
  ) {
    event.stopPropagation();

    // Hide existing menu
    if (this.activeMenu) {
      this.activeMenu.hide();
    }

    // Determine capabilities based on field type
    const dataType = (field.dataType || "").toLowerCase();
    // Mapping of GitHub ProjectV2 field data types to allowed operations
    // Groupable: assignees, single_select, parent_issue, iteration, number, date, milestone, repository
    const groupableTypes = new Set([
      "assignees",
      "single_select",
      "parent_issue",
      "iteration",
      "number",
      "date",
      "milestone",
      "repository",
    ]);

    // Sliceable: same as groupable, plus labels (multi-value) which can be sliced but not grouped
    const sliceableTypes = new Set([
      "assignees",
      "single_select",
      "parent_issue",
      "iteration",
      "number",
      "date",
      "milestone",
      "repository",
      "labels",
    ]);

    const canGroup = groupableTypes.has(dataType);
    const canSlice = sliceableTypes.has(dataType);

    // Determine current state (grouped/sliced/sorted)
    const isGrouped = !!(
      this.options.groupingFieldName &&
      field.name &&
      field.name.toLowerCase() === this.options.groupingFieldName.toLowerCase()
    );
    const isSliced = !!(
      (this.activeSlice && this.activeSlice.fieldId === field.id) ||
      (this.activeSlicePanelFieldId &&
        String(this.activeSlicePanelFieldId) === String(field.id))
    );
    const currentSort =
      this.options.sortConfig && this.options.sortConfig.fieldId === field.id
        ? this.options.sortConfig.direction
        : null;

    // Create and show menu
    const fieldIndex = this.fields.findIndex((f) => f.id === field.id);
    const isFirst = fieldIndex === 0;
    const isLast = fieldIndex === this.fields.length - 1;

    this.activeMenu = new ColumnHeaderMenu(field, {
      canGroup,
      canSlice,
      canFilter: false, // Optional feature for later
      isGrouped,
      isSliced,
      currentSort,
      isFirst,
      isLast,
      onSort: (direction) => this.handleSort(field, direction),
      onClearSort: () => this.clearSort(field),
      onGroup: () => this.handleGroup(field),
      onClearGroup: () => this.clearGroup(field),
      onSlice: () => this.handleSlice(field),
      onClearSlice: () => this.clearSlice(field),
      onHide: () => this.hideField(field.id),
      onMove: (direction) => this.handleMove(field, direction),
    });

    this.activeMenu.show(headerElement);
  }

  private clearGroup(field: any) {
    // Clear local grouping state and notify parent
    this.options.groupingFieldName = undefined;
    if (this.options.onGroupChange) {
      try {
        // Notify parent that grouping was cleared
        this.options.onGroupChange("");
      } catch (e) {}
    }
    this.render();
  }

  private clearSlice(field: any) {
    this.activeSlice = null;
    if (this.activeSlicePanel) {
      this.activeSlicePanel.close();
      this.activeSlicePanel = null;
    }
    this.activeSlicePanelFieldId = null;
    // Reset container layout
    this.container.style.display = "block";
    this.render();
    if (this.options.onSliceChange) {
      this.options.onSliceChange(null as any);
    }
  }

  private clearSort(field: any) {
    // Clear local sort state; persistence and discard are managed by the caller
    this.options.sortConfig = undefined;
    this.render();
    if (this.options.onSortChange) {
      this.options.onSortChange(null as any);
    }
  }

  private showHiddenFieldsMenu(anchorElement: HTMLElement) {
    // Hide any existing menu
    if (this.activeMenu) {
      this.activeMenu.hide();
    }

    // Get hidden fields
    const hiddenFields = this.allFields.filter((f) =>
      this.hiddenFieldIds.has(String(f.id)),
    );

    if (hiddenFields.length === 0) {
      // Show message that no fields are hidden
      const message = document.createElement("div");
      message.textContent = "No hidden fields";
      message.style.position = "absolute";
      message.style.background = "var(--vscode-menu-background)";
      message.style.border = "1px solid var(--vscode-menu-border)";
      message.style.borderRadius = "4px";
      message.style.padding = "12px";
      message.style.fontSize = "13px";
      message.style.color = "var(--vscode-descriptionForeground)";
      message.style.zIndex = "1000";

      const rect = anchorElement.getBoundingClientRect();
      message.style.top = `${rect.bottom + 4}px`;
      message.style.left = `${rect.left}px`;

      document.body.appendChild(message);

      setTimeout(() => message.remove(), 2000);
      return;
    }

    // Create simple menu for hidden fields
    const menu = document.createElement("div");
    menu.style.position = "absolute";
    menu.style.background = "var(--vscode-menu-background)";
    menu.style.border = "1px solid var(--vscode-menu-border)";
    menu.style.borderRadius = "4px";
    menu.style.padding = "4px 0";
    menu.style.minWidth = "180px";
    menu.style.zIndex = "1000";
    menu.style.fontSize = "13px";

    const rect = anchorElement.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;

    // Header
    const header = document.createElement("div");
    header.textContent = "Show field";
    header.style.padding = "6px 12px";
    header.style.fontWeight = "600";
    header.style.color = "var(--vscode-descriptionForeground)";
    header.style.fontSize = "11px";
    header.style.textTransform = "uppercase";
    menu.appendChild(header);

    const separator = document.createElement("div");
    separator.style.height = "1px";
    separator.style.background = "var(--vscode-menu-separatorBackground)";
    separator.style.margin = "4px 0";
    menu.appendChild(separator);

    // Field items
    hiddenFields.forEach((field) => {
      const item = document.createElement("div");
      item.textContent = field.name || field.id;
      item.style.padding = "6px 12px";
      item.style.cursor = "pointer";
      item.style.color = "var(--vscode-menu-foreground)";

      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--vscode-menu-selectionBackground)";
        item.style.color = "var(--vscode-menu-selectionForeground)";
      });

      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.color = "var(--vscode-menu-foreground)";
      });

      item.addEventListener("click", () => {
        this.showField(field.id);
        menu.remove();
        backdrop.remove();
      });

      menu.appendChild(item);
    });

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.top = "0";
    backdrop.style.left = "0";
    backdrop.style.right = "0";
    backdrop.style.bottom = "0";
    backdrop.style.zIndex = "999";

    // Clicking the backdrop closes the menu
    backdrop.addEventListener("click", () => {
      if (menu.parentElement) menu.remove();
      if (backdrop.parentElement) backdrop.remove();
    });

    // Append to body
    document.body.appendChild(menu);
    document.body.appendChild(backdrop);

    // End of showHiddenFieldsMenu
  }

  private handleSort(field: any, direction: "ASC" | "DESC") {
    const sortConfig: SortConfig = {
      fieldId: field.id,
      direction,
    };

    // Update local sort state so the UI reflects the change immediately
    this.options.sortConfig = sortConfig;
    this.render();

    // Notify parent component so it can track unsaved sort state
    if (this.options.onSortChange) {
      this.options.onSortChange(sortConfig);
    }
  }

  private handleGroup(field: any) {
    // Update local grouping state so the UI reflects the change immediately
    if (field && field.name) {
      this.options.groupingFieldName = field.name;
      this.render();
      if (this.options.onGroupChange) {
        try {
          this.options.onGroupChange(field.name);
        } catch (e) {}
      }
    }
  }

  private handleSlice(field: any) {
    // Close existing panel
    if (this.activeSlicePanel) {
      this.activeSlicePanel.close();
      this.activeSlicePanel = null;
    }

    // Create and show new panel in the container (left side)
    this.activeSlicePanel = new SlicePanel(
      this.container,
      field,
      this.items,
      this.allFields,
    );
    this.activeSlicePanel.render();
    // Remember which field the panel belongs to so header menu can show an "unslice" button
    try {
      this.activeSlicePanelFieldId = String(field.id);
    } catch (e) {
      this.activeSlicePanelFieldId = null;
    }

    // Make sure the slice panel appears before the table wrapper
    const tableWrapper = this.container.querySelector(".table-wrapper");
    if (tableWrapper) {
      const sliceEl = this.container.querySelector(".slice-panel");
      if (sliceEl) {
        this.container.insertBefore(sliceEl, tableWrapper);
      }
    }

    // Setup layout: container should use flexbox to show panel + table side by side
    this.container.style.display = "flex";
    this.container.style.flexDirection = "row";
    this.container.style.gap = "0";

    // Re-render so header reflects the active slice panel (shows slice icon)
    // We preserve the existing slice panel in render(), so this is safe.
    this.render();

    this.activeSlicePanel.onValueSelect((value) => {
      // Filter table by this value
      this.activeSlice = { fieldId: field.id, value };
      this.render();
    });

    // Handle field change
    this.activeSlicePanel.onFieldChange((newField) => {
      // Update active slice field
      this.activeSlice = null; // Reset slice value when changing field
      this.handleSlice(newField); // Re-render with new field

      // Notify parent
      if (this.options.onSliceChange) {
        this.options.onSliceChange(newField);
      }
    });

    // Notify parent
    if (this.options.onSliceChange) {
      this.options.onSliceChange(field);
    }
  }

  public hideField(fieldId: string) {
    const fid = String(fieldId);
    this.hiddenFieldIds.add(fid);
    try {
      console.debug(
        "[ProjectTable] hideField -> added",
        fid,
        "hiddenFieldIds=",
        Array.from(this.hiddenFieldIds),
      );
    } catch (e) {}
    // If a parent callback is provided (e.g. tableViewFetcher managing Save/Discard),
    // notify it instead of immediately persisting to localStorage. This allows hide/unhide
    // to be treated as an unsaved view-level change which can be saved/discarded by the user.
    if (this.options.onHiddenFieldsChange) {
      // update in-memory state and notify parent (do not persist to localStorage yet)
      this.fields = this.allFields.filter(
        (f) => !this.hiddenFieldIds.has(f.id),
      );
      // Re-apply stored field order so the UI appears consistent after toggling
      try {
        this.applyFieldOrder();
      } catch (e) {}
      try {
        this.options.onHiddenFieldsChange(Array.from(this.hiddenFieldIds));
      } catch (e) {}
      this.render();
    } else {
      this.saveHiddenFields();
      this.fields = this.allFields.filter(
        (f) => !this.hiddenFieldIds.has(f.id),
      );
      try {
        this.applyFieldOrder();
      } catch (e) {}
      this.render();
    }
  }

  public showField(fieldId: string) {
    const fid = String(fieldId);
    this.hiddenFieldIds.delete(fid);
    try {
      console.debug(
        "[ProjectTable] showField -> removed",
        fid,
        "hiddenFieldIds=",
        Array.from(this.hiddenFieldIds),
      );
    } catch (e) {}
    if (this.options.onHiddenFieldsChange) {
      this.fields = this.allFields.filter(
        (f) => !this.hiddenFieldIds.has(f.id),
      );
      try {
        this.applyFieldOrder();
      } catch (e) {}
      try {
        this.options.onHiddenFieldsChange(Array.from(this.hiddenFieldIds));
      } catch (e) {}
      this.render();
    } else {
      this.saveHiddenFields();
      this.fields = this.allFields.filter(
        (f) => !this.hiddenFieldIds.has(f.id),
      );
      try {
        this.applyFieldOrder();
      } catch (e) {}
      this.render();
    }
  }

  private handleMove(field: any, direction: "left" | "right") {
    const currentIndex = this.fields.findIndex((f) => f.id === field.id);

    if (direction === "left" && currentIndex > 0) {
      // Swap with previous
      [this.fields[currentIndex], this.fields[currentIndex - 1]] = [
        this.fields[currentIndex - 1],
        this.fields[currentIndex],
      ];
    } else if (direction === "right" && currentIndex < this.fields.length - 1) {
      // Swap with next
      [this.fields[currentIndex], this.fields[currentIndex + 1]] = [
        this.fields[currentIndex + 1],
        this.fields[currentIndex],
      ];
    }

    this.saveFieldOrder();
    this.render();
  }

  // LocalStorage persistence methods
  private getStorageKey(suffix: string): string {
    return this.options.viewKey
      ? `ghProjects.table.${this.options.viewKey}.${suffix}`
      : "";
  }

  private loadHiddenFields(): string[] {
    const key = this.getStorageKey("hiddenFields");
    if (!key) return [];

    try {
      const stored = localStorage.getItem(key);
      const arr = stored ? JSON.parse(stored) : [];
      // Normalize stored ids to strings
      const normalized = (arr || []).map((id: any) => String(id));
      try {
        console.debug("[ProjectTable] loadHiddenFields ->", normalized);
      } catch (e) {}
      return normalized;
    } catch (e) {
      return [];
    }
  }

  private saveHiddenFields() {
    const key = this.getStorageKey("hiddenFields");
    if (!key) return;

    const arr = Array.from(this.hiddenFieldIds).map((id) => String(id));
    try {
      console.debug("[ProjectTable] saveHiddenFields ->", arr);
    } catch (e) {}
    localStorage.setItem(key, JSON.stringify(arr));
  }

  private saveSortConfig(config: SortConfig) {
    const key = this.getStorageKey("sortConfig");
    if (!key) return;

    localStorage.setItem(key, JSON.stringify(config));
  }

  private saveFieldOrder() {
    const key = this.getStorageKey("fieldOrder");
    if (!key) return;

    const order = this.fields.map((f) => f.id);
    localStorage.setItem(key, JSON.stringify(order));
  }

  private applyFieldOrder() {
    const key = this.getStorageKey("fieldOrder");
    if (!key) return;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;

      const order: string[] = JSON.parse(stored);
      const orderedFields: any[] = [];

      // Add fields in stored order
      for (const fieldId of order) {
        const field = this.fields.find((f) => String(f.id) === String(fieldId));
        if (field) {
          orderedFields.push(field);
        }
      }

      // Add any new fields not in stored order
      for (const field of this.fields) {
        if (!orderedFields.find((f) => f.id === field.id)) {
          orderedFields.push(field);
        }
      }

      this.fields = orderedFields;
    } catch (e) {
      // Ignore errors, use default order
    }
  }
}
