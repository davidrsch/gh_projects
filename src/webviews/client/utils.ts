export function escapeHtml(s: any): string {
  return s
    ? String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    : "";
}

export function normalizeColor(color: any): string | null {
  if (!color) return null;
  let n = String(color).trim();
  if (
    /^#?[0-9a-f]{3}$/i.test(n) ||
    /^#?[0-9a-f]{6}$/i.test(n) ||
    /^#?[0-9a-f]{8}$/i.test(n)
  ) {
    let b = n[0] === "#" ? n.slice(1) : n;
    return "#" + (b.length === 8 ? b.substring(0, 6) : b);
  }
  let s = {
    GRAY: "#848d97",
    RED: "#f85149",
    ORANGE: "#db6d28",
    YELLOW: "#d29922",
    GREEN: "#3fb950",
    BLUE: "#2f81f7",
    PURPLE: "#a371f7",
    PINK: "#db61a2",
    BLACK: "#000000",
    WHITE: "#ffffff",
  };
  let u = n.toUpperCase();
  return (s as any)[u] || null;
}

export function addAlpha(color: any, alpha: any): string | null {
  if (!color) return null;
  let s = color.replace("#", "");
  let u = (b: any) => parseInt(b, 16);
  if (s.length === 3) {
    let b = u(s[0] + s[0]),
      S = u(s[1] + s[1]),
      v = u(s[2] + s[2]);
    return "rgba(" + b + "," + S + "," + v + "," + alpha + ")";
  }
  if (s.length === 6 || s.length === 8) {
    let b = s.length === 8 ? s.substring(0, 6) : s,
      S = u(s.substring(0, 2)),
      v = u(b.substring(2, 4)),
      C = u(b.substring(4, 6));
    return "rgba(" + S + "," + v + "," + C + "," + alpha + ")";
  }
  return null;
}

export function getContrastColor(color: any): string {
  if (!color) return "#333333";
  let n = color.replace("#", "");
  let s = (C: any) => parseInt(C, 16);
  let u, b, S;
  if (n.length === 3)
    ((u = s(n[0] + n[0])), (b = s(n[1] + n[1])), (S = s(n[2] + n[2])));
  else if (n.length === 6 || n.length === 8) {
    let C = n.length === 8 ? n.substring(0, 6) : n;
    ((u = s(C.substring(0, 2))),
      (b = s(C.substring(2, 4))),
      (S = s(C.substring(4, 6))));
  } else return "#333333";
  return 0.2126 * (u / 255) + 0.7152 * (b / 255) + 0.0722 * (S / 255) > 0.6
    ? "#111111"
    : "#ffffff";
}
