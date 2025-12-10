import { normalizeColor, escapeHtml } from "../utils";
import { RowRenderer } from "./RowRenderer";

export class GroupRenderer {
  constructor(
    private fields: any[],
    private allItems: any[],
  ) {}

  /**
   * Helper to get icon SVG from registry
   */
  private getIconSvg(iconName: string, size: number = 14): string {
    if (window.getIconSvg) {
      return window.getIconSvg(iconName as any, { size });
    }
    return "";
  }

  public renderGroup(
    tbody: HTMLTableSectionElement,
    group: any,
    groupingField: any,
    rowRenderer: RowRenderer,
  ) {
    // Render Group Header
    const trHeader = document.createElement("tr");
    const tdHeader = document.createElement("td");
    tdHeader.colSpan = this.fields.length + 1;
    tdHeader.style.padding = "8px";
    tdHeader.style.background = "var(--vscode-editor-background)"; // Ensure opaque background
    tdHeader.style.fontWeight = "600";
    tdHeader.style.borderTop = "1px solid var(--vscode-editorGroup-border)";
    tdHeader.style.borderBottom = "1px solid var(--vscode-editorGroup-border)";
    tdHeader.style.position = "sticky";
    tdHeader.style.top = "32px"; // Matches fixed header height
    tdHeader.style.zIndex = "9";
    tdHeader.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)"; // Add shadow for better separation

    // Group Header Content
    const headerContent = document.createElement("div");
    headerContent.style.display = "flex";
    headerContent.style.alignItems = "center";
    headerContent.style.gap = "8px";

    // Helper: find estimate field id (best-effort)
    const estimateField =
      this.fields.find(
        (f) =>
          f.dataType &&
          String(f.dataType).toLowerCase() === "number" &&
          String(f.name || "")
            .toLowerCase()
            .includes("estimate"),
      ) ||
      this.fields.find(
        (f) => f.dataType && String(f.dataType).toLowerCase() === "number",
      );
    const estimateFieldId = estimateField ? estimateField.id : null;

    const sumEstimate = (itemsArr: any[]) => {
      if (!estimateFieldId) return 0;
      let sum = 0;
      for (const gi of itemsArr) {
        const it = gi.item || gi;
        if (!it || !Array.isArray(it.fieldValues)) continue;
        const fv = it.fieldValues.find(
          (v: any) =>
            (v.fieldId && String(v.fieldId) === String(estimateFieldId)) ||
            (v.fieldName &&
              String(v.fieldName).toLowerCase().includes("estimate")) ||
            v.type === "number",
        );
        if (fv) {
          const num = Number(
            fv.number != null ? fv.number : fv.value != null ? fv.value : NaN,
          );
          if (!isNaN(num)) sum += num;
        }
      }
      return sum;
    };

    const formatEstimate = (n: number) => {
      if (!isFinite(n)) return "";
      return String(n);
    };

    // Toggle Button
    const toggleBtn = document.createElement("span");
    // SVG Icons for GitHub-like look from icon registry
    const iconExpanded = this.getIconSvg("triangle-down", 16);
    const iconCollapsed = this.getIconSvg("triangle-right", 16);

    toggleBtn.innerHTML = iconExpanded;
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.userSelect = "none";
    toggleBtn.style.display = "inline-flex";
    toggleBtn.style.alignItems = "center";
    toggleBtn.style.justifyContent = "center";
    toggleBtn.style.width = "16px";
    toggleBtn.style.height = "16px";
    toggleBtn.style.fill = "var(--vscode-foreground)";
    toggleBtn.style.opacity = "0.7";

    // Group Name & Color
    const colorDot = document.createElement("div");
    colorDot.style.width = "12px";
    colorDot.style.height = "12px";
    colorDot.style.borderRadius = "50%";
    colorDot.style.backgroundColor =
      normalizeColor(group.option.color) || "gray";

