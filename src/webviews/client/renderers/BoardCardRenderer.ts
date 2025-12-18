import {
  normalizeColor,
  escapeHtml,
  addAlpha,
  getContrastColor,
} from "../utils";

/**
 * BoardCardRenderer - Renders board view cards grouped by column field
 * Each card represents a column option (from single_select or iteration field)
 */
export class BoardCardRenderer {
  constructor(
    private fields: any[],
    private allItems: any[],
    private visibleFieldIds?: string[],
    private onFilter?: (filter: string) => void,
    private onAction?: (action: string, item: any, args?: any) => void,
  ) {
    // Bind methods
    this.handlePillClick = this.handlePillClick.bind(this);
  }

  /**
   * Handle pill click for filtering
   */
  private handlePillClick(e: MouseEvent, field: string, value: string) {
    e.stopPropagation(); // Prevent opening item
    e.preventDefault();
    if (this.onFilter) {
      const safeValue = value.includes(" ")
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
      // Quote field if it contains spaces
      const safeField = field.includes(" ")
        ? `"${field.replace(/"/g, '\\"')}"`
        : field;
      this.onFilter(`${safeField}:${safeValue}`);
    }
  }

  /**
   * Helper to get icon SVG from registry
   */
  private getIconSvg(
    iconName: string,
    size: number = 14,
    fill?: string,
  ): string {
    if ((window as any).getIconSvg) {
      return (window as any).getIconSvg(iconName, { size, fill });
    }
    return "";
  }

