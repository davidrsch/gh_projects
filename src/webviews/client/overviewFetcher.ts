/// <reference path="./global.d.ts" />

(function () {
  try {
    if (
      window &&
      window.vscodeApi &&
      typeof window.vscodeApi.postMessage === "function"
    ) {
      window.vscodeApi.postMessage({
        command: "debugLog",
        level: "debug",
        message: "overviewFetcher.loaded",
      });
    }
  } catch (e) { }

  window.overviewFetcher = function (
    container: HTMLElement,
    viewKey: string
  ) {
    container.innerHTML =
      '<div class="title">Overview</div><div class="loading"><em>Loading overview...</em></div>';

    // Simple placeholder for now
    setTimeout(() => {
      container.innerHTML = '<div class="title">Overview</div><div style="padding:10px">Overview content not implemented yet.</div>';
    }, 100);
  };
})();