    const nameSpan = document.createElement("span");
    nameSpan.textContent =
      group.option.name || group.option.title || "Unassigned";

    // We'll keep the left-hand part of the group header (toggle, avatar/color, name, count)
    // in a sticky left pane so it remains visible when horizontally scrolling.
    const leftPane = document.createElement("div");
    leftPane.style.display = "flex";
    leftPane.style.alignItems = "center";
    leftPane.style.gap = "8px";
    leftPane.style.position = "sticky";
    leftPane.style.left = "0";
    leftPane.style.zIndex = "12";
    leftPane.style.background = tdHeader.style.background;
    leftPane.style.paddingRight = "8px";

    const rightPane = document.createElement("div");
    rightPane.style.display = "flex";
    rightPane.style.alignItems = "center";
    rightPane.style.gap = "8px";
    rightPane.style.flex = "1";

    leftPane.appendChild(toggleBtn);

    // For parent_issue, try to extract parent metadata from the first child item
    let parentMeta: any = null;
    let resolvedParentItem: any = null;
    if (String(groupingField.dataType || "").toLowerCase() === "parent_issue") {
      const first =
        group.items && group.items[0]
          ? group.items[0].item || group.items[0]
          : null;
      if (first && Array.isArray(first.fieldValues)) {
        const pfv = first.fieldValues.find(
          (v: any) =>
            String(v.fieldId) === String(groupingField.id) ||
            v.fieldName === groupingField.name ||
            v.type === "parent_issue",
        );
        if (pfv) {
          parentMeta =
            pfv.parent ||
            pfv.parentIssue ||
            pfv.issue ||
            pfv.item ||
            pfv.value ||
            null;
        }
      }

      // Try to resolve the full parent item from the current items snapshot (this.allItems)
      if (parentMeta && Array.isArray(this.allItems)) {
        try {
          const identifiers: string[] = [];
          if (parentMeta.number) identifiers.push(String(parentMeta.number));
          if (parentMeta.id) identifiers.push(String(parentMeta.id));
          if (parentMeta.url) identifiers.push(String(parentMeta.url));
          if (parentMeta.title) identifiers.push(String(parentMeta.title));
          // search in this.allItems for a matching content/raw identifiers
          const found = this.allItems.find((A: any) => {
            const d =
              (A && (A.content || (A.raw && A.raw.itemContent))) || null;
            if (!d) return false;
            const M: string[] = [];
            if (d.number) M.push(String(d.number));
            if (d.id) M.push(String(d.id));
            if (d.url) M.push(String(d.url));
            if (d.title) M.push(String(d.title));
            if (d.name) M.push(String(d.name));
            if (d.raw && d.raw.number) M.push(String(d.raw.number));
            if (d.raw && d.raw.id) M.push(String(d.raw.id));
            if (d.raw && d.raw.url) M.push(String(d.raw.url));
            for (let o of identifiers) {
              for (let m of M) {
                if (o && m && String(o) === String(m)) return true;
              }
            }
            return false;
          });
          if (found) resolvedParentItem = found;
        } catch (e) {}
      }
    }