  /**
   * Find estimate field (prioritize fields with "estimate" in name)
   */
  private getEstimateField(): any {
    return (
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
      )
    );
  }

  /**
   * Sum estimate values for a list of items
   */
  public sumEstimate(items: any[]): number {
    const estimateField = this.getEstimateField();
    if (!estimateField) return 0;

    let sum = 0;
    for (const item of items) {
      if (!item || !Array.isArray(item.fieldValues)) continue;
      const fv = item.fieldValues.find(
        (v: any) =>
          (v.fieldId && String(v.fieldId) === String(estimateField.id)) ||
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
  }

  /**
   * Format estimate number for display
   */
  private formatEstimate(n: number): string {
    if (!isFinite(n)) return "";
    return String(n);
  }

  /**
   * Group items by column field value
   */
  public groupItemsByColumn(
    items: any[],
    columnField: any,
  ): Map<string, { option: any; items: any[] }> {
    const groups = new Map<string, { option: any; items: any[] }>();
    const dataType = String(columnField.dataType || "").toLowerCase();

    // Get all options from the field configuration
    let options: any[] = [];
    if (dataType === "single_select" && Array.isArray(columnField.options)) {
      options = columnField.options;
    } else if (
      dataType === "iteration" &&
      columnField.configuration?.iterations
    ) {
      options = columnField.configuration.iterations.map((it: any) => ({
        id: it.id,
        name: it.title,
        title: it.title,
        color: it.color || null,
        startDate: it.startDate,
        duration: it.duration,
      }));
    }

    // Initialize groups for each option in order
    for (const opt of options) {
      const key = String(opt.id || opt.name || "");
      if (key) {
        groups.set(key, { option: opt, items: [] });
      }
    }

    // Add "No value" group
    groups.set("__no_value__", {
      option: {
        id: "__no_value__",
        name: `No ${columnField.name}`,
        color: null,
      },
      items: [],
    });

    // Assign items to groups
    for (const item of items) {
      if (!item || !Array.isArray(item.fieldValues)) {
        groups.get("__no_value__")!.items.push(item);
        continue;
      }

      const fv = item.fieldValues.find(
        (v: any) =>
          String(v.fieldId) === String(columnField.id) ||
          String(v.fieldName).toLowerCase() === String(columnField.name).toLowerCase()
      );

      let groupKey = "__no_value__";

      if (fv) {
        if (dataType === "single_select") {
          const optId = fv.optionId || (fv.option && fv.option.id);
          const optName = fv.name || (fv.option && fv.option.name);
          if (optId && groups.has(String(optId))) {
            groupKey = String(optId);
          } else if (optName) {
            for (const [key, group] of groups) {
              if (String(group.option.name).toLowerCase() === String(optName).toLowerCase()) {
                groupKey = key;
                break;
              }
            }
          }
        } else if (dataType === "iteration") {
          const itId = fv.iterationId || (fv.iteration && fv.iteration.id) || fv.id;
          const itTitle = fv.title || (fv.iteration && fv.iteration.title);
          if (itId && groups.has(String(itId))) {
            groupKey = String(itId);
          } else if (itTitle) {
            for (const [key, group] of groups) {
              if (String(group.option.title).toLowerCase() === String(itTitle).toLowerCase() ||
                String(group.option.name).toLowerCase() === String(itTitle).toLowerCase()) {
                groupKey = key;
                break;
              }
            }
          }
        }
      }

      if (groups.has(groupKey)) {
        groups.get(groupKey)!.items.push(item);
      } else {
        groups.get("__no_value__")!.items.push(item);
      }
    }

    return groups;
  }

  /**
   * Get iteration date range string
   */
  private getIterationRange(option: any): string | null {
    const start = option.startDate || option.start;
    const duration = option.duration || option.length;

    if (!start || !duration) return null;

    try {
      const startDate = new Date(start);
      const endDate = new Date(
        startDate.getTime() + Number(duration) * 24 * 60 * 60 * 1000,
      );

      const formatDate = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      return `${formatDate(startDate)} — ${formatDate(endDate)}`;
    } catch (e) {
      return null;
    }
  }

  /**
   * Render a single card for a column
   */
  public renderCard(option: any, items: any[], columnField: any): HTMLElement {
    const card = document.createElement("div");
    card.className = "board-card";
    card.setAttribute("data-column-id", String(option.id || option.name || ""));
    card.style.width = "350px";
    card.style.minWidth = "350px";
    card.style.maxWidth = "350px";
    card.style.background = "var(--vscode-editorWidget-background)";
    card.style.border = "1px solid var(--vscode-editorWidget-border)";
    card.style.borderRadius = "0";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.flexShrink = "0";

    // Card Header
    const header = this.renderColumnHeaderOnly(option, items, columnField);
    header.style.borderBottom = "1px solid var(--vscode-editorWidget-border)";
    card.appendChild(header);

    // Card Items - with scroll for overflow
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "board-card-items";
    itemsContainer.style.padding = "8px";
    itemsContainer.style.overflowY = "auto";
    itemsContainer.style.flex = "1";
    itemsContainer.style.minHeight = "0"; // Important for flex scroll

    // Get the column option color for items
    const columnColor = normalizeColor(option.color) || "#666666";

    for (const item of items) {
      const itemEl = this.renderItem(item, columnField, columnColor);
      itemsContainer.appendChild(itemEl);
    }

    card.appendChild(itemsContainer);

    // Card Footer - Add item button
    const footer = this.renderColumnFooterOnly(option, columnField);
    card.appendChild(footer);

    return card;
  }

  /**
   * Render only the column header
   */
  private renderColumnHeaderOnly(
    option: any,
    items: any[],
    columnField: any,
  ): HTMLElement {
    const dataType = String(columnField.dataType || "").toLowerCase();
    const header = document.createElement("div");
    header.className = "board-card-header";
    header.style.padding = "12px";
    header.style.background = "var(--vscode-sideBar-background)";
    header.style.flexShrink = "0";

    // Header Row 1: Color dot + Title + Count + Estimate
    const headerRow = document.createElement("div");
    headerRow.className = "board-card-header-row";
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "center";
    headerRow.style.gap = "8px";

    // Color dot
    const colorDot = document.createElement("span");
    colorDot.className = "board-card-color-dot";
    colorDot.style.width = "12px";
    colorDot.style.height = "12px";
    colorDot.style.borderRadius = "50%";
    colorDot.style.flexShrink = "0";
    const normalizedColor = normalizeColor(option.color) || "#666666";
    colorDot.style.backgroundColor = normalizedColor;
    headerRow.appendChild(colorDot);

    // Title
    const title = document.createElement("span");
    title.className = "board-card-title";
    title.style.fontWeight = "600";
    title.style.flex = "1";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.whiteSpace = "nowrap";
    title.textContent = option.name || option.title || "Unnamed";
    headerRow.appendChild(title);

    // Count badge
    const count = document.createElement("span");
    count.className = "board-card-count";
    count.style.fontSize = "12px";
    count.style.color = "var(--vscode-descriptionForeground)";
    count.style.fontVariantNumeric = "tabular-nums";
    count.textContent = String(items.length);
    headerRow.appendChild(count);

    // Estimate pill
    const estSum = this.sumEstimate(items);
    if (estSum > 0) {
      const estimatePill = document.createElement("span");
      estimatePill.className = "board-card-estimate";
      estimatePill.style.display = "inline-block";
      estimatePill.style.padding = "2px 8px";
      estimatePill.style.borderRadius = "999px";
      estimatePill.style.background = "var(--vscode-input-background)";
      estimatePill.style.border = "1px solid var(--vscode-panel-border)";
      estimatePill.style.fontSize = "12px";
      estimatePill.style.lineHeight = "18px";
      estimatePill.textContent = this.formatEstimate(estSum);
      headerRow.appendChild(estimatePill);
    }

    header.appendChild(headerRow);

    // Header Row 2: Description or Iteration Range
    let description: string | null = null;
    if (dataType === "single_select" && option.description) {
      description = String(option.description).slice(0, 120);
    } else if (dataType === "iteration") {
      description = this.getIterationRange(option);
    }

    if (description) {
      const descRow = document.createElement("div");
      descRow.className = "board-card-description";
      descRow.style.fontSize = "12px";
      descRow.style.color = "var(--vscode-descriptionForeground)";
      descRow.style.marginTop = "4px";
      descRow.style.overflow = "hidden";
      descRow.style.textOverflow = "ellipsis";
      descRow.style.whiteSpace = "nowrap";
      descRow.textContent = description;
      header.appendChild(descRow);
    }

    return header;
  }

  /**
   * Render only the column footer (Add item button)
   */
  private renderColumnFooterOnly(option: any, columnField: any): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "board-card-footer";
    footer.style.padding = "8px 12px";
    footer.style.borderTop = "1px solid var(--vscode-editorWidget-border)";
    footer.style.cursor = "pointer";
    footer.style.userSelect = "none";
    footer.style.flexShrink = "0";
    footer.style.transition = "background-color 0.15s ease";
    footer.setAttribute("data-column-field-id", String(columnField.id || ""));
    footer.setAttribute("data-column-value-id", String(option.id || ""));
    footer.setAttribute(
      "data-column-value-name",
      String(option.name || option.title || ""),
    );

    const addLabel = document.createElement("span");
    addLabel.textContent = "+ Add item";
    addLabel.style.opacity = "0.9";
    addLabel.style.fontSize = "13px";
    footer.appendChild(addLabel);

    footer.addEventListener("mouseenter", () => {
      footer.style.backgroundColor = "var(--vscode-list-hoverBackground)";
    });
    footer.addEventListener("mouseleave", () => {
      footer.style.backgroundColor = "transparent";
    });

    footer.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onAction) {
        this.onAction(
          "add-item-to-column",
          {
            columnFieldId: columnField.id,
            columnValueId: option.id,
            columnValueName: option.name || option.title,
          },
          {
            anchorElement: footer,
          },
        );
      }
    });

    return footer;
  }

  /**
   * Render a single item within a card with full details
   */
  private renderItem(
    item: any,
    columnField: any,
    columnColor: string,
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = "board-item";
    el.setAttribute("data-gh-item-id", String(item?.id || ""));
    el.style.padding = "10px";
    el.style.border = "1px solid var(--vscode-editorWidget-border)";
    el.style.borderRadius = "0";
    el.style.marginBottom = "8px";
    el.style.background = "var(--vscode-editor-background)";
    el.style.cursor = "pointer";
    el.style.position = "relative";

    // Extract content information
    const content =
      item?.content || (item?.raw && item.raw.itemContent) || null;
    const titleText =
      (item?.content && (item.content.title || item.content.name)) ||
      item?.title ||
      (item?.raw && item.raw.title) ||
      "Untitled";

    const number =
      (item?.content && item.content.number) ||
      (item?.raw && item.raw.itemContent && item.raw.itemContent.number) ||
      null;

    const url =
      (item?.content && item.content.url) ||
      (item?.raw && item.raw.itemContent && item.raw.itemContent.url) ||
      null;

    // Determine icon based on content type
    let iconName = "issue-opened";
    let isPR = false;
    if (content) {
      const typename = String(content.__typename || "").toLowerCase();
      const state = String(content.state || "").toUpperCase();
      isPR = typename.includes("pullrequest");
      const isClosed = state === "CLOSED";
      const isMerged = content.merged === true;
      const isDraft = content.isDraft === true;

      if (isPR) {
        if (isMerged) iconName = "git-merge";
        else if (isClosed) iconName = "git-pull-request-closed";
        else if (isDraft) iconName = "git-pull-request-draft";
        else iconName = "git-pull-request";
      } else {
        if (isClosed) iconName = "issue-closed";
        else if (isDraft) iconName = "issue-draft";
        else iconName = "issue-opened";
      }
    }

    // Determine blocked status
    let isBlocked = false;
    try {
      const deps =
        content && (content as any).issueDependenciesSummary
          ? (content as any).issueDependenciesSummary
          : null;
      const blockedByCount =
        deps && typeof deps.blockedBy === "number" ? deps.blockedBy : 0;
      isBlocked = blockedByCount > 0;
    } catch (_) { }

    // Use column color for the icon (matches column header)
    const iconColor = columnColor;

    // Extract assignees for top-right corner
    const assignees = this.extractAssignees(item);

    // Build item HTML
    const mainContent = document.createElement("div");
    mainContent.style.display = "flex";
    mainContent.style.flexDirection = "column";
    mainContent.style.gap = "6px";

    // Row 1: Icon with column color and blocked overlay
    const iconRow = document.createElement("div");
    iconRow.style.display = "flex";
    iconRow.style.justifyContent = "flex-start";
    iconRow.style.alignItems = "center";

    const baseIcon = this.getIconSvg(iconName, 16, iconColor);
    const blockedOverlay = isBlocked
      ? `<span class='blocked-overlay' style='position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:999px;background:var(--vscode-editor-background);display:flex;align-items:center;justify-content:center;box-sizing:border-box;'>${this.getIconSvg("blocked", 9, "#dc3545")}</span>`
      : "";

    iconRow.innerHTML = `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;color:${escapeHtml(iconColor)};">${baseIcon}${blockedOverlay}</span>`;

    // Add menu button
    const menuBtn = document.createElement("span");
    menuBtn.className = "board-item-menu-btn";
    menuBtn.setAttribute("data-item-id", String(item?.id || ""));
    menuBtn.style.marginLeft = "6px"; // Position after icon
    menuBtn.style.color = "var(--vscode-descriptionForeground)";
    menuBtn.innerHTML =
      this.getIconSvg("kebab-horizontal", 14) || "<span>...</span>";
    iconRow.appendChild(menuBtn);

    mainContent.appendChild(iconRow);

    // Row 2: Title + #number
    const titleRow = document.createElement("div");
    titleRow.style.fontWeight = "500";
    titleRow.style.lineHeight = "1.3";
    titleRow.innerHTML = `${escapeHtml(titleText)}${number ? ` <span style="color:var(--vscode-descriptionForeground);font-weight:400;">#${escapeHtml(String(number))}</span>` : ""}`;
    mainContent.appendChild(titleRow);

    // Row 3: Field values (except sub_issues_progress and assignees)
    const fieldsRow = this.renderFieldValues(item, columnField);
    if (fieldsRow) {
      mainContent.appendChild(fieldsRow);
    }

    // Row 4: Sub-issues progress (if applicable)
    const subIssuesProgress = this.renderSubIssuesProgress(item);
    if (subIssuesProgress) {
      mainContent.appendChild(subIssuesProgress);
    }

    el.appendChild(mainContent);

    // Top-right corner: Assignee avatars
    if (assignees && assignees.length > 0) {
      const avatarsContainer = this.renderAssigneeAvatars(assignees);
      avatarsContainer.style.position = "absolute";
      avatarsContainer.style.top = "10px";
      avatarsContainer.style.right = "10px";
      el.appendChild(avatarsContainer);
    }

    // Add click handler if URL available
    if (url) {
      el.setAttribute("data-gh-open", url);
      el.title = `${titleText}${number ? ` #${number}` : ""}`;
    }

    return el;
  }

  /**
   * Helper: Get field name from value or lookup in fields definition
   */
  private getFieldName(fv: any): string {
    if (fv.fieldName) return fv.fieldName;
    if (fv.field?.name) return fv.field.name;
    if (fv.fieldId && this.fields) {
      const found = this.fields.find(
        (f) => String(f.id) === String(fv.fieldId),
      );
      if (found && found.name) return found.name;
    }
    return "Field";
  }

  /**
   * Extract assignees from item
   */
  private extractAssignees(item: any): any[] {
    if (!item) return [];

    // Try content.assignees first
    if (item.content?.assignees?.nodes) {
      return item.content.assignees.nodes;
    }
    if (item.content?.assignees && Array.isArray(item.content.assignees)) {
      return item.content.assignees;
    }

    // Try fieldValues
    if (Array.isArray(item.fieldValues)) {
      const assigneesFv = item.fieldValues.find(
        (v: any) => v?.type === "assignees" || v?.assignees,
      );
      if (assigneesFv?.assignees) {
        return Array.isArray(assigneesFv.assignees)
          ? assigneesFv.assignees
          : [];
      }
    }

    return [];
  }

  /**
   * Extract linked pull requests from item
   */
  private extractLinkedPullRequests(item: any): any[] {
    console.log(
      "[BoardCard] extractLinkedPullRequests called with item:",
      item?.id,
      "fieldValues:",
      item?.fieldValues?.length,
    );
    if (!item) return [];

    // Try fieldValues first (most common location)
    if (Array.isArray(item.fieldValues)) {
      console.log(
        "[BoardCard] Checking fieldValues, types:",
        item.fieldValues.map((v: any) => v?.type),
      );
      const prFv = item.fieldValues.find(
        (v: any) =>
          v?.type === "linked_pull_requests" || v?.type === "pull_request",
      );
      if (prFv) {
        console.log("[BoardCard] Found PR field value:", prFv);
        // Check for direct array first (matches table view)
        if (Array.isArray(prFv.pullRequests)) {
          console.log("[BoardCard] Returning direct array:", prFv.pullRequests);
          return prFv.pullRequests;
        }
        // Then check for nodes structure
        if (
          prFv.pullRequests?.nodes &&
          Array.isArray(prFv.pullRequests.nodes)
        ) {
          console.log(
            "[BoardCard] Returning nodes array:",
            prFv.pullRequests.nodes,
          );
          return prFv.pullRequests.nodes;
        }
      } else {
        console.log("[BoardCard] No PR field found in fieldValues");
      }
    }

    // Try content.linkedPullRequests as fallback
    if (item.content?.linkedPullRequests) {
      if (Array.isArray(item.content.linkedPullRequests)) {
        return item.content.linkedPullRequests;
      }
      if (Array.isArray(item.content.linkedPullRequests.nodes)) {
        return item.content.linkedPullRequests.nodes;
      }
    }

    console.log("[BoardCard] Returning empty array for linkedPRs");
    return [];
  }

  /**
   * Render assignee avatars for top-right corner
   */
  private renderAssigneeAvatars(assignees: any[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "board-item-assignees";
    container.style.display = "flex";
    container.style.alignItems = "center";

    const maxAvatars = 3;
    const displayed = assignees.slice(0, maxAvatars);

    displayed.forEach((assignee, index) => {
      const login = assignee.login || assignee.name || "Unknown";
      const avatarUrl = assignee.avatarUrl || "";
      if (!avatarUrl) return;

      const img = document.createElement("img");
      img.src = avatarUrl;
      img.className = "board-pill"; // Use board-pill class for click handling
      img.setAttribute("data-filter-field", "Assignees");
      img.setAttribute("data-filter-value", login);
      img.title = login;
      img.style.width = "16px";
      img.style.height = "16px";
      img.style.borderRadius = "50%";
      img.style.border = "1px solid var(--vscode-editorWidget-border)";
      img.style.cursor = "pointer";
      img.style.marginLeft = index === 0 ? "0" : "-6px";
      img.style.zIndex = String(maxAvatars - index);
      img.style.position = "relative";

      container.appendChild(img);
    });

    // If more assignees, show +N
    if (assignees.length > maxAvatars) {
      const more = document.createElement("span");
      more.className = "board-pill";
      more.setAttribute("data-filter-field", "Assignees"); // Can filter by "Assignees" generic? No, value missing.
      // Maybe just cosmetic or filter by "Assignees:HasAny"?
      // For now just cosmetic.
      more.style.marginLeft = "-6px";
      more.style.width = "22px";
      more.style.height = "22px";
      more.style.borderRadius = "50%";
      more.style.background = "var(--vscode-badge-background)";
      more.style.color = "var(--vscode-badge-foreground)";
      more.style.fontSize = "10px";
      more.style.display = "flex";
      more.style.alignItems = "center";
      more.style.justifyContent = "center";
      more.style.fontWeight = "bold";
      more.style.lineHeight = "1";
      more.textContent = `+${assignees.length - maxAvatars}`;
      more.title = "More assignees";
      container.appendChild(more);
    }

    return container;
  }

  /**
   * Render visible field values (excluding sub_issues_progress and assignees)
   */
  private renderFieldValues(item: any, columnField: any): HTMLElement | null {
    if (!item || !Array.isArray(item.fieldValues)) return null;

    const excludeTypes = [
      "sub_issues_progress",
      "assignees",
      "title",
      "status",
    ];
    const excludeFieldNames = ["sub issues progress", "assignees", "title"];
    const columnFieldId = columnField?.id;

    const valuePills: string[] = [];

    // Add linked pull requests if they exist
    const linkedPRs = this.extractLinkedPullRequests(item);
    if (linkedPRs.length > 0) {
      const prHtml = linkedPRs
        .map((pr: any) => {
          const num = escapeHtml(String(pr.number || ""));
          const titleText = escapeHtml(pr.title || "");
          const url = escapeHtml(pr.url || "");
          const rawColor =
            pr.state_color || pr.color || pr.colour || pr.state || null;
          const normColor = normalizeColor(rawColor) || null;
          const hasHex = !!(
            normColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normColor)
          );
          const border = normColor || "#999999";
          const bg =
            (hasHex && addAlpha(normColor, 0.12)) || "rgba(0,0,0,0.06)";
          const fg = getContrastColor(normColor) || "#333333";

          const isDraft = !!pr.isDraft;
          const state = (pr.state && String(pr.state).toUpperCase()) || "";
          const isMerged = !!pr.merged;
          const isClosed = !isMerged && state === "CLOSED";

          let iconName = "git-pull-request";
          if (isMerged) iconName = "git-merge";
          else if (isClosed) iconName = "git-pull-request-closed";
          else if (isDraft) iconName = "git-pull-request-draft";

          const icon = this.getIconSvg(iconName, 12);
          const tooltip = titleText
            ? escapeHtml(`#${pr.number} ${pr.title}`)
            : escapeHtml(`#${pr.number}`);

          return `<a href="${url}" title="${tooltip}" data-gh-open="${url}" style="cursor:pointer;text-decoration:none;color:inherit"><span class="board-pill" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid ${escapeHtml(border)};background:${escapeHtml(bg)};color:${escapeHtml(fg)};font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;max-width:160px"><span style="position:relative;display:inline-flex;align-items:center;justify-content:center">${icon}</span><span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#${num}</span></span></a>`;
        })
        .join("");
      valuePills.push(prHtml);
    }

    for (const fv of item.fieldValues) {
      if (!fv) continue;

      const fieldType = String(fv.type || "").toLowerCase();
      const fieldName = String(
        fv.fieldName || fv.field?.name || "",
      ).toLowerCase();

      // Skip excluded types
      if (excludeTypes.includes(fieldType)) continue;
      if (excludeFieldNames.includes(fieldName)) continue;

      // Skip column field (already shown in grouping)
      if (columnFieldId && String(fv.fieldId) === String(columnFieldId))
        continue;

      // Skip invisible fields (if visibility list is provided)
      if (this.visibleFieldIds && this.visibleFieldIds.length > 0) {
        const fid = fv.fieldId || (fv.field && fv.field.id);
        if (fid && !this.visibleFieldIds.includes(String(fid))) {
          continue;
        }
      }

      // Skip empty values
      const hasValue = this.hasFieldValue(fv);
      if (!hasValue) continue;

      // Render based on field type
      const rendered = this.renderFieldValue(fv);
      if (rendered) {
        valuePills.push(rendered);
      }
    }

    if (valuePills.length === 0) return null;

    const container = document.createElement("div");
    container.className = "board-item-fields";
    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.gap = "4px";
    container.style.marginTop = "4px";
    container.innerHTML = valuePills.join("");

    return container;
  }

  /**
   * Check if field value has content
   */
  private hasFieldValue(fv: any): boolean {
    const type = String(fv.type || "").toLowerCase();

    switch (type) {
      case "single_select":
        return !!(fv.option?.name || fv.name);
      case "iteration":
        return !!(fv.iteration?.title || fv.title);
      case "labels":
        return Array.isArray(fv.labels) && fv.labels.length > 0;
      case "milestone":
        return !!fv.milestone?.title;
      case "repository":
        return !!(fv.repository?.nameWithOwner || fv.repository?.name);
      case "parent_issue":
        return !!(fv.parent || fv.parentIssue);
      case "number":
        return fv.number != null && fv.number !== "";
      case "date":
        return !!(fv.date || fv.startDate);
      case "text":
        return !!fv.text;
      case "pull_request":
      case "linked_pull_requests":
        return !!(
          fv.pullRequests?.nodes?.length > 0 ||
          (Array.isArray(fv.pullRequests) && fv.pullRequests.length > 0)
        );
      default:
        return false;
    }
  }

  /**
   * Render a single field value as HTML
   */
  private renderFieldValue(fv: any): string {
    const type = String(fv.type || "").toLowerCase();

    switch (type) {
      case "single_select":
        return this.renderSingleSelectPill(fv);
      case "labels":
        return this.renderLabelsPills(fv);
      case "iteration":
        return this.renderIterationPill(fv);
      case "milestone":
        return this.renderMilestonePill(fv);
      case "repository":
        return this.renderRepositoryPill(fv);
      case "parent_issue":
        return this.renderParentIssuePill(fv);
      case "number":
        return this.renderNumberPill(fv);
      case "text":
        return this.renderTextPill(fv);
      case "date":
        return this.renderDatePill(fv);
      case "pull_request":
      case "linked_pull_requests":
        return this.renderLinkedPullRequests(fv);
      default:
        return "";
    }
  }

  /**
   * Render single select as colored pill
   */
  private renderSingleSelectPill(fv: any): string {
    const name = fv.option?.name || fv.name || "";
    if (!name) return "";

    const rawColor = fv.option?.color || fv.color || null;
    const p = normalizeColor(rawColor) || null;
    const hasHex = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p));
    const border = p || "#999999";
    const bg = (hasHex && addAlpha(p, 0.12)) || "rgba(0,0,0,0.06)";
    const fg = p || "#333333";

    const fName = this.getFieldName(fv);
    return `<span class="board-pill" data-filter-field="${escapeHtml(fName)}" data-filter-value="${escapeHtml(name)}" style="display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid ${escapeHtml(border)};background:${escapeHtml(bg)};color:${escapeHtml(fg)};font-size:11px;line-height:16px;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
  }

  /**
   * Render labels as colored pills
   */
  private renderLabelsPills(fv: any): string {
    const labels = fv.labels || [];
    if (!labels || labels.length === 0) return "";

    return labels
      .slice(0, 3) // Limit to 3 labels
      .map((label: any) => {
        const name = label.name || "";
        const rawColor = label.color || label.colour || null;
        const p = normalizeColor(rawColor) || null;
        const hasHex = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p));
        const border = p || "#999999";
        const bg = (hasHex && addAlpha(p, 0.12)) || "rgba(0,0,0,0.06)";
        const fg = p || "#333333";

        return `<span class="board-pill" data-filter-field="Labels" data-filter-value="${escapeHtml(name)}" style="display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid ${escapeHtml(border)};background:${escapeHtml(bg)};color:${escapeHtml(fg)};font-size:11px;line-height:16px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span>`;
      })
      .join("");
  }

  /**
   * Render iteration with icon
   */
  private renderIterationPill(fv: any): string {
    const iteration = fv.iteration || fv;
    const title = iteration?.title || "";
    if (!title) return "";

    const icon = this.getIconSvg("iterations", 12);
    return `<span class="board-pill" data-filter-field="Iteration" data-filter-value="${escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(title)}">${icon}<span>${escapeHtml(title)}</span></span>`;
  }

  /**
   * Render milestone with icon
   */
  private renderMilestonePill(fv: any): string {
    const title = fv.milestone?.title || "";
    if (!title) return "";

    const icon = this.getIconSvg("milestone", 12);
    return `<span class="board-pill" data-filter-field="Milestone" data-filter-value="${escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(title)}">${icon}<span>${escapeHtml(title)}</span></span>`;
  }

  /**
   * Render repository with icon
   */
  private renderRepositoryPill(fv: any): string {
    const repo = fv.repository || fv;
    const name = repo?.nameWithOwner || repo?.name || "";
    if (!name) return "";

    const icon = this.getIconSvg("repo", 12);
    return `<span class="board-pill" data-filter-field="repo" data-filter-value="${escapeHtml(name)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;" title="${escapeHtml(name)}">${icon}<span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span></span>`;
  }

  /**
   * Render number field with field name
   */
  private renderNumberPill(fv: any): string {
    const value = fv.number;
    if (value == null || value === "") return "";

    const fieldName = this.getFieldName(fv);
    return `<span class="board-pill" data-filter-field="${escapeHtml(fieldName)}" data-filter-value="${escapeHtml(String(value))}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;"><span style="color:var(--vscode-descriptionForeground);">${escapeHtml(fieldName)}:</span><span>${escapeHtml(String(value))}</span></span>`;
  }

  /**
   * Render text field with field name
   */
  private renderTextPill(fv: any): string {
    const value = fv.text || "";
    if (!value) return "";

    const fieldName = this.getFieldName(fv);
    const truncated = String(value).slice(0, 30);
    return `<span class="board-pill" data-filter-field="${escapeHtml(fieldName)}" data-filter-value="${escapeHtml(value)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(value)}"><span style="color:var(--vscode-descriptionForeground);">${escapeHtml(fieldName)}:</span><span>${escapeHtml(truncated)}</span></span>`;
  }

  /**
   * Render date field with field name
   */
  private renderDatePill(fv: any): string {
    const dateValue = fv.date || fv.startDate || null;
    if (!dateValue) return "";

    const fieldName = this.getFieldName(fv);
    let formatted = dateValue;
    let filterVal = dateValue;
    try {
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        formatted = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        filterVal = d.toISOString().split("T")[0]; // YYYY-MM-DD
      }
    } catch (e) {
      // Use raw value
    }

    const icon = this.getIconSvg("calendar", 12);
    return `<span class="board-pill" data-filter-field="${escapeHtml(fieldName)}" data-filter-value="${escapeHtml(String(filterVal))}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;"><span style="color:var(--vscode-descriptionForeground);">${escapeHtml(fieldName)}:</span>${icon}<span>${escapeHtml(String(formatted))}</span></span>`;
  }

  /**
   * Render parent issue with colored pill (matching table view style)
   */
  private renderParentIssuePill(fv: any): string {
    const parent = fv.parent || fv.parentIssue || fv.issue || null;
    if (!parent) return "";

    const title = parent.title || parent.name || "";
    const number = parent.number || "";
    const url = parent.url || parent.html_url || "";
    if (!title && !number) return "";

    // Get color - try to find status color from parent issue look up
    let color = "#999999";
    let parentIsDoneByStatus = false;
    const completedNames = ["done", "closed", "completed", "finished"];

    // Try to find the parent item in allItems to get its Status
    let parentItem: any = null;
    if (this.allItems && this.allItems.length > 0) {
      const parentId = parent.id || (parent.raw && parent.raw.id);
      const parentUrl =
        parent.url || parent.html_url || (parent.raw && parent.raw.url);
      const parentNum = parent.number || (parent.raw && parent.raw.number);

      // Fuzzy match logic similar to strategies.ts
      parentItem = this.allItems.find((item: any) => {
        const c = item.content || (item.raw && item.raw.itemContent);
        if (!c) return false;
        if (parentId && String(c.id) === String(parentId)) return true;
        if (parentUrl && String(c.url) === String(parentUrl)) return true;
        if (parentNum && String(c.number) === String(parentNum)) {
          // Check repo match if possible
          const itemRepo = c.repository?.nameWithOwner || c.repository?.name;
          const parentRepo =
            parent.repository?.nameWithOwner || parent.repository?.name;
          if (itemRepo && parentRepo && itemRepo !== parentRepo) return false;
          return true;
        }
        return false;
      });

      if (parentItem && Array.isArray(parentItem.fieldValues)) {
        // Find status field
        // Find status field - robust check like strategies.ts
        const statusFv = parentItem.fieldValues.find(
          (d: any) =>
            d &&
            d.type === "single_select" &&
            ((d.raw &&
              d.raw.field &&
              String(d.raw.field.name || "").toLowerCase() === "status") ||
              (d.fieldName &&
                String(d.fieldName || "").toLowerCase() === "status") ||
              (d.field &&
                d.field.name &&
                String(d.field.name || "").toLowerCase() === "status")),
        );

        if (statusFv) {
          const foundColor =
            (statusFv.option &&
              (statusFv.option.color ||
                statusFv.option.id ||
                statusFv.option.name)) ||
            (statusFv.raw && statusFv.raw.color) ||
            null;

          if (foundColor) color = normalizeColor(foundColor) || color;

          if (statusFv.option && statusFv.option.name) {
            const optNameLower = String(statusFv.option.name).toLowerCase();
            if (completedNames.includes(optNameLower)) {
              parentIsDoneByStatus = true;
            }
          }
        }
      }
    }

    // Fallback to embedded color
    if (color === "#999999") {
      if (parent.statusColor) {
        color = normalizeColor(parent.statusColor) || color;
      } else if (parent.color) {
        color = normalizeColor(parent.color) || color;
      }
    }

    const p = color;
    const hasHex = !!(p && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p));
    const border = p || "#999999";
    const bg = (hasHex && addAlpha(p, 0.12)) || "rgba(0,0,0,0.06)";
    const fg = getContrastColor(p) || "#333333";

    // Determine icon (assume issue)
    let isClosed = String(parent.state || "").toUpperCase() === "CLOSED";
    if (parentIsDoneByStatus) isClosed = true;

    // Determine blocked status for parent
    let isBlocked = false;
    try {
      // Check specific blocked label
      const hasBlockedLabel = !!(
        parent.labels &&
        Array.isArray(parent.labels) &&
        parent.labels.some(
          (l: any) => String(l.name || "").toLowerCase() === "blocked",
        )
      );
      // Check parentItem dependency summary if available
      let blockedBy = 0;
      if (
        parentItem &&
        parentItem.content &&
        parentItem.content.issueDependenciesSummary
      ) {
        blockedBy = parentItem.content.issueDependenciesSummary.blockedBy || 0;
      }
      if (hasBlockedLabel || blockedBy > 0) isBlocked = true;
    } catch (e) { }

    const iconName = isClosed ? "issue-closed" : "issue-opened";
    const icon = this.getIconSvg(iconName, 12, p);

    const blockedOverlay = isBlocked
      ? `<span class='blocked-overlay' style='position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:999px;background:var(--vscode-editor-background);display:flex;align-items:center;justify-content:center;box-sizing:border-box;'>${this.getIconSvg("blocked", 9, "#dc3545")}</span>`
      : "";

    // Build pill similar to ParentIssueRenderer in strategies.ts
    let html = `<span class="board-pill" data-filter-field="parent" data-filter-value="${escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid ${escapeHtml(border)};border-radius:999px;background:${escapeHtml(bg)};color:${escapeHtml(fg)};font-size:11px;line-height:16px;max-width:150px;" title="${escapeHtml(title + (number ? " #" + number : ""))}"${url ? ` data-gh-open="${escapeHtml(url)}"` : ""}>`;
    html += `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}${blockedOverlay}</span>`;
    html += `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</span>`;
    if (number) {
      html += `<span style="flex-shrink:0;color:var(--vscode-descriptionForeground);">#${escapeHtml(String(number))}</span>`;
    }
    html += `</span>`;
    return html;
  }

  /**
   * Render linked pull requests
   */
  private renderLinkedPullRequests(fv: any): string {
    const prs = fv.pullRequests?.nodes || [];
    if (!prs || prs.length === 0) return "";

    return prs
      .map((pr: any) => {
        const title = pr.title || "#" + pr.number || "PR";
        const icon = this.getIconSvg("git-pull-request", 12);
        // Use generic pill style
        return `<span class="board-pill" data-filter-field="Linked Pull Requests" data-filter-value="${escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;border:1px solid var(--vscode-editorWidget-border);background:var(--vscode-input-background);font-size:11px;line-height:16px;white-space:nowrap;margin-right:2px;max-width:100px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(title)}">${icon}<span>${escapeHtml(title)}</span></span>`;
      })
      .join("");
  }

  /**
   * Render sub-issues progress bar
   */
  private renderSubIssuesProgress(item: any): HTMLElement | null {
    if (!item || !Array.isArray(item.fieldValues)) return null;

    const progressFv = item.fieldValues.find(
      (v: any) => v?.type === "sub_issues_progress",
    );

    if (!progressFv || !progressFv.total || Number(progressFv.total) <= 0) {
      return null;
    }

    const total = Math.max(0, Math.floor(Number(progressFv.total) || 0));
    const done = Math.max(0, Math.floor(Number(progressFv.done || 0)));
    if (total === 0) return null;

    const pct = Math.round((done / total) * 100);

    const container = document.createElement("div");
    container.className = "board-item-progress board-pill";
    container.setAttribute("data-filter-field", "parent");
    // Use item title as value (assuming 'item.title' or content.title exists from renderItem context)
    // renderItem extracts titleText. We need to access it here. item structure has title or content.title.
    const titleText =
      (item.content && (item.content.title || item.content.name)) ||
      item.title ||
      (item.raw && item.raw.title) ||
      "";
    container.setAttribute("data-filter-value", titleText);

    container.style.marginTop = "6px";
    container.title = `${done} of ${total} sub-issues complete (${pct}%) -- Click to filter by this parent`;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;width:100%;">
        <span style="font-size:11px;color:var(--vscode-descriptionForeground);font-variant-numeric:tabular-nums;min-width:30px;">${done}/${total}</span>
        <div style="flex:1;height:8px;border-radius:4px;border:1px solid var(--vscode-focusBorder);overflow:hidden;background:transparent;">
          <div style="height:100%;width:${pct}%;background:var(--vscode-focusBorder);"></div>
        </div>
        <span style="font-size:11px;color:var(--vscode-descriptionForeground);font-variant-numeric:tabular-nums;min-width:28px;text-align:right;">${pct}%</span>
      </div>
    `;

    return container;
  }

  /**
   * Group items by swimlane field value
   */
  public groupItemsBySwimlane(
    items: any[],
    swimlaneField: any,
  ): Map<string, { option: any; items: any[] }> {
    const groups = new Map<string, { option: any; items: any[] }>();
    const dataType = String(swimlaneField.dataType || "").toLowerCase();

    // Get all options from the field configuration
    let options: any[] = [];
    if (dataType === "single_select" && Array.isArray(swimlaneField.options)) {
      options = swimlaneField.options;
    } else if (
      dataType === "iteration" &&
      swimlaneField.configuration?.iterations
    ) {
      options = swimlaneField.configuration.iterations.map((it: any) => ({
        id: it.id,
        name: it.title,
        title: it.title,
        color: it.color || null,
        startDate: it.startDate,
        duration: it.duration,
      }));
    } else if (dataType === "assignees") {
      // Extract unique assignees from items
      const assigneeMap = new Map<string, any>();
      for (const item of items) {
        const assignees = this.extractAssignees(item);
        for (const a of assignees) {
          if (!assigneeMap.has(a.login)) {
            assigneeMap.set(a.login, a);
          }
        }
      }
      options = Array.from(assigneeMap.values()).map((a) => ({
        id: a.login,
        name: a.login,
        avatarUrl: a.avatarUrl,
        type: "assignee",
      }));
    } else if (dataType === "repository") {
      const repoMap = new Map<string, any>();
      for (const item of items) {
        const repo =
          item.content?.repository ||
          item.raw?.itemContent?.repository ||
          item.repository;
        if (repo && (repo.nameWithOwner || repo.name)) {
          const name = repo.nameWithOwner || repo.name;
          if (!repoMap.has(name)) {
            repoMap.set(name, repo);
          }
        }
      }
      options = Array.from(repoMap.values()).map((r) => ({
        id: r.nameWithOwner || r.name,
        name: r.nameWithOwner || r.name,
        type: "repository",
      }));
    } else if (dataType === "milestone") {
      const milestoneMap = new Map<string, any>();
      for (const item of items) {
        const fv = item.fieldValues?.find((v: any) => v.type === "milestone");
        if (fv?.milestone) {
          if (!milestoneMap.has(fv.milestone.id || fv.milestone.title)) {
            milestoneMap.set(
              fv.milestone.id || fv.milestone.title,
              fv.milestone,
            );
          }
        }
      }
      options = Array.from(milestoneMap.values()).map((m) => ({
        id: m.id || m.title,
        name: m.title,
        type: "milestone",
      }));
    } else if (dataType === "labels") {
      const labelMap = new Map<string, any>();
      for (const item of items) {
        const fv = item.fieldValues?.find((v: any) => v.type === "labels");
        if (fv?.labels?.nodes) {
          for (const l of fv.labels.nodes) {
            if (!labelMap.has(l.id || l.name)) {
              labelMap.set(l.id || l.name, l);
            }
          }
        }
      }
      options = Array.from(labelMap.values()).map((l) => ({
        id: l.id || l.name,
        name: l.name,
        color: l.color,
        type: "label",
      }));
    }

    // Initialize groups for each option in order
    for (const opt of options) {
      const key = String(opt.id || opt.name || "");
      if (key) {
        groups.set(key, { option: opt, items: [] });
      }
    }

    // Add "No value" group
    groups.set("__no_value__", {
      option: {
        id: "__no_value__",
        name: `No ${swimlaneField.name}`,
        color: null,
      },
      items: [],
    });

    // Assign items to groups
    for (const item of items) {
      let groupKey = "__no_value__";

      if (dataType === "assignees") {
        const assignees = this.extractAssignees(item);
        if (assignees.length > 0) {
          // GitHub usually puts items in multiple swimlanes if multiple assignees?
          // For simplicity, let's pick the first one or duplicate if we want to follow GH exactly.
          // GH usually shows the item in EACH swimlane.
          for (const a of assignees) {
            const key = a.login;
            if (groups.has(key)) {
              groups.get(key)!.items.push(item);
            }
          }
          continue; // Skip the default push below
        }
      } else if (dataType === "labels") {
        const fv = item.fieldValues?.find((v: any) => v.type === "labels");
        if (fv?.labels?.nodes && fv.labels.nodes.length > 0) {
          for (const l of fv.labels.nodes) {
            const key = String(l.id || l.name);
            if (groups.has(key)) {
              groups.get(key)!.items.push(item);
            }
          }
          continue;
        }
      } else if (dataType === "repository") {
        const repo =
          item.content?.repository ||
          item.raw?.itemContent?.repository ||
          item.repository;
        if (repo) {
          groupKey = repo.nameWithOwner || repo.name || "__no_value__";
        }
      } else if (dataType === "parent_issue") {
        const fv = item.fieldValues?.find((v: any) => v.type === "parent_issue" || String(v.fieldName).toLowerCase() === "parent");
        const p = fv?.parent || fv?.parentIssue || fv?.issue || fv?.item || fv?.value;
        if (p) {
          groupKey = String(p.number || p.id || p.title || "__no_value__");
        }
      } else if (Array.isArray(item.fieldValues)) {
        const fv = item.fieldValues.find(
          (v: any) =>
            String(v.fieldId) === String(swimlaneField.id) ||
            String(v.fieldName).toLowerCase() === String(swimlaneField.name).toLowerCase()
        );

        if (fv) {
          if (dataType === "single_select") {
            const optId = fv.optionId || (fv.option && fv.option.id);
            const optName = fv.name || (fv.option && fv.option.name);
            if (optId && groups.has(String(optId))) {
              groupKey = String(optId);
            } else if (optName) {
              for (const [key, group] of groups) {
                if (String(group.option.name).toLowerCase() === String(optName).toLowerCase()) {
                  groupKey = key;
                  break;
                }
              }
            }
          } else if (dataType === "iteration") {
            const itId = fv.iterationId || (fv.iteration && fv.iteration.id) || fv.id;
            const itTitle = fv.title || (fv.iteration && fv.iteration.title);
            if (itId && groups.has(String(itId))) {
              groupKey = String(itId);
            } else if (itTitle) {
              for (const [key, group] of groups) {
                if (String(group.option.title).toLowerCase() === String(itTitle).toLowerCase() ||
                  String(group.option.name).toLowerCase() === String(itTitle).toLowerCase()) {
                  groupKey = key;
                  break;
                }
              }
            }
          } else {
            // Text, Number, Date fallbacks
            const val = fv.text ?? fv.number ?? fv.date ?? fv.title ?? fv.value;
            if (val !== undefined && val !== null && val !== "") {
              groupKey = String(val);
            }
          }
        }
      }

      const normalizedKey = groups.has(groupKey) ? groupKey : "__no_value__";

      // If we don't have a pre-initialized group for this key (e.g. dynamic types like text/number), create it
      if (groupKey !== "__no_value__" && !groups.has(groupKey)) {
        groups.set(groupKey, {
          option: { id: groupKey, name: groupKey, title: groupKey },
          items: []
        });
      }

      groups.get(groups.has(groupKey) ? groupKey : "__no_value__")!.items.push(item);
    }

    return groups;
  }

  /**
   * Render a swimlane header (similar to GroupRenderer)
   */
  private renderSwimlaneHeader(
    option: any,
    items: any[],
    swimlaneField: any,
  ): HTMLElement {
    const header = document.createElement("div");
    header.className = "board-swimlane-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.padding = "8px 16px";
    header.style.top = "var(--board-headers-height, 72px)";
    header.style.zIndex = "20";
    header.style.cursor = "pointer";
    header.style.userSelect = "none";

    // Toggle Icon
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "swimlane-toggle-icon";
    toggleIcon.innerHTML = this.getIconSvg("triangle-down", 16);
    toggleIcon.style.opacity = "0.7";
    header.appendChild(toggleIcon);

    // Color dot or Avatar
    if (option.avatarUrl) {
      const avatar = document.createElement("img");
      avatar.src = option.avatarUrl;
      avatar.style.width = "20px";
      avatar.style.height = "20px";
      avatar.style.borderRadius = "50%";
      header.appendChild(avatar);
    } else if (option.type === "repository") {
      const repoIcon = document.createElement("span");
      repoIcon.innerHTML = this.getIconSvg("repo", 16);
      header.appendChild(repoIcon);
    } else {
      const colorDot = document.createElement("div");
      colorDot.style.width = "12px";
      colorDot.style.height = "12px";
      colorDot.style.borderRadius = "50%";
      colorDot.style.backgroundColor = normalizeColor(option.color) || "gray";
      header.appendChild(colorDot);
    }

    // Title
    const title = document.createElement("span");
    title.textContent = option.name || option.title || "Unassigned";
    header.appendChild(title);

    // Count
    const countCircle = document.createElement("span");
    countCircle.style.display = "inline-flex";
    countCircle.style.alignItems = "center";
    countCircle.style.justifyContent = "center";
    countCircle.style.minWidth = "22px";
    countCircle.style.height = "22px";
    countCircle.style.borderRadius = "50%";
    countCircle.style.background = "var(--vscode-input-background)";
    countCircle.style.border = "1px solid var(--vscode-panel-border)";
    countCircle.style.fontSize = "12px";
    countCircle.style.padding = "0 4px";
    countCircle.textContent = String(items.length);
    header.appendChild(countCircle);

    // Estimate Sum
    const estSum = this.sumEstimate(items);
    if (estSum > 0) {
      const estEl = document.createElement("div");
      estEl.style.padding = "2px 8px";
      estEl.style.borderRadius = "999px";
      estEl.style.border = "1px solid var(--vscode-panel-border)";
      estEl.style.background = "var(--vscode-input-background)";
      estEl.style.fontSize = "11px";
      estEl.textContent = "Estimate: " + this.formatEstimate(estSum);
      header.appendChild(estEl);
    }

    // Iteration Range
    if (String(swimlaneField.dataType || "").toLowerCase() === "iteration") {
      const range = this.getIterationRange(option);
      if (range) {
        const rangeEl = document.createElement("span");
        rangeEl.style.color = "var(--vscode-descriptionForeground)";
        rangeEl.style.fontSize = "12px";
        rangeEl.style.fontWeight = "400";
        rangeEl.textContent = range;
        header.appendChild(rangeEl);
      }
    }

    return header;
  }

  /**
   * Render the full board with all cards
   */
  public renderBoard(
    container: HTMLElement,
    columnField: any,
    swimlaneField?: any,
  ): void {
    // Inject styles for interactions
    const style = document.createElement("style");
    style.textContent = `
            * { box-sizing: border-box; }
            .board-item-menu-btn { opacity: 0; transition: opacity 0.2s; cursor: pointer; padding: 2px; border-radius: 4px; }
            .board-item-menu-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
            .board-item:hover .board-item-menu-btn { opacity: 1; }
            .board-pill { cursor: pointer; transition: opacity 0.2s; }
            .board-pill:hover { opacity: 0.8; }
            .board-swimlane { display: flex; flex-direction: column; }
            .board-swimlane-content { display: flex; gap: 16px; padding: 0 16px 16px 16px; align-items: stretch; }
            .board-container { display: flex; flex-direction: column; overflow: auto; height: 100%; width: 100%; }
            .board-column-headers { 
              display: flex; 
              gap: 16px; 
              padding: 16px 16px 0 16px; 
              position: sticky; 
              top: 0; 
              z-index: 30; 
              background: var(--vscode-editor-background); 
              align-items: stretch;
              border-bottom: 1px solid var(--vscode-panel-border);
            }
            .board-column-header { 
              width: 350px; 
              min-width: 350px; 
              flex-shrink: 0; 
              background: var(--vscode-sideBar-background);
              border: 1px solid var(--vscode-editorWidget-border);
              display: flex;
              flex-direction: column;
            }
            .board-column-items { 
              width: 350px; 
              min-width: 350px; 
              flex-shrink: 0; 
              display: flex; 
              flex-direction: column; 
              gap: 8px; 
              background: var(--vscode-editorWidget-background); 
              border: 1px solid var(--vscode-editorWidget-border); 
              padding: 8px; 
            }
            .board-swimlane-header {
              border-bottom: 1px solid var(--vscode-panel-border);
              background: var(--vscode-editor-background);
              position: sticky;
              z-index: 20;
              margin: 0;
            }
        `;
    container.appendChild(style);

    const board = document.createElement("div");
    board.className = "board-container";
    board.style.background = "var(--vscode-editor-background)";

    // Add event delegation for interactivity
    board.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Toggle swimlane
      const swimHeader = target.closest(".board-swimlane-header") as HTMLElement;
      if (swimHeader) {
        const swimlane = swimHeader.parentElement!;
        const content = swimlane.querySelector(
          ".board-swimlane-content",
        ) as HTMLElement;
        const toggleIcon = swimHeader.querySelector(".swimlane-toggle-icon")!;
        const isCollapsed = content.style.display === "none";
        content.style.display = isCollapsed ? "flex" : "none";
        toggleIcon.innerHTML = this.getIconSvg(
          isCollapsed ? "triangle-down" : "triangle-right",
          16,
        );
        return;
      }

      // Check for filterable pills
      const pill = target.closest("[data-filter-field]");
      if (pill) {
        const field = pill.getAttribute("data-filter-field");
        const value = pill.getAttribute("data-filter-value");
        if (field && value) {
          this.handlePillClick(e, field, value);
          return;
        }
      }

      // Check for menu button
      const menuBtn = target.closest(".board-item-menu-btn");
      if (menuBtn) {
        e.stopPropagation();
        e.preventDefault();
        const itemId = menuBtn.getAttribute("data-item-id");
        if (this.onAction && itemId) {
          const item = this.allItems.find(
            (i) => String(i.id) === String(itemId),
          ) || { id: itemId };
          const rect = menuBtn.getBoundingClientRect();
          this.onAction("open-menu", item, { x: rect.left, y: rect.bottom });
        }
        return;
      }
    });

    const columnGroups = this.groupItemsByColumn(this.allItems, columnField);
    const colOptions = Array.from(columnGroups.values());

    if (swimlaneField) {
      // Render TOP row of column headers
      const headersRow = document.createElement("div");
      headersRow.className = "board-column-headers js-board-headers";

      // Dynamic sticky top calculation
      const observer = new ResizeObserver(entries => {
        const height = entries[0]?.contentRect.height;
        if (height) {
          board.style.setProperty("--board-headers-height", `${height + 16}px`); // 16 for top padding only
        }
      });
      observer.observe(headersRow);

      for (const colGroup of colOptions) {
        if (
          colGroup.option.id === "__no_value__" &&
          colGroup.items.length === 0
        )
          continue;

        const colHeader = document.createElement("div");
        colHeader.className = "board-column-header";

        // Reuse card header logic but without the full card
        const header = this.renderColumnHeaderOnly(colGroup.option, colGroup.items, columnField);
        colHeader.appendChild(header);
        headersRow.appendChild(colHeader);
      }
      board.appendChild(headersRow);

      // Force initial style for divisors
      board.style.setProperty("--board-headers-height", "72px");

      // Render Swimlanes
      const swimlanes = this.groupItemsBySwimlane(this.allItems, swimlaneField);

      for (const [sKey, swimlane] of swimlanes) {
        if (sKey === "__no_value__" && swimlane.items.length === 0) continue;

        const swimContainer = document.createElement("div");
        swimContainer.className = "board-swimlane";

        const header = this.renderSwimlaneHeader(
          swimlane.option,
          swimlane.items,
          swimlaneField,
        );
        swimContainer.appendChild(header);

        const swimContent = document.createElement("div");
        swimContent.className = "board-swimlane-content";

        // Group items within this swimlane by column, but ensure we use the SAME columns as the top row
        const rowColumnItems = this.groupItemsByColumn(swimlane.items, columnField);

        for (const colGroup of colOptions) {
          if (
            colGroup.option.id === "__no_value__" &&
            colGroup.items.length === 0
          )
            continue;

          const colKey = String(colGroup.option.id || colGroup.option.name || "");
          const itemsInCol = rowColumnItems.get(colKey)?.items || [];

          const colItemsContainer = document.createElement("div");
          colItemsContainer.className = "board-column-items";

          // Container for items that will grow
          const itemsList = document.createElement("div");
          itemsList.style.display = "flex";
          itemsList.style.flexDirection = "column";
          itemsList.style.gap = "8px";
          itemsList.style.flex = "1";

          const columnColor = normalizeColor(colGroup.option.color) || "#666666";
          for (const item of itemsInCol) {
            itemsList.appendChild(this.renderItem(item, columnField, columnColor));
          }
          colItemsContainer.appendChild(itemsList);

          // Add footer (Add item button) to each column cell in the swimlane
          const footer = this.renderColumnFooterOnly(colGroup.option, columnField);
          footer.style.marginTop = "8px";
          footer.style.margin = "0 -8px -8px -8px"; // Offset container padding
          colItemsContainer.appendChild(footer);

          swimContent.appendChild(colItemsContainer);
        }

        swimContainer.appendChild(swimContent);
        board.appendChild(swimContainer);
      }
    } else {
      // Regular board view (single row of columns)
      const rowContent = document.createElement("div");
      rowContent.className = "board-swimlane-content";
      rowContent.style.height = "100%";

      for (const colGroup of colOptions) {
        if (
          colGroup.option.id === "__no_value__" &&
          colGroup.items.length === 0
        )
          continue;
        const card = this.renderCard(
          colGroup.option,
          colGroup.items,
          columnField,
        );
        rowContent.appendChild(card);
      }
      board.appendChild(rowContent);
    }

    container.appendChild(board);
  }
}
