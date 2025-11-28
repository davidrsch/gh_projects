/**
 * Column Header Dropdown Menu Component
 * Shows context menu when clicking column header with actions like sort, group, slice, hide, move
 */

export interface MenuOptions {
    canGroup: boolean;
    canSlice: boolean;
    canFilter: boolean;
    isGrouped?: boolean;
    isSliced?: boolean;
    currentSort?: 'ASC' | 'DESC' | null;
    onSort?: (direction: 'ASC' | 'DESC') => void;
    onGroup?: () => void;
    onSlice?: () => void;
    onClearGroup?: () => void;
    onClearSlice?: () => void;
    onClearSort?: () => void;
    onHide?: () => void;
    onMove?: (direction: 'left' | 'right') => void;
    onFilter?: () => void;
    // positional info for disabling move actions
    isFirst?: boolean;
    isLast?: boolean;
}

export class ColumnHeaderMenu {
    private field: any;
    private options: MenuOptions;
    private menuElement: HTMLElement | null = null;
    private backdropElement: HTMLElement | null = null;

    constructor(field: any, options: MenuOptions) {
        this.field = field;
        this.options = options;
    }

    /**
     * Show the menu anchored below the header element
     */
    public show(anchorElement: HTMLElement): void {
        // Hide any existing menu
        this.hide();

        // Create backdrop to detect outside clicks
        this.backdropElement = document.createElement('div');
        this.backdropElement.style.position = 'fixed';
        this.backdropElement.style.top = '0';
        this.backdropElement.style.left = '0';
        this.backdropElement.style.right = '0';
        this.backdropElement.style.bottom = '0';
        this.backdropElement.style.zIndex = '999';
        this.backdropElement.addEventListener('click', () => this.hide());
        document.body.appendChild(this.backdropElement);

        // Create menu
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'column-header-menu';
        this.menuElement.style.position = 'absolute';
        this.menuElement.style.background = 'var(--vscode-menu-background)';
        this.menuElement.style.border = '1px solid var(--vscode-menu-border)';
        this.menuElement.style.borderRadius = '4px';
        this.menuElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        this.menuElement.style.minWidth = '180px';
        this.menuElement.style.padding = '4px 0';
        this.menuElement.style.zIndex = '1000';
        this.menuElement.style.fontSize = '13px';

        // Position below anchor
        const rect = anchorElement.getBoundingClientRect();
        this.menuElement.style.top = `${rect.bottom + 4}px`;
        this.menuElement.style.left = `${rect.left}px`;

        // Build menu items
        this.buildMenuItems();

        document.body.appendChild(this.menuElement);
    }

    /**
     * Hide and remove the menu
     */
    public hide(): void {
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
        if (this.backdropElement) {
            this.backdropElement.remove();
            this.backdropElement = null;
        }
    }

