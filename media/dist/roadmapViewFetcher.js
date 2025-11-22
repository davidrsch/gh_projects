// Roadmap view fetcher — minimal, robust implementation
// Exposes: window.roadmapViewFetcher(view, container, viewKey)
// Strict: no retry or fallback to other fetchers. If missing or failing, contentFetcher will render an explicit error.
(function () {
  function createRoadmapFetcher() {
    return function (view, container, viewKey) {
      try {
        if (!container) return;
        container.innerHTML =
          '<div class="title">' +
          (view && (view.name || view.id)
            ? view.name || view.id
            : "Roadmap View") +
          '</div><div class="loading"><em>Loading roadmap…</em></div>';
      } catch (e) {}

      var first = 50;

      function esc(s) {
        return s
          ? String(s)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
          : "";
      }

      function render(payload, effFilter) {
        try {
          var items = (payload && payload.items) || [];
          container.innerHTML = "";

          var barApi = null;
          if (
            window.filterBarHelper &&
            typeof window.filterBarHelper.create === "function"
          ) {
            try {
              barApi = window.filterBarHelper.create({
                parent: container,
                suffix: viewKey,
                effFilter: effFilter,
                viewKey: viewKey,
                step: first,
                onLoadMore: function () {
                  first += 50;
                  requestFields();
                },
              });
            } catch (e) {
              barApi = null;
            }
          }

          if (!barApi) {
            var header = document.createElement("div");
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";
            header.style.marginBottom = "8px";
            var left = document.createElement("div");
            left.style.display = "flex";
            left.style.alignItems = "center";
            left.style.gap = "8px";
            left.style.flex = "1 1 auto";
            left.style.minWidth = "0";

            var input = document.createElement("input");
            input.type = "text";
            input.style.padding = "6px";
            input.style.border = "1px solid var(--vscode-editorWidget-border)";
            input.style.borderRadius = "0px";
            input.style.background = "var(--vscode-input-background)";
            input.style.color = "var(--vscode-input-foreground)";
            input.style.outline = "none";
            input.style.boxSizing = "border-box";
            input.placeholder = "Filter items...";
            input.setAttribute(
              "data-filter-input",
              viewKey ? String(viewKey).split(":").pop() : ""
            );

            var right = document.createElement("div");
            var loadBtn = document.createElement("button");
            loadBtn.textContent = "Load more";
            loadBtn.style.marginLeft = "8px";
            loadBtn.style.border =
              "1px solid var(--vscode-editorWidget-border)";
            loadBtn.style.borderRadius = "0px";
            loadBtn.style.background = "transparent";
            loadBtn.style.color = "var(--vscode-button-foreground)";
            loadBtn.addEventListener("click", function () {
              first += 50;
              requestFields();
            });

            left.appendChild(input);
            header.appendChild(left);
            header.appendChild(right);
            right.appendChild(loadBtn);
            container.appendChild(header);

            input.addEventListener("input", function () {
              /* local UI only when helper absent */
            });
          }

          var list = document.createElement("ol");
          list.style.marginTop = "8px";
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var li = document.createElement("li");
            try {
              li.setAttribute("data-gh-item-id", String(it && it.id));
            } catch (e) {}
            li.style.marginBottom = "6px";
            var title =
              (it && it.content && (it.content.title || it.content.name)) ||
              (it && it.title) ||
              (it && it.raw && it.raw.title) ||
              "#" + (i + 1);
            li.innerHTML =
              '<div style="font-weight:600">' +
              esc(String(title || "")) +
              "</div>";
            list.appendChild(li);
          }
          container.appendChild(list);

          try {
            if (barApi && typeof barApi.setCount === "function")
              barApi.setCount(items.length);
            if (barApi && typeof barApi.setLoadState === "function")
              barApi.setLoadState(
                items.length < first,
                items.length >= first ? "Load more" : "All loaded"
              );
          } catch (e) {}

          // Wire local preview filtering via centralized helper: register items and subscribe
          try {
            if (barApi && barApi.inputEl) {
              try {
                if (typeof barApi.registerItems === "function") {
                  try {
                    const fields = (payload && payload.fields) || [];
                    barApi.registerItems(items, { fields: fields });
                  } catch (e) {}
                }
                if (typeof barApi.onFilterChange === "function") {
                  barApi.onFilterChange(function (matchedIds, rawFilter) {
                    try {
                      const listItems = Array.from(
                        container.querySelectorAll("[data-gh-item-id]")
                      );
                      for (let r = 0; r < listItems.length; r++) {
                        try {
                          const el = listItems[r];
                          const id = el.getAttribute("data-gh-item-id");
                          el.style.display = matchedIds.has(String(id))
                            ? "list-item"
                            : "none";
                        } catch (e) {}
                      }
                    } catch (e) {}
                    try {
                      if (barApi && typeof barApi.setCount === "function")
                        barApi.setCount(matchedIds.size);
                    } catch (e) {}
                    try {
                      if (
                        typeof vscodeApi == "object" &&
                        vscodeApi &&
                        typeof vscodeApi.postMessage == "function"
                      )
                        vscodeApi.postMessage({
                          command: "debugLog",
                          level: "debug",
                          viewKey: viewKey,
                          message: "filterInput",
                          data: {
                            filter: rawFilter,
                            matched: matchedIds.size,
                            original: items.length,
                          },
                        });
                    } catch (e) {}
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}
          if (barApi && typeof barApi.setEffectiveFilter === "function") {
            try {
              barApi.setEffectiveFilter(effFilter);
            } catch (e) {}
          } else {
            try {
              if (typeof input !== "undefined")
                input.value =
                  typeof effFilter === "string"
                    ? effFilter
                    : effFilter === undefined
                    ? ""
                    : String(effFilter || "");
            } catch (e) {}
          }
        } catch (err) {
          try {
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage === "function"
            )
              window.vscodeApi.postMessage({
                command: "debugLog",
                level: "error",
                viewKey: viewKey,
                message: "roadmapViewFetcher.render.error",
                data: {
                  message: String(err && err.message),
                  stack: err && err.stack,
                },
              });
          } catch (e) {}
          try {
            container.innerHTML =
              '<div class="title">' +
              (view && (view.name || view.id)
                ? view.name || view.id
                : "Roadmap View") +
              '</div><div style="color:var(--vscode-editor-foreground)">Error rendering roadmap view: ' +
              String(err && err.message) +
              "</div>";
          } catch (e) {}
        }
      }

      function onMessage(ev) {
        var msg = ev && ev.data ? ev.data : ev;
        try {
          if (msg && msg.command === "fields") {
            if (
              msg.viewKey &&
              viewKey &&
              String(msg.viewKey) !== String(viewKey)
            )
              return;
            if (msg.error) {
              try {
                container.innerHTML =
                  '<div class="title">' +
                  (view && (view.name || view.id)
                    ? view.name || view.id
                    : "Roadmap View") +
                  '</div><div style="color:var(--vscode-editor-foreground)">' +
                  String(msg.error) +
                  "</div>";
              } catch (e) {}
            } else {
              render(
                msg.payload || (msg.payload && msg.payload.data) || msg.payload,
                msg.effectiveFilter
              );
            }
          }
        } catch (e) {}
      }

      function requestFields() {
        try {
          if (
            typeof window.vscodeApi === "object" &&
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage === "function"
          ) {
            window.vscodeApi.postMessage({
              command: "requestFields",
              first: first,
              viewKey: viewKey,
            });
          }
        } catch (e) {}
      }

      window.addEventListener("message", onMessage);
      requestFields();
    };
  }

  try {
    window.roadmapViewFetcher = createRoadmapFetcher();
    if (
      typeof window !== "undefined" &&
      window.vscodeApi &&
      typeof window.vscodeApi.postMessage === "function"
    ) {
      window.vscodeApi.postMessage({
        command: "debugLog",
        level: "debug",
        message: "roadmapViewFetcher.loaded",
      });
    }
  } catch (e) {}
})();
