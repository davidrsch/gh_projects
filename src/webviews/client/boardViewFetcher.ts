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
/// <reference path="./global.d.ts" />

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

    function render(payload: any, effectiveFilter?: string) {
      try {
        var items = (payload && payload.items) || [];
        var fields = (payload && payload.fields) || [];
        var allFields = (payload && payload.allFields) || fields;
        container.innerHTML = "";

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
        } catch (e) {
          logDebug(viewKey, "boardViewFetcher.columnFieldDetection.error", {
            message: String((e as any)?.message || e),
          });
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

        // Detect swimlane field from view details (regular groupByFields on board layouts)
        let swimlaneField: any = null;
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
              items,
              visibleFieldIds,
              handleFilter,
              handleAction,
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
          }
        } catch (e) { }
      } catch (err: any) {
        logDebug(viewKey, "boardViewFetcher.render.error", {
          message: String(err && err.message),
          stack: err && err.stack,
        });
        setErrorState(
          container,
          viewName,
          "Error rendering board view: " + String(err && err.message),
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
