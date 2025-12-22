export interface FieldSumMenuOptions {
  fields: { id: string; name: string; dataType?: string; iconClass?: string }[];
  current: string[]; // array of ids (or '__count__')
  title?: string;
  onChange?: (selected: string[]) => void;
}

export class FieldSumMenu {
  private options: FieldSumMenuOptions;
  private menuEl: HTMLElement | null = null;
  private backdropEl: HTMLElement | null = null;
  private anchor: HTMLElement | null = null;

  constructor(options: FieldSumMenuOptions) {
    this.options = options;
  }

  public show(anchor: HTMLElement, anchorRect?: DOMRect): { el: HTMLElement | null; refresh: () => void } {
    this.hide();
    this.anchor = anchor;

    this.backdropEl = document.createElement('div');
    this.backdropEl.style.position = 'fixed';
    this.backdropEl.style.top = '0';
    this.backdropEl.style.left = '0';
    this.backdropEl.style.right = '0';
    this.backdropEl.style.bottom = '0';
    this.backdropEl.style.zIndex = '998';
    this.backdropEl.addEventListener('click', () => this.hide());
    document.body.appendChild(this.backdropEl);

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'field-sum-menu';
    this.menuEl.dataset.menuType = 'field-sum-menu';
    this.menuEl.style.position = 'absolute';
    this.menuEl.style.background = 'var(--vscode-menu-background)';
    this.menuEl.style.border = '1px solid var(--vscode-menu-border)';
    this.menuEl.style.borderRadius = '4px';
    this.menuEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    this.menuEl.style.minWidth = '200px';
    this.menuEl.style.maxHeight = '60vh';
    this.menuEl.style.overflowY = 'auto';
    this.menuEl.style.padding = '4px 0';
    this.menuEl.style.zIndex = '1000';
    this.menuEl.style.fontSize = '13px';
    document.body.appendChild(this.menuEl);

    this.buildMenu();
    this.positionMenu(anchorRect);
    return { el: this.menuEl, refresh: this.refresh.bind(this) };
  }

  private buildMenu() {
    if (!this.menuEl) return;
    this.menuEl.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = this.options.title || 'Field sum';
    title.style.padding = '6px 12px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--vscode-descriptionForeground)';
    title.style.fontSize = '12px';
    this.menuEl.appendChild(title);

    const addRow = (id: string, label: string, icon?: string, selected?: boolean) => {
      const r = document.createElement('div');
      r.style.display = 'flex';
      r.style.alignItems = 'center';
      r.style.padding = '6px 12px';
      r.style.cursor = 'pointer';

      const check = document.createElement('span');
      check.style.display = 'inline-flex';
      check.style.width = '14px';
      check.style.marginRight = '8px';
      check.style.alignItems = 'center';
      check.style.justifyContent = 'center';
      if (selected) { check.textContent = '✓'; check.style.color = 'var(--vscode-menu-selectionForeground)'; }
      r.appendChild(check);

      if (icon) {
        const left = document.createElement('span');
        left.style.display = 'inline-flex'; left.style.marginRight = '8px';
        try { left.innerHTML = (window as any).getIconSvg?.(icon) || ''; left.querySelectorAll && left.querySelectorAll('svg').forEach((s: any) => s.setAttribute && s.setAttribute('fill','currentColor')); } catch (e) {}
        r.appendChild(left);
      }

      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.flex = '1';
      r.appendChild(lbl);

      r.addEventListener('mouseenter', () => { r.style.background = 'var(--vscode-menu-selectionBackground)'; r.style.color = 'var(--vscode-menu-selectionForeground)'; });
      r.addEventListener('mouseleave', () => { r.style.background = 'transparent'; r.style.color = 'var(--vscode-menu-foreground)'; });

      r.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cur = new Set(this.options.current || []);
        if (cur.has(id)) cur.delete(id); else cur.add(id);
        this.options.current = Array.from(cur);
        try { if (typeof this.options.onChange === 'function') this.options.onChange(this.options.current); } catch (e) {}
        // keep menu open but update checks
        this.refresh();
      });

      this.menuEl!.appendChild(r);
    };

    // Count option
    const currentSet = new Set(this.options.current || []);
    addRow('__count__', 'Count', 'check', currentSet.has('__count__'));

    // Numeric fields
    (this.options.fields || []).forEach(f => {
      const dt = String(f.dataType || '').toLowerCase();
      if (dt === 'number' || dt === 'numeric' || dt.includes('num')) {
        addRow(String(f.id), f.name, 'number', currentSet.has(String(f.id)));
      }
    });
  }

  private positionMenu(anchorRect?: DOMRect) {
    if (!this.menuEl || !this.anchor) return;
    let rect = anchorRect;
    if (!rect) rect = this.anchor.getBoundingClientRect();

    const menuRect = this.menuEl.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    let left = rect.right + 4;
    if (left + menuRect.width > vw) {
      left = rect.left - menuRect.width - 4;
      if (left < 4) left = Math.max(4, Math.min(vw - menuRect.width - 4, rect.right - menuRect.width));
    }
    this.menuEl.style.top = `${Math.round(rect.bottom + 4)}px`;
    this.menuEl.style.left = `${Math.round(left)}px`;
  }

  public refresh() {
    if (this.menuEl) this.buildMenu();
  }

  public hide() {
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
    if (this.backdropEl) { this.backdropEl.remove(); this.backdropEl = null; }
  }
}

export default FieldSumMenu;
