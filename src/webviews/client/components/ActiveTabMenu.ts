export interface MenuItem {
  id?: string;
  label: string;
  info?: string;
  forceChevron?: boolean;
  iconName?: string; // optional icon rendered to the left
  onClick?: (anchor?: HTMLElement, anchorRect?: DOMRect) => any;
  children?: MenuItem[];
}

export interface ActiveTabMenuOptions {
  anchorElement: HTMLElement;
  items: MenuItem[] | (() => MenuItem[]);
}

import MenuManager from './menuManager';

export class ActiveTabMenu {
  private anchorElement: HTMLElement;
  private itemsSource: MenuItem[] | (() => MenuItem[]);
  private buttonEl: HTMLElement | null = null;
  private menuEl: HTMLElement | null = null;
  private backdropEl: HTMLElement | null = null;
  private openSubmenuEl: HTMLElement | null = null;
  // Optional refresh callback for externally created submenus (e.g., FieldsMenu instances)
  private externalSubmenuRefresh: (() => void) | null = null;

  constructor(options: ActiveTabMenuOptions) {
    this.anchorElement = options.anchorElement;
    this.itemsSource = options.items || [];
    this.attachButton();
  }

  private attachButton() {
    // Create small button to the right of the anchor element
    const btn = document.createElement("button");
    btn.className = "active-tab-menu-button";
    btn.type = "button";
    btn.title = "Open view menu";
    btn.style.border = "none";
    btn.style.background = "transparent";
    btn.style.padding = "0 4px";
    btn.style.marginLeft = "8px";
    btn.style.cursor = "pointer";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";

    // Match the icon color to the anchor text color
    try {
      const computed = window.getComputedStyle(this.anchorElement);
      if (computed && computed.color) {
        btn.style.color = computed.color;
      }
    } catch (e) {
      // ignore
    }

    const iconSpan = document.createElement("span");
    iconSpan.style.display = "inline-flex";
    iconSpan.style.alignItems = "center";
    iconSpan.style.justifyContent = "center";
    iconSpan.style.height = "16px";
    iconSpan.style.width = "16px";
    iconSpan.style.lineHeight = "1";
    // Use global icon registry helper if available
    iconSpan.innerHTML = (window as any).getIconSvg?.("triangle-down") || "";
    // Ensure svg inherits the current color
    const svgs = iconSpan.querySelectorAll("svg");
    svgs.forEach((s) => s.setAttribute("fill", "currentColor"));

    btn.appendChild(iconSpan);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.buttonEl = btn;

    // Insert button after the anchor element
    if (this.anchorElement.parentElement) {
      this.anchorElement.parentElement.insertBefore(btn, this.anchorElement.nextSibling);
    }
  }

  public toggle() {
    if (this.menuEl) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show() {
    // Close any other open menus before showing
    try { MenuManager.closeAll(); } catch (e) { }
    this.hide();

    // backdrop to close when clicking outside
    this.backdropEl = document.createElement("div");
    this.backdropEl.style.position = "fixed";
    this.backdropEl.style.top = "0";
    this.backdropEl.style.left = "0";
    this.backdropEl.style.right = "0";
    this.backdropEl.style.bottom = "0";
    this.backdropEl.style.zIndex = "998";
    this.backdropEl.addEventListener("click", () => this.hide());
    this.backdropEl.dataset.menuType = 'active-tab-menu';
    document.body.appendChild(this.backdropEl);

    this.menuEl = document.createElement("div");
    this.menuEl.className = "active-tab-menu";
    this.menuEl.dataset.menuType = 'active-tab-menu';
    this.menuEl.style.position = "absolute";
    this.menuEl.style.background = "var(--vscode-menu-background)";
    this.menuEl.style.border = "1px solid var(--vscode-menu-border)";
    this.menuEl.style.borderRadius = "4px";
    this.menuEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    this.menuEl.style.width = "320px";
    this.menuEl.style.padding = "4px 0";
    this.menuEl.style.zIndex = "1000";
    this.menuEl.style.fontSize = "13px";

    document.body.appendChild(this.menuEl);
    const items = typeof this.itemsSource === 'function' ? this.itemsSource() : this.itemsSource;
    this.buildMenu(this.menuEl, items);

    const rect = (this.buttonEl || this.anchorElement).getBoundingClientRect();
    const menuRect = this.menuEl.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    let top = rect.bottom + margin;
    if (rect.bottom + menuRect.height + margin > vh) {
      if (rect.top - menuRect.height - margin >= 0) {
        top = rect.top - menuRect.height - margin;
      } else {
        top = Math.max(margin, Math.min(vh - menuRect.height - margin, rect.bottom + margin));
      }
    }

      try { MenuManager.register(this.menuEl, this.refresh.bind(this)); } catch (e) { }
    let left = rect.left;
    if (rect.left + menuRect.width + margin > vw) {
      left = Math.max(margin, rect.right - menuRect.width);
    }
    left = Math.max(margin, Math.min(left, vw - menuRect.width - margin));

    this.menuEl.style.top = `${Math.round(top)}px`;
    this.menuEl.style.left = `${Math.round(left)}px`;
  }

  public hide() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    if (this.backdropEl) {
      this.backdropEl.remove();
      this.backdropEl = null;
    }
    this.closeOpenSubmenu();
  }

