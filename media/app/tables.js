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

  // Color utilities for SINGLE_SELECT pills: map GitHub enum color to hex and RGBA with alpha.
  const GH_COLOR_HEX = {
    BLUE: '#0969da',
    GREEN: '#1a7f37',
    YELLOW: '#9a6700',
    ORANGE: '#bc4c00',
    RED: '#d1242f',
    PURPLE: '#8250df',
    PINK: '#bf3989',
    GRAY: '#6e7781',
    GREY: '#6e7781'
  };

  function hexToRgb(hex){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  function rgba(hex, a){
    const rgb = hexToRgb(hex);
    if (!rgb) return '';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
  }

  function getPillColors(enumName){
    const base = GH_COLOR_HEX[enumName?.toUpperCase?.() || ''] || '';
    if (!base) return null;
    // GitHub labels/pills generally use a translucent background behind a solid text color
    return { bg: rgba(base, 0.15), fg: base };
  }

  // Helpers shared by SINGLE_SELECT and LABEL rendering
  function parseColorToken(color){
    if (!color) return null;
    if (typeof color === 'string' && GH_COLOR_HEX[color.toUpperCase()]) return GH_COLOR_HEX[color.toUpperCase()];
    if (typeof color === 'string' && /^([0-9a-f]{6})$/i.test(color)) return '#' + color;
    if (typeof color === 'string' && /^#([0-9a-f]{6})$/i.test(color)) return color;
    return null;
  }

  // Try to find an option on a field whose name matches any of the provided
  // candidate names (case-insensitive). Returns a parsed hex color or null.
  function optionColorForNames(fieldMeta, candidates){
    try {
      if (!fieldMeta || !Array.isArray(fieldMeta.options) || !candidates || !candidates.length) return null;
      const upper = candidates.map(s => String(s || '').toUpperCase());
      for (const opt of fieldMeta.options) {
        if (!opt || !opt.name) continue;
        const name = String(opt.name || '').toUpperCase();
        if (upper.includes(name) || upper.some(u => name.indexOf(u) >= 0 || u.indexOf(name) >= 0)) {
          const resolved = parseColorToken(opt.color) || opt.color || null;
          if (resolved) return resolved;
        }
      }
    } catch (e) {}
    return null;
  }

  function contrastTextColor(hex){
    const rgb = hexToRgb(hex || '#ffffff');
    if (!rgb) return 'var(--vscode-foreground)';
    const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return lum > 0.6 ? '#111827' : '#ffffff';
  }

  // Format a date-like value as "Mon DD, YYYY" (e.g. "Nov 15, 2025").
  function formatDateHuman(v){
    if (v == null || v === '') return '';
    try {
      let d = null;
      if (v instanceof Date) d = v;
      else if (typeof v === 'number') d = new Date(v);
      else if (typeof v === 'string') {
        const s = v.trim();
        // handle common GitHub-ish date-only YYYY-MM-DD or full ISO
        const isoLike = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(s);
        if (isoLike) {
          d = new Date(s);
          if (isNaN(d)) {
            // fallback: parse as local Y,M,D
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          }
        } else {
          const parsed = Date.parse(s);
          if (!isNaN(parsed)) d = new Date(parsed);
        }
      } else if (typeof v === 'object') {
        // sometimes values are objects like { date: '2025-11-15' } or { value: '2025-11-15' }
        const cand = v.date ?? v.value ?? v.raw ?? v.iso ?? null;
        if (cand) return formatDateHuman(cand);
      }
      if (!d || isNaN(d.getTime())) return String(v);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch (e) {
      return String(v);
    }
  }

  function normalizeToArray(v){
    if (Array.isArray(v)) return v;
    if (v == null || v === '') return [];
    return [v];
  }

  // Helper: build colgroup HTML string including the two left helper columns.
  function buildColGroup(colsArr){
    const defaultWidth = 160; // px
    const emptyColWidth = 12;
    const indexColWidth = 48;
    return '<colgroup>' + ('<col style="width:' + emptyColWidth + 'px">') + ('<col style="width:' + indexColWidth + 'px">') + colsArr.map(() => '<col style="width:' + defaultWidth + 'px">').join('') + '</colgroup>';
  }

  // Helper: build thead HTML string from fields
  function buildThead(colsArr){
    const thStyleEmptyLocal = thStyle + 'padding:0; border-left:0; border-right:0; cursor:default;';
    const thStyleIndexLocal = thStyle + 'text-align:center; padding:4px; cursor:default; border-left:0; border-right:0;';
    const headerRowLocal = '<tr data-header-row="1">'
      + ('<th data-col-index="0" style="' + thStyleEmptyLocal + '"></th>')
      + ('<th data-col-index="1" style="' + thStyleIndexLocal + '"></th>')
      + colsArr.map((c, i) => (
        '<th data-col-index="' + (i + 2) + '" style="' + thStyle + '">'
        + esc(c.name)
        + '</th>'
      )).join('') + '</tr>';
    return '<thead>' + headerRowLocal + '</thead>';
  }

  // Helper: build tbody rows HTML
  function buildRowsHtml(colsArr, itemsArr){
    const tdStyleEmptyLocal = tdStyle + 'padding:0; width:' + emptyColWidth + 'px; border-left:0; border-right:0; box-sizing:border-box;';
    const tdStyleIndexLocal = tdStyle + 'text-align:center; width:' + indexColWidth + 'px; border-left:0; border-right:0;';
  // small avatar style used for user columns
  const avatarStyle = 'display:inline-block; width:20px; height:20px; border-radius:50%; vertical-align:middle; margin-right:6px; flex:0 0 20px;';
  const userNameStyle = 'display:inline-block; vertical-align:middle; max-width:96px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--vscode-foreground); font-size:12px;';
    // Helper: render progress field cell HTML (returns full <td>..</td>)
    function renderProgressCell(c, val, row) {
      try { if (DEV_LOG) console.info('tables: progress-field', { field: c.name, value: val }); } catch (e) {}
      // Expect normalized value: either an object { total, completed, percent } or an array of such objects
      const parts = normalizeToArray(val).map(item => {
        if (!item || typeof item !== 'object') return '';
        const total = Number(item.total ?? 0);
        if (!total) return '';
        const completed = Math.max(0, Math.min(total, Number(item.completed ?? 0)));
        const percent = item.percent !== undefined ? Math.round(Number(item.percent)) : Math.round((completed / total) * 100);
        // Prefer a color defined on the field options (e.g. a single-select option named 'Done'/'Completed')
        const purple = optionColorForNames(c, ['done', 'completed', 'complete']) || (GH_COLOR_HEX.PURPLE || '#8250df');
        const segs = [];
        for (let s = 0; s < total; s++) {
          const isDone = s < completed;
          if (isDone) segs.push('<div style="flex:1;height:12px;margin-right:4px;background:' + purple + ';border-radius:4px"></div>');
          else segs.push('<div style="flex:1;height:12px;margin-right:4px;background:transparent;border:2px solid ' + purple + ';border-radius:4px;box-sizing:border-box"></div>');
        }
        const segHtml = '<div style="display:flex;align-items:center;gap:0;flex:1;min-width:80px;max-width:220px">' + segs.map((h, idx) => idx === segs.length - 1 ? h.replace(/margin-right:4px;/,'') : h).join('') + '</div>';
        return '<div style="display:flex;align-items:center;gap:8px;min-width:84px;max-width:320px">' + segHtml + '<div style="width:48px;text-align:right;font-size:11px;color:var(--vscode-foreground);">' + esc(percent + '%') + '</div></div>';
      });
      const joined = parts.filter(Boolean).join('');
      if (!joined) return '<td style="' + tdStyle + '">&nbsp;</td>';
      return '<td style="' + tdStyle + '">' + joined + '</td>';
    }

    // Helper: render parent issue as a pill inside a <td>
    function renderParentCell(c, val, row) {
      const pv = val && Object.keys(val || {}).length ? val : (row && row.parent ? row.parent : null);
      if (!pv) return '<td style="' + tdStyle + '">&nbsp;</td>';
      const titleText = pv.title ? String(pv.title) : '';
      const href = pv.url ?? null;
      const state = pv.state ? String(pv.state).toUpperCase() : '';
      // Default mapping by state; prefer any matching option color from field settings
      let stateHex = GH_COLOR_HEX.GRAY || '#6e7781';
      if (state === 'OPEN') stateHex = GH_COLOR_HEX.GREEN || '#1a7f37';
      else if (state === 'DONE' || /\bdone\b/i.test(state)) stateHex = GH_COLOR_HEX.PURPLE || '#8250df';
      else if (state === 'CLOSED') stateHex = GH_COLOR_HEX.GRAY || '#6e7781';
      else if (/CANCEL|CANCE(L|D)/i.test(state)) stateHex = GH_COLOR_HEX.ORANGE || '#bc4c00';
      else if (state === 'MERGED') stateHex = GH_COLOR_HEX.PURPLE || '#8250df';
      // Prefer any option color that matches the state name (field-level configuration)
      try {
        const optColor = optionColorForNames(c, [state]);
        if (optColor) stateHex = optColor;
      } catch (e) {}
      const pillBg = rgba(stateHex, 0.12);
      const pillBorder = '1px solid ' + rgba(stateHex, 0.36);
      const pillFg = stateHex;
      const baseStyle = 'display:inline-flex;align-items:center;gap:8px;margin-right:6px;padding:0 8px;line-height:20px;height:20px;border-radius:999px;font-size:12px;text-decoration:none;box-sizing:border-box;';
      const pillStyle = baseStyle + 'background:' + pillBg + ';border:' + pillBorder + ';color:' + pillFg + ';';
      const iconColor = pillFg;
      let icon = '';
      if (state === 'OPEN' || state === '') icon = '<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 12px;vertical-align:middle;"><circle cx="6" cy="6" r="5" fill="' + iconColor + '" /></svg>';
      else if (state === 'DONE' || /\bdone\b/i.test(state) || state === 'MERGED') icon = '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 12px;vertical-align:middle;"><path d="M4 8l3 3 6-6" stroke="' + iconColor + '" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      else if (state === 'CLOSED') icon = '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 12px;vertical-align:middle;"><path d="M6 10.5L3.5 8l-1 1L6 13.5 13.5 6l-1-1L6 10.5z" fill="' + iconColor + '"/></svg>';
      else if (/CANCEL|CANCE(L|D)/i.test(state)) icon = '<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 12px;vertical-align:middle;"><rect x="2" y="5.5" width="8" height="1" fill="' + iconColor + '" rx="0.5"/></svg>';
      else icon = '<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 12px;vertical-align:middle;"><circle cx="6" cy="6" r="5" fill="' + iconColor + '" /></svg>';
      const visible = esc(titleText || (pv.number ? ('#' + pv.number) : ''));
      const inner = icon + '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;display:inline-block;vertical-align:middle;">' + visible + '</span>';
      if (href) return '<td style="' + tdStyle + '"><a href="' + esc(href) + '" target="_blank" rel="noreferrer noopener" style="' + pillStyle + '">' + inner + '</a></td>';
      return '<td style="' + tdStyle + '"><span style="' + pillStyle + '">' + inner + '</span></td>';
    }

    return (Array.isArray(itemsArr) ? itemsArr : []).map((row, rowIdx) => {
      const emptyCell = '<td style="' + tdStyleEmptyLocal + '"></td>';
      const indexCell = '<td style="' + tdStyleIndexLocal + '">' + String(rowIdx + 1) + '</td>';
      const cells = colsArr.map(c => {
        const val = row && row.fieldValues ? row.fieldValues[c.id] : '';
        let text = '';

        // Helper to render a single user-like object
        function renderUser(u, fieldName){
          if (!u) return '';
          // u can be a string (login) or an object with avatarUrl/login/name
          if (typeof u === 'string') return esc(u);
          // Expect normalized user object: { login, name, avatarUrl, url }
          const avatar = u.avatarUrl || u.ownerAvatar || u.avatar || '';
          const label = u.login || u.name || u.title || u.username || '';
          if (avatar) {
            // compute initials for SVG fallback if image fails to load
            const initials = (String(label || '') || '').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('').slice(0,2) || '';
            const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect fill='%23dddddd' width='100%' height='100%'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='10' fill='%23444444' font-family='Arial,Helvetica,sans-serif'>" + esc(initials) + "</text></svg>";
            const svgUri = encodeURIComponent(svg);
            // onerror replaces image src with an inline SVG showing initials as fallback
            const onerr = "this.onerror=null;this.src='data:image/svg+xml;utf8," + svgUri + "'";
            // Render avatar plus visible login/name text next to it so users can see the handle
            const visibleLabel = esc(label || u.login || u.name || '');
            return '<span title="' + visibleLabel + '" style="display:inline-flex; align-items:center; gap:6px; margin-right:6px">'
              + ('<img src="' + esc(avatar) + '" style="' + avatarStyle + '" alt="" onerror="' + onerr + '"/>')
              + ('<span style="' + userNameStyle + '">' + visibleLabel + '</span>')
              + '</span>';
          }
          // If no avatar, log once to help debug data shape (include field name)
          try { if (DEV_LOG) console.info('tables: missing-avatar', { field: fieldName, value: u }); } catch (e) {}
          // Prefer login or name as a visible fallback; avoid showing [object Object]
          if (u && typeof u === 'object') {
            try { if (DEV_LOG) console.warn('tables: fallback-user-shape', { field: fieldName, sample: u }); } catch(e){}
            return esc(u.login || u.name || u.url || JSON.stringify(u).slice(0,80));
          }
          return esc(String(u));
        }

        // Render list of users (reviewers) or single user (assignee)
  const dt = (c.dataType || '').toUpperCase();
        // Unified user handling: some fields (Assignees, Reviewers) can contain multiple users
        // Detect multivalued user fields by value shape (array) or by explicit data type/name hints.
        const isMultiUser = Array.isArray(val) || dt === 'USER_LIST' || dt === 'USERS' || /REVIEW|REVIEWER/.test((c.name || '').toUpperCase()) || /ASSIGN|ASSIGNEE/.test((c.name || '').toUpperCase());
        if (dt === 'USER' || /ASSIGN|ASSIGNEE/.test((c.name || '').toUpperCase()) || dt === 'USER_LIST' || dt === 'USERS' || /REVIEW|REVIEWER/.test((c.name || '').toUpperCase())){
            if (isMultiUser) {
              const arr = normalizeToArray(val);
              const max = 6;
              const parts = arr.slice(0, max).map(u => renderUser(u, c.name) || (u && typeof u === 'object' ? esc(u.login || u.name || u.url || JSON.stringify(u).slice(0,80)) : esc(String(u ?? ''))));
              if (arr.length > max) parts.push('<span style="opacity:0.6">…</span>');
              const html = parts.join('');
              return '<td style="' + tdStyle + '">' + (html || '&nbsp;') + '</td>';
            } else {
              const single = normalizeToArray(val)[0] || null;
              const html = renderUser(single, c.name) || (single && typeof single === 'object' ? esc(single.login || single.name || single.url || JSON.stringify(single).slice(0,80)) : esc(String(single ?? '')));
              return '<td style="' + tdStyle + '">' + (html || '&nbsp;') + '</td>';
            }
        }

  // Render LABEL fields (and fields whose name includes 'label') as pills too.
  const isLabelField = /label|labels/.test((c.dataType || c.name || '').toLowerCase());
  // Render ITERATION fields as pills as well (neutral styling)
  const isIterationField = (dt === 'ITERATION') || /iteration/.test((c.name || '').toLowerCase());
  // Render REPOSITORY fields as a single pill (avatar + repo name)
  const isRepositoryField = (dt === 'REPOSITORY') || /repository/.test((c.name || '').toLowerCase());
  // Render MILESTONE fields specially
  const isMilestoneField = (dt === 'MILESTONE') || /milestone/.test((c.name || '').toLowerCase());
  // Render Parent issue fields
  const isParentField = /parent/.test((c.name || '').toLowerCase());
  // Render progress-like fields (e.g. "Sub-issues progress") as inline progress bars
  const isProgressField = /progress/.test((c.name || '').toLowerCase()) || /sub-?issue/.test((c.name || '').toLowerCase());
  // Render linked Pull Request fields as pill-like links
  // Prefer dataType match but also detect by field name. We'll also
  // fall back to value-shape detection (objects with url/title/number)
  let isPullField = (dt === 'LINKED_PULL_REQUESTS') || /\bpull[s\s-]?request(s)?\b/.test((c.name || '').toLowerCase()) || /\bprs?\b/.test((c.name||'').toLowerCase());

  if (isLabelField) {
            const parts = normalizeToArray(val).map(item => {
              // Expect normalized label object: { id, name, color }
              if (!item) return '';
              const name = (typeof item === 'string') ? item : (item.name ?? item.label ?? String(item.id ?? ''));
              const colorToken = item && (item.color || item.colour || item.hex || item.background || item.colorHex) || null;
              const hex = parseColorToken(colorToken);
              const pillBg = hex ? rgba(hex, 0.14) : 'transparent';
              const pillBorder = hex ? ('1px solid ' + rgba(hex, 0.4)) : ('1px solid var(--vscode-editorWidget-border)');
              const pillFg = hex ? hex : 'var(--vscode-foreground)';
              const pillStyle = [
                'display:inline-block','margin-right:6px','max-width:100%','white-space:nowrap','overflow:hidden','text-overflow:ellipsis','border-radius:999px','padding:0 8px','line-height:20px','height:20px','vertical-align:middle','font-size:12px','box-sizing:border-box','background:' + pillBg,'border:' + pillBorder,'color:' + pillFg
              ].join(';');
              return '<span title="' + esc(name) + '" style="' + pillStyle + '">' + esc(name) + '</span>';
            });
            return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
        }

        if (isIterationField) {
          const parts = normalizeToArray(val).map(item => {
            const rawName = (typeof item === 'string') ? item : (item && (item.title ?? item.name ?? item.id) ? (item.title ?? item.name ?? item.id) : '');
            const name = rawName == null ? '' : String(rawName);
            const baseHex = (Array.isArray(c.options) && c.options.length ? (parseColorToken(c.options[0].color) || c.options[0].color) : null) || GH_COLOR_HEX.GRAY || '#6e7781';
            const pillBg = rgba(baseHex, 0.06);
            const pillBorder = '1px solid ' + rgba(baseHex, 0.28);
            const pillFg = 'var(--vscode-foreground)';
            const pillStyle = ['display:inline-block','margin-right:6px','max-width:100%','white-space:nowrap','overflow:hidden','text-overflow:ellipsis','border-radius:999px','padding:0 8px','line-height:20px','height:20px','vertical-align:middle','font-size:12px','box-sizing:border-box','background:' + pillBg,'border:' + pillBorder,'color:' + pillFg].join(';');
            return '<span title="' + esc(name) + '" style="' + pillStyle + '">' + esc(name) + '</span>';
          });
          return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
        }

        // Date fields: format dates uniformly (e.g., "Nov 15, 2025")
        const looksLikeDateField = (dt === 'DATE') || /date/.test((c.name || '').toLowerCase());
        if (looksLikeDateField) {
          const parts = normalizeToArray(val).map(item => {
            const txt = formatDateHuman(item);
            return '<span>' + esc(txt) + '</span>';
          }).filter(Boolean);
          return '<td style="' + tdStyle + '">' + (parts.length ? parts.join(', ') : '&nbsp;') + '</td>';
        }

  if (isRepositoryField) {
          const parts = normalizeToArray(val).map(item => {
            const repoName = item && (item.nameWithOwner || item.repo || item.name) ? (item.nameWithOwner || item.repo || item.name) : '';
            const repoUrl = item && (item.url || item.repoUrl) ? (item.url || item.repoUrl) : null;
            const visible = esc(String(repoName || repoUrl || 'repository'));
            const repoIcon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px;flex:0 0 12px;"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-11z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 6h6M5 9h6" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const textStyle = ['display:inline-block','vertical-align:middle','max-width:220px','white-space:nowrap','overflow:hidden','text-overflow:ellipsis','color:var(--vscode-foreground)','font-size:12px'].join(';');
            const inner = repoIcon + '<span style="' + textStyle + '">' + visible + '</span>';
            if (repoUrl) return '<a href="' + esc(repoUrl) + '" target="_blank" rel="noreferrer noopener" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:6px;">' + inner + '</a>';
            return '<span style="display:inline-flex;align-items:center;gap:6px;">' + inner + '</span>';
          });
          return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
        }

        if (isMilestoneField) {
          const parts = normalizeToArray(val).map(item => {
            if (!item) return '';
            const title = item.title || item.name || (item.id ? String(item.id) : '');
            const due = item.dueOn ? formatDateHuman(item.dueOn) : null;
            const state = item.state ? String(item.state).toUpperCase() : '';
            // color: prefer option matching or fall back to gray
            const stateColor = optionColorForNames(c, [state]) || (GH_COLOR_HEX.GRAY || '#6e7781');
            const pillBg = rgba(stateColor, 0.10);
            const pillBorder = '1px solid ' + rgba(stateColor, 0.36);
            const pillFg = stateColor;
            const baseStyle = 'display:inline-flex;align-items:center;gap:6px;margin-right:6px;padding:0 8px;line-height:20px;height:20px;border-radius:8px;font-size:12px;text-decoration:none;box-sizing:border-box;';
            const style = baseStyle + 'background:' + pillBg + ';border:' + pillBorder + ';color:' + pillFg + ';';
            const inner = esc(title) + (due ? (' <span style="opacity:0.7;margin-left:6px;font-size:11px;">' + esc(due) + '</span>') : '');
            if (item.url) return '<a href="' + esc(item.url) + '" target="_blank" rel="noreferrer noopener" style="' + style + '">' + inner + '</a>';
            return '<span style="' + style + '">' + inner + '</span>';
          });
          return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
        }

        if (isProgressField) {
          try { if (DEV_LOG) console.info('tables: progress-field', { field: c.name, value: val }); } catch (e) {}
          return renderProgressCell(c, val, row);
        }

        if (isParentField) {
          return renderParentCell(c, val, row);
        }

        // If the field name/type didn't flag it as a PR column, inspect the
        // actual value shape to detect linked PRs (some projects return nodes
        // with url/number/title). This helps when server-side shapes vary.
        try {
          const sampleArr = normalizeToArray(val);
          const looksLikePR = sampleArr.some(item => {
            const it = (item && typeof item === 'object') ? item : null;
            return !!(it && (it.url || it.html_url || it.number || it.title));
          });
          if (!isPullField && looksLikePR) isPullField = true;
        } catch (e) {}

        if (isPullField) {
          // PR pill: show icon + "#<number> in <repo>". Support multiple PRs per cell.
          const parts = normalizeToArray(val).map(item => {
            if (!item) return '';
            const url = (item && (item.url || item.html_url || item.link)) || (typeof item === 'string' ? item : null);
            const number = item && (item.number || item.id || null);
            const display = number ? ('#' + number) : (url ? url : 'PR');
            const safe = esc(String(display).slice(0, 60));
            const prIcon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;flex:0 0 12px;"><path d="M5 3.25A1.75 1.75 0 1 0 5 6.75 1.75 1.75 0 0 0 5 3.25zM11 12.25A1.75 1.75 0 1 0 11 15.75 1.75 1.75 0 0 0 11 12.25zM11 3.25A1.75 1.75 0 1 0 11 6.75 1.75 1.75 0 0 0 11 3.25z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.25 6.5h3.5v3" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const prState = (item && item.state) || null;
            const prMerged = !!(item && item.merged);
            // Resolve PR color: prefer a matching option color on the field, else fall back to defaults
            let stateHex = GH_COLOR_HEX.GRAY || '#6e7781';
            if (prMerged) stateHex = GH_COLOR_HEX.PURPLE || '#8250df';
            else if (prState === 'OPEN') stateHex = GH_COLOR_HEX.GREEN || '#1a7f37';
            else if (prState === 'CLOSED') stateHex = GH_COLOR_HEX.GRAY || '#6e7781';
            try {
              const candidates = prMerged ? ['merged','done','completed'] : [String(prState || '')];
              const opt = optionColorForNames(c, candidates);
              if (opt) stateHex = opt;
            } catch (e) {}
            const pillBg = rgba(stateHex, 0.10);
            const pillBorder = '1px solid ' + rgba(stateHex, 0.4);
            const pillFg = stateHex;
            const baseStyle = 'display:inline-flex;align-items:center;gap:6px;margin-right:6px;padding:0 8px;line-height:20px;height:20px;border-radius:999px;font-size:12px;text-decoration:none;box-sizing:border-box;';
            const styleWithColor = baseStyle + 'background:' + pillBg + ';border:' + pillBorder + ';color:' + pillFg + ';';
            if (url) return '<a href="' + esc(url) + '" target="_blank" rel="noreferrer noopener" style="' + styleWithColor + '">' + prIcon + '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + safe + '</span></a>';
            return '<span style="' + styleWithColor + '">' + prIcon + '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + safe + '</span></span>';
          });
          return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
        }

        switch (dt) {
          case 'SINGLE_SELECT': {
            // Render as label-like pills. Support multiple shapes for value:
            // - val can be an id (string/number) referencing c.options
            // - val can be an object { id, name, color }
            // - val can be an array of any of the above
            // Also treat fields with names like 'label'/'labels' as multi-valued.

            // Use top-level helpers `normalizeToArray`, `parseColorToken`, and `contrastTextColor`

            function renderSinglePill(item){
              // item may be id, or option object, or value object
              let name = '';
              let color = null;
              // Expect normalized item: { id, name, color }
              if (item && typeof item === 'object'){
                if (item.optionId && !item.id) item = { id: item.optionId, name: item.name, color: item.color };
                if (item.id && !item.name && item.label) item.name = item.label;
              }
              // If options list present, try to resolve by id.
              // When `item` is an object, prefer comparing by `item.id`.
              if (Array.isArray(c.options)){
                const lookupKey = (item && typeof item === 'object') ? item.id : item;
                const found = c.options.find(o => String(o.id) === String(lookupKey));
                if (found) { name = found.name; color = found.color; }
              }
              if (!name && item && typeof item === 'object'){
                // Prefer simple string fields; if they are not strings, coerce to JSON for visibility.
                const rawName = item.name ?? item.label ?? item.title ?? item.login ?? item.id ?? null;
                if (typeof rawName === 'string') name = rawName;
                else if (rawName != null) {
                  try { name = JSON.stringify(rawName); } catch(e) { name = String(rawName); }
                } else {
                  name = String(item.id ?? '');
                }
                color = item.color || item.colour || item.hex || item.background || item.colorHex || null;
              }
              if (!name) {
                // Defensive: ensure we don't end up with [object Object]
                if (item && typeof item === 'object'){
                  try { if (DEV_LOG) console.warn('tables: pill-unexpected-shape', { field: c.name, sample: item }); } catch(e){}
                  try { name = JSON.stringify(item); } catch(e) { name = String(item); }
                } else {
                  name = String(item ?? '');
                }
              }
              const hex = parseColorToken(color);
              // Use color for border and text; use translucent background.
              const pillBg = hex ? rgba(hex, 0.14) : 'transparent';
              const pillBorder = hex ? ('1px solid ' + rgba(hex, 0.4)) : ('1px solid var(--vscode-editorWidget-border)');
              const pillFg = hex ? hex : 'var(--vscode-foreground)';
              const pillStyle = [
                'display:inline-block',
                'margin-right:6px',
                'max-width:100%',
                'white-space:nowrap',
                'overflow:hidden',
                'text-overflow:ellipsis',
                'border-radius:999px',
                'padding:0 8px',
                'line-height:20px',
                'height:20px',
                'vertical-align:middle',
                'font-size:12px',
                'box-sizing:border-box',
                'background:' + pillBg,
                'border:' + pillBorder,
                'color:' + pillFg
              ].join(';');
              return '<span title="' + esc(name) + '" style="' + pillStyle + '">' + esc(name) + '</span>';
            }

            const treatAsMulti = /label|labels/.test((c.name||'').toLowerCase()) || Array.isArray(val);
            const items = normalizeToArray(val);
            if (treatAsMulti){
              const parts = items.map(i => renderSinglePill(i));
              return '<td style="' + tdStyle + '">' + (parts.length ? parts.join('') : '&nbsp;') + '</td>';
            }
            // single-select value
            const first = items.length ? items[0] : null;
            const pillHtml = first ? renderSinglePill(first) : '&nbsp;';
            return '<td style="' + tdStyle + '">' + pillHtml + '</td>';
          }
          default:
            text = (val ?? '');
        }
        return '<td style="' + tdStyle + '">' + esc(text) + '</td>';
      });
      return '<tr>' + emptyCell + indexCell + cells.join('') + '</tr>';
    }).join('');
  }

  // Use only the fields provided by the view meta, in order.
  // Developer logging toggle: set localStorage['ghp_tables_dev'] = '1' in the webview to enable extra diagnostics
  const DEV_LOG = (function(){ try { return (localStorage && localStorage.getItem && localStorage.getItem('ghp_tables_dev') === '1'); } catch(e){ return false; } })();
  const cols = (meta && Array.isArray(meta.visibleFieldIds) ? meta.visibleFieldIds : [])
    .map(fid => meta.fieldsById && meta.fieldsById[fid])
    .filter(Boolean);

  // Build colgroup with default fixed widths to avoid wrapping and enable resizing.
  const defaultWidth = 160; // px
  // Add two left-most helper columns:
  //  - an extra empty gutter column (touches the left pane border)
  //  - a fixed index column (row numbers)
  const emptyColWidth = 12; // px gutter at extreme left
  const indexColWidth = 48; // px for row index
  const colgroup = buildColGroup(cols);

  // Non-wrapping headers with a simple resize handle; content hidden on overflow.
  const borderColor = 'var(--vscode-editorWidget-border)';
  // Header cells render normally; thead will be made sticky to keep header visible.
  const thStyle = 'position:relative; white-space:nowrap; overflow:hidden; padding:4px 8px; border:1px solid ' + borderColor + '; box-sizing:border-box;';
  const tdStyle = 'white-space:nowrap; overflow:hidden; padding:4px 8px; border:1px solid ' + borderColor + '; box-sizing:border-box;';

  const thead = buildThead(cols);

  const rows = buildRowsHtml(cols, items);

  // Render a fixed-layout table to keep header/cell alignment stable.
  // Use separate border model so the thead background can fully cover the body when sticky.
  // Use box-shadow for the outer border so it doesn't affect layout/height (prevents tiny overflows).
  container.innerHTML = '<table style="border-collapse:separate; border-spacing:0; table-layout:fixed; width:auto; border:none; box-shadow:0 0 0 1px ' + borderColor + ';">'
    + colgroup + thead + '<tbody>' + rows + '</tbody></table>';

  // Column resizing: attach minimal drag handlers to header resizer grips.
  const table = container.querySelector('table');
  if (!table) return;

  // Remove left padding/margin so the extreme-left empty gutter column touches the pane border
  // and keep the container height dynamically clamped to the available viewport.
  function updateContainerLayout(){
    try {
      // Normalize document/body margins which can add offsets inside the webview.
      if (document && document.body) document.body.style.margin = '0';
      if (document && document.documentElement) document.documentElement.style.padding = '0';
      container.style.padding = '0';
      container.style.margin = '0';
      table.style.margin = '0';
      table.style.marginLeft = '0';
      table.style.borderSpacing = '0';
      // Aim for table to fill width so the left gutter aligns with the pane edge
      table.style.width = '100%';
    } catch (e) {}

    try {
      const cRect = container.getBoundingClientRect();
      // Add a safety margin to avoid sub-pixel/rounding overflows that can
      // create a small document overflow and show the editor scrollbar.
      const avail = Math.max(0, Math.floor(window.innerHeight - (cRect.top || 0)) - 12);
      container.style.boxSizing = 'border-box';
      container.style.maxHeight = avail + 'px';
      container.style.overflow = 'auto';
    } catch (e) {}
  }

  // Initial run
  updateContainerLayout();
  // Keep layout updated when viewport/layout changes
  let _heightRaf = null;
  function scheduleUpdate(){ if (_heightRaf) return; _heightRaf = requestAnimationFrame(()=>{ _heightRaf = null; updateContainerLayout(); }); }
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('scroll', scheduleUpdate, true);
  try { window.visualViewport && window.visualViewport.addEventListener('resize', scheduleUpdate); } catch(e) {}
  try { window.visualViewport && window.visualViewport.addEventListener('scroll', scheduleUpdate); } catch(e) {}
  try { const ro = new ResizeObserver(scheduleUpdate); ro.observe(container); } catch (e) {}

  // Cloned header: render a lightweight clone (colgroup + thead) fixed to the
  // viewport and keep the original thead hidden for measurement. Sync widths
  // and position via requestAnimationFrame when layout changes.
  let clone = null;
  let rafPending = false;

  function createCloneIfNeeded(){
    if (clone) return;
    clone = document.createElement('div');
    clone.className = 'ghp-table-clone-header';
    clone.style.position = 'fixed';
    clone.style.top = '0px';
    clone.style.left = '0px';
    clone.style.overflow = 'hidden';
    clone.style.zIndex = '9999';
    clone.style.background = 'var(--vscode-editor-background)';
    clone.style.pointerEvents = 'auto';
    // append to body so fixed positioning is relative to the viewport
    (document.body || document.documentElement).appendChild(clone);
  }

  function renderClone(){
    createCloneIfNeeded();
    // clone only colgroup + thead to keep it lightweight
    clone.innerHTML = '<table style="border-collapse:separate; border-spacing:0; table-layout:fixed; width:auto; border:none; box-shadow:0 0 0 1px ' + borderColor + ';">'
      + colgroup + thead + '</table>';
  }

  function syncClone(){
    if (!clone) return;
    try {
      const origThs = table.querySelectorAll('thead th');
      if (!origThs || origThs.length === 0) return;
      const cloneTable = clone.querySelector('table');
      if (!cloneTable) return;
      const cloneCols = cloneTable.querySelectorAll('col');
      const cloneThs = cloneTable.querySelectorAll('th');
  const tableRect = table.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  // set clone table width to match original exactly (use subpixel but set as px)
  cloneTable.style.width = tableRect.width + 'px';
  // Position clone at the top of the container (fixed from the start), not the table's current top.
  // This makes the header visible and fixed from the beginning of the view.
  const top = Math.max(0, Math.floor(containerRect.top));
  // Use the table's on-screen left so the clone moves horizontally in sync with
  // the table when the user scrolls the container horizontally.
  const left = Math.floor(tableRect.left);
  clone.style.top = top + 'px';
  clone.style.left = left + 'px';
      // copy column widths from original header cells
      for (let i = 0; i < origThs.length; i++){
        const w = origThs[i].getBoundingClientRect().width;
        if (cloneCols[i] && cloneCols[i].style) cloneCols[i].style.width = w + 'px';
        if (cloneThs[i] && cloneThs[i].style) cloneThs[i].style.width = w + 'px';
      }
    } catch (e) {
      // ignore errors during sync
    }
  }

  function rafSync(){
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(()=>{ rafPending = false; syncClone(); });
  }

  // Render clone and hide original thead visually but keep it in layout for accurate measurements
  renderClone();
  const origThead = table.querySelector('thead');
  if (origThead) origThead.style.visibility = 'hidden';
  // initial sync
  rafSync();
  // wire events
  window.addEventListener('resize', rafSync);
  window.addEventListener('scroll', rafSync, true);
  // The table is usually inside a scrollable container. Listen to that
  // container's scroll event so horizontal scrolling triggers a clone sync
  // and the clone header moves horizontally with the table.
  try { container.addEventListener('scroll', rafSync, { passive: true }); } catch(e) {}
  if (typeof ResizeObserver !== 'undefined') {
    try { const ro = new ResizeObserver(rafSync); ro.observe(table); } catch (e) {}
  }

  
  const colEls = table.querySelectorAll('col');
  // th elements for drag start/measure should come from the visible clone header
  function getVisibleTh(idx){
    if (!clone) return null;
    const ths = clone.querySelectorAll('th');
    return ths[idx] || null;
  }

  let active = null; // { idx:number, startX:number, startW:number }
  let hoverIdx = -1;

  function applyColumnWidth(idx, widthPx){
    const w = Math.max(40, widthPx);
    const col = colEls[idx];
    if (col) {
      if (col.style) col.style.width = w + 'px';
    }
    // Ensure all body cells reflect the width immediately
    const rowsEls = table.tBodies[0] ? table.tBodies[0].rows : [];
    for (let i = 0; i < rowsEls.length; i++) {
      const cell = rowsEls[i].cells[idx];
      if (cell && cell.style) {
        cell.style.width = w + 'px';
        cell.style.minWidth = w + 'px';
        cell.style.maxWidth = w + 'px';
        cell.style.boxSizing = 'border-box';
      }
    }
    // Sync the clone header so the visual header follows resizes.
    try { rafSync(); } catch (e) {}
  }

  function onDragMove(e){
    if (!active) return;
    const dx = e.clientX - active.startX;
    const w = Math.max(40, active.startW + dx);
    applyColumnWidth(active.idx, w);
  }

  function onDragEnd(){
    if (!active) return;
    container.style.userSelect = '';
    window.removeEventListener('mousemove', onDragMove, true);
    window.removeEventListener('mouseup', onDragEnd, true);
    active = null;
  }

  function startDrag(idx, startX){
    // prevent resizing the two left-most columns (gutter + index)
    if (idx <= 1) return;
    // Prefer the visible clone header for measurements; fall back to the
    // original header via getVisibleTh.
    const th = getVisibleTh(idx);
    if (!th) return;
    const rect = th.getBoundingClientRect();
    active = { idx, startX, startW: rect.width };
    container.style.userSelect = 'none';
    // Use window-level listeners during drag so events continue even if the pointer leaves the container
    window.addEventListener('mousemove', onDragMove, true);
    window.addEventListener('mouseup', onDragEnd, true);
  }

  // Boundary hover detection across any table cell to show resize cursor and enable drag.
  function updateHover(e){
    if (active) return; // keep current cursor during drag from resizer
    
    let target = e.target;
    // find nearest cell
    while (target && target !== table && !(target.tagName === 'TD' || target.tagName === 'TH')) {
      target = target.parentNode;
    }
    if (!target || target === table) {
      hoverIdx = -1;
      container.style.cursor = '';
      return;
    }
    const cell = target;
    const rect = cell.getBoundingClientRect();
    const nearRight = (rect.right - e.clientX) <= 6 && (rect.right - e.clientX) >= -1; // tolerance
    if (nearRight) {
      // Don't allow resizing the two left-most columns (gutter and index)
      if (cell.cellIndex > 1) {
        hoverIdx = cell.cellIndex;
        container.style.cursor = 'col-resize';
        if (clone && clone.style) clone.style.cursor = 'col-resize';
      } else {
        hoverIdx = -1;
        container.style.cursor = '';
        if (clone && clone.style) clone.style.cursor = '';
      }
    } else {
      hoverIdx = -1;
      container.style.cursor = '';
      if (clone && clone.style) clone.style.cursor = '';
    }
  }

  function onContainerMouseDown(e){
    if (e.button !== 0) return;
    if (hoverIdx >= 0) {
      startDrag(hoverIdx, e.clientX);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  container.addEventListener('mousemove', updateHover, { passive: true });
  container.addEventListener('mousedown', onContainerMouseDown, { passive: false });
  // Also listen at document level so the fixed-position clone header (appended to
  // document.body) can participate in hover and mousedown events. This lets users
  // start column resizes from the clone header as well as the original table.
  document.addEventListener('mousemove', updateHover, { passive: true });
  document.addEventListener('mousedown', onContainerMouseDown, { passive: false });
  
  // NOTE: previously we rendered an on-screen diagnostics panel here which
  // itself could contribute (a few px) to document height and cause the
  // editor scrollbar to appear. That debug UI has been removed; layout
  // diagnostics should be performed in devtools/console if needed.
}
