export const TEST_HANDLER_CODE = `
  function handleTestCommand(msg, vscode) {
    console.log('[Webview] Handling test command:', msg.command);
    const { command, requestId } = msg;

    // Resolve dependencies dynamically to ensure access regardless of scope
    const tabsContainer = document.getElementById('tabs-container');
    const panelsContainer = document.getElementById('tab-panels');
    // 'project' is expected to be global or in scope. Fallback to window.__project_data__
    const projectData = window.__PROJECT_DATA__ || window.__project_data__ || {};
    
    // Helper: get visible panel
    function getVisiblePanel() {
      const container = document.getElementById('tab-panels');
      if (!container) return null;
      return Array.from(container.children).find(p => {
        const style = window.getComputedStyle(p);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    }

    // Helper: get computed styles for element
    function getStyles(el, props) {
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      const result = {};
      props.forEach(p => result[p] = computed[p]);
      return result;
    }
    
    // Helper: simulate mouse event
    function simulateEvent(el, eventType, options = {}) {
      if (!el) return false;
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options
      });
      if (options.pageX !== undefined) Object.defineProperty(event, 'pageX', { value: options.pageX });
      if (options.pageY !== undefined) Object.defineProperty(event, 'pageY', { value: options.pageY });
      el.dispatchEvent(event);
      return true;
    }
    
    try {
      let result = null;

      switch (command) {
        case 'test:getProjectInfo':
          result = {
            projectTitle: projectData.title,
            totalViews: projectData.views?.length || 0,
            viewNames: (projectData.views || []).map(v => v.name || v.id),
            views: (projectData.views || []).map((v, i) => ({ 
                index: i, 
                name: v.name || v.id, 
                layout: v.layout // Pass the raw layout from the server
            }))
          };
          break;

        case 'test:getBoardInfo': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel', panelCount: document.getElementById('tab-panels')?.children?.length };
          } else {
            const hasContainer = visiblePanel.classList.contains('board-container') || !!visiblePanel.querySelector('.board-container');
            const columns = visiblePanel.querySelectorAll('.board-card, .board-column-items');
            const items = visiblePanel.querySelectorAll('.board-item');
            result = {
              hasContainer,
              columnCount: columns.length,
              itemCount: items.length,
              columns: Array.from(columns).map(col => ({
                title: col.querySelector('.board-card-title, .board-column-header')?.textContent?.trim(),
                count: col.querySelector('.board-card-count')?.textContent?.trim()
              })),
              debug: {
                panelId: visiblePanel.id,
                panelClasses: visiblePanel.className,
                childCount: visiblePanel.children.length,
                innerHTML: visiblePanel.innerHTML.substring(0, 100)
              }
            };
          }
          break;
        }

        case 'test:getRoadmapInfo': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel', panelCount: document.getElementById('tab-panels')?.children?.length };
          } else {
            const hasContainer = visiblePanel.classList.contains('roadmap-container') || !!visiblePanel.querySelector('.roadmap-container');
            const timeline = visiblePanel.querySelector('.roadmap-timeline');
            const bars = visiblePanel.querySelectorAll('.roadmap-bar');
            result = {
              hasContainer,
              hasTimeline: !!timeline,
              barCount: bars.length,
              zoomLevel: visiblePanel.getAttribute('data-zoom') || visiblePanel.querySelector('.roadmap-container')?.getAttribute('data-zoom') || null,
              debug: {
                panelId: visiblePanel.id,
                panelClasses: visiblePanel.className,
                childCount: visiblePanel.children.length,
                innerHTML: visiblePanel.innerHTML.substring(0, 100)
              }
            };
          }
          break;
        }
        
        case 'test:waitForRoadmapReady': {
          // Poll until the roadmap timeline is present and no loading indicator remains
          const timeoutMs = typeof msg.timeout === 'number' ? msg.timeout : 90000;
          const intervalMs = typeof msg.interval === 'number' ? msg.interval : 500;
          const start = Date.now();

          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { success: false, error: 'No visible panel', panelCount: document.getElementById('tab-panels')?.children?.length };
            break;
          }

          // Return a promise-like flow by using a synchronous loop with setInterval and early return via postMessage
          const pollId = 'wait-roadmap-' + Date.now() + '-' + Math.random();
          const poller = setInterval(() => {
            const vp = getVisiblePanel();
            if (!vp) return; // keep waiting

            // Accept several timeline selectors used across versions
            const timeline = vp.querySelector('.roadmap-timeline') || vp.querySelector('.timeline') || vp.querySelector('[data-roadmap]');
            const loading = vp.querySelector('.loading, .spinner, .roadmap-loading, .loading-indicator');
            const bars = vp.querySelectorAll('.roadmap-bar, .bar, [data-roadmap-bar]');
            // Consider ready when we have a timeline and no loading indicator
            // Also accept cases where the DOM appears fully rendered (large innerHTML) even without explicit bars
            const largeRendered = !loading && (vp.innerHTML && vp.innerHTML.length > 1200);
            if ((timeline && !loading && bars.length > 0) || largeRendered) {
              clearInterval(poller);
              const bars = vp.querySelectorAll('.roadmap-bar');
              const res = {
                success: true,
                hasContainer: true,
                hasTimeline: true,
                barCount: bars.length,
                debug: {
                  panelId: vp.id,
                  panelClasses: vp.className,
                  childCount: vp.children.length,
                  innerHTML: vp.innerHTML.substring(0, 500)
                }
              };
              if (vscode) vscode.postMessage({ command: 'test:result', requestId, result: res });
            } else if (Date.now() - start > timeoutMs) {
              clearInterval(poller);
              const res = {
                success: false,
                error: 'timeout waiting for roadmap ready',
                hasContainer: !!vp.querySelector('.roadmap-container'),
                hasTimeline: !!vp.querySelector('.roadmap-timeline'),
                debug: {
                  panelId: vp.id,
                  panelClasses: vp.className,
                  childCount: vp.children.length,
                  innerHTML: vp.innerHTML.substring(0, 500)
                }
              };
              if (vscode) vscode.postMessage({ command: 'test:result', requestId, result: res });
            }
          }, intervalMs);

          // Return early; result will be posted asynchronously by the poller above.
          return;
        }
        case 'test:getTabBar': {
          if (!tabsContainer) { result = { error: 'Tabs container not found' }; break; }
          const tabs = tabsContainer.querySelectorAll('.tab');
          const tabData = Array.from(tabs).map((tab, i) => {
            const icon = tab.querySelector('.tab-icon svg');
            const isActive = tab.classList.contains('active');
            const styles = getStyles(tab, ['padding', 'cursor', 'fontWeight', 'borderBottom', 'color', 'background']);
            return {
              index: i,
              text: tab.textContent?.trim(),
              isActive,
              hasIcon: !!icon,
              iconClass: icon?.classList?.[1] || null,
              styles
            };
          });
          result = {
            count: tabs.length,
            tabs: tabData,
            containerStyles: getStyles(tabsContainer, ['overflowX', 'overflowY', 'borderBottom'])
          };
          break;
        }

        case 'test:clickTab': {
          const tabIndex = msg.tabIndex;
          if (!tabsContainer) { result = { error: 'Tabs container not found' }; break; }
          const tabs = tabsContainer.querySelectorAll('.tab');
          if (tabs[tabIndex]) {
            simulateEvent(tabs[tabIndex], 'click');
            result = { success: true, tabIndex };
          } else {
            result = { success: false, error: 'Tab not found', tabIndex };
          }
          break;
        }
        
        case 'test:hoverTab': {
          const tabIndex = msg.tabIndex;
          if (!tabsContainer) { result = { error: 'Tabs container not found' }; break; }
          const tabs = tabsContainer.querySelectorAll('.tab');
          if (tabs[tabIndex]) {
            simulateEvent(tabs[tabIndex], 'mouseenter');
            // Get styles after hover
            const styles = getStyles(tabs[tabIndex], ['background', 'color']);
            result = { success: true, styles };
          } else {
            result = { success: false, error: 'Tab not found' };
          }
          break;
        }

        case 'test:getTableInfo': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { hasContainer: false, rowCount: 0, error: 'No visible panel', headers: [], items: [], fields: [] };
          } else {
            const tableWrapper = visiblePanel.querySelector('.table-wrapper');
            const table = visiblePanel.querySelector('table');
            const rows = Array.from(visiblePanel.querySelectorAll('tbody tr[data-gh-item-id]'))
                .filter(r => window.getComputedStyle(r).display !== 'none');
            const sliceItems = visiblePanel.querySelectorAll('.slice-value-item');
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            // Extract header metadata (if present)
            const headers = Array.from(visiblePanel.querySelectorAll('thead th')).map((th, i) => ({
              index: i,
              text: th.textContent?.trim() || '',
              // Try common attributes used by the table renderer
              id: th.getAttribute('data-field-id') || null,
              dataType: th.getAttribute('data-type') || null,
            }));

            // Extract rows/items
            const items = rows.map(r => {
              const id = r.getAttribute('data-gh-item-id');
              const cells = Array.from(r.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
              return { id, cells };
            });

            // Try to extract minimal field configs if present on DOM
            const fieldEls = visiblePanel.querySelectorAll('[data-field-id]');
            const fields = Array.from(fieldEls).map(el => {
              try {
                const id = el.getAttribute('data-field-id');
                const name = el.getAttribute('data-field-name') || el.textContent?.trim() || id;
                // Options may be encoded in data-options as JSON
                const optsRaw = el.getAttribute('data-options');
                const options = optsRaw ? JSON.parse(optsRaw) : undefined;
                return { id, name, options };
              } catch (e) {
                return { id: el.getAttribute('data-field-id'), name: el.textContent?.trim() };
              }
            });

            result = {
              hasContainer: !!tableWrapper,
              hasTable: !!table,
              rowCount: rows.length,
              sliceItemCount: sliceItems.length,
              groupHeaderCount: groupHeaders.length,
              firstRowId: rows.length > 0 ? rows[0].getAttribute('data-gh-item-id') : null,
              headers,
              items,
              fields,
              debug: {
                panelId: visiblePanel.id,
                panelClasses: visiblePanel.className,
                childCount: visiblePanel.children.length,
                innerHTML: visiblePanel.innerHTML.substring(0, 200)
              }
            };
          }
          break;
        }

        case 'test:getHeaders': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const headers = visiblePanel.querySelectorAll('thead th');
            const headerData = Array.from(headers).map((th, i) => {
              const text = th.textContent?.trim() || '';
              const menuBtn = th.querySelector('button');
              const sortIndicator = text.includes('↑') ? 'ASC' : text.includes('↓') ? 'DESC' : null;
              const groupIcon = th.querySelector('.column-group-icon');
              const sliceIcon = th.querySelector('.column-slice-icon');
              const styles = getStyles(th, ['position', 'top', 'zIndex', 'background', 'padding', 'borderRight', 'borderBottom', 'whiteSpace', 'height']);
              return {
                index: i,
                text,
                hasMenu: !!menuBtn,
                sortDirection: sortIndicator,
                isGrouped: !!groupIcon,
                isSliced: !!sliceIcon,
                styles
              };
            });
            result = { count: headers.length, headers: headerData };
          }
          break;
        }

        case 'test:clickHeaderMenu': {
          const headerIndex = msg.headerIndex;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const headers = visiblePanel.querySelectorAll('thead th');
            const th = headers[headerIndex];
            if (!th) {
              result = { error: 'Header not found' };
            } else {
              const menuBtn = th.querySelector('button');
              if (!menuBtn) {
                result = { error: 'No menu button on header' };
              } else {
                simulateEvent(menuBtn, 'click');
                result = { success: true };
              }
            }
          }
          break;
        }

        case 'test:getMenu': {
          const menu = document.querySelector('.column-header-menu');
          if (!menu) {
            result = { open: false, items: [] };
          } else {
            const items = menu.querySelectorAll('.menu-item');
            const itemData = Array.from(items).map(item => {
              const icon = item.querySelector('svg');
              const clearBtn = item.querySelector('.menu-item-clear');
              const isDisabled = item.classList.contains('disabled') || item.style.opacity < 0.8;
              return {
                text: item.textContent?.trim(),
                hasIcon: !!icon,
                iconClass: icon?.classList?.[1] || null,
                hasClear: !!clearBtn,
                isDisabled
              };
            });
            const styles = getStyles(menu, ['background', 'border', 'borderRadius', 'boxShadow', 'minWidth']);
            result = { open: true, items: itemData, styles };
          }
          break;
        }

        case 'test:clickMenuItem': {
          const text = msg.text;
          const menu = document.querySelector('.column-header-menu');
          if (!menu) {
            result = { error: 'Menu not open' };
          } else {
            const items = menu.querySelectorAll('.menu-item');
            let found = false;
            for (const item of items) {
              if (item.textContent?.includes(text)) {
                simulateEvent(item, 'click');
                found = true;
                break;
              }
            }
            result = { success: found, error: found ? null : 'Item not found: ' + text };
          }
          break;
        }

        case 'test:getCellContent': {
          const rowIndex = msg.rowIndex || 0;
          const colIndex = msg.colIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const rows = visiblePanel.querySelectorAll('tbody tr[data-gh-item-id]');
            const row = rows[rowIndex];
            if (!row) {
              result = { error: 'Row not found' };
            } else {
              const cells = row.querySelectorAll('td');
              const cell = cells[colIndex];
              if (!cell) {
                result = { error: 'Cell not found' };
              } else {
                // Analyze cell content
                const link = cell.querySelector('a');
                const pills = cell.querySelectorAll('span[style*="border-radius: 999px"], span[style*="border-radius:999px"]');
                const avatars = cell.querySelectorAll('span[style*="border-radius: 50%"], span[style*="border-radius:50%"]');
                const progressBar = cell.querySelector('.sub-issues-progress');
                const svg = cell.querySelector('svg');
                
                result = {
                  html: cell.innerHTML,
                  text: cell.textContent?.trim(),
                  hasLink: !!link,
                  linkHref: link?.href || null,
                  pillCount: pills.length,
                  avatarCount: avatars.length,
                  hasProgressBar: !!progressBar,
                  hasSvg: !!svg,
                  styles: getStyles(cell, ['textAlign', 'padding', 'overflow'])
                };
              }
            }
          }
          break;
        }

        case 'test:getSlicePanel': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const slicePanel = visiblePanel.querySelector('.slice-panel');
            if (!slicePanel) {
              result = { open: false };
            } else {
              const values = slicePanel.querySelectorAll('.slice-value-item');
              const valueData = Array.from(values).map(v => ({
                text: v.textContent?.trim(),
                isSelected: v.classList.contains('selected') || v.style.background?.includes('selection')
              }));
              result = {
                open: true,
                valueCount: values.length,
                values: valueData,
                styles: getStyles(slicePanel, ['position', 'background', 'borderRight', 'width'])
              };
            }
          }
          break;
        }

        case 'test:clickSliceValue': {
          const valueIndex = msg.valueIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const values = visiblePanel.querySelectorAll('.slice-value-item');
            if (values[valueIndex]) {
              simulateEvent(values[valueIndex], 'click');
              result = { success: true };
            } else {
              result = { error: 'Value not found' };
            }
          }
          break;
        }

        case 'test:getGroupHeaders': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            const groups = Array.from(groupHeaders).map(gh => {
              const text = gh.textContent?.trim();
              const isCollapsed = gh.classList.contains('collapsed') || gh.querySelector('[style*="rotate"]');
              const progressBar = gh.querySelector('.group-progress');
              return { text, isCollapsed: !!isCollapsed, hasProgress: !!progressBar };
            });
            result = { count: groupHeaders.length, groups };
          }
          break;
        }

        case 'test:clickGroupHeader': {
          const groupIndex = msg.groupIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            if (groupHeaders[groupIndex]) {
              simulateEvent(groupHeaders[groupIndex], 'click');
              result = { success: true };
            } else {
              result = { error: 'Group header not found' };
            }
          }
          break;
        }

        case 'test:getFieldsMenu': {
          const fieldsMenu = document.querySelector('.fields-menu');
          if (!fieldsMenu) {
            result = { open: false };
          } else {
            const fields = fieldsMenu.querySelectorAll('.field-item');
            const fieldData = Array.from(fields).map(f => {
              const toggle = f.querySelector('input[type="checkbox"], .toggle');
              const icon = f.querySelector('svg');
              return {
                name: f.textContent?.trim(),
                isVisible: toggle?.checked !== false,
                hasIcon: !!icon
              };
            });
            result = { open: true, fields: fieldData };
          }
          break;
        }

        case 'test:clickAddColumn': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const addBtn = visiblePanel.querySelector('th:last-child button');
            if (addBtn) {
              simulateEvent(addBtn, 'click');
              result = { success: true };
            } else {
              result = { error: 'Add column button not found' };
            }
          }
          break;
        }

        case 'test:getElementStyles': {
          const selector = msg.selector;
          const props = msg.props || ['color', 'background', 'display'];
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found: ' + selector };
          } else {
            result = { styles: getStyles(el, props) };
          }
          break;
        }

        case 'test:hoverElement': {
          const selector = msg.selector;
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found' };
          } else {
            simulateEvent(el, 'mouseenter');
            simulateEvent(el, 'pointerenter');
            // Wait a tick for CSS transitions
            setTimeout(() => {}, 10);
            const styles = getStyles(el, msg.props || ['background', 'color', 'opacity']);
            result = { success: true, styles };
          }
          break;
        }

        case 'test:clickElement': {
          const selector = msg.selector;
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found: ' + selector };
          } else {
            simulateEvent(el, 'click');
            result = { success: true };
          }
          break;
        }

        case 'test:closeMenu': {
          // Click on backdrop or body to close any open menu
          const backdrop = document.querySelector('.menu-backdrop');
          if (backdrop) {
            simulateEvent(backdrop, 'click');
          } else {
            simulateEvent(document.body, 'click');
          }
          result = { success: true };
          break;
        }

        case 'test:evaluate':
          try {
            const func = new Function('return ' + msg.expression);
            result = func();
          } catch (e) {
            result = { error: e.message };
          }
          break;

        case 'test:resizeColumn': {
          const colIndex = msg.colIndex || 0;
          const delta = msg.delta || 50;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const headers = visiblePanel.querySelectorAll('thead th');
            const th = headers[colIndex];
            if (!th) {
                result = { error: 'Header not found' };
            } else {
                const resizer = th.querySelector('.column-resizer');
                if (!resizer) {
                    result = { error: 'Resizer not found' };
                } else {
                    const rect = resizer.getBoundingClientRect();
                    const startX = rect.left + rect.width / 2;
                    const startY = rect.top + rect.height / 2;
                    const endX = startX + delta;
                    
                    // Dispatch mousedown
                    simulateEvent(resizer, 'mousedown', { clientX: startX, clientY: startY, screenX: startX, screenY: startY, pageX: startX, which: 1, buttons: 1 });
                    
                    // Dispatch mousemove
                    simulateEvent(document, 'mousemove', { clientX: endX, clientY: startY, screenX: endX, screenY: startY, pageX: endX, which: 1, buttons: 1 });
                    
                    // Dispatch mouseup
                    simulateEvent(document, 'mouseup', { clientX: endX, clientY: startY, screenX: endX, screenY: startY, pageX: endX });
                    
                    result = { success: true };
                }
            }
          }
          break;
        }

        case 'test:updateField': {
          // Send an updateFieldValue request to the extension and wait for response
          const messageId = 'test-update-' + Date.now() + '-' + Math.random();
          // Determine viewKey: prefer explicit arg, otherwise infer from visible panel index
          let resolvedViewKey = msg.viewKey;
          if (!resolvedViewKey) {
            const panelsContainer = document.getElementById('tab-panels');
            const visiblePanel = getVisiblePanel();
            if (panelsContainer && visiblePanel) {
              const idx = Array.from(panelsContainer.children).indexOf(visiblePanel);
              if (idx === 0) {
                resolvedViewKey = 'overview';
              } else if (idx > 0) {
                resolvedViewKey = 'view-' + (idx - 1);
              }
            }
          }

          const request = {
            command: 'updateFieldValue',
            id: messageId,
            projectId: projectData.id,
            itemId: msg.itemId,
            fieldId: msg.fieldId,
            fieldType: msg.fieldType,
            newValue: msg.value !== undefined ? msg.value : msg.newValue,
            viewKey: resolvedViewKey || null,
          };

          // We'll send the final test result from within the message handler below.
          if (vscode) {
            const timeoutMs = 15000;
            let timeoutId = null;

            const handler = (ev) => {
              const d = ev && ev.data ? ev.data : ev;
              if (!d) return;

              // Match by response id OR by update result payload containing the same viewKey
              if ((d.command === 'updateFieldValueResponse' && d.id === messageId) ||
                  (d.command === 'updateFieldValueResult' && (msg.viewKey == null || d.viewKey === msg.viewKey))) {
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
                window.removeEventListener('message', handler);

                const res = d.command === 'updateFieldValueResponse'
                  ? { success: !!d.success, error: d.error }
                  : { success: !!d.success, payload: d.payload, effectiveFilter: d.effectiveFilter, error: d.error };

                vscode.postMessage({ command: 'test:result', requestId, result: res });
              }
            };

            window.addEventListener('message', handler);

            timeoutId = setTimeout(() => {
              window.removeEventListener('message', handler);
              vscode.postMessage({ command: 'test:result', requestId, error: 'updateField timeout' });
            }, timeoutMs);

            // Post to extension
            try {
              vscode.postMessage(request);
            } catch (e) {
              // If direct vscode API isn't available, attempt to use global postMessage
              try {
                window.postMessage(request, '*');
              } catch (e2) {
                if (timeoutId) clearTimeout(timeoutId);
                window.removeEventListener('message', handler);
                vscode.postMessage({ command: 'test:result', requestId, error: 'Failed to send updateField request' });
              }
            }
          }

          // Return early — the result will be posted asynchronously from the handler above.
          return;
        }

        default:
          result = { error: 'Unknown test command: ' + command };
      }

      // Send result back
      if (vscode) {
        vscode.postMessage({
            command: 'test:result',
            requestId,
            result
        });
      }
    } catch (error) {
      if (vscode) {
        vscode.postMessage({
            command: 'test:result',
            requestId,
            error: error.message || String(error)
        });
      }
    }
  }
`;
