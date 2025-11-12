// Table layout renderer module
export function renderTable(container, meta, items){
  function esc(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  const cols = (meta.visibleFieldIds || []).map(fid => meta.fieldsById[fid]).filter(Boolean);
  const columns = [{ id: '__title__', name: 'Title' }].concat(cols);
  const thead = '<thead><tr>' + columns.map(c => '<th style="text-align:left; padding:4px 8px;">' + esc(c.name) + '</th>').join('') + '</tr></thead>';
  const rows = (items || []).map(row => {
    const cells = [];
    const titleHtml = row.url ? '<a href="' + esc(row.url) + '">' + esc(row.title) + '</a>' : esc(row.title);
    cells.push('<td style="padding:4px 8px; white-space:nowrap;">' + titleHtml + '</td>');
    for (const c of cols) {
      const val = row.fieldValues[c.id];
      let text = '';
      switch (c.dataType) {
        case 'SINGLE_SELECT': {
          const opt = (c.options || []).find(o => String(o.id) === String(val));
          text = opt ? opt.name : (val ?? '');
          break;
        }
        default:
          text = (val ?? '');
      }
      cells.push('<td style="padding:4px 8px;">' + esc(text) + '</td>');
    }
    return '<tr>' + cells.join('') + '</tr>';
  }).join('');
  container.innerHTML = '<div style="overflow:auto; border:1px solid var(--vscode-panel-border);">\n'
    + '<table style="border-collapse:collapse; width:100%; font: inherit;">' + thead + '<tbody>' + rows + '</tbody></table>'
    + '</div>';
}
