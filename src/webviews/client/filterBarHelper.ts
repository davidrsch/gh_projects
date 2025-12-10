/// <reference path="./global.d.ts" />

import { computeMatches } from "./filterLogic";
function create(opts: any) {
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

    // internal setter for count used by computeMatches listener
    function barApiInternalSetCount(cnt: any) {
      try {
        countSpan.textContent = String(cnt);
        const show = Boolean(
          String(input.value || "").trim() ||
          String(effectiveFilter || "").trim() ||
          cnt,
        );
        countSpan.style.display = show ? "" : "none";
      } catch (e) {}
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.style.padding = "6px 8px";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "0px";
    saveBtn.style.background = "var(--vscode-button-background, #2ea44f)";
    saveBtn.style.color = "var(--vscode-button-foreground, #ffffff)";
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
          inputChanged || Boolean(layoutChangedGetter && layoutChangedGetter());
        saveBtn.disabled = !changed;
        discardBtn.disabled = !changed;
        try {
          // Visual styling for disabled/enabled state so buttons look disabled
          saveBtn.style.opacity = changed ? "1" : "0.5";
          saveBtn.style.cursor = changed ? "pointer" : "default";
          discardBtn.style.opacity = changed ? "1" : "0.5";
          discardBtn.style.cursor = changed ? "pointer" : "default";
          const showCount = Boolean(
            String(input.value || "").trim() ||
            String(effectiveFilter || "").trim(),
          );
          countSpan.style.display = showCount ? "" : "none";
        } catch (e) {}
      } catch (e) {}
    }

    input.addEventListener("input", updateButtonsState);
    // Simple autocomplete candidates store and UI
    let candidates: any[] = [];
    // Registered items for local preview (array of objects)
    let registeredItems: any[] = [];
    let registeredFields: any[] = [];
    let onFilterCallbacks: any[] = [];
    const suggestBox = document.createElement("div");
    suggestBox.style.position = "absolute";
    suggestBox.style.left = "0";
    suggestBox.style.right = "0";
    suggestBox.style.top = "100%";
    suggestBox.style.zIndex = "40";
    suggestBox.style.background = "var(--vscode-editor-background)";
    suggestBox.style.border = "1px solid var(--vscode-editorWidget-border)";
    suggestBox.style.display = "none";
    suggestBox.style.maxHeight = "240px";
    suggestBox.style.overflow = "auto";
    suggestBox.style.boxSizing = "border-box";
    filterWrapper.appendChild(suggestBox);

    function renderSuggestions(prefix: any) {
      try {
        const q = String(prefix || "")
          .trim()
          .toLowerCase();
        if (!q) {
          suggestBox.style.display = "none";
          return;
        }
        const matches = candidates.filter((c) =>
          String(c || "")
            .toLowerCase()
            .includes(q),
        );
        if (!matches || matches.length === 0) {
          suggestBox.style.display = "none";
          return;
        }
        suggestBox.innerHTML = "";
        for (let i = 0; i < Math.min(matches.length, 50); i++) {
          const it = matches[i];
          const el = document.createElement("div");
          el.textContent = String(it);
          el.style.padding = "6px 8px";
          el.style.cursor = "pointer";
          el.style.whiteSpace = "nowrap";
          el.style.overflow = "hidden";
          el.style.textOverflow = "ellipsis";
          el.addEventListener("mousedown", function (ev) {
            ev.preventDefault();
            try {
              const cur = String(input.value || "");
              const parts = cur.split(/\s+/);
              parts[parts.length - 1] = String(it);
              const newVal = parts.join(" ").trim();
              try {
                input.value = newVal;
              } catch (e) {}
              try {
                input.dispatchEvent(new Event("input", { bubbles: true }));
              } catch (e) {}
              try {
                if (typeof opts.onChange === "function") opts.onChange(newVal);
              } catch (e) {}
              try {
                input.focus();
              } catch (e) {}
            } catch (e) {}
          });
          suggestBox.appendChild(el);
        }
        suggestBox.style.display = "block";
      } catch (e) {
        try {
          suggestBox.style.display = "none";
        } catch (__) {}
      }
    }

    input.addEventListener("input", function () {
      try {
        const v = String(input.value || "");
        const lastToken = v.split(/\s+/).pop() || "";
        renderSuggestions(lastToken);
      } catch (e) {}
    });

    // notify callbacks when input changes
    input.addEventListener("input", function () {
      try {
        const cur = String(input.value || "");
        const matched = new Set(
          computeMatches(cur, registeredItems, registeredFields),
        );
        try {
          if (
            (window as any).__APP_MESSAGING__ &&
            typeof (window as any).__APP_MESSAGING__.postMessage === "function"
          ) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "debugLog",
              level: "debug",
              viewKey: viewKey,
              message: "filterInput",
              data: {
                filter: cur,
                matched: matched.size,
                original: registeredItems.length,
              },
            });
          }
        } catch (e) {}
        try {
          if (typeof barApiInternalSetCount === "function")
            barApiInternalSetCount(matched.size);
        } catch (e) {}
        for (let i = 0; i < onFilterCallbacks.length; i++) {
          try {
            onFilterCallbacks[i](matched, cur);
          } catch (e) {}
        }
      } catch (e) {}
    });
    input.addEventListener("blur", function () {
      setTimeout(() => {
        try {
          suggestBox.style.display = "none";
        } catch (e) {}
      }, 150);
    });
    clearBtn.addEventListener("click", function () {
      try {
        input.value = "";
        try {
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (e) {}
        try {
          if (typeof opts.onChange === "function") opts.onChange("");
        } catch (e) {}
      } catch (e) {}
    });

    saveBtn.addEventListener("click", function () {
      try {
        try {
          if (
            (window as any).__APP_MESSAGING__ &&
            typeof (window as any).__APP_MESSAGING__.postMessage === "function"
          ) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "setViewFilter",
              viewKey: viewKey,
              filter: input.value,
            });
          }
        } catch (e) {}
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
        try {
          if (
            (window as any).__APP_MESSAGING__ &&
            typeof (window as any).__APP_MESSAGING__.postMessage === "function"
          ) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "discardViewFilter",
              viewKey: viewKey,
            });
          }
        } catch (e) {}
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
            (window as any).__APP_MESSAGING__ &&
            typeof (window as any).__APP_MESSAGING__.postMessage === "function"
          ) {
            (window as any).__APP_MESSAGING__.postMessage({
              command: "requestFields",
              first: step,
              viewKey: viewKey,
            });
          }
        } catch (e) {}
      } catch (e) {}
    });

    // initial value
    try {
      input.value = typeof effectiveFilter === "string" ? effectiveFilter : "";
    } catch (e) {}
    updateButtonsState();

    return {
      headerEl: header,
      setCount: function (cnt: any) {
        try {
          countSpan.textContent = String(cnt);
          const show = Boolean(
            String(input.value || "").trim() ||
            String(effectiveFilter || "").trim() ||
            cnt,
          );
          countSpan.style.display = show ? "" : "none";
        } catch (e) {}
      },
      setEffectiveFilter: function (f: any) {
        try {
          effectiveFilter = typeof f === "string" ? f : String(f || "");
          input.value = effectiveFilter;
          updateButtonsState();
        } catch (e) {}
      },
      // Provide candidates for a simple autocomplete helper (array of strings)
      setCandidates: function (arr: any) {
        try {
          candidates = Array.isArray(arr)
            ? arr.map((x) => String(x || ""))
            : [];
          // refresh suggestions for current input
          const last =
            String(input.value || "")
              .split(/\s+/)
              .pop() || "";
          if (last) renderSuggestions(last);
        } catch (e) {}
      },
      setLoadState: function (enabled: any, text: any) {
        try {
          loadBtn.disabled = !enabled;
          loadBtn.textContent = text || (enabled ? "Load more" : "All loaded");
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
      // register items for local preview and pass optional fields config
      registerItems: function (items: any[], options: any) {
        try {
          registeredItems = Array.isArray(items) ? items.slice() : [];
          registeredFields =
            options && Array.isArray(options.fields) ? options.fields : [];
          try {
            barApiInternalSetCount(registeredItems.length);
          } catch (e) {}
        } catch (e) {}
      },
      // subscribe to match changes: callback receives (matchedIdSet, rawFilter)
      onFilterChange: function (cb: any) {
        try {
          if (typeof cb === "function") onFilterCallbacks.push(cb);
        } catch (e) {}
      },
    };
  } catch (e) {
    return null;
  }
}

window.filterBarHelper = { create: create };
