(function () {
  window.tableViewFetcher = function (G, z, R) {
    z.innerHTML =
      '<div class="title">' +
      (G.name || G.id || "Table View") +
      '</div><div class="loading"><em>Loading table\u2026</em></div>';
    let N = 30;
    function m(e) {
      return e
        ? String(e)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
        : "";
    }
    function y(e) {
      return m(e);
    }
    function F(e) {
      if (!e) return null;
      let n = String(e).trim();
      if (
        /^#?[0-9a-f]{3}$/i.test(n) ||
        /^#?[0-9a-f]{6}$/i.test(n) ||
        /^#?[0-9a-f]{8}$/i.test(n)
      ) {
        let b = n[0] === "#" ? n.slice(1) : n;
        return "#" + (b.length === 8 ? b.substring(0, 6) : b);
      }
      let s = {
          GRAY: "#848d97",
          RED: "#f85149",
          ORANGE: "#db6d28",
          YELLOW: "#d29922",
          GREEN: "#3fb950",
          BLUE: "#2f81f7",
          PURPLE: "#a371f7",
          PINK: "#db61a2",
          BLACK: "#000000",
          WHITE: "#ffffff",
        },
        u = n.toUpperCase();
      return s[u] || null;
    }
    function I(e, n) {
      if (!e) return null;
      let s = e.replace("#", ""),
        u = (b) => parseInt(b, 16);
      if (s.length === 3) {
        let b = u(s[0] + s[0], 16),
          S = u(s[1] + s[1], 16),
          v = u(s[2] + s[2], 16);
        return "rgba(" + b + "," + S + "," + v + "," + n + ")";
      }
      if (s.length === 6 || s.length === 8) {
        let b = s.length === 8 ? s.substring(0, 6) : s,
          S = u(s.substring(0, 2), 16),
          v = u(b.substring(2, 4), 16),
          C = u(b.substring(4, 6), 16);
        return "rgba(" + S + "," + v + "," + C + "," + n + ")";
      }
      return null;
    }
    function Q(e) {
      if (!e) return "#333333";
      let n = e.replace("#", ""),
        s = (C) => parseInt(C, 16),
        u,
        b,
        S;
      if (n.length === 3)
        (u = s(n[0] + n[0], 16)),
          (b = s(n[1] + n[1], 16)),
          (S = s(n[2] + n[2], 16));
      else if (n.length === 6 || n.length === 8) {
        let C = n.length === 8 ? n.substring(0, 6) : n;
        (u = s(C.substring(0, 2), 16)),
          (b = s(C.substring(2, 4), 16)),
          (S = s(C.substring(4, 6), 16));
      } else return "#333333";
      return 0.2126 * (u / 255) + 0.7152 * (b / 255) + 0.0722 * (S / 255) > 0.6
        ? "#111111"
        : "#ffffff";
    }
    function K(e, n, s, allItems) {
      var u, b, S, v, C, E, W, D, H, T, _, j, U, c, i;
      if (!e) return "";
      try {
        switch (e.type) {
          case "title": {
            let t =
                (e &&
                  e.title &&
                  ((e.title.raw && e.title.raw.text) ||
                    (e.title.content &&
                      (e.title.content.title || e.title.content.name)) ||
                    (typeof e.title == "string" && e.title))) ||
                (e && e.content && (e.content.title || e.content.name)) ||
                (e && e.raw && e.raw.text) ||
                "",
              o =
                (e && e.title && e.title.content && e.title.content.number) ||
                (e && e.raw && e.raw.itemContent && e.raw.itemContent.number) ||
                (s && s.content && s.content.number) ||
                "",
              l =
                (e && e.title && e.title.content && e.title.content.url) ||
                (e && e.raw && e.raw.itemContent && e.raw.itemContent.url) ||
                (s && s.content && s.content.url) ||
                "",
              r = null;
            if (s && Array.isArray(s.fieldValues)) {
              let w = s.fieldValues.find(
                (x) =>
                  x &&
                  x.type === "single_select" &&
                  ((x.raw &&
                    x.raw.field &&
                    String(x.raw.field.name || "").toLowerCase() ===
                      "status") ||
                    (x.fieldName &&
                      String(x.fieldName || "").toLowerCase() === "status") ||
                    (x.field &&
                      x.field.name &&
                      String(x.field.name || "").toLowerCase() === "status"))
              );
              w &&
                (r =
                  (w.option &&
                    (w.option.color || w.option.id || w.option.name)) ||
                  (w.raw && w.raw.color) ||
                  null);
            }
            let a = F(r) || null,
              p = a && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a) ? a : "#666666",
              g = m(String(t || "")),
              f = o ? m(String(o)) : "";
            return (
              '<a href="' +
              y(String(l || "")) +
              '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px;width:100%;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
              y(p) +
              '"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg><span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">' +
              g +
              "</span>" +
              (f
                ? '<span style="flex:none;margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#' +
                  f +
                  "</span>"
                : "") +
              "</a>"
            );
          }
          case "text":
            return "<div>" + m((u = e.text) != null ? u : "") + "</div>";
          case "number": {
            let t =
              e.number !== void 0 && e.number !== null ? String(e.number) : "";
            return (
              '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
              m(t) +
              "</div>"
            );
          }
          case "date": {
            let t =
              (v =
                (S = (b = e.date) != null ? b : e.startDate) != null
                  ? S
                  : e.dueOn) != null
                ? v
                : null;
            if (!t) return "<div></div>";
            try {
              let o = new Date(t);
              if (isNaN(o.getTime())) return "<div>" + m(String(t)) + "</div>";
              let l = o.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              return "<div>" + m(l) + "</div>";
            } catch {
              return "<div>" + m(String(t)) + "</div>";
            }
          }
          case "single_select": {
            let t = m(
                (E = (C = e.option) == null ? void 0 : C.name) != null ? E : ""
              ),
              o = null;
            if (n && Array.isArray(n.options)) {
              let f = n.options.find(
                (h) =>
                  (h.id && e.option && e.option.id && h.id === e.option.id) ||
                  (h.name &&
                    e.option &&
                    e.option.name &&
                    h.name === e.option.name)
              );
              f &&
                (o = (D = (W = f.color) != null ? W : f.id) != null ? D : null);
            }
            let l = F(o) || null,
              r = !!(l && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(l)),
              a = l || "#999999",
              p = (r && I(l, 0.12)) || "rgba(0,0,0,0.06)",
              g = l || "#333333";
            // Render a full-width flexible pill so it can shrink and ellipsize inside table cells
            return (
              '<span style="display:block;width:100%;box-sizing:border-box">' +
              '<div style="display:inline-flex;align-items:center;padding:2px 8px;border:1px solid ' +
              y(a) +
              ";border-radius:999px;color:" +
              y(g) +
              ";background:" +
              y(p) +
              ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;width:100%">' +
              '<span style="flex:1 1 auto;min-width:0;max-width:100%;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              t +
              "</span>" +
              "</div>" +
              "</span>"
            );
          }
          case "labels":
            return (
              "<div>" +
              (e.labels || [])
                .map((o) => {
                  let l = m(o.name || ""),
                    r =
                      (s &&
                        ((s.content &&
                          s.content.repository &&
                          s.content.repository.nameWithOwner) ||
                          (s.repository && s.repository.nameWithOwner))) ||
                      (e.raw &&
                        e.raw.itemContent &&
                        e.raw.itemContent.repository &&
                        e.raw.itemContent.repository.nameWithOwner) ||
                      null,
                    a = o.color || o.colour || null;
                  if (n && n.repoOptions && r && n.repoOptions[r]) {
                    let k = n.repoOptions[r].find(
                      (L) => L && L.name === o.name
                    );
                    k && (a = k.color || k.colour || a);
                  }
                  let p = F(a) || null,
                    g = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p)),
                    f = p || "#999999",
                    h = (g && I(p, 0.12)) || "rgba(0,0,0,0.06)",
                    w = p || "#333333";
                  return (
                    '<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;border:1px solid ' +
                    y(f) +
                    ";background:" +
                    y(h) +
                    ";color:" +
                    y(w) +
                    ';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                    l +
                    "</span>"
                  );
                })
                .join("") +
              "</div>"
            );
          case "repository": {
            let t = m(
              (T = (H = e.repository) == null ? void 0 : H.nameWithOwner) !=
                null
                ? T
                : ""
            );
            return (
              '<a href="' +
              y(
                ((_ = e.repository) == null ? void 0 : _.url) ||
                  ((j = e.repository) == null ? void 0 : j.html_url) ||
                  ""
              ) +
              '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/></svg><span>' +
              t +
              "</span></a>"
            );
          }
          case "pull_request": {
            const prs = e.pullRequests || [];
            return (function () {
              var prs = e.pullRequests || [];
              if (!prs || prs.length === 0) return "";
              var out =
                '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">';
              for (var i = 0; i < prs.length; i++) {
                var p = prs[i];
                var num = m(String((p && p.number) || ""));
                var titleText = m((p && p.title) || "");
                var url = y((p && p.url) || "");
                var rawColor =
                  (p && (p.state_color || p.color || p.colour || p.state)) ||
                  null;
                var normColor = F(rawColor) || null;
                var hasHex = !!(
                  normColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normColor)
                );
                var border = normColor || "#999999";
                var bg = (hasHex && I(normColor, 0.12)) || "rgba(0,0,0,0.06)";
                var fg = Q(normColor) || "#333333";
                out +=
                  '<a href="' +
                  url +
                  '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">' +
                  '<span title="' +
                  titleText +
                  '" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid ' +
                  y(border) +
                  ";background:" +
                  y(bg) +
                  ";color:" +
                  y(fg) +
                  ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;max-width:160px">' +
                  '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
                  y(normColor || "#666") +
                  '"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>' +
                  '<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#' +
                  num +
                  "</span></span></a>";
              }
              out += "</div>";
              return out;
            })();
          }
          case "issue":
            return (e.issues || [])
              .map(
                (t) =>
                  '<a href="' +
                  y(t.url || "") +
                  '" target="_blank" rel="noopener noreferrer">#' +
                  m(String(t.number || "")) +
                  " " +
                  m(t.title || "") +
                  "</a>"
              )
              .join("<br/>");
          case "assignees": {
            let t = e.assignees || [];
            if (t.length === 0) return "<div></div>";
            let l = t
                .slice(0, 3)
                .map((g, f) => {
                  let h = y(g.avatarUrl || g.avatar || ""),
                    w = f === 0 ? "0px" : f === 1 ? "-8px" : "-14px",
                    x = Math.max(1, 3 - f);
                  if (h)
                    return (
                      '<span title="' +
                      y(g.login || g.name || "") +
                      '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' +
                      h +
                      ");border:2px solid var(--vscode-editor-background);margin-left:" +
                      w +
                      ";vertical-align:middle;position:relative;z-index:" +
                      x +
                      '"></span>'
                    );
                  let k = m(
                    (g.name || g.login || "")
                      .split(" ")
                      .map((L) => L[0] || "")
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  );
                  return (
                    '<span title="' +
                    y(g.login || g.name || "") +
                    '" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#777;color:#fff;font-size:11px;border:2px solid var(--vscode-editor-background);margin-left:' +
                    w +
                    ";vertical-align:middle;position:relative;z-index:" +
                    x +
                    '">' +
                    k +
                    "</span>"
                  );
                })
                .join(""),
              r = t.map((g) => g.login || g.name || ""),
              a = "";
            return (
              r.length === 1
                ? (a = r[0])
                : r.length === 2
                ? (a = r[0] + " and " + r[1])
                : (a = r.slice(0, -1).join(", ") + " and " + r.slice(-1)[0]),
              '<div style="display:flex;align-items:center;gap:8px"><span style="display:flex;align-items:center">' +
                ('<span style="display:inline-block;vertical-align:middle;height:20px;line-height:20px;margin-right:8px;">' +
                  l +
                  "</span>") +
                '</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                m(a) +
                "</span></div>"
            );
          }
          case "requested_reviewers":
            return (
              "<div>" +
              m(
                (e.reviewers || [])
                  .map((t) => t.login || t.name || t.kind || "")
                  .join(", ")
              ) +
              "</div>"
            );
          case "iteration": {
            let t = m((U = e.title) != null ? U : ""),
              l = F("GRAY") || null,
              r = !!(l && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(l)),
              a = l || "#999999",
              p = (r && I(l, 0.12)) || "rgba(0,0,0,0.06)",
              g = l || "#333333";
            return (
              '<div style="display:inline-block;padding:2px 8px;border:1px solid ' +
              y(a) +
              ";border-radius:999px;color:" +
              y(g) +
              ";background:" +
              y(p) +
              ';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              t +
              "</div>"
            );
          }
          case "parent_issue": {
            let t =
                (e &&
                  (e.parent ||
                    e.parentIssue ||
                    e.issue ||
                    e.option ||
                    e.item ||
                    e.value)) ||
                (e &&
                  e.raw &&
                  (e.raw.parent || e.raw.itemContent || e.raw.item)) ||
                null,
              o =
                (t &&
                  (t.number || t.id || (t.raw && t.raw.number)) &&
                  (t.number || (t.raw && t.raw.number))) ||
                "",
              l =
                (t &&
                  (t.title || t.name || (t.raw && t.raw.title)) &&
                  (t.title || t.name || (t.raw && t.raw.title))) ||
                "",
              r =
                (t &&
                  (t.url || t.html_url || (t.raw && t.raw.url)) &&
                  (t.url || t.html_url || (t.raw && t.raw.url))) ||
                "",
              a = m(String(l || "")),
              p = o ? m(String(o)) : "",
              g = y(String(r || "")),
              f = null;
            try {
              var itemsList = Array.isArray(allItems)
                ? allItems
                : allItems || [];
              if (
                Array.isArray(itemsList) &&
                itemsList.length > 0 &&
                (o || t)
              ) {
                let B =
                    (t &&
                      t.repository &&
                      (t.repository.nameWithOwner || t.repository.name)) ||
                    (t &&
                      t.content &&
                      t.content.repository &&
                      t.content.repository.nameWithOwner) ||
                    null,
                  O = [];
                o && O.push(String(o)),
                  t &&
                    (t.id || (t.raw && t.raw.id)) &&
                    O.push(String(t.id || (t.raw && t.raw.id))),
                  t &&
                    (t.url || (t.raw && t.raw.url)) &&
                    O.push(String(t.url || (t.raw && t.raw.url))),
                  t && (t.title || t.name) && O.push(String(t.title || t.name));
                let $ = itemsList.find((A) => {
                  let d =
                    (A && (A.content || (A.raw && A.raw.itemContent))) || null;
                  if (!d) return !1;
                  let M = [];
                  if (
                    (d.number && M.push(String(d.number)),
                    d.id && M.push(String(d.id)),
                    d.url && M.push(String(d.url)),
                    d.title && M.push(String(d.title)),
                    d.name && M.push(String(d.name)),
                    d.raw && d.raw.number && M.push(String(d.raw.number)),
                    d.raw && d.raw.id && M.push(String(d.raw.id)),
                    d.raw && d.raw.url && M.push(String(d.raw.url)),
                    B)
                  ) {
                    let V =
                      (d.repository &&
                        (d.repository.nameWithOwner || d.repository.name)) ||
                      null;
                    if (V && String(V) !== String(B)) return !1;
                  }
                  for (let V = 0; V < O.length; V++)
                    for (let X = 0; X < M.length; X++)
                      if (O[V] && M[X] && String(O[V]) === String(M[X]))
                        return !0;
                  return !1;
                });
                if ($ && Array.isArray($.fieldValues)) {
                  let A = $.fieldValues.find(
                    (d) =>
                      d &&
                      d.type === "single_select" &&
                      ((d.raw &&
                        d.raw.field &&
                        String(d.raw.field.name || "").toLowerCase() ===
                          "status") ||
                        (d.fieldName &&
                          String(d.fieldName || "").toLowerCase() ===
                            "status") ||
                        (d.field &&
                          d.field.name &&
                          String(d.field.name || "").toLowerCase() ===
                            "status"))
                  );
                  A &&
                    (f =
                      (A.option &&
                        (A.option.color || A.option.id || A.option.name)) ||
                      (A.raw && A.raw.color) ||
                      null);
                }
              }
            } catch {}
            f ||
              (f =
                (t &&
                  ((t.option &&
                    (t.option.color || t.option.id || t.option.name)) ||
                    t.color ||
                    t.colour)) ||
                null);
            let h = F(f) || null,
              w = !!(h && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)),
              x = h || "#999999",
              k = (w && I(h, 0.12)) || "rgba(0,0,0,0.06)",
              L = Q(h) || "#333333",
              q =
                '<span style="display:block;width:100%;box-sizing:border-box">' +
                '<div style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid ' +
                y(x) +
                ";border-radius:999px;color:" +
                y(L) +
                ";background:" +
                y(k) +
                ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;width:100%">' +
                '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
                y(h || "#666") +
                '"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>' +
                '<span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">' +
                a +
                "</span>" +
                (p
                  ? '<span style="margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#' +
                    p +
                    "</span>"
                  : "") +
                "</div></span>";
            return g
              ? '<span data-gh-open="' +
                  g +
                  '" style="display:block;width:100%;cursor:pointer">' +
                  q +
                  "</span>"
              : q;
          }
          case "milestone":
            return (
              "<div>" +
              m(
                (i = (c = e.milestone) == null ? void 0 : c.title) != null
                  ? i
                  : ""
              ) +
              "</div>"
            );
          case "sub_issues_progress":
            try {
              // Only render when there is a meaningful total (> 0)
              if (!e || e.total == null || Number(e.total) <= 0) return "";
              const totalCount = Math.max(0, Math.floor(Number(e.total) || 0));
              const doneCount = Math.max(0, Math.floor(Number(e.done || 0)));
              if (totalCount === 0) return "";
              // percentage for text
              let pct = null;
              if (e.percent !== void 0 && e.percent !== null)
                pct = Number(e.percent);
              else pct = Math.round((doneCount / totalCount) * 100);
              if (pct == null || !isFinite(pct)) return "";
              pct = Math.max(0, Math.min(100, pct));
              // Build segmented bar: one segment per total; filled segments show full color,
              // remaining segments show only border using the active theme color.
              let segs = [];
              for (let si = 0; si < totalCount; si++) {
                if (si < doneCount) {
                  segs.push(
                    '<div style="flex:1;height:12px;border-radius:4px;background:var(--vscode-focusBorder)"></div>'
                  );
                } else {
                  segs.push(
                    '<div style="flex:1;height:12px;border-radius:4px;border:1px solid var(--vscode-focusBorder);background:transparent"></div>'
                  );
                }
              }
              return (
                '<div style="display:flex;align-items:center;gap:8px">' +
                '<div style="flex:1;min-width:0;display:flex;gap:4px;align-items:center">' +
                segs.join("") +
                "</div>" +
                '<div style="min-width:44px;text-align:right;font-variant-numeric:tabular-nums;color:var(--vscode-descriptionForeground)">' +
                m(String(pct) + "%") +
                "</div>" +
                "</div>"
              );
            } catch {
              return "";
            }
          case "missing":
            return "";
          default:
            return (
              "<div>" +
              m(
                e && e.raw && e.raw.__typename
                  ? String(e.raw.__typename)
                  : JSON.stringify(e).slice(0, 200)
              ) +
              "</div>"
            );
        }
      } catch {
        return "";
      }
    }
    function P(e) {
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
                            } catch (e) {}
                          }
                        }
                      }
                    } catch (e) {}
                    // Do not inject hard-coded default qualifiers here; keep candidates derived from fields only.
                    try {
                      barApi.setCandidates(cand);
                    } catch (e) {}
                  }
                } catch (e) {}
              } catch (e) {}
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
              } catch (e) {}
            }
            if (typeof barApi.onFilterChange === "function") {
              barApi.onFilterChange(function (matchedIds, rawFilter) {
                try {
                  const rows = Array.from(
                    document.querySelectorAll("tr[data-gh-item-id]")
                  );
                  for (let r = 0; r < rows.length; r++) {
                    try {
                      const el = rows[r];
                      const id = el.getAttribute("data-gh-item-id");
                      el.style.display = matchedIds.has(String(id))
                        ? "table-row"
                        : "none";
                    } catch (e) {}
                  }
                } catch (e) {}
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
                          if (rEl.style.display !== "none") visibleCount++;
                        } catch (e) {}
                      }
                      try {
                        const badge = ghEl.querySelector("[data-group-count]");
                        if (badge) badge.textContent = String(visibleCount);
                      } catch (e) {}
                      try {
                        ghEl.style.display =
                          visibleCount > 0 ? "table-row" : "none";
                      } catch (e) {}
                    } catch (e) {}
                  }
                } catch (e) {}
                try {
                  if (barApi && typeof barApi.setCount === "function")
                    barApi.setCount(matchedIds.size);
                } catch (e) {}
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
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
          } catch (e) {}
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
          } catch (e) {}
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
              (a.innerHTML = l[r] ? K(l[r], n[r], i, s) : ""),
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
                function x(L) {
                  let q = L.clientX - h,
                    B = Math.max(20, w + q);
                  f[g].style.width = B + "px";
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
        const groups = [];
        // Build lookup for items that don't match an option (put them last under '[None]')
        const orphanItems = [];

        // Create an index of items per option id/name
        const map = {};
        for (let oi = 0; oi < fieldOptions.length; oi++) {
          const opt = fieldOptions[oi];
          const key = String(opt.id ?? opt.name ?? oi);
          map[key] = [];
        }

        // Helper to extract the option id/name from a normalized value
        function valueMatchesOption(v, opt) {
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
          } catch (e) {}
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
        } catch (e) {}

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
          const normColor = F(opt.color || opt.colour || null) || "#999999";
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
              "1px solid " + (Q(normColor) || "rgba(0,0,0,0.2)");
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
              } catch (e) {}
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
          try {
            circle.setAttribute("fill", normColor);
          } catch (e) {}

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
          } catch (e) {}
          try {
            countBadge.setAttribute("data-group-count", "");
          } catch (e) {}

          gh.appendChild(headerTd);
          j.appendChild(gh);

          // Render each item row for this group — attach a class so we can toggle visibility
          const groupRowClass = "group-rows-" + gi;
          for (let ii = 0; ii < itemsForOpt.length; ii++) {
            const { item, index } = itemsForOpt[ii];
            let tr = document.createElement("tr");
            try {
              tr.setAttribute("data-gh-item-id", String(item && item.id));
            } catch (e) {}
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
              td.innerHTML = fv[col] ? K(fv[col], n[col], item, s) : "";
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
                function x(L) {
                  let q = L.clientX - h,
                    B = Math.max(20, w + q);
                  f[g].style.width = B + "px";
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
                const el = rows[x];
                try {
                  el.style.display = expanded ? "table-row" : "none";
                } catch (e) {}
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
              i[o].style.width = g + "px";
            }
          } catch {}
        })();
      try {
        let c = E.getBoundingClientRect().width;
        c && isFinite(c) && (E.style.width = c + "px");
      } catch {}
      (function () {
        let i = W.children,
          t = T.children;
        for (let o = 0; o < t.length && o < i.length; o++) {
          let l = t[o];
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
              function f(w) {
                let x = w.clientX - p,
                  k = Math.max(20, g + x);
                i[a].style.width = k + "px";
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
      } catch (e) {}
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
            let i = c.target;
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
                    typeof vscodeApi == "object" &&
                    vscodeApi &&
                    typeof vscodeApi.postMessage == "function"
                  ) {
                    vscodeApi.postMessage({ command: "openUrl", url: o }),
                      c.preventDefault();
                    return;
                  }
                } catch {}
                try {
                  window.open(o, "_blank"), c.preventDefault();
                } catch {}
              }
            }
          } catch {}
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
                    typeof vscodeApi == "object" &&
                    vscodeApi &&
                    typeof vscodeApi.postMessage == "function"
                  ) {
                    vscodeApi.postMessage({ command: "openUrl", url: t }),
                      c.preventDefault();
                    return;
                  }
                } catch {}
                try {
                  window.open(t, "_blank"), c.preventDefault();
                } catch {}
              }
            }
          } catch {}
        });
    }
    function J(e) {
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
      } catch {}
      try {
        console.log("tableViewFetcher.onMessage", {
          command: n && n.command,
          viewKey: n && n.viewKey,
        });
      } catch {}
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
          } catch {}
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
        } catch {}
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
        } catch {}
        try {
          console.log("tableViewFetcher.requestFields", {
            viewKey: R,
            first: N,
          });
        } catch {}
        typeof vscodeApi == "object" &&
          vscodeApi &&
          typeof vscodeApi.postMessage == "function" &&
          vscodeApi.postMessage({
            command: "requestFields",
            first: N,
            viewKey: R,
          });
      } catch {}
    }
    try {
      typeof window.__gh_update_debug__ == "function" &&
        window.__gh_update_debug__(
          "local=" +
            String(R) +
            `
requesting...`
        );
    } catch {}
    window.addEventListener("message", J), Y();
  };
})();
