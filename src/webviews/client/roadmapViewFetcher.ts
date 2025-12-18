import { ProjectTable } from "./components/ProjectTable";
import {
  setLoadingState,
  setErrorState,
  initFilterBar,
  createLoadMoreButton,
  logDebug,
} from "./viewFetcherUtils";
import { RoadmapRenderer } from "./renderers/RoadmapRenderer";

/// <reference path="./global.d.ts" />

window.roadmapViewFetcher = function (
  view: any,
  container: HTMLElement,
  viewKey: string,
) {
  const viewName =
    view && (view.name || view.id) ? view.name || view.id : "Roadmap View";
  try {
    setLoadingState(container, viewName);
  } catch (e) { }

  let itemsLimit = 50;
  let renderer: RoadmapRenderer | null = null;

  function render(payload: any, effectiveFilter?: string) {
    const snapshot = payload || {};
    const items = snapshot.items || [];
    const fields = snapshot.allFields || snapshot.fields || [];
    const visibleFieldIds = (snapshot.fields || []).map((f: any) => String(f.id));

    // Reset container layout like table/board view
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
    headerContainer.style.width = "100%";

    const filterWrapper = document.createElement("div");
    filterWrapper.style.flex = "1 1 auto";
    filterWrapper.style.marginRight = "8px";
    headerContainer.appendChild(filterWrapper);

    const barApi = initFilterBar(filterWrapper, viewKey, {
      suffix: viewKey,
      step: itemsLimit,
      onLoadMore: () => {
        itemsLimit += 50;
        requestFields();
      },
      onSave: () => {
        // Handle save if needed
      },
      onDiscard: () => {
        requestFields();
      },
    });

    if (effectiveFilter && barApi && typeof barApi.setEffectiveFilter === "function") {
      barApi.setEffectiveFilter(effectiveFilter);
    }

    if (barApi && typeof barApi.registerItems === "function") {
      barApi.registerItems(items, { fields });
    }

    container.appendChild(headerContainer);

    // Main Content Area (Split Pane)
    const roadmapContainer = document.createElement("div");
    roadmapContainer.style.flex = "1 1 auto";
    roadmapContainer.style.overflow = "hidden";
    roadmapContainer.style.position = "relative";
    container.appendChild(roadmapContainer);

    // Detect Grouping Field for addItem logic
    const groupByFields = snapshot?.details?.groupByFields?.nodes || [];
    const groupingField = fields.find((f: any) =>
      groupByFields.some((v: any) => String(v.id) === String(f.id) || v.name === f.name)
    );

    // Initialize/Update Renderer
    if (!renderer) {
      renderer = new RoadmapRenderer(
        items,
        fields,
        visibleFieldIds,
        (filter) => {
          if (barApi && barApi.inputEl) {
            barApi.inputEl.value = filter;
            barApi.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
        },
        (action, item, args) => {
          if (action === "openUrl" && item.url) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "openUrl",
              url: item.url
            });
          } else if (action === "addItem" && item && args) {
            // Show AddItemMenu
            import("./components/AddItemMenu").then(({ AddItemMenu }) => {
              const menu = new AddItemMenu({
                anchorElement: args.anchorElement || document.body,
                onCreateIssue: () => {
                  (window as any).__APP_MESSAGING__.postMessage({
                    command: "addItem:createIssue",
                    viewKey: viewKey,
                    projectId: payload && payload.id,
                    columnFieldId: groupingField ? groupingField.id : null,
                    columnValueId: item.groupId === "__no_value__" ? null : item.groupId,
                  });
                },
                onAddFromRepo: () => {
                  (window as any).__APP_MESSAGING__.postMessage({
                    command: "addItem:addFromRepo",
                    viewKey: viewKey,
                    projectId: payload && payload.id,
                    columnFieldId: groupingField ? groupingField.id : null,
                    columnValueId: item.groupId === "__no_value__" ? null : item.groupId,
                  });
                }
              });
              menu.show();
            }).catch(err => console.error("Failed to load AddItemMenu", err));
          }
        }
      );
    } else {
      renderer.updateData(items, fields, visibleFieldIds);
    }

    renderer.renderRoadmap(roadmapContainer, snapshot);

    // Connect Filter to Renderer Visibility
    if (barApi && typeof barApi.onFilterChange === "function") {
      barApi.onFilterChange((matchedIds: Set<string>) => {
        if (renderer) {
          renderer.applyFilter(matchedIds);
        }
      });
    }
  }

  function onMessage(ev: MessageEvent) {
    const msg = ev.data;
    if (msg && msg.command === "fields" && msg.viewKey === viewKey) {
      if (msg.error) {
        setErrorState(container, viewName, String(msg.error));
      } else {
        render(msg.payload, msg.effectiveFilter);
      }
    }
  }

  function requestFields() {
    (window as any).__APP_MESSAGING__.postMessage({
      command: "requestFields",
      first: itemsLimit,
      viewKey: viewKey,
    });
  }

  window.addEventListener("message", onMessage);
  requestFields();
};
