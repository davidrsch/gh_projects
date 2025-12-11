/**
 * Icon Helper - Exposes icon registry functions to the browser window
 * This allows inline scripts and other client-side code to access the icon registry
 */

import {
  getIconSvg,
  createIconElement,
  getIconNameForDataType,
  IconName,
  IconOptions,
} from "./icons/iconRegistry";

// Type-safe interface for window extensions
export interface IconWindowExtensions {
  getIconSvg: typeof getIconSvg;
  createIconElement: typeof createIconElement;
  getIconNameForDataType: typeof getIconNameForDataType;
}

// Extend Window interface with icon functions
declare global {
  interface Window extends IconWindowExtensions {}
}

// Expose icon registry functions to window object
window.getIconSvg = getIconSvg;
window.createIconElement = createIconElement;
window.getIconNameForDataType = getIconNameForDataType;

// Export for TypeScript modules
export {
  getIconSvg,
  createIconElement,
  getIconNameForDataType,
  IconName,
  IconOptions,
};

/**
 * Helper function to safely access icon functions from window.
 * This centralizes undefined checks and preserves type safety.
 */
export function getWindowIconFunctions(): IconWindowExtensions | null {
  if (
    typeof window.getIconSvg === "function" &&
    typeof window.getIconNameForDataType === "function"
  ) {
    return {
      getIconSvg: window.getIconSvg,
      createIconElement: window.createIconElement,
      getIconNameForDataType: window.getIconNameForDataType,
    };
  }
  return null;
}
