export const contentFetcher = `
function contentFetcher(view, container){
  // NOTE: Prefer the GraphQL ProjectV2View#layout field for reliable view type.
  // ProjectV2View.layout values: BOARD_LAYOUT, ROADMAP_LAYOUT, TABLE_LAYOUT.
  // Use layout when present, otherwise fall back to explicit
  // view.type or view.viewType if those are provided by your data source.
  // TODO: Replace this heuristic with a robust detection based on your
  // fetched GraphQL schema/fields for ProjectV2 views.

  const layoutRaw = view?.layout || view?.type || view?.viewType || '';
  const layout = String(layoutRaw).toUpperCase();

  if(layout === 'BOARD_LAYOUT' || layout === 'BOARD'){
    return boardViewFetcher(view, container);
  }
  if(layout === 'ROADMAP_LAYOUT' || layout === 'ROADMAP'){
    return roadmapViewFetcher(view, container);
  }
  if(layout === 'TABLE_LAYOUT' || layout === 'TABLE'){
    return tableViewFetcher(view, container);
  }

  // Special-case overview (not a ProjectV2 view layout) - render overview
  if(layout === 'OVERVIEW' || layout === 'OVERVIEW_LAYOUT'){
    return overviewFetcher(container);
  }

  // Default: table view placeholder
  return tableViewFetcher(view, container);
}
`;