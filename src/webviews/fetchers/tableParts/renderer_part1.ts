export const rendererPart1 = `
function render(snapshot){
    const fields = (snapshot && snapshot.fields) || [];
    const items = (snapshot && snapshot.items) || [];

    container.innerHTML = '';
    
    // AGGRESSIVE CSS RESET
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.height = '100%'; 

    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100%';
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.height = '100%';

    // Header with load button (Fixed element above sticky table header)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    // Z-index 20 for the main header (above sticky table header)
    header.style.position = 'relative'; 
    header.style.zIndex = '20';         
    header.style.background = 'var(--vscode-editor-background)';
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = (view.name||view.id||'Table View');
    const controls = document.createElement('div');
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load more';
    loadBtn.style.marginLeft = '8px';
    loadBtn.addEventListener('click', ()=>{
      currentFirst += 30;
      requestFields();
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading…';
    });
    controls.appendChild(loadBtn);
    header.appendChild(title);
    header.appendChild(controls);
    container.appendChild(header);

    // Scrollable wrapper
    const wrapper = document.createElement('div');
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'auto';
    wrapper.style.width = '100%';
    wrapper.style.display = 'block';

    // Table
    const table = document.createElement('table');
    table.style.borderCollapse = 'separate'; 
    table.style.borderSpacing = '0'; 
    // Use fixed layout so explicit column widths apply predictably
    table.style.tableLayout = 'fixed';
    table.style.width = 'max-content';

    // Create a colgroup so we can control column widths individually
    const colgroup = document.createElement('colgroup');
    const idxCol = document.createElement('col');
    colgroup.appendChild(idxCol);
    for(let i=0;i<fields.length;i++){
      const c = document.createElement('col');
      colgroup.appendChild(c);
    }
    table.appendChild(colgroup);

    // Table header
    const thead = document.createElement('thead');
    thead.style.background = 'var(--vscode-editor-background)';
    thead.style.position = 'relative'; 
    thead.style.zIndex = '10';
    
    const headerRow = document.createElement('tr');

    const idxTh = document.createElement('th');
    idxTh.textContent = '#';
    idxTh.style.padding = '6px';
    idxTh.style.textAlign = 'left';
    
    // **CHANGE: Remove left border from the first header cell**
    idxTh.style.borderLeft = 'none';
    idxTh.style.borderRight = '1px solid var(--vscode-editorGroup-border)';
    idxTh.style.borderTop = '1px solid var(--vscode-editorGroup-border)';
    idxTh.style.borderBottom = '1px solid var(--vscode-editorGroup-border)';
    
    idxTh.style.position = 'sticky';
    idxTh.style.top = '0';
    idxTh.style.zIndex = '11'; 
    idxTh.style.background = 'var(--vscode-editor-background)';
    headerRow.appendChild(idxTh);
`