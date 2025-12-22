export type RefreshFn = (() => void) | null;

class MenuManager {
  private static menus = new Set<HTMLElement>();
  private static refreshMap = new WeakMap<HTMLElement, RefreshFn>();

  // Close and remove all registered menus
  public static closeAll() {
    try {
      for (const el of Array.from(MenuManager.menus)) {
        try {
          // Remove any DOM elements that share the same data-menu-type (backdrops, helpers)
          try {
            const type = (el && el.dataset && el.dataset.menuType) || null;
            if (type) {
              const nodes = Array.from(document.querySelectorAll(`[data-menu-type="${type}"]`));
              for (const n of nodes) {
                try { n.remove(); } catch (e) { }
              }
            }
          } catch (e) { }

          if (el && el.parentElement) el.parentElement.removeChild(el);
        } catch (e) { }
        MenuManager.refreshMap.delete(el);
      }
    } catch (e) { }
    MenuManager.menus.clear();
  }

  // Register a menu element with an optional refresh callback
  public static register(menuEl: HTMLElement, refreshFn?: RefreshFn) {
    if (!menuEl) return;
    MenuManager.menus.add(menuEl);
    if (refreshFn) MenuManager.refreshMap.set(menuEl, refreshFn);
  }

  // Unregister without removing from DOM
  public static unregister(menuEl: HTMLElement) {
    if (!menuEl) return;
    MenuManager.menus.delete(menuEl);
    MenuManager.refreshMap.delete(menuEl);
  }

  // Refresh/reposition all registered menus by calling their refresh callbacks
  public static refreshAll() {
    try {
      for (const el of Array.from(MenuManager.menus)) {
        const fn = MenuManager.refreshMap.get(el);
        try { if (fn) fn(); } catch (e) { }
      }
    } catch (e) { }
  }
}

export default MenuManager;
