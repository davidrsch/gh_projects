import { escapeHtml } from "./utils";
import {
  logDebug,
  setLoadingState,
  setErrorState,
  createLoadMoreButton,
  initFilterBar,
  applyFilterVisibility,
} from "./viewFetcherUtils";
/// <reference path="./global.d.ts" />

// signal that the board fetcher script executed
try {
  logDebug("global", "boardViewFetcher.loaded");
} catch (e) {}
try {
  console.log && console.log("boardViewFetcher script loaded");
} catch (e) {}

// Expose a global fetcher: window.boardViewFetcher(view, container, viewKey)
function createBoardFetcher() {
  return function (view: any, container: HTMLElement, viewKey: string) {
    const viewName =
      view && (view.name || view.id) ? view.name || view.id : "Board View";

    try {
      setLoadingState(container, viewName);
    } catch (e) {}

    var first = 50;

    function render(payload: any, effectiveFilter?: string) {
      try {
        var items = (payload && payload.items) || [];
        container.innerHTML = "";

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
            } catch (e) {}
          }
        } catch (e) {}

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

        var content = document.createElement("div");
        content.style.marginTop = "8px";
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var card = document.createElement("div");
          try {
            card.setAttribute("data-gh-item-id", String(it && it.id));
          } catch (e) {}
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
              const fields = (payload && payload.fields) || [];
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
        } catch (e) {}
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
            first: first,
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
}
try {
  window.boardViewFetcher = createBoardFetcher();
} catch (e) {}
