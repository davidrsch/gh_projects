/**
 * Fields Menu
 * Dropdown used from table plus-column. Shows project fields split into Visible / Hidden sections
 * First item is a "+ New field" button. Visible fields show a leading checkmark.
 */

export interface FieldItem {
    id: string;
    name: string;
    iconClass?: string;
    dataType?: string;
}

export interface FieldsMenuOptions {
    fields: FieldItem[];
    visibleFieldIds: Set<string>;
    onToggleVisibility?: (fieldId: string, visible: boolean) => void;
    onCreateField?: () => void;
}

export class FieldsMenu {
    private options: FieldsMenuOptions;
    private menuElement: HTMLElement | null = null;
    private backdropElement: HTMLElement | null = null;

    constructor(options: FieldsMenuOptions) {
        this.options = options;
    }

    public show(anchorElement: HTMLElement) {
        this.hide();

        // Backdrop to detect outside clicks
        this.backdropElement = document.createElement('div');
        this.backdropElement.style.position = 'fixed';
        this.backdropElement.style.top = '0';
        this.backdropElement.style.left = '0';
        this.backdropElement.style.right = '0';
        this.backdropElement.style.bottom = '0';
        this.backdropElement.style.zIndex = '998';
        this.backdropElement.addEventListener('click', () => this.hide());
        document.body.appendChild(this.backdropElement);

        // Create menu offscreen first so we can measure size and pick best placement
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'fields-menu';
        this.menuElement.style.position = 'absolute';
        this.menuElement.style.visibility = 'hidden';
        this.menuElement.style.left = '0px';
        this.menuElement.style.top = '0px';
        this.menuElement.style.background = 'var(--vscode-menu-background)';
        this.menuElement.style.border = '1px solid var(--vscode-menu-border)';
        this.menuElement.style.borderRadius = '4px';
        this.menuElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        this.menuElement.style.minWidth = '220px';
        this.menuElement.style.padding = '6px 0';
        // When there are many fields, allow the menu to scroll vertically instead of growing off-screen
        this.menuElement.style.maxHeight = '60vh';
        this.menuElement.style.overflowY = 'auto';
        this.menuElement.style.boxSizing = 'border-box';
        this.menuElement.style.zIndex = '1000';
        this.menuElement.style.fontSize = '13px';

        // Append hidden, build, measure, then position
        document.body.appendChild(this.menuElement);
        this.buildMenu();

        const rect = anchorElement.getBoundingClientRect();
        const menuRect = this.menuElement.getBoundingClientRect();
        const margin = 8;
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;

        // Vertical placement: prefer below, otherwise above, else clamp
        let top = rect.bottom + margin;
        if (rect.bottom + menuRect.height + margin > vh) {
            // try above
            if (rect.top - menuRect.height - margin >= 0) {
                top = rect.top - menuRect.height - margin;
            } else {
                // clamp within viewport
                top = Math.max(margin, Math.min(vh - menuRect.height - margin, rect.bottom + margin));
            }
        }

        // Horizontal placement: align left by default, but adjust if overflowing
        let left = rect.left;
        if (rect.left + menuRect.width + margin > vw) {
            // try align to right edge of anchor
            left = Math.max(margin, rect.right - menuRect.width);
        }
        // Clamp left
        left = Math.max(margin, Math.min(left, vw - menuRect.width - margin));

        this.menuElement.style.top = `${Math.round(top)}px`;
        this.menuElement.style.left = `${Math.round(left)}px`;
        this.menuElement.style.visibility = 'visible';
    }

    public hide() {
        if (this.menuElement) { this.menuElement.remove(); this.menuElement = null; }
        if (this.backdropElement) { this.backdropElement.remove(); this.backdropElement = null; }
    }

