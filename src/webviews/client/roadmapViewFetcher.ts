import { logDebug, setLoadingState } from "./viewFetcherUtils";
/// <reference path="./global.d.ts" />

(function () {
  try {
    logDebug("global", "roadmapViewFetcher.loaded");
  } catch (e) { }

  window.roadmapViewFetcher = function (
    view: any,
    container: HTMLElement,
    viewKey: string
  ) {
    setLoadingState(container, "Roadmap View");

    // Simple placeholder for now
    setTimeout(() => {
      container.innerHTML = '<div class="title">Roadmap View</div><div style="padding:10px">Roadmap content not implemented yet.</div>';
    }, 100);
  };
})();
