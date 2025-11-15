export const part1 = `
function tableViewFetcher(view, container){
  container.innerHTML = '<div class="title">'+(view.name||view.id||'Table View')+'</div>'+
    '<div class="loading"><em>Loading table…</em></div>';

  let currentFirst = 30;

`;
