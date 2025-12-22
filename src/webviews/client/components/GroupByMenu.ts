import { GroupDataService } from '../services/GroupDataService';

export interface GroupByMenuOptions {
  fields: { id: string; name: string; iconClass?: string; dataType?: string }[];
  items?: any[];
  current?: string | null;
  title?: string; // Dynamic title: "Column by", "Swimlanes", "Group by"
  onSelect?: (fieldName: string | null) => void;
}

export class GroupByMenu {
  private options: GroupByMenuOptions;
  private menuEl: HTMLElement | null = null;
  private backdropEl: HTMLElement | null = null;
  private anchor: HTMLElement | null = null;
  private anchorRect: DOMRect | undefined = undefined;

  constructor(options: GroupByMenuOptions) {
    this.options = options;
  }

  public show(anchor: HTMLElement, anchorRect?: DOMRect): { el: HTMLElement | null; refresh: () => void } {
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
      document.querySelectorAll('[data-menu-type="fields-menu"], [data-menu-type="group-by-menu"]').forEach((n) => n.remove());
    } catch (e) { }

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'group-by-menu';
    this.menuEl.dataset.menuType = 'group-by-menu';
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
    title.textContent = this.options.title || 'Group by';
    title.style.padding = '6px 12px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--vscode-descriptionForeground)';
    title.style.fontSize = '12px';
    this.menuEl.appendChild(title);

    this.addSeparator();

    // "No grouping" option
    const noneRow = document.createElement('div');
    noneRow.style.display = 'flex';
    noneRow.style.alignItems = 'center';
    noneRow.style.padding = '6px 12px';
    noneRow.style.cursor = 'pointer';

    const noneCheck = document.createElement('span');
    noneCheck.style.display = 'inline-flex';
    noneCheck.style.width = '14px';
    noneCheck.style.marginRight = '8px';
    noneCheck.style.alignItems = 'center';
    noneCheck.style.justifyContent = 'center';
    if (!this.options.current) {
      noneCheck.textContent = '✓';
      noneCheck.style.color = 'var(--vscode-menu-selectionForeground)';
    }
    noneRow.appendChild(noneCheck);

    const noneLabel = document.createElement('span');
    noneLabel.textContent = 'No grouping';
    noneRow.appendChild(noneLabel);

    noneRow.addEventListener('mouseenter', () => {
      noneRow.style.background = 'var(--vscode-menu-selectionBackground)';
      noneRow.style.color = 'var(--vscode-menu-selectionForeground)';
    });
    noneRow.addEventListener('mouseleave', () => {
      noneRow.style.background = 'transparent';
      noneRow.style.color = 'var(--vscode-menu-foreground)';
    });
    noneRow.addEventListener('click', () => {
      this.options.current = null;
      this.options.onSelect?.(null);
      this.refresh();
    });
    this.menuEl.appendChild(noneRow);

    this.addSeparator();

    // Determine candidate fields
    let candidateFields = this.options.fields || [];
    try {
      if (this.options.items && Array.isArray(this.options.items) && this.options.items.length > 0) {
        candidateFields = (this.options.fields || []).filter((f: any) => {
          try {
            const groups = GroupDataService.groupItems(this.options.items || [], f);
            return Array.isArray(groups) && groups.length > 0;
          } catch (e) {
            return false;
          }
        });
      }
    } catch (e) { }

    (candidateFields || []).forEach(f => {
      const r = document.createElement('div');
      r.style.display = 'flex';
      r.style.alignItems = 'center';
      r.style.padding = '6px 12px';
      r.style.cursor = 'pointer';

      // leading checkmark
      const check = document.createElement('span');
      check.style.display = 'inline-flex';
      check.style.width = '14px';
      check.style.marginRight = '8px';
      check.style.alignItems = 'center';
      check.style.justifyContent = 'center';
      const currentVal = this.options.current ? String(this.options.current).toLowerCase() : null;
      const matchesCurrent = currentVal && (String(f.id).toLowerCase() === currentVal || String(f.name || '').toLowerCase() === currentVal);
      if (matchesCurrent) {
        check.textContent = '✓';
        check.style.color = 'var(--vscode-menu-selectionForeground)';
      }
      r.appendChild(check);

      // left icon (field type)
      const left = document.createElement('span');
      left.style.display = 'inline-flex';
      left.style.alignItems = 'center';
      left.style.justifyContent = 'center';
      left.style.marginRight = '8px';
      try {
        const dt = (f.dataType || '').toString().toLowerCase();
        if (typeof (window as any).getIconNameForDataType === 'function' && typeof (window as any).getIconSvg === 'function') {
          const iconName = (window as any).getIconNameForDataType(dt);
          left.innerHTML = (window as any).getIconSvg(iconName) || '';
          left.querySelectorAll && left.querySelectorAll('svg').forEach((s: any) => s.setAttribute && s.setAttribute('fill', 'currentColor'));
        } else if (f.iconClass) {
          left.innerHTML = `<i class="${f.iconClass}"></i>`;
        }
      } catch (e) { }
      r.appendChild(left);

      const label = document.createElement('div');
      label.textContent = f.name;
      label.style.flex = '1';
      r.appendChild(label);

      // Hover effects
      r.addEventListener('mouseenter', () => {
        r.style.background = 'var(--vscode-menu-selectionBackground)';
        r.style.color = 'var(--vscode-menu-selectionForeground)';
      });
      r.addEventListener('mouseleave', () => {
        r.style.background = 'transparent';
        r.style.color = 'var(--vscode-menu-foreground)';
      });

      // Click: update current and refresh (don't close)
      r.addEventListener('click', () => {
        this.options.current = String(f.name);
        this.options.onSelect?.(String(f.name));
        this.refresh();
      });

      this.menuEl!.appendChild(r);
    });
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

  // Refresh content without closing/repositioning
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

export default GroupByMenu;

