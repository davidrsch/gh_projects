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
        message: "contentFetcher.loaded",
      });
    }
  } catch (e) { }

  window.contentFetcher = function (
    view: any,
    container: HTMLElement,
    viewKey: string
  ) {
    // Content fetcher logic here
    container.innerHTML = '<div style="padding:10px">Content details...</div>';

    // Log initialization
    try {
      console.log("contentFetcher init", { viewKey, view });
    } catch { }
  };
})();
