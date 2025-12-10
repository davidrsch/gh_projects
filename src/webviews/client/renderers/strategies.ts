import { escapeHtml, normalizeColor, getContrastColor, addAlpha } from "../../client/utils";

export interface CellRendererStrategy {
    render(value: any, field: any, item: any, allItems: any): string;
}

export class TitleRenderer implements CellRendererStrategy {
    render(value: any, field: any, item: any, allItems: any): string {
        let t =
            (value &&
                value.title &&
                ((value.title.raw && value.title.raw.text) ||
                    (value.title.content &&
                        (value.title.content.title || value.title.content.name)) ||
                    (typeof value.title == "string" && value.title))) ||
            (value && value.content && (value.content.title || value.content.name)) ||
            (value && value.raw && value.raw.text) ||
            "";
        let o =
            (value && value.title && value.title.content && value.title.content.number) ||
            (value && value.raw && value.raw.itemContent && value.raw.itemContent.number) ||
            (item && item.content && item.content.number) ||
            "";
        let l =
            (value && value.title && value.title.content && value.title.content.url) ||
            (value && value.raw && value.raw.itemContent && value.raw.itemContent.url) ||
            (item && item.content && item.content.url) ||
            "";
        let r = null;
        if (item && Array.isArray(item.fieldValues)) {
            let w = item.fieldValues.find(
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
}

export class TextRenderer implements CellRendererStrategy {
    render(value: any): string {
        return "<div>" + escapeHtml((value && value.text) != null ? value.text : "") + "</div>";
    }
}

export class NumberRenderer implements CellRendererStrategy {
    render(value: any): string {
        let t = value.number !== void 0 && value.number !== null ? String(value.number) : "";
        return (
            '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
            escapeHtml(t) +
            "</div>"
        );
    }
}

export class DateRenderer implements CellRendererStrategy {
    render(value: any): string {
        let t = value.date || value.startDate || value.dueOn || null;
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
}

export class SingleSelectRenderer implements CellRendererStrategy {
    render(value: any): string {
        let n = (value && value.option && value.option.name) || (value && value.name) || "";
        if (!n) return "<div></div>";
        let c = (value && value.option && (value.option.color || value.option.id)) || (value && value.color) || null;
        let bg = normalizeColor(c) || "var(--vscode-badge-background)";
        let fg = getContrastColor(bg);
        return (
            '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;line-height:18px;background-color:' +
            escapeHtml(bg) +
            ";color:" +
            escapeHtml(fg) +
            '">' +
            escapeHtml(n) +
            "</span>"
        );
    }
}

export class IterationRenderer implements CellRendererStrategy {
    render(value: any): string {
        let i = value.iteration || value;
        if (!i || !i.title) return "<div></div>";
        return (
            '<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid var(--vscode-charts-blue);box-sizing:border-box"></span><span>' +
            escapeHtml(i.title) +
            "</span></div>"
        );
    }
}

export class RepositoryRenderer implements CellRendererStrategy {
    render(value: any): string {
        let r = value.repository || value;
        if (!r || !r.name) return "<div></div>";
        return (
            '<div style="display:flex;align-items:center;gap:6px"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo" style="color:var(--vscode-textLink-foreground)"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"></path></svg><span>' +
            escapeHtml(r.name) +
            "</span></div>"
        );
    }
}

// Helper for contrast color (duplicated from utils to avoid circular deps if utils imports this, but utils is safe)
// Removed local getContrastColor since we import it.

export class LabelsRenderer implements CellRendererStrategy {
    render(value: any, field: any, item: any, allItems: any): string {
        return (
            '<div>' +
            (value.labels || [])
                .map((o: any) => {
                    let l = escapeHtml(o.name || ''),
                        r =
                            (item &&
                                ((item.content &&
                                    item.content.repository &&
                                    item.content.repository.nameWithOwner) ||
                                    (item.repository && item.repository.nameWithOwner))) ||
                            (value.raw &&
                                value.raw.itemContent &&
                                value.raw.itemContent.repository &&
                                value.raw.itemContent.repository.nameWithOwner) ||
                            null,
                        a = o.color || o.colour || null;
                    if (field && field.repoOptions && r && field.repoOptions[r]) {
                        let k = field.repoOptions[r].find(
                            (L: any) => L && L.name === o.name
                        );
                        k && (a = k.color || k.colour || a);
                    }
                    let p = normalizeColor(a) || null,
                        g = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p)),
                        f = p || '#999999',
                        h = (g && addAlpha(p, 0.12)) || 'rgba(0,0,0,0.06)',
                        w = p || '#333333';
                    return (
                        '<span style=\'display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;border:1px solid ' +
                        escapeHtml(f) +
                        ';background:' +
                        escapeHtml(h) +
                        ';color:' +
                        escapeHtml(w) +
                        ';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\'>' +
                        l +
                        '</span>'
                    );
                })
                .join('') +
            '</div>'
        );
    }
}

export class PullRequestRenderer implements CellRendererStrategy {
    render(value: any): string {
        const prs = value.pullRequests || [];
        if (!prs || prs.length === 0) return '';
        let out =
            '<div style=\'display:flex;flex-wrap:wrap;gap:6px;align-items:center\'>';
        for (let i = 0; i < prs.length; i++) {
            let p = prs[i];
            let num = escapeHtml(String((p && p.number) || ''));
            let titleText = escapeHtml((p && p.title) || '');
            let url = escapeHtml((p && p.url) || '');
            let rawColor =
                (p && (p.state_color || p.color || p.colour || p.state)) ||
                null;
            let normColor = normalizeColor(rawColor) || null;
            let hasHex = !!(
                normColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normColor)
            );
            let border = normColor || '#999999';
            let bg = (hasHex && addAlpha(normColor, 0.12)) || 'rgba(0,0,0,0.06)';
            let fg = getContrastColor(normColor) || '#333333';
            out +=
                '<a href=\'' +
                url +
                '\' target=\'_blank\' rel=\'noopener noreferrer\' style=\'text-decoration:none;color:inherit\'>' +
                '<span title=\'' +
                titleText +
                '\' style=\'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid ' +
                escapeHtml(border) +
                ';background:' +
                escapeHtml(bg) +
                ';color:' +
                escapeHtml(fg) +
                ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;max-width:160px\'>' +
                '<svg width=\'12\' height=\'12\' viewBox=\'0 0 16 16\' xmlns=\'http://www.w3.org/2000/svg\' style=\'flex-shrink:0;color:' +
                escapeHtml(normColor || '#666') +
                '\'><circle cx=\'8\' cy=\'8\' r=\'6\' fill=\'currentColor\' /></svg>' +
                '<span style=\'flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\'>#' +
                num +
                '</span></span></a>';
        }
        out += '</div>';
        return out;
    }
}

export class IssueRenderer implements CellRendererStrategy {
    render(value: any): string {
        return (value.issues || [])
            .map(
                (t: any) =>
                    '<a href=\'' +
                    escapeHtml(t.url || '') +
                    '\' target=\'_blank\' rel=\'noopener noreferrer\'>#' +
                    escapeHtml(String(t.number || '')) +
                    ' ' +
                    escapeHtml(t.title || '') +
                    '</a>'
            )
            .join('<br/>');
    }
}

export class AssigneesRenderer implements CellRendererStrategy {
    render(value: any): string {
        let t = value.assignees || [];
        if (t.length === 0) return '<div></div>';
        let l = t
            .slice(0, 3)
            .map((g: any, f: any) => {
                let h = escapeHtml(g.avatarUrl || g.avatar || ''),
                    w = f === 0 ? '0px' : f === 1 ? '-8px' : '-14px',
                    x = Math.max(1, 3 - f);
                if (h)
                    return (
                        '<span title=\'' +
                        escapeHtml(g.login || g.name || '') +
                        '\' style=\'display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' +
                        h +
                        ');border:2px solid var(--vscode-editor-background);margin-left:' +
                        w +
                        ';vertical-align:middle;position:relative;z-index:' +
                        x +
                        '\'></span>'
                    );
                let k = escapeHtml(
                    (g.name || g.login || '')
                        .split(' ')
                        .map((L: any) => L[0] || '')
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                );
                return (
                    '<span title=\'' +
                    escapeHtml(g.login || g.name || '') +
                    '\' style=\'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#777;color:#fff;font-size:11px;border:2px solid var(--vscode-editor-background);margin-left:' +
                    w +
                    ';vertical-align:middle;position:relative;z-index:' +
                    x +
                    '\'>' +
                    k +
                    '</span>'
                );
            })
            .join(''),
            r = t.map((g: any) => g.login || g.name || ''),
            a = '';
        if (r.length === 1) a = r[0];
        else if (r.length === 2) a = r[0] + ' and ' + r[1];
        else a = r.slice(0, -1).join(', ') + ' and ' + r.slice(-1)[0];
        
        return (
            '<div style=\'display:flex;align-items:center;gap:8px\'><span style=\'display:flex;align-items:center\'>' +
            ('<span style=\'display:inline-block;vertical-align:middle;height:20px;line-height:20px;margin-right:8px;\'>' +
                l +
                '</span>') +
            '</span><span style=\'white-space:nowrap;overflow:hidden;text-overflow:ellipsis\'>' +
            escapeHtml(a) +
            '</span></div>'
        );
    }
}

export class RequestedReviewersRenderer implements CellRendererStrategy {
    render(value: any): string {
        return (
            '<div>' +
            escapeHtml(
                (value.reviewers || [])
                    .map((t: any) => t.login || t.name || t.kind || '')
                    .join(', ')
            ) +
            '</div>'
        );
    }
}

export class MilestoneRenderer implements CellRendererStrategy {
    render(value: any): string {
        return (
            '<div>' +
            escapeHtml(
                (value.milestone && value.milestone.title) || ''
            ) +
            '</div>'
        );
    }
}

export class SubIssuesProgressRenderer implements CellRendererStrategy {
    render(value: any): string {
        try {
            if (!value || value.total == null || Number(value.total) <= 0) return '';
            const totalCount = Math.max(0, Math.floor(Number(value.total) || 0));
            const doneCount = Math.max(0, Math.floor(Number(value.done || 0)));
            if (totalCount === 0) return '';
            let pct = null;
            if (value.percent !== void 0 && value.percent !== null)
                pct = Number(value.percent);
            else pct = Math.round((doneCount / totalCount) * 100);
            if (pct == null || !isFinite(pct)) return '';
            pct = Math.max(0, Math.min(100, pct));
            const barHtml =
                '<div class=\'sub-issues-progress\' style=\'display:flex;align-items:center;gap:8px;width:100%;\'>' +
                '<div class=\'sub-issues-progress-bar\' style=\'flex:1;min-width:0\'>' +
                '<div style=\'width:100%;height:12px;border-radius:6px;border:1px solid var(--vscode-focusBorder);overflow:hidden;background:transparent;box-sizing:border-box\'>' +
                '<div style=\'height:100%;width:' + String(pct) + '%;background:var(--vscode-focusBorder)\'></div>' +
                '</div>' +
                '</div>' +
                '<div class=\'sub-issues-progress-pct\' style=\'min-width:44px;text-align:right;font-variant-numeric:tabular-nums;color:var(--vscode-descriptionForeground)\'>' +
                escapeHtml(String(pct) + '%') +
                '</div>' +
                '</div>';
            return barHtml;
        } catch (e) {
            return '';
        }
    }
}

export class ParentIssueRenderer implements CellRendererStrategy {
    render(value: any, field: any, item: any, allItems: any): string {
        let t =
            (value &&
                (value.parent ||
                    value.parentIssue ||
                    value.issue ||
                    value.option ||
                    value.item ||
                    value.value)) ||
            (value &&
                value.raw &&
                (value.raw.parent || value.raw.itemContent || value.raw.item)) ||
            null,
            o =
                (t &&
                    (t.number || t.id || (t.raw && t.raw.number)) &&
                    (t.number || (t.raw && t.raw.number))) ||
                '',
            l =
                (t &&
                    (t.title || t.name || (t.raw && t.raw.title)) &&
                    (t.title || t.name || (t.raw && t.raw.title))) ||
                '',
            r =
                (t &&
                    (t.url || t.html_url || (t.raw && t.raw.url)) &&
                    (t.url || t.html_url || (t.raw && t.raw.url))) ||
                '',
            a = escapeHtml(String(l || '')),
            p = o ? escapeHtml(String(o)) : '',
            g = escapeHtml(String(r || '')),
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
                    O: string[] = [];
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
                            d.type === 'single_select' &&
                            ((d.raw &&
                                d.raw.field &&
                                String(d.raw.field.name || '').toLowerCase() ===
                                'status') ||
                                (d.fieldName &&
                                    String(d.fieldName || '').toLowerCase() ===
                                    'status') ||
                                (d.field &&
                                    d.field.name &&
                                    String(d.field.name || '').toLowerCase() ===
                                    'status'))
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
            x = h || '#999999',
            k = (w && addAlpha(h, 0.12)) || 'rgba(0,0,0,0.06)',
            L = getContrastColor(h) || '#333333',
            q =
                '<span style=\'display:block;width:100%;box-sizing:border-box\'>' +
                '<div style=\'display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid ' +
                escapeHtml(x) +
                ';border-radius:999px;color:' +
                escapeHtml(L) +
                ';background:' +
                escapeHtml(k) +
                ';font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;width:100%\'>' +
                '<svg width=\'14\' height=\'14\' viewBox=\'0 0 16 16\' xmlns=\'http://www.w3.org/2000/svg\' style=\'flex-shrink:0;color:' +
                escapeHtml(h || '#666') +
                '\'><circle cx=\'8\' cy=\'8\' r=\'6\' fill=\'currentColor\' /></svg>' +
                '<span class=\'parent-issue-title\' style=\'flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block\'>' +
                a +
                '</span>' +
                (p
                    ? '<span style=\'margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap\'>#' +
                    p +
                    '</span>'
                    : '') +
                '</div></span>';
        const parentWrapper = '<span data-gh-open=\'' + (g || '') + '\' class=\'parent-issue-wrapper\' style=\'display:block;width:100%;cursor:' + (g ? 'pointer' : 'default') + '\'>' ;
        return g
            ? parentWrapper + q + '</span>'
            : q;
    }
}

