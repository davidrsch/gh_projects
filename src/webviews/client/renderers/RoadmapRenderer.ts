import { escapeHtml, normalizeColor, addAlpha } from "../utils";
import { GroupDataService } from "../services/GroupDataService";
import { getIconSvg, getIconNameForDataType } from "../icons/iconRegistry";
import { renderCell } from "../renderers/cellRenderer";
import { setLoadingState, setErrorState } from "../utils/domUtils";

export type ZoomLevel = "month" | "quarter" | "year";

export class RoadmapRenderer {
    private zoomLevel: ZoomLevel = "month";
    private activeMarkers: string[] = ["milestones"]; // Toggles for "Milestones", Iteration IDs, Date Field IDs
    private activeSortFieldId: string | null = null; // null = "No sorting"
    private startDateFieldId: string | null = null;
    private endDateFieldId: string | null = null;
    private initializedFields: boolean = false;
    private collapsedGroups: Set<string> = new Set();
    private dayWidth: number = 24; // px per day
    private listWidth: number = 320; // px for the left list
    private scrollSyncing: boolean = false;
    private container: HTMLElement | null = null;
    private lastSnapshot: any = null;

    constructor(
        private items: any[],
        private allFields: any[],
        private visibleFieldIds: string[],
        private onFilter: (filter: string) => void,
        private onAction: (action: string, item: any, args: any) => void
    ) {
        this.updateZoomSettings();
    }

    public updateData(items: any[], fields: any[], visibleIds: string[]) {
        this.items = items;
        this.allFields = fields;
        this.visibleFieldIds = visibleIds;
    }

    private updateZoomSettings() {
        switch (this.zoomLevel) {
            case "month":
                this.dayWidth = 24; // dense week
                break;
            case "quarter":
                this.dayWidth = 8; // month view
                break;
            case "year":
                this.dayWidth = 2; // year view
                break;
            default:
                this.dayWidth = 24;
        }
    }

    public renderRoadmap(container: HTMLElement, snapshot: any) {
        this.container = container;
        this.lastSnapshot = snapshot;
        container.innerHTML = "";

        this.ensureStyles();

        container.className = "roadmap-root";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.height = "100%";
        container.style.background = "var(--vscode-editor-background)";

        // 1. Header with Controls
        const controlHeader = this.createControlHeader();
        container.appendChild(controlHeader);

        // 2. Main Content Area (Split Pane)
        const splitPane = document.createElement("div");
        splitPane.className = "roadmap-split-pane";
        splitPane.style.display = "flex";
        splitPane.style.flex = "1";
        splitPane.style.overflow = "hidden";
        splitPane.style.borderTop = "1px solid var(--vscode-panel-border)";
        container.appendChild(splitPane);

        // 3. Left Side: Items List
        const listContainer = document.createElement("div");
        listContainer.className = "roadmap-list-container";
        listContainer.style.width = this.listWidth + "px";
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.background = "var(--vscode-sideBar-background)";
        listContainer.style.borderRight = "1px solid var(--vscode-panel-border)";
        listContainer.style.flexShrink = "0";
        splitPane.appendChild(listContainer);

        const listHeader = document.createElement("div");
        listHeader.className = "roadmap-list-header";
        listHeader.style.height = "32px";
        listHeader.style.borderBottom = "1px solid var(--vscode-panel-border)";
        listHeader.style.padding = "0 12px";
        listHeader.style.display = "flex";
        listHeader.style.alignItems = "center";
        listHeader.style.fontWeight = "600";
        listHeader.style.fontSize = "11px";
        listHeader.style.textTransform = "uppercase";
        listHeader.style.background = "var(--vscode-sideBar-background)";
        listHeader.style.color = "var(--vscode-descriptionForeground)";
        listHeader.textContent = "Items";
        listContainer.appendChild(listHeader);

        const listView = document.createElement("div");
        listView.className = "roadmap-list-view";
        listView.style.flex = "1";
        listView.style.overflowY = "auto";
        listView.style.overflowX = "hidden";
        listContainer.appendChild(listView);

        // 4. Right Side: Timeline
        const timelineContainer = document.createElement("div");
        timelineContainer.className = "roadmap-timeline-container";
        timelineContainer.style.flex = "1";
        timelineContainer.style.display = "flex";
        timelineContainer.style.flexDirection = "column";
        timelineContainer.style.overflow = "hidden";
        splitPane.appendChild(timelineContainer);

        const gridHeader = this.createTimelineHeader();
        timelineContainer.appendChild(gridHeader);

        const gridView = document.createElement("div");
        gridView.className = "roadmap-grid-view";
        gridView.style.flex = "1";
        gridView.style.overflow = "auto";
        timelineContainer.appendChild(gridView);

        // Sync Scrolling
        listView.addEventListener("scroll", () => {
            if (!this.scrollSyncing) {
                this.scrollSyncing = true;
                gridView.scrollTop = listView.scrollTop;
                this.scrollSyncing = false;
            }
        });
        gridView.addEventListener("scroll", () => {
            if (!this.scrollSyncing) {
                this.scrollSyncing = true;
                listView.scrollTop = gridView.scrollTop;
                this.scrollSyncing = false;
            }
        });

        // 5. Determine Grouping and Sorting
        const groupByFields = snapshot?.details?.groupByFields?.nodes || [];
        const groupingField = this.allFields.find(f =>
            groupByFields.some((v: any) => String(v.id) === String(f.id) || v.name === f.name)
        );

        let itemsToRender = [...this.items];

        // Apply Sorting before grouping
        if (this.activeSortFieldId) {
            const sortField = this.allFields.find(f => String(f.id) === String(this.activeSortFieldId));
            if (sortField) {
                const isDateType = ["date", "iteration", "milestone"].includes((sortField.dataType || sortField.type || "").toLowerCase());
                itemsToRender.sort((a, b) => {
                    if (isDateType) {
                        const valA = this.getDateFieldValue(a, "start")?.getTime() || 0;
                        const valB = this.getDateFieldValue(b, "start")?.getTime() || 0;
                        return valA - valB;
                    }
                    const valA = a.fieldValues.find((v: any) => String(v.fieldId) === String(sortField.id))?.value || "";
                    const valB = b.fieldValues.find((v: any) => String(v.fieldId) === String(sortField.id))?.value || "";
                    if (typeof valA === "string" && typeof valB === "string") return valA.localeCompare(valB);
                    if (typeof valA === "number" && typeof valB === "number") return valA - valB;
                    return 0;
                });
            }
        }

        const groups = groupingField
            ? GroupDataService.groupItems(itemsToRender, groupingField)
            : [{ option: { name: "", id: "none" }, items: itemsToRender.map((it, idx) => ({ item: it, index: idx })) }];

        if (!this.initializedFields) {
            this.initDefaultDateFields();
            this.initializedFields = true;
        }

        this.renderGroups(listView, gridView, groups, groupingField);
    }

