export const messaging = `
function onMessage(e){
    const event = e && e.data ? e.data : e;
    if(event && event.command === 'fields'){
      if(event.error){
        container.innerHTML = '<div class="title">'+(view.name||view.id||'Table View')+'</div>'+
          '<div style="color:var(--vscode-editor-foreground)">'+String(event.error)+'</div>';
      } else {
        render(event.payload || event.payload?.data || event.payload);
      }
    }
  }

  function requestFields(){
    if(typeof vscodeApi === 'object' && vscodeApi && typeof vscodeApi.postMessage === 'function'){
      vscodeApi.postMessage({ command: 'requestFields', first: currentFirst });
    }
  }

  window.addEventListener('message', onMessage);
  requestFields();
}
`;
