export const valueToHtml = `
function toHtml(val, field, item){
    if(!val) return '';
    try{
      switch(val.type){
        case 'title': {
          // Extract title text safely (various shapes in fetched data)
          const titleText = (val && val.title && ( (val.title.raw && val.title.raw.text) || (val.title.content && (val.title.content.title || val.title.content.name)) || (typeof val.title === 'string' && val.title) ))
            || (val && val.content && (val.content.title || val.content.name))
            || (val && val.raw && val.raw.text)
            || '';

          // Item number and url (if available)
          const number = (val && val.title && val.title.content && val.title.content.number) || (val && val.raw && val.raw.itemContent && val.raw.itemContent.number) || (item && item.content && item.content.number) || '';
          const url = (val && val.title && val.title.content && val.title.content.url) || (val && val.raw && val.raw.itemContent && val.raw.itemContent.url) || (item && item.content && item.content.url) || '';

          // Try to find a 'Status' single_select on the same item to derive color
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

          // Link opens in new tab but styled like normal text
          // Use flex layout and min-width:0 on the title so it can shrink/expand correctly
          return '<a href="'+safeUrl+'" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px;width:100%;">'
            + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:'+escapeAttr(iconColor)+'">'
            + '<circle cx="8" cy="8" r="6" fill="currentColor" />'
            + '</svg>'
            + '<span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">'+safeTitle+'</span>'
            + (safeNum ? '<span style="flex:none;margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#'+safeNum+'</span>' : '')
            + '</a>';
        }
        case 'text': return '<div>' + escapeHtml(val.text ?? '') + '</div>';
        case 'number': {
          const num = (val.number !== undefined && val.number !== null) ? String(val.number) : '';
          return '<div style="text-align:right;font-variant-numeric:tabular-nums">' + escapeHtml(num) + '</div>';
        }
        case 'date': {
          const raw = val.date ?? val.startDate ?? val.dueOn ?? null;
          if(!raw) return '<div></div>';
          try{
            const dt = new Date(raw);
            if(isNaN(dt.getTime())) return '<div>' + escapeHtml(String(raw)) + '</div>';
            const formatted = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return '<div>' + escapeHtml(formatted) + '</div>';
          }catch(e){
            return '<div>' + escapeHtml(String(raw)) + '</div>';
          }
        }
        case 'single_select': {
          const name = escapeHtml(val.option?.name ?? '');
          // Prefer definitive color from the field.options by matching id (or name)
          let colorRaw = null;
          if(field && Array.isArray(field.options)){
            const opt = field.options.find(o=> (o.id && val.option && val.option.id && o.id === val.option.id) || (o.name && val.option && val.option.name && o.name === val.option.name));
              if(opt){ colorRaw = opt.color ?? opt.id ?? null; }
          }
          // Only accept hex-like values; do not fallback to enum color names
          const hex = normalizeOptionColor(colorRaw) || null;
          const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex));
          const border = hex || '#999999';
          const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)';
          const text = hex || '#333333';
          return '<div style="display:inline-block;padding:2px 8px;border:1px solid '+escapeAttr(border)+';border-radius:999px;color:'+escapeAttr(text)+';background:'+escapeAttr(bg)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>';
        }
        case 'labels': {
          const parts = (val.labels||[]).map(l=>{
            const name = escapeHtml(l.name||'');
            // Determine repo name for this item
            const repoName = (item && ((item.content && item.content.repository && item.content.repository.nameWithOwner) || (item.repository && item.repository.nameWithOwner))) || (val.raw && val.raw.itemContent && val.raw.itemContent.repository && val.raw.itemContent.repository.nameWithOwner) || null;
            let colorRaw = (l.color || l.colour) || null;
            // If field.repoOptions exists and we have a repo, try to find the label color there
            if(field && field.repoOptions && repoName && field.repoOptions[repoName]){
              const repoLabels = field.repoOptions[repoName];
              const found = repoLabels.find((rl)=> rl && rl.name === l.name);
              if(found) colorRaw = found.color || found.colour || colorRaw;
            }
            // Only accept hex-like values; do not fallback to color names
            const hex = normalizeOptionColor(colorRaw) || null;
            const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex));
            const border = hex || '#999999';
            const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)';
            const text = hex || '#333333';
            return '<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;border:1px solid '+escapeAttr(border)+';background:'+escapeAttr(bg)+';color:'+escapeAttr(text)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</span>';
          });
          return '<div>' + parts.join('') + '</div>';
        }
        case 'repository': {
          const name = escapeHtml(val.repository?.nameWithOwner ?? '');
          const url = escapeAttr(val.repository?.url || val.repository?.html_url || '');
          // Inline repo icon (uses currentColor) + name. Style link to remove default link visuals.
          return '<a href="'+url+'" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:8px">'
            + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:var(--vscode-icon-foreground)">'
            + '<path fill="currentColor" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11zM3.5 2A.5.5 0 0 0 3 2.5V4h10V2.5a.5.5 0 0 0-.5-.5h-9z"/>'
            + '</svg>'
            + '<span>' + name + '</span>'
            + '</a>';
        }
        case 'pull_request': return (val.pullRequests||[]).map(p=> '<a href="' + escapeAttr(p.url||'') + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(String(p.number||'')) + ' ' + escapeHtml(p.title||'') + '</a>').join('<br/>');
        case 'issue': return (val.issues||[]).map(i=> '<a href="' + escapeAttr(i.url||'') + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(String(i.number||'')) + ' ' + escapeHtml(i.title||'') + '</a>').join('<br/>');
        case 'assignees': {
          const as = val.assignees || [];
          if(as.length === 0) return '<div></div>';

          // Avatars: show up to 3 overlapping avatars (only first three shown)
          const avatars = as.slice(0,3);
          const avatarHtml = avatars.map((a, idx) => {
            const url = escapeAttr(a.avatarUrl || a.avatar || '');
            const left = idx === 0 ? '0px' : (idx === 1 ? '-8px' : '-14px');
            const z = Math.max(1, 3 - idx); // small z-index so avatars stay under header
            if(url){
              return '<span title="'+escapeAttr(a.login||a.name||'')+'" style="display:inline-block;width:20px;height:20px;border-radius:50%;overflow:hidden;background-size:cover;background-position:center;background-image:url('+url+');border:2px solid var(--vscode-editor-background);margin-left:'+left+';vertical-align:middle;position:relative;z-index:'+z+'"></span>';
            }
            // fallback: initials
            const initials = escapeHtml(((a.name||a.login||'') .split(' ').map(s=>s[0]||'').join('').toUpperCase()).slice(0,2));
            return '<span title="'+escapeAttr(a.login||a.name||'')+'" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#777;color:#fff;font-size:11px;border:2px solid var(--vscode-editor-background);margin-left:'+left+';vertical-align:middle;position:relative;z-index:'+z+'">'+initials+'</span>';
          }).join('');

          // Names: comma separated, with ' and ' before last one
          const names = as.map(a=>a.login||a.name||'');
          let namesText = '';
          if(names.length === 1) namesText = names[0];
          else if(names.length === 2) namesText = names[0] + ' and ' + names[1];
          else {
            namesText = names.slice(0,-1).join(', ') + ' and ' + names.slice(-1)[0];
          }

          // Wrap avatars in a container that keeps overlap
          const avatarsWrapper = '<span style="display:inline-block;vertical-align:middle;height:20px;line-height:20px;margin-right:8px;">'+avatarHtml+'</span>';

          return '<div style="display:flex;align-items:center;gap:8px"><span style="display:flex;align-items:center">'+avatarsWrapper+'</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(namesText)+'</span></div>';
        }
        case 'requested_reviewers': return '<div>' + escapeHtml((val.reviewers||[]).map(r=>r.login||r.name||r.kind||'').join(', ')) + '</div>';
        case 'iteration': {
          const name = escapeHtml(val.title ?? '');
          // Use a fixed GRAY color for iteration pills
          const rawColor = 'GRAY';
          const hex = normalizeOptionColor(rawColor) || null;
          const isHex = !!(hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex));
          const border = hex || '#999999';
          const bg = isHex ? (hexToRgba(hex, 0.12) || 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.06)';
          const text = hex || '#333333';
          return '<div style="display:inline-block;padding:2px 8px;border:1px solid '+escapeAttr(border)+';border-radius:999px;color:'+escapeAttr(text)+';background:'+escapeAttr(bg)+';font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>';
        }
        case 'parent_issue': {
          // Render parent issue as a pill: status-colored icon (if available) + title + #num
          const p = (val && (val.parent || val.parentIssue || val.issue || val.option || val.item || val.value)) || (val && val.raw && (val.raw.parent || val.raw.itemContent || val.raw.item)) || null;
          const num = p && (p.number || p.id || (p.raw && p.raw.number)) ? (p.number || (p.raw && p.raw.number) || '') : '';
          const titleText = p && (p.title || p.name || (p.raw && p.raw.title)) ? (p.title || p.name || (p.raw && p.raw.title) || '') : '';
          const link = p && (p.url || p.html_url || (p.raw && p.raw.url)) ? (p.url || p.html_url || (p.raw && p.raw.url) || '') : '';

          const safeTitle = escapeHtml(String(titleText || ''));
          const safeNum = num ? escapeHtml(String(num)) : '';
          const safeUrl = escapeAttr(String(link || ''));

          // Try to find parent's Status color by looking up the parent item in the current items array
          let statusColorRaw = null;
          try{
            if(typeof items !== 'undefined' && Array.isArray(items) && (num || p)){
              const repoName = (p && (p.repository && (p.repository.nameWithOwner || p.repository.name))) || (p && p.content && p.content.repository && p.content.repository.nameWithOwner) || null;
              const candidates = [];
              if(num) candidates.push(String(num));
              if(p && (p.id || (p.raw && p.raw.id))) candidates.push(String(p.id || (p.raw && p.raw.id)));
              if(p && (p.url || (p.raw && p.raw.url))) candidates.push(String(p.url || (p.raw && p.raw.url)));
              if(p && (p.title || p.name)) candidates.push(String(p.title || p.name));

              const found = items.find(it=>{
                const c = (it && (it.content || (it.raw && it.raw.itemContent))) || null;
                if(!c) return false;
                // collect comparable identifiers from candidate item
                const ids = [];
                if(c.number) ids.push(String(c.number));
                if(c.id) ids.push(String(c.id));
                if(c.url) ids.push(String(c.url));
                if(c.title) ids.push(String(c.title));
                if(c.name) ids.push(String(c.name));
                if(c.raw && c.raw.number) ids.push(String(c.raw.number));
                if(c.raw && c.raw.id) ids.push(String(c.raw.id));
                if(c.raw && c.raw.url) ids.push(String(c.raw.url));

                // if repoName provided, verify repository matches (if available)
                if(repoName){
                  const r = (c.repository && (c.repository.nameWithOwner || c.repository.name)) || null;
                  if(r && String(r) !== String(repoName)) return false;
                }

                // match if any candidate identifier equals any id from this item
                for(let a=0;a<candidates.length;a++){
                  for(let b=0;b<ids.length;b++){
                    if(candidates[a] && ids[b] && String(candidates[a]) === String(ids[b])) return true;
                  }
                }
                return false;
              });
              if(found && Array.isArray(found.fieldValues)){
                const sf = found.fieldValues.find(fv => fv && fv.type === 'single_select' && ((fv.raw && fv.raw.field && String(fv.raw.field.name||'').toLowerCase()==='status') || (fv.fieldName && String(fv.fieldName||'').toLowerCase()==='status') || (fv.field && fv.field.name && String(fv.field.name||'').toLowerCase()==='status')));
                if(sf){ statusColorRaw = (sf.option && (sf.option.color || sf.option.id || sf.option.name)) || (sf.raw && sf.raw.color) || null; }
              }
            }
          }catch(e){}

          // fallback: if parent object directly contains an option/color
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

          if(safeUrl){
            // clickable via delegated handler / extension; do NOT add tabindex or role to avoid global link styling
            return '<span data-gh-open="'+safeUrl+'" style="display:inline-block;cursor:pointer">'+pillInner+'</span>';
          }
          return pillInner;
        }
        case 'milestone': return '<div>' + escapeHtml(val.milestone?.title ?? '') + '</div>';
        case 'sub_issues_progress': return '<div>' + ((val.percent!==undefined && val.percent!==null) ? escapeHtml(String(val.percent)+'%') : ((val.done!=null && val.total!=null) ? escapeHtml(String(val.done+'/'+val.total)) : '')) + '</div>';
        case 'missing': return '';
        default: return '<div>' + escapeHtml((val && val.raw && val.raw.__typename) ? String(val.raw.__typename) : JSON.stringify(val).slice(0,200)) + '</div>';
      }
    }catch(e){ return ''; }
}

`;