    private initDefaultDateFields() {
        const iterOrDateFields = this.allFields.filter(f => {
            const type = (f.dataType || f.type || "").toLowerCase();
            return type === "iteration" || type === "date";
        });
        if (!this.startDateFieldId) {
            const startField = iterOrDateFields.find(f => f.name.toLowerCase().includes("start")) || iterOrDateFields[0];
            if (startField) this.startDateFieldId = startField.id;
        }
        if (!this.endDateFieldId) {
            const endField = iterOrDateFields.find(f => f.name.toLowerCase().includes("end")) || iterOrDateFields[1] || iterOrDateFields[0];
            if (endField) this.endDateFieldId = endField.id;
        }
    }

    private ensureStyles() {
        if (document.getElementById("roadmap-styles")) return;
        const style = document.createElement("style");
        style.id = "roadmap-styles";
        style.textContent = `
            .roadmap-root, .roadmap-root * {
                box-sizing: border-box;
            }
            .roadmap-root {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                color: var(--vscode-foreground);
            }
            .roadmap-list-row, .roadmap-grid-row {
                transition: background 0.1s;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .roadmap-list-row:hover, .roadmap-grid-row:hover {
                background: var(--vscode-list-hoverBackground);
            }
            .roadmap-list-row {
                border-right: 1px solid var(--vscode-panel-border);
            }
            .roadmap-bar {
                transition: filter 0.2s, box-shadow 0.2s;
            }
            .roadmap-bar:hover {
                filter: brightness(1.1);
                cursor: pointer;
            }
            .roadmap-grid-view::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }
            .roadmap-grid-view::-webkit-scrollbar-thumb {
                background: var(--vscode-scrollbarSlider-background);
                border-radius: 6px;
                border: 3px solid transparent;
                background-clip: content-box;
            }
            .roadmap-grid-view::-webkit-scrollbar-thumb:hover {
                background: var(--vscode-scrollbarSlider-hoverBackground);
            }
            .roadmap-list-group-header, .roadmap-grid-group-header {
                z-index: 10;
                position: sticky;
                top: 0;
                background: var(--vscode-sideBar-background); /* Added background */
            }
            .roadmap-grid-header {
                height: 32px;
                flex: 0 0 auto;
                border-bottom: 1px solid var(--vscode-panel-border);
                background: var(--vscode-sideBar-background);
                position: sticky;
                top: 0;
                z-index: 20;
                overflow: hidden;
            }
            .gh-count-pill {
                font-weight: 500;
            }
            .roadmap-marker-label {
                position: absolute;
                top: 4px;
                padding: 2px 6px;
                background: #f1f8ff;
                color: #0366d6;
                border: 1px solid #0366d6;
                border-radius: 4px;
                font-size: 10px;
                white-space: nowrap;
                transform: translateX(-50%);
                z-index: 110;
            }
            .roadmap-marker-circle {
                position: absolute;
                top: 32px;
                left: -4px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #0366d6;
                z-index: 105;
                transform: translateY(-50%);
            }
            .roadmap-marker-triangle {
                position: absolute;
                top: 0;
                left: -6px;
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 8px solid var(--vscode-descriptionForeground);
                z-index: 105;
            }
        `;
        document.head.appendChild(style);
    }

