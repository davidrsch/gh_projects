import { ProjectTable } from "./components/ProjectTable";
import { setLoadingState, setErrorState, initFilterBar, createLoadMoreButton, logDebug } from "./viewFetcherUtils";
import { parseSortByFields, sortItems } from "./utils/tableSorting";

/// <reference path="./global.d.ts" />

window.tableViewFetcher = function (view: any, container: HTMLElement, viewKey: any) {
  const viewName = (view && (view.name || view.id)) ? (view.name || view.id) : "Table View";
  try {
    setLoadingState(container, viewName);
  } catch (e) { }

  let itemsLimit = 30;

  function render(payload: any) {
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
    let barApi = initFilterBar(filterWrapper, viewKey, {
      suffix: viewKey ? String(viewKey).split(":").pop() : "",
      step: itemsLimit,
      onLoadMore: () => {
        itemsLimit += 30;
        requestFields();
      },
      onSave: (newFilter: any) => {
        try {
          if (unsavedGrouping !== null) {
            if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === "function") {
              (window as any).__APP_MESSAGING__.postMessage({
                command: "setViewGrouping",
                viewKey: viewKey,
                grouping: unsavedGrouping,
              });
            }
            unsavedGrouping = null;
          }
        } catch (e) { }
      },
      onDiscard: () => {
        try {
          if (unsavedGrouping !== null) {
            if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === "function") {
              (window as any).__APP_MESSAGING__.postMessage({
                command: "discardViewGrouping",
                viewKey: viewKey,
              });
            }
            unsavedGrouping = null;
          }
        } catch (e) { }
      }
    });

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
          allItems.length >= itemsLimit ? "Load more" : "All loaded"
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
          const stored = localStorage.getItem(`ghProjects.table.${viewKey}.sortConfig`);
          if (stored) sortConfig = JSON.parse(stored);
        } catch (e) { }
    }

    // Apply sorting
    let displayItems = items;
    if (sortConfig) {
      displayItems = sortItems(items, fields, sortConfig);
    }

    // Render Table
    const table = new ProjectTable(tableContainer, fields, displayItems, {
      groupingFieldName: groupingFieldName || undefined,
      sortConfig,
      viewKey,
      onSortChange: () => requestFields(),
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
      }
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
        if (msg.viewKey && viewKey && String(msg.viewKey) !== String(viewKey)) return;

        if (msg.error) {
          setErrorState(container, viewName, String(msg.error));
        } else {
          render(msg.payload);
        }
      }
    } catch (e) { }
  }

  function requestFields() {
    try {
      if ((window as any).__APP_MESSAGING__ && typeof (window as any).__APP_MESSAGING__.postMessage === "function") {
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
      const vgb = snapshot.details.verticalGroupByFields && snapshot.details.verticalGroupByFields.nodes;
      const gb = snapshot.details.groupByFields && snapshot.details.groupByFields.nodes;

      if (vgb && vgb.length > 0) return vgb[0].name || null;
      if (gb && gb.length > 0) return gb[0].name || null;
    }
  } catch (e) { }
  return null;
}