    // Avatar / color dot / repo icon depending on field type
    if (
      (group.option && group.option.avatarUrl) ||
      (group.option && group.option.login) ||
      (group.option &&
        group.option.name &&
        String(groupingField.dataType || "").toLowerCase() === "assignees")
    ) {
      // Try to render avatar for assignees
      const avatarEl = document.createElement("span");
      const avatarUrl =
        (group.option &&
          (group.option.avatarUrl ||
            group.option.avatar ||
            group.option.imageUrl)) ||
        (() => {
          // try to find in items
          for (const gi of group.items) {
            const it = gi.item || gi;
            if (!it || !Array.isArray(it.fieldValues)) continue;
            const fv = it.fieldValues.find(
              (v: any) =>
                v.type === "assignees" ||
                String(v.fieldId) === String(groupingField.id),
            );
            if (fv && fv.assignees && Array.isArray(fv.assignees)) {
              const match = fv.assignees.find(
                (a: any) =>
                  String(a.login || a.name) ===
                  String(group.option.name || group.option.id),
              );
              if (match && (match.avatarUrl || match.avatar))
                return match.avatarUrl || match.avatar;
            }
          }
          return null;
        })();
      if (avatarUrl) {
        avatarEl.innerHTML =
          '<span title="' +
          escapeHtml(
            (group.option && (group.option.login || group.option.name)) ||
              "Assignee",
          ) +
          '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' +
          escapeHtml(avatarUrl) +
          ');border:2px solid var(--vscode-editor-background)"></span>';
        leftPane.appendChild(avatarEl);
      } else {
        leftPane.appendChild(colorDot);
      }
    } else if (
      String(groupingField.dataType || "").toLowerCase() === "repository"
    ) {
      // repository icon
      const repoIcon = document.createElement("span");
      repoIcon.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/></svg>';
      leftPane.appendChild(repoIcon);
    } else {
      leftPane.appendChild(colorDot);
    }

    // Name
    // For parent_issue, prefer the resolved parent item's title if available, else use parentMeta
    if (resolvedParentItem) {
      // Try to extract title and status color from resolved parent
      const content =
        resolvedParentItem.content ||
        (resolvedParentItem.raw && resolvedParentItem.raw.itemContent) ||
        null;
      if (content) {
        // title
        try {
          if (content.title) nameSpan.textContent = String(content.title);
          else if (content.name) nameSpan.textContent = String(content.name);
          else if (content.number)
            nameSpan.textContent = String(content.number);
        } catch (e) {}

        // Try to get status color from parent's fieldValues (single_select status)
        if (Array.isArray(resolvedParentItem.fieldValues)) {
          const statusFV = resolvedParentItem.fieldValues.find(
            (v: any) =>
              v && v.type === "single_select" && v.option && v.option.name,
          );
          if (statusFV && statusFV.option) {
            // If option has color, use it; otherwise try map by name
            try {
              const c =
                statusFV.option.color ||
                statusFV.option.id ||
                statusFV.option.name ||
                null;
              if (c)
                colorDot.style.backgroundColor =
                  normalizeColor(c) || colorDot.style.backgroundColor;
            } catch (e) {}
          }
        }
      }
    } else if (parentMeta) {
      nameSpan.textContent =
        parentMeta.title ||
        parentMeta.name ||
        parentMeta.number ||
        parentMeta.id ||
        nameSpan.textContent;
      if (parentMeta.color) {
        try {
          colorDot.style.backgroundColor =
            normalizeColor(parentMeta.color) || colorDot.style.backgroundColor;
        } catch (e) {}
      }
    }
    leftPane.appendChild(nameSpan);

    // Count circle (placed before estimate pill)
    const countCircle = document.createElement("span");
    countCircle.style.display = "inline-flex";
    countCircle.style.alignItems = "center";
    countCircle.style.justifyContent = "center";
    countCircle.style.width = "22px";
    countCircle.style.height = "22px";
    countCircle.style.borderRadius = "50%";
    countCircle.style.background = "var(--vscode-input-background)";
    countCircle.style.border = "1px solid var(--vscode-panel-border)";
    countCircle.style.color = "var(--vscode-foreground)";
    countCircle.style.fontSize = "12px";
    countCircle.style.fontWeight = "600";
    countCircle.style.minWidth = "22px";
    countCircle.style.boxSizing = "border-box";
    countCircle.textContent = String(group.items.length || 0);
    leftPane.appendChild(countCircle);

