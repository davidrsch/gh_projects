export const helpers = `
function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function escapeAttr(s){ return escapeHtml(s); }

function normalizeOptionColor(col){
	if(!col) return null;
	const s = String(col).trim();
	// Accept hex-like values (3, 6 or 8 hex digits), with or without '#'
	if(/^#?[0-9a-f]{3}$/i.test(s) || /^#?[0-9a-f]{6}$/i.test(s) || /^#?[0-9a-f]{8}$/i.test(s)){
		const raw = s[0] === '#' ? s.slice(1) : s;
		// If 8 chars (possible alpha included), take the first 6 for RGB
		const rgb = raw.length === 8 ? raw.substring(0, 6) : raw;
		return '#'+rgb;
	}
	// Map GitHub enum color names to hex codes so single-select enums can be shown
	const map = {
        'GRAY':'#848d97',
		'RED':'#f85149',
		'ORANGE':'#db6d28',
		'YELLOW':'#d29922',
		'GREEN':'#3fb950',
		'BLUE':'#2f81f7',
		'PURPLE':'#a371f7',
		'PINK':'#db61a2',
		'BLACK':'#000000',
		'WHITE':'#ffffff'
	};
	const up = s.toUpperCase();
	return map[up] || null;
}

// Note: Color mapping removed — colors are provided in options.

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
		// if 8, the last two could be alpha; ignore and use first 6
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
	if(h.length===3){
		r = parse(h[0]+h[0],16); g = parse(h[1]+h[1],16); b = parse(h[2]+h[2],16);
	} else if(h.length===6 || h.length===8){
		const hh = h.length===8 ? h.substring(0,6) : h;
		r = parse(hh.substring(0,2),16); g = parse(hh.substring(2,4),16); b = parse(hh.substring(4,6),16);
	} else return '#333333';
	// Perceived luminance
	const lum = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
	return lum > 0.6 ? '#111111' : '#ffffff';
}

`;
