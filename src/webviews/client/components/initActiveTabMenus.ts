import ActiveTabMenu from './ActiveTabMenu';

function initOnce() {
  const tabsContainer = document.getElementById('tabs-container');
  if (!tabsContainer) return;

  let currentLabel: HTMLElement | null = null;
  const tabsContainerEl = tabsContainer as HTMLElement;

  function removeMenuFromLabel(label: HTMLElement | null) {
    if (!label) return;
    const inst = (label as any).__activeTabMenu as ActiveTabMenu | undefined;
    if (inst && typeof inst.destroy === 'function') {
      try {
        inst.destroy();
      } catch (e) { }
    }
    try {
      // remove any attached event listener for roadmap date changes
      const listener = (label as any).__activeTabMenuDateListener as any;
      if (listener) {
        try { window.removeEventListener('roadmap:dateFieldsChanged', listener); } catch (e) { }
        try { window.removeEventListener('roadmap:zoomChanged', listener); } catch (e) { }
      }
    } catch (e) { }
    try { delete (label as any).__activeTabMenu; delete (label as any).__activeTabMenuDateListener; } catch (e) { }
  }

  function attachMenuToActive() {
    // Find the currently active tab with data-layout (only view tabs should have menus)
    const activeTab = tabsContainerEl.querySelector('.tab.active') as HTMLElement | null;
    if (!activeTab) {
      // no active tab -> remove existing
      removeMenuFromLabel(currentLabel);
      currentLabel = null;
      return;
    }
    const layout = activeTab.getAttribute('data-layout');
    if (!layout) {
      // active tab is not a view tab
      removeMenuFromLabel(currentLabel);
      currentLabel = null;
      return;
    }

    const label = activeTab.querySelector('.tab-label') as HTMLElement | null;
    if (!label) return;

    // If a menu is already attached to this label, mark it as current and skip
    if ((label as any).__activeTabMenu) {
      currentLabel = label;
      return; // already attached
    }

    // remove previous
    removeMenuFromLabel(currentLabel);

    // create new menu for active label
    const viewKey = activeTab.getAttribute('data-viewkey') || null;

    const getItems = () => {
      const vsLocal = viewKey && (window as any).__viewStates ? (window as any).__viewStates[viewKey] : null;

      // Calculate fields info
      let fieldsInfo = "";
      if (vsLocal && vsLocal.fields) {
        const visibleSet = new Set(Array.from(vsLocal.visibleFieldIds || [] as any));
        const names = (vsLocal.fields as any[])
          .filter((f: any) => visibleSet.has(String(f.id)))
          .map((f: any) => f.name);
        fieldsInfo = names.join(", ");
      }

      // Calculate group info
      let groupInfo = "";
      if (vsLocal && vsLocal.current) {
        groupInfo = vsLocal.current;
      }

      // Calculate column info (board only)
      let columnInfo = "";
      if (vsLocal && vsLocal.currentColumn) {
        columnInfo = vsLocal.currentColumn;
      }

      const items: any[] = [];

      // Fields - only for table and board layouts
      if (layout === 'table' || layout === 'board') {
        items.push({
          label: 'Fields',
          info: fieldsInfo,
          forceChevron: true,
          iconName: 'note',
          onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
            // Lazy-load the FieldsMenu component
            return import('./FieldsMenu')
              .then(({ FieldsMenu }) => {
                try {
                  // Close any open submenu in the parent ActiveTabMenu
                  try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                  const fields = (vsLocal && vsLocal.fields) || [];
                  const visible = new Set<string>(
                    vsLocal && vsLocal.visibleFieldIds
                      ? Array.from(vsLocal.visibleFieldIds).map((x: any) => String(x))
                      : []
                  );
                  const menu = new FieldsMenu({
                    fields: (fields || []).map((f: any) => ({
                      id: String(f.id),
                      name: f.name,
                      iconClass: f.iconClass,
                      dataType: f.dataType,
                      locked: f.name === "Title"
                    })),
                    visibleFieldIds: visible as unknown as Set<string>,
                    onToggleVisibility: (fieldId: string, visibleFlag: boolean) => {
                      try {
                        if (vsLocal && typeof vsLocal.onToggleVisibility === 'function') {
                          vsLocal.onToggleVisibility(String(fieldId), visibleFlag);
                        }
                        // Refresh parent menu to show updated info
                        setTimeout(() => {
                          const parentMenu = (label as any).__activeTabMenu;
                          if (parentMenu && typeof parentMenu.refresh === 'function') {
                            parentMenu.refresh();
                          }
                        }, 50);
                      } catch (e) { }
                    },
                  });
                  const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                  try {
                    const parentMenuInst = (label as any).__activeTabMenu;
                    if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                      try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                    }
                  } catch (e) { }
                } catch (e) { }
                return true;
              })
              .catch(() => false);
          },
        });
      }

      // (Table/board Field sum is added after Sort-by so it appears later)

      // Column by - only for board layout
      if (layout === 'board') {
        items.push({
          label: 'Column by',
          info: columnInfo,
          forceChevron: true,
          iconName: 'columns',
          onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
            // Lazy-load GroupByMenu for column selection (reuse same component)
            return import('./GroupByMenu')
              .then(({ default: GroupByMenu }) => {
                try {
                  // Close any open submenu in the parent ActiveTabMenu
                  try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                  const fields = (vsLocal && vsLocal.fields) || [];
                  // Only single_select and iteration fields for columns
                  const columnFields = (fields || []).filter((f: any) => {
                    const raw = String((f.dataType || f.type || '')).toLowerCase();
                    return raw === 'single_select' || raw.includes('iteration');
                  });
                  const menu = new GroupByMenu({
                    title: 'Column by',
                    fields: (columnFields || []).map((f: any) => ({ id: String(f.id), name: f.name, iconClass: f.iconClass, dataType: f.dataType })),
                    items: vsLocal && vsLocal.items ? vsLocal.items : [],
                    current: vsLocal && vsLocal.currentColumn ? vsLocal.currentColumn : null,
                    onSelect: (fieldName: string | null) => {
                      try {
                        if (vsLocal && typeof vsLocal.onSetColumnBy === 'function') {
                          vsLocal.onSetColumnBy(fieldName);
                        }
                        // Refresh parent menu to show updated info
                        setTimeout(() => {
                          const parentMenu = (label as any).__activeTabMenu;
                          if (parentMenu && typeof parentMenu.refresh === 'function') {
                            parentMenu.refresh();
                          }
                        }, 50);
                      } catch (e) { }
                    },
                  });
                  const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                  try {
                    const parentMenuInst = (label as any).__activeTabMenu;
                    if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                      try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                    }
                  } catch (e) { }
                } catch (e) { }
                return true;
              })
              .catch(() => false);
          },
        });
      }

      

      // Group by / Swimlanes - available for all views (3rd option)
      items.push({
        label: layout === 'board' ? 'Swimlanes' : 'Group by',
        info: groupInfo,
        forceChevron: true,
        iconName: 'rows',
        onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
          // Lazy-load GroupByMenu
          return import('./GroupByMenu')
            .then(({ default: GroupByMenu }) => {
              try {
                // Close any open submenu in the parent ActiveTabMenu
                try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                const fields = (vsLocal && vsLocal.fields) || [];
                const groupable = (fields || []).filter((f: any) => {
                  const raw = String((f.dataType || f.type || f.name || '')).toLowerCase();
                  if (raw.includes('assign') || raw.includes('assignee')) return true;
                  if (raw.includes('repo') || raw.includes('repository')) return true;
                  if (raw.includes('parent')) return true;
                  if (raw.includes('num') || raw.includes('number') || raw.includes('numeric')) return true;
                  if (raw.includes('iteration')) return true;
                  if (raw.includes('single') && raw.includes('select')) return true;
                  if (raw.includes('milestone')) return true;
                  if (raw.includes('date')) return true;
                  if (raw.includes('text')) return true;
                  return false;
                });
                const menu = new GroupByMenu({
                  title: layout === 'board' ? 'Swimlanes' : 'Group by',
                  fields: (groupable || []).map((f: any) => ({ id: String(f.id), name: f.name, iconClass: f.iconClass, dataType: f.dataType })),
                  items: vsLocal && vsLocal.items ? vsLocal.items : [],
                  current: vsLocal && (vsLocal.current || vsLocal.currentGrouping) ? (vsLocal.current || vsLocal.currentGrouping) : null,
                  onSelect: (fieldName: string | null) => {
                    try {
                      if (vsLocal && typeof vsLocal.onSetGroupBy === 'function') {
                        vsLocal.onSetGroupBy(fieldName);
                      }
                      // Refresh parent menu to show updated info
                      setTimeout(() => {
                        const parentMenu = (label as any).__activeTabMenu;
                        if (parentMenu && typeof parentMenu.refresh === 'function') {
                          parentMenu.refresh();
                        }
                      }, 50);
                    } catch (e) { }
                  },
                });
                  const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                  try {
                    const parentMenuInst = (label as any).__activeTabMenu;
                    if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                      try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                    }
                  } catch (e) { }
              } catch (e) { }
              return true;
            })
            .catch(() => false);
        },
      });

      // Markers - only for roadmap layout (4th option)
      if (layout === 'roadmap') {
        // Build info text showing currently active markers (Milestones + selected fields)
        let markersInfo = '';
        try {
          const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
          if (roadmapRenderer && typeof roadmapRenderer.getActiveMarkers === 'function') {
            const active = roadmapRenderer.getActiveMarkers();
            if (Array.isArray(active) && active.length > 0) {
              const names = active.map((id: any) => {
                if (String(id) === 'milestones') return 'Milestones';
                const f = (vsLocal && vsLocal.fields) ? (vsLocal.fields as any[]).find((ff: any) => String(ff.id) === String(id) || ff.name === id) : null;
                return f ? f.name : String(id);
              });
              markersInfo = names.join(', ');
            } else {
              markersInfo = 'None';
            }
          }
        } catch (e) { }

        items.push({
          label: 'Markers',
          info: markersInfo,
          forceChevron: true,
          iconName: 'location',
          onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
            try {
              // Use the RoadmapRenderer's showMarkersMenu directly
              const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
              if (roadmapRenderer && typeof roadmapRenderer.showMarkersMenu === 'function') {
                // Close any existing dropdowns/submenus so only one is open
                try { document.querySelectorAll('.roadmap-dropdown-menu').forEach((n) => (n as HTMLElement).remove()); } catch (e) { }
                try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                // Create a synthetic MouseEvent with currentTarget (prefer the option row `anchor`)
                // If an `anchorRect` was provided use a lightweight object with a `getBoundingClientRect`
                // so the roadmap menu can re-position itself even if the original row DOM node is later removed.
                const syntheticEvent = {
                  currentTarget: anchorRect ? ({ getBoundingClientRect: () => anchorRect } as unknown as HTMLElement) : (anchor || label)
                } as unknown as MouseEvent;
                try {
                  const created = roadmapRenderer.showMarkersMenu(syntheticEvent);
                  const parentMenuInst = (label as any).__activeTabMenu;
                  if (created && created.el && parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function') {
                    try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                  }
                } catch (e) { }
              }
            } catch (e) { }
            return true;
          },
        });
      }

      // Sort by - available for table/board/roadmap (placed after Markers)
      if (layout === 'table' || layout === 'board' || layout === 'roadmap') {
        // Normalize sort info so invalid values (like a project id) show as 'None'
        let sortInfo = 'None';
        let sortCurrent: string | null = null;
        try {
          const cur = vsLocal && (vsLocal.currentSort || vsLocal.currentSortName);
          if (cur) {
            if (typeof cur === 'string') {
              const f = (vsLocal && vsLocal.fields ? (vsLocal.fields as any[]) : []).find((ff: any) => String(ff.id) === String(cur) || ff.name === cur);
              if (f) { sortInfo = f.name || String(f.id); sortCurrent = String(f.id); }
              else { sortInfo = 'None'; sortCurrent = null; }
            } else if (typeof cur === 'object' && cur.fieldId) {
              const f = (vsLocal && vsLocal.fields ? (vsLocal.fields as any[]) : []).find((ff: any) => String(ff.id) === String(cur.fieldId));
              if (f) { sortInfo = f.name || String(f.id); sortCurrent = String(f.id); }
              else { sortInfo = 'None'; sortCurrent = null; }
            } else {
              sortInfo = 'None'; sortCurrent = null;
            }
          } else {
            sortInfo = 'None'; sortCurrent = null;
          }
        } catch (e) { sortInfo = 'None'; sortCurrent = null; }

        items.push({
          label: 'Sort by',
          info: sortInfo,
          forceChevron: true,
          iconName: 'arrow-up-down',
          onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
            return import('./SortByMenu')
              .then(({ SortByMenu }) => {
                try {
                  // Close any open submenu in the parent ActiveTabMenu
                  try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                  const fields = (vsLocal && vsLocal.fields) || [];
                  const menu = new SortByMenu({
                    fields: (fields || []).map((f: any) => ({ id: String(f.id), name: f.name, iconClass: f.iconClass, dataType: f.dataType })),
                    current: sortCurrent,
                    onSelect: (fieldId: string | null) => {
                      try {
                        if (vsLocal && typeof vsLocal.onSetSort === 'function') {
                          vsLocal.onSetSort(fieldId);
                        }
                        setTimeout(() => {
                          const parentMenu = (label as any).__activeTabMenu;
                          if (parentMenu && typeof parentMenu.refresh === 'function') {
                            parentMenu.refresh();
                          }
                        }, 50);
                      } catch (e) { }
                    }
                  });
                  const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                  try {
                    const parentMenuInst = (label as any).__activeTabMenu;
                    if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                      try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                    }
                  } catch (e) { }
                } catch (e) { }
                return true;
              })
              .catch(() => false);
          },
        });
      }

      // Insert Field sum for table/board immediately after Sort-by (so it's later in the list)
      if (layout === 'table' || layout === 'board') {
        try {
          // Compute info text from current selection
          let fdInfo = '';
          try {
            const cur = (vsLocal && (vsLocal.groupDivisors || null));
            if (Array.isArray(cur) && cur.length > 0) {
              const fields = (vsLocal && vsLocal.fields) || [];
              const names = cur.map((id: any) => {
                if (String(id) === '__count__') return 'Count';
                const f = (fields || []).find((ff: any) => String(ff.id) === String(id) || ff.name === id);
                return f ? f.name : String(id);
              });
              fdInfo = names.join(', ');
            } else if (cur === null) fdInfo = 'None';
          } catch (e) { }

          items.push({
            label: 'Field sum',
            info: fdInfo,
            forceChevron: true,
            iconName: 'number',
            onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
              return import('./FieldSumMenu')
                .then(({ default: FieldSumMenu, FieldSumMenu: FieldSumMenuClass }) => {
                  try {
                    try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                    const fields = (vsLocal && vsLocal.fields) || [];
                    const current = (vsLocal && (vsLocal.groupDivisors || [])) || [];
                    const menu = new (FieldSumMenuClass || FieldSumMenu)({
                      fields: (fields || []).map((f: any) => ({ id: String(f.id), name: f.name, dataType: f.dataType })),
                      current: Array.isArray(current) ? current : [],
                      title: 'Field sum',
                      onChange: (selected: string[]) => {
                        try {
                          if (vsLocal && typeof vsLocal.onSetGroupDivisors === 'function') {
                            vsLocal.onSetGroupDivisors(selected && selected.length ? selected : null);
                          }
                          setTimeout(() => {
                            const parentMenu = (label as any).__activeTabMenu;
                            if (parentMenu && typeof parentMenu.refresh === 'function') parentMenu.refresh();
                          }, 50);
                        } catch (e) { }
                      }
                    });
                    const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                    try {
                      const parentMenuInst = (label as any).__activeTabMenu;
                      if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                        try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                      }
                    } catch (e) { }
                  } catch (e) { }
                  return true;
                })
                .catch(() => false);
            }
          });
        } catch (e) { }
      }

      // Date - only for roadmap layout (placed after Sort by)
      if (layout === 'roadmap') {
        // Build info text from roadmap renderer's selected start/end fields
        let dateInfo = '';
        try {
          const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
          if (roadmapRenderer) {
            const startId = (roadmapRenderer as any).startDateFieldId || (roadmapRenderer as any).startDateField || null;
            const endId = (roadmapRenderer as any).endDateFieldId || (roadmapRenderer as any).endDateField || null;
            const fields = (vsLocal && vsLocal.fields) || [];
            const startName = startId ? (fields as any[]).find((f: any) => String(f.id) === String(startId))?.name : null;
            const endName = endId ? (fields as any[]).find((f: any) => String(f.id) === String(endId))?.name : null;
            if (startName && endName) {
              dateInfo = startName === endName ? startName : `${startName} & ${endName}`;
            } else if (startName) {
              dateInfo = startName;
            } else if (endName) {
              dateInfo = endName;
            }
          }
        } catch (e) { /* ignore */ }

        items.push({
          label: 'Date',
          info: dateInfo,
          forceChevron: true,
          iconName: 'calendar',
          onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
            try {
              const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
              if (roadmapRenderer && typeof roadmapRenderer.showDateFieldsMenu === 'function') {
                // Close any existing dropdowns/submenus so only one is open
                try { document.querySelectorAll('.roadmap-dropdown-menu').forEach((n) => (n as HTMLElement).remove()); } catch (e) { }
                try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                // Prefer the option row `anchor` as the anchor so submenu aligns to the row
                const parentMenuEl = (label as any).__activeTabMenu && (label as any).__activeTabMenu.menuEl ? (label as any).__activeTabMenu.menuEl as HTMLElement : undefined;
                const syntheticEvent = {
                  currentTarget: anchorRect ? ({ getBoundingClientRect: () => anchorRect } as unknown as HTMLElement) : (anchor || parentMenuEl || label)
                } as unknown as MouseEvent;
                try {
                  const created = roadmapRenderer.showDateFieldsMenu(syntheticEvent);
                  const parentMenuInst = (label as any).__activeTabMenu;
                  if (created && created.el && parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function') {
                    try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                  }
                } catch (e) { }
              }
            } catch (e) { }
            return true;
          },
        });
        // Zoom level - only for roadmap layout (placed after Date)
        try {
          let zoomInfo = '';
          const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
          if (roadmapRenderer) {
            const zl = (roadmapRenderer as any).zoomLevel || 'month';
            zoomInfo = zl.charAt(0).toUpperCase() + zl.slice(1);
          }
          items.push({
            label: 'Zoom level',
            info: zoomInfo,
            forceChevron: true,
            iconName: 'zoom-in',
            onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
              try {
                const roadmapRenderer = vsLocal && vsLocal.roadmapRenderer;
                if (roadmapRenderer && typeof roadmapRenderer.showZoomMenu === 'function') {
                  // Close existing dropdowns/submenus
                  try { document.querySelectorAll('.roadmap-dropdown-menu').forEach((n) => (n as HTMLElement).remove()); } catch (e) { }
                  try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                  const parentMenuEl = (label as any).__activeTabMenu && (label as any).__activeTabMenu.menuEl ? (label as any).__activeTabMenu.menuEl as HTMLElement : undefined;
                  const syntheticEvent = {
                    currentTarget: anchorRect ? ({ getBoundingClientRect: () => anchorRect } as unknown as HTMLElement) : (anchor || parentMenuEl || label)
                  } as unknown as MouseEvent;
                  try {
                    const created = roadmapRenderer.showZoomMenu(syntheticEvent);
                    const parentMenuInst = (label as any).__activeTabMenu;
                    if (created && created.el && parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function') {
                      try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                    } else {
                      // Fallback: some views render the slice panel directly into the
                      // view container instead of returning it. Detect that DOM node
                      // and register it so the ActiveTabMenu can manage it like other submenus.
                      try {
                        const el = document.querySelector('.slice-panel') as HTMLElement | null;
                        if (el && parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function') {
                          try { parentMenuInst.registerExternalSubmenu(el, () => { /* no-op */ }); } catch (e) { }
                        }
                      } catch (e) { }
                    }
                  } catch (e) { }
                }
              } catch (e) { }
              return true;
            }
          });
          } catch (e) { }

          // Field sum - allow toggling count and numeric fields for group divisors (roadmap: placed after Zoom)
          try {
            let fdInfo = '';
            try {
              const cur = (vsLocal && (vsLocal.groupDivisors || null));
              if (Array.isArray(cur) && cur.length > 0) {
                const fields = (vsLocal && vsLocal.fields) || [];
                const names = cur.map((id: any) => {
                  if (String(id) === '__count__') return 'Count';
                  const f = (fields || []).find((ff: any) => String(ff.id) === String(id) || ff.name === id);
                  return f ? f.name : String(id);
                });
                fdInfo = names.join(', ');
              } else if (cur === null) fdInfo = 'None';
            } catch (e) { }

            items.push({
              label: 'Field sum',
              info: fdInfo,
              forceChevron: true,
              iconName: 'number',
              onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
                return import('./FieldSumMenu')
                  .then(({ default: FieldSumMenu, FieldSumMenu: FieldSumMenuClass }) => {
                    try {
                      try { (label as any).__activeTabMenu && (label as any).__activeTabMenu.closeOpenSubmenu && (label as any).__activeTabMenu.closeOpenSubmenu(); } catch (e) { }
                      const fields = (vsLocal && vsLocal.fields) || [];
                      const current = (vsLocal && (vsLocal.groupDivisors || [])) || [];
                      const menu = new (FieldSumMenuClass || FieldSumMenu)({
                        fields: (fields || []).map((f: any) => ({ id: String(f.id), name: f.name, dataType: f.dataType })),
                        current: Array.isArray(current) ? current : [],
                        title: 'Field sum',
                        onChange: (selected: string[]) => {
                          try {
                            if (vsLocal && typeof vsLocal.onSetGroupDivisors === 'function') {
                              vsLocal.onSetGroupDivisors(selected && selected.length ? selected : null);
                            }
                            setTimeout(() => {
                              const parentMenu = (label as any).__activeTabMenu;
                              if (parentMenu && typeof parentMenu.refresh === 'function') parentMenu.refresh();
                            }, 50);
                          } catch (e) { }
                        }
                      });
                      const created = menu.show((anchor as HTMLElement) || (label as HTMLElement), anchorRect as DOMRect | undefined);
                      try {
                        const parentMenuInst = (label as any).__activeTabMenu;
                        if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function' && created && (created.el as HTMLElement)) {
                          try { parentMenuInst.registerExternalSubmenu(created.el as HTMLElement, created.refresh); } catch (e) { }
                        }
                      } catch (e) { }
                    } catch (e) { }
                    return true;
                  })
                  .catch(() => false);
              }
            });
          } catch (e) { }

        }

      // Slice by - available for table/board/roadmap (last option)
      try {
        let sliceInfo = '';
        try {
          // vsLocal may expose a currentSlice or currentSliceField property
          const cs = vsLocal && (vsLocal.currentSlice || vsLocal.currentSliceField || vsLocal.slice || null);
          if (cs) {
            if (typeof cs === 'string') sliceInfo = cs;
            else if (cs && typeof cs === 'object') sliceInfo = cs.name || String(cs.fieldId || cs.id || '');
          } else {
            // try to read persisted slice from localStorage for table views
            if (viewKey) {
              try {
                const stored = localStorage.getItem(`ghProjects.table.${viewKey}.slice`);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  if (parsed && parsed.fieldId) sliceInfo = String(parsed.fieldId);
                }
              } catch (e) { }
            }
          }
        } catch (e) { }

        if (layout === 'table' || layout === 'board' || layout === 'roadmap') {
          items.push({
            label: 'Slice by',
            info: sliceInfo || 'None',
            forceChevron: true,
            iconName: 'sliceby',
            onClick: (anchor?: HTMLElement, anchorRect?: DOMRect) => {
              try {
                // Prefer a view-provided API to show the slice UI. If the view returns
                // a created element we register it as an external submenu so the
                // ActiveTabMenu can manage closing/refresh like other menus.
                // Note: For slice, the el is the persistent panel in the view, not a removable submenu,
                // so we don't register it to avoid it being removed when the menu closes.
                if (vsLocal && typeof vsLocal.showSlicePanel === 'function') {
                  try {
                    // Set a global refresh function for the slice menu to update info
                    (window as any).__sliceMenuRefresh = () => {
                      const parentMenuInst = (label as any).__activeTabMenu;
                      if (parentMenuInst && typeof parentMenuInst.refresh === 'function') {
                        parentMenuInst.refresh();
                      }
                    };
                    const created = vsLocal.showSlicePanel(anchor, anchorRect);
                    // Don't register the slice panel as it should remain in the view
                    // The dropdown opened by showSlicePanel is handled separately
                  } catch (e) { }
                  return true;
                }

                // Fallback: if view exposes onSetSlice, try selecting the first sliceable field
                try {
                  const fields = (vsLocal && vsLocal.fields) || [];
                  const sliceableTypes = new Set(['assignees','single_select','parent_issue','iteration','number','date','milestone','repository','labels','text','single_line_text']);
                  const candidate = (fields || []).find((f: any) => sliceableTypes.has(String((f.dataType || '').toLowerCase())));
                  if (candidate) {
                    try {
                      if (vsLocal && typeof vsLocal.onSetSlice === 'function') {
                        vsLocal.onSetSlice(candidate.id || candidate.name || candidate);
                        return true;
                      }
                    } catch (e) { }
                  }
                } catch (e) { }
                  } catch (e) { }
                  // Also create a small floating placeholder submenu on the right
                  // side of the active menu row so the parent ActiveTabMenu treats
                  // the Slice option like other dropdowns visually.
                  try {
                    const rect = anchorRect || (anchor && anchor.getBoundingClientRect && anchor.getBoundingClientRect());
                    if (rect) {
                      // Remove any existing placeholder
                      try { document.querySelectorAll('.active-tab-slice-placeholder').forEach(n => n.remove()); } catch (e) { }
                      const ph = document.createElement('div');
                      ph.className = 'active-tab-slice-placeholder';
                      ph.style.position = 'absolute';
                      ph.style.top = (Math.round(rect.top)) + 'px';
                      ph.style.left = (Math.round(rect.right) + 8) + 'px';
                      ph.style.width = '8px';
                      ph.style.height = '8px';
                      ph.style.zIndex = '1001';
                      ph.style.pointerEvents = 'none';
                      document.body.appendChild(ph);
                      try { const parentMenuInst = (label as any).__activeTabMenu; if (parentMenuInst && typeof parentMenuInst.registerExternalSubmenu === 'function') parentMenuInst.registerExternalSubmenu(ph as HTMLElement, () => { /* no-op */ }); } catch (e) { }
                    }
                  } catch (e) { }
                  return true;
            },
          });
        }
      } catch (e) { }

      return items;

      };

    try {
      const menu = new ActiveTabMenu({ anchorElement: label, items: getItems });
      (label as any).__activeTabMenu = menu;
      // listen for roadmap date field changes so the menu's Date info can refresh
      const dateListener = () => {
        try {
          const parentMenu = (label as any).__activeTabMenu;
          if (parentMenu && typeof parentMenu.refresh === 'function') parentMenu.refresh();
        } catch (e) { }
      };
      try {
        window.addEventListener('roadmap:dateFieldsChanged', dateListener);
        window.addEventListener('roadmap:zoomChanged', dateListener);
        window.addEventListener('roadmap:markersChanged', dateListener);
        (label as any).__activeTabMenuDateListener = dateListener;
      } catch (e) { }
      currentLabel = label;
    } catch (e) {
      // ignore
    }
  }
  // Update on initial load
  attachMenuToActive();

  // Listen for clicks on tabs to update active attachment
  tabsContainerEl.addEventListener('click', () => setTimeout(attachMenuToActive, 0));

  // Observe class changes and added/removed tabs
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        // attribute change may indicate active class change
        attachMenuToActive();
      }
      for (const n of Array.from(m.addedNodes || [])) {
        if (n.nodeType === 1) attachMenuToActive();
      }
    }
  });
  mo.observe(tabsContainerEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
// Prevent multiple initializations when this module is imported multiple times
if (!(window as any).__activeTabMenusInitialized) {
  (window as any).__activeTabMenusInitialized = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    setTimeout(initOnce, 0);
  }
}

export default initOnce;
