export class TableResizer {
    constructor(
        private table: HTMLTableElement,
        private fields: any[],
        private options: any
    ) {}

    public setupResizers() {
        const headers = this.table.querySelectorAll('th');

        headers.forEach((th, index) => {
            // Skip index column
            if (index === 0) return;

            // Create resizer element
            const resizer = document.createElement('div');
            resizer.className = 'column-resizer';
            resizer.style.position = 'absolute';
            resizer.style.top = '0';
            resizer.style.right = '0';
            resizer.style.width = '4px';
            resizer.style.height = '100%';
            resizer.style.cursor = 'col-resize';
            resizer.style.userSelect = 'none';
            resizer.style.zIndex = '100';

            // Visual feedback on hover
            resizer.addEventListener('mouseenter', () => {
                resizer.style.background = 'var(--vscode-focusBorder)';
            });

            resizer.addEventListener('mouseleave', () => {
                resizer.style.background = 'transparent';
            });

            // Resize logic
            resizer.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const cols = this.table.querySelectorAll('col');
                const col = cols[index] as HTMLTableColElement | undefined; // index aligns with th
                const startW = col ? (parseInt(col.style.width) || col.offsetWidth) : th.offsetWidth;
                this.beginColumnResize(index, e.pageX, startW);
            });

            // Make th position relative for absolute positioning
            (th as HTMLElement).style.position = 'relative';
            th.appendChild(resizer);
        });

        // Restore column widths from localStorage
        this.restoreColumnWidths();
    }

    public beginColumnResize(colIndex: number, startX: number, startWidth: number) {
        const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(20, startWidth + (e.pageX - startX));
            const cols = this.table.querySelectorAll('col');
            const col = cols[colIndex] as HTMLTableColElement | undefined;
            if (col) {
                col.style.width = `${newWidth}px`;
                col.style.minWidth = `${newWidth}px`;
                col.style.maxWidth = `${newWidth}px`;
            }
        };

        const onMouseUp = (e?: MouseEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Save mapping to field id (colIndex - 1 => fields)
            const fieldIndex = colIndex - 1;
            if (fieldIndex >= 0 && fieldIndex < this.fields.length) {
                const cols = this.table.querySelectorAll('col');
                const col = cols[colIndex] as HTMLTableColElement | undefined;
                const widthToSave = col ? (parseInt(col.style.width) || col.offsetWidth) : undefined;
                if (widthToSave) {
                    this.saveColumnWidth(this.fields[fieldIndex].id, widthToSave);
                }
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private saveColumnWidth(fieldId: string, width: number) {
        const key = this.getStorageKey('columnWidths');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            const widths = stored ? JSON.parse(stored) : {};
            widths[fieldId] = width;
            localStorage.setItem(key, JSON.stringify(widths));
        } catch (e) { }
    }

    private restoreColumnWidths() {
        const key = this.getStorageKey('columnWidths');
        if (!key) return;

        try {
            const stored = localStorage.getItem(key);
            if (!stored) return;

            const widths = JSON.parse(stored);
            const cols = this.table.querySelectorAll('col');

            this.fields.forEach((field, index) => {
                const width = widths[field.id];
                if (width) {
                    const col = cols[index + 1] as HTMLTableColElement; // +1 for index column
                    if (col) {
                        col.style.width = `${width}px`;
                        col.style.minWidth = `${width}px`;
                        col.style.maxWidth = `${width}px`;
                    }
                }
            });
        } catch (e) { }
    }

    private getStorageKey(suffix: string): string {
        return this.options.viewKey ? `ghProjects.table.${this.options.viewKey}.${suffix}` : '';
    }
}
