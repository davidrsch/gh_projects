export const rendererPart4 = `
    // After DOM insertion, set initial column widths to match header label widths
    (function setInitialColumnWidths(){
      try{
        const cols = colgroup.children;
        const ths = headerRow.children;
        for(let i=0;i<ths.length && i<cols.length;i++){
          const th = ths[i];
          // measure text width using a temporary off-DOM span to get tight width
          const span = document.createElement('span');
          span.style.visibility = 'hidden';
          span.style.position = 'absolute';
          span.style.whiteSpace = 'nowrap';
          span.style.font = window.getComputedStyle(th).font || '';
          span.textContent = th.textContent || '';
          document.body.appendChild(span);
          const measured = span.offsetWidth;
          document.body.removeChild(span);
          // Add a bit of padding so content doesn't touch the edge
          const padding = 24; // px
          const newW = Math.max(th.clientWidth, measured + padding);
          cols[i].style.width = newW + 'px';
        }
      }catch(e){}
    })();

    // Lock the table width to its current rendered width so that changing
    // <col> widths updates visible column sizes predictably with table-layout: fixed.
    try{
      const tblW = table.getBoundingClientRect().width;
      if(tblW && isFinite(tblW)) table.style.width = tblW + 'px';
    }catch(e){}

    // Add draggable resizers to header cells (adjust corresponding col width)
    (function addColumnResizers(){
      const cols = colgroup.children;
      const ths = headerRow.children;
      for(let i=0;i<ths.length && i<cols.length;i++){
        const th = ths[i];
        // ensure th is positioned so the resizer can be absolute
        if(!th.style.position) th.style.position = 'relative';
        const resizer = document.createElement('div');
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.top = '0';
        resizer.style.width = '8px';
        resizer.style.cursor = 'col-resize';
        resizer.style.userSelect = 'none';
        resizer.style.height = '100%';
        resizer.style.zIndex = '20';
        // increase hit area slightly
        resizer.style.transform = 'translateX(2px)';
        th.appendChild(resizer);

        (function(colIndex){
          let startX = 0;
          let startWidth = 0;
          function onMouseMove(ev){
            const delta = ev.clientX - startX;
            const newW = Math.max(20, startWidth + delta);
            cols[colIndex].style.width = newW + 'px';
          }
          function onMouseUp(){
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
          resizer.addEventListener('mousedown', function(e){
            e.preventDefault();
            startX = e.clientX;
            startWidth = cols[colIndex].getBoundingClientRect().width;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          });
        })(i);
      }
    })();

    if(items.length >= currentFirst){
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load more';
    } else {
      loadBtn.disabled = true;
      loadBtn.textContent = 'All loaded';
    }

    // Adjust wrapper height dynamically on resize
    function updateWrapperHeight() {
        const availableHeight = container.clientHeight;
        const currentHeaderHeight = header.offsetHeight;
        
        // Set the wrapper's maxHeight
        const newMaxHeight = Math.max(0, availableHeight - currentHeaderHeight);
        wrapper.style.maxHeight = newMaxHeight + 'px';
    }
    
    // Initial layout calculation
    updateWrapperHeight();

    window.addEventListener('resize', updateWrapperHeight);
    
    // Delegate clicks on elements with 'data-gh-open' to open links without inline handlers (CSP-safe)
    document.addEventListener('click', function(ev){
      try{
        const t = ev.target;
        if(!t) return;
        // closest may not exist on older engines, but webview supports it
        const el = t.closest ? t.closest('[data-gh-open]') : (t.getAttribute && t.getAttribute('data-gh-open') ? t : null);
        if(el){
          const url = el.getAttribute('data-gh-open');
          if(url){
            // Prefer posting to the extension host to open links (more control + avoids window.open styling/behavior)
            try{ if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){ vscodeApi.postMessage({ command: 'openUrl', url: url }); ev.preventDefault(); return; } }catch(_){}
            try{ window.open(url, '_blank'); ev.preventDefault(); }catch(_){}
          }
        }
      }catch(e){}
    });

    // Keyboard support: open link when Enter or Space pressed while focused on element with data-url
    document.addEventListener('keydown', function(ev){
      try{
        if(ev.key !== 'Enter' && ev.key !== ' ') return;
        const active = document.activeElement;
        if(active && active.getAttribute){
          const url = active.getAttribute('data-gh-open');
          if(url){
            try{ if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){ vscodeApi.postMessage({ command: 'openUrl', url: url }); ev.preventDefault(); return; } }catch(_){}
            try{ window.open(url, '_blank'); ev.preventDefault(); }catch(_){}
          }
        }
      }catch(e){}
    });
  }

`