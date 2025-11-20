// Runtime patch to convert lingering parent_issue anchor links into
// the pill-with-icon markup so already-open webviews show the updated UI
// without requiring a full window reload.
(function () {
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function convertAnchors() {
    try {
      const anchors = Array.from(document.querySelectorAll("a")).filter((a) =>
        Boolean(
          a &&
            a.closest &&
            (a.closest("td") || a.closest("table") || a.closest("#tab-panels"))
        )
      );
      anchors.forEach((a) => {
        try {
          // Skip anchors that already include an SVG (likely title or pill already)
          if (a.querySelector && a.querySelector("svg")) return;
          const txt = (a.textContent || "").trim();
          // target anchors that look like issue links: start with '#' followed by digits
          const m = txt.match(/^#\s*(\d+)\b\s*(.*)$/);
          if (!m) return;
          const num = m[1];
          const title = (m[2] || "").trim();
          const href = a.getAttribute("href") || "";

          const pillInner =
            '<span style="display:block;width:100%;box-sizing:border-box">' +
            '<div style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid #999;border-radius:999px;color:#333;background:rgba(0,0,0,0.06);font-size:12px;line-height:18px;overflow:hidden;box-sizing:border-box;width:100%">' +
            '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;color:#666"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>' +
            '<span style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block">' +
            escHtml(title) +
            "</span>" +
            (num
              ? '<span style="flex:none;margin-left:6px;color:var(--vscode-descriptionForeground);white-space:nowrap">#' +
                escHtml(num) +
                "</span>"
              : "") +
            "</div></span>";

          const wrapper = document.createElement("span");
          wrapper.setAttribute("data-gh-open", href);
          wrapper.setAttribute("style", "display:inline-block;cursor:pointer");
          wrapper.innerHTML = pillInner;
          a.replaceWith(wrapper);
        } catch (e) {
          /* ignore per-item errors */
        }
      });
    } catch (e) {
      /* ignore overall errors */
    }
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(convertAnchors, 50);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(convertAnchors, 50)
    );
  }
})();
