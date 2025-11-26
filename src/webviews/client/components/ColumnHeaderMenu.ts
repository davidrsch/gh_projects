/**
 * Column Header Dropdown Menu Component
 * Shows context menu when clicking column header with actions like sort, group, slice, hide, move
 */

export interface MenuOptions {
    canGroup: boolean;
    canSlice: boolean;
    canFilter: boolean;
    onSort?: (direction: 'ASC' | 'DESC') => void;
    onGroup?: () => void;
    onSlice?: () => void;
    onHide?: () => void;
    onMove?: (direction: 'left' | 'right') => void;
    onFilter?: () => void;
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

        // Sort options (always available)
        this.addMenuItem('Sort ascending ↑', () => {
            this.options.onSort?.('ASC');
            this.hide();
        }, { icon: '↑' });

        this.addMenuItem('Sort descending ↓', () => {
            this.options.onSort?.('DESC');
            this.hide();
        }, { icon: '↓' });

        this.addSeparator();

        // Group by (conditional)
        if (this.options.canGroup) {
            this.addMenuItem('Group by values', () => {
                this.options.onGroup?.();
                this.hide();
            });
        }

        // Slice by (conditional)
        if (this.options.canSlice) {
            this.addMenuItem('Slice by values', () => {
                this.options.onSlice?.();
                this.hide();
            });
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

        this.addMenuItem('Hide field', () => {
            this.options.onHide?.();
            this.hide();
        });

        this.addSeparator();

        this.addMenuItem('Move left ←', () => {
            this.options.onMove?.('left');
            this.hide();
        }, { icon: '←' });

        this.addMenuItem('Move right →', () => {
            this.options.onMove?.('right');
            this.hide();
        }, { icon: '→' });
    }

    /**
     * Add a menu item
     */
    private addMenuItem(
        label: string,
        onClick: (() => void) | null,
        options?: { isHeader?: boolean; icon?: string }
    ): void {
        if (!this.menuElement) return;

        const item = document.createElement('div');
        item.className = 'menu-item';
        item.textContent = label;

        if (options?.isHeader) {
            item.style.padding = '6px 12px';
            item.style.fontWeight = '600';
            item.style.color = 'var(--vscode-descriptionForeground)';
            item.style.fontSize = '11px';
            item.style.textTransform = 'uppercase';
            item.style.cursor = 'default';
        } else {
            item.style.padding = '6px 12px';
            item.style.cursor = 'pointer';
            item.style.color = 'var(--vscode-menu-foreground)';

            if (onClick) {
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--vscode-menu-selectionBackground)';
                    item.style.color = 'var(--vscode-menu-selectionForeground)';
                });

                item.addEventListener('mouseleave', () => {
                    item.style.background = 'transparent';
                    item.style.color = 'var(--vscode-menu-foreground)';
                });

                item.addEventListener('click', onClick);
            }
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
