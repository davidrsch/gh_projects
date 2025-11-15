// Static webview fetcher moved from server-side strings.
(function(){
  // Overview fetcher accepts a viewKey for consistency with other fetchers
  window.overviewFetcher = function(container, viewKey){
    const project = window.__project_data__ || window.project || {};
    const reposHtml = (project.repos && project.repos.length)
      ? project.repos.map(r => '<div class="repo-item" data-path="'+(r.path||'')+'">'+
        ((r.owner?r.owner+'/':'') + (r.name||r.path||'')) + '</div>').join('')
      : '<div>(no repos)</div>';
    container.innerHTML = '<div class="title">'+(project.title||'')+'</div>'+
      '<div>'+(project.description||'')+'</div>'+
      '<h4>Repositories</h4><div class="repo-list">'+reposHtml+'</div>';
  };
})();
