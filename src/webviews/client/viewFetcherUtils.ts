/// <reference path="./global.d.ts" />
import { logDebug } from "./utils/logger";
import { setLoadingState, setErrorState, createLoadMoreButton } from "./utils/domUtils";

export { logDebug, setLoadingState, setErrorState, createLoadMoreButton };

/**
 * Initializes the filter bar using the shared filterBarHelper.
 * Returns the barApi if successful, or null.
 */
export function initFilterBar(
    container: HTMLElement,
    viewKey: string,
    options: {
        suffix?: string;
        step?: number;
        effFilter?: string;
        onLoadMore?: () => void;
        onSave?: (filter: any) => void;
        onDiscard?: () => void;
    }
): any {
    if (
        window.filterBarHelper &&
        typeof window.filterBarHelper.create === "function"
    ) {
        try {
            return window.filterBarHelper.create({
                parent: container,
                suffix: options.suffix || viewKey,
                effFilter: typeof options.effFilter === 'string' ? options.effFilter : undefined,
                viewKey: viewKey,
                step: options.step || 50,
                onLoadMore: options.onLoadMore,
                onSave: options.onSave,
                onDiscard: options.onDiscard,
            });
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Toggles visibility of elements based on matched IDs from the filter.
 */
export function applyFilterVisibility(
    root: HTMLElement | Document,
    selector: string,
    matchedIds: Set<string>,
    displayStyle: string = "block"
) {
    try {
        const elements = Array.from(root.querySelectorAll(selector));
        for (let i = 0; i < elements.length; i++) {
            try {
                const el = elements[i] as HTMLElement;
                const id = el.getAttribute("data-gh-item-id");
                el.style.display = matchedIds.has(String(id)) ? displayStyle : "none";
            } catch (e) { }
        }
    } catch (e) { }
}