    // Estimate pill and optional extra info
    const estSum = sumEstimate(group.items || []);
    if (estSum && estSum > 0) {
      const estEl = document.createElement("div");
      estEl.style.display = "inline-block";
      estEl.style.padding = "2px 8px";
      estEl.style.borderRadius = "999px";
      estEl.style.border = "1px solid var(--vscode-panel-border)";
      estEl.style.background = "var(--vscode-input-background)";
      estEl.style.color = "var(--vscode-foreground)";
      estEl.style.fontSize = "12px";
      estEl.style.lineHeight = "18px";
      estEl.style.marginLeft = "8px";
      estEl.textContent = "Estimate: " + formatEstimate(estSum);
      // Put estimate pill into the left sticky pane so it remains visible when horizontally scrolling
      leftPane.appendChild(estEl);

      // If parent_issue, show completed/amount + progress bar (only for real parents)
      if (
        String(groupingField.dataType || "").toLowerCase() === "parent_issue" &&
        !(
          group.option &&
          (group.option.name === "Unassigned" ||
            group.option.title === "Unassigned")
        )
      ) {
        const completedNames = ["done", "closed", "completed", "finished"];

        // Helper: robust done detection for a single item
        const isDoneByHeuristics = (it: any) => {
          try {
            const content =
              it && (it.content || (it.raw && it.raw.itemContent));
            if (content) {
              const state = (
                content.state ||
                (content.merged ? "MERGED" : undefined) ||
                ""
              )
                .toString()
                .toUpperCase();
              if (state === "CLOSED" || state === "MERGED") return true;
            }

            if (Array.isArray(it.fieldValues)) {
              // single_select status matching
              const ss = it.fieldValues.find(
                (v: any) =>
                  v &&
                  v.type === "single_select" &&
                  v.option &&
                  v.option.name &&
                  completedNames.includes(String(v.option.name).toLowerCase()),
              );
              if (ss) return true;

              // numeric percent-like or explicit done flag
              const percentFV = it.fieldValues.find(
                (v: any) =>
                  v &&
                  (String(v.fieldName || "")
                    .toLowerCase()
                    .includes("progress") ||
                    String(v.fieldName || "")
                      .toLowerCase()
                      .includes("percent") ||
                    (v.type === "number" &&
                      String(v.fieldName || "")
                        .toLowerCase()
                        .includes("progress"))),
              );
              if (percentFV && percentFV.number != null) {
                const pct = Number(percentFV.number || 0);
                if (pct >= 100) return true;
              }
            }

            if (
              content &&
              content.labels &&
              Array.isArray(content.labels.nodes)
            ) {
              const labs = content.labels.nodes.map((l: any) =>
                String(l.name || "").toLowerCase(),
              );
              for (const cn of completedNames)
                if (labs.includes(cn)) return true;
            }
          } catch (e) {}
          return false;
        };

        // Prefer parent-provided aggregate if available
        let done = 0;
        let total = 0;
        if (
          resolvedParentItem &&
          Array.isArray(resolvedParentItem.fieldValues)
        ) {
          const agg = resolvedParentItem.fieldValues.find(
            (v: any) =>
              v &&
              (v.type === "sub_issues_progress" ||
                (v.total != null && v.done != null)),
          );
          if (agg && agg.total != null) {
            total = Number(agg.total || 0);
            done = Number(agg.done || 0);
          }
        }

        // If no parent aggregate found, compute from children
        if (!total) {
          for (const gi of group.items) {
            const it = gi.item || gi;
            if (!it) continue;
            total++;
            if (isDoneByHeuristics(it)) done++;
          }
        }

        // show completed/total BEFORE progress bar
        const doneText = document.createElement("div");
        doneText.style.color = "var(--vscode-descriptionForeground)";
        doneText.style.fontSize = "12px";
        doneText.style.marginLeft = "8px";
        doneText.style.fontVariantNumeric = "tabular-nums";
        doneText.textContent = `${done}/${total}`;
        // Keep completed/total near the left sticky area so it stays visible
        leftPane.appendChild(doneText);

        // show progress bar
        const progWrapper = document.createElement("div");
        progWrapper.style.display = "inline-flex";
        progWrapper.style.alignItems = "center";
        progWrapper.style.gap = "8px";
        progWrapper.style.marginLeft = "8px";
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const bar = document.createElement("div");
        bar.style.display = "inline-block";
        bar.style.width = "120px";
        bar.style.height = "12px";
        bar.style.background = "transparent";
        bar.style.border = "1px solid var(--vscode-focusBorder)";
        bar.style.borderRadius = "6px";
        bar.style.overflow = "hidden";
        const fill = document.createElement("div");
        fill.style.height = "100%";
        fill.style.width = String(pct) + "%";
        fill.style.background = "var(--vscode-focusBorder)";
        bar.appendChild(fill);
        progWrapper.appendChild(bar);
        // Progress bar is useful summary info — keep it in the sticky left pane
        leftPane.appendChild(progWrapper);
      }
    }