    private buildMenu() {
        if (!this.menuElement) return;

        // Header
        const title = document.createElement('div');
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.padding = '6px 12px';
        title.style.fontWeight = '600';
        title.style.color = 'var(--vscode-descriptionForeground)';
        title.style.fontSize = '12px';
        title.style.textTransform = 'uppercase';

        const icon = document.createElement('i');
        icon.className = 'octicon octicon-note';
        icon.style.marginRight = '8px';
        title.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = 'Fields';
        title.appendChild(label);

        this.menuElement.appendChild(title);
        this.addSeparator();

        // + New field
        const newField = document.createElement('div');
        newField.style.display = 'flex';
        newField.style.alignItems = 'center';
        newField.style.padding = '6px 12px';
        newField.style.cursor = 'pointer';
        newField.style.color = 'var(--vscode-menu-foreground)';
        newField.innerHTML = `<span style="margin-right:8px;font-weight:700">+</span><span>New field</span>`;
        newField.addEventListener('mouseenter', () => { newField.style.background = 'var(--vscode-menu-selectionBackground)'; newField.style.color = 'var(--vscode-menu-selectionForeground)'; });
        newField.addEventListener('mouseleave', () => { newField.style.background = 'transparent'; newField.style.color = 'var(--vscode-menu-foreground)'; });
        newField.addEventListener('click', () => { this.options.onCreateField?.(); this.hide(); });
        this.menuElement.appendChild(newField);

        this.addSeparator();

        const visible = this.options.fields.filter(f => this.options.visibleFieldIds.has(f.id));
        const hidden = this.options.fields.filter(f => !this.options.visibleFieldIds.has(f.id));

        this.addSectionHeader('Visible fields');
        if (visible.length === 0) this.addEmptyRow('No visible fields');
        else visible.forEach(f => this.addFieldRow(f, true));

        this.addSeparator();

        this.addSectionHeader('Hidden fields');
        if (hidden.length === 0) this.addEmptyRow('No hidden fields');
        else hidden.forEach(f => this.addFieldRow(f, false));
    }

    private addSectionHeader(text: string) { if (!this.menuElement) return; const h = document.createElement('div'); h.textContent = text; h.style.padding='6px 12px'; h.style.fontSize='11px'; h.style.fontWeight='600'; h.style.color='var(--vscode-descriptionForeground)'; h.style.textTransform='uppercase'; this.menuElement.appendChild(h); }
    private addEmptyRow(text: string) { if (!this.menuElement) return; const r = document.createElement('div'); r.textContent = text; r.style.padding='6px 12px'; r.style.color='var(--vscode-menu-foreground)'; r.style.opacity='0.8'; this.menuElement.appendChild(r); }

    private addFieldRow(field: FieldItem, visible: boolean) {
        if (!this.menuElement) return;
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.padding = '6px 12px'; row.style.cursor='pointer'; row.style.color='var(--vscode-menu-foreground)';

        if (visible) { const c = document.createElement('span'); c.textContent = '✓'; c.style.marginRight='8px'; c.style.color='var(--vscode-menu-selectionForeground)'; row.appendChild(c); }
        else { const s = document.createElement('span'); s.style.display='inline-block'; s.style.width='14px'; s.style.marginRight='8px'; row.appendChild(s); }

            // Determine icon SVG based on field dataType or provided iconClass. Use placeholder tokens for octicon paths so user can replace them later.
            const iconHtml = this.getIconForField(field);
            const icon = document.createElement('span');
            icon.innerHTML = iconHtml;
            icon.style.marginRight = '8px';
            icon.style.display = 'inline-flex';
            icon.style.alignItems = 'center';
            row.appendChild(icon);
        const label = document.createElement('span'); label.textContent = field.name; label.style.flex='1'; label.style.whiteSpace='nowrap'; label.style.overflow='hidden'; label.style.textOverflow='ellipsis'; row.appendChild(label);

        row.addEventListener('mouseenter', () => { row.style.background='var(--vscode-menu-selectionBackground)'; row.style.color='var(--vscode-menu-selectionForeground)'; });
        row.addEventListener('mouseleave', () => { row.style.background='transparent'; row.style.color='var(--vscode-menu-foreground)'; });
        row.addEventListener('click', () => {
            const newVisible = !visible;
            this.options.onToggleVisibility?.(field.id, newVisible);
            if (newVisible) this.options.visibleFieldIds.add(field.id); else this.options.visibleFieldIds.delete(field.id);
            this.menuElement && (this.menuElement.innerHTML = '', this.buildMenu());
        });

        this.menuElement.appendChild(row);
    }

