import { escapeHtml } from "./utils";
import {
  logDebug,
  setLoadingState,
  setErrorState,
  createLoadMoreButton,
  initFilterBar,
  applyFilterVisibility,
} from "./viewFetcherUtils";
import { BoardCardRenderer } from "./renderers/BoardCardRenderer";
import { SlicePanel } from "./components/SlicePanel";
import { parseSortByFields, sortItems } from "./utils/tableSorting";
import type { SortConfig } from "./utils/tableSorting";
import type { Item, NormalizedValue, FieldConfig } from "../../lib/types";
/// <reference path="./global.d.ts" />

// Initialize active tab menus only when view fetchers are loaded
import "./components/initActiveTabMenus";

// signal that the board fetcher script executed
try {
  logDebug("global", "boardViewFetcher.loaded");
} catch (e) { }
try {
  console.log && console.log("boardViewFetcher script loaded");
} catch (e) { }

// Expose a global fetcher: window.boardViewFetcher(view, container, viewKey)
function createBoardFetcher() {
  return function (view: any, container: HTMLElement, viewKey: string) {
    const viewName =
      view && (view.name || view.id) ? view.name || view.id : "Board View";

    try {
      setLoadingState(container, viewName);
    } catch (e) { }

    var first = 50;

    // Persistent state for local overrides
    let unsavedSort: SortConfig | null | undefined = undefined;

    // undefined = no override (use payload)
    // null = override to No Grouping
    // string = override to Specific Grouping
    let unsavedGrouping: string | null | undefined = undefined;
    // group divisors (count / numeric fields) override
    let unsavedGroupDivisors: string[] | null | undefined = undefined;

    // Track unsaved slice changes
    let unsavedSlice: { fieldId: string; value: any } | null = null;
    // Active slice panel instance (if shown)
    let activeSlicePanel: any = null;

    // Column override (for board view column field)
    // undefined = no override, null = no column (invalid but safe), string = column field name
    let unsavedColumn: string | null | undefined = undefined;

    let unsavedHiddenFields: Set<string> | null = null;
    let lastPayload: any = null;
    let lastEffectiveFilter: string | undefined = undefined;

    function render(payload: any, effectiveFilter?: string) {
      try {
        lastPayload = payload;
        // Update effective filter if provided, otherwise preserve previous
        if (effectiveFilter !== undefined) lastEffectiveFilter = effectiveFilter;
        else effectiveFilter = lastEffectiveFilter;

          var items = (payload && payload.items) || [];
          var fields = (payload && payload.fields) || [];
          var allFields = (payload && payload.allFields) || fields;
          // effectiveGroupDivisors is computed below inside the view-state block; declare here so it's
          // available later when creating renderers outside that block.
          let effectiveGroupDivisors: string[] | null | undefined = undefined;
        const existingSlicePanel = container.querySelector('.slice-panel');
        container.innerHTML = "";
        if (existingSlicePanel) {
          try { container.appendChild(existingSlicePanel); } catch (e) { }
        }

        // Apply local hidden fields override
        if (unsavedHiddenFields !== null) {
          fields = allFields.filter((f: any) => !unsavedHiddenFields!.has(String(f.id)));
        }

        // Set container layout like table view - flex column with height 100%
        container.style.margin = "0";
        container.style.padding = "0";
        container.style.height = "100%";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.overflow = "hidden";

        let barApi = initFilterBar(container, viewKey, {
          suffix: viewKey,
          step: first,
          onLoadMore: function () {
            first += 50;
            requestFields();
          },
          onSave: (newFilter: any) => {
            let dirty = false;
            // Save sort if changed (persist local override only)
            if (unsavedSort !== undefined) {
              try {
                const key = viewKey
                  ? `ghProjects.table.${viewKey}.sortConfig`
                  : null;
                if (key) {
                  if (unsavedSort === null) {
                    localStorage.removeItem(key);
                  } else {
                    localStorage.setItem(key, JSON.stringify(unsavedSort));
                  }
                }
              } catch (e) { }
              unsavedSort = undefined;
              dirty = true;
            }

            // Save Hidden Fields
            if (unsavedHiddenFields !== null) {
              const hiddenArr = Array.from(unsavedHiddenFields);
              if (
                (window as any).__APP_MESSAGING__ &&
                typeof (window as any).__APP_MESSAGING__.postMessage ===
                "function"
              ) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "setViewHiddenFields",
                  viewKey: viewKey,
                  hiddenFields: hiddenArr,
                });
              }
              // Persist to localStorage
              try {
                const key = viewKey
                  ? `ghProjects.table.${viewKey}.hiddenFields`
                  : null;
                if (key) localStorage.setItem(key, JSON.stringify(hiddenArr));
              } catch (e) { }
              unsavedHiddenFields = null;
              dirty = true;
            }

            // Save Grouping
            if (unsavedGrouping !== undefined) {
              if (
                (window as any).__APP_MESSAGING__ &&
                typeof (window as any).__APP_MESSAGING__.postMessage ===
                "function"
              ) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "setViewGrouping",
                  viewKey: viewKey,
                  grouping: unsavedGrouping,
                });
              }
              unsavedGrouping = undefined;
              dirty = true;
            }

            // Save group divisors if changed
            if (unsavedGroupDivisors !== undefined) {
              try {
                if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === 'function') {
                  (window as any).__APP_MESSAGING__.postMessage({ command: 'setViewGroupDivisors', viewKey: viewKey, groupDivisors: unsavedGroupDivisors });
                }
              } catch (e) { }
              try { const key = viewKey ? `ghProjects.table.${viewKey}.groupDivisors` : null; if (key) { if (unsavedGroupDivisors === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(unsavedGroupDivisors)); } } catch (e) { }
              unsavedGroupDivisors = undefined;
              dirty = true;
            }

            // Save slice if changed
            if (unsavedSlice !== null) {
              try {
                if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === 'function') {
                  (window as any).__APP_MESSAGING__.postMessage({ command: 'setViewSlice', viewKey: viewKey, slice: unsavedSlice });
                }
              } catch (e) { }
              try { const key = viewKey ? `ghProjects.table.${viewKey}.slice` : null; if (key) localStorage.setItem(key, JSON.stringify(unsavedSlice)); } catch (e) { }
              unsavedSlice = null;
              dirty = true;
            }

            if (dirty) {
              // Request fields to refresh UI from server state
              requestFields();
            }
          },
          onDiscard: () => {
            if (unsavedSort !== undefined || unsavedHiddenFields !== null || unsavedGrouping !== undefined || unsavedSlice !== null) {
              unsavedSort = undefined;
              unsavedHiddenFields = null;
              unsavedGrouping = undefined;
              unsavedSlice = null;

              // Close any active slice panel
              try { if (activeSlicePanel && typeof activeSlicePanel.close === 'function') activeSlicePanel.close(); activeSlicePanel = null; } catch (e) { }

              // Re-render
              if (lastPayload) render(lastPayload, lastEffectiveFilter);
              else requestFields();
            }
          },
        });

        // If the server returned an effective filter, apply it via the bar API
        try {
          if (
            effectiveFilter &&
            barApi &&
            typeof barApi.setEffectiveFilter === "function"
          ) {
            try {
              barApi.setEffectiveFilter(effectiveFilter);
            } catch (e) { }
          }
        } catch (e) { }

        // Expose view state for ActiveTabMenu / FieldsMenu
        try {
          // Calculate effective sort config (unsaved override -> stored -> server)
          let effectiveSortConfig: SortConfig | null = null;
          if (unsavedSort !== undefined) {
            effectiveSortConfig = unsavedSort || null;
          } else if (viewKey) {
            try {
              const stored = localStorage.getItem(`ghProjects.table.${viewKey}.sortConfig`);
              if (stored) effectiveSortConfig = JSON.parse(stored);
            } catch (e) { }
          }
          if (!effectiveSortConfig) {
            effectiveSortConfig = parseSortByFields(payload && payload.details && payload.details.sortByFields);
          }

          let currentSortName: string | null = null;
          if (effectiveSortConfig && effectiveSortConfig.fieldId) {
            const sortField = allFields.find((f: any) => String(f.id) === String(effectiveSortConfig!.fieldId));
            currentSortName = sortField ? sortField.name : null;
          }

          // determine effective group divisors (unsaved override -> localStorage -> payload.details)
          try {
            if (unsavedGroupDivisors !== undefined) {
              effectiveGroupDivisors = unsavedGroupDivisors === null ? null : (unsavedGroupDivisors || null);
            } else if (viewKey) {
              try { const stored = localStorage.getItem(`ghProjects.table.${viewKey}.groupDivisors`); if (stored) effectiveGroupDivisors = JSON.parse(stored); } catch (e) { }
            }
            try {
              const maybe = (payload as any).details && (payload as any).details.groupDivisors && Array.isArray((payload as any).details.groupDivisors.nodes) ? (payload as any).details.groupDivisors.nodes.map((n: any) => String(n.id || n.name)) : null;
              if (effectiveGroupDivisors === null && maybe) effectiveGroupDivisors = maybe;
            } catch (e) { }
          } catch (e) { }

          (window as any).__viewStates = (window as any).__viewStates || {};
          (window as any).__viewStates[viewKey] = {
            fields: allFields,
            items: items || [],
            visibleFieldIds: new Set(fields.map((f: any) => String(f.id))),
            currentSort: currentSortName,
            groupDivisors: effectiveGroupDivisors,
            onToggleVisibility: (fieldId: string, visible: boolean) => {
              try {
                // Initialize unsavedHiddenFields if null
                if (unsavedHiddenFields === null) {
                  unsavedHiddenFields = new Set<string>();
                  // Populate with currently hidden fields (allFields - fields)
                  const visibleSet = new Set(fields.map((f: any) => String(f.id)));
                  allFields.forEach((f: any) => {
                    if (!visibleSet.has(String(f.id))) unsavedHiddenFields!.add(String(f.id));
                  });
                }

                const id = String(fieldId);
                if (visible) unsavedHiddenFields.delete(id);
                else unsavedHiddenFields.add(id);

                // Re-render locally
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            onSetGroupBy: (fieldName: string | null) => {
              try {
                unsavedGrouping = fieldName;
                // Re-render locally
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            onSetGroupDivisors: (selected: string[] | null) => {
              try {
                unsavedGroupDivisors = selected === null ? null : (selected || []);
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            onSetColumnBy: (fieldName: string | null) => {
              try {
                unsavedColumn = fieldName;
                // Re-render locally
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            onSetSort: (fieldId: string | null) => {
              try {
                if (fieldId === null) {
                  unsavedSort = null;
                } else {
                  unsavedSort = { fieldId, direction: 'ASC' };
                }
                // Re-render locally
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            // Allow external callers to show a slice panel in the board view
            onSetSlice: (fieldId: string | null) => {
              try {
                unsavedSlice = fieldId ? { fieldId, value: null } : null;
                if (lastPayload) render(lastPayload, lastEffectiveFilter);
              } catch (e) { }
            },
            showSlicePanel: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
              try {
                // Close existing panel
                try { if (activeSlicePanel && typeof activeSlicePanel.close === 'function') activeSlicePanel.close(); activeSlicePanel = null; } catch (e) { }
                // Clean up any leftover slice panels
                try { const existing = container.querySelector('.slice-panel'); if (existing) existing.remove(); } catch (e) { }
                const sliceableTypes = new Set(['assignees','single_select','parent_issue','iteration','number','date','milestone','repository','labels','text','single_line_text']);
                let field: any = null;
                try {
                  const sid = unsavedSlice ? String(unsavedSlice.fieldId) : null;
                  if (sid) field = allFields.find((f: any) => String(f.id) === sid);
                } catch (e) { }
                if (!field) field = (allFields || []).find((f: any) => sliceableTypes.has(String((f.dataType || '').toLowerCase())));
                if (!field) return;
                try {
                  activeSlicePanel = new SlicePanel(container, field, items || [], allFields || []);
                  activeSlicePanel.render();
                  // Ensure panel appears before main content. If the detected main element is
                  // a direct child of `container` insert before it; otherwise fall back to
                  // inserting as the first child of `container` so it becomes the left column.
                  try {
                    const main = container.querySelector('.board-container') || container.querySelector('.board-wrapper') || container.querySelector('.board-content') || container.firstElementChild || container;
                    const el = container.querySelector('.slice-panel');
                    if (el) {
                      try {
                        if (main && main.parentElement && main.parentElement.contains(main)) {
                          main.parentElement.insertBefore(el, main as Element);
                          // Set parent to flex row for side-by-side layout
                          main.parentElement.style.flexDirection = "row";
                        } else {
                          // main is the container or not attached where expected - insert as first child
                          container.insertBefore(el, container.firstChild);
                        }
                      } catch (ie) {
                        try { container.insertBefore(el, container.firstChild); } catch (e) { }
                      }
                    }
                  } catch (e) { }
                  // If caller provided an anchorRect (from the ActiveTabMenu) open the
                  // field dropdown anchored to that rect so the menu lines up visually.
                  try { if (anchorRect && activeSlicePanel && typeof activeSlicePanel.openFieldDropdown === 'function') activeSlicePanel.openFieldDropdown(anchorRect); } catch (e) { }
                  activeSlicePanel.onValueSelect((value: any) => {
                    try {
                      unsavedSlice = { fieldId: field.id, value };
                      // enable Save/Discard if barApi exists
                      try {
                        if (barApi && barApi.saveBtn && barApi.discardBtn) {
                          barApi.saveBtn.disabled = false; barApi.saveBtn.style.opacity = '1'; barApi.saveBtn.style.cursor = 'pointer';
                          barApi.discardBtn.disabled = false; barApi.discardBtn.style.opacity = '1'; barApi.discardBtn.style.cursor = 'pointer';
                        }
                      } catch (e) { }
                      // re-render to reflect slice state
                      if (lastPayload) render(lastPayload, lastEffectiveFilter);
                    } catch (e) { }
                  });
                  activeSlicePanel.onFieldChange((newField: any) => {
                    try {
                      // reopen panel for new field
                      activeSlicePanel && activeSlicePanel.close && activeSlicePanel.close();
                      activeSlicePanel = null;
                      unsavedSlice = null;
                      if (newField) {
                        unsavedSlice = { fieldId: newField.id, value: null };
                        // show panel again
                        (window as any).__viewStates[viewKey] && (window as any).__viewStates[viewKey].showSlicePanel && (window as any).__viewStates[viewKey].showSlicePanel();
                      }
                    } catch (e) { }
                  });

                } catch (e) { }
                // Return created element for parent to register as external submenu
                try {
                  const el = (activeSlicePanel as any) && (activeSlicePanel as any).panelElement ? (activeSlicePanel as any).panelElement as HTMLElement : null;
                  if (el) return { el, refresh: () => { try { /* no-op */ } catch (e) {} } };
                } catch (e) { }
                return null;
              } catch (e) { }
            },
            get currentSlice() {
              try {
                const sid = unsavedSlice ? String(unsavedSlice.fieldId) : null;
                if (sid) {
                  const f = (allFields || []).find((ff: any) => String(ff.id) === sid);
                  return f ? f.name : sid;
                }
                if (viewKey) {
                  try {
                    const stored = localStorage.getItem(`ghProjects.table.${viewKey}.slice`);
                    if (stored) {
                      const parsed = JSON.parse(stored);
                      if (parsed && parsed.fieldId) {
                        const f = (allFields || []).find((ff: any) => String(ff.id) === String(parsed.fieldId));
                        return f ? f.name : String(parsed.fieldId);
                      }
                    }
                  } catch (e) { }
                }
              } catch (e) { }
              return null;
            },
          };
        } catch (e) { }

        // After detecting column/swimlane fields later in render(), we may update current grouping name
        try {
          (window as any).__viewStates = (window as any).__viewStates || {};
          (window as any).__viewStates[viewKey] = (window as any).__viewStates[viewKey] || {};
        } catch (e) { }

        if (!barApi) {
          var header = document.createElement("div");
          header.style.display = "flex";
          header.style.justifyContent = "space-between";
          header.style.alignItems = "center";
          header.style.marginBottom = "8px";

          var title = document.createElement("div");
          title.style.fontWeight = "600";
          title.style.padding = "6px";
          title.textContent = viewName;

          var right = document.createElement("div");
          var loadBtn = createLoadMoreButton(() => {
            first += 50;
            requestFields();
          });

          right.appendChild(loadBtn);
          header.appendChild(title);
          header.appendChild(right);
          container.appendChild(header);
        }

        // Detect column field from view details (verticalGroupByFields)
        let columnField: any = null;

        // Check for local column override first
        if (unsavedColumn !== undefined) {
          if (unsavedColumn !== null) {
            columnField = allFields.find((f: any) => f.name === unsavedColumn);
          }
        } else {
          try {
            const details = payload && payload.details;
            const verticalGroupByFields =
              details &&
              details.verticalGroupByFields &&
              details.verticalGroupByFields.nodes;

            if (verticalGroupByFields && verticalGroupByFields.length > 0) {
              // Find the field in allFields that matches the verticalGroupByField
              const vgbField = verticalGroupByFields[0];
              columnField = allFields.find(
                (f: any) =>
                  String(f.id) === String(vgbField.id) ||
                  String(f.name) === String(vgbField.name),
              );

              // Validate it's a valid column field type (single_select or iteration)
              if (columnField) {
                const dataType = String(columnField.dataType || "").toLowerCase();
                if (dataType !== "single_select" && dataType !== "iteration") {
                  logDebug(viewKey, "boardViewFetcher.invalidColumnFieldType", {
                    dataType,
                    fieldName: columnField.name,
                  });
                  columnField = null;
                }
              }
            }
              } catch (e) { }
        }

        // Fallback: try to find Status field (common single_select field for boards)
        if (!columnField) {
          columnField = allFields.find(
            (f: any) =>
              String(f.dataType || "").toLowerCase() === "single_select" &&
              String(f.name || "").toLowerCase() === "status",
          );
        }

        // Fallback: use first single_select field
        if (!columnField) {
          columnField = allFields.find(
            (f: any) =>
              String(f.dataType || "").toLowerCase() === "single_select",
          );
        }

        // Update currentColumn in __viewStates
        try {
          if ((window as any).__viewStates && (window as any).__viewStates[viewKey]) {
            (window as any).__viewStates[viewKey].currentColumn = (columnField && columnField.name) || null;
          }
        } catch (e) { }

        // Detect swimlane field from view details (regular groupByFields on board layouts)
        let swimlaneField: any = null;

        if (unsavedGrouping !== undefined) {
          // Use local override
          if (unsavedGrouping === null) {
            swimlaneField = null;
          } else {
            swimlaneField = allFields.find((f: any) => f.name === unsavedGrouping);
          }
        } else {
          try {
            const details = payload && payload.details;
            const groupByFields =
              details &&
              details.groupByFields &&
              details.groupByFields.nodes;

            if (groupByFields && groupByFields.length > 0) {
              const gbField = groupByFields[0];
              swimlaneField = allFields.find(
                (f: any) =>
                  String(f.id) === String(gbField.id) ||
                  String(f.name) === String(gbField.name),
              );
            }
          } catch (e) {
            logDebug(viewKey, "boardViewFetcher.swimlaneFieldDetection.error", {
              message: String((e as any)?.message || e),
            });
          }
        }

        // Ensure buttons are enabled if we have unsaved changes
        if (barApi && (unsavedSort !== undefined || unsavedHiddenFields !== null || unsavedGrouping !== undefined)) {
          try {
            if (barApi.saveBtn) {
              barApi.saveBtn.disabled = false;
              barApi.saveBtn.style.opacity = "1";
              barApi.saveBtn.style.cursor = "pointer";
            }
            if (barApi.discardBtn) {
              barApi.discardBtn.disabled = false;
              barApi.discardBtn.style.opacity = "1";
              barApi.discardBtn.style.cursor = "pointer";
            }
          } catch (e) { }
        }

        // Update __viewStates current grouping after detection
        try {
          // Only use swimlaneField for 'Group By' menu status in Board View
          const currentGrouping = (swimlaneField && swimlaneField.name) || null;
          if ((window as any).__viewStates && (window as any).__viewStates[viewKey]) {
            (window as any).__viewStates[viewKey].current = currentGrouping;
          }
        } catch (e) { }

        // Create board content container - flex grow to fill remaining space
        var content = document.createElement("div");
        content.style.flex = "1 1 auto";
        content.style.overflow = "hidden";
        content.style.position = "relative";
        content.style.display = "flex";
        content.style.flexDirection = "column";

        // Callbacks for interactivity
        const handleFilter = (filter: string) => {
          if (barApi && barApi.inputEl) {
            const current = String(barApi.inputEl.value || "").trim();
            // Avoid duplicating if checking purely space separated, but simple append is standard
            let newFilter = current ? `${current} ${filter}` : filter;
            barApi.inputEl.value = newFilter;
            barApi.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        // Determine sorting - consider unsaved override (already applied to effectiveSortConfig above)
        let sortConfig = parseSortByFields(payload && payload.details && payload.details.sortByFields);
        if (viewKey) {
          try {
            const stored = localStorage.getItem(`ghProjects.table.${viewKey}.sortConfig`);
            if (stored) sortConfig = JSON.parse(stored);
          } catch (e) { }
        }
        // If we have unsavedSort (user changed via menu) prefer that
        if (unsavedSort !== undefined) {
          sortConfig = unsavedSort || null;
        }

        // Apply sorting to items
        let displayItems = items;
        if (sortConfig) {
          displayItems = sortItems(items, allFields, sortConfig);
        }

        // Apply slice filtering
        if (unsavedSlice) {
          displayItems = displayItems.filter((item: Item) => {
            const fv = item.fieldValues.find((f: any) => String(f.fieldId) === String(unsavedSlice!.fieldId));
        // Handle different field types
        const field = allFields.find((f: FieldConfig) => f.id === unsavedSlice!.fieldId);
        const dataType = field ? (field.dataType || field.type || '').toLowerCase() : '';

        // Extract value from NormalizedValue
        let val = null;
        if (!fv) {
          // No field value found
          val = null;
        } else {
          if ((fv as any).text !== undefined) val = (fv as any).text;
          else if ((fv as any).title !== undefined) val = (fv as any).title;
          else if ((fv as any).number !== undefined) val = (fv as any).number;
          else if ((fv as any).date !== undefined) val = (fv as any).date;
          else if ((fv as any).option) val = (fv as any).option.name;
          else if ((fv as any).iteration) val = (fv as any).iteration.title;
          else if ((fv as any).assignees) val = (fv as any).assignees;
          else if ((fv as any).labels) val = (fv as any).labels;
          else if (dataType === 'parent_issue') {
            const p = (fv as any).parent || (fv as any).parentIssue || (fv as any).issue || (fv as any).item || (fv as any).value || null;
            if (p) val = p.title || p.name || p.number || p.id || p.url || null;
          }
          else if (dataType === 'milestone') {
            val = (fv as any).milestone?.title || (fv as any).milestone?.name || (fv as any).value || null;
          }
          else if (dataType === 'repository') {
            val = (fv as any).repository?.nameWithOwner || (fv as any).repository?.full_name || (fv as any).repository?.name || (fv as any).value || null;
          }
          else val = (fv as any).value; // fallback
        }

        if (unsavedSlice!.value === null) {
          // For null slice value, show items that have no value for this field
          if (dataType === 'assignees' || dataType === 'labels') {
            return !val || (Array.isArray(val) && val.length === 0);
          } else {
            return val === null || val === undefined;
          }
        }
            if (dataType === 'assignees' || dataType === 'labels') {
              if (!Array.isArray(val)) return false;
              if (dataType === 'assignees') {
                // For assignees, val is array of objects, slice value is object
                return val.some((assignee: any) => 
                  assignee && (assignee.login === unsavedSlice!.value?.login || assignee.id === unsavedSlice!.value?.id)
                );
              } else if (dataType === 'labels') {
                // For labels, val is array of objects, slice value is string (name)
                return val.some((label: any) => 
                  label && (label.name === unsavedSlice!.value || label.id === unsavedSlice!.value)
                );
              }
            } else {
              return val === unsavedSlice!.value;
            }
          });
        }

        const handleAction = (action: string, item: any, args: any) => {
          if (action === "open-menu" && args) {
            // Close existing menus
            const ex = document.querySelectorAll(".board-context-menu");
            ex.forEach((e) => e.remove());

            const menu = document.createElement("div");
            menu.className = "board-context-menu";
            menu.style.position = "fixed";
            // Ensure menu doesn't overflow right edge
            const x = Math.min(args.x, window.innerWidth - 180);
            const y = Math.min(args.y, window.innerHeight - 150);

            menu.style.left = x + "px";
            menu.style.top = y + "px";
            menu.style.background = "var(--vscode-menu-background)";
            menu.style.color = "var(--vscode-menu-foreground)";
            menu.style.border = "1px solid var(--vscode-menu-border)";
            menu.style.borderRadius = "4px";
            menu.style.zIndex = "1000";
            menu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
            menu.style.minWidth = "160px";
            menu.style.padding = "4px 0";

            const addItem = (
              text: string,
              iconClass: string,
              onClick: () => void,
              isSep = false,
            ) => {
              if (isSep) {
                const sep = document.createElement("div");
                sep.style.height = "1px";
                sep.style.background = "var(--vscode-menu-separatorBackground)";
                sep.style.margin = "4px 0";
                menu.appendChild(sep);
                return;
              }
              const el = document.createElement("div");
              el.style.padding = "4px 8px";
              el.style.cursor = "pointer";
              el.style.display = "flex";
              el.style.alignItems = "center";
              el.style.gap = "8px";
              el.style.fontSize = "13px";

              // Icon placeholder - ideally use octicons but text + unicode/css is backup
              const ico = document.createElement("span");
              if (iconClass) {
                ico.className = "codicon codicon-" + iconClass; // Assuming codicons available?
                // If not, use simple emoji or text.
                // User requested "add-icon" (probably meaning 'plus' or similar) and 'octicon-arrow-both'.
                // We might not have codicon font loaded in webview unless injected.
                // Fallback to text for now.
                if (iconClass === "link-external") ico.textContent = "↗";
                else if (iconClass === "globe") ico.textContent = "🌐";
                else if (iconClass === "arrow-both") ico.textContent = "⇄";
              }

              const span = document.createElement("span");
              span.textContent = text;

              el.appendChild(ico);
              el.appendChild(span);

              el.addEventListener("click", (e) => {
                e.stopPropagation();
                menu.remove();
                onClick();
              });

              el.addEventListener(
                "mouseenter",
                () =>
                (el.style.background =
                  "var(--vscode-menu-selectionBackground)"),
              );
              el.addEventListener(
                "mouseleave",
                () => (el.style.background = "transparent"),
              );
              menu.appendChild(el);
            };

            addItem("Open issue", "link-external", () => {
              const url =
                item.content?.url ||
                item.url ||
                (item.raw && item.raw.itemContent && item.raw.itemContent.url);
              if (url && (window as any).__APP_MESSAGING__) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "openUrl",
                  url: url,
                });
              }
            });

            addItem("", "", () => { }, true);

            addItem("Move to column...", "arrow-both", () => {
              if ((window as any).__APP_MESSAGING__) {
                // Extract column options
                let options: any[] = [];
                if (columnField) {
                  const opts =
                    columnField.options ||
                    (columnField.configuration &&
                      columnField.configuration.options);
                  const iters =
                    columnField.configuration &&
                    columnField.configuration.iterations;

                  // Helper to format iteration date range
                  const getIterationRange = (
                    start: string,
                    duration: number,
                  ) => {
                    try {
                      const startDate = new Date(start);
                      const endDate = new Date(
                        startDate.getTime() +
                        Number(duration) * 24 * 60 * 60 * 1000,
                      );
                      const formatDate = (d: Date) =>
                        d.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      return `${formatDate(startDate)} — ${formatDate(endDate)}`;
                    } catch (e) {
                      return "";
                    }
                  };

                  if (opts && Array.isArray(opts)) {
                    options = opts.map((o: any) => ({
                      id: o.id,
                      name: o.name,
                      color: o.color,
                      description: o.description,
                    }));
                  } else if (iters && Array.isArray(iters)) {
                    options = iters.map((it: any) => ({
                      id: it.id,
                      name: it.title,
                      color: it.color,
                      description: getIterationRange(it.startDate, it.duration),
                    }));
                  }
                }

                (window as any).__APP_MESSAGING__.postMessage({
                  command: "moveItem",
                  viewKey: viewKey,
                  itemId: item.id,
                  projectId: payload && payload.id,
                  fieldId: columnField ? columnField.id : null,
                  options: options,
                  currentValue: "", // Could check item.fieldValues to find current
                });
              }
            });

            document.body.appendChild(menu);

            // Global click to close
            const closeHandler = () => {
              menu.remove();
              document.removeEventListener("click", closeHandler);
            };
            // Defer to avoid immediate trigger
            setTimeout(
              () => document.addEventListener("click", closeHandler),
              0,
            );
          } else if (action === "add-item-to-column" && item && args) {
            // Import AddItemMenu if not already available
            import("./components/AddItemMenu")
              .then(({ AddItemMenu }) => {
                const menu = new AddItemMenu({
                  anchorElement: args.anchorElement,
                  onCreateIssue: () => {
                    try {
                      const messaging = (window as any).__APP_MESSAGING__;
                      if (
                        messaging &&
                        typeof messaging.postMessage === "function"
                      ) {
                        messaging.postMessage({
                          command: "addItem:createIssue",
                          viewKey: viewKey,
                          projectId: payload && payload.id,
                          columnFieldId: item.columnFieldId,
                          columnValueId: item.columnValueId,
                          columnValueName: item.columnValueName,
                        });
                      }
                    } catch (e) {
                      console.error(
                        "[boardViewFetcher] create-issue action failed",
                        e,
                      );
                    }
                  },
                  onAddFromRepo: () => {
                    try {
                      const messaging = (window as any).__APP_MESSAGING__;
                      if (
                        messaging &&
                        typeof messaging.postMessage === "function"
                      ) {
                        messaging.postMessage({
                          command: "addItem:addFromRepo",
                          viewKey: viewKey,
                          projectId: payload && payload.id,
                          columnFieldId: item.columnFieldId,
                          columnValueId: item.columnValueId,
                          columnValueName: item.columnValueName,
                        });
                      }
                    } catch (e) {
                      console.error(
                        "[boardViewFetcher] add-from-repo action failed",
                        e,
                      );
                    }
                  },
                });
                menu.show();
              })
              .catch((e) => {
                console.error("Failed to load AddItemMenu", e);
              });
          }
        };

        // Use BoardCardRenderer if column field is found
        if (columnField) {
          try {
            // Extract visible field IDs
            const visibleFieldIds = fields.map((f: any) => String(f.id));
            const cardRenderer = new BoardCardRenderer(
              allFields,
              displayItems,
              visibleFieldIds,
              handleFilter,
              handleAction,
              effectiveGroupDivisors,
            );
            cardRenderer.renderBoard(content, columnField, swimlaneField);
          } catch (e) {
            logDebug(viewKey, "boardViewFetcher.cardRenderer.error", {
              message: String((e as any)?.message || e),
            });
            // Fallback to flat list on error
            renderFlatList(content, items);
          }
        } else {
          // No column field found - render flat list as fallback
          logDebug(viewKey, "boardViewFetcher.noColumnField", {
            fieldsCount: allFields.length,
          });
          renderFlatList(content, items);
        }

        container.appendChild(content);

        // Reposition slice panel if present
        try {
          const sliceEl = container.querySelector('.slice-panel') as HTMLElement;
          if (sliceEl) {
            const main = content.querySelector('.board-container') || content.querySelector('.board-wrapper') || content.querySelector('.board-content') || content.firstElementChild;
            if (main && main.parentElement === content) {
              content.insertBefore(sliceEl, main);
              content.style.display = "flex";
              content.style.flexDirection = "row";
            }
          }
        } catch (e) { }

        try {
          if (barApi && typeof barApi.setCount === "function")
            barApi.setCount(items.length);
          if (barApi && typeof barApi.setLoadState === "function")
            barApi.setLoadState(
              items.length < first,
              items.length >= first ? "Load more" : "All loaded",
            );

          // Wire local preview filtering via centralized helper: register items and subscribe
          if (barApi && barApi.inputEl) {
            if (typeof barApi.registerItems === "function") {
              barApi.registerItems(items, { fields: fields });
            }
            if (typeof barApi.onFilterChange === "function") {
              barApi.onFilterChange(function (matchedIds: any, rawFilter: any) {
                applyFilterVisibility(
                  container,
                  "[data-gh-item-id]",
                  matchedIds,
                  "block",
                );

                if (barApi && typeof barApi.setCount === "function")
                  barApi.setCount(matchedIds.size);

                logDebug(viewKey, "filterInput", {
                  filter: rawFilter,
                  matched: matchedIds.size,
                  original: items.length,
                });
              });
            }
            if (typeof barApi.onSortChange === "function") {
              barApi.onSortChange((config: SortConfig | null) => {
                unsavedSort = config || null;
                if (barApi && barApi.saveBtn && barApi.discardBtn) {
                  barApi.saveBtn.disabled = false;
                  barApi.discardBtn.disabled = false;
                  barApi.saveBtn.style.opacity = "1";
                  barApi.saveBtn.style.cursor = "pointer";
                  barApi.discardBtn.style.opacity = "1";
                  barApi.discardBtn.style.cursor = "pointer";
                }
              });
            }
          }
        } catch (e) { }
      } catch (err) {
        logDebug(viewKey, "boardViewFetcher.render.error", {
          message: String(err && (err as any).message),
          stack: err && (err as any).stack,
        });
        setErrorState(
          container,
          viewName,
          "Error rendering board view: " + String(err && (err as any).message),
        );
      }
    }

    // Fallback flat list rendering (used when no column field found)
    function renderFlatList(content: HTMLElement, items: any[]) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var card = document.createElement("div");
        try {
          card.setAttribute("data-gh-item-id", String(it && it.id));
        } catch (e) { }
        card.style.padding = "8px";
        card.style.border = "1px solid var(--vscode-editorWidget-border)";
        card.style.marginBottom = "8px";
        card.style.borderRadius = "2px";
        var titleText =
          (it && it.content && (it.content.title || it.content.name)) ||
          (it && it.title) ||
          (it && it.raw && it.raw.title) ||
          "#" + (i + 1);
        card.innerHTML =
          '<div style="font-weight:600">' +
          escapeHtml(titleText) +
          "</div>" +
          (it && it.id
            ? '<div style="color:var(--vscode-descriptionForeground);font-size:12px">' +
            escapeHtml(String(it.id)) +
            "</div>"
            : "");
        content.appendChild(card);
      }
    }

    function onMessage(ev: MessageEvent) {
      var msg = ev && ev.data ? ev.data : ev;
      try {
        if (msg && msg.command === "fields") {
          if (msg.viewKey && viewKey && String(msg.viewKey) !== String(viewKey))
            return;
          if (msg.error) {
            setErrorState(container, viewName, String(msg.error));
          } else {
            render(
              msg.payload || (msg.payload && msg.payload.data) || msg.payload,
              msg.effectiveFilter,
            );
          }
        }
      } catch (e) { }
    }

    function requestFields() {
      try {
        if (
          (window as any).__APP_MESSAGING__ &&
          typeof (window as any).__APP_MESSAGING__.postMessage === "function"
        ) {
          (window as any).__APP_MESSAGING__.postMessage({
            command: "requestFields",
            first: first,
            viewKey: viewKey,
          });
        }
      } catch (e) { }
    }
    try {
      (window as any).__APP_MESSAGING__.onMessage(onMessage);
    } catch (e) {
      window.addEventListener("message", onMessage);
    }
    requestFields();
  };
}
try {
  window.boardViewFetcher = createBoardFetcher();
} catch (e) { }
