import { RoadmapRenderer } from "./renderers/RoadmapRenderer";
import {
  setLoadingState,
  setErrorState,
  logDebug,
  initFilterBar,
} from "./viewFetcherUtils";
import { parseSortByFields, sortItems } from "./utils/tableSorting";
import type { SortConfig } from "./utils/tableSorting";
import { SlicePanel } from "./components/SlicePanel";
import type { Item, NormalizedValue, FieldConfig } from "../../lib/types";

/// <reference path="./global.d.ts" />

// Initialize active tab menus only when view fetchers are loaded
import "./components/initActiveTabMenus";

window.roadmapViewFetcher = function (
  view: any,
  container: HTMLElement,
  viewKey: any,
) {
  const viewName =
    view && (view.name || view.id) ? view.name || view.id : "Roadmap View";
  try {
    setLoadingState(container, viewName);
  } catch (e) { }

  // Local persistent state for overrides
  // undefined = no override, null = no grouping (None), string = specific grouping
  let unsavedGrouping: string | null | undefined = undefined;
  let unsavedHiddenFields: Set<string> | null = null;
  let unsavedGroupDivisors: string[] | null | undefined = undefined;
  let unsavedSort: SortConfig | null | undefined = undefined;
  // Track unsaved slice changes
  let unsavedSlice: { fieldId: string; value: any } | null = null;
  let activeSlicePanel: any = null;

  let lastPayload: any = null;
  let lastEffectiveFilter: string | undefined = undefined;

  function render(payload: any, effectiveFilter?: string) {
    lastPayload = payload;
    if (effectiveFilter !== undefined) lastEffectiveFilter = effectiveFilter;
    else effectiveFilter = lastEffectiveFilter;

    const snapshot = payload || {};
    const items = snapshot.items || [];
    const fields = snapshot.fields || []; // Currently visible fields from server
    const allFields = snapshot.allFields || fields;

    const existingSlicePanel = container.querySelector('.slice-panel');
    container.innerHTML = "";
    if (existingSlicePanel) {
      try { container.appendChild(existingSlicePanel); } catch (e) { }
    }
    container.style.height = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";

    // 1. Init Filter Bar (Save/Discard logic)
    // We attach it to a header container
    const headerContainer = document.createElement("div");
    headerContainer.style.flex = "0 0 auto";
    headerContainer.appendChild(document.createElement("div"));

    // We pass the parent, initFilterBar will append filter bar
    let barApi = initFilterBar(headerContainer, viewKey, {
      suffix: viewKey,
      onSave: (newFilter: any) => {
        let dirty = false;
        // Save Grouping
        if (unsavedGrouping !== undefined) {
          if ((window as any).__APP_MESSAGING__) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "setViewGrouping",
              viewKey: viewKey,
              grouping: unsavedGrouping, // can be null
            });
          }
          unsavedGrouping = undefined;
          dirty = true;
        }
        // Save Hidden Fields
        if (unsavedHiddenFields !== null) {
          const hiddenArr = Array.from(unsavedHiddenFields);
          if ((window as any).__APP_MESSAGING__) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "setViewHiddenFields",
              viewKey: viewKey,
              hiddenFields: hiddenArr,
            });
          }
          try {
            const key = viewKey ? `ghProjects.table.${viewKey}.hiddenFields` : null;
            if (key) localStorage.setItem(key, JSON.stringify(hiddenArr));
          } catch (e) { }
          unsavedHiddenFields = null;
          dirty = true;
        }

        // Save Group Divisors
        if (unsavedGroupDivisors !== undefined) {
          if ((window as any).__APP_MESSAGING__) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "setViewGroupDivisors",
              viewKey: viewKey,
              groupDivisors: unsavedGroupDivisors,
            });
          }
          try {
            const key = viewKey ? `ghProjects.roadmap.${viewKey}.groupDivisors` : null;
            if (key) {
              if (unsavedGroupDivisors === null) localStorage.removeItem(key);
              else localStorage.setItem(key, JSON.stringify(unsavedGroupDivisors));
            }
          } catch (e) { }
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
          // Request Refresh
          if ((window as any).__APP_MESSAGING__) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "requestFields",
              viewKey: viewKey,
            });
          }
        }
      },
      onDiscard: () => {
        if (unsavedGrouping !== undefined || unsavedHiddenFields !== null || unsavedGroupDivisors !== undefined || unsavedSlice !== null) {
          unsavedGrouping = undefined;
          unsavedHiddenFields = null;
          unsavedGroupDivisors = undefined;
          unsavedSlice = null;
          try { if (activeSlicePanel && typeof activeSlicePanel.close === 'function') activeSlicePanel.close(); activeSlicePanel = null; } catch (e) { }
          // Re-render
          if (lastPayload) render(lastPayload, lastEffectiveFilter);
        }
      }
    });

    if (effectiveFilter && barApi && barApi.setEffectiveFilter) {
      barApi.setEffectiveFilter(effectiveFilter);
    }

    // Force Enable Buttons if dirty
    if (barApi && (unsavedGrouping !== undefined || unsavedHiddenFields !== null)) {
      try {
        if (barApi.saveBtn) { barApi.saveBtn.disabled = false; barApi.saveBtn.style.opacity = "1"; barApi.saveBtn.style.cursor = "pointer"; }
        if (barApi.discardBtn) { barApi.discardBtn.disabled = false; barApi.discardBtn.style.opacity = "1"; barApi.discardBtn.style.cursor = "pointer"; }
      } catch (e) { }
    }

    container.appendChild(headerContainer);

    // 2. Prepare Data (Overrides)
    let modifiedSnapshot = { ...snapshot };

    // Grouping Override
    if (unsavedGrouping !== undefined) {
      modifiedSnapshot.details = { ...(snapshot.details || {}) };
      modifiedSnapshot.details.groupByFields = { ...(modifiedSnapshot.details.groupByFields || {}) };

      if (unsavedGrouping === null) {
        modifiedSnapshot.details.groupByFields.nodes = [];
      } else {
        const gField = allFields.find((f: any) => f.name === unsavedGrouping);
        if (gField) {
          modifiedSnapshot.details.groupByFields.nodes = [gField];
        }
      }
    }

    // Visible Fields Override
    let visibleFieldIds: Set<string>;

    if (unsavedHiddenFields !== null) {
      visibleFieldIds = new Set();
      // visible = allFields - hidden
      allFields.forEach((f: any) => {
        if (!unsavedHiddenFields!.has(String(f.id))) {
          visibleFieldIds.add(String(f.id));
        }
      });
    } else {
      visibleFieldIds = new Set(fields.map((f: any) => String(f.id)));
    }

    // Callbacks for RoadmapRenderer
    const handleFilter = (filter: string) => {
      if (barApi && barApi.inputEl) {
        const current = String(barApi.inputEl.value || "").trim();
        let newFilter = current ? `${current} ${filter}` : filter;
        barApi.inputEl.value = newFilter;
        barApi.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    const handleAction = (action: string, item: any, args: any) => {
      if (action === "open-menu" && args) {
        // Simple context menu
        const ex = document.querySelectorAll(".board-context-menu");
        ex.forEach((e) => e.remove());

        const menu = document.createElement("div");
        menu.className = "board-context-menu";
        menu.style.position = "fixed";
        const x = Math.min(args.x, window.innerWidth - 180);
        const y = Math.min(args.y, window.innerHeight - 150);
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.style.background = "var(--vscode-menu-background)";
        menu.style.color = "var(--vscode-menu-foreground)";
        menu.style.border = "1px solid var(--vscode-menu-border)";
        menu.style.borderRadius = "4px";
        menu.style.zIndex = "1000";
        menu.style.padding = "4px 0";

        const addItem = (text: string, onClick: () => void) => {
          const el = document.createElement("div");
          el.style.padding = "4px 8px";
          el.style.cursor = "pointer";
          el.textContent = text;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.remove();
            onClick();
          });
          el.addEventListener("mouseenter", () => el.style.background = "var(--vscode-menu-selectionBackground)");
          el.addEventListener("mouseleave", () => el.style.background = "transparent");
          menu.appendChild(el);
        };

        addItem("Open issue", () => {
          const url = item.content?.url || item.url || (item.raw && item.raw.itemContent && item.raw.itemContent.url);
          if (url && (window as any).__APP_MESSAGING__) {
            (window as any).__APP_MESSAGING__.postMessage({ command: "openUrl", url });
          }
        });

        document.body.appendChild(menu);
        const close = () => { menu.remove(); document.removeEventListener("click", close); };
        setTimeout(() => document.addEventListener("click", close), 0);
      }
    };

    // 3. Render Roadmap
    const roadmapContainer = document.createElement("div");
    roadmapContainer.style.flex = "1 1 auto";
    roadmapContainer.style.overflow = "hidden";

    const contentWrapper = document.createElement("div");
    contentWrapper.style.flex = "1 1 auto";
    contentWrapper.style.display = "flex";
    contentWrapper.style.overflow = "hidden";
    contentWrapper.appendChild(roadmapContainer);
    container.appendChild(contentWrapper);

    function repositionSlicePanel() {
      try {
        const sliceEl = container.querySelector('.slice-panel') as HTMLElement | null;
        if (sliceEl) {
          // Move sliceEl to contentWrapper before roadmapContainer
          if (contentWrapper && roadmapContainer) {
            contentWrapper.insertBefore(sliceEl, roadmapContainer);
            // Set contentWrapper to flex row for side-by-side layout
            contentWrapper.style.flexDirection = "row";
            sliceEl.style.float = "none";
            sliceEl.style.display = "flex";
            sliceEl.style.flex = "0 0 auto";
          } else {
            // Fallback: insert as first child of contentWrapper
            if (contentWrapper) {
              contentWrapper.insertBefore(sliceEl, contentWrapper.firstElementChild);
              contentWrapper.style.flexDirection = "row";
            }
          }
        }
      } catch (e) { }
    }

    // Determine sorting (respecting unsaved override and stored override)
    let sortConfig: SortConfig | null = null;
    if (unsavedSort !== undefined) {
      sortConfig = unsavedSort || null;
    } else if (viewKey) {
      try {
        const stored = localStorage.getItem(`ghProjects.table.${viewKey}.sortConfig`);
        if (stored) sortConfig = JSON.parse(stored);
      } catch (e) { }
    }
    if (!sortConfig) {
      sortConfig = parseSortByFields(modifiedSnapshot.details?.sortByFields);
    }

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

    // Determine effective group divisors (unsaved override -> localStorage -> payload.details)
    let effectiveGroupDivisors: string[] | null = null;
    try {
      if (unsavedGroupDivisors !== undefined) {
        effectiveGroupDivisors = unsavedGroupDivisors === null ? null : (unsavedGroupDivisors || null);
      } else if (viewKey) {
        try { const stored = localStorage.getItem(`ghProjects.roadmap.${viewKey}.groupDivisors`); if (stored) effectiveGroupDivisors = JSON.parse(stored); } catch (e) { }
      }
      try {
        const maybe = (modifiedSnapshot as any).details && (modifiedSnapshot as any).details.groupDivisors && Array.isArray((modifiedSnapshot as any).details.groupDivisors.nodes) ? (modifiedSnapshot as any).details.groupDivisors.nodes.map((n: any) => String(n.id || n.name)) : null;
        if (effectiveGroupDivisors === null && maybe) effectiveGroupDivisors = maybe;
      } catch (e) { }
    } catch (e) { }

    const renderer = new RoadmapRenderer(
      displayItems,
      allFields,
      Array.from(visibleFieldIds),
      handleFilter,
      handleAction,
      effectiveGroupDivisors,
    );
    // Passing modifiedSnapshot to renderRoadmap ensures it uses overwritten grouping
    renderer.renderRoadmap(roadmapContainer, modifiedSnapshot);

    // Reposition slice panel if present
    repositionSlicePanel();

    // 4. Update __viewStates for Menus
    // Identify current grouping field for menu
    let currentGroupingName: string | null = null;
    const gbNodes = modifiedSnapshot.details?.groupByFields?.nodes;
    if (gbNodes && gbNodes.length > 0) {
      currentGroupingName = gbNodes[0].name || null;
    }

    try {
      (window as any).__viewStates = (window as any).__viewStates || {};
      (window as any).__viewStates[viewKey] = {
        fields: allFields,
        items: items,
        visibleFieldIds: visibleFieldIds,
        // Exposed for menu:
        current: currentGroupingName,
        // Expose RoadmapRenderer for Markers menu
        roadmapRenderer: renderer,
        // Expose current sort and allow sort changes
        currentSort: (() => {
          try {
            let effective: SortConfig | null = null;
            if (unsavedSort !== undefined) effective = unsavedSort || null;
            else if (viewKey) {
              try { const stored = localStorage.getItem(`ghProjects.table.${viewKey}.sortConfig`); if (stored) effective = JSON.parse(stored); } catch (e) { }
            }
            if (!effective) effective = parseSortByFields(modifiedSnapshot.details?.sortByFields);
            if (effective && effective.fieldId) {
              const sf = allFields.find((f: any) => String(f.id) === String(effective!.fieldId));
              return sf ? sf.name : effective!.fieldId;
            }
          } catch (e) { }
          return null;
        })(),
        onSetSort: (fieldId: string | null) => {
          try {
            if (fieldId === null) unsavedSort = null;
            else unsavedSort = { fieldId: String(fieldId), direction: 'ASC' } as SortConfig;
            if (lastPayload) render(lastPayload, lastEffectiveFilter);
          } catch (e) { }
        },

        // Slice handling
        onSetSlice: (fieldId: string | null) => {
          try { unsavedSlice = fieldId ? { fieldId, value: null } : null; if (lastPayload) render(lastPayload, lastEffectiveFilter); } catch (e) { }
        },
        showSlicePanel: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
          try {
            try { if (activeSlicePanel && typeof activeSlicePanel.close === 'function') activeSlicePanel.close(); activeSlicePanel = null; } catch (e) { }
            // Clean up any leftover slice panels
            try { const existing = container.querySelector('.slice-panel'); if (existing) existing.remove(); } catch (e) { }
            const sliceableTypes = new Set(['assignees','single_select','parent_issue','iteration','number','date','milestone','repository','labels','text','single_line_text']);
            let field: any = null;
            try { const sid = unsavedSlice ? String(unsavedSlice.fieldId) : null; if (sid) field = allFields.find((f: any) => String(f.id) === sid); } catch (e) { }
            if (!field) field = (allFields || []).find((f: any) => sliceableTypes.has(String((f.dataType || '').toLowerCase())));
            if (!field) return;
            try {
              activeSlicePanel = new SlicePanel(container, field, items || [], allFields || []);
              activeSlicePanel.render();
              try {
                console.debug && console.debug("[roadmapViewFetcher] created activeSlicePanel, parent:", container && container.className, "sliceElExists:", !!container.querySelector('.slice-panel'));
              } catch (e) { }
              // Reposition the slice panel immediately after creation
              repositionSlicePanel();
              activeSlicePanel.onValueSelect((value: any) => {
                try { unsavedSlice = { fieldId: field.id, value }; if (lastPayload) render(lastPayload, lastEffectiveFilter); } catch (e) { }
              });
              activeSlicePanel.onFieldChange((newField: any) => {
                try { activeSlicePanel && activeSlicePanel.close && activeSlicePanel.close(); activeSlicePanel = null; unsavedSlice = null; if (newField) { unsavedSlice = { fieldId: newField.id, value: null }; (window as any).__viewStates[viewKey] && (window as any).__viewStates[viewKey].showSlicePanel && (window as any).__viewStates[viewKey].showSlicePanel(); } } catch (e) { }
              });
            } catch (e) { }

            // Try to position the slice panel as a left column for roadmap views.
            // The panel will be repositioned after rendering by the repositioning logic below.
            // For now, just ensure it's in the container.
            try {
              const el = container.querySelector('.slice-panel') as HTMLElement | null;
              if (el && !container.contains(el)) {
                container.insertBefore(el, container.firstChild);
              }
            } catch (e) { }
            // If caller provided an anchorRect (from the ActiveTabMenu) open the
            // field dropdown anchored to that rect so the menu lines up visually.
            try { if (anchorRect && activeSlicePanel && typeof activeSlicePanel.openFieldDropdown === 'function') activeSlicePanel.openFieldDropdown(anchorRect); } catch (e) { }
            // Return created element so callers can register external submenu
            try { const el = (activeSlicePanel as any) && (activeSlicePanel as any).panelElement ? (activeSlicePanel as any).panelElement as HTMLElement : null; if (el) return { el, refresh: () => { try { /* no-op */ } catch (e) {} } }; } catch (e) { }
            return null;
          } catch (e) { }
        },
        get currentSlice() { try { const sid = unsavedSlice ? String(unsavedSlice.fieldId) : null; if (sid) { const f = (allFields || []).find((ff: any) => String(ff.id) === sid); return f ? f.name : sid; } if (viewKey) { try { const stored = localStorage.getItem(`ghProjects.table.${viewKey}.slice`); if (stored) { const parsed = JSON.parse(stored); if (parsed && parsed.fieldId) { const f = (allFields || []).find((ff: any) => String(ff.id) === String(parsed.fieldId)); return f ? f.name : String(parsed.fieldId); } } } catch (e) { } } } catch (e) { } return null; },

        onToggleVisibility: (fieldId: string, visible: boolean) => {
          const id = String(fieldId);
          if (unsavedHiddenFields === null) {
            unsavedHiddenFields = new Set<string>();
            // Init with currently hidden if using partial fields in snapshot?
            // Logic: allFields - fields is currently hidden (approximately)
            // But we have visibleFieldIds from above.
            // The logic in boardViewFetcher:
            // unsavedHiddenFields = new Set(); allFields.forEach f => if (!visibleSet.has(f.id)) add.
            const visibleSet = new Set(fields.map((f: any) => String(f.id)));
            allFields.forEach((f: any) => {
              if (!visibleSet.has(String(f.id))) unsavedHiddenFields!.add(String(f.id));
            });
          }

          if (visible) unsavedHiddenFields.delete(id);
          else unsavedHiddenFields.add(id);

          if (lastPayload) render(lastPayload, lastEffectiveFilter);
        },
        onSetGroupBy: (fieldName: string | null) => {
          unsavedGrouping = fieldName;
          if (lastPayload) render(lastPayload, lastEffectiveFilter);
        }
        ,
        groupDivisors: (() => {
          try {
            if (unsavedGroupDivisors !== undefined) return unsavedGroupDivisors;
            if (viewKey) {
              try {
                const stored = localStorage.getItem(`ghProjects.roadmap.${viewKey}.groupDivisors`);
                if (stored) return JSON.parse(stored);
              } catch (e) { }
            }
          } catch (e) { }
          return null;
        })(),
        onSetGroupDivisors: (ids: string[] | null) => {
          unsavedGroupDivisors = ids === null ? null : Array.isArray(ids) ? ids : [String(ids)];
          if (lastPayload) render(lastPayload, lastEffectiveFilter);
        }
      };
    } catch (e) { }
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
    try {
      // Debug: output structure after reposition attempt
      try {
        const sliceNow = container.querySelector('.slice-panel');
        const splitNow = container.querySelector('.roadmap-split-pane');
        console.debug && console.debug('[roadmapViewFetcher] post-reposition: slicePresent=', !!sliceNow, 'sliceParent=', sliceNow ? sliceNow.parentElement && sliceNow.parentElement.className : null, 'splitPanePresent=', !!splitNow);
      } catch (e) { }
    } catch (e) { }
  }

  try {
    (window as any).__APP_MESSAGING__.onMessage(onMessage);
  } catch (e) {
    window.addEventListener("message", onMessage);
  }

  // Initial Request
  if ((window as any).__APP_MESSAGING__) {
    (window as any).__APP_MESSAGING__.postMessage({
      command: "requestFields",
      viewKey: viewKey,
    });
  }
};
