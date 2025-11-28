/**
 * Slice Panel Component
 * Shows unique values for a field with counts, allowing quick filtering
 */

import { normalizeColor, escapeHtml } from '../utils';

export class SlicePanel {
    private container: HTMLElement;
    private field: any;
    private items: any[];
    private panelElement: HTMLElement | null = null;
    private onValueSelectCallback?: (value: any) => void;
    private onFieldChangeCallback?: (field: any) => void;
    private allFields: any[];

    constructor(container: HTMLElement, field: any, items: any[], allFields?: any[]) {
        this.container = container;
        this.field = field;
        this.items = items;
        this.allFields = allFields || [];
    }

    /**
     * Render the slice panel
     */
    public render(): void {
        this.close(); // Close any existing panel

        // Create panel
        this.panelElement = document.createElement('div');
        this.panelElement.className = 'slice-panel';
        this.panelElement.style.position = 'relative';
        this.panelElement.style.float = 'left';
        // Restore persisted width if available
        try {
            const stored = localStorage.getItem('ghProjects.slicePanel.width');
            if (stored) this.panelElement.style.width = stored;
            else this.panelElement.style.width = '280px';
        } catch (e) {
            this.panelElement.style.width = '280px';
        }
        this.panelElement.style.marginRight = '12px';
        this.panelElement.style.background = 'var(--vscode-sideBar-background)';
        this.panelElement.style.border = '1px solid var(--vscode-sideBar-border)';
        this.panelElement.style.borderRadius = '6px';
        this.panelElement.style.display = 'flex';
        this.panelElement.style.flexDirection = 'column';
        this.panelElement.style.overflow = 'hidden';
        this.panelElement.style.maxHeight = '600px';

        // Temporary debug overlay: shows last resolved parent metadata and progress
        const debugOverlay = document.createElement('pre');
        debugOverlay.className = 'slice-panel-debug-overlay';
        debugOverlay.style.position = 'absolute';
        debugOverlay.style.left = '8px';
        debugOverlay.style.bottom = '8px';
        debugOverlay.style.right = '8px';
        debugOverlay.style.maxHeight = '120px';
        debugOverlay.style.overflow = 'auto';
        debugOverlay.style.background = 'rgba(0,0,0,0.6)';
        debugOverlay.style.color = 'white';
        debugOverlay.style.fontSize = '11px';
        debugOverlay.style.padding = '8px';
        debugOverlay.style.borderRadius = '6px';
        debugOverlay.style.zIndex = '200';
        debugOverlay.style.display = 'none'; // hidden by default
        debugOverlay.title = 'SlicePanel debug (click to show/hide)';
        debugOverlay.addEventListener('click', () => {
            debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
        });
        this.panelElement.appendChild(debugOverlay);

        // Add resizer on the right edge to allow adjusting panel width
        const resizer = document.createElement('div');
        resizer.className = 'slice-panel-resizer';
        resizer.style.position = 'absolute';
        resizer.style.top = '0';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.width = '6px';
        resizer.style.cursor = 'col-resize';
        resizer.style.zIndex = '100';
        this.panelElement.appendChild(resizer);

        let startX: number | null = null;
        let startWidth: number | null = null;

        const onMouseMove = (e: MouseEvent) => {
            if (startX == null || startWidth == null) return;
            const dx = e.pageX - startX;
            const newW = Math.max(160, startWidth + dx);
            this.panelElement!.style.width = newW + 'px';
        };

        const onMouseUp = () => {
            if (startX == null) return;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            try { localStorage.setItem('ghProjects.slicePanel.width', this.panelElement!.style.width); } catch (e) { }
            startX = null; startWidth = null;
        };

        resizer.addEventListener('mousedown', (ev: MouseEvent) => {
            ev.preventDefault();
            startX = ev.pageX;
            startWidth = this.panelElement ? this.panelElement.offsetWidth : 280;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Header with dropdown
        const header = document.createElement('div');
        header.style.padding = '12px';
        header.style.borderBottom = '1px solid var(--vscode-sideBar-border)';
        header.style.display = 'flex';
        header.style.flexDirection = 'column';
        header.style.gap = '8px';

        const headerTop = document.createElement('div');
        headerTop.style.display = 'flex';
        headerTop.style.alignItems = 'center';
        headerTop.style.gap = '8px';

        const sliceLabel = document.createElement('span');
        sliceLabel.textContent = 'Slice by';
        sliceLabel.style.fontSize = '11px';
        sliceLabel.style.fontWeight = '600';
        sliceLabel.style.color = 'var(--vscode-descriptionForeground)';
        sliceLabel.style.textTransform = 'uppercase';
        sliceLabel.style.letterSpacing = '0.5px';
        headerTop.appendChild(sliceLabel);

        // Field dropdown/button
        const fieldButton = document.createElement('button');
        fieldButton.textContent = this.field.name;
        fieldButton.style.flex = '1';
        fieldButton.style.padding = '6px 12px';
        fieldButton.style.background = 'var(--vscode-button-secondaryBackground)';
        fieldButton.style.color = 'var(--vscode-button-secondaryForeground)';
        fieldButton.style.border = '1px solid var(--vscode-button-border)';
        fieldButton.style.borderRadius = '4px';
        fieldButton.style.cursor = 'pointer';
        fieldButton.style.fontSize = '13px';
        fieldButton.style.fontWeight = '500';
        fieldButton.style.textAlign = 'left';
        fieldButton.style.display = 'flex';
        fieldButton.style.justifyContent = 'space-between';
        fieldButton.style.alignItems = 'center';

        // Add dropdown arrow
        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.style.fontSize = '10px';
        arrow.style.marginLeft = 'auto';
        fieldButton.appendChild(arrow);

        // Add dropdown menu on click
        fieldButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showFieldDropdown(fieldButton);
        });

        headerTop.appendChild(fieldButton);
        header.appendChild(headerTop);

        this.panelElement.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.overflow = 'auto';
        content.style.padding = '8px';

        this.renderValues(content);

        this.panelElement.appendChild(content);
        this.container.appendChild(this.panelElement);
    }

