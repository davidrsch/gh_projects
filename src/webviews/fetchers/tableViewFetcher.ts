export const tableViewFetcher = `
function tableViewFetcher(view, container){
  // Placeholder for table view rendering/fetching logic
  container.innerHTML = '<div class="title">'+(view.name||view.id||'Table View')+'</div>'+
    '<div><em>Table view placeholder</em></div>'+
    '<div>TODO: implement tableViewFetcher to load and render table data.</div>';
}
`;