    private createControlHeader(): HTMLElement {
        const header = document.createElement("div");
        header.className = "roadmap-controls";
        header.style.height = "48px";
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.padding = "0 16px";
        header.style.background = "var(--vscode-editor-background)";

        const leftLabel = document.createElement("div");
        leftLabel.style.fontWeight = "600";
        leftLabel.style.fontSize = "14px";
        leftLabel.textContent = "Roadmap";
        header.appendChild(leftLabel);

        const spacer = document.createElement("div");
        spacer.style.flex = "1";
        header.appendChild(spacer);

        const btnStyleBase = `
            background: transparent;
            border: 1px solid transparent;
            color: var(--vscode-foreground);
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            height: 32px;
            transition: all 0.2s;
        `;

        const createControlBtn = (label: string, icon: string, onClick: (e: MouseEvent) => void, hasDropdown = false) => {
            const btn = document.createElement("button");
            btn.style.cssText = btnStyleBase;
            const iconSvg = icon ? getIconSvg(icon as any, { size: 16, fill: "var(--vscode-descriptionForeground)" }) : "";
            const dropdownSvg = hasDropdown ? getIconSvg("triangle-down", { size: 12, fill: "var(--vscode-descriptionForeground)" }) : "";
            btn.innerHTML = `${iconSvg} <span style="font-weight: 500;">${label}</span> ${dropdownSvg}`;
            btn.onclick = onClick;
            btn.onmouseenter = () => {
                btn.style.background = "var(--vscode-toolbar-hoverBackground)";
                btn.style.borderColor = "var(--vscode-panel-border)";
            };
            btn.onmouseleave = () => {
                btn.style.background = "transparent";
                btn.style.borderColor = "transparent";
            };
            return btn;
        };

        const tools = document.createElement("div");
        tools.style.display = "flex";
        tools.style.alignItems = "center";
        tools.style.gap = "4px";
        header.appendChild(tools);

        tools.appendChild(createControlBtn("Markers", "location", (e) => this.showMarkersMenu(e), true));
        tools.appendChild(createControlBtn("Sort", "arrow-up-down", (e) => this.showSortMenu(e), true));
        tools.appendChild(createControlBtn("Date fields", "calendar", (e) => this.showDateFieldsMenu(e), true));

        const zoomLabel = this.zoomLevel.charAt(0).toUpperCase() + this.zoomLevel.slice(1);
        tools.appendChild(createControlBtn(zoomLabel, "zoom-in", (e) => this.showZoomMenu(e), true));

        const todayBtn = document.createElement("button");
        todayBtn.style.cssText = btnStyleBase;
        todayBtn.style.fontWeight = "600";
        todayBtn.style.marginRight = "4px";
        todayBtn.textContent = "Today";
        todayBtn.onclick = () => {
            const gridView = this.container?.querySelector(".roadmap-grid-view") as HTMLElement;
            if (gridView) {
                const today = new Date();
                const start = this.getTimelineStart();
                const todayOffset = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) * this.dayWidth;
                gridView.scrollLeft = todayOffset - (gridView.clientWidth / 2);
            }
        };
        tools.appendChild(todayBtn);

        const navGroup = document.createElement("div");
        navGroup.style.display = "flex";
        navGroup.style.gap = "2px";

        const prevBtn = createControlBtn("", "chevron-left", () => {
            const gridView = this.container?.querySelector(".roadmap-grid-view") as HTMLElement;
            if (gridView) gridView.scrollLeft -= 200;
        });
        const nextBtn = createControlBtn("", "chevron-right", () => {
            const gridView = this.container?.querySelector(".roadmap-grid-view") as HTMLElement;
            if (gridView) gridView.scrollLeft += 200;
        });
        navGroup.appendChild(prevBtn);
        navGroup.appendChild(nextBtn);
        tools.appendChild(navGroup);

