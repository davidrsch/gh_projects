import { escapeHtml, normalizeColor, addAlpha, getContrastColor } from "../utils";

export function renderCell(e: any, n: any, s: any, allItems: any) {
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
                        (x: any) =>
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
                let a = normalizeColor(r) || null,
                    p = a && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a) ? a : "#666666",
                    g = escapeHtml(String(t || "")),
                    f = o ? escapeHtml(String(o)) : "";
                return (
                    '<a href="' +
                    escapeHtml(String(l || "")) +
                    '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px;width:100%;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
                    escapeHtml(p) +
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
                return "<div>" + escapeHtml((u = e.text) != null ? u : "") + "</div>";
            case "number": {
                let t =
                    e.number !== void 0 && e.number !== null ? String(e.number) : "";
                return (
                    '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
                    escapeHtml(t) +
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
                    if (isNaN(o.getTime())) return "<div>" + escapeHtml(String(t)) + "</div>";
                    let l = o.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    });
                    return "<div>" + escapeHtml(l) + "</div>";
                } catch (e) {
                    return "<div>" + escapeHtml(String(t)) + "</div>";
                }
            }
            case "single_select": {
                let t = escapeHtml(
                    (E = (C = e.option) == null ? void 0 : C.name) != null ? E : ""
                ),
                    o = null;
                if (n && Array.isArray(n.options)) {
                    let f = n.options.find(
                        (h: any) =>
                            (h.id && e.option && e.option.id && h.id === e.option.id) ||
                            (h.name &&
                                e.option &&
                                e.option.name &&
                                h.name === e.option.name)
                    );
                    f &&
                        (o = (D = (W = f.color) != null ? W : f.id) != null ? D : null);
                }
                let l = normalizeColor(o) || null,
                    r = !!(l && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(l)),
                    a = l || "#999999",
                    p = (r && addAlpha(l, 0.12)) || "rgba(0,0,0,0.06)",
                    g = l || "#333333";
                // Render a full-width flexible pill so it can shrink and ellipsize inside table cells
                return (
                    '<span style="display:block;width:100%;box-sizing:border-box">' +
                    '<div style="display:inline-flex;align-items:center;padding:2px 8px;border:1px solid ' +
                    escapeHtml(a) +
                    ";border-radius:999px;color:" +
                    escapeHtml(g) +
                    ";background:" +
                    escapeHtml(p) +
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
                        .map((o: any) => {
                            let l = escapeHtml(o.name || ""),
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
                                    (L: any) => L && L.name === o.name
                                );
                                k && (a = k.color || k.colour || a);
                            }
                            let p = normalizeColor(a) || null,
                                g = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p)),
                                f = p || "#999999",
                                h = (g && addAlpha(p, 0.12)) || "rgba(0,0,0,0.06)",
                                w = p || "#333333";
                            return (
                                '<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;border:1px solid ' +
                                escapeHtml(f) +
                                ";background:" +
                                escapeHtml(h) +
                                ";color:" +
                                escapeHtml(w) +
                                ';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                                l +
                                "</span>"
                            );
                        })
                        .join("") +
                    "</div>"
                );
            case "repository": {
                let t = escapeHtml(
                    (T = (H = e.repository) == null ? void 0 : H.nameWithOwner) !=
                        null
                        ? T
                        : ""
                );
                return (
                    '<a href="' +
                    escapeHtml(
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
                        var num = escapeHtml(String((p && p.number) || ""));
                        var titleText = escapeHtml((p && p.title) || "");
                        var url = escapeHtml((p && p.url) || "");
                        var rawColor =
                            (p && (p.state_color || p.color || p.colour || p.state)) ||
                            null;
                        var normColor = normalizeColor(rawColor) || null;
                        var hasHex = !!(
                            normColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normColor)
                        );
                        var border = normColor || "#999999";
                        var bg = (hasHex && addAlpha(normColor, 0.12)) || "rgba(0,0,0,0.06)";
                        var fg = getContrastColor(normColor) || "#333333";
                        out +=
                            '<a href="' +
                            url +
                            '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">' +
                            '<span title="' +
                            titleText +
                            '" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid ' +
                            escapeHtml(border) +
                            ";background:" +
                            escapeHtml(bg) +
                            ";color:" +
                            escapeHtml(fg) +
                            ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;max-width:160px">' +
                            '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
                            escapeHtml(normColor || "#666") +
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
                        (t: any) =>
                            '<a href="' +
                            escapeHtml(t.url || "") +
                            '" target="_blank" rel="noopener noreferrer">#' +
                            escapeHtml(String(t.number || "")) +
                            " " +
                            escapeHtml(t.title || "") +
                            "</a>"
                    )
                    .join("<br/>");
            case "assignees": {
                let t = e.assignees || [];
                if (t.length === 0) return "<div></div>";
                let l = t
                    .slice(0, 3)
                    .map((g: any, f: any) => {
                        let h = escapeHtml(g.avatarUrl || g.avatar || ""),
                            w = f === 0 ? "0px" : f === 1 ? "-8px" : "-14px",
                            x = Math.max(1, 3 - f);
                        if (h)
                            return (
                                '<span title="' +
                                escapeHtml(g.login || g.name || "") +
                                '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' +
                                h +
                                ");border:2px solid var(--vscode-editor-background);margin-left:" +
                                w +
                                ";vertical-align:middle;position:relative;z-index:" +
                                x +
                                '"></span>'
                            );
                        let k = escapeHtml(
                            (g.name || g.login || "")
                                .split(" ")
                                .map((L: any) => L[0] || "")
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                        );
                        return (
                            '<span title="' +
                            escapeHtml(g.login || g.name || "") +
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
                    r = t.map((g: any) => g.login || g.name || ""),
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
                    escapeHtml(a) +
                    "</span></div>"
                );
            }
            case "requested_reviewers":
                return (
                    "<div>" +
                    escapeHtml(
                        (e.reviewers || [])
                            .map((t: any) => t.login || t.name || t.kind || "")
                            .join(", ")
                    ) +
                    "</div>"
                );
            case "iteration": {
                let t = escapeHtml((U = e.title) != null ? U : ""),
                    l = normalizeColor("GRAY") || null,
                    r = !!(l && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(l)),
                    a = l || "#999999",
                    p = (r && addAlpha(l, 0.12)) || "rgba(0,0,0,0.06)",
                    g = l || "#333333";
                return (
                    '<div style="display:inline-block;padding:2px 8px;border:1px solid ' +
                    escapeHtml(a) +
                    ";border-radius:999px;color:" +
                    escapeHtml(g) +
                    ";background:" +
                    escapeHtml(p) +
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
                    a = escapeHtml(String(l || "")),
                    p = o ? escapeHtml(String(o)) : "",
                    g = escapeHtml(String(r || "")),
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
                                (d: any) =>
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
                } catch (e) { }
                f ||
                    (f =
                        (t &&
                            ((t.option &&
                                (t.option.color || t.option.id || t.option.name)) ||
                                t.color ||
                                t.colour)) ||
                        null);
                let h = normalizeColor(f) || null,
                    w = !!(h && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)),
                    x = h || "#999999",
                    k = (w && addAlpha(h, 0.12)) || "rgba(0,0,0,0.06)",
                    L = getContrastColor(h) || "#333333",
                    q =
                        '<span style="display:block;width:100%;box-sizing:border-box">' +
                        '<div style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid ' +
                        escapeHtml(x) +
                        ";border-radius:999px;color:" +
                        escapeHtml(L) +
                        ";background:" +
                        escapeHtml(k) +
                        ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;width:100%">' +
                        '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:' +
                        escapeHtml(h || "#666") +
                        '"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>' +
                        '<span class="parent-issue-title" style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">' +
                        a +
                        "</span>" +
                        (p
                            ? '<span style="margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#' +
                            p +
                            "</span>"
                            : "") +
                        "</div></span>";
                // Provide a class for parent-issue wrappers so CSS can style/truncate reliably
                const parentWrapper = '<span data-gh-open="' + (g || '') + '" class="parent-issue-wrapper" style="display:block;width:100%;cursor:' + (g ? 'pointer' : 'default') + '">' ;
                return g
                    ? parentWrapper + q + "</span>"
                    : q;
            }
            case "milestone":
                return (
                    "<div>" +
                    escapeHtml(
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
                    // Render a single pill-style progress bar (matching group header style)
                    const barHtml =
                        '<div class="sub-issues-progress" style="display:flex;align-items:center;gap:8px;width:100%;">' +
                        // flexible bar container
                        '<div class="sub-issues-progress-bar" style="flex:1;min-width:0">' +
                        // outer bar: border + rounded corners, inner fill width is pct%
                        '<div style="width:100%;height:12px;border-radius:6px;border:1px solid var(--vscode-focusBorder);overflow:hidden;background:transparent;box-sizing:border-box">' +
                        '<div style="height:100%;width:' + String(pct) + '%;background:var(--vscode-focusBorder)"></div>' +
                        '</div>' +
                        '</div>' +
                        // percentage text
                        '<div class="sub-issues-progress-pct" style="min-width:44px;text-align:right;font-variant-numeric:tabular-nums;color:var(--vscode-descriptionForeground)">' +
                        escapeHtml(String(pct) + "%") +
                        '</div>' +
                        '</div>';

                    return barHtml;
                } catch (e) {
                    return "";
                }
            case "missing":
                return "";
            default:
                return (
                    "<div>" +
                    escapeHtml(
                        e && e.raw && e.raw.__typename
                            ? String(e.raw.__typename)
                            : JSON.stringify(e).slice(0, 200)
                    ) +
                    "</div>"
                );
        }
    } catch (e) {
        return "";
    }
}
