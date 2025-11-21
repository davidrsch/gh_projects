// Shared filter bar helper used by table/board/roadmap fetchers
(function () {
  function create(opts) {
    try {
      const parent = opts && opts.parent ? opts.parent : document.body;
      const suffix = opts && opts.suffix ? String(opts.suffix) : "";
      let effectiveFilter =
        typeof (opts && opts.effFilter) === "string" ? opts.effFilter : "";
      const viewKey = opts && opts.viewKey ? opts.viewKey : null;
      const step = opts && opts.step ? Number(opts.step) : 30;
      const layoutChangedGetter =
        (opts && opts.layoutChangedGetter) ||
        function () {
          return false;
        };

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.marginBottom = "8px";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      left.style.flex = "1 1 auto";
      left.style.minWidth = "0";

      const filterWrapper = document.createElement("div");
      filterWrapper.style.position = "relative";
      filterWrapper.style.flex = "1 1 0";
      filterWrapper.style.minWidth = "0";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Filter items...";
      input.style.padding = "6px 36px 6px 8px";
      input.style.border = "1px solid var(--vscode-editorWidget-border)";
      input.style.borderRadius = "0px";
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.background = "var(--vscode-input-background)";
      input.style.color = "var(--vscode-input-foreground)";
      input.style.outline = "none";
      input.setAttribute("data-filter-input", suffix || "");

      const countSpan = document.createElement("span");
      countSpan.setAttribute("data-filter-count", suffix || "");
      countSpan.style.position = "absolute";
      countSpan.style.right = "44px";
      countSpan.style.top = "50%";
      countSpan.style.transform = "translateY(-50%)";
      countSpan.style.color = "var(--vscode-descriptionForeground)";
      countSpan.style.fontSize = "12px";
      countSpan.style.display = "none";

      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "✕";
      clearBtn.title = "Clear filter";
      clearBtn.style.position = "absolute";
      clearBtn.style.right = "8px";
      clearBtn.style.top = "50%";
      clearBtn.style.transform = "translateY(-50%)";
      clearBtn.style.border = "none";
      clearBtn.style.background = "transparent";
      clearBtn.style.cursor = "pointer";

      filterWrapper.appendChild(input);
      filterWrapper.appendChild(countSpan);
      filterWrapper.appendChild(clearBtn);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.style.padding = "6px 8px";
      saveBtn.style.border = "none";
      saveBtn.style.borderRadius = "0px";
      saveBtn.style.background = "#2ea44f";
      saveBtn.style.color = "#ffffff";
      saveBtn.style.minHeight = "28px";
      saveBtn.style.lineHeight = "16px";
      saveBtn.disabled = true;

      const discardBtn = document.createElement("button");
      discardBtn.type = "button";
      discardBtn.textContent = "Discard";
      discardBtn.style.padding = "6px 8px";
      discardBtn.style.border = "1px solid var(--vscode-editorWidget-border)";
      discardBtn.style.borderRadius = "0px";
      discardBtn.style.background = "transparent";
      discardBtn.style.color = "var(--vscode-button-foreground)";
      discardBtn.style.minHeight = "28px";
      discardBtn.style.lineHeight = "16px";
      discardBtn.disabled = true;

      left.appendChild(filterWrapper);
      // Discard should appear before Save per UX request
      left.appendChild(discardBtn);
      left.appendChild(saveBtn);

      const right = document.createElement("div");
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.textContent = "Load more";
      loadBtn.style.marginLeft = "8px";
      loadBtn.style.border = "1px solid var(--vscode-editorWidget-border)";
      loadBtn.style.borderRadius = "0px";
      loadBtn.style.background = "transparent";
      loadBtn.style.color = "var(--vscode-button-foreground)";
      loadBtn.style.minHeight = "28px";
      loadBtn.style.lineHeight = "16px";

      right.appendChild(loadBtn);
      header.appendChild(left);
      header.appendChild(right);
      parent.appendChild(header);

      // event wiring
      function updateButtonsState() {
        try {
          const inputChanged =
            String(input.value || "") !== String(effectiveFilter || "");
          const changed =
            inputChanged ||
            Boolean(layoutChangedGetter && layoutChangedGetter());
          saveBtn.disabled = !changed;
          discardBtn.disabled = !changed;
          try {
            const showCount = Boolean(
              String(input.value || "").trim() ||
                String(effectiveFilter || "").trim()
            );
            countSpan.style.display = showCount ? "" : "none";
          } catch (e) {}
        } catch (e) {}
      }

      input.addEventListener("input", updateButtonsState);
      clearBtn.addEventListener("click", function () {
        try {
          input.value = "";
          try {
            input.dispatchEvent(new Event("input", { bubbles: true }));
          } catch (e) {}
          // notify extension
          try {
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage === "function"
            )
              window.vscodeApi.postMessage({
                command: "setViewFilter",
                viewKey: viewKey,
                filter: "",
              });
          } catch (e) {}
          if (typeof opts.onSave === "function")
            try {
              opts.onSave("");
            } catch (e) {}
        } catch (e) {}
      });

      saveBtn.addEventListener("click", function () {
        try {
          if (
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage === "function"
          )
            window.vscodeApi.postMessage({
              command: "setViewFilter",
              viewKey: viewKey,
              filter: input.value,
            });
          effectiveFilter = String(input.value || "");
          if (typeof opts.onSave === "function")
            try {
              opts.onSave(effectiveFilter);
            } catch (e) {}
          try {
            updateButtonsState();
          } catch (e) {}
        } catch (e) {}
      });

      discardBtn.addEventListener("click", function () {
        try {
          if (
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage === "function"
          )
            window.vscodeApi.postMessage({
              command: "discardViewFilter",
              viewKey: viewKey,
            });
          if (typeof opts.onDiscard === "function")
            try {
              opts.onDiscard();
            } catch (e) {}
          try {
            updateButtonsState();
          } catch (e) {}
        } catch (e) {}
      });

      loadBtn.addEventListener("click", function () {
        try {
          if (typeof opts.onLoadMore === "function") return opts.onLoadMore();
          try {
            if (
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage === "function"
            )
              window.vscodeApi.postMessage({
                command: "requestFields",
                first: step,
                viewKey: viewKey,
              });
          } catch (e) {}
        } catch (e) {}
      });

      // initial value
      try {
        input.value =
          typeof effectiveFilter === "string" ? effectiveFilter : "";
      } catch (e) {}
      updateButtonsState();

      return {
        headerEl: header,
        setCount: function (cnt) {
          try {
            countSpan.textContent = String(cnt);
            const show = Boolean(
              String(input.value || "").trim() ||
                String(effectiveFilter || "").trim() ||
                cnt
            );
            countSpan.style.display = show ? "" : "none";
          } catch (e) {}
        },
        setEffectiveFilter: function (f) {
          try {
            effectiveFilter = typeof f === "string" ? f : String(f || "");
            input.value = effectiveFilter;
            updateButtonsState();
          } catch (e) {}
        },
        setLoadState: function (enabled, text) {
          try {
            loadBtn.disabled = !enabled;
            loadBtn.textContent =
              text || (enabled ? "Load more" : "All loaded");
          } catch (e) {}
        },
        focusInput: function () {
          try {
            input.focus();
          } catch (e) {}
        },
        inputEl: input,
        saveBtn: saveBtn,
        discardBtn: discardBtn,
        clearBtn: clearBtn,
      };
    } catch (e) {
      return null;
    }
  }

  window.filterBarHelper = { create: create };
})();