    /**
     * Build menu items based on options
     */
    private buildMenuItems(): void {
        if (!this.menuElement) return;

        // Header
        this.addMenuItem('Select column', null, { isHeader: true });
        this.addSeparator();

        // Sort options (always available). If the column is currently sorted, show an 'x' clear button
        this.addMenuItem('Sort ascending', () => {
            this.options.onSort?.('ASC');
            this.hide();
        }, { icon: '<svg class="octicon octicon-sort-asc" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="m12.927 2.573 3 3A.25.25 0 0 1 15.75 6H13.5v6.75a.75.75 0 0 1-1.5 0V6H9.75a.25.25 0 0 1-.177-.427l3-3a.25.25 0 0 1 .354 0ZM0 12.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75Zm0-4a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8.25Zm0-4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 4.25Z"></path></svg>', showClear: !!(this.options.currentSort === 'ASC'), clearAction: this.options.onClearSort });

        this.addMenuItem('Sort descending', () => {
            this.options.onSort?.('DESC');
            this.hide();
        }, { icon: '<svg class="octicon octicon-sort-desc" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M0 4.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 4.25Zm0 4a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8.25Zm0 4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75ZM13.5 10h2.25a.25.25 0 0 1 .177.427l-3 3a.25.25 0 0 1-.354 0l-3-3A.25.25 0 0 1 9.75 10H12V3.75a.75.75 0 0 1 1.5 0V10Z"></path></svg>', showClear: !!(this.options.currentSort === 'DESC'), clearAction: this.options.onClearSort });

        this.addSeparator();

        // Group by (conditional)
        if (this.options.canGroup) {
            this.addMenuItem('Group by values', () => {
                this.options.onGroup?.();
                this.hide();
            }, { icon: '<svg class="octicon octicon-rows" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M16 10.75v2.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25v-2.5C0 9.784.784 9 1.75 9h12.5c.966 0 1.75.784 1.75 1.75Zm0-8v2.5A1.75 1.75 0 0 1 14.25 7H1.75A1.75 1.75 0 0 1 0 5.25v-2.5C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75Zm-1.75-.25H1.75a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Zm0 8H1.75a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Z"></path></svg>', showClear: !!this.options.isGrouped, clearAction: this.options.onClearGroup });
        }

        // Slice by (conditional)
        if (this.options.canSlice) {
            this.addMenuItem('Slice by values', () => {
                this.options.onSlice?.();
                this.hide();
            }, { icon: '<svg class="octicon octicon-sliceby" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 1.5H6.5V5H10C10.4142 5 10.75 5.33579 10.75 5.75C10.75 6.16421 10.4142 6.5 10 6.5H6.5V7.75C6.5 8.16421 6.16421 8.5 5.75 8.5C5.33579 8.5 5 8.16421 5 7.75V6.5H1.5V14.5H5V12.75C5 12.3358 5.33579 12 5.75 12C6.16421 12 6.5 12.3358 6.5 12.75V14.5H14.5V1.5ZM5 1.5V5H1.5V1.5H5ZM0 14.5V5.75V1.5C0 0.671573 0.671573 0 1.5 0H5.75H14.5C15.3284 0 16 0.671573 16 1.5V14.5C16 15.3284 15.3284 16 14.5 16H5.75H1.5C0.671573 16 0 15.3284 0 14.5ZM9.62012 9.58516C10.8677 9.59206 11.8826 8.58286 11.8826 7.33544V6.32279C11.8826 5.90857 12.2184 5.57279 12.6326 5.57279C13.0468 5.57279 13.3826 5.90857 13.3826 6.32279V7.33544C13.3826 9.4147 11.6909 11.0966 9.61182 11.0851L9.3826 11.0839L9.3826 12.9995C9.3826 13.2178 9.12245 13.3312 8.96248 13.1827L6.07989 10.506C5.97337 10.4071 5.97337 10.2385 6.07989 10.1396L8.96248 7.46291C9.12245 7.31438 9.3826 7.42782 9.3826 7.64611V9.58384L9.62012 9.58516Z"></path></svg>', showClear: !!this.options.isSliced, clearAction: this.options.onClearSlice });
        }

        // Filter (conditional)
        if (this.options.canFilter) {
            this.addMenuItem('Filter by values...', () => {
                this.options.onFilter?.();
                this.hide();
            });
        }

        // Always available actions
        if (this.options.canGroup || this.options.canSlice || this.options.canFilter) {
            this.addSeparator();
        }

        // Do not show hide for title fields
        const isTitle = !!(this.field && (this.field.type === 'title' || String(this.field.name || '').toLowerCase() === 'title' || String(this.field.id || '').toLowerCase() === 'title'));
        if (!isTitle) {
            this.addMenuItem('Hide field', () => {
                this.options.onHide?.();
                this.hide();
            }, { icon: '<svg class="octicon octicon-eye-closed" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.832.88 9.577.43 8.9a1.619 1.619 0 0 1 0-1.797c.353-.533.995-1.42 1.868-2.305L.31 3.357A.75.75 0 0 1 .143 2.31Zm1.536 5.622A.12.12 0 0 0 1.657 8c0 .021.006.045.022.068.412.621 1.242 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.195 0 2.31-.488 3.29-1.191L9.063 9.695A2 2 0 0 1 6.058 7.52L3.529 5.688a14.207 14.207 0 0 0-1.85 2.244ZM8 3.5c-.516 0-1.017.09-1.499.251a.75.75 0 1 1-.473-1.423A6.207 6.207 0 0 1 8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.11.166-.248.365-.41.587a.75.75 0 1 1-1.21-.887c.148-.201.272-.382.371-.53a.119.119 0 0 0 0-.137c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5Z"></path></svg>' });
        }

        this.addSeparator();

        const disableLeft = !!this.options.isFirst;
        const disableRight = !!this.options.isLast;

        this.addMenuItem('Move left', () => {
            if (disableLeft) return;
            this.options.onMove?.('left');
            this.hide();
        }, { icon: '<svg class="octicon octicon-arrow-left" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"></path></svg>', disabled: disableLeft });

        this.addMenuItem('Move right', () => {
            if (disableRight) return;
            this.options.onMove?.('right');
            this.hide();
        }, { icon: '<svg class="octicon octicon-arrow-right" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"></path></svg>', disabled: disableRight });
    }

