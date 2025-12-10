/// <reference path="../global.d.ts" />

export function logDebug(viewKey: string, message: string, data?: any) {
  try {
    if (
      (window as any).__APP_MESSAGING__ &&
      typeof (window as any).__APP_MESSAGING__.postMessage === "function"
    ) {
      (window as any).__APP_MESSAGING__.postMessage({
        command: "debugLog",
        level: "debug",
        viewKey: viewKey,
        message: message,
        data: data,
      });
    }
  } catch (e) {}
  try {
    if (console && console.log) {
      console.log(message, data);
    }
  } catch (e) {}
}
