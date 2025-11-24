/// <reference path="./global.d.ts" />

import { escapeHtml, normalizeColor, getContrastColor } from "./utils";
import { renderCell } from "./renderers/cellRenderer";
/// <reference path="./global.d.ts" />

window.tableViewFetcher = function (G: any, z: any, R: any) {
  z.innerHTML =
    '<div class="title">' +
    (G.name || G.id || "Table View") +
    '</div><div class="loading"><em>Loading table\u2026</em></div>';
  let N = 30;
  function P(e: any) {
    let n = (e && e.fields) || [],
      s = (e && e.items) || [];
    (z.innerHTML = ""),
      (document.documentElement.style.margin = "0"),
      (document.documentElement.style.padding = "0"),
      (document.documentElement.style.height = "100%"),
      (document.body.style.margin = "0"),
      (document.body.style.padding = "0"),
      (document.body.style.height = "100%"),
      (z.style.margin = "0"),
      (z.style.padding = "0"),
      (z.style.height = "100%");
    let u = document.createElement("div");
    u.style.display = "flex";
    u.style.justifyContent = "space-between";
    u.style.alignItems = "center";
    u.style.position = "relative";
    u.style.zIndex = "20";
    u.style.background = "var(--vscode-editor-background)";

    // Try the shared filter helper first; if it renders a header into `u`,
    // we skip adding our own title/load controls to avoid duplicates.
    let barApi = null;
    let skipOwnHeader = false;
    try {
      const suffix = R ? String(R).split(":").pop() : "";
      if (
        window.filterBarHelper &&
        typeof window.filterBarHelper.create === "function"
      ) {
        try {
          barApi = window.filterBarHelper.create({
            parent: u,
            suffix: suffix,
            effFilter: undefined,
            viewKey: R,
            step: N,
            onLoadMore: function () {
              N += 30;
              Y();
            },
          });
          if (barApi) {
            skipOwnHeader = true;
            try {
              // Ensure the helper header can flex-grow to occupy available space
              if (barApi.headerEl && barApi.headerEl.style) {
                barApi.headerEl.style.flex = "1 1 auto";
                barApi.headerEl.style.minWidth = "0";
              }
              // If helper exposes the input element, ensure it grows
              const helperInput =
                (barApi && barApi.inputEl) ||
                (barApi.headerEl &&
                  barApi.headerEl.querySelector &&
                  barApi.headerEl.querySelector("[data-filter-input]"));
              if (helperInput && helperInput.style) {
                helperInput.style.flex = "1 1 auto";
                helperInput.style.width = "100%";
                helperInput.style.minWidth = "0";
              }
              try {
                // Provide autocomplete candidates based on fields and their options
                if (
                  Array.isArray(n) &&
                  typeof barApi.setCandidates === "function"
                ) {
                  const cand = [];
                  try {
                    for (let fi = 0; fi < n.length; fi++) {
                      const fld = n[fi];
                      if (!fld) continue;
                      if (fld.name) cand.push(String(fld.name) + ":");
                      if (Array.isArray(fld.options)) {
                        for (let oi = 0; oi < fld.options.length; oi++) {
                          const opt = fld.options[oi];
                          try {
                            if (opt && opt.name && fld.name)
                              cand.push(
                                String(fld.name) + ":" + String(opt.name)
                              );
                          } catch (e) { }
                        }
                      }
                    }
                  } catch (e) { }
                  // Do not inject hard-coded default qualifiers here; keep candidates derived from fields only.
                  try {
                    barApi.setCandidates(cand);
                  } catch (e) { }
                }
              } catch (e) { }
            } catch (e) { }
          }
        } catch (e) {
          barApi = null;
        }
      }
    } catch (e) {
      barApi = null;
    }

    let b = document.createElement("div");
    b.className = "title";
    b.textContent = G.name || G.id || "Table View";
    let S = document.createElement("div");
    let v = document.createElement("button");
    v.textContent = "Load more";
    v.style.marginLeft = "8px";
    v.addEventListener("click", () => {
      N += 30;
      Y();
      v.disabled = !0;
      v.textContent = "Loading";
    });

    if (!skipOwnHeader) {
      S.appendChild(v);
      u.appendChild(b);
      u.appendChild(S);
    }

    z.appendChild(u);
    // Attach local filter handler by registering items with the centralized helper
    try {
      if (barApi && barApi.inputEl) {
        try {
          if (typeof barApi.registerItems === "function") {
            try {
              barApi.registerItems(s, { fields: n });
            } catch (e) { }
          }
          if (typeof barApi.onFilterChange === "function") {
            barApi.onFilterChange(function (matchedIds: any, rawFilter: any) {
              try {
                const rows = Array.from(
                  document.querySelectorAll("tr[data-gh-item-id]")
                );
                for (let r = 0; r < rows.length; r++) {
                  try {
                    const el = rows[r];
                    const id = el.getAttribute("data-gh-item-id");
                    (el as HTMLElement).style.display = matchedIds.has(String(id))
                      ? "table-row"
                      : "none";
                  } catch (e) { }
                }
              } catch (e) { }
              try {
                const groupHeaders = Array.from(
                  document.querySelectorAll("tr[data-group-index]")
                );
                for (let ghI = 0; ghI < groupHeaders.length; ghI++) {
                  try {
                    const ghEl = groupHeaders[ghI];
                    const gidx = ghEl.getAttribute("data-group-index");
                    const groupRows = Array.from(
                      document.getElementsByClassName("group-rows-" + gidx)
                    );
                    let visibleCount = 0;
                    for (let gi = 0; gi < groupRows.length; gi++) {
                      try {
                        const rEl = groupRows[gi];
                        if ((rEl as HTMLElement).style.display !== "none") visibleCount++;
                      } catch (e) { }
                    }
                    try {
                      const badge = ghEl.querySelector("[data-group-count]");
                      if (badge) badge.textContent = String(visibleCount);
                    } catch (e) { }
                    try {
                      (ghEl as HTMLElement).style.display =
                        visibleCount > 0 ? "table-row" : "none";
                    } catch (e) { }
                    try {
                      (ghEl as HTMLElement).style.display =
                        visibleCount > 0 ? "table-row" : "none";
                    } catch (e) { }
                  } catch (e) { }
                }
              } catch (e) { }
              try {
                if (barApi && typeof barApi.setCount === "function")
                  barApi.setCount(matchedIds.size);
              } catch (e) { }
            });
          }
        } catch (e) { }
      }
    } catch (e) { }
    let C = document.createElement("div");
    (C.style.overflowX = "auto"),
      (C.style.overflowY = "auto"),
      (C.style.width = "100%"),
      (C.style.display = "block");
    let E = document.createElement("table");
    (E.style.borderCollapse = "separate"),
      (E.style.borderSpacing = "0"),
      (E.style.tableLayout = "fixed"),
      (E.style.width = "max-content");
    let W = document.createElement("colgroup"),
      D = document.createElement("col");
    W.appendChild(D);
    for (let c = 0; c < n.length; c++) {
      let i = document.createElement("col");
      W.appendChild(i);
    }
    E.appendChild(W);
    let H = document.createElement("thead");
    (H.style.background = "var(--vscode-editor-background)"),
      (H.style.position = "relative"),
      (H.style.zIndex = "10");
    let T = document.createElement("tr"),
      _ = document.createElement("th");
    (_.textContent = "#"),
      (_.style.padding = "6px"),
      (_.style.textAlign = "left"),
      (_.style.borderLeft = "none"),
      (_.style.borderRight = "1px solid var(--vscode-editorGroup-border)"),
      (_.style.borderTop = "1px solid var(--vscode-editorGroup-border)"),
      (_.style.borderBottom = "1px solid var(--vscode-editorGroup-border)"),
      (_.style.position = "sticky"),
      (_.style.top = "0"),
      (_.style.zIndex = "11"),
      (_.style.background = "var(--vscode-editor-background)"),
      T.appendChild(_);
    for (let c of n) {
      let i = document.createElement("th");
      (i.textContent = c.name || c.id || ""),
        (i.style.padding = "6px"),
        (i.style.textAlign = "left"),
        (i.style.whiteSpace = "nowrap"),
        (i.style.overflow = "hidden"),
        (i.style.textOverflow = "ellipsis"),
        (i.style.borderLeft = "1px solid var(--vscode-editorGroup-border)"),
        (i.style.borderRight = "1px solid var(--vscode-editorGroup-border)"),
        (i.style.borderTop = "1px solid var(--vscode-editorGroup-border)"),
        (i.style.borderBottom = "1px solid var(--vscode-editorGroup-border)"),
        (i.style.position = "sticky"),
        (i.style.top = "0"),
        (i.style.zIndex = "11"),
        (i.style.background = "var(--vscode-editor-background)"),
        T.appendChild(i);
    }
    H.appendChild(T), E.appendChild(H);
    let j = document.createElement("tbody");

    // Determine grouping field (if any) from the view details attached to G.
    // Prefer `groupByFields` then `verticalGroupByFields`. If missing, fall back to no grouping.
    let groupingFieldName = null;
    try {
      if (G && G.details) {
        const gb =
          G.details.groupByFields &&
            Array.isArray(G.details.groupByFields.nodes)
            ? G.details.groupByFields.nodes
            : null;
        const vgb =
          G.details.verticalGroupByFields &&
            Array.isArray(G.details.verticalGroupByFields.nodes)
            ? G.details.verticalGroupByFields.nodes
            : null;
        if (vgb && vgb.length > 0) groupingFieldName = vgb[0].name || null;
        else if (gb && gb.length > 0) groupingFieldName = gb[0].name || null;
      }
    } catch (e) {
      groupingFieldName = null;
    }

    // Find the index of the grouping field within the payload fields (n)
    let groupingIndex = -1;
    let groupingFieldConfig = null;
    if (groupingFieldName) {
      for (let idx = 0; idx < n.length; idx++) {
        try {
          const f = n[idx];
          if (!f) continue;
          if (
            String(f.name || "").toLowerCase() ===
            String(groupingFieldName || "").toLowerCase() ||
            String(f.id || "") === String(groupingFieldName || "")
          ) {
            groupingIndex = idx;
            groupingFieldConfig = f;
            break;
          }
        } catch (e) { }
      }
    }

    if (groupingIndex === -1) {
      // No grouping — render flat list as before
      for (let c = 0; c < s.length; c++) {
        let i = s[c],
          t = document.createElement("tr"),
          o = document.createElement("td");
        try {
          t.setAttribute("data-gh-item-id", String(i && i.id));
        } catch (e) { }
        (o.textContent = String(c + 1)),
          (o.style.padding = "6px"),
          (o.style.whiteSpace = "nowrap"),
          (o.style.overflow = "hidden"),
          (o.style.textOverflow = "ellipsis"),
          (o.style.borderTop = "1px solid var(--vscode-editorGroup-border)"),
          (o.style.borderRight =
            "1px solid var(--vscode-editorGroup-border)"),
          (o.style.borderBottom =
            "1px solid var(--vscode-editorGroup-border)"),
          (o.style.borderLeft = "none"),
          t.appendChild(o);
        let l = i.fieldValues || [];
        for (let r = 0; r < n.length; r++) {
          let a = document.createElement("td");
          (a.style.padding = "6px"),
            (a.style.border = "1px solid var(--vscode-editorGroup-border)"),
            (a.style.whiteSpace = "nowrap"),
            (a.style.overflow = "hidden"),
            (a.style.textOverflow = "ellipsis"),
            (a.innerHTML = l[r] ? renderCell(l[r], n[r], i, s) : ""),
            (a.style.position = "relative");
          let p = document.createElement("div");
          (p.style.position = "absolute"),
            (p.style.right = "0"),
            (p.style.top = "0"),
            (p.style.width = "8px"),
            (p.style.cursor = "col-resize"),
            (p.style.userSelect = "none"),
            (p.style.height = "100%"),
            (p.style.zIndex = "20"),
            (p.style.transform = "translateX(2px)"),
            a.appendChild(p),
            (function (g) {
              let f = W.children,
                h = 0,
                w = 0;
              function x(L: any) {
                let q = L.clientX - h,
                  B = Math.max(20, w + q);
                (f[g] as HTMLElement).style.width = B + "px";
              }
              function k() {
                document.removeEventListener("mousemove", x),
                  document.removeEventListener("mouseup", k),
                  (document.body.style.cursor = ""),
                  (document.body.style.userSelect = "");
              }
              p.addEventListener("mousedown", function (L) {
                L.preventDefault(),
                  (h = L.clientX),
                  (w = f[g].getBoundingClientRect().width),
                  document.addEventListener("mousemove", x),
                  document.addEventListener("mouseup", k),
                  (document.body.style.cursor = "col-resize"),
                  (document.body.style.userSelect = "none");
              });
            })(r + 1),
            t.appendChild(a);
        }
        j.appendChild(t);
      }
    } else {
      // Grouping — build ordered groups using the grouping field's options
      const fieldOptions =
        (groupingFieldConfig && groupingFieldConfig.options) || [];
      // Map to collect items per option id/name
      const groups: any[] = [];
      const orphanItems: any[] = [];
      const map: Record<string, any[]> = {};
      for (let oi = 0; oi < fieldOptions.length; oi++) {
        const opt = fieldOptions[oi];
        const key = String(opt.id ?? opt.name ?? oi);
        map[key] = [];
      }

      // Helper to extract the option id/name from a normalized value
      function valueMatchesOption(v: any, opt: any) {
        try {
          if (!v) return false;
          if (v.type === "single_select") {
            const oid = v.option && v.option.id ? String(v.option.id) : null;
            const oname =
              v.option && v.option.name ? String(v.option.name) : null;
            if (oid && opt.id && String(oid) === String(opt.id)) return true;
            if (oname && opt.name && String(oname) === String(opt.name))
              return true;
            // sometimes raw will contain direct option id/name
            if (
              v.raw &&
              v.raw.option &&
              v.raw.option.id &&
              opt.id &&
              String(v.raw.option.id) === String(opt.id)
            )
              return true;
          }
          // fallback: raw.value or raw.name
          if (v && v.raw) {
            if (v.raw.id && opt.id && String(v.raw.id) === String(opt.id))
              return true;
            if (
              v.raw.name &&
              opt.name &&
              String(v.raw.name) === String(opt.name)
            )
              return true;
          }
        } catch (e) { }
        return false;
      }

      for (let si = 0; si < s.length; si++) {
        const item = s[si];
        const fv = Array.isArray(item.fieldValues) ? item.fieldValues : [];
        const v = fv[groupingIndex];
        let placed = false;
        for (let oi = 0; oi < fieldOptions.length; oi++) {
          const opt = fieldOptions[oi];
          const key = String(opt.id ?? opt.name ?? oi);
          if (valueMatchesOption(v, opt)) {
            map[key].push({ item, index: si });
            placed = true;
            break;
          }
        }
        if (!placed) orphanItems.push({ item, index: si });
      }

      // Build groups array in the order of fieldOptions, omitting empty groups
      for (let oi = 0; oi < fieldOptions.length; oi++) {
        const opt = fieldOptions[oi];
        const key = String(opt.id ?? opt.name ?? oi);
        const itemsForOpt = map[key] || [];
        if (itemsForOpt.length === 0) continue;
        groups.push({ option: opt, items: itemsForOpt });
      }
      // If there are orphan items, append them as a final group labelled 'Unassigned'
      if (orphanItems.length > 0) {
        groups.push({
          option: {
            id: "__none__",
            name: "Unassigned",
            color: "GRAY",
            description: "Items without a value",
          },
          items: orphanItems,
        });
      }

      // Try to find a numeric 'Estimate' field to aggregate per-group sums (case-insensitive name match)
      let estimateFieldIndex = -1;
      try {
        for (let fi = 0; fi < n.length; fi++) {
          const f = n[fi];
          if (!f) continue;
          if (
            String(f.name || "")
              .toLowerCase()
              .indexOf("estimate") !== -1 &&
            String(f.dataType || "").toUpperCase() === "NUMBER"
          ) {
            estimateFieldIndex = fi;
            break;
          }
        }
      } catch (e) { }

      // Render groups in order
      let renderedRowCount = 0;
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = groups[gi];
        const opt = grp.option || {};
        const itemsForOpt = grp.items || [];
        // Group header row
        const gh = document.createElement("tr");
        const totalCols =
          W && W.children && W.children.length
            ? W.children.length
            : 1 + n.length;
        const headerTd = document.createElement("td");
        headerTd.setAttribute("colspan", String(totalCols));
        headerTd.style.padding = "6px";
        headerTd.style.border = "1px solid var(--vscode-editorGroup-border)";
        // remove left/right borders so the divider looks full-width
        headerTd.style.borderLeft = "none";
        headerTd.style.borderRight = "none";
        headerTd.style.background = "var(--vscode-editor-background)";
        headerTd.style.fontWeight = "600";
        // Keep the TD as a table-cell and add an inner flex container to occupy full width
        const headerInner = document.createElement("div");
        headerInner.style.display = "flex";
        headerInner.style.alignItems = "center";
        headerInner.style.gap = "8px";
        headerInner.style.width = "100%";
        headerInner.style.boxSizing = "border-box";
        headerInner.style.minWidth = "0";

        // Collapse toggle
        const toggle = document.createElement("button");
        toggle.textContent = "\u2212"; // minus by default (expanded)
        toggle.style.width = "28px";
        toggle.style.height = "28px";
        toggle.style.display = "inline-flex";
        toggle.style.alignItems = "center";
        toggle.style.justifyContent = "center";
        toggle.style.border = "1px solid transparent";
        toggle.style.background = "transparent";
        toggle.style.cursor = "pointer";
        // Use theme text color for the toggle so it matches editor text
        toggle.style.color = "var(--vscode-editor-foreground)";
        toggle.style.fill = "var(--vscode-editor-foreground)";

        // Color circle (use a simple div for reliable rendering)
        const normColor = normalizeColor(opt.color || opt.colour || null) || "#999999";
        const colorDot = document.createElement("div");
        colorDot.style.display = "inline-block";
        colorDot.style.width = "14px";
        colorDot.style.height = "14px";
        colorDot.style.borderRadius = "50%";
        colorDot.style.marginLeft = "6px";
        colorDot.style.flex = "0 0 auto";
        // background and subtle border for contrast
        try {
          colorDot.style.background = normColor;
          colorDot.style.border =
            "1px solid " + (getContrastColor(normColor) || "rgba(0,0,0,0.2)");
        } catch (e) {
          colorDot.style.background = "#999999";
          colorDot.style.border = "1px solid rgba(0,0,0,0.2)";
        }

        // Title and meta
        const titleWrap = document.createElement("div");
        titleWrap.style.display = "flex";
        titleWrap.style.alignItems = "center";
        titleWrap.style.gap = "8px";
        titleWrap.style.flex = "1 1 auto";
        titleWrap.style.minWidth = "0";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = opt.name || "(no name)";
        nameSpan.style.whiteSpace = "nowrap";
        nameSpan.style.overflow = "hidden";
        nameSpan.style.textOverflow = "ellipsis";

        // Name then numeric count badge
        const countBadge = document.createElement("span");
        countBadge.textContent = String(itemsForOpt.length);
        countBadge.style.display = "inline-flex";
        countBadge.style.alignItems = "center";
        countBadge.style.justifyContent = "center";
        countBadge.style.width = "20px";
        countBadge.style.height = "20px";
        countBadge.style.minWidth = "20px";
        countBadge.style.borderRadius = "999px";
        countBadge.style.padding = "0 6px";
        countBadge.style.boxSizing = "border-box";
        countBadge.style.background =
          "var(--vscode-badge-background, #007acc)";
        countBadge.style.color = "var(--vscode-badge-foreground, #ffffff)";
        countBadge.style.fontSize = "12px";
        countBadge.style.fontWeight = "600";
        countBadge.style.marginLeft = "6px";
        titleWrap.appendChild(nameSpan);
        titleWrap.appendChild(countBadge);

        // Optional estimate aggregate
        if (estimateFieldIndex !== -1) {
          let sum = 0;
          for (let ii = 0; ii < itemsForOpt.length; ii++) {
            try {
              const it = itemsForOpt[ii].item;
              const fv = Array.isArray(it.fieldValues) ? it.fieldValues : [];
              const val = fv[estimateFieldIndex];
              if (
                val &&
                val.type === "number" &&
                typeof val.number === "number"
              )
                sum += Number(val.number || 0);
            } catch (e) { }
          }
          const estSpan = document.createElement("span");
          estSpan.textContent = "Estimate: " + String(sum);
          estSpan.style.display = "inline-flex";
          estSpan.style.alignItems = "center";
          estSpan.style.justifyContent = "center";
          estSpan.style.padding = "2px 8px";
          estSpan.style.borderRadius = "999px";
          // use option color for pill background with contrasting text
          try {
            // Use a neutral grey pill background for estimates
            estSpan.style.background = "rgba(128,128,128,0.12)";
            estSpan.style.color = "var(--vscode-descriptionForeground)";
            estSpan.style.border = "1px solid rgba(128,128,128,0.18)";
          } catch (e) {
            estSpan.style.color = "var(--vscode-descriptionForeground)";
          }
          estSpan.style.marginLeft = "8px";
          estSpan.style.fontSize = "12px";
          titleWrap.appendChild(estSpan);
        }

        // Apply color directly to the SVG circle fill to avoid relying on CSS currentColor


        headerInner.appendChild(toggle);
        headerInner.appendChild(colorDot);
        headerInner.appendChild(titleWrap);

        // Option description (if present). Place it inside the title wrap so it appears after estimate.
        if (opt.description) {
          const desc = document.createElement("div");
          desc.textContent = opt.description;
          desc.style.color = "var(--vscode-descriptionForeground)";
          desc.style.marginLeft = "8px";
          desc.style.whiteSpace = "nowrap";
          desc.style.overflow = "hidden";
          desc.style.textOverflow = "ellipsis";
          desc.style.maxWidth = "30%";
          titleWrap.appendChild(desc);
        }

        headerTd.appendChild(headerInner);

        try {
          gh.setAttribute("data-group-index", String(gi));
        } catch (e) { }
        try {
          countBadge.setAttribute("data-group-count", "");
        } catch (e) { }

        gh.appendChild(headerTd);
        j.appendChild(gh);

        // Render each item row for this group — attach a class so we can toggle visibility
        const groupRowClass = "group-rows-" + gi;
        for (let ii = 0; ii < itemsForOpt.length; ii++) {
          const { item, index } = itemsForOpt[ii];
          let tr = document.createElement("tr");
          try {
            tr.setAttribute("data-gh-item-id", String(item && item.id));
          } catch (e) { }
          tr.className = groupRowClass;
          let tdIndex = document.createElement("td");
          tdIndex.textContent = String(index + 1);
          tdIndex.style.padding = "6px";
          tdIndex.style.whiteSpace = "nowrap";
          tdIndex.style.overflow = "hidden";
          tdIndex.style.textOverflow = "ellipsis";
          tdIndex.style.borderTop =
            "1px solid var(--vscode-editorGroup-border)";
          tdIndex.style.borderRight =
            "1px solid var(--vscode-editorGroup-border)";
          tdIndex.style.borderBottom =
            "1px solid var(--vscode-editorGroup-border)";
          tdIndex.style.borderLeft = "none";
          tr.appendChild(tdIndex);
          const fv = Array.isArray(item.fieldValues) ? item.fieldValues : [];
          for (let col = 0; col < n.length; col++) {
            let td = document.createElement("td");
            td.style.padding = "6px";
            td.style.border = "1px solid var(--vscode-editorGroup-border)";
            td.style.whiteSpace = "nowrap";
            td.style.overflow = "hidden";
            td.style.textOverflow = "ellipsis";
            td.innerHTML = fv[col] ? renderCell(fv[col], n[col], item, s) : "";
            td.style.position = "relative";
            // resizer handle
            let pr = document.createElement("div");
            pr.style.position = "absolute";
            pr.style.right = "0";
            pr.style.top = "0";
            pr.style.width = "8px";
            pr.style.cursor = "col-resize";
            pr.style.userSelect = "none";
            pr.style.height = "100%";
            pr.style.zIndex = "20";
            pr.style.transform = "translateX(2px)";
            td.appendChild(pr);
            (function (g) {
              let f = W.children,
                h = 0,
                w = 0;
              function x(L: MouseEvent) {
                let q = L.clientX - h,
                  B = Math.max(20, w + q);
                (f[g] as HTMLElement).style.width = B + "px";
              }
              function k() {
                document.removeEventListener("mousemove", x),
                  document.removeEventListener("mouseup", k),
                  (document.body.style.cursor = ""),
                  (document.body.style.userSelect = "");
              }
              pr.addEventListener("mousedown", function (L) {
                L.preventDefault(),
                  (h = L.clientX),
                  (w = f[g].getBoundingClientRect().width),
                  document.addEventListener("mousemove", x),
                  document.addEventListener("mouseup", k),
                  (document.body.style.cursor = "col-resize"),
                  (document.body.style.userSelect = "none");
              });
            })(col + 1);
            tr.appendChild(td);
          }
          j.appendChild(tr);
          renderedRowCount++;
        }

        // wire collapse toggle to hide/show rows for this group
        (function (cls, btn) {
          let expanded = true;
          btn.addEventListener("click", function () {
            expanded = !expanded;
            const rows = Array.from(document.getElementsByClassName(cls));
            for (let x = 0; x < rows.length; x++) {
              const el = rows[x] as HTMLElement;
              try {
                el.style.display = expanded ? "table-row" : "none";
              } catch (e) { }
            }
            btn.textContent = expanded ? "\u2212" : "+";
          });
        })(groupRowClass, toggle);
      }
    }
    E.appendChild(j),
      C.appendChild(E),
      z.appendChild(C),
      (function () {
        try {
          let i = W.children,
            t = T.children;
          for (let o = 0; o < t.length && o < i.length; o++) {
            let l = t[o],
              r = document.createElement("span");
            (r.style.visibility = "hidden"),
              (r.style.position = "absolute"),
              (r.style.whiteSpace = "nowrap"),
              (r.style.font = window.getComputedStyle(l).font || ""),
              (r.textContent = l.textContent || ""),
              document.body.appendChild(r);
            let a = r.offsetWidth;
            document.body.removeChild(r);
            let g = Math.max(l.clientWidth, a + 24);
            (i[o] as HTMLElement).style.width = g + "px";
          }
        } catch { }
      })();
    try {
      let c = E.getBoundingClientRect().width;
      c && isFinite(c) && (E.style.width = c + "px");
    } catch { }
    (function () {
      let i = W.children,
        t = T.children;
      for (let o = 0; o < t.length && o < i.length; o++) {
        let l = t[o] as HTMLElement;
        l.style.position || (l.style.position = "relative");
        let r = document.createElement("div");
        (r.style.position = "absolute"),
          (r.style.right = "0"),
          (r.style.top = "0"),
          (r.style.width = "8px"),
          (r.style.cursor = "col-resize"),
          (r.style.userSelect = "none"),
          (r.style.height = "100%"),
          (r.style.zIndex = "20"),
          (r.style.transform = "translateX(2px)"),
          l.appendChild(r),
          (function (a) {
            let p = 0,
              g = 0;
            function f(w: MouseEvent) {
              let x = w.clientX - p,
                k = Math.max(20, g + x);
              (i[a] as HTMLElement).style.width = k + "px";
            }
            function h() {
              document.removeEventListener("mousemove", f),
                document.removeEventListener("mouseup", h),
                (document.body.style.cursor = ""),
                (document.body.style.userSelect = "");
            }
            r.addEventListener("mousedown", function (w) {
              w.preventDefault(),
                (p = w.clientX),
                (g = i[a].getBoundingClientRect().width),
                document.addEventListener("mousemove", f),
                document.addEventListener("mouseup", h),
                (document.body.style.cursor = "col-resize"),
                (document.body.style.userSelect = "none");
            });
          })(o);
      }
    })();
    try {
      if (barApi && typeof barApi.setLoadState === "function") {
        barApi.setLoadState(
          s.length < N,
          s.length >= N ? "Load more" : "All loaded"
        );
      } else {
        if (s.length >= N) {
          v.disabled = !1;
          v.textContent = "Load more";
        } else {
          v.disabled = !0;
          v.textContent = "All loaded";
        }
      }
    } catch (e) { }
    function U() {
      let c = z.clientHeight,
        i = u.offsetHeight,
        t = Math.max(0, c - i);
      C.style.maxHeight = t + "px";
    }
    U(),
      window.addEventListener("resize", U),
      document.addEventListener("click", function (c) {
        try {
          let i = c.target as HTMLElement;
          if (!i) return;
          let t = i.closest
            ? i.closest("[data-gh-open]")
            : i.getAttribute && i.getAttribute("data-gh-open")
              ? i
              : null;
          if (t) {
            let o = t.getAttribute("data-gh-open");
            if (o) {
              try {
                if (
                  typeof window.vscodeApi == "object" &&
                  window.vscodeApi &&
                  typeof window.vscodeApi.postMessage == "function"
                ) {
                  window.vscodeApi.postMessage({ command: "openUrl", url: o }),
                    c.preventDefault();
                  return;
                }
              } catch { }
              try {
                window.open(o, "_blank"), c.preventDefault();
              } catch { }
            }
          }
        } catch { }
      }),
      document.addEventListener("keydown", function (c) {
        try {
          if (c.key !== "Enter" && c.key !== " ") return;
          let i = document.activeElement;
          if (i && i.getAttribute) {
            let t = i.getAttribute("data-gh-open");
            if (t) {
              try {
                if (
                  typeof window.vscodeApi == "object" &&
                  window.vscodeApi &&
                  typeof window.vscodeApi.postMessage == "function"
                ) {
                  window.vscodeApi.postMessage({ command: "openUrl", url: t }),
                    c.preventDefault();
                  return;
                }
              } catch { }
              try {
                window.open(t, "_blank"), c.preventDefault();
              } catch { }
            }
          }
        } catch { }
      });
  }
  function J(e: MessageEvent) {
    var s;
    let n = e && e.data ? e.data : e;
    try {
      window.vscodeApi &&
        typeof window.vscodeApi.postMessage == "function" &&
        window.vscodeApi.postMessage({
          command: "debugLog",
          level: "debug",
          viewKey: R,
          message: "tableViewFetcher.onMessage",
          data: { command: n && n.command, eventViewKey: n && n.viewKey },
        });
    } catch { }
    try {
      console.log("tableViewFetcher.onMessage", {
        command: n && n.command,
        viewKey: n && n.viewKey,
      });
    } catch { }
    if (n && n.command === "fields") {
      if (n.viewKey && R && String(n.viewKey) !== String(R)) {
        try {
          typeof window.__gh_update_debug__ == "function" &&
            window.__gh_update_debug__(
              "local=" +
              String(R) +
              `
event=` +
              String(n.viewKey) +
              `
allowed=false`
            );
        } catch { }
        return;
      }
      try {
        typeof window.__gh_update_debug__ == "function" &&
          window.__gh_update_debug__(
            "local=" +
            String(R) +
            `
event=` +
            String(n.viewKey) +
            `
allowed=true`
          );
      } catch { }
      n.error
        ? (z.innerHTML =
          '<div class="title">' +
          (G.name || G.id || "Table View") +
          '</div><div style="color:var(--vscode-editor-foreground)">' +
          String(n.error) +
          "</div>")
        : P(
          n.payload ||
          ((s = n.payload) == null ? void 0 : s.data) ||
          n.payload
        );
    }
  }
  function Y() {
    try {
      try {
        window.vscodeApi &&
          typeof window.vscodeApi.postMessage == "function" &&
          window.vscodeApi.postMessage({
            command: "debugLog",
            level: "debug",
            viewKey: R,
            message: "tableViewFetcher.requestFields",
            data: { first: N },
          });
      } catch { }
      try {
        console.log("tableViewFetcher.requestFields", {
          viewKey: R,
          first: N,
        });
      } catch { }
      typeof window.vscodeApi == "object" &&
        window.vscodeApi &&
        typeof window.vscodeApi.postMessage == "function" &&
        window.vscodeApi.postMessage({
          command: "requestFields",
          first: N,
          viewKey: R,
        });
    } catch { }
  }
  try {
    typeof window.__gh_update_debug__ == "function" &&
      window.__gh_update_debug__(
        "local=" +
        String(R) +
        `
requesting...`
      );
  } catch { }
  window.addEventListener("message", J), Y();
};

