import { ProjectTable } from "./components/ProjectTable";
import {
  setLoadingState,
  setErrorState,
  initFilterBar,
  createLoadMoreButton,
  logDebug,
} from "./viewFetcherUtils";
import { parseSortByFields, sortItems } from "./utils/tableSorting";
import type { SortConfig } from "./utils/tableSorting";

/// <reference path="./global.d.ts" />

// Initialize active tab menus only when view fetchers are loaded
import "./components/initActiveTabMenus";

const UPDATE_TIMEOUT_MS = 10000;

window.tableViewFetcher = function (
  view: any,
  container: HTMLElement,
  viewKey: any,
) {
  const viewName =
    view && (view.name || view.id) ? view.name || view.id : "Table View";
  try {
    setLoadingState(container, viewName);
  } catch (e) { }



  // Extract projectId from global project data
  const projectId =
    ((window as any).__project_data__ && (window as any).__project_data__.id) ||
    undefined;

  let itemsLimit = 30;

  // Track unsaved view-level changes (grouping) and wires Save/Discard hooks
  // undefined = no override, null = no grouping, string = grouping
  let unsavedGrouping: string | null | undefined = undefined;
  // Track unsaved group divisors (which fields to show sums/count on group headers)
  // undefined = no override, null = cleared (none), array = selected ids (strings, '__count__' allowed)
  let unsavedGroupDivisors: string[] | null | undefined = undefined;
  // Track unsaved hidden fields changes (shown/hidden via the plus-column menu)
  let unsavedHiddenFields: Set<string> | null = null;
  // Track unsaved slice changes
  let unsavedSlice: { fieldId: string; value: any } | null = null;
  // Track unsaved sort changes (local-only view state). We use
  // `undefined` = no pending change, non-null = new sort, null = clear sort.
  let unsavedSort: SortConfig | null | undefined = undefined;

  let lastPayload: any = null;
  let lastEffectiveFilter: string | undefined = undefined;

  function render(payload: any, effectiveFilter?: string) {
    lastPayload = payload;
    // Update effective filter if provided, otherwise preserve previous
    if (effectiveFilter !== undefined) lastEffectiveFilter = effectiveFilter;
    else effectiveFilter = lastEffectiveFilter;

    const snapshot = payload || {};
    const fields = snapshot.fields || [];
    const allItems = snapshot.items || [];
    const items = allItems.slice(0, itemsLimit);

    // Reset container layout
    container.innerHTML = "";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.height = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.overflow = "hidden";

    // Header / Filter Bar Container
    const headerContainer = document.createElement("div");
    headerContainer.style.flex = "0 0 auto";
    headerContainer.style.background = "var(--vscode-editor-background)";
    headerContainer.style.zIndex = "20";
    headerContainer.style.position = "relative";
    headerContainer.style.display = "flex";
    headerContainer.style.justifyContent = "space-between";
    headerContainer.style.alignItems = "center";
    headerContainer.style.width = "100%"; // Ensure full width

    // Filter Wrapper to take available space
    const filterWrapper = document.createElement("div");
    filterWrapper.style.flex = "1 1 auto";
    filterWrapper.style.marginRight = "8px";
    headerContainer.appendChild(filterWrapper);

    // Init Filter Bar
    let barApi = initFilterBar(filterWrapper, viewKey, {
      suffix: viewKey ? String(viewKey).split(":").pop() : "",
      step: itemsLimit,
      onLoadMore: () => {
        itemsLimit += 30;
        requestFields();
      },
      onSave: (newFilter: any) => {
        let dirty = false;
        try {
          // Save grouping if changed
          if (unsavedGrouping !== undefined) {
            if (
              (window as any).__APP_MESSAGING__ &&
              typeof (window as any).__APP_MESSAGING__.postMessage ===
              "function"
            ) {
              (window as any).__APP_MESSAGING__.postMessage({
                command: "setViewGrouping",
                viewKey: viewKey,
                grouping: unsavedGrouping || null,
              });
            }
            unsavedGrouping = undefined;
            dirty = true;
          }

          // Save hidden fields if changed
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
            // Persist to localStorage as well so UI persists across reloads (server may also return updated snapshot)
            try {
              const key = viewKey
                ? `ghProjects.table.${viewKey}.hiddenFields`
                : null;
              if (key) localStorage.setItem(key, JSON.stringify(hiddenArr));
            } catch (e) { }
            unsavedHiddenFields = null;
            dirty = true;
          }

          // Save slice if changed
          if (unsavedSlice !== null) {
            if (
              (window as any).__APP_MESSAGING__ &&
              typeof (window as any).__APP_MESSAGING__.postMessage ===
              "function"
            ) {
              (window as any).__APP_MESSAGING__.postMessage({
                command: "setViewSlice",
                viewKey: viewKey,
                slice: unsavedSlice,
              });
            }
            // Persist to localStorage as well
            try {
              const key = viewKey ? `ghProjects.table.${viewKey}.slice` : null;
              if (key) localStorage.setItem(key, JSON.stringify(unsavedSlice));
            } catch (e) { }
            unsavedSlice = null;
            dirty = true;
          }

          // Save sort if changed (persist local override only)
          if (unsavedSort !== undefined) {
            try {
              const key = viewKey
                ? `ghProjects.table.${viewKey}.sortConfig`
                : null;
              if (key) {
                if (unsavedSort === null) {
                  // User cleared sort: remove override
                  localStorage.removeItem(key);
                } else {
                  // User set a new sort: store override
                  localStorage.setItem(key, JSON.stringify(unsavedSort));
                }
              }
            } catch (e) { }
            unsavedSort = undefined;
            // Sorting is local, so dirty flag might trigger re-fetch but sorting is client-side unless server-sorted
          }
          // Save group divisors if changed
          if (unsavedGroupDivisors !== undefined) {
            try {
              if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === 'function') {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: 'setViewGroupDivisors',
                  viewKey: viewKey,
                  groupDivisors: unsavedGroupDivisors,
                });
              }
            } catch (e) { }
            // persist to localStorage so UI persists across reloads
            try {
              const key = viewKey ? `ghProjects.table.${viewKey}.groupDivisors` : null;
              if (key) {
                if (unsavedGroupDivisors === null) localStorage.removeItem(key);
                else localStorage.setItem(key, JSON.stringify(unsavedGroupDivisors));
              }
            } catch (e) { }
            unsavedGroupDivisors = undefined;
            dirty = true;
          }
        } catch (e) { }

        if (dirty) {
          requestFields();
        }
      },
      onDiscard: () => {
        try {
          let dirty = false;
          if (unsavedGrouping !== undefined || unsavedHiddenFields !== null || unsavedSlice !== null || unsavedSort !== undefined || unsavedGroupDivisors !== undefined) {
            dirty = true;
          }

          if (dirty) {
            // Discard grouping changes
            if (unsavedGrouping !== undefined) {
              if (
                (window as any).__APP_MESSAGING__ &&
                typeof (window as any).__APP_MESSAGING__.postMessage ===
                "function"
              ) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "discardViewGrouping",
                  viewKey: viewKey,
                });
              }
              unsavedGrouping = undefined;
            }

            // Discard hidden fields changes
            if (unsavedHiddenFields !== null) {
              if (
                (window as any).__APP_MESSAGING__ &&
                typeof (window as any).__APP_MESSAGING__.postMessage ===
                "function"
              ) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "discardViewHiddenFields",
                  viewKey: viewKey,
                });
              }
              unsavedHiddenFields = null;
            }

            // Discard slice changes
            if (unsavedSlice !== null) {
              if (
                (window as any).__APP_MESSAGING__ &&
                typeof (window as any).__APP_MESSAGING__.postMessage ===
                "function"
              ) {
                (window as any).__APP_MESSAGING__.postMessage({
                  command: "discardViewSlice",
                  viewKey: viewKey,
                });
              }
              unsavedSlice = null;
              // Clear localStorage
              try {
                const key = viewKey ? `ghProjects.table.${viewKey}.slice` : null;
                if (key) localStorage.removeItem(key);
              } catch (e) { }
            }
            // Discard group divisors changes
            if (unsavedGroupDivisors !== undefined) {
              if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === 'function') {
                (window as any).__APP_MESSAGING__.postMessage({ command: 'discardViewGroupDivisors', viewKey: viewKey });
              }
              try { const key = viewKey ? `ghProjects.table.${viewKey}.groupDivisors` : null; if (key) localStorage.removeItem(key); } catch (e) {}
              unsavedGroupDivisors = undefined;
            }

            // Discard sort changes
            if (unsavedSort !== undefined) {
              unsavedSort = undefined;
              // Revert sort to server state (will happen on refresh)
            }

            // Re-request fields to refresh UI from server state
            requestFields();
          }
        } catch (e) { }
      },
    });

    // If the server provided an effective filter, apply it via the bar API
    // rather than passing it in the options object. This avoids typing
    // mismatches while still initializing the input value at runtime.
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

    // Fallback Header if Filter Bar fails or returns null
    if (!barApi) {
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = viewName;
      title.style.padding = "8px";
      headerContainer.appendChild(title);

      const controls = document.createElement("div");
      controls.style.padding = "8px";

      if (allItems.length > itemsLimit) {
        const loadMore = createLoadMoreButton(() => {
          itemsLimit += 30;
          requestFields();
        });
        controls.appendChild(loadMore);
      } else {
        const span = document.createElement("span");
        span.textContent = "All loaded";
        span.style.color = "var(--vscode-descriptionForeground)";
        controls.appendChild(span);
      }
      headerContainer.appendChild(controls);
    } else {
      // Update load state in barApi
      if (typeof barApi.setLoadState === "function") {
        barApi.setLoadState(
          allItems.length < itemsLimit,
          allItems.length >= itemsLimit ? "Load more" : "All loaded",
        );
      }
      // Register items for filtering
      if (typeof barApi.registerItems === "function") {
        barApi.registerItems(allItems, { fields });
      }

      // Force Enable Buttons if state is dirty (since we just re-rendered with dirty state)
      if (unsavedGrouping !== undefined || unsavedHiddenFields !== null || unsavedSlice !== null || unsavedSort !== undefined) {
        try {
          if (barApi.saveBtn) { barApi.saveBtn.disabled = false; barApi.saveBtn.style.opacity = "1"; barApi.saveBtn.style.cursor = "pointer"; }
          if (barApi.discardBtn) { barApi.discardBtn.disabled = false; barApi.discardBtn.style.opacity = "1"; barApi.discardBtn.style.cursor = "pointer"; }
        } catch (e) { }
      }
    }

    container.appendChild(headerContainer);

    // Expose view state for ActiveTabMenu / FieldsMenu
    try {
      // Calculate current sort field name
      let currentSortName: string | null = null;
      const allFieldsForState =
        (snapshot as any).allFields && Array.isArray((snapshot as any).allFields)
          ? (snapshot as any).allFields
          : snapshot.fields || [];

      // Get effective sort config (consider both localStorage and unsavedSort)
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
        effectiveSortConfig = parseSortByFields(snapshot.details?.sortByFields);
      }

      if (effectiveSortConfig && effectiveSortConfig.fieldId) {
        const sortField = allFieldsForState.find((f: any) => String(f.id) === String(effectiveSortConfig!.fieldId));
        currentSortName = sortField ? sortField.name : null;
      }

      // Calculate current grouping name
      let currentGroupingName: string | null = getGroupingFieldName(snapshot);
      if (unsavedGrouping !== undefined) {
        currentGroupingName = unsavedGrouping;
      }

      // Calculate visible field IDs
      const viewFieldNodes =
        snapshot.details?.fields?.nodes && Array.isArray(snapshot.details.fields.nodes)
          ? snapshot.details.fields.nodes
          : null;
      let visibleFieldIds: Set<string>;
      if (unsavedHiddenFields !== null) {
        visibleFieldIds = new Set<string>();
        allFieldsForState.forEach((f: any) => {
          if (!unsavedHiddenFields!.has(String(f.id))) {
            visibleFieldIds.add(String(f.id));
          }
        });
      } else if (viewFieldNodes) {
        visibleFieldIds = new Set(viewFieldNodes.map((n: any) => String(n.id)));
      } else {
        visibleFieldIds = new Set(fields.map((f: any) => String(f.id)));
      }

      // Determine effective group divisors (unsaved override -> localStorage -> snapshot.details)
      let effectiveGroupDivisors: string[] | null = null;
      try {
        if (unsavedGroupDivisors !== undefined) {
          effectiveGroupDivisors = unsavedGroupDivisors === null ? null : (unsavedGroupDivisors || null);
        } else if (viewKey) {
          try {
            const stored = localStorage.getItem(`ghProjects.table.${viewKey}.groupDivisors`);
            if (stored) effectiveGroupDivisors = JSON.parse(stored);
          } catch (e) { }
        }
        // fallback to snapshot.details.groupDivisors if present
        try {
          const maybe = (snapshot as any).details && (snapshot as any).details.groupDivisors && Array.isArray((snapshot as any).details.groupDivisors.nodes) ? (snapshot as any).details.groupDivisors.nodes.map((n: any) => String(n.id || n.name)) : null;
          if (effectiveGroupDivisors === null && maybe) effectiveGroupDivisors = maybe;
        } catch (e) { }
      } catch (e) { }

      (window as any).__viewStates = (window as any).__viewStates || {};
      (window as any).__viewStates[viewKey] = {
        fields: allFieldsForState,
        items: allItems || [],
        visibleFieldIds: visibleFieldIds,
        current: currentGroupingName,
        currentSort: currentSortName,
        groupDivisors: effectiveGroupDivisors,
        onToggleVisibility: (fieldId: string, visible: boolean) => {
          try {
            // Initialize unsavedHiddenFields if null
            if (unsavedHiddenFields === null) {
              unsavedHiddenFields = new Set<string>();
              // Populate with currently hidden fields
              const visibleSet = visibleFieldIds;
              allFieldsForState.forEach((f: any) => {
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
      };
    } catch (e) { }

    // Table Container
    const tableContainer = document.createElement("div");
    tableContainer.style.flex = "1 1 auto";
    tableContainer.style.overflow = "hidden";
    tableContainer.style.position = "relative";
    container.appendChild(tableContainer);

    // Determine Grouping
    let groupingFieldName = getGroupingFieldName(snapshot);
    // Override with unsaved grouping if present
    if (unsavedGrouping !== undefined) {
      groupingFieldName = unsavedGrouping;
    }

    // Parse sort config from GitHub
    let sortConfig = parseSortByFields(snapshot.details?.sortByFields);

    // Check for local override
    if (viewKey) {
      try {
        const stored = localStorage.getItem(
          `ghProjects.table.${viewKey}.sortConfig`,
        );
        if (stored) sortConfig = JSON.parse(stored);
      } catch (e) { }
    }
    // Override with memory unsavedSort
    if (unsavedSort !== undefined) {
      sortConfig = unsavedSort || null;
    }

    // Apply sorting
    let displayItems = items;
    if (sortConfig) {
      displayItems = sortItems(items, fields, sortConfig);
    }

    // Render Table
    // Use `allFields` if provided (full project fields), otherwise fall back to `fields` (view-visible fields)
    const allFields =
      (snapshot as any).allFields && Array.isArray((snapshot as any).allFields)
        ? (snapshot as any).allFields
        : snapshot.fields || [];

    // Determine which fields the view exposes (visible). If view details contain a fields.nodes
    // list, compute the hidden fields (allFields - viewFields) and pass them to ProjectTable so
    // it picks up view-default hidden fields.
    const viewFieldNodes =
      (snapshot as any).details &&
        (snapshot as any).details.fields &&
        Array.isArray((snapshot as any).details.fields.nodes)
        ? (snapshot as any).details.fields.nodes
        : null;

    let viewHiddenFieldIds: string[] | undefined = undefined;
    if (viewFieldNodes && Array.isArray(viewFieldNodes)) {
      const visibleIds = new Set(viewFieldNodes.map((n: any) => String(n.id)));
      viewHiddenFieldIds = (allFields || [])
        .map((f: any) => String(f.id))
        .filter((id: string) => !visibleIds.has(id));
    }

    // Override with unsaved hidden fields
    if (unsavedHiddenFields !== null) {
      viewHiddenFieldIds = Array.from(unsavedHiddenFields);
    }

    // Send debug info to extension output (via postMessage) so we can see what the webview computed
    try {
      if ((window as any).__APP_MESSAGING__) {
        // ...
      }
    } catch (e) { }

    const table = new ProjectTable(tableContainer, allFields, displayItems, {
      groupingFieldName: groupingFieldName || undefined,
      sortConfig,
      viewKey,

      // merged logic: projectId from top-level, fallback to snapshot.project.id
      projectId: projectId || snapshot.project?.id,

      hiddenFields: viewHiddenFieldIds,
      onFieldUpdate: async (request) => {
        // Send update request to extension
        if (
          (window as any).__APP_MESSAGING__ &&
          typeof (window as any).__APP_MESSAGING__.postMessage === "function"
        ) {
          (window as any).__APP_MESSAGING__.postMessage({
            command: "updateFieldValue",
            itemId: request.itemId,
            fieldId: request.fieldId,
            value: request.value,
            projectId: request.projectId,
            viewKey: request.viewKey,
          });

          // Wait for response via message listener
          return new Promise((resolve, reject) => {
            const handleResponse = (event: MessageEvent) => {
              const msg = event.data;
              if (msg.command === "updateFieldValueResult") {
                window.removeEventListener("message", handleResponse);
                if (msg.success) {
                  // Update local snapshot with response payload
                  if (msg.payload) {
                    // Re-render table with updated data
                    render(msg.payload, msg.effectiveFilter);
                  }
                  resolve();
                } else {
                  reject(new Error(msg.error || "Update failed"));
                }
              }
            };
            window.addEventListener("message", handleResponse);

            // Timeout after configured duration
            setTimeout(() => {
              window.removeEventListener("message", handleResponse);
              reject(new Error("Update timeout"));
            }, UPDATE_TIMEOUT_MS);
          });
        } else {
          throw new Error("Messaging not available");
        }
      },
      onHiddenFieldsChange: (hiddenIds: string[]) => {
        try {
          unsavedHiddenFields = new Set(
            (hiddenIds || []).map((h: any) => String(h)),
          );
          // Enable Save/Discard buttons in the filter bar if present
          if (barApi && barApi.saveBtn && barApi.discardBtn) {
            try {
              barApi.saveBtn.disabled = false;
              barApi.discardBtn.disabled = false;
              barApi.saveBtn.style.opacity = "1";
              barApi.saveBtn.style.cursor = "pointer";
              barApi.discardBtn.style.opacity = "1";
              barApi.discardBtn.style.cursor = "pointer";
            } catch (e) { }
          }
        } catch (e) { }
      },
      onSortChange: (config: SortConfig | null) => {
        try {
          unsavedSort = config || null;
          // Enable Save/Discard buttons in the filter bar if present
          if (barApi && barApi.saveBtn && barApi.discardBtn) {
            try {
              barApi.saveBtn.disabled = false;
              barApi.discardBtn.disabled = false;
              barApi.saveBtn.style.opacity = "1";
              barApi.saveBtn.style.cursor = "pointer";
              barApi.discardBtn.style.opacity = "1";
              barApi.discardBtn.style.cursor = "pointer";
            } catch (e) { }
          }
        } catch (e) { }
      },
      onGroupChange: (fieldName: string) => {
        // Defer persistence of grouping until user explicitly Saves from the filter bar
        try {
          unsavedGrouping = fieldName || null;
          // Enable Save/Discard buttons in the filter bar if present
          if (barApi && barApi.saveBtn && barApi.discardBtn) {
            try {
              barApi.saveBtn.disabled = false;
              barApi.discardBtn.disabled = false;
              barApi.saveBtn.style.opacity = "1";
              barApi.saveBtn.style.cursor = "pointer";
              barApi.discardBtn.style.opacity = "1";
              barApi.discardBtn.style.cursor = "pointer";
            } catch (e) { }
          }
        } catch (e) { }
      },
      onSliceChange: (field: any) => {
        // Track slice as unsaved change (requires Save/Discard)
        try {
          unsavedSlice = field ? { fieldId: field.id, value: null } : null;

          // Enable Save/Discard buttons in the filter bar if present
          if (barApi && barApi.saveBtn && barApi.discardBtn) {
            try {
              barApi.saveBtn.disabled = false;
              barApi.discardBtn.disabled = false;
              barApi.saveBtn.style.opacity = "1";
              barApi.saveBtn.style.cursor = "pointer";
              barApi.discardBtn.style.opacity = "1";
              barApi.discardBtn.style.cursor = "pointer";
            } catch (e) { }
          }
        } catch (e) { }
      },
    });
    table.render();

    // Expose view state for ActiveTabMenu / FieldsMenu / GroupByMenu
    try {
      (window as any).__viewStates = (window as any).__viewStates || {};
      (window as any).__viewStates[viewKey] = {
        fields: allFields,
        items: displayItems || [],
        // Use getter to ensure fresh state from table instance
        get visibleFieldIds() { return new Set(table.getVisibleFieldIds()); },
        get current() { const f = table.getGroupingField(); return f ? f.name : null; },
        // Expose current sort name for menus
        get currentSort() {
          try {
            const sc = (table as any).options && (table as any).options.sortConfig;
            if (!sc || !sc.fieldId) return null;
            const sf = allFields.find((f: any) => String(f.id) === String(sc.fieldId));
            return sf ? sf.name : sc.fieldId;
          } catch (e) { return null; }
        },
        onToggleVisibility: (fieldId: string, visible: boolean) => {
          try {
            table.toggleFieldVisibility(fieldId, visible);
          } catch (e) { }
        },
        onSetGroupBy: (fieldName: string | null) => {
          try {
            table.setGroupingField(fieldName);
          } catch (e) { }
        },
        onSetSort: (fieldId: string | null) => {
          try {
            if (fieldId === null) {
              // clear sort
              (table as any).options.sortConfig = undefined;
              if ((table as any).options && typeof (table as any).options.onSortChange === 'function') {
                (table as any).options.onSortChange(null as any);
              }
            } else {
              const cfg = { fieldId: String(fieldId), direction: 'ASC' } as any;
              (table as any).options.sortConfig = cfg;
              if ((table as any).options && typeof (table as any).options.onSortChange === 'function') {
                (table as any).options.onSortChange(cfg);
              }
            }
            if (typeof (table as any).render === 'function') (table as any).render();
          } catch (e) { }
        },
        // Expose group divisors and callback so menus can read/update selection
        groupDivisors: (() => {
          try {
            if (unsavedGroupDivisors !== undefined) return unsavedGroupDivisors === null ? null : unsavedGroupDivisors;
            if (viewKey) {
              try {
                const stored = localStorage.getItem(`ghProjects.table.${viewKey}.groupDivisors`);
                if (stored) return JSON.parse(stored);
              } catch (e) { }
            }
            try {
              const maybe = (snapshot as any).details && (snapshot as any).details.groupDivisors && Array.isArray((snapshot as any).details.groupDivisors.nodes) ? (snapshot as any).details.groupDivisors.nodes.map((n: any) => String(n.id || n.name)) : null;
              if (maybe) return maybe;
            } catch (e) { }
          } catch (e) { }
          return null;
        })(),
        onSetGroupDivisors: (selected: string[] | null) => {
          try {
            unsavedGroupDivisors = selected === null ? null : (selected || []);
            if (lastPayload) render(lastPayload, lastEffectiveFilter);
          } catch (e) { }
        },
        // Allow showing the slice panel from external menus
        showSlicePanel: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
          try {
            // Clean up any leftover slice panels
            try { const existing = container.querySelector('.slice-panel'); if (existing) existing.remove(); } catch (e) { }
            const sliceableTypes = new Set(['assignees','single_select','parent_issue','iteration','number','date','milestone','repository','labels','text','single_line_text']);
            let field: any = null;
              try {
                const sid = unsavedSlice ? String(unsavedSlice.fieldId) : null;
                if (sid) {
                  field = allFields.find((f: any) => String(f.id) === sid);
                }
              } catch (e) { }
            if (!field) {
              field = (allFields || []).find((f: any) => sliceableTypes.has(String((f.dataType || '').toLowerCase())));
            }
            if (field) {
              try { (table as any).handleSlice && (table as any).handleSlice(field); } catch (e) { try { (table as any).render && (table as any).render(); } catch (e) { } }
              // If caller provided an anchorRect (from the ActiveTabMenu) attempt to open
              // the slice panel's field dropdown anchored to that rect for visual alignment.
              try { const panel = (table as any).activeSlicePanel; if (anchorRect && panel && typeof panel.openFieldDropdown === 'function') panel.openFieldDropdown(anchorRect); } catch (e) { }
              // Return created element for parent to register as external submenu
              try {
                const panel = (table as any).activeSlicePanel;
                const el = panel && (panel as any).panelElement ? (panel as any).panelElement as HTMLElement : null;
                if (el) return { el, refresh: () => { try { /* no-op */ } catch (e) {} } };
              } catch (e) { }
            }
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

    // Connect Filter to Table Visibility
    if (barApi && typeof barApi.onFilterChange === "function") {
      barApi.onFilterChange((matchedIds: Set<string>) => {
        // Apply visibility to table rows
        const rows = tableContainer.querySelectorAll("tr[data-gh-item-id]");
        rows.forEach((row: any) => {
          const id = row.getAttribute("data-gh-item-id");
          if (id && matchedIds.has(id)) {
            row.style.display = "table-row";
          } else {
            row.style.display = "none";
          }
        });
      });
    }
  }

  function onMessage(ev: MessageEvent) {
    const msg = ev && ev.data ? ev.data : ev;
    try {
      if (msg && msg.command === "fields") {
        if (msg.viewKey && viewKey && String(msg.viewKey) !== String(viewKey))
          return;

        if (msg.error) {
          setErrorState(container, viewName, String(msg.error));
        } else {
          render(msg.payload, msg.effectiveFilter);
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
          first: itemsLimit,
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

function getGroupingFieldName(snapshot: any): string | null {
  try {
    if (snapshot && snapshot.details) {
      const vgb =
        snapshot.details.verticalGroupByFields &&
        snapshot.details.verticalGroupByFields.nodes;
      const gb =
        snapshot.details.groupByFields && snapshot.details.groupByFields.nodes;

      if (vgb && vgb.length > 0) return vgb[0].name || null;
      if (gb && gb.length > 0) return gb[0].name || null;
    }
  } catch (e) { }
  return null;
}

// Global click listener for data-gh-open
if (!(window as any).__GH_OPEN_LISTENER_ADDED__) {
  (window as any).__GH_OPEN_LISTENER_ADDED__ = true;
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const openTrigger = target.closest("[data-gh-open]");
    if (openTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const url = openTrigger.getAttribute("data-gh-open");

      // DEBUG LOG
      try {
        if ((window as any).__APP_MESSAGING__) {
          (window as any).__APP_MESSAGING__.postMessage({
            command: "debugLog",
            level: "info",
            message: "Global Listener Caught Click: " + url,
          });
        }
      } catch (e) { }

      if (url) {
        if (
          (window as any).__APP_MESSAGING__ &&
          typeof (window as any).__APP_MESSAGING__.postMessage === "function"
        ) {
          (window as any).__APP_MESSAGING__.postMessage({
            command: "openUrl",
            url: url,
            tryExtension: true, // Hint to extension to try resolving to local repo/extension
          });
        }
      }
    }
  });
}