    // Single-select: show option description if available
    if (
      String(groupingField.dataType || "").toLowerCase() === "single_select"
    ) {
      try {
        const opt = (groupingField.options || []).find(
          (o: any) =>
            String(o.name) === String(group.option && group.option.name),
        );
        if (opt && opt.description) {
          const descEl = document.createElement("div");
          descEl.style.color = "var(--vscode-descriptionForeground)";
          descEl.style.fontSize = "12px";
          descEl.style.marginLeft = "8px";
          descEl.textContent = String(opt.description).slice(0, 120);
          // Keep description fixed in the left sticky pane so it remains visible
          leftPane.appendChild(descEl);
        }
      } catch (e) {}
    }

    // Iteration: append iteration range (start - end) if startDate/duration available, else title
    if (String(groupingField.dataType || "").toLowerCase() === "iteration") {
      try {
        const opt = group.option || {};
        let iterText: string | null = null;
        const start = opt.startDate || (opt.start && opt.startDate) || null;
        const duration = opt.duration || opt.length || null;
        if (start && duration) {
          try {
            const s = new Date(start);
            const days = Number(duration) || 0;
            const e = new Date(s.getTime() + days * 24 * 60 * 60 * 1000);
            const sStr = s.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const eStr = e.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            iterText = `${sStr} — ${eStr}`;
          } catch (e) {
            iterText = null;
          }
        }
        if (!iterText) {
          iterText =
            opt.title || opt.name ? String(opt.title || opt.name) : null;
        }
        if (iterText) {
          const iterEl = document.createElement("div");
          iterEl.style.color = "var(--vscode-descriptionForeground)";
          iterEl.style.fontSize = "12px";
          iterEl.style.marginLeft = "8px";
          iterEl.textContent = String(iterText).slice(0, 120);
          // Keep iteration info fixed in the left sticky pane
          leftPane.appendChild(iterEl);
        }
      } catch (e) {}
    }

    // If this group corresponds to 'Unassigned', rename to 'No <fieldname>'
    if (
      group.option &&
      (group.option.name === "Unassigned" ||
        group.option.title === "Unassigned")
    ) {
      nameSpan.textContent = "No " + (groupingField.name || "value");
    }

    // Compose header: leftPane (sticky) + rightPane (scrolling content)
    headerContent.appendChild(leftPane);
    headerContent.appendChild(rightPane);

    tdHeader.appendChild(headerContent);
    trHeader.appendChild(tdHeader);
    tbody.appendChild(trHeader);

    // Render Items
    const groupRows: HTMLTableRowElement[] = [];
    group.items.forEach((groupItem: any) => {
      const tr = rowRenderer.createRow(groupItem.item, groupItem.index);
      tr.classList.add("group-row-" + group.option.id); // Add class for group toggling
      tbody.appendChild(tr);
      groupRows.push(tr);
    });

    // Toggle Logic
    let isCollapsed = false;
    toggleBtn.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      toggleBtn.innerHTML = isCollapsed ? iconCollapsed : iconExpanded;
      groupRows.forEach((row) => {
        row.style.display = isCollapsed ? "none" : "table-row";
      });
    });
  }
}
