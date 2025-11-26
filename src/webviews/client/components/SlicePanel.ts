/**
 * Slice Panel Component
 * Shows unique values for a field with counts, allowing quick filtering
 */

export class SlicePanel {
    private container: HTMLElement;
    private field: any;
    private items: any[];
    private panelElement: HTMLElement | null = null;
    private onValueSelectCallback?: (value: any) => void;

    constructor(container: HTMLElement, field: any, items: any[]) {
        this.container = container;
        this.field = field;
        this.items = items;
    }

    /**
     * Render the slice panel
     */
    public render(): void {
        this.close(); // Close any existing panel

        // Create panel
        this.panelElement = document.createElement('div');
        this.panelElement.className = 'slice-panel';
        this.panelElement.style.position = 'relative'; // Not fixed!
        this.panelElement.style.float = 'left'; // Float left
        this.panelElement.style.width = '250px';
        this.panelElement.style.marginRight = '12px';
        this.panelElement.style.background = 'var(--vscode-sideBar-background)';
        this.panelElement.style.border = '1px solid var(--vscode-sideBar-border)';
        this.panelElement.style.borderRadius = '4px';
        this.panelElement.style.display = 'flex';
        this.panelElement.style.flexDirection = 'column';
        this.panelElement.style.overflow = 'hidden';
        this.panelElement.style.maxHeight = '600px';

        // Header
        const header = document.createElement('div');
        header.style.padding = '12px';
        header.style.borderBottom = '1px solid var(--vscode-sideBar-border)';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('div');
        title.textContent = `Slice by ${this.field.name}`;
        title.style.fontWeight = '600';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = 'var(--vscode-foreground)';
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);

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
            .sort((a, b) => b[1] - a[1]);

        // Render each value
        sorted.forEach(([value, count]) => {
            const item = document.createElement('div');
            item.className = 'slice-value-item';
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '4px';
            item.style.marginBottom = '4px';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';

            const label = document.createElement('span');
            label.textContent = this.formatValue(value);
            label.style.flex = '1';

            const badge = document.createElement('span');
            badge.textContent = String(count);
            badge.style.background = 'var(--vscode-badge-background)';
            badge.style.color = 'var(--vscode-badge-foreground)';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '10px';
            badge.style.fontSize = '11px';

            item.appendChild(label);
            item.appendChild(badge);

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
    private getValueCounts(): Map<string, number> {
        const counts = new Map<string, number>();

        this.items.forEach(item => {
            const fieldValue = item.fieldValues?.find((fv: any) =>
                fv.fieldId === this.field.id || fv.fieldName === this.field.name
            );

            if (fieldValue) {
                const value = this.extractValue(fieldValue);
                const key = String(value || '(empty)');
                counts.set(key, (counts.get(key) || 0) + 1);
            } else {
                counts.set('(empty)', (counts.get('(empty)') || 0) + 1);
            }
        });

        return counts;
    }

    /**
     * Extract value from field value object
     */
    private extractValue(fieldValue: any): any {
        const dataType = (this.field.dataType || '').toLowerCase();

        switch (dataType) {
            case 'text':
            case 'title':
                return fieldValue.text || fieldValue.title;
            case 'number':
                return fieldValue.number;
            case 'date':
                return fieldValue.date;
            case 'single_select':
                return fieldValue.option?.name || fieldValue.name;
            case 'iteration':
                return fieldValue.title || fieldValue.iteration?.title;
            default:
                return fieldValue.text || fieldValue.value || null;
        }
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
     * Close and remove the panel
     */
    public close(): void {
        if (this.panelElement) {
            this.panelElement.remove();
            this.panelElement = null;
        }
    }
}
