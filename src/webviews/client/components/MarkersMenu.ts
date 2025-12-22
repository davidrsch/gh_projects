export interface MarkersMenuOptions {
    fields: { id: string; name: string; iconClass?: string; dataType?: string }[];
    activeMarkers?: string[]; // Currently active marker IDs
    onToggle?: (markerId: string, active: boolean) => void;
}

function getIconSvg(iconName: string, size: number = 14): string {
    if ((window as any).getIconSvg) return (window as any).getIconSvg(iconName as any, { size });
    return "";
}

function getIconNameForDataType(dataType: string): string {
    if ((window as any).getIconNameForDataType) return (window as any).getIconNameForDataType(dataType);
    return "note";
}

export class MarkersMenu {
    private options: MarkersMenuOptions;
    private menuEl: HTMLElement | null = null;
    private backdropEl: HTMLElement | null = null;
    private anchor: HTMLElement | null = null;
    private anchorRect: DOMRect | undefined = undefined;

    constructor(options: MarkersMenuOptions) {
        this.options = options;
    }

    public show(anchor: HTMLElement, anchorRect?: DOMRect) {
        this.hide();
        this.anchor = anchor;
        this.anchorRect = anchorRect;

        this.backdropEl = document.createElement('div');
        this.backdropEl.style.position = 'fixed';
        this.backdropEl.style.top = '0';
        this.backdropEl.style.left = '0';
        this.backdropEl.style.right = '0';
        this.backdropEl.style.bottom = '0';
        this.backdropEl.style.zIndex = '998';
        this.backdropEl.addEventListener('click', () => this.hide());
        document.body.appendChild(this.backdropEl);

        // Remove any existing submenus first
        try {
            document.querySelectorAll('[data-menu-type="markers-menu"]').forEach((n) => n.remove());
        } catch (e) { }

        this.menuEl = document.createElement('div');
        this.menuEl.className = 'markers-menu';
        this.menuEl.dataset.menuType = 'markers-menu';
        this.menuEl.style.position = 'absolute';
        this.menuEl.style.background = 'var(--vscode-menu-background)';
        this.menuEl.style.border = '1px solid var(--vscode-menu-border)';
        this.menuEl.style.borderRadius = '4px';
        this.menuEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        this.menuEl.style.minWidth = '180px';
        this.menuEl.style.maxHeight = '60vh';
        this.menuEl.style.overflowY = 'auto';
        this.menuEl.style.boxSizing = 'border-box';
        this.menuEl.style.padding = '4px 0';
        this.menuEl.style.zIndex = '1000';
        this.menuEl.style.fontSize = '13px';
        document.body.appendChild(this.menuEl);

        this.buildMenuContent();
        this.positionMenu();
        return { el: this.menuEl, refresh: this.refresh.bind(this) };
    }

    private buildMenuContent() {
        if (!this.menuEl) return;
        this.menuEl.innerHTML = '';

        const title = document.createElement('div');
        title.textContent = 'Markers';
        title.style.padding = '6px 12px';
        title.style.fontWeight = '600';
        title.style.color = 'var(--vscode-descriptionForeground)';
        title.style.fontSize = '12px';
        this.menuEl.appendChild(title);

        this.addSeparator();

        const activeSet = new Set(this.options.activeMarkers || []);

        // Milestones option (always first)
        this.addMarkerRow('milestones', 'Milestones', 'milestone', activeSet.has('milestones'));

        // Iteration and date fields
        const markerFields = (this.options.fields || []).filter((f: any) => {
            const type = String((f.dataType || f.type) || '').toLowerCase();
            return type === 'iteration' || type === 'date';
        });

        if (markerFields.length > 0) {
            this.addSeparator();
            markerFields.forEach(f => {
                const iconName = getIconNameForDataType(f.dataType || 'date');
                this.addMarkerRow(f.id, f.name, iconName, activeSet.has(f.id));
            });
        }
    }

    private addMarkerRow(id: string, label: string, iconName: string, isActive: boolean) {
        if (!this.menuEl) return;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.padding = '6px 12px';
        row.style.cursor = 'pointer';

        // Checkmark
        const check = document.createElement('span');
        check.style.display = 'inline-flex';
        check.style.width = '14px';
        check.style.marginRight = '8px';
        check.style.alignItems = 'center';
        check.style.justifyContent = 'center';
        if (isActive) {
            check.textContent = '✓';
            check.style.color = 'var(--vscode-menu-selectionForeground)';
        }
        row.appendChild(check);

        // Icon
        const iconEl = document.createElement('span');
        iconEl.style.display = 'inline-flex';
        iconEl.style.alignItems = 'center';
        iconEl.style.justifyContent = 'center';
        iconEl.style.marginRight = '8px';
        try {
            iconEl.innerHTML = getIconSvg(iconName, 14);
            iconEl.querySelectorAll('svg').forEach((s: any) => s.setAttribute && s.setAttribute('fill', 'currentColor'));
        } catch (e) { }
        row.appendChild(iconEl);

        // Label
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        labelEl.style.flex = '1';
        row.appendChild(labelEl);

        // Hover effects
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--vscode-menu-selectionBackground)';
            row.style.color = 'var(--vscode-menu-selectionForeground)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
            row.style.color = 'var(--vscode-menu-foreground)';
        });

        // Click: toggle marker and refresh
        row.addEventListener('click', () => {
            const newActive = !isActive;
            if (this.options.onToggle) {
                this.options.onToggle(id, newActive);
            }
            // Update local state and refresh
            if (newActive) {
                if (!this.options.activeMarkers) this.options.activeMarkers = [];
                this.options.activeMarkers.push(id);
            } else {
                this.options.activeMarkers = (this.options.activeMarkers || []).filter(m => m !== id);
            }
            this.refresh();
        });

        this.menuEl.appendChild(row);
    }

    private positionMenu() {
        if (!this.menuEl) return;

        let rectAnchor = this.anchorRect;
        if (!rectAnchor && this.anchor) rectAnchor = this.anchor.getBoundingClientRect();
        if (!rectAnchor) return;

        const mrect = this.menuEl.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const margin = 8;

        let top = Math.round(rectAnchor.top + (rectAnchor.height - mrect.height) / 2);
        const maxTop = Math.max(margin, vh - mrect.height - margin);
        top = Math.max(margin, Math.min(top, maxTop));

        let left = Math.round(rectAnchor.right + 4);
        if (left + mrect.width > vw) {
            left = Math.round(rectAnchor.left - mrect.width - 4);
            if (left < margin) {
                left = Math.max(margin, vw - mrect.width - margin);
            }
        }

        this.menuEl.style.top = `${top}px`;
        this.menuEl.style.left = `${left}px`;
    }

    public refresh() {
        if (this.menuEl) {
            this.buildMenuContent();
        }
    }

    private addSeparator() {
        if (!this.menuEl) return;
        const s = document.createElement('div');
        s.style.height = '1px';
        s.style.background = 'var(--vscode-menu-separatorBackground)';
        s.style.margin = '6px 0';
        this.menuEl.appendChild(s);
    }

    public hide() {
        if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
        if (this.backdropEl) { this.backdropEl.remove(); this.backdropEl = null; }
    }
}

export default MarkersMenu;
