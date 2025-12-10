/**
 * Icon Helper - Exposes icon registry functions to the browser window
 * This allows inline scripts and other client-side code to access the icon registry
 */

import { getIconSvg, createIconElement, getIconNameForDataType, IconName, IconOptions } from "./icons/iconRegistry";

// Expose icon registry functions to window object
declare global {
  interface Window {
    getIconSvg: typeof getIconSvg;
    createIconElement: typeof createIconElement;
    getIconNameForDataType: typeof getIconNameForDataType;
  }
}

window.getIconSvg = getIconSvg;
window.createIconElement = createIconElement;
window.getIconNameForDataType = getIconNameForDataType;

// Export for TypeScript modules
export { getIconSvg, createIconElement, getIconNameForDataType, IconName, IconOptions };