  // Refresh the menu content while it's open (for live updates)
  public refresh() {
    if (this.menuEl) {
      this.menuEl.innerHTML = '';
      const items = typeof this.itemsSource === 'function' ? this.itemsSource() : this.itemsSource;
      this.buildMenu(this.menuEl, items);
      // If an external submenu provided a refresh callback, invoke it so it can update too
      try { if (this.externalSubmenuRefresh) this.externalSubmenuRefresh(); } catch (e) { }
    }
  }

  // Remove all DOM elements created by this instance (button + menus)
  public destroy() {
    try {
      this.hide();
    } catch (e) { }
    if (this.buttonEl) {
      try {
        this.buttonEl.remove();
      } catch (e) { }
      this.buttonEl = null;
    }
  }

  private buildMenu(container: HTMLElement, items: MenuItem[]) {
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "active-tab-menu-item";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "6px 12px";
      row.style.cursor = "pointer";
      row.style.color = "var(--vscode-menu-foreground)";

      // Left icon (if any)
      if (item.iconName && (window as any).getIconSvg) {
        const leftIcon = document.createElement('span');
        leftIcon.style.display = 'inline-flex';
        leftIcon.style.alignItems = 'center';
        leftIcon.style.justifyContent = 'center';
        leftIcon.style.marginRight = '8px';
        leftIcon.innerHTML = (window as any).getIconSvg(item.iconName) || '';
        // make sure svg inherits color
        try { leftIcon.querySelectorAll && leftIcon.querySelectorAll('svg').forEach(s => s.setAttribute('fill', 'currentColor')); } catch (e) { }
        row.appendChild(leftIcon);
      }

      const labelEl = document.createElement("div");
      labelEl.style.flex = "1";
      labelEl.style.minWidth = "0";
      labelEl.style.overflow = "hidden";
      labelEl.style.whiteSpace = "nowrap";
      labelEl.style.textOverflow = "ellipsis";
      labelEl.style.marginRight = "8px";

      if (item.info) {
        const b = document.createElement("span");
        b.style.fontWeight = "600";
        b.textContent = item.label + ": ";
        labelEl.appendChild(b);

        const i = document.createElement("span");
        i.style.opacity = "0.7";
        i.textContent = item.info;
        labelEl.appendChild(i);
      } else {
        labelEl.style.fontWeight = "500";
        labelEl.textContent = item.label;
      }
      row.appendChild(labelEl);

      if ((item.children && item.children.length) || item.forceChevron) {
        const arrow = document.createElement("span");
        arrow.innerHTML = (window as any).getIconSvg?.("chevron-right") || "›";
        arrow.style.marginLeft = "auto";
        arrow.style.flex = "0 0 auto";
        arrow.style.opacity = "0.7";
        row.appendChild(arrow);

        if (item.children && item.children.length) {
          row.addEventListener("mouseenter", (e) => {
            this.openSubmenuForRow(row, item.children!);
          });
          row.addEventListener("mouseleave", (e) => {
            // submenu will be handled
          });
        }
      }

      if (item.children && item.children.length) {
        // handled above
        } else {
        row.addEventListener("click", (ev) => {
          try { ev.stopPropagation(); } catch (e) { }
          try {
            // Close any hover-opened submenu and external dropdowns before invoking click handler
            try { this.closeOpenSubmenu(); } catch (e) { }
            try { document.querySelectorAll('.roadmap-dropdown-menu').forEach((n) => (n as HTMLElement).remove()); } catch (e) { }
            const rect = row.getBoundingClientRect();
            const res: any = item.onClick ? item.onClick(row, rect) : undefined;
            // If handler returns a Promise, wait for it. If it resolves to true, keep parent open.
            if (res && typeof res.then === "function") {
              res
                .then((keepOpen: any) => {
                  if (!keepOpen) this.hide();
                })
                .catch(() => this.hide());
            } else {
              // If handler returned truthy true, keep open; otherwise close
              if (!res) this.hide();
            }
          } catch (err) {
            try {
              this.hide();
            } catch (e) { }
          }
        });
      }

      row.addEventListener("mouseenter", () => {
        row.style.background = "var(--vscode-menu-selectionBackground)";
        row.style.color = "var(--vscode-menu-selectionForeground)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "transparent";
        row.style.color = "var(--vscode-menu-foreground)";
      });

      container.appendChild(row);
    });
  }

  private openSubmenuForRow(row: HTMLElement, children: MenuItem[]) {
    // close any existing submenu
    this.closeOpenSubmenu();

    if (!this.menuEl) return;

    const submenu = document.createElement("div");
    submenu.className = "active-tab-submenu";
    submenu.style.position = "absolute";
    submenu.style.background = "var(--vscode-menu-background)";
    submenu.style.border = "1px solid var(--vscode-menu-border)";
    submenu.style.borderRadius = "4px";
    submenu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    submenu.style.minWidth = "160px";
    submenu.style.padding = "4px 0";
    submenu.style.zIndex = "1001";
    submenu.style.fontSize = "13px";

    document.body.appendChild(submenu);
    this.buildMenu(submenu, children);

    const parentRect = row.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const menuRect = this.menuEl.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const margin = 4;

    // Position to the right of the parent row
    let top = parentRect.top;
    if (top + submenuRect.height > vh) {
      top = Math.max(margin, Math.min(vh - submenuRect.height - margin, top));
    }

    // Remove any externally created dropdowns so only this submenu shows
    try { document.querySelectorAll('.roadmap-dropdown-menu').forEach(n => (n as HTMLElement).remove()); } catch (e) { }

    // Anchor submenu to the option row's right edge so submenus align with the row
    let left = parentRect.right + 4;
    // If would overflow viewport, try open to the left of the parent row
    if (left + submenuRect.width > vw) {
      left = parentRect.left - submenuRect.width - 4;
      // If still overflows, fall back to positioning against the parent menu
      if (left < margin) {
        left = Math.max(margin, Math.min(menuRect.right + 4, vw - submenuRect.width - margin));
      }
    }

    submenu.style.top = `${Math.round(top)}px`;
    submenu.style.left = `${Math.round(left)}px`;

    this.openSubmenuEl = submenu;

    // close submenu when mouse leaves it and parent menu
    submenu.addEventListener("mouseleave", () => {
      // small timeout to allow entering a nested submenu
      setTimeout(() => {
        if (this.openSubmenuEl === submenu) {
          this.closeOpenSubmenu();
        }
      }, 150);
    });
  }

  private closeOpenSubmenu() {
    if (this.openSubmenuEl) {
      this.openSubmenuEl.remove();
      this.openSubmenuEl = null;
      this.externalSubmenuRefresh = null;
    }
  }

  // Allow external submenus (created by other components) to be registered so
  // the ActiveTabMenu can close or refresh them when needed.
  public registerExternalSubmenu(el: HTMLElement | null, refreshFn?: () => void) {
    try {
      // Close any existing submenu first
      this.closeOpenSubmenu();
    } catch (e) { }
    if (el) {
      this.openSubmenuEl = el;
      this.externalSubmenuRefresh = refreshFn || null;
      try { MenuManager.register(el, refreshFn || null); } catch (e) { }
    }
  }
}

export default ActiveTabMenu;
