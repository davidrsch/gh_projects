export const rendererPart3 = `
    // Table body
    const tbody = document.createElement('tbody');
    for(let i=0;i<items.length;i++){
      const it = items[i];
      const tr = document.createElement('tr');

      const idxTd = document.createElement('td');
      idxTd.textContent = String(i+1);
      idxTd.style.padding = '6px';
      idxTd.style.whiteSpace = 'nowrap';
      idxTd.style.overflow = 'hidden';
      idxTd.style.textOverflow = 'ellipsis';
      // **CHANGE: Remove left border from the first body cell**
      idxTd.style.borderTop = '1px solid var(--vscode-editorGroup-border)';
      idxTd.style.borderRight = '1px solid var(--vscode-editorGroup-border)';
      idxTd.style.borderBottom = '1px solid var(--vscode-editorGroup-border)';
      idxTd.style.borderLeft = 'none';
      tr.appendChild(idxTd);

      const fvals = it.fieldValues || [];
      for(let j=0;j<fields.length;j++){
        const td = document.createElement('td');
        td.style.padding = '6px';
        td.style.border = '1px solid var(--vscode-editorGroup-border)';
        // prevent wrapping, hide overflow so content outside width is not visible
        td.style.whiteSpace = 'nowrap';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'ellipsis';
        td.innerHTML = fvals[j] ? toHtml(fvals[j], fields[j], it) : '';
        // ensure relative positioning so resizer (absolute) is positioned correctly
        td.style.position = 'relative';

        // Add a resizer to each data cell so resizing affordance is visible on all rows
        const cellResizer = document.createElement('div');
        cellResizer.style.position = 'absolute';
        cellResizer.style.right = '0';
        cellResizer.style.top = '0';
        cellResizer.style.width = '8px';
        cellResizer.style.cursor = 'col-resize';
        cellResizer.style.userSelect = 'none';
        cellResizer.style.height = '100%';
        cellResizer.style.zIndex = '20';
        cellResizer.style.transform = 'translateX(2px)';
        td.appendChild(cellResizer);

        // reuse resizer logic: start drag, update matching <col> width
        (function(colIndex){
          const cols = colgroup.children;
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
          cellResizer.addEventListener('mousedown', function(e){
            e.preventDefault();
            startX = e.clientX;
            startWidth = cols[colIndex].getBoundingClientRect().width;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          });
        })(j+1); // +1 because first col is index column

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  `;