    /**
     * Add a menu item
     */
    private addMenuItem(
        label: string,
        onClick: (() => void) | null,
        options?: { isHeader?: boolean; icon?: string; showClear?: boolean; clearAction?: (() => void) | null; disabled?: boolean }
    ): void {
        if (!this.menuElement) return;
        const item = document.createElement('div');
        item.className = 'menu-item';

        if (options?.isHeader) {
            item.textContent = label;
            item.style.padding = '6px 12px';
            item.style.fontWeight = '600';
            item.style.color = 'var(--vscode-descriptionForeground)';
            item.style.fontSize = '11px';
            item.style.textTransform = 'uppercase';
            item.style.cursor = 'default';
            this.menuElement.appendChild(item);
            return;
        }

        // Non-header item layout: optional icon on left, label, optional clear 'x' button on the right
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.padding = '6px 12px';
        item.style.cursor = 'pointer';
        item.style.color = 'var(--vscode-menu-foreground)';

        // Left icon
        if (options?.icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'menu-item-icon';
            iconEl.style.display = 'inline-block';
            iconEl.style.width = '14px';
            iconEl.style.marginRight = '8px';
            iconEl.style.flex = '0 0 auto';
            // allow callers to pass either a short glyph or full SVG string
            iconEl.innerHTML = options.icon;
            item.appendChild(iconEl);
        }

        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        labelEl.style.flex = '1';
        labelEl.style.whiteSpace = 'nowrap';
        labelEl.style.overflow = 'hidden';
        labelEl.style.textOverflow = 'ellipsis';

        item.appendChild(labelEl);

        // Optional clear 'x' button
        if (options?.showClear && options?.clearAction) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = '✕';
            clearBtn.title = 'Clear';
            clearBtn.style.border = 'none';
            clearBtn.style.background = 'transparent';
            clearBtn.style.cursor = 'pointer';
            clearBtn.style.padding = '2px 6px';
            clearBtn.style.marginLeft = '8px';
            clearBtn.style.color = 'var(--vscode-menu-foreground)';

            clearBtn.addEventListener('mouseenter', () => {
                clearBtn.style.color = 'var(--vscode-menu-selectionForeground)';
                clearBtn.style.background = 'var(--vscode-menu-selectionBackground)';
            });
            clearBtn.addEventListener('mouseleave', () => {
                clearBtn.style.color = 'var(--vscode-menu-foreground)';
                clearBtn.style.background = 'transparent';
            });

            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                options.clearAction && options.clearAction();
                this.hide();
            });

            item.appendChild(clearBtn);
        }

        // Disabled state
        if (options?.disabled) {
            item.style.opacity = '0.5';
            item.style.cursor = 'default';
        }

        if (onClick) {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--vscode-menu-selectionBackground)';
                item.style.color = 'var(--vscode-menu-selectionForeground)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
                item.style.color = 'var(--vscode-menu-foreground)';
            });

            item.addEventListener('click', () => {
                if (options?.disabled) return;
                onClick();
            });
        }

        this.menuElement.appendChild(item);
    }

    /**
     * Add menu separator
     */
    private addSeparator(): void {
        if (!this.menuElement) return;

        const separator = document.createElement('div');
        separator.style.height = '1px';
        separator.style.background = 'var(--vscode-menu-separatorBackground)';
        separator.style.margin = '4px 0';

        this.menuElement.appendChild(separator);
    }
}
