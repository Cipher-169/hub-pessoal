function showImportPreview(preview,backup){
  const dialog=$("import-preview-dialog");
  const labels={animeCatalog:"Catálogo de animes",animeNotes:"Anotações e avaliações",episodeLogs:"Diário de episódios",songScores:"Notas das músicas"};
  const status={add:{label:"Será adicionado",className:"add"},ignore:{label:"Já existe · ignorado",className:""},attention:{label:"Conflito · preservado",className:"attention"}};
  const total=preview.summary;
  const groups=Object.keys(labels).map(name=>{
    const items=preview.items.filter(item=>item.section===name);
    const added=items.filter(item=>item.action==="add").length;
    const ignored=items.filter(item=>item.action==="ignore").length;
    const attention=items.filter(item=>item.action==="attention").length;
    const visibleItems=items.slice(0,60);
    const rows=items.length?visibleItems.map(item=>{
      const st=status[item.action];
      const extra=item.action==="attention"?`<small>Diferenças: ${esc(item.differences.join(", "))}</small>`:"";
      return `<div class="import-preview-item"><div><strong>${esc(item.label)}</strong>${extra}</div><span class="import-preview-tag ${st.className}">${st.label}</span></div>`;
    }).join("")+(items.length>visibleItems.length?`<div class="import-preview-empty">Mais ${items.length-visibleItems.length} registros nesta seção; todos foram considerados nos totais.</div>`:""):'<div class="import-preview-empty">Nenhum registro nesta seção.</div>';
    return `<details ${items.length&&items.some(item=>item.action==="attention")?"open":""}><summary><span>${labels[name]}</span><span class="import-preview-group-count">${added} novos · ${ignored} iguais · ${attention} conflitos</span></summary><div class="import-preview-items">${rows}</div></details>`;
  }).join("");
  const sourceUid=backup.user?.uid||"não informado";
  dialog.innerHTML=`<div class="import-preview"><div class="import-preview-head"><div><h2 id="import-preview-title">Prévia da importação</h2><p>Backup de ${esc(backup.exportedAt||"data não informada")} · origem: ${esc(sourceUid)}</p></div><button type="button" class="import-preview-close" data-import-cancel aria-label="Fechar prévia">Fechar</button></div><div class="import-preview-summary"><div class="import-preview-stat add"><strong>${total.add}</strong><span>Novos registros</span></div><div class="import-preview-stat"><strong>${total.ignore}</strong><span>Registros iguais</span></div><div class="import-preview-stat attention"><strong>${total.attention}</strong><span>Precisam de atenção</span></div></div><p class="import-preview-note">Importação segura: somente registros que ainda não existem serão adicionados. Registros existentes nunca serão sobrescritos. Conflitos e registros iguais serão ignorados, preservando integralmente os dados atuais do Hub.</p><div class="import-preview-groups">${groups}</div><div class="import-preview-actions"><button type="button" data-import-cancel>Cancelar</button><button type="button" class="primary" data-import-confirm ${total.add===0?"disabled":""}>Adicionar ${total.add} ${total.add===1?"registro novo":"registros novos"}</button></div></div>`;
  return new Promise(resolve=>{
    let settled=false;
    const onCancel=event=>{event.preventDefault();finish(false)};
    const finish=value=>{
      if(settled)return;settled=true;
      dialog.removeEventListener("cancel",onCancel);
      if(dialog.open)dialog.close();
      dialog.innerHTML="";
      resolve(value);
    };
    dialog.querySelectorAll("[data-import-cancel]").forEach(button=>button.addEventListener("click",()=>finish(false)));
    dialog.querySelector("[data-import-confirm]").addEventListener("click",()=>finish(true));
    dialog.addEventListener("cancel",onCancel);
    dialog.showModal();
  });
}
$("import-file").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const button=$("import-data");button.disabled=true;button.textContent="Analisando backup…";
  try{
    if(file.size>25*1024*1024)throw new Error("O arquivo ultrapassa o limite de 25 MB.");
    const backup=JSON.parse(await file.text());
    hubFB.validateBackup(backup);
    const preview=await hubFB.previewImport(backup);
    if(!await showImportPreview(preview,backup))return;
    button.textContent="Importando registros novos…";
    const result=await hubFB.importData(backup,preview);
    const summary=`${result.added} adicionados · ${result.skipped} preservados · ${result.failed} falhas`;
    $("sync-status").textContent=`Importação finalizada: ${summary}.`;
    const details=Object.entries(result.counts).map(([name,count])=>`${({animeCatalog:"Catálogo",animeNotes:"Anotações",episodeLogs:"Diário",songScores:"Músicas"})[name]}: ${count.added} adicionados, ${count.ignored+count.attention+count.skipped} preservados (${count.ignored} iguais, ${count.attention} conflitos), ${count.failed} falhas`).join("\n");
    alert(`${result.failed?"Importação parcialmente concluída.":"Importação concluída com sucesso!"}\n\n${details}${result.failed?"\n\nAlguns registros falharam. Consulte o console para detalhes.":""}\n\nOs registros existentes foram preservados.`);
  }catch(err){
    alert("Não foi possível importar o backup: "+(err.code||err.message));
    $("sync-status").textContent="A importação não foi concluída. Os registros existentes não foram sobrescritos.";
  }finally{button.disabled=false;button.textContent="Importar backup (JSON)";e.target.value=""}
});
