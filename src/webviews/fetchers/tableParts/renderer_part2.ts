export const rendererPart2 = `
    for(const f of fields){
      const th = document.createElement('th');
      th.textContent = f.name || f.id || '';
      th.style.padding = '6px';
      th.style.textAlign = 'left';
      // prevent header text from wrapping and hide overflow
      th.style.whiteSpace = 'nowrap';
      th.style.overflow = 'hidden';
      th.style.textOverflow = 'ellipsis';

    // Borders for all subsequent header cells
      th.style.borderLeft = '1px solid var(--vscode-editorGroup-border)';
      th.style.borderRight = '1px solid var(--vscode-editorGroup-border)';
      th.style.borderTop = '1px solid var(--vscode-editorGroup-border)';
      th.style.borderBottom = '1px solid var(--vscode-editorGroup-border)';
    
      th.style.position = 'sticky';
      th.style.top = '0';
      th.style.zIndex = '11';
      th.style.background = 'var(--vscode-editor-background)';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
`;