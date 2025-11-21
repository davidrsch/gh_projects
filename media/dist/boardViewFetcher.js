// signal that the board fetcher script executed
(function () {
  try {
    if (
      window &&
      window.vscodeApi &&
      typeof window.vscodeApi.postMessage === "function"
    )
      window.vscodeApi.postMessage({
        command: "debugLog",
        level: "debug",
        message: "boardViewFetcher.loaded",
      });
  } catch (e) {}
  try {
    console.log && console.log("boardViewFetcher script loaded");
  } catch (e) {}
  // Expose a global fetcher: window.boardViewFetcher(view, container, viewKey)
  function createBoardFetcher() {
    return function (view, container, viewKey) {
      try {
        container.innerHTML =
          '<div class="title">' +
          (view && (view.name || view.id)
            ? view.name || view.id
            : "Board View") +
          '</div><div class="loading"><em>Loading board\u2026</em></div>';
      } catch (e) {}
      var first = 50;
      function escapeHtml(s) {
        return s
          ? String(s)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
          : "";
      }
      function render(payload) {
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
                effFilter: undefined,
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
            var title = document.createElement("div");
            title.style.fontWeight = "600";
            title.style.padding = "6px";
            title.textContent =
              view && (view.name || view.id)
                ? view.name || view.id
                : "Board View";
            var right = document.createElement("div");
            var loadBtn = document.createElement("button");
            loadBtn.type = "button";
            loadBtn.textContent = "Load more";
            loadBtn.style.marginLeft = "8px";
            loadBtn.style.border =
              "1px solid var(--vscode-editorWidget-border)";
            loadBtn.addEventListener("click", function () {
              first += 50;
              requestFields();
              loadBtn.disabled = true;
              loadBtn.textContent = "Loading\u2026";
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
                items.length >= first ? "Load more" : "All loaded"
              );
          } catch (e) {}
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
                message: "boardViewFetcher.render.error",
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
                : "Board View") +
              '</div><div style="color:var(--vscode-editor-foreground)">Error rendering board view: ' +
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
                    : "Board View") +
                  '</div><div style="color:var(--vscode-editor-foreground)">' +
                  String(msg.error) +
                  "</div>";
              } catch (e) {}
            } else {
              render(
                msg.payload || (msg.payload && msg.payload.data) || msg.payload
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
    window.boardViewFetcher = createBoardFetcher();
  } catch (e) {}
})();
