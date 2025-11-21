(function () {
  window.contentFetcher = function (t, n, o) {
    try {
      if (window.vscodeApi && typeof window.vscodeApi.postMessage == "function")
        window.vscodeApi.postMessage({
          command: "debugLog",
          level: "debug",
          viewKey: o,
          message: "contentFetcher init",
          data: { view: t },
        });
      else if (typeof acquireVsCodeApi == "function")
        try {
          acquireVsCodeApi().postMessage({
            command: "debugLog",
            level: "debug",
            viewKey: o,
            message: "contentFetcher init",
            data: { view: t },
          });
        } catch {}
    } catch {}
    try {
      console.log("contentFetcher init", { viewKey: o, view: t });
    } catch {}

    // Global forwarding: surface uncaught errors/rejections and console.error to extension
    try {
      if (!window.__gh_global_forwarding_installed__) {
        window.__gh_global_forwarding_installed__ = true;
        window.addEventListener("error", function (ev) {
          try {
            var msg = ev && ev.message ? String(ev.message) : "uncaught error";
            var stack =
              ev && ev.error && ev.error.stack ? ev.error.stack : null;
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage == "function"
            )
              window.vscodeApi.postMessage({
                command: "debugLog",
                level: "error",
                viewKey: o,
                message: "unhandledError",
                data: { message: msg, stack: stack },
              });
          } catch (e) {}
        });
        window.addEventListener("unhandledrejection", function (ev) {
          try {
            var reason =
              ev && ev.reason ? String(ev.reason) : "unhandledrejection";
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage == "function"
            )
              window.vscodeApi.postMessage({
                command: "debugLog",
                level: "error",
                viewKey: o,
                message: "unhandledRejection",
                data: { reason: reason },
              });
          } catch (e) {}
        });
        var _console_error = console.error.bind(console);
        console.error = function () {
          try {
            var args = Array.prototype.slice.call(arguments || []);
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage == "function"
            )
              window.vscodeApi.postMessage({
                command: "debugLog",
                level: "error",
                viewKey: o,
                message: "console.error",
                data: { args: args },
              });
          } catch (e) {}
          try {
            _console_error.apply(console, arguments);
          } catch (e) {}
        };
      }
    } catch (e) {}
    let r =
        (t == null ? void 0 : t.layout) ||
        (t == null ? void 0 : t.type) ||
        (t == null ? void 0 : t.viewType) ||
        "",
      e = String(r).toUpperCase();
    try {
      // For BOARD/ROADMAP: do NOT retry or fallback. If the specialized
      // fetcher is not present, render a clear error and post a debug log.
      if (e === "BOARD_LAYOUT" || e === "BOARD") {
        if (typeof window.boardViewFetcher === "function")
          return window.boardViewFetcher(t, n, o);
        try {
          if (
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage == "function"
          )
            window.vscodeApi.postMessage({
              command: "debugLog",
              level: "error",
              viewKey: o,
              message: "boardViewFetcher.missing",
            });
        } catch (e) {}
        try {
          n.innerHTML =
            '<div class="title">' +
            (t && (t.name || t.id) ? t.name || t.id : "Board") +
            '</div><div style="color:var(--vscode-editor-foreground)">The specific view renderer boardViewFetcher is not available. The view cannot be rendered without its specialized fetcher.</div>';
        } catch (e) {}
        return null;
      }
      if (e === "ROADMAP_LAYOUT" || e === "ROADMAP") {
        if (typeof window.roadmapViewFetcher === "function")
          return window.roadmapViewFetcher(t, n, o);
        try {
          if (
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage == "function"
          )
            window.vscodeApi.postMessage({
              command: "debugLog",
              level: "error",
              viewKey: o,
              message: "roadmapViewFetcher.missing",
            });
        } catch (e) {}
        try {
          n.innerHTML =
            '<div class="title">' +
            (t && (t.name || t.id) ? t.name || t.id : "Roadmap") +
            '</div><div style="color:var(--vscode-editor-foreground)">The specific view renderer roadmapViewFetcher is not available. The view cannot be rendered without its specialized fetcher.</div>';
        } catch (e) {}
        return null;
      }
      if (e === "TABLE_LAYOUT" || e === "TABLE") {
        try {
          if (typeof window.tableViewFetcher !== "function") {
            try {
              if (
                window.vscodeApi &&
                typeof window.vscodeApi.postMessage == "function"
              ) {
                window.vscodeApi.postMessage({
                  command: "debugLog",
                  level: "error",
                  viewKey: o,
                  message: "tableViewFetcher.notFunction",
                  data: { typeof: typeof window.tableViewFetcher },
                });
              }
            } catch (e) {}
            try {
              console.error(
                "tableViewFetcher not a function",
                window.tableViewFetcher
              );
            } catch (e) {}
            // fall through so the later default will also attempt to call and trigger the error handling
          } else {
            return window.tableViewFetcher(t, n, o);
          }
        } catch (err) {}
      }
      if (e === "OVERVIEW" || e === "OVERVIEW_LAYOUT")
        return window.overviewFetcher(n, o);
      try {
        if (typeof window.tableViewFetcher !== "function") {
          try {
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage == "function"
            ) {
              window.vscodeApi.postMessage({
                command: "debugLog",
                level: "error",
                viewKey: o,
                message: "tableViewFetcher.notFunction",
                data: { typeof: typeof window.tableViewFetcher },
              });
            }
          } catch (e) {}
          try {
            console.error(
              "tableViewFetcher not a function",
              window.tableViewFetcher
            );
          } catch (e) {}
          return null;
        }
        return window.tableViewFetcher(t, n, o);
      } catch (err) {
        try {
          console.error("tableViewFetcher invocation failed", err);
        } catch (e) {}
        return null;
      }
    } catch (err) {
      try {
        if (
          window.vscodeApi &&
          typeof window.vscodeApi.postMessage == "function"
        )
          window.vscodeApi.postMessage({
            command: "debugLog",
            level: "error",
            viewKey: o,
            message: "contentFetcher.dispatch.exception",
            data: {
              message: String(err && err.message),
              stack: err && err.stack,
            },
          });
      } catch (e) {}
      try {
        console.error("contentFetcher dispatch exception", err);
      } catch (e) {}
      try {
        // render minimal error so user sees something instead of blank
        n.innerHTML =
          '<div class="title">' +
          (t && (t.name || t.id) ? t.name || t.id : "View") +
          '</div><div style="color:var(--vscode-editor-foreground)">Error rendering view: ' +
          (String((err && err.message) || err) || "") +
          "</div>";
      } catch (e) {}
      return null;
    }
  };
})();