    /**
     * Show dropdown menu to select a different field
     */
    private showFieldDropdown(anchorButton: HTMLElement): void {
        // Get sliceable fields
        const sliceableTypes = new Set([
            'assignees',
            'single_select',
            'parent_issue',
            'iteration',
            'number',
            'date',
            'milestone',
            'repository',
            'labels'
        ]);

        const sliceableFields = this.allFields.filter(f => {
            const dataType = (f.dataType || '').toLowerCase();
            return sliceableTypes.has(dataType);
        });

        if (sliceableFields.length === 0) return;

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.style.position = 'absolute';
        dropdown.style.top = `${anchorButton.getBoundingClientRect().bottom + 4}px`;
        dropdown.style.left = `${anchorButton.getBoundingClientRect().left}px`;
        dropdown.style.minWidth = `${anchorButton.offsetWidth}px`;
        dropdown.style.background = 'var(--vscode-dropdown-background)';
        dropdown.style.border = '1px solid var(--vscode-dropdown-border)';
        dropdown.style.borderRadius = '4px';
        dropdown.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        dropdown.style.zIndex = '1000';
        dropdown.style.maxHeight = '300px';
        dropdown.style.overflowY = 'auto';

        sliceableFields.forEach(field => {
            const item = document.createElement('div');
            item.textContent = field.name;
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '13px';
            item.style.color = 'var(--vscode-dropdown-foreground)';

            if (field.id === this.field.id) {
                item.style.background = 'var(--vscode-list-activeSelectionBackground)';
                item.style.color = 'var(--vscode-list-activeSelectionForeground)';
            }

            item.addEventListener('mouseenter', () => {
                if (field.id !== this.field.id) {
                    item.style.background = 'var(--vscode-list-hoverBackground)';
                }
            });

            item.addEventListener('mouseleave', () => {
                if (field.id !== this.field.id) {
                    item.style.background = 'transparent';
                }
            });

            item.addEventListener('click', () => {
                this.field = field;
                dropdown.remove();
                backdrop.remove();
                this.render();
                if (this.onFieldChangeCallback) {
                    this.onFieldChangeCallback(field);
                }
            });

            dropdown.appendChild(item);
        });

        // Backdrop to close dropdown
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.right = '0';
        backdrop.style.bottom = '0';
        backdrop.style.zIndex = '999';

        backdrop.addEventListener('click', () => {
            dropdown.remove();
            backdrop.remove();
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(dropdown);
    }

    /**
     * Render the list of unique values with counts
     */
    private renderValues(container: HTMLElement): void {
        // Get unique values and their counts
        const valueCounts = this.getValueCounts();

        if (valueCounts.size === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No values';
            empty.style.padding = '8px';
            empty.style.color = 'var(--vscode-descriptionForeground)';
            container.appendChild(empty);
            return;
        }

        // Sort by count (descending)
        const sorted = Array.from(valueCounts.entries())
            .sort((a, b) => b[1].count - a[1].count);

        // Helper: resolve parent item and compute progress (done/total/pct)
        const resolveParentProgress = (parentMeta: any) => {
            const result: any = { resolved: null, statusColor: null, number: null, title: null, done: 0, total: 0, pct: 0 };
            if (!parentMeta) return result;

            // Build identifier list from parentMeta
            const identifiers: string[] = [];
            if (parentMeta.number) identifiers.push(String(parentMeta.number));
            if (parentMeta.id) identifiers.push(String(parentMeta.id));
            if (parentMeta.url) identifiers.push(String(parentMeta.url));
            if (parentMeta.title) identifiers.push(String(parentMeta.title));

            // Try to find a matching item in this.items (same logic as grouping header resolution)
            const found = this.items.find((A: any) => {
                const d = (A && (A.content || (A.raw && A.raw.itemContent))) || null;
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

            if (!found) return result; // single strategy: only use resolved item in snapshot

            result.resolved = found;
            const content = found.content || (found.raw && found.raw.itemContent) || null;
            result.title = content && (content.title || content.name) ? (content.title || content.name) : (found.title || found.name || null);
            result.number = content && content.number ? String(content.number) : (found.number || found.id || null);

            // Determine status color from single_select field in parent (if present)
            if (Array.isArray(found.fieldValues)) {
                const statusFV = found.fieldValues.find((v: any) => v && v.type === 'single_select' && v.option && v.option.name);
                if (statusFV && statusFV.option) {
                    try {
                        const c = statusFV.option.color || statusFV.option.id || statusFV.option.name || null;
                        result.statusColor = normalizeColor(c) || null;
                    } catch (e) { }
                }

                // Try to read aggregate progress field (sub_issues_progress or synthesized with total/done)
                const agg = found.fieldValues.find((v: any) => v && (v.type === 'sub_issues_progress' || (v.total != null && v.done != null)));
                if (agg && agg.total != null) {
                    result.total = Number(agg.total || 0);
                    result.done = Number(agg.done || 0);
                    result.pct = result.total > 0 ? Math.round((result.done / result.total) * 100) : 0;
                }
            }

            return result;
        };

        // Render each value with grouping-style presentation
        sorted.forEach(([key, { value, count, rawValue }]) => {
            const item = document.createElement('div');
            item.className = 'slice-value-item';
            item.style.padding = '10px 12px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '4px';
            item.style.marginBottom = '4px';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '8px';
            item.style.transition = 'background-color 0.15s ease';

            const dataType = (this.field.dataType || '').toLowerCase();

            // Normalize parent meta for this iteration so both visual and label rendering use the same source
            let parentMetaForIteration: any = null;
            if (dataType === 'parent_issue' && rawValue) {
                parentMetaForIteration = rawValue.parent || rawValue.parentIssue || rawValue.issue || rawValue.item || rawValue.value || rawValue;
            }

            // Left visual area: avatar / color dot / repo icon
            const leftVisual = document.createElement('div');
            leftVisual.style.display = 'flex';
            leftVisual.style.alignItems = 'center';
            leftVisual.style.gap = '8px';
            leftVisual.style.flex = '0 0 auto';

            // Helper: create a color dot
            const makeColorDot = (c: string | null) => {
                const dot = document.createElement('span');
                dot.style.display = 'inline-block';
                dot.style.width = '12px';
                dot.style.height = '12px';
                dot.style.borderRadius = '50%';
                dot.style.flexShrink = '0';
                dot.style.backgroundColor = c || 'var(--vscode-descriptionForeground)';
                return dot;
            };

            let visualAppended = false;

            // Assignees: rawValue may be an individual assignee object (from getValueCounts)
            if (dataType === 'assignees' && rawValue) {
                const a = rawValue;
                const avatarUrl = a && (a.avatarUrl || a.avatar || a.imageUrl || a.avatar_url);
                if (avatarUrl) {
                    const avatarEl = document.createElement('span');
                    avatarEl.innerHTML = '<span title="' + escapeHtml(a.login || a.name || a.id || '') + '" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url(' + escapeHtml(avatarUrl) + ');border:2px solid var(--vscode-editor-background)"></span>';
                    leftVisual.appendChild(avatarEl);
                    visualAppended = true;
                } else {
                    // fallback color dot
                    leftVisual.appendChild(makeColorDot(null));
                    visualAppended = true;
                }
            }

            // Repository: show repo icon
            if (!visualAppended && dataType === 'repository') {
                const repoIcon = document.createElement('span');
                repoIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)"><path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/></svg>';
                leftVisual.appendChild(repoIcon);
                visualAppended = true;
            }

            // Parent issue: try to extract parent title and show a color dot (use resolved parent status color if possible)
            if (!visualAppended && dataType === 'parent_issue') {
                const prog = parentMetaForIteration ? resolveParentProgress(parentMetaForIteration) : null;
                // Prefer status color from resolved parent progress, then try parentMeta.option/color fields
                let dotColor = (prog && prog.statusColor) ? prog.statusColor : null;
                if (!dotColor && parentMetaForIteration) {
                    dotColor = normalizeColor(parentMetaForIteration.color || (parentMetaForIteration.option && parentMetaForIteration.option.color) || parentMetaForIteration.statusColor || parentMetaForIteration.status?.color) || null;
                }

                if (parentMetaForIteration && (parentMetaForIteration.title || parentMetaForIteration.name || parentMetaForIteration.number || (prog && (prog.title || prog.number)))) {
                    const pd = makeColorDot(dotColor);
                    leftVisual.appendChild(pd);
                    visualAppended = true;
                }
            }

            // Labels: ensure label color dot comes from label metadata
            if (!visualAppended && dataType === 'labels' && rawValue) {
                // rawValue here is the individual label object
                const lab = rawValue;
                const colorCandidate = lab && (lab.color || lab.colorName || lab.hex || lab.name);
                const normalized = normalizeColor(colorCandidate);
                leftVisual.appendChild(makeColorDot(normalized));
                visualAppended = true;
            }

            // If still no specialized visual, fall back to normalized color from options/iterations
            if (!visualAppended) {
                let colorVal: any = null;
                if (dataType === 'single_select' && rawValue && rawValue.option) {
                    colorVal = rawValue.option.color || rawValue.option.name || rawValue.option.id;
                }
                // If repository/parent/iteration/milestone provide color directly, prefer it
                if (!colorVal && rawValue && (rawValue.color || rawValue.colorName)) {
                    colorVal = rawValue.color || rawValue.colorName;
                }
                if (!colorVal && Array.isArray(this.field.options)) {
                    try {
                        const found = (this.field.options || []).find((o: any) => String(o.name) === String(key) || String(o.id) === String(rawValue && (rawValue.optionId || (rawValue.option && rawValue.option.id))));
                        if (found) colorVal = found.color || found.name || found.id;
                    } catch (e) { }
                }
                if (!colorVal && this.field && this.field.configuration && Array.isArray(this.field.configuration.iterations)) {
                    try {
                        const iter = (this.field.configuration.iterations || []).find((it: any) => String(it.title) === String(key) || String(it.id) === String(rawValue && (rawValue.iterationId || (rawValue.iteration && rawValue.iteration.id))));
                        if (iter) colorVal = iter.color || iter.name || iter.title || iter.id;
                    } catch (e) { }
                }
                const normalized = normalizeColor(colorVal);
                leftVisual.appendChild(makeColorDot(normalized));
            }

            item.appendChild(leftVisual);

            // Label column
            const labelColumn = document.createElement('div');
            labelColumn.style.flex = '1';
            labelColumn.style.display = 'flex';
            labelColumn.style.flexDirection = 'column';
            labelColumn.style.minWidth = '0';

            // For parent_issue we render a custom header below (avoid duplicating the generic label)
            let label: HTMLElement | null = null;
            if (dataType !== 'parent_issue') {
                label = document.createElement('span');
                label.textContent = key;
                label.style.fontSize = '13px';
                label.style.fontWeight = '500';
                // Allow wrapping to next line instead of overflowing
                label.style.whiteSpace = 'normal';
                label.style.wordBreak = 'break-word';
                label.style.overflow = 'hidden';
                labelColumn.appendChild(label);
            }

            // Add description for single_select
            if (dataType === 'single_select') {
                // Prefer metadata description from field.options if available, else rawValue.option.description
                let descText: string | null = null;
                try {
                    if (rawValue && rawValue.option && rawValue.option.description) descText = rawValue.option.description;
                    else if (Array.isArray(this.field.options)) {
                        const found = (this.field.options || []).find((o: any) => String(o.name) === String(key) || String(o.id) === String(rawValue && (rawValue.optionId || (rawValue.option && rawValue.option.id))));
                        if (found && found.description) descText = found.description;
                    }
                } catch (e) { }

                if (descText) {
                    const desc = document.createElement('span');
                    desc.textContent = descText;
                    desc.style.fontSize = '11px';
                    desc.style.color = 'var(--vscode-descriptionForeground)';
                    desc.style.whiteSpace = 'normal';
                    desc.style.wordBreak = 'break-word';
                    desc.style.overflow = 'hidden';
                    desc.style.maxHeight = '3.6em';
                    labelColumn.appendChild(desc);
                }
            }

            // For parent_issue, show title snippet if available
            if (dataType === 'parent_issue' && rawValue) {
                const p = parentMetaForIteration || (rawValue.parent || rawValue.parentIssue || rawValue.issue || rawValue.item || rawValue.value || null);
                const prog = resolveParentProgress(p);
                // Title + number
                const titleText = prog.title || (p && (p.title || p.name)) || key;
                const titleEl = document.createElement('div');
                titleEl.style.display = 'flex';
                titleEl.style.gap = '8px';
                titleEl.style.alignItems = 'baseline';
                const tspan = document.createElement('span');
                // Append number inline into the title text so it appears immediately after the title
                const displayedTitle = String(titleText).slice(0, 120);
                tspan.textContent = prog.number ? `${displayedTitle} #${String(prog.number)}` : displayedTitle;
                tspan.style.fontSize = '13px';
                tspan.style.fontWeight = '600';
                tspan.style.whiteSpace = 'normal';
                tspan.style.wordBreak = 'break-word';
                titleEl.appendChild(tspan);
                labelColumn.appendChild(titleEl);

                // Progress summary and bar
                if (prog.total && prog.total > 0) {
                    const summary = document.createElement('div');
                    summary.style.display = 'flex';
                    summary.style.alignItems = 'center';
                    summary.style.gap = '8px';
                    summary.style.marginTop = '6px';

                    const doneText = document.createElement('div');
                    doneText.textContent = `${prog.done}/${prog.total}`;
                    doneText.style.color = 'var(--vscode-descriptionForeground)';
                    doneText.style.fontSize = '12px';
                    doneText.style.fontVariantNumeric = 'tabular-nums';
                    summary.appendChild(doneText);

                    const bar = document.createElement('div');
                    bar.style.display = 'inline-block';
                    bar.style.width = '120px';
                    bar.style.height = '10px';
                    bar.style.background = 'transparent';
                    bar.style.border = '1px solid var(--vscode-focusBorder)';
                    bar.style.borderRadius = '6px';
                    bar.style.overflow = 'hidden';
                    const fill = document.createElement('div');
                    fill.style.height = '100%';
                    fill.style.width = String(prog.pct) + '%';
                    fill.style.background = 'var(--vscode-focusBorder)';
                    bar.appendChild(fill);
                    summary.appendChild(bar);

                    labelColumn.appendChild(summary);
                }
            }

                // Iteration: show date range if available
                if (dataType === 'iteration') {
                    try {
                        // rawValue may be an FV with iteration object, or we can look up field.configuration.iterations
                        const iterObj = (rawValue && (rawValue.iteration || rawValue.configuration || rawValue)) || null;
                        let iterCandidate: any = null;
                        if (iterObj && iterObj.startDate && (iterObj.duration || iterObj.length)) {
                            iterCandidate = iterObj;
                        } else if (this.field && this.field.configuration && Array.isArray(this.field.configuration.iterations)) {
                            const found = (this.field.configuration.iterations || []).find((it: any) => String(it.title || it.name) === String(key) || String(it.id) === String(rawValue && (rawValue.iterationId || (rawValue.iteration && rawValue.iteration.id))));
                            if (found) iterCandidate = found;
                        }

                        if (iterCandidate) {
                            const start = iterCandidate.startDate || iterCandidate.start;
                            const duration = iterCandidate.duration || iterCandidate.length || iterCandidate.days;
                            if (start && duration) {
                                const s = new Date(start);
                                const e = new Date(s.getTime() + Number(duration || 0) * 24 * 60 * 60 * 1000);
                                const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                const rangeEl = document.createElement('div');
                                rangeEl.textContent = `${sStr} — ${eStr}`;
                                rangeEl.style.fontSize = '11px';
                                rangeEl.style.color = 'var(--vscode-descriptionForeground)';
                                rangeEl.style.marginTop = '4px';
                                labelColumn.appendChild(rangeEl);
                            }
                        }
                    } catch (e) { }
                }

            item.appendChild(labelColumn);

            // Count circle (like grouping)
            const countCircle = document.createElement('span');
            countCircle.style.display = 'inline-flex';
            countCircle.style.alignItems = 'center';
            countCircle.style.justifyContent = 'center';
            countCircle.style.minWidth = '24px';
            countCircle.style.height = '24px';
            countCircle.style.borderRadius = '50%';
            countCircle.style.background = 'var(--vscode-input-background)';
            countCircle.style.border = '1px solid var(--vscode-panel-border)';
            countCircle.style.color = 'var(--vscode-foreground)';
            countCircle.style.fontSize = '12px';
            countCircle.style.fontWeight = '600';
            countCircle.style.padding = '0 6px';
            countCircle.style.boxSizing = 'border-box';
            countCircle.textContent = String(count);

            item.appendChild(countCircle);

            // Hover effect
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--vscode-list-hoverBackground)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });

            // Click handler
            item.addEventListener('click', () => {
                if (this.onValueSelectCallback) {
                    this.onValueSelectCallback(value);
                }
            });

            container.appendChild(item);
        });
    }

