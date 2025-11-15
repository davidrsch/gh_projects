// Combined table view fetcher (concatenated from server-side parts)
(function(){
  window.tableViewFetcher = function(view, container, viewKey){
    // part1
    container.innerHTML = '<div class="title">'+(view.name||view.id||'Table View')+'</div>'+
      '<div class="loading"><em>Loading table…</em></div>';

    let currentFirst = 30;

    // helpers
    function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
    function escapeAttr(s){ return escapeHtml(s); }

    function normalizeOptionColor(col){
      if(!col) return null;
      const s = String(col).trim();
      if(/^#?[0-9a-f]{3}$/i.test(s) || /^#?[0-9a-f]{6}$/i.test(s) || /^#?[0-9a-f]{8}$/i.test(s)){
        const raw = s[0] === '#' ? s.slice(1) : s;
        const rgb = raw.length === 8 ? raw.substring(0, 6) : raw;
        return '#'+rgb;
      }
      const map = {
        'GRAY':'#848d97','RED':'#f85149','ORANGE':'#db6d28','YELLOW':'#d29922','GREEN':'#3fb950','BLUE':'#2f81f7','PURPLE':'#a371f7','PINK':'#db61a2','BLACK':'#000000','WHITE':'#ffffff'
      };
      const up = s.toUpperCase();
      return map[up] || null;
    }

    function hexToRgba(hex, a){
      if(!hex) return null;
      const h = hex.replace('#','');
      const parse = (s) => parseInt(s,16);
      if(h.length === 3){
        const r = parse(h[0]+h[0],16);
        const g = parse(h[1]+h[1],16);
        const b = parse(h[2]+h[2],16);
        return 'rgba('+r+','+g+','+b+','+a+')';
      }
      if(h.length === 6 || h.length === 8){
        const hh = h.length === 8 ? h.substring(0,6) : h;
        const r = parse(h.substring(0,2),16);
        const g = parse(hh.substring(2,4),16);
        const b = parse(hh.substring(4,6),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
      }
      return null;
    }

    function getContrastColor(hex){
      if(!hex) return '#333333';
      const h = hex.replace('#','');
      const parse = (s) => parseInt(s,16);
      let r,g,b;
      if(h.length===3){ r = parse(h[0]+h[0],16); g = parse(h[1]+h[1],16); b = parse(h[2]+h[2],16); }
      else if(h.length===6 || h.length===8){ const hh = h.length===8 ? h.substring(0,6) : h; r = parse(hh.substring(0,2),16); g = parse(hh.substring(2,4),16); b = parse(hh.substring(4,6),16); }
      else return '#333333';
      const lum = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
      return lum > 0.6 ? '#111111' : '#ffffff';
    }

    // valueToHtml
    function toHtml(val, field, item){
      if(!val) return '';
      try{
        switch(val.type){
          case 'title': {
            const titleText = (val && val.title && ( (val.title.raw && val.title.raw.text) || (val.title.content && (val.title.content.title || val.title.content.name)) || (typeof val.title === 'string' && val.title) ))
              || (val && val.content && (val.content.title || val.content.name))
              || (val && val.raw && val.raw.text)
              || '';
            const number = (val && val.title && val.title.content && val.title.content.number) || (val && val.raw && val.raw.itemContent && val.raw.itemContent.number) || (item && item.content && item.content.number) || '';
            const url = (val && val.title && val.title.content && val.title.content.url) || (val && val.raw && val.raw.itemContent && val.raw.itemContent.url) || (item && item.content && item.content.url) || '';
            let statusColorRaw = null;
            if(item && Array.isArray(item.fieldValues)){
              const statusF = item.fieldValues.find(fv=> fv && fv.type === 'single_select' && ((fv.raw && fv.raw.field && String(fv.raw.field.name || '').toLowerCase() === 'status') || (fv.fieldName && String(fv.fieldName||'').toLowerCase() === 'status') || (fv.field && fv.field.name && String(fv.field.name||'').toLowerCase() === 'status')));
              if(statusF){ statusColorRaw = (statusF.option && (statusF.option.color || statusF.option.id || statusF.option.name)) || (statusF.raw && statusF.raw.color) || null; }
            }
            const hex = normalizeOptionColor(statusColorRaw) || null;
            const iconColor = (hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) ? hex : '#666666';
            const safeTitle = escapeHtml(String(titleText || ''));
            const safeNum = number ? escapeHtml(String(number)) : '';
            const safeUrl = escapeAttr(String(url || ''));
            return '<a href="'+safeUrl+'" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px;width:100%;">'
              + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:'+escapeAttr(iconColor)+'">'
              + '<circle cx="8" cy="8" r="6" fill="currentColor" />'
              + '</svg>'
              + '<span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">'+safeTitle+'</span>'
              + (safeNum ? '<span style="flex:none;margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#'+safeNum+'</span>' : '')
              + '</a>';
          }
          case 'text': return '<div>' + escapeHtml(val.text ?? '') + '</div>';
          case 'number': { const num = (val.number !== undefined && val.number !== null) ? String(val.number) : ''; return '<div style="text-align:right;font-variant-numeric:tabular-nums">' + escapeHtml(num) + '</div>'; }
          case 'date': { const raw = val.date ?? val.startDate ?? val.dueOn ?? null; if(!raw) return '<div></div>'; try{ const dt = new Date(raw); if(isNaN(dt.getTime())) return '<div>' + escapeHtml(String(raw)) + '</div>'; const formatted = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); return '<div>' + escapeHtml(formatted) + '</div>'; }catch(e){ return '<div>' + escapeHtml(String(raw)) + '</div>'; } }
          case 'single_select': { const name = escapeHtml(val.option?.name ?? ''); let colorRaw = null; if(field && Array.isArray(field.options)){ const opt = field.options.find(o=> (o.id && val.option && val.option.id && o.id === val.option.id) || (o.name && val.option && val.option.name && o.name === val.option.name)); if(opt){ colorRaw = opt.color ?? opt.id ?? null; } } const hex = normalizeOptionColor(colorRaw) || null; const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)); const border = hex || '#999999'; const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)'; const text = hex || '#333333'; return '<div style="display:inline-block;padding:2px 8px;border:1px solid '+escapeAttr(border)+';border-radius:999px;color:'+escapeAttr(text)+';background:'+escapeAttr(bg)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>'; }
          case 'labels': { const parts = (val.labels||[]).map(l=>{ const name = escapeHtml(l.name||''); const repoName = (item && ((item.content && item.content.repository && item.content.repository.nameWithOwner) || (item.repository && item.repository.nameWithOwner))) || (val.raw && val.raw.itemContent && val.raw.itemContent.repository && val.raw.itemContent.repository.nameWithOwner) || null; let colorRaw = (l.color || l.colour) || null; if(field && field.repoOptions && repoName && field.repoOptions[repoName]){ const repoLabels = field.repoOptions[repoName]; const found = repoLabels.find((rl)=> rl && rl.name === l.name); if(found) colorRaw = found.color || found.colour || colorRaw; } const hex = normalizeOptionColor(colorRaw) || null; const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)); const border = hex || '#999999'; const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)'; const text = hex || '#333333'; return '<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;border:1px solid '+escapeAttr(border)+';background:'+escapeAttr(bg)+';color:'+escapeAttr(text)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</span>'; }); return '<div>' + parts.join('') + '</div>'; }
          case 'repository': { const name = escapeHtml(val.repository?.nameWithOwner ?? ''); const url = escapeAttr(val.repository?.url || val.repository?.html_url || ''); return '<a href="'+url+'" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px">' + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)">' + '<path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/>' + '</svg>' + '<span>' + name + '</span>' + '</a>'; }
          case 'pull_request': return (val.pullRequests||[]).map(p=> '<a href="' + escapeAttr(p.url||'') + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(String(p.number||'')) + ' ' + escapeHtml(p.title||'') + '</a>').join('<br/>');
          case 'issue': return (val.issues||[]).map(i=> '<a href="' + escapeAttr(i.url||'') + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(String(i.number||'')) + ' ' + escapeHtml(i.title||'') + '</a>').join('<br/>');
          case 'assignees': {
            const as = val.assignees || [];
            if(as.length === 0) return '<div></div>';
            const avatars = as.slice(0,3);
            const avatarHtml = avatars.map((a, idx) => {
              const url = escapeAttr(a.avatarUrl || a.avatar || '');
              const left = idx === 0 ? '0px' : (idx === 1 ? '-8px' : '-14px');
              const z = Math.max(1, 3 - idx);
              if(url){
                return '<span title="'+escapeAttr(a.login||a.name||'')+'" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url('+url+');border:2px solid var(--vscode-editor-background);margin-left:'+left+';vertical-align:middle;position:relative;z-index:'+z+'"></span>';
              }
              const initials = escapeHtml(((a.name||a.login||'') .split(' ').map(s=>s[0]||'').join('').toUpperCase()).slice(0,2));
              return '<span title="'+escapeAttr(a.login||a.name||'')+'" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#777;color:#fff;font-size:11px;border:2px solid var(--vscode-editor-background);margin-left:'+left+';vertical-align:middle;position:relative;z-index:'+z+'">'+initials+'</span>';
            }).join('');
            const names = as.map(a=>a.login||a.name||'');
            let namesText = '';
            if(names.length === 1) namesText = names[0]; else if(names.length === 2) namesText = names[0] + ' and ' + names[1]; else { namesText = names.slice(0,-1).join(', ') + ' and ' + names.slice(-1)[0]; }
            const avatarsWrapper = '<span style="display:inline-block;vertical-align:middle;height:20px;line-height:20px;margin-right:8px;">'+avatarHtml+'</span>';
            return '<div style="display:flex;align-items:center;gap:8px"><span style="display:flex;align-items:center">'+avatarsWrapper+'</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(namesText)+'</span></div>';
          }
          case 'requested_reviewers': return '<div>' + escapeHtml((val.reviewers||[]).map(r=>r.login||r.name||r.kind||'').join(', ')) + '</div>';
          case 'iteration': { const name = escapeHtml(val.title ?? ''); const rawColor = 'GRAY'; const hex = normalizeOptionColor(rawColor) || null; const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)); const border = hex || '#999999'; const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)'; const text = hex || '#333333'; return '<div style="display:inline-block;padding:2px 8px;border:1px solid '+escapeAttr(border)+';border-radius:999px;color:'+escapeAttr(text)+';background:'+escapeAttr(bg)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>'; }
          case 'parent_issue': {
            const p = (val && (val.parent || val.parentIssue || val.issue || val.option || val.item || val.value)) || (val && val.raw && (val.raw.parent || val.raw.itemContent || val.raw.item)) || null;
            const num = p && (p.number || p.id || (p.raw && p.raw.number)) ? (p.number || (p.raw && p.raw.number) || '') : '';
            const titleText = p && (p.title || p.name || (p.raw && p.raw.title)) ? (p.title || p.name || (p.raw && p.raw.title) || '') : '';
            const link = p && (p.url || p.html_url || (p.raw && p.raw.url)) ? (p.url || p.html_url || (p.raw && p.raw.url) || '') : '';
            const safeTitle = escapeHtml(String(titleText || ''));
            const safeNum = num ? escapeHtml(String(num)) : '';
            const safeUrl = escapeAttr(String(link || ''));
            let statusColorRaw = null;
            try{ if(typeof items !== 'undefined' && Array.isArray(items) && (num || p)){ const repoName = (p && (p.repository && (p.repository.nameWithOwner || p.repository.name))) || (p && p.content && p.content.repository && p.content.repository.nameWithOwner) || null; const candidates = []; if(num) candidates.push(String(num)); if(p && (p.id || (p.raw && p.raw.id))) candidates.push(String(p.id || (p.raw && p.raw.id))); if(p && (p.url || (p.raw && p.raw.url))) candidates.push(String(p.url || (p.raw && p.raw.url))); if(p && (p.title || p.name)) candidates.push(String(p.title || p.name)); const found = items.find(it=>{ const c = (it && (it.content || (it.raw && it.raw.itemContent))) || null; if(!c) return false; const ids = []; if(c.number) ids.push(String(c.number)); if(c.id) ids.push(String(c.id)); if(c.url) ids.push(String(c.url)); if(c.title) ids.push(String(c.title)); if(c.name) ids.push(String(c.name)); if(c.raw && c.raw.number) ids.push(String(c.raw.number)); if(c.raw && c.raw.id) ids.push(String(c.raw.id)); if(c.raw && c.raw.url) ids.push(String(c.raw.url)); if(repoName){ const r = (c.repository && (c.repository.nameWithOwner || c.repository.name)) || null; if(r && String(r) !== String(repoName)) return false; } for(let a=0;a<candidates.length;a++){ for(let b=0;b<ids.length;b++){ if(candidates[a] && ids[b] && String(candidates[a]) === String(ids[b])) return true; } } return false; }); if(found && Array.isArray(found.fieldValues)){ const sf = found.fieldValues.find(fv => fv && fv.type === 'single_select' && ((fv.raw && fv.raw.field && String(fv.raw.field.name||'').toLowerCase()==='status') || (fv.fieldName && String(fv.fieldName||'').toLowerCase()==='status') || (fv.field && fv.field.name && String(fv.field.name||'').toLowerCase()==='status'))); if(sf){ statusColorRaw = (sf.option && (sf.option.color || sf.option.id || sf.option.name)) || (sf.raw && sf.raw.color) || null; } } } }catch(e){}
            if(!statusColorRaw){ statusColorRaw = (p && ((p.option && (p.option.color || p.option.id || p.option.name)) || p.color || p.colour)) || null; }
            const hex = normalizeOptionColor(statusColorRaw) || null;
            const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex));
            const border = hex || '#999999';
            const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)';
            const text = hex || '#333333';
            const pillInner = '<span style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;border:1px solid '+escapeAttr(border)+';background:'+escapeAttr(bg)+';color:'+escapeAttr(text)+'!important;font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none!important">'
              + '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:'+escapeAttr(hex||'#666')+'">'
              + '<circle cx="8" cy="8" r="6" fill="currentColor" />'
              + '</svg>'
              + '<span style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+safeTitle+'</span>'
              + (safeNum ? '<span style="margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#'+safeNum+'</span>' : '')
              + '</span>';
            if(safeUrl){ return '<span data-gh-open="'+safeUrl+'" style="display:inline-block;cursor:pointer">'+pillInner+'</span>'; }
            return pillInner;
          }
          case 'milestone': return '<div>' + escapeHtml(val.milestone?.title ?? '') + '</div>';
          case 'sub_issues_progress': return '<div>' + ((val.percent!==undefined && val.percent!==null) ? escapeHtml(String(val.percent)+'%') : ((val.done!=null && val.total!=null) ? escapeHtml(String(val.done+'/'+val.total)) : '')) + '</div>';
          case 'missing': return '';
          default: return '<div>' + escapeHtml((val && val.raw && val.raw.__typename) ? String(val.raw.__typename) : JSON.stringify(val).slice(0,200)) + '</div>';
        }
      }catch(e){ return ''; }
    }

    // renderer parts (combined)
    function render(snapshot){
      const fields = (snapshot && snapshot.fields) || [];
      const items = (snapshot && snapshot.items) || [];

      container.innerHTML = '';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.documentElement.style.height = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.height = '100%';
      container.style.margin = '0';
      container.style.padding = '0';
      container.style.height = '100%';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
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
      loadBtn.addEventListener('click', ()=>{ currentFirst += 30; requestFields(); loadBtn.disabled = true; loadBtn.textContent = 'Loading…'; });
      controls.appendChild(loadBtn);
      header.appendChild(title);
      header.appendChild(controls);
      container.appendChild(header);

      const wrapper = document.createElement('div');
      wrapper.style.overflowX = 'auto';
      wrapper.style.overflowY = 'auto';
      wrapper.style.width = '100%';
      wrapper.style.display = 'block';

      const table = document.createElement('table');
      table.style.borderCollapse = 'separate';
      table.style.borderSpacing = '0';
      table.style.tableLayout = 'fixed';
      table.style.width = 'max-content';

      const colgroup = document.createElement('colgroup');
      const idxCol = document.createElement('col');
      colgroup.appendChild(idxCol);
      for(let i=0;i<fields.length;i++){ const c = document.createElement('col'); colgroup.appendChild(c); }
      table.appendChild(colgroup);

      const thead = document.createElement('thead');
      thead.style.background = 'var(--vscode-editor-background)';
      thead.style.position = 'relative';
      thead.style.zIndex = '10';
      const headerRow = document.createElement('tr');
      const idxTh = document.createElement('th');
      idxTh.textContent = '#'; idxTh.style.padding = '6px'; idxTh.style.textAlign = 'left'; idxTh.style.borderLeft = 'none'; idxTh.style.borderRight = '1px solid var(--vscode-editorGroup-border)'; idxTh.style.borderTop = '1px solid var(--vscode-editorGroup-border)'; idxTh.style.borderBottom = '1px solid var(--vscode-editorGroup-border)'; idxTh.style.position = 'sticky'; idxTh.style.top = '0'; idxTh.style.zIndex = '11'; idxTh.style.background = 'var(--vscode-editor-background)'; headerRow.appendChild(idxTh);
      for(const f of fields){ const th = document.createElement('th'); th.textContent = f.name || f.id || ''; th.style.padding = '6px'; th.style.textAlign = 'left'; th.style.whiteSpace = 'nowrap'; th.style.overflow = 'hidden'; th.style.textOverflow = 'ellipsis'; th.style.borderLeft = '1px solid var(--vscode-editorGroup-border)'; th.style.borderRight = '1px solid var(--vscode-editorGroup-border)'; th.style.borderTop = '1px solid var(--vscode-editorGroup-border)'; th.style.borderBottom = '1px solid var(--vscode-editorGroup-border)'; th.style.position = 'sticky'; th.style.top = '0'; th.style.zIndex = '11'; th.style.background = 'var(--vscode-editor-background)'; headerRow.appendChild(th); }
      thead.appendChild(headerRow); table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for(let i=0;i<items.length;i++){
        const it = items[i];
        const tr = document.createElement('tr');
        const idxTd = document.createElement('td'); idxTd.textContent = String(i+1); idxTd.style.padding = '6px'; idxTd.style.whiteSpace = 'nowrap'; idxTd.style.overflow = 'hidden'; idxTd.style.textOverflow = 'ellipsis'; idxTd.style.borderTop = '1px solid var(--vscode-editorGroup-border)'; idxTd.style.borderRight = '1px solid var(--vscode-editorGroup-border)'; idxTd.style.borderBottom = '1px solid var(--vscode-editorGroup-border)'; idxTd.style.borderLeft = 'none'; tr.appendChild(idxTd);
        const fvals = it.fieldValues || [];
        for(let j=0;j<fields.length;j++){
          const td = document.createElement('td'); td.style.padding = '6px'; td.style.border = '1px solid var(--vscode-editorGroup-border)'; td.style.whiteSpace = 'nowrap'; td.style.overflow = 'hidden'; td.style.textOverflow = 'ellipsis'; td.innerHTML = fvals[j] ? toHtml(fvals[j], fields[j], it) : ''; td.style.position = 'relative';
          const cellResizer = document.createElement('div'); cellResizer.style.position = 'absolute'; cellResizer.style.right = '0'; cellResizer.style.top = '0'; cellResizer.style.width = '8px'; cellResizer.style.cursor = 'col-resize'; cellResizer.style.userSelect = 'none'; cellResizer.style.height = '100%'; cellResizer.style.zIndex = '20'; cellResizer.style.transform = 'translateX(2px)'; td.appendChild(cellResizer);
          (function(colIndex){ const cols = colgroup.children; let startX = 0; let startWidth = 0; function onMouseMove(ev){ const delta = ev.clientX - startX; const newW = Math.max(20, startWidth + delta); cols[colIndex].style.width = newW + 'px'; } function onMouseUp(){ document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; } cellResizer.addEventListener('mousedown', function(e){ e.preventDefault(); startX = e.clientX; startWidth = cols[colIndex].getBoundingClientRect().width; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }); })(j+1);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody); wrapper.appendChild(table); container.appendChild(wrapper);

      (function setInitialColumnWidths(){ try{ const cols = colgroup.children; const ths = headerRow.children; for(let i=0;i<ths.length && i<cols.length;i++){ const th = ths[i]; const span = document.createElement('span'); span.style.visibility = 'hidden'; span.style.position = 'absolute'; span.style.whiteSpace = 'nowrap'; span.style.font = window.getComputedStyle(th).font || ''; span.textContent = th.textContent || ''; document.body.appendChild(span); const measured = span.offsetWidth; document.body.removeChild(span); const padding = 24; const newW = Math.max(th.clientWidth, measured + padding); cols[i].style.width = newW + 'px'; } }catch(e){} })();

      try{ const tblW = table.getBoundingClientRect().width; if(tblW && isFinite(tblW)) table.style.width = tblW + 'px'; }catch(e){}

      (function addColumnResizers(){ const cols = colgroup.children; const ths = headerRow.children; for(let i=0;i<ths.length && i<cols.length;i++){ const th = ths[i]; if(!th.style.position) th.style.position = 'relative'; const resizer = document.createElement('div'); resizer.style.position = 'absolute'; resizer.style.right = '0'; resizer.style.top = '0'; resizer.style.width = '8px'; resizer.style.cursor = 'col-resize'; resizer.style.userSelect = 'none'; resizer.style.height = '100%'; resizer.style.zIndex = '20'; resizer.style.transform = 'translateX(2px)'; th.appendChild(resizer); (function(colIndex){ let startX = 0; let startWidth = 0; function onMouseMove(ev){ const delta = ev.clientX - startX; const newW = Math.max(20, startWidth + delta); cols[colIndex].style.width = newW + 'px'; } function onMouseUp(){ document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; } resizer.addEventListener('mousedown', function(e){ e.preventDefault(); startX = e.clientX; startWidth = cols[colIndex].getBoundingClientRect().width; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }); })(i); } })();

      if(items.length >= currentFirst){ loadBtn.disabled = false; loadBtn.textContent = 'Load more'; } else { loadBtn.disabled = true; loadBtn.textContent = 'All loaded'; }

      function updateWrapperHeight() { const availableHeight = container.clientHeight; const currentHeaderHeight = header.offsetHeight; const newMaxHeight = Math.max(0, availableHeight - currentHeaderHeight); wrapper.style.maxHeight = newMaxHeight + 'px'; }
      updateWrapperHeight(); window.addEventListener('resize', updateWrapperHeight);

      document.addEventListener('click', function(ev){ try{ const t = ev.target; if(!t) return; const el = t.closest ? t.closest('[data-gh-open]') : (t.getAttribute && t.getAttribute('data-gh-open') ? t : null); if(el){ const url = el.getAttribute('data-gh-open'); if(url){ try{ if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){ vscodeApi.postMessage({ command: 'openUrl', url: url }); ev.preventDefault(); return; } }catch(_){ } try{ window.open(url, '_blank'); ev.preventDefault(); }catch(_){ } } } }catch(e){} });

      document.addEventListener('keydown', function(ev){ try{ if(ev.key !== 'Enter' && ev.key !== ' ') return; const active = document.activeElement; if(active && active.getAttribute){ const url = active.getAttribute('data-gh-open'); if(url){ try{ if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){ vscodeApi.postMessage({ command: 'openUrl', url: url }); ev.preventDefault(); return; } }catch(_){ } try{ window.open(url, '_blank'); ev.preventDefault(); }catch(_){ } } } }catch(e){} });
    }

    // messaging (listen for fields payloads)

    function onMessage(e){ const event = e && e.data ? e.data : e; try{ if(window.vscodeApi && typeof window.vscodeApi.postMessage === 'function'){ window.vscodeApi.postMessage({ command: 'debugLog', level: 'debug', viewKey, message: 'tableViewFetcher.onMessage', data: { command: event && event.command, eventViewKey: event && event.viewKey } }); } }catch(_){ } try{ console.log('tableViewFetcher.onMessage', { command: event && event.command, viewKey: event && event.viewKey }); }catch(_){ }

      if (event && event.command === 'fields') {
        // Only accept messages that exactly match the viewKey provided to this fetcher.
        if (event.viewKey && viewKey && String(event.viewKey) !== String(viewKey)) {
          try {
            if (typeof window.__gh_update_debug__ === 'function')
              window.__gh_update_debug__('local=' + String(viewKey) + '\nevent=' + String(event.viewKey) + '\nallowed=false');
          } catch (e) {}
          return;
        }
        try {
          if (typeof window.__gh_update_debug__ === 'function')
            window.__gh_update_debug__('local=' + String(viewKey) + '\nevent=' + String(event.viewKey) + '\nallowed=true');
        } catch (e) {}
        if (event.error) {
          container.innerHTML = '<div class="title">' + (view.name || view.id || 'Table View') + '</div>' + '<div style="color:var(--vscode-editor-foreground)">' + String(event.error) + '</div>';
        } else {
          render(event.payload || event.payload?.data || event.payload);
        }
      }
    }

    function requestFields(){ try{ try{ if(window.vscodeApi && typeof window.vscodeApi.postMessage === 'function'){ window.vscodeApi.postMessage({ command: 'debugLog', level: 'debug', viewKey, message: 'tableViewFetcher.requestFields', data: { first: currentFirst } }); } }catch(_){ } try{ console.log('tableViewFetcher.requestFields', { viewKey, first: currentFirst }); }catch(_){ } if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){ vscodeApi.postMessage({ command: 'requestFields', first: currentFirst, viewKey: viewKey }); } }catch(e){} }

    // update on-page debug banner when making a request
    try{ if(typeof window.__gh_update_debug__ === 'function') window.__gh_update_debug__('local=' + String(viewKey) + '\nrequesting...'); }catch(e){}

    window.addEventListener('message', onMessage);
    requestFields();
  };
})();
