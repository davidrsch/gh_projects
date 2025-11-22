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

      // internal setter for count used by computeMatches listener
      function barApiInternalSetCount(cnt) {
        try {
          countSpan.textContent = String(cnt);
          const show = Boolean(
            String(input.value || "").trim() ||
              String(effectiveFilter || "").trim() ||
              cnt
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
            // Visual styling for disabled/enabled state so buttons look disabled
            saveBtn.style.opacity = changed ? "1" : "0.5";
            saveBtn.style.cursor = changed ? "pointer" : "default";
            discardBtn.style.opacity = changed ? "1" : "0.5";
            discardBtn.style.cursor = changed ? "pointer" : "default";
            const showCount = Boolean(
              String(input.value || "").trim() ||
                String(effectiveFilter || "").trim()
            );
            countSpan.style.display = showCount ? "" : "none";
          } catch (e) {}
        } catch (e) {}
      }

      input.addEventListener("input", updateButtonsState);
      // Simple autocomplete candidates store and UI
      let candidates = [];
      // Registered items for local preview (array of objects)
      let registeredItems = [];
      let registeredFields = [];
      let onFilterCallbacks = [];
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

      function renderSuggestions(prefix) {
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
              .includes(q)
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
                  if (typeof opts.onChange === "function")
                    opts.onChange(newVal);
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

      // Compute matched ids from a filter string using a simple qualifier-aware parser.
      function computeMatches(filter) {
        try {
          const raw = String(filter || "").trim();
          const q = raw.toLowerCase();
          // if no filter return all ids
          if (!q)
            return registeredItems.map((it) =>
              String(it && (it.id || (it.raw && it.raw.id)))
            );

          // build field name -> index map
          const fieldIndexByName = {};
          try {
            for (let fi = 0; fi < registeredFields.length; fi++) {
              const fld = registeredFields[fi];
              if (!fld) continue;
              if (fld.name)
                fieldIndexByName[String(fld.name).toLowerCase()] = fi;
              if (fld.id) fieldIndexByName[String(fld.id).toLowerCase()] = fi;
            }
          } catch (e) {}

          // parse qualifiers like name:"some value" or name:token or -name:token
          const qualifiers = {};
          const qualRe = /(\-?\w+):"([^"]+)"|(\-?\w+):(\S+)/g;
          let m;
          let cleaned = raw;
          while ((m = qualRe.exec(raw)) !== null) {
            const name = (m[1] || m[3] || "").toLowerCase();
            const rawVal = m[2] || m[4] || "";
            if (!name) continue;
            // split comma lists for unquoted values, preserve quoted values intact
            const vals = [];
            try {
              if (m[2]) {
                // quoted — keep as single value
                vals.push(String(rawVal).toLowerCase());
              } else {
                // unquoted — split on commas for OR semantics
                String(rawVal)
                  .split(",")
                  .map((x) => String(x || "").trim())
                  .filter((x) => x.length > 0)
                  .forEach((v) => vals.push(String(v).toLowerCase()));
              }
            } catch (e) {
              vals.push(String(rawVal || "").toLowerCase());
            }
            qualifiers[name] = qualifiers[name] || [];
            qualifiers[name] = qualifiers[name].concat(vals);
            cleaned = cleaned.replace(m[0], " ");
          }

          const freeTokens = cleaned
            .split(/\s+/)
            .map((x) => String(x || "").trim())
            .filter((x) => x.length > 0)
            .map((x) => x.toLowerCase());

          // helper: parse numeric comparator or range
          function parseNumericExpression(v) {
            try {
              const rangeRe = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/;
              const compRe = /^(<=|>=|<|>|=|==)?\s*(-?\d+(?:\.\d+)?)$/;
              let m = rangeRe.exec(v);
              if (m)
                return { type: "range", min: Number(m[1]), max: Number(m[2]) };
              m = compRe.exec(v);
              if (m)
                return { type: "comp", op: m[1] || "=", val: Number(m[2]) };
            } catch (e) {}
            return null;
          }

          // helper: escape regex
          function escRegex(s) {
            return String(s || "").replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
          }

          const out = [];
          for (let ii = 0; ii < registeredItems.length; ii++) {
            const it = registeredItems[ii];
            // build item text
            let parts = [];
            try {
              const c =
                it && it.content
                  ? it.content
                  : (it && it.raw && it.raw.itemContent) || {};
              if (c) {
                if (c.title) parts.push(String(c.title));
                if (c.name) parts.push(String(c.name));
                if (c.number) parts.push(String(c.number));
                if (c.url) parts.push(String(c.url));
              }
              const fv = Array.isArray(it.fieldValues) ? it.fieldValues : [];
              for (let vi = 0; vi < fv.length; vi++) {
                const v = fv[vi];
                if (!v) continue;
                try {
                  if (v.type === "single_select") {
                    if (v.option && v.option.name)
                      parts.push(String(v.option.name));
                  } else if (v.type === "labels" || v.type === "label") {
                    (v.labels || []).forEach(
                      (L) => L && parts.push(String(L.name || L))
                    );
                  } else if (v.type === "text") {
                    if (v.text) parts.push(String(v.text));
                  } else if (v.type === "number") {
                    if (v.number !== undefined) parts.push(String(v.number));
                  } else if (v.type === "issue" || v.type === "parent_issue") {
                    if (v.parent && v.parent.title)
                      parts.push(String(v.parent.title));
                    if (v.parent && v.parent.number)
                      parts.push(String(v.parent.number));
                  } else if (v.type === "pull_request") {
                    if (v.pullRequests && Array.isArray(v.pullRequests.nodes)) {
                      v.pullRequests.nodes.forEach((p) => {
                        if (p && p.title) parts.push(String(p.title));
                        if (p && p.number) parts.push(String(p.number));
                      });
                    }
                  } else {
                    if (v && v.raw) parts.push(JSON.stringify(v.raw));
                  }
                } catch (e) {}
              }
            } catch (e) {}
            const txt = parts.join(" \u0000 ").toLowerCase();

            let ok = true;
            // qualifier checks
            for (const qname in qualifiers) {
              if (!qualifiers.hasOwnProperty(qname)) continue;
              const vals = qualifiers[qname] || [];
              // check for negation prefix
              const isNeg = qname && String(qname).startsWith("-");
              const realName = isNeg ? String(qname).slice(1) : qname;
              for (let vi = 0; vi < vals.length; vi++) {
                const val = vals[vi];
                let matched = false;
                try {
                  // type: match content typename
                  if (realName === "type") {
                    const typ = (
                      (it &&
                        it.content &&
                        (it.content.__typename || it.content.type)) ||
                      (it && it.raw && it.raw.__typename) ||
                      (it && it.type) ||
                      ""
                    )
                      .toString()
                      .toLowerCase();
                    if (typ.indexOf(val) !== -1) matched = true;
                  }

                  // is: qualifier maps to typical item states
                  if (!matched && realName === "is") {
                    const state = (
                      (it && it.content && it.content.state) ||
                      (it && it.state) ||
                      (it && it.raw && it.raw.state) ||
                      ""
                    )
                      .toString()
                      .toLowerCase();
                    if (state.indexOf(val) !== -1) matched = true;
                  }

                  // repo: qualifier maps to repository name
                  if (!matched && realName === "repo") {
                    const repoName = (
                      (it &&
                        it.content &&
                        it.content.repository &&
                        it.content.repository.nameWithOwner) ||
                      (it && it.repository && it.repository.nameWithOwner) ||
                      (it &&
                        it.raw &&
                        it.raw.itemContent &&
                        it.raw.itemContent.repository &&
                        it.raw.itemContent.repository.nameWithOwner) ||
                      ""
                    )
                      .toString()
                      .toLowerCase();
                    if (repoName.indexOf(val) !== -1) matched = true;
                  }

                  // has:field / no:field presence checks — val is expected to be a field name
                  if (!matched && (realName === "has" || realName === "no")) {
                    const fieldName = String(val || "").toLowerCase();
                    const idx = fieldIndexByName[fieldName];
                    if (idx !== undefined && idx !== null) {
                      const fv =
                        (it &&
                          Array.isArray(it.fieldValues) &&
                          it.fieldValues[idx]) ||
                        null;
                      const hasValue =
                        fv &&
                        (fv.type === "labels"
                          ? fv.labels && fv.labels.length > 0
                          : fv.type === "text"
                          ? String(fv.text || "").length > 0
                          : fv.type === "number"
                          ? fv.number !== undefined && fv.number !== null
                          : Boolean(
                              fv &&
                                (fv.option ||
                                  fv.raw ||
                                  fv.parent ||
                                  fv.pullRequests)
                            ));
                      if (realName === "has") matched = !!hasValue;
                      else matched = !hasValue;
                    } else {
                      // if field not found, fallback to checking top-level text
                      matched = txt.indexOf(fieldName) !== -1;
                    }
                  }

                  // field-scoped matching (including numeric comparisons and wildcard)
                  if (!matched && fieldIndexByName[realName] !== undefined) {
                    const idx = fieldIndexByName[realName];
                    const fv =
                      (it &&
                        Array.isArray(it.fieldValues) &&
                        it.fieldValues[idx]) ||
                      null;
                    if (fv) {
                      // attempt numeric expression parsing
                      const numExpr = parseNumericExpression(val);
                      if (
                        numExpr &&
                        ((registeredFields[idx] &&
                          String(
                            registeredFields[idx].dataType ||
                              registeredFields[idx].type ||
                              ""
                          ).toUpperCase() === "NUMBER") ||
                          fv.type === "number")
                      ) {
                        // obtain numeric value
                        let numVal = null;
                        try {
                          if (
                            fv.type === "number" &&
                            typeof fv.number === "number"
                          )
                            numVal = Number(fv.number);
                          else if (fv.raw && fv.raw.value !== undefined)
                            numVal = Number(fv.raw.value);
                          else if (fv.raw && fv.raw.number !== undefined)
                            numVal = Number(fv.raw.number);
                        } catch (e) {}
                        if (numVal !== null && !isNaN(numVal)) {
                          if (numExpr.type === "comp") {
                            const op = numExpr.op || "=";
                            const vnum = Number(numExpr.val);
                            if (op === ">") matched = numVal > vnum;
                            else if (op === ">=") matched = numVal >= vnum;
                            else if (op === "<") matched = numVal < vnum;
                            else if (op === "<=") matched = numVal <= vnum;
                            else matched = numVal === vnum;
                          } else if (numExpr.type === "range") {
                            matched =
                              numVal >= Number(numExpr.min) &&
                              numVal <= Number(numExpr.max);
                          }
                        }
                      } else {
                        // string/wildcard matching
                        const oneText = (function (v) {
                          try {
                            if (!v) return "";
                            if (v.type === "single_select")
                              return String(
                                (v.option && v.option.name) || ""
                              ).toLowerCase();
                            if (v.type === "labels" || v.type === "label")
                              return (v.labels || [])
                                .map((L) => String((L && (L.name || L)) || ""))
                                .join(" ")
                                .toLowerCase();
                            if (v.type === "text")
                              return String(v.text || "").toLowerCase();
                            if (v.type === "number")
                              return String(v.number || "").toLowerCase();
                            if (v.type === "issue" || v.type === "parent_issue")
                              return String(
                                (v.parent && v.parent.title) || ""
                              ).toLowerCase();
                            if (v.type === "pull_request")
                              return (
                                v.pullRequests &&
                                Array.isArray(v.pullRequests.nodes)
                                  ? v.pullRequests.nodes
                                      .map((p) =>
                                        String(p.title || p.number || "")
                                      )
                                      .join(" ")
                                  : ""
                              ).toLowerCase();
                            if (v && v.raw)
                              return JSON.stringify(v.raw).toLowerCase();
                          } catch (e) {}
                          return "";
                        })(fv);
                        if (val.indexOf("*") !== -1) {
                          try {
                            const rx = new RegExp(
                              escRegex(val).replace(/\\\*/g, ".*"),
                              "i"
                            );
                            if (rx.test(oneText)) matched = true;
                          } catch (e) {}
                        } else {
                          if (oneText.indexOf(val) !== -1) matched = true;
                        }
                      }
                    }
                  }

                  // fallback: search the whole item text
                  if (!matched) {
                    if (val.indexOf("*") !== -1) {
                      try {
                        const rx = new RegExp(
                          escRegex(val).replace(/\\\*/g, ".*"),
                          "i"
                        );
                        if (rx.test(txt)) matched = true;
                      } catch (e) {}
                    } else if (txt.indexOf(val) !== -1) matched = true;
                  }
                } catch (e) {}
                if (isNeg) {
                  if (matched) {
                    ok = false;
                    break;
                  }
                } else {
                  if (!matched) {
                    ok = false;
                    break;
                  }
                }
              }
              if (!ok) break;
            }
            if (!ok) continue;

            // free-text tokens (all must match)
            for (let ti = 0; ti < freeTokens.length; ti++) {
              const tok = freeTokens[ti];
              if (!tok) continue;
              if (tok.indexOf("*") !== -1) {
                try {
                  const rx = new RegExp(
                    escRegex(tok).replace(/\\\*/g, ".*"),
                    "i"
                  );
                  if (!rx.test(txt)) {
                    ok = false;
                    break;
                  }
                } catch (e) {
                  ok = false;
                  break;
                }
              } else {
                if (txt.indexOf(tok) === -1) {
                  ok = false;
                  break;
                }
              }
            }
            if (ok) out.push(String(it && (it.id || (it.raw && it.raw.id))));
          }
          return out;
        } catch (e) {
          return registeredItems.map((it) =>
            String(it && (it.id || (it.raw && it.raw.id)))
          );
        }
      }

      // notify callbacks when input changes
      input.addEventListener("input", function () {
        try {
          const cur = String(input.value || "");
          const matched = new Set(computeMatches(cur));
          try {
            if (
              typeof window.vscodeApi == "object" &&
              window.vscodeApi &&
              typeof window.vscodeApi.postMessage == "function"
            )
              window.vscodeApi.postMessage({
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
        // Provide candidates for a simple autocomplete helper (array of strings)
        setCandidates: function (arr) {
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
        // register items for local preview and pass optional fields config
        registerItems: function (items, options) {
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
        onFilterChange: function (cb) {
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
})();
