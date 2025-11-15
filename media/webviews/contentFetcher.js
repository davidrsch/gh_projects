// Static content fetcher that dispatches to other fetchers
(function(){
  window.contentFetcher = function(view, container, viewKey){
    // Send init debug message to the extension (so logs appear in Output)
    try{
      if(window.vscodeApi && typeof window.vscodeApi.postMessage === 'function'){
        window.vscodeApi.postMessage({ command: 'debugLog', level: 'debug', viewKey, message: 'contentFetcher init', data: { view } });
      } else if(typeof acquireVsCodeApi === 'function'){
        try{ acquireVsCodeApi().postMessage({ command: 'debugLog', level: 'debug', viewKey, message: 'contentFetcher init', data: { view } }); }catch(e){}
      }
    }catch(e){}
    
    // Debug: also keep a console log for devtools (optional)
    try{ console.log('contentFetcher init', { viewKey, view }); }catch(e){}
    const layoutRaw = view?.layout || view?.type || view?.viewType || '';
    const layout = String(layoutRaw).toUpperCase();
    if(layout === 'BOARD_LAYOUT' || layout === 'BOARD'){
      return window.boardViewFetcher(view, container, viewKey);
    }
    if(layout === 'ROADMAP_LAYOUT' || layout === 'ROADMAP'){
      return window.roadmapViewFetcher(view, container, viewKey);
    }
    if(layout === 'TABLE_LAYOUT' || layout === 'TABLE'){
      return window.tableViewFetcher(view, container, viewKey);
    }
    if(layout === 'OVERVIEW' || layout === 'OVERVIEW_LAYOUT'){
      return window.overviewFetcher(container, viewKey);
    }
    return window.tableViewFetcher(view, container, viewKey);
  };
})();
