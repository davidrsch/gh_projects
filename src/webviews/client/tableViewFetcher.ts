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
  } catch (e) {}

  let itemsLimit = 30;

  function render(payload: any, effectiveFilter?: string) {
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
    // Track unsaved view-level changes (grouping) and wire Save/Discard hooks
    let unsavedGrouping: string | null = null;
    // Track unsaved hidden fields changes (shown/hidden via the plus-column menu)
    let unsavedHiddenFields: Set<string> | null = null;
    // Track unsaved slice changes
    let unsavedSlice: { fieldId: string; value: any } | null = null;
    // Track unsaved sort changes (local-only view state). We use
    // `undefined` = no pending change, non-null = new sort, null = clear sort.
    let unsavedSort: SortConfig | null | undefined = undefined;
    let barApi = initFilterBar(filterWrapper, viewKey, {
      suffix: viewKey ? String(viewKey).split(":").pop() : "",
      step: itemsLimit,
      onLoadMore: () => {
        itemsLimit += 30;
        requestFields();
      },
      onSave: (newFilter: any) => {
        try {
          // Save grouping if changed
          if (unsavedGrouping !== null) {
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
            unsavedGrouping = null;
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
            } catch (e) {}
            unsavedHiddenFields = null;
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
            } catch (e) {}
            unsavedSlice = null;
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
            } catch (e) {}
            unsavedSort = undefined;
          }
        } catch (e) {}
      },
      onDiscard: () => {
        try {
          // Discard grouping changes
          if (unsavedGrouping !== null) {
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
            unsavedGrouping = null;
          }

          // Discard hidden fields changes: request fresh snapshot from extension
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
            // Re-request fields to refresh UI from server state
            requestFields();
          }

          // Discard slice changes: clear slice and refresh UI
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
            } catch (e) {}
            // Re-request fields to refresh UI from server state
            requestFields();
          }

          // Discard sort changes: forget pending change and
          // refresh UI from persisted server/local override state.
          if (unsavedSort !== undefined) {
            unsavedSort = undefined;
            // Re-request fields to refresh UI from server/default + stored sort
            requestFields();
          }
        } catch (e) {}
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
        } catch (e) {}
      }
    } catch (e) {}

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
    }

    container.appendChild(headerContainer);

    // Table Container
    const tableContainer = document.createElement("div");
    tableContainer.style.flex = "1 1 auto";
    tableContainer.style.overflow = "hidden";
    tableContainer.style.position = "relative";
    container.appendChild(tableContainer);

    // Determine Grouping
    const groupingFieldName = getGroupingFieldName(snapshot);

    // Parse sort config from GitHub
    let sortConfig = parseSortByFields(snapshot.details?.sortByFields);

    // Check for local override
    if (viewKey) {
      try {
        const stored = localStorage.getItem(
          `ghProjects.table.${viewKey}.sortConfig`,
        );
        if (stored) sortConfig = JSON.parse(stored);
      } catch (e) {}
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

    // Send debug info to extension output (via postMessage) so we can see what the webview computed
    try {
      const dbg = {
        allFieldIds: (allFields || []).map((f: any) => String(f.id)),
        viewFieldIds: viewFieldNodes
          ? viewFieldNodes.map((n: any) => String(n.id))
          : null,
        viewHiddenFieldIds,
      };
      if (
        (window as any).__APP_MESSAGING__ &&
        typeof (window as any).__APP_MESSAGING__.postMessage === "function"
      ) {
        (window as any).__APP_MESSAGING__.postMessage({
          command: "debugLog",
          level: "debug",
          message: "tableViewFetcher field debug",
          data: dbg,
          viewKey,
        });
      }
    } catch (e) {}

    const table = new ProjectTable(tableContainer, allFields, displayItems, {
      groupingFieldName: groupingFieldName || undefined,
      sortConfig,
      viewKey,
      projectId: snapshot.project?.id,
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
            } catch (e) {}
          }
        } catch (e) {}
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
            } catch (e) {}
          }
        } catch (e) {}
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
            } catch (e) {}
          }
        } catch (e) {}
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
            } catch (e) {}
          }

          // Log for debugging
          if (
            (window as any).__APP_MESSAGING__ &&
            typeof (window as any).__APP_MESSAGING__.postMessage === "function"
          ) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "debugLog",
              level: "debug",
              message: field
                ? `Slice activated on field: ${field.name}`
                : "Slice cleared",
              viewKey: viewKey,
            });
          }
        } catch (e) {}
      },
    });
    table.render();

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
    } catch (e) {}
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
    } catch (e) {}
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
  } catch (e) {}
  return null;
}