    private addSeparator() { if (!this.menuElement) return; const s = document.createElement('div'); s.style.height='1px'; s.style.background='var(--vscode-menu-separatorBackground)'; s.style.margin='6px 0'; this.menuElement.appendChild(s); }

    /**
     * Return inline SVG HTML for the given field, using placeholder tokens for octicon path data.
     * The placeholders can be replaced later with real octicon `d` path strings.
     */
    private getIconForField(field: FieldItem): string {
        const t = (field.dataType || '').toString().toLowerCase();

        // Build an SVG element. If `inner` begins with '<' or a placeholder token prefix,
        // treat it as raw inner HTML (allows multiple <path> nodes). Otherwise wrap as a single path.
        const svg = (cls: string, inner: string) => {
            if (typeof inner === 'string' && (inner.startsWith('<') || inner.startsWith('__OCTICON_'))) {
                return `<svg class="octicon ${cls}" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">${inner}</svg>`;
            }
            return `<svg class="octicon ${cls}" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${inner}"/></svg>`;
        };

        // Map only by dataType (do not inspect field name)
        switch (t) {
            case 'title':
                return svg('octicon-list-unordered', 'M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z');
            case 'assignees':
            case 'reviewers':
                return svg('octicon-people', 'M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z');
            case 'single_select':
                return svg('octicon-single-select', '<path d="m5.06 7.356 2.795 2.833c.08.081.21.081.29 0l2.794-2.833c.13-.131.038-.356-.145-.356H5.206c-.183 0-.275.225-.145.356Z"></path><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Z"></path>');
            case 'labels':
                return svg('octicon-tag', '<path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25"></path>');
            case 'parent_issue':
                return svg('octicon-issue-tracks', '<path d="M1.5 8a6.5 6.5 0 0 1 13 0A.75.75 0 0 0 16 8a8 8 0 1 0-8 8 .75.75 0 0 0 0-1.5A6.5 6.5 0 0 1 1.5 8Z"></path><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm3.573 5.823-2.896-2.896a.25.25 0 0 1 0-.354l2.896-2.896a.25.25 0 0 1 .427.177V11.5h3.25a.75.75 0 0 1 0 1.5H12v2.146a.25.25 0 0 1-.427.177Z"></path>');
            case 'sub_issues_progress':
                return svg('octicon-issue-tracked-by', '<path d="M1.5 8a6.5 6.5 0 0 1 13 0A.75.75 0 0 0 16 8a8 8 0 1 0-8 8 .75.75 0 0 0 0-1.5A6.5 6.5 0 0 1 1.5 8Z"></path><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 1.75a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Zm2.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"></path>');
            case 'iteration':
                return svg('octicon-iterations', '<path d="M2.5 7.25a4.75 4.75 0 0 1 9.5 0 .75.75 0 0 0 1.5 0 6.25 6.25 0 1 0-6.25 6.25H12v2.146c0 .223.27.335.427.177l2.896-2.896a.25.25 0 0 0 0-.354l-2.896-2.896a.25.25 0 0 0-.427.177V12H7.25A4.75 4.75 0 0 1 2.5 7.25Z"></path>');
            case 'number':
            case 'numeric':
                return svg('octicon-number', '<path d="M9 4.75A.75.75 0 0 1 9.75 4h4a.75.75 0 0 1 .53 1.28l-1.89 1.892c.312.076.604.18.867.319.742.391 1.244 1.063 1.244 2.005 0 .653-.231 1.208-.629 1.627-.386.408-.894.653-1.408.777-1.01.243-2.225.063-3.124-.527a.751.751 0 0 1 .822-1.254c.534.35 1.32.474 1.951.322.306-.073.53-.201.67-.349.129-.136.218-.32.218-.596 0-.308-.123-.509-.444-.678-.373-.197-.98-.318-1.806-.318a.75.75 0 0 1-.53-1.28l1.72-1.72H9.75A.75.75 0 0 1 9 4.75Zm-3.587 5.763c-.35-.05-.77.113-.983.572a.75.75 0 1 1-1.36-.632c.508-1.094 1.589-1.565 2.558-1.425 1 .145 1.872.945 1.872 2.222 0 1.433-1.088 2.192-1.79 2.681-.308.216-.571.397-.772.573H7a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75c0-.69.3-1.211.67-1.61.348-.372.8-.676 1.15-.92.8-.56 1.18-.904 1.18-1.474 0-.473-.267-.69-.587-.737ZM5.604.089A.75.75 0 0 1 6 .75v4.77h.711a.75.75 0 0 1 0 1.5H3.759a.75.75 0 0 1 0-1.5H4.5V2.15l-.334.223a.75.75 0 0 1-.832-1.248l1.5-1a.75.75 0 0 1 .77-.037Z"></path>');
            case 'date':
                return svg('octicon-calendar', '<path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z"></path>');
            case 'linked_pull_request':
            case 'linked_pull_requests':
            case 'pull_request':
                // Accept multiple possible dataType variants used across the codebase
                return svg('octicon-git-pull-request', '<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>');
            case 'milestone':
                return svg('octicon-milestone', '<path d="M7.75 0a.75.75 0 0 1 .75.75V3h3.634c.414 0 .814.147 1.13.414l2.07 1.75a1.75 1.75 0 0 1 0 2.672l-2.07 1.75a1.75 1.75 0 0 1-1.13.414H8.5v5.25a.75.75 0 0 1-1.5 0V10H2.75A1.75 1.75 0 0 1 1 8.25v-3.5C1 3.784 1.784 3 2.75 3H7V.75A.75.75 0 0 1 7.75 0Zm4.384 8.5a.25.25 0 0 0 .161-.06l2.07-1.75a.248.248 0 0 0 0-.38l-2.07-1.75a.25.25 0 0 0-.161-.06H2.75a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h9.384Z"></path>');
            case 'repository':
                return svg('octicon-repo', '<path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>');
            case 'text':
            case 'string':
                return svg('octicon-typography', '<path d="M6.71 10H2.332l-.874 2.498a.75.75 0 0 1-1.415-.496l3.39-9.688a1.217 1.217 0 0 1 2.302.018l3.227 9.681a.75.75 0 0 1-1.423.474Zm3.13-4.358C10.53 4.374 11.87 4 13 4c1.5 0 3 .939 3 2.601v5.649a.75.75 0 0 1-1.448.275C13.995 12.82 13.3 13 12.5 13c-.77 0-1.514-.231-2.078-.709-.577-.488-.922-1.199-.922-2.041 0-.694.265-1.411.887-1.944C11 7.78 11.88 7.5 13 7.5h1.5v-.899c0-.54-.5-1.101-1.5-1.101-.869 0-1.528.282-1.84.858a.75.75 0 1 1-1.32-.716ZM6.21 8.5 4.574 3.594 2.857 8.5Zm8.29.5H13c-.881 0-1.375.22-1.637.444-.253.217-.363.5-.363.806 0 .408.155.697.39.896.249.21.63.354 1.11.354.732 0 1.26-.209 1.588-.449.35-.257.412-.495.412-.551Z"></path>');
            default:
                // Fallback: use provided CSS iconClass if available, else generic tag icon placeholder
                if (field.iconClass) {
                    // return a simple <i> element to allow existing classes to apply
                    return `<i class="${field.iconClass}"></i>`;
                }
                return svg('octicon-tag', '__OCTICON_TAG_PATH__');
        }
    }
}

export default FieldsMenu;