        return header;
    }

    private showMarkersMenu(e: MouseEvent) {
        const options: { id: string; label: string; icon?: string }[] = [{ id: "milestones", label: "Milestones", icon: "milestone" }];
        this.allFields.forEach(f => {
            const type = (f.dataType || f.type || "").toLowerCase();
            if (type === "iteration" || type === "date") {
                options.push({ id: f.id, label: f.name, icon: getIconNameForDataType(type) });
            }
        });
        this.showDropdown(e.currentTarget as HTMLElement, options, this.activeMarkers, (id) => {
            if (this.activeMarkers.includes(id)) this.activeMarkers = this.activeMarkers.filter(m => m !== id);
            else this.activeMarkers.push(id);
            this.renderRoadmap(this.container!, this.lastSnapshot);
        }, true);
    }

    private showSortMenu(e: MouseEvent) {
        const options: { id: string | null; label: string; icon?: string }[] = [{ id: null, label: "No sorting" }];
        this.allFields.forEach(f => {
            const icon = getIconNameForDataType(f.dataType || f.type);
            options.push({ id: f.id, label: f.name, icon });
        });
        this.showDropdown(e.currentTarget as HTMLElement, options, [this.activeSortFieldId], (id) => {
            this.activeSortFieldId = id;
            this.renderRoadmap(this.container!, this.lastSnapshot);
        });
    }

    private showDateFieldsMenu(e: MouseEvent) {
        const iterAndDateFields = this.allFields.filter(f => {
            const type = (f.dataType || f.type || "").toLowerCase();
            return type === "iteration" || type === "date";
        });
        const menu = document.createElement("div");
        menu.className = "roadmap-dropdown-menu";
        menu.style.cssText = `position: fixed; z-index: 1000; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; padding: 8px 0; font-size: 13px; max-height: 400px; overflow-y: auto;`;

        const renderSection = (title: string, currentId: string | null, onSelect: (id: string) => void, isLast = false) => {
            const header = document.createElement("div");
            header.style.padding = "4px 12px"; header.style.fontWeight = "600"; header.style.color = "var(--vscode-descriptionForeground)"; header.style.fontSize = "11px";
            header.textContent = title;
            menu.appendChild(header);

            iterAndDateFields.forEach(f => {
                const item = document.createElement("div");
                item.style.padding = "6px 12px 6px 32px"; item.style.cursor = "pointer"; item.style.position = "relative"; item.style.display = "flex"; item.style.alignItems = "center";
                item.onmouseenter = () => item.style.background = "var(--vscode-menu-selectionBackground)";
                item.onmouseleave = () => item.style.background = "transparent";

                const typeArr = (f.dataType || f.type || "").toLowerCase();
                const icon = getIconNameForDataType(typeArr);
                const sectionLower = title.toLowerCase();
                const suffix = sectionLower.includes("start") ? "start" : "end";
                const label = typeArr === "iteration" ? `${f.name} ${suffix}` : f.name;

                item.innerHTML = `
                    <div class="roadmap-dropdown-check" style="position:absolute; left:10px; display:${f.id === currentId ? "block" : "none"}">
                        ${getIconSvg("check", { size: 14, fill: "var(--vscode-menu-foreground)" })}
                    </div>
                    <div style="margin-right:8px; display:flex; align-items:center;">
                        ${getIconSvg(icon as any, { size: 14, fill: "var(--vscode-descriptionForeground)" })}
                    </div>
                    <span>${label}</span>
                `;
                item.onclick = () => { onSelect(f.id); if (document.body.contains(menu)) document.body.removeChild(menu); this.renderRoadmap(this.container!, this.lastSnapshot); };
                menu.appendChild(item);
            });

            if (!isLast) {
                const divider = document.createElement("div");
                divider.style.height = "1px"; divider.style.background = "var(--vscode-menu-border)"; divider.style.margin = "4px 0";
                menu.appendChild(divider);
            }
        };

        renderSection("Start date", this.startDateFieldId, (id) => this.startDateFieldId = id);
        renderSection("End date", this.endDateFieldId, (id) => this.endDateFieldId = id, true);

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + "px";
        menu.style.right = (window.innerWidth - rect.right) + "px";

        const closer = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node)) {
                if (document.body.contains(menu)) document.body.removeChild(menu);
                window.removeEventListener("mousedown", closer);
            }
        };
        setTimeout(() => window.addEventListener("mousedown", closer), 0);
        document.body.appendChild(menu);
    }

    private showZoomMenu(e: MouseEvent) {
        const options: { id: ZoomLevel; label: string }[] = [
            { id: "month", label: "Month" },
            { id: "quarter", label: "Quarter" },
            { id: "year", label: "Year" }
        ];
        this.showDropdown(e.currentTarget as HTMLElement, options, [this.zoomLevel], (id) => {
            this.zoomLevel = id as ZoomLevel;
            this.updateZoomSettings();
            this.renderRoadmap(this.container!, this.lastSnapshot);
        });
    }

    private showDropdown(anchor: HTMLElement, options: { id: any; label: string; icon?: string }[], activeIds: any[], onSelect: (id: any) => void, multi = false) {
        const menu = document.createElement("div");
        menu.className = "roadmap-dropdown-menu";
        menu.style.cssText = `position: fixed; z-index: 1000; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; padding: 4px 0; font-size: 13px; max-height: 400px; overflow-y: auto;`;

        options.forEach(opt => {
            const item = document.createElement("div");
            item.style.padding = "6px 12px 6px 32px"; item.style.cursor = "pointer"; item.style.position = "relative"; item.style.display = "flex"; item.style.alignItems = "center";
            item.onmouseenter = () => item.style.background = "var(--vscode-menu-selectionBackground)";
            item.onmouseleave = () => item.style.background = "transparent";

            const isSelected = activeIds.includes(opt.id);
            item.innerHTML = `
                <div class="roadmap-dropdown-check" style="position:absolute; left:10px; display:${isSelected ? "block" : "none"}">
                    ${getIconSvg("check", { size: 14, fill: "var(--vscode-menu-foreground)" })}
                </div>
                ${opt.icon ? `<div style="margin-right:8px; display:flex; align-items:center;">${getIconSvg(opt.icon as any, { size: 14, fill: "var(--vscode-descriptionForeground)" })}</div>` : ""}
                <span>${opt.label}</span>
            `;

            item.onclick = (ev) => {
                onSelect(opt.id);
                if (!multi) {
                    if (document.body.contains(menu)) document.body.removeChild(menu);
                } else {
                    const check = item.querySelector(".roadmap-dropdown-check") as HTMLElement;
                    if (check) check.style.display = check.style.display === "none" ? "block" : "none";
                }
                ev.stopPropagation();
            };
            menu.appendChild(item);
        });

        const rect = anchor.getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + "px";
        menu.style.right = (window.innerWidth - rect.right) + "px";

        const closer = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node)) {
                if (document.body.contains(menu)) document.body.removeChild(menu);
                window.removeEventListener("mousedown", closer);
            }
        };
        setTimeout(() => window.addEventListener("mousedown", closer), 0);
        document.body.appendChild(menu);
    }

    private getTimelineStart(): Date {
        const dates = this.items.flatMap(it => [this.getDateFieldValue(it, "start"), this.getDateFieldValue(it, "end")]).filter(d => !!d);
        let start = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    private createTimelineHeader(): HTMLElement {
        const header = document.createElement("div");
        header.className = "roadmap-grid-header";
        header.style.height = "32px";
        header.style.borderBottom = "1px solid var(--vscode-panel-border)";
        header.style.position = "sticky";
        header.style.top = "0";
        header.style.zIndex = "20";
        header.style.background = "var(--vscode-sideBar-background)";
        header.style.display = "flex";
        header.style.overflow = "hidden";
        return header;
    }

    private renderGroups(listView: HTMLElement, gridView: HTMLElement, groups: any[], groupingField: any) {
        listView.innerHTML = "";
        gridView.innerHTML = "";

        const gridContent = document.createElement("div");
        gridContent.className = "roadmap-grid-content";
        gridContent.style.position = "relative";
        gridView.appendChild(gridContent);

        const start = this.getTimelineStart();
        const dates = this.items.flatMap(it => [this.getDateFieldValue(it, "start"), this.getDateFieldValue(it, "end")]).filter(d => !!d);

        let end = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
        const futureMonths = this.zoomLevel === "year" ? 12 : 6;
        end.setMonth(end.getMonth() + futureMonths);
        end.setDate(1);
        end.setHours(0, 0, 0, 0);

        const totalWidth = this.calculateOffset(end, start);
        gridContent.style.width = totalWidth + "px";

        const gridHeader = this.container?.querySelector(".roadmap-grid-header") as HTMLElement;
        gridHeader.innerHTML = "";
        const headerScroll = document.createElement("div");
        headerScroll.style.width = totalWidth + "px";
        headerScroll.style.flexShrink = "0";
        headerScroll.style.display = "flex";
        headerScroll.style.height = "100%";
        gridHeader.appendChild(headerScroll);

        const gridLines = document.createElement("div");
        gridLines.className = "roadmap-grid-lines";
        gridLines.style.position = "absolute";
        gridLines.style.top = "0"; gridLines.style.left = "0"; gridLines.style.height = "100%"; gridLines.style.width = "100%"; gridLines.style.pointerEvents = "none"; gridLines.style.zIndex = "0";
        gridContent.appendChild(gridLines);

        let iter = new Date(start);
        while (iter < end) {
            const mStart = new Date(iter);
            const mEnd = new Date(iter.getFullYear(), iter.getMonth() + 1, 1);
            const mStartOffset = this.calculateOffset(mStart, start);
            const mEndOffset = this.calculateOffset(mEnd, start);
            const mWidth = mEndOffset - mStartOffset;

            const m = document.createElement("div");
            m.className = "roadmap-month-label";
            m.style.flex = `0 0 ${mWidth}px`;
            m.style.borderRight = "1px solid var(--vscode-panel-border)";
            m.style.background = "var(--vscode-sideBar-background)";
            m.style.fontSize = "12px"; m.style.padding = "7px 12px"; m.style.fontWeight = "600"; m.style.color = "var(--vscode-foreground)";
            let label = (this.zoomLevel === "year") ? iter.toLocaleDateString("default", { month: "short" }) : iter.toLocaleDateString("default", { month: "long", year: "numeric" });
            if (this.zoomLevel === "year" && iter.getMonth() === 0) label = iter.getFullYear().toString();
            m.textContent = label;
            headerScroll.appendChild(m);

            const line = document.createElement("div");
            line.style.position = "absolute";
            line.style.left = mStartOffset + "px";
            line.style.height = "100%"; line.style.borderLeft = "1px solid var(--vscode-panel-border)"; line.style.opacity = "0.2";
            gridLines.appendChild(line);
            iter = mEnd;
        }

        this.renderMarkers(gridContent, start, end);
        gridView.onscroll = () => { gridHeader.scrollLeft = gridView.scrollLeft; };

        const rowHeight = 40;
        let globalIndex = 1;

        groups.forEach(group => {
            const groupId = String(group.option.id || "unassigned");
            const isCollapsed = this.collapsedGroups.has(groupId);

            const listGroupHeader = document.createElement("div");
            listGroupHeader.className = "roadmap-list-group-header";
            listGroupHeader.style.height = "32px"; listGroupHeader.style.display = "flex"; listGroupHeader.style.alignItems = "center"; listGroupHeader.style.padding = "0 8px"; listGroupHeader.style.background = "var(--vscode-sideBar-background)"; listGroupHeader.style.borderBottom = "1px solid var(--vscode-panel-border)"; listGroupHeader.style.zIndex = "10"; listGroupHeader.style.position = "sticky"; listGroupHeader.style.top = "0";

            const toggleIconName = isCollapsed ? "triangle-right" : "triangle-down";
            const toggleIcon = getIconSvg(toggleIconName, { size: 16, fill: "var(--vscode-descriptionForeground)" });
            const color = normalizeColor(group.option.color) || "#848d97";
            const groupIcon = `<div style="width:12px; height:12px; border-radius:50%; background:${color}; margin: 0 8px; border: 1px solid ${addAlpha(color, 0.4)}"></div>`;

            if (groupingField) {
                listGroupHeader.innerHTML = `
                    <div class="roadmap-group-toggle" style="cursor:pointer; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${toggleIcon}</div>
                    ${groupIcon}
                    <span style="font-weight:600; font-size:13px; margin-right:8px;">${group.option.name || "Unassigned"}</span>
                    <span class="gh-count-pill" style="background:${addAlpha(color, 0.15)}; color:${color}; border: 1px solid ${addAlpha(color, 0.3)}; border-radius:10px; padding:2px 8px; font-size:11px; font-weight:600;">${group.items.length}</span>
                `;
                listGroupHeader.querySelector(".roadmap-group-toggle")!.addEventListener("click", () => {
                    if (isCollapsed) this.collapsedGroups.delete(groupId); else this.collapsedGroups.add(groupId);
                    this.renderRoadmap(this.container!, this.lastSnapshot);
                });
                listView.appendChild(listGroupHeader);

                const gridGroupHeader = document.createElement("div");
                gridGroupHeader.className = "roadmap-grid-group-header";
                gridGroupHeader.style.height = "32px"; gridGroupHeader.style.borderBottom = "1px solid var(--vscode-panel-border)"; gridGroupHeader.style.background = "var(--vscode-sideBar-background)";
                gridContent.appendChild(gridGroupHeader);
            }

            if (!isCollapsed) {
                group.items.forEach((gi: any) => {
                    const item = gi.item;
                    const listRow = document.createElement("div");
                    listRow.className = "roadmap-list-row";
                    listRow.style.height = rowHeight + "px"; listRow.style.display = "flex"; listRow.style.alignItems = "center"; listRow.style.padding = "0";

                    const rowNum = document.createElement("div");
                    rowNum.style.width = "40px"; rowNum.style.textAlign = "center"; rowNum.style.fontSize = "11px"; rowNum.style.color = "var(--vscode-descriptionForeground)";
                    rowNum.textContent = String(globalIndex++);
                    listRow.appendChild(rowNum);

                    const contentWrapper = document.createElement("div");
                    contentWrapper.style.display = "flex"; contentWrapper.style.alignItems = "center"; contentWrapper.style.flex = "1"; contentWrapper.style.overflow = "hidden"; contentWrapper.style.padding = "0 8px"; contentWrapper.style.gap = "8px";

                    const titleField = this.allFields.find(f => f.name.toLowerCase() === "title");
                    const titleFv = item.fieldValues.find((v: any) => v.fieldId === titleField?.id) || { value: item.title, type: "title" };
                    const assigneesField = this.allFields.find(f => (f.dataType || f.type || "").toLowerCase() === "assignees");
                    const assigneesFv = item.fieldValues.find((v: any) => v.fieldId === assigneesField?.id);

                    contentWrapper.innerHTML = `<div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1;">${renderCell(titleFv, titleField, item, this.items)}</div>`;
                    listRow.appendChild(contentWrapper);
                    listView.appendChild(listRow);

                    const gridRow = document.createElement("div");
                    gridRow.className = "roadmap-grid-row";
                    gridRow.style.height = rowHeight + "px"; gridRow.style.position = "relative";
                    gridContent.appendChild(gridRow);

                    listRow.onmouseenter = () => gridRow.style.background = "var(--vscode-list-hoverBackground)";
                    listRow.onmouseleave = () => gridRow.style.background = "transparent";
                    gridRow.onmouseenter = () => listRow.style.background = "var(--vscode-list-hoverBackground)";
                    gridRow.onmouseleave = () => listRow.style.background = "transparent";

                    const iStart = this.getDateFieldValue(item, "start");
                    const iEnd = this.getDateFieldValue(item, "end");
                    if (iStart) {
                        const startOffset = this.calculateOffset(iStart, start);
                        const duration = iEnd ? Math.max(1, Math.round((iEnd.getTime() - iStart.getTime()) / (1000 * 60 * 60 * 24))) : 14;
                        const barWidth = Math.max(40, duration * this.dayWidth);
                        const bar = document.createElement("div");
                        bar.className = "roadmap-bar";
                        bar.style.position = "absolute"; bar.style.left = startOffset + "px"; bar.style.top = "6px"; bar.style.height = "28px"; bar.style.minWidth = barWidth + "px"; bar.style.background = "var(--vscode-sideBar-background)"; bar.style.border = "1px solid var(--vscode-panel-border)"; bar.style.borderRadius = "14px"; bar.style.display = "flex"; bar.style.alignItems = "center"; bar.style.zIndex = "2"; bar.style.fontSize = "12px"; bar.style.overflow = "hidden";

                        const iStartStr = iStart.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                        const iEndStr = iEnd ? iEnd.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "No end date";
                        bar.title = `${item.title || "Item"} (${iStartStr} - ${iEndStr})`;

                        const stickyContent = document.createElement("div");
                        stickyContent.style.position = "sticky"; stickyContent.style.left = "0"; stickyContent.style.padding = "0 8px"; stickyContent.style.display = "flex"; stickyContent.style.alignItems = "center"; stickyContent.style.gap = "6px"; stickyContent.style.whiteSpace = "nowrap"; stickyContent.style.width = "100%";

                        // For the bar, we only show avatars if available, otherwise just title
                        // This matches "avatar should appear ONLY on the line element" (interpreted as no text for assignees on the bar)
                        const avatarOnlyRenderer = (fv: any, field: any) => {
                            if (!fv || (field?.dataType || field?.type)?.toLowerCase() !== "assignees") return renderCell(fv, field, item, this.items);
                            const assignees = fv.assignees || [];
                            if (assignees.length === 0) return "";
                            // Extract just the avatar part from AssigneesRenderer logic or roughly reimplement
                            return `<div style="display:flex; align-items:center;">${renderCell(fv, field, item, this.items).split('</span></span>')[0]}</span></span></div>`;
                        };

                        stickyContent.innerHTML = `<div style="display:flex; align-items:center; gap:6px; overflow:hidden;">${renderCell(titleFv, titleField, item, this.items)}</div>${assigneesFv ? `<div style="margin-left:auto; display:flex;">${avatarOnlyRenderer(assigneesFv, assigneesField)}</div>` : ""}`;
                        bar.appendChild(stickyContent);
                        if (item.url) bar.onclick = () => this.onAction("openUrl", item, {});
                        gridRow.appendChild(bar);
                    }
                });

                const addItemRow = document.createElement("div");
                addItemRow.style.height = "32px"; addItemRow.style.display = "flex"; addItemRow.style.alignItems = "center"; addItemRow.style.padding = "0 8px"; addItemRow.style.cursor = "pointer"; addItemRow.style.color = "var(--vscode-descriptionForeground)";
                const plusIcon = getIconSvg("plus", { size: 16, fill: "currentColor" });
                addItemRow.innerHTML = `<div style="width:40px; display:flex; justify-content:center;">${plusIcon}</div><span style="font-size:13px; opacity: 0.8;">Add item</span>`;
                addItemRow.onclick = () => this.onAction("addItem", { groupId: group.option.id }, {});
                listView.appendChild(addItemRow);

                const gridAddRow = document.createElement("div");
                gridAddRow.className = "roadmap-grid-row";
                gridAddRow.style.height = "32px"; gridAddRow.style.borderBottom = "1px solid var(--vscode-panel-border)";
                gridContent.appendChild(gridAddRow);
                addItemRow.onmouseenter = () => gridAddRow.style.background = "var(--vscode-list-hoverBackground)";
                addItemRow.onmouseleave = () => gridAddRow.style.background = "transparent";
            }
        });
    }

    private getDateFieldValue(item: any, type: "start" | "end"): Date | null {
        const fieldId = type === "start" ? this.startDateFieldId : this.endDateFieldId;
        const field = fieldId ? this.allFields.find(f => String(f.id) === String(fieldId)) : null;
        if (!field) return null;

        const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(field.id));
        if (!fv) return null;

        let date: Date | null = null;
        if (fv.date) {
            date = new Date(fv.date);
        } else if (fv.iterationId && field.configuration?.iterations) {
            const iter = field.configuration.iterations.find((i: any) => i.id === fv.iterationId);
            if (iter) {
                date = new Date(iter.startDate);
                if (type === "end") {
                    date.setDate(date.getDate() + (iter.duration || 14));
                }
            }
        }

        if (date) {
            date.setHours(0, 0, 0, 0); // Normalize to midnight
        }
        return date;
    }

    private calculateOffset(date: Date, start: Date): number {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        const diff = d.getTime() - s.getTime();
        return Math.round(diff / (1000 * 60 * 60 * 24)) * this.dayWidth;
    }

    public applyFilter(matchedIds: Set<string>) {
        if (!this.container) return;
        const rows = this.container.querySelectorAll("[data-gh-item-id]");
        rows.forEach(r => {
            const el = r as HTMLElement; const id = el.getAttribute("data-gh-item-id");
            if (id) el.style.display = matchedIds.has(id) ? "flex" : "none";
        });
    }

    private renderMarkers(gridContent: HTMLElement, start: Date, end: Date) {
        // 1. Today Marker (Always active for now, or tied to milestones toggle)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today >= start && today <= end) {
            const todayOffset = this.calculateOffset(today, start);
            const markerLine = document.createElement("div");
            markerLine.style.position = "absolute"; markerLine.style.left = (todayOffset - 1) + "px"; markerLine.style.top = "0"; markerLine.style.height = "100%"; markerLine.style.width = "2px"; markerLine.style.background = "#fd8c73"; markerLine.style.zIndex = "100"; markerLine.style.pointerEvents = "none";
            gridContent.appendChild(markerLine);
            const nub = document.createElement("div");
            nub.style.position = "absolute"; nub.style.top = "-4px"; nub.style.left = "-3px"; nub.style.width = "8px"; nub.style.height = "8px"; nub.style.borderRadius = "50%"; nub.style.background = "#fd8c73";
            markerLine.appendChild(nub);
        }

        // 2. Milestone Markers
        if (this.activeMarkers.includes("milestones")) {
            const milestoneField = this.allFields.find(f => {
                const type = (f.dataType || f.type || "").toLowerCase();
                return type === "milestone" || f.name.toLowerCase() === "milestone";
            });
            const milestones = new Map<string, Date>();

            this.items.forEach(item => {
                const fv = item.fieldValues.find((v: any) => v.fieldId === milestoneField?.id);
                if (fv?.milestone?.dueDate) {
                    milestones.set(fv.milestone.id, new Date(fv.milestone.dueDate));
                }
            });

            milestones.forEach((date) => {
                date.setHours(0, 0, 0, 0);
                if (date >= start && date <= end) {
                    const offset = this.calculateOffset(date, start);
                    const line = document.createElement("div");
                    line.style.position = "absolute"; line.style.left = offset + "px"; line.style.top = "0"; line.style.height = "100%"; line.style.borderLeft = "1px dashed var(--vscode-descriptionForeground)"; line.style.zIndex = "10"; line.style.pointerEvents = "none";
                    gridContent.appendChild(line);

                    const diamond = document.createElement("div");
                    diamond.style.position = "absolute"; diamond.style.top = "0"; diamond.style.left = "-4px"; diamond.style.width = "8px"; diamond.style.height = "8px"; diamond.style.background = "var(--vscode-descriptionForeground)"; diamond.style.transform = "rotate(45deg)"; diamond.style.zIndex = "11";
                    line.appendChild(diamond);
                }
            });
        }

        // 3. Iteration Boundaries and Date Field Markers
        this.activeMarkers.forEach(markerId => {
            const field = this.allFields.find(f => String(f.id) === String(markerId));
            if (!field) return;

            const type = (field.dataType || field.type || "").toLowerCase();
            if (type === "iteration" && field.configuration?.iterations) {
                field.configuration.iterations.forEach((iter: any) => {
                    const iStart = new Date(iter.startDate);
                    iStart.setHours(0, 0, 0, 0);
                    if (iStart >= start && iStart <= end) {
                        const offset = this.calculateOffset(iStart, start);
                        const line = document.createElement("div");
                        line.style.position = "absolute"; line.style.left = offset + "px"; line.style.top = "0"; line.style.height = "100%"; line.style.borderLeft = "2px solid #0366d6"; line.style.opacity = "0.7"; line.style.zIndex = "10"; line.style.pointerEvents = "none";
                        gridContent.appendChild(line);

                        const circle = document.createElement("div");
                        circle.className = "roadmap-marker-circle";
                        line.appendChild(circle);

                        const label = document.createElement("div");
                        label.className = "roadmap-marker-label";
                        const iStartStr = iStart.toLocaleDateString([], { month: "short", day: "numeric" });
                        const iEnd = new Date(iStart);
                        iEnd.setDate(iEnd.getDate() + (iter.duration || 14));
                        const iEndStr = iEnd.toLocaleDateString([], { month: "short", day: "numeric" });
                        label.textContent = `${iter.title || iter.name || "Iteration"} (${iStartStr} - ${iEndStr})`;
                        line.appendChild(label);
                    }
                });
            } else if (type === "date") {
                const uniqueDates = new Set<string>();
                this.items.forEach(item => {
                    const fv = item.fieldValues.find((v: any) => String(v.fieldId) === String(field.id));
                    if (fv?.date) uniqueDates.add(fv.date);
                });

                uniqueDates.forEach(dateStr => {
                    const d = new Date(dateStr);
                    d.setHours(0, 0, 0, 0);
                    if (!isNaN(d.getTime()) && d >= start && d <= end) {
                        const offset = this.calculateOffset(d, start);
                        const line = document.createElement("div");
                        line.style.position = "absolute"; line.style.left = offset + "px"; line.style.top = "0"; line.style.height = "100%"; line.style.borderLeft = "1px solid var(--vscode-descriptionForeground)"; line.style.opacity = "0.4"; line.style.zIndex = "10"; line.style.pointerEvents = "none";
                        gridContent.appendChild(line);

                        const triangle = document.createElement("div");
                        triangle.className = "roadmap-marker-triangle";
                        line.appendChild(triangle);
                    }
                });
            }
        });
    }
}
