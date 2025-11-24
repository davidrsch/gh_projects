/// <reference path="./global.d.ts" />

/**
 * Sends a debug log message to the extension host.
 */
export function logDebug(viewKey: string, message: string, data?: any) {
    try {
        if (
            window.vscodeApi &&
            typeof window.vscodeApi.postMessage === "function"
        ) {
            window.vscodeApi.postMessage({
                command: "debugLog",
                level: "debug",
                viewKey: viewKey,
                message: message,
                data: data,
            });
        }
    } catch (e) { }
    try {
        if (console && console.log) {
            console.log(message, data);
        }
    } catch (e) { }
}

/**
 * Sets the container content to a loading state.
 */
export function setLoadingState(container: HTMLElement, titleText: string) {
    container.innerHTML =
        '<div class="title">' +
        titleText +
        '</div><div class="loading"><em>Loading...</em></div>';
}

/**
 * Sets the container content to an error state.
 */
export function setErrorState(container: HTMLElement, titleText: string, error: string) {
    container.innerHTML =
        '<div class="title">' +
        titleText +
        '</div><div style="color:var(--vscode-editor-foreground)">' +
        error +
        "</div>";
}

/**
 * Creates a standardized "Load more" button.
 */
export function createLoadMoreButton(onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Load more";
    btn.style.marginLeft = "8px";
    btn.style.border = "1px solid var(--vscode-editorWidget-border)";
    btn.addEventListener("click", () => {
        onClick();
        btn.disabled = true;
        btn.textContent = "Loading...";
    });
    return btn;
}

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
        onLoadMore?: () => void;
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
                effFilter: undefined,
                viewKey: viewKey,
                step: options.step || 50,
                onLoadMore: options.onLoadMore,
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
