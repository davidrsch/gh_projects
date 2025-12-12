export interface AddItemMenuOptions {
  anchorElement: HTMLElement;
  onCreateIssue: () => void;
  onAddFromRepo: () => void;
}

export class AddItemMenu {
  private options: AddItemMenuOptions;
  private menuElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;

  constructor(options: AddItemMenuOptions) {
    this.options = options;
  }

  public show() {
    this.hide();

    this.backdropElement = document.createElement("div");
    this.backdropElement.style.position = "fixed";
    this.backdropElement.style.top = "0";
    this.backdropElement.style.left = "0";
    this.backdropElement.style.right = "0";
    this.backdropElement.style.bottom = "0";
    this.backdropElement.style.zIndex = "998";
    this.backdropElement.addEventListener("click", () => this.hide());
    document.body.appendChild(this.backdropElement);

    this.menuElement = document.createElement("div");
    this.menuElement.className = "add-item-menu";
    this.menuElement.style.position = "absolute";
    this.menuElement.style.background = "var(--vscode-menu-background)";
    this.menuElement.style.border = "1px solid var(--vscode-menu-border)";
    this.menuElement.style.borderRadius = "4px";
    this.menuElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    this.menuElement.style.minWidth = "220px";
    this.menuElement.style.padding = "4px 0";
    this.menuElement.style.zIndex = "1000";
    this.menuElement.style.fontSize = "13px";

    document.body.appendChild(this.menuElement);
    this.buildMenu();

    const rect = this.options.anchorElement.getBoundingClientRect();
    const menuRect = this.menuElement.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    let top = rect.bottom + margin;
    if (rect.bottom + menuRect.height + margin > vh) {
      if (rect.top - menuRect.height - margin >= 0) {
        top = rect.top - menuRect.height - margin;
      } else {
        top = Math.max(
          margin,
          Math.min(vh - menuRect.height - margin, rect.bottom + margin),
        );
      }
    }

    let left = rect.left;
    if (rect.left + menuRect.width + margin > vw) {
      left = Math.max(margin, rect.right - menuRect.width);
    }
    left = Math.max(margin, Math.min(left, vw - menuRect.width - margin));

    this.menuElement.style.top = `${Math.round(top)}px`;
    this.menuElement.style.left = `${Math.round(left)}px`;
  }

  public hide() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
  }

  private buildMenu() {
    if (!this.menuElement) return;

    const mkItem = (
      iconName: string,
      label: string,
      description: string,
      onClick: () => void,
    ) => {
      const row = document.createElement("div");
      row.className = "add-item-menu-item";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "6px 12px";
      row.style.cursor = "pointer";
      row.style.color = "var(--vscode-menu-foreground)";

      const iconSpan = document.createElement("span");
      iconSpan.style.display = "inline-flex";
      iconSpan.style.alignItems = "center";
      iconSpan.style.justifyContent = "center";
      iconSpan.style.marginRight = "8px";
      iconSpan.innerHTML =
        (window as any).getIconSvg?.(iconName as any) || "";
      row.appendChild(iconSpan);

      const textContainer = document.createElement("div");
      textContainer.style.display = "flex";
      textContainer.style.flexDirection = "column";
      textContainer.style.flex = "1";

      const titleEl = document.createElement("div");
      titleEl.textContent = label;
      titleEl.style.fontWeight = "500";
      textContainer.appendChild(titleEl);

      if (description) {
        const descEl = document.createElement("div");
        descEl.textContent = description;
        descEl.style.fontSize = "11px";
        descEl.style.color = "var(--vscode-descriptionForeground)";
        textContainer.appendChild(descEl);
      }

      row.appendChild(textContainer);

      row.addEventListener("mouseenter", () => {
        row.style.background = "var(--vscode-menu-selectionBackground)";
        row.style.color = "var(--vscode-menu-selectionForeground)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "transparent";
        row.style.color = "var(--vscode-menu-foreground)";
      });

      row.addEventListener("click", () => {
        onClick();
        this.hide();
      });

      this.menuElement!.appendChild(row);
    };

    mkItem(
      "issue-opened",
      "Create new issue",
      "Create a project issue in a repository.",
      this.options.onCreateIssue,
    );

    mkItem(
      "repo",
      "Add item from repository",
      "Attach an existing issue or pull request from a repo.",
      this.options.onAddFromRepo,
    );
  }
}