    /**
     * Get unique values and their counts
     */
    private getValueCounts(): Map<string, { value: any, count: number, rawValue: any }> {
        const counts = new Map<string, { value: any, count: number, rawValue: any }>();

        const dataType = (this.field.dataType || '').toLowerCase();

        this.items.forEach(item => {
            const fv = item.fieldValues?.find((f: any) => f.fieldId === this.field.id || f.fieldName === this.field.name);
            if (!fv) {
                const key = '(empty)';
                const existing = counts.get(key);
                if (existing) existing.count++; else counts.set(key, { value: null, count: 1, rawValue: null });
                return;
            }

            // Handle multi-value fields (labels, assignees)
            if (dataType === 'labels') {
                // GitHub sometimes nests labels under .labels.nodes or .labels
                const labelsArr = fv.labels && Array.isArray(fv.labels.nodes) ? fv.labels.nodes : (Array.isArray(fv.labels) ? fv.labels : null);
                if (Array.isArray(labelsArr) && labelsArr.length > 0) {
                    labelsArr.forEach((lab: any) => {
                        const name = lab && (lab.name || lab.title) ? String(lab.name || lab.title) : '(empty)';
                        const key = this.formatValue(name);
                        const existing = counts.get(key);
                        if (existing) existing.count++; else counts.set(key, { value: name, count: 1, rawValue: lab });
                    });
                    return;
                }
            }

            if (dataType === 'assignees') {
                const ass = fv.assignees || (fv.assignee ? [fv.assignee] : null);
                if (Array.isArray(ass) && ass.length > 0) {
                    ass.forEach((a: any) => {
                        const name = String(a.login || a.name || a.id || '(unknown)');
                        const key = this.formatValue(name);
                        const existing = counts.get(key);
                        if (existing) existing.count++; else counts.set(key, { value: a, count: 1, rawValue: a });
                    });
                    return;
                }
            }

            // Single-value fields and other complex types
            let value: any = null;
            let rawValue: any = null;

            try {
                if (dataType === 'single_select') {
                    value = fv.option?.name || fv.name || fv.value;
                    rawValue = fv;
                } else if (dataType === 'iteration') {
                    value = fv.iteration?.title || fv.title || fv.value;
                    rawValue = fv;
                } else if (dataType === 'parent_issue') {
                    const p = fv.parent || fv.parentIssue || fv.issue || fv.item || fv.value || null;
                    if (p) value = p.title || p.name || p.number || p.id || p.url || null;
                    rawValue = p || fv;
                } else if (dataType === 'milestone') {
                    value = fv.milestone?.title || fv.milestone?.name || fv.value || null;
                    rawValue = fv.milestone || fv;
                } else if (dataType === 'repository') {
                    value = fv.repository?.nameWithOwner || fv.repository?.full_name || fv.repository?.name || fv.value || null;
                    rawValue = fv.repository || fv;
                } else if (dataType === 'number') {
                    value = fv.number != null ? fv.number : fv.value;
                    rawValue = fv;
                } else if (dataType === 'date') {
                    value = fv.date || fv.value || null;
                    rawValue = fv;
                } else {
                    // fallback: text, title, other simple values
                    value = fv.text || fv.title || fv.value || null;
                    rawValue = fv;
                }
            } catch (e) {
                value = fv.text || fv.title || fv.value || null;
                rawValue = fv;
            }

            const key = value === null || value === undefined || value === '' ? '(empty)' : this.formatValue(value);
            const existing = counts.get(key);
            if (existing) existing.count++; else counts.set(key, { value, count: 1, rawValue });
        });

        return counts;
    }

