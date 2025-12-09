export function setLoadingState(container: HTMLElement, titleText: string) {
    container.innerHTML =
        '<div class="title">' +
        titleText +
        '</div><div class="loading"><em>Loading...</em></div>';
}

export function setErrorState(container: HTMLElement, titleText: string, error: string) {
    container.innerHTML =
        '<div class="title">' +
        titleText +
        '</div><div style="color:var(--vscode-editor-foreground)">' +
        error +
        "</div>";
}

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

export function clearElement(element: HTMLElement) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

export function toggleClass(element: HTMLElement, className: string, force?: boolean) {
    element.classList.toggle(className, force);
}
