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
        message: "roadmapViewFetcher.loaded",
      });
    }
  } catch (e) { }

  window.roadmapViewFetcher = function (
    view: any,
    container: HTMLElement,
    viewKey: string
  ) {
    container.innerHTML =
      '<div class="title">Roadmap View</div><div class="loading"><em>Loading roadmap...</em></div>';

    // Simple placeholder for now
    setTimeout(() => {
      container.innerHTML = '<div class="title">Roadmap View</div><div style="padding:10px">Roadmap content not implemented yet.</div>';
    }, 100);
  };
})();