    /**
     * Extract value from field value object
     */
    private extractValue(fieldValue: any): any {
        // Deprecated: primary logic moved into getValueCounts which handles multi-value types.
        const dataType = (this.field.dataType || '').toLowerCase();
        if (!fieldValue) return null;
        if (dataType === 'single_select') return fieldValue.option?.name || fieldValue.name || fieldValue.value;
        if (dataType === 'iteration') return fieldValue.iteration?.title || fieldValue.title || fieldValue.value;
        if (dataType === 'assignees') return fieldValue.assignees || fieldValue.assignee || null;
        if (dataType === 'labels') return fieldValue.labels || null;
        if (dataType === 'parent_issue') return fieldValue.parent || fieldValue.parentIssue || fieldValue.issue || fieldValue.item || fieldValue.value || null;
        if (dataType === 'milestone') return fieldValue.milestone || fieldValue.value || null;
        if (dataType === 'repository') return fieldValue.repository || fieldValue.value || null;
        if (dataType === 'number') return fieldValue.number != null ? fieldValue.number : fieldValue.value;
        if (dataType === 'date') return fieldValue.date || fieldValue.value || null;
        return fieldValue.text || fieldValue.title || fieldValue.value || null;
    }

    /**
     * Format value for display
     */
    private formatValue(value: any): string {
        if (value === null || value === undefined) {
            return '(empty)';
        }
        return String(value);
    }

    /**
     * Register callback for value selection
     */
    public onValueSelect(callback: (value: any) => void): void {
        this.onValueSelectCallback = callback;
    }

    /**
     * Register callback for field change
     */
    public onFieldChange(callback: (field: any) => void): void {
        this.onFieldChangeCallback = callback;
    }

    /**
     * Close and remove the panel
     */
    public close(): void {
        if (this.panelElement) {
            this.panelElement.remove();
            this.panelElement = null;
        }
    }
}
