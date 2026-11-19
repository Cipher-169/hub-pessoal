function formatSyncTime(value){
  if(!value)return "Ainda não sincronizado";
  const date=value instanceof Date?value:new Date(value);
  return Number.isNaN(date.getTime())?"Última sincronização desconhecida":`Última sincronização: ${date.toLocaleString("pt-BR")}`;
}
async function performAniListSync(user){
  $("sync-status").textContent="Sincronizando com o AniList…";
  const fresh=await fetchList(user);
  await hubFB.saveAniListCache(user,fresh);
  renderCatalog(fresh,user,"Catálogo atualizado e armazenado neste dispositivo");
  const now=new Date();$("sync-status").textContent=`${formatSyncTime(now)} · ${fresh.length} animes`;
  return fresh;
}
async function load({sync=false}={}){
  const user=OWNER_ANILIST_USERNAME;if(loadingCatalog)return;
  loadingCatalog=true;
  const button=$("load");button.disabled=true;
  try{
    if(!sync){
      const cached=await hubFB.getAniListCache(user).catch(()=>null);
      if(cached?.items?.length){
        renderCatalog(cached.items,user,"Catálogo carregado do cache local");
        const last=Number(cached.savedAt)||0,stale=!last||(Date.now()-last)>=SYNC_INTERVAL_MS;
        $("sync-status").textContent=`${formatSyncTime(last||null)} · ${cached.items.length} animes${stale?" · atualização necessária":" · cache válido por até 24h"}`;
        if(!stale)return;
      }
    }
    await performAniListSync(user);
  }catch(e){
    if(animes.length){$("sub").textContent=`Não foi possível sincronizar com o AniList. Exibindo os ${animes.length} animes já carregados. (${e.message})`;$("sync-status").textContent="Catálogo local preservado; sincronização indisponível.";}
    else{$("sub").textContent="";$("view").innerHTML=`<div class="msg err">Não consegui carregar "${esc(user)}": ${esc(e.message)}. Confira se o perfil é público.</div>`;}
  }finally{loadingCatalog=false;button.disabled=false;}
}
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;
  document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));if(animes.length||tab==="stats"||tab==="ranking")render()}));
["search-query", "type", "year", "season", "limit"].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("input", () => animes.length && render());
  if (el.tagName === "SELECT") el.addEventListener("change", () => animes.length && render());
});
function updateMe(){
  $("me").innerHTML=fbUser?`Logado como ${esc(fbUser.name)} · UID: <code>${esc(fbUser.uid)}</code> <button class="cp" data-copy="${esc(fbUser.uid)}">Copiar UID</button>`:"";
  $("login").textContent=fbUser?"Sair":"Entrar com Google";
  $("export-data").classList.toggle("hidden",!fbUser);
  $("import-data").classList.toggle("hidden",!fbUser);
  // Estatísticas e Ranking musical são públicos; somente os controles de edição
  // continuam condicionados à autenticação do proprietário.
  if(!fbUser)$("sync-status").textContent="Catálogo público via AniList; entre com a conta proprietária para editar seus dados.";
}
function setAniListFeedback(message="",kind=""){
  const el=$("anilist-feedback");if(!el)return;el.textContent=message;el.classList.toggle("error",kind==="error");
}
function updateAniListConnectionUI(){
  const status=$("anilist-connection-status"),meta=$("anilist-connection-meta"),connect=$("anilist-connect"),disconnect=$("anilist-disconnect"),retry=$("anilist-retry");
  if(!status||!connect||!disconnect||!retry)return;
  const state=anilistStatus.kind;
  status.textContent=({
    checking:"Verificando conexão com AniList…",
    unauthenticated:"Entre com a conta Google proprietária para verificar ou conectar o AniList.",
    disconnected:"Nenhuma conta AniList conectada.",
    connected:`Conectado como ${anilistStatus.accountName||"conta AniList"}.`,
    expired:`A conexão de ${anilistStatus.accountName||"sua conta AniList"} está expirada. Reconecte para voltar a utilizá-la.`,
    error:"Não foi possível verificar a conexão com AniList."
  })[state]||"Estado da conexão indisponível.";
  const expiry=anilistStatus.expiresAt;
  meta.textContent=state==="connected"||state==="expired"?(expiry!==null&&expiry!==undefined?`Expiração informada pelo Worker: ${String(expiry)}`:""):"";
  connect.textContent=state==="expired"?"Reconectar AniList":"Conectar AniList";
  connect.classList.toggle("hidden",state==="connected");
  connect.disabled=!fbUser||anilistBusy||state==="checking";
  disconnect.classList.toggle("hidden",!fbUser||!(state==="connected"||state==="expired"));
  disconnect.disabled=!fbUser||anilistBusy;
  retry.classList.toggle("hidden",!fbUser||state!=="error");
  retry.disabled=!fbUser||anilistBusy;
}
function callbackFeedback(code){
  const messages={
    connected:"O AniList retornou ao Hub. Verificando a conexão diretamente no Worker…",
    denied:"A autorização do AniList foi cancelada ou negada.",
    invalid_callback:"O Worker informou que o retorno OAuth é inválido.",
    invalid_state:"O Worker rejeitou o estado OAuth. Tente iniciar a conexão novamente.",
    token_error:"O Worker não conseguiu concluir a troca do código OAuth por um token.",
    verification_error:"O Worker não conseguiu verificar a conta AniList autorizada.",
    configuration_error:"O Worker informou um problema de configuração na integração OAuth."
  };
  return messages[code]||"O AniList retornou uma resposta de autenticação.";
}
function removeAniListCallbackParams(){
  const url=new URL(location.href);url.searchParams.delete("anilist");url.searchParams.delete("account");
  history.replaceState(history.state,"",url);
}
async function refreshAniListStatus({silent=false}={}){
  if(!fbUser||!window.hubFB?.getAniListStatus){
    anilistStatus={kind:"unauthenticated"};updateAniListConnectionUI();return null;
  }
  const uid=fbUser.uid;anilistStatus={kind:"checking"};updateAniListConnectionUI();
  if(!silent)setAniListFeedback("Consultando o estado da conexão…");
  try{
    const result=await window.hubFB.getAniListStatus();
    if(fbUser?.uid!==uid)return null;
    if(!result||typeof result.connected!=="boolean")throw new Error("Resposta de status inválida.");
    if(result.connected){
      anilistStatus={kind:result.expired?"expired":"connected",accountName:typeof result.accountName==="string"?result.accountName:"",savedAt:result.savedAt||null,expiresAt:result.expiresAt||null};
    }else anilistStatus={kind:"disconnected"};
    updateAniListConnectionUI();
    if(!silent)setAniListFeedback(anilistStatus.kind==="connected"?"Conexão verificada com sucesso.":anilistStatus.kind==="expired"?"A conexão existe, mas o token expirou.":"Nenhuma conta AniList está conectada.");
    return anilistStatus;
  }catch(err){
    if(fbUser?.uid!==uid)return null;
    console.warn("Falha ao consultar o estado OAuth do AniList",err);
    anilistStatus={kind:"error"};updateAniListConnectionUI();
    if(!silent)setAniListFeedback("Não foi possível consultar o Worker. Verifique sua conexão e tente novamente.","error");
    return anilistStatus;
  }
}
async function handleAniListCallback(){
  if(!anilistCallback||anilistCallbackHandled)return;
  anilistCallbackHandled=true;
  setAniListFeedback(callbackFeedback(anilistCallback.code),anilistCallback.code==="connected"?"":"error");
  removeAniListCallbackParams();
  if(!fbUser){
    anilistStatus={kind:"unauthenticated"};updateAniListConnectionUI();
    setAniListFeedback("Retorno do AniList recebido, mas não foi possível verificar a conexão. Entre com a conta Google proprietária e tente verificar novamente.","error");
    return;
  }
  const checked=await refreshAniListStatus({silent:true});
  if(anilistCallback.code==="connected"){
    if(checked?.kind==="connected")setAniListFeedback(`Conexão confirmada pelo Worker${checked.accountName?` para ${checked.accountName}`:""}.`);
    else setAniListFeedback("O retorno informou sucesso, mas o Worker não confirmou uma conexão ativa. Use Verificar novamente ou tente conectar outra vez.","error");
  }
}
window.addEventListener("fb-user",async e=>{
  fbUser=e.detail;updateMe();load({sync:false});
  if(fbUser){
    if(anilistCallback&&!anilistCallbackHandled)await handleAniListCallback();
    else await refreshAniListStatus({silent:true});
  }else{
    anilistStatus={kind:"unauthenticated"};updateAniListConnectionUI();
    if(anilistCallback&&!anilistCallbackHandled)await handleAniListCallback();
  }
});
window.addEventListener("fb-error",e=>{fbErr=e.detail;if(animes.length&&tab==="hall")render()});
window.addEventListener("fb-scores",e=>{
  Object.keys(SONG_SCORES).forEach(k=>delete SONG_SCORES[k]);Object.assign(SONG_SCORES,e.detail);
  if(animes.length&&tab==="hall")render();
});
document.addEventListener("submit",async e=>{
  const form=e.target.closest("[data-edit-form]");if(!form)return;e.preventDefault();
  const data=new FormData(form),episode=Number(data.get("episode")),watchedAt=String(data.get("watchedAt")||""),comment=String(data.get("comment")||"").trim();
  const dateForgotten=data.get("dateForgotten")==="on";if(!Number.isInteger(episode)||episode<0||(!dateForgotten&&!watchedAt)||!comment)return;
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  try{await hubFB.updateLog(form.dataset.editForm,{episode,watchedAt:dateForgotten?"":watchedAt,comment});await loadDiary(activeDiaryAnime)}
  catch(err){alert("Não foi possível salvar a edição: "+(err.code||err.message));btn.disabled=false;}
});

$("anilist-connect").addEventListener("click",async()=>{
  if(!fbUser){setAniListFeedback("Entre com a conta Google proprietária antes de conectar o AniList.","error");return;}
  if(!window.hubFB?.beginAniListOAuth){setAniListFeedback("A integração ainda está inicializando. Recarregue a página e tente novamente.","error");return;}
  anilistBusy=true;updateAniListConnectionUI();setAniListFeedback("Preparando autorização segura com AniList…");
  try{const authorizationUrl=await window.hubFB.beginAniListOAuth();window.location.assign(authorizationUrl);}
  catch(err){console.warn("Falha ao iniciar OAuth do AniList",err);setAniListFeedback("Não foi possível iniciar a conexão. Verifique sua autenticação e tente novamente.","error");anilistBusy=false;updateAniListConnectionUI();}
});
$("anilist-disconnect").addEventListener("click",async()=>{
  if(!fbUser)return;
  if(!confirm("Deseja desconectar a conta AniList deste Hub?"))return;
  anilistBusy=true;updateAniListConnectionUI();setAniListFeedback("Desconectando conta AniList…");
  try{
    await window.hubFB.disconnectAniList();
    anilistStatus={kind:"disconnected"};anilistBusy=false;updateAniListConnectionUI();setAniListFeedback("Conta AniList desconectada com sucesso.");
  }catch(err){
    console.warn("Falha ao desconectar AniList",err);anilistBusy=false;updateAniListConnectionUI();setAniListFeedback("Não foi possível desconectar a conta. Verifique sua conexão e tente novamente.","error");
  }
});
$("anilist-retry").addEventListener("click",async()=>{if(!fbUser)return;anilistBusy=true;updateAniListConnectionUI();await refreshAniListStatus();anilistBusy=false;updateAniListConnectionUI()});

$("login").addEventListener("click",()=>{
  if(!window.hubFB){alert("O Firebase ainda não carregou. Confira a internet e recarregue.");return}
  (fbUser?hubFB.logout():hubFB.login()).catch(err=>alert("Não foi possível entrar: "+err.code));
});
document.addEventListener("click",async e=>{
  const openDefinitive=e.target.closest("[data-open-definitive]");
  if(openDefinitive){
    const editor=$("definitive-editor"),input=$("definitive-score");
    if(editor&&input){
      editor.hidden=false;input.focus();
    }
    return;
  }
  const cancelDefinitive=e.target.closest("[data-cancel-definitive]");
  if(cancelDefinitive){const editor=$("definitive-editor");if(editor)editor.hidden=true;return;}
  const confirmDefinitive=e.target.closest("[data-confirm-definitive]");
  if(confirmDefinitive){
    const input=$("definitive-score"),status=$("definitive-status"),editor=$("definitive-editor");
    const raw=input?.value.trim()||"",score=raw===""?NaN:Number(raw);
    if(!Number.isInteger(score)||score<0||score>100){if(status)status.textContent="Informe uma nota inteira entre 0 e 100.";input?.focus();return;}
    confirmDefinitive.disabled=true;if(status)status.textContent="Salvando nota definitiva…";
    try{
      const result=await hubFB.saveDefinitiveRating(activeDiaryAnime,score);
      if(status)status.textContent=result.changed?"Nota definitiva salva!":"Essa nota já é a nota definitiva atual; nenhuma alteração foi registrada.";
      await loadExperience(activeDiaryAnime);
    }catch(err){if(status)status.textContent="Não foi possível salvar: "+(err.code||err.message||"erro desconhecido");confirmDefinitive.disabled=false;}
    return;
  }
  const modeButton=e.target.closest("[data-dialog-mode]");
  if(modeButton){
    const dialog=$("dlg"),expanded=!dialog.classList.contains("fullscreen"),id=Number(window.activeDiaryAnime);
    if(expanded){
      dialog.classList.add("fullscreen");
      updateAnimeUrl(id,{method:"pushState",state:{hubAnimeId:id,hubAnimeFullscreen:true,hubAnimeDirect:false,hubAnimeFromCompact:true}});
    }else if(getAnimeUrlId()===id){
      if(history.state?.hubAnimeFromCompact&&history.state?.hubAnimeFullscreen){history.back();return;}
      updateAnimeUrl(null,{state:{hubAnimeId:null,hubAnimeFullscreen:false,hubAnimeDirect:false,hubAnimeFromCompact:false,hubCompactAnime:id}});
      dialog.classList.remove("fullscreen");
    }else dialog.classList.remove("fullscreen");
    modeButton.textContent=expanded?"↙":"⛶";
    modeButton.setAttribute("aria-label",expanded?"Voltar à janela compacta":"Expandir para tela cheia");
    modeButton.title=expanded?"Voltar à janela compacta":"Expandir para tela cheia";
    return;
  }
  const detailTab=e.target.closest("[data-detail-tab]");
  if(detailTab){const name=detailTab.dataset.detailTab;
    document.querySelectorAll("[data-detail-tab]").forEach(b=>b.setAttribute("aria-selected",String(b===detailTab)));
    ["themes","experience","diary"].forEach(tabName=>$(`detail-${tabName}`).classList.toggle("hidden",name!==tabName));
    if(name==="diary"&&activeDiaryAnime!=null)loadDiary(activeDiaryAnime);
    if(name==="experience"&&activeDiaryAnime!=null)loadExperience(activeDiaryAnime);
    return;
  }
  const editDate=e.target.closest('input[name="dateForgotten"]');
  if(editDate){const date=editDate.closest("form").querySelector('input[name="watchedAt"]');date.disabled=editDate.checked;if(editDate.checked)date.value="";else if(!date.value)date.value=localDateISO();return;}
  const forgot=e.target.closest("#diary-forgot");
  if(forgot){$("diary-date").disabled=forgot.checked;if(forgot.checked)$("diary-date").value="";else if(!$("diary-date").value)$("diary-date").value=localDateISO();return;}
  const refreshAnime=e.target.closest("[data-refresh-anime]");
  if(refreshAnime){const id=Number(refreshAnime.dataset.refreshAnime);if(Number.isFinite(id))await refreshOpenAnimeData(id,refreshAnime);return;}
  const associate=e.target.closest("[data-associate-provisional]");
  if(associate){
    const kind=associate.dataset.associateProvisional,select=document.getElementById(`associate-${kind}`),status=document.getElementById(`associate-status-${kind}`),targetSlug=select?.value;
    if(!targetSlug){if(status)status.textContent="Escolha uma música primeiro.";return;}
    associate.disabled=true;if(status)status.textContent="Associando…";
    try{await hubFB.associateProvisionalTheme(activeDiaryAnime,kind,targetSlug);await openAnime(activeDiaryAnime);}
    catch(err){if(status)status.textContent=err.message||err.code||"Não foi possível associar.";associate.disabled=false;}
    return;
  }
  const saveTheme=e.target.closest("[data-save-theme-comment]");
  if(saveTheme){const slug=saveTheme.dataset.saveThemeComment,key=`${activeDiaryAnime}:${slug}`,field=document.getElementById(`tc-${key}`),status=document.getElementById(`tcs-${key}`);saveTheme.disabled=true;status.textContent="Salvando…";try{await hubFB.saveThemeComment(activeDiaryAnime,slug,field.value.trim());status.textContent="Salvo!"}catch(err){status.textContent="Erro: "+(err.code||err.message)}finally{saveTheme.disabled=false}return;}
  const edit=e.target.closest("[data-edit-log]");
  if(edit){const id=activeDiaryAnime,logId=edit.dataset.editLog;try{const logs=await hubFB.getLogs(id),log=logs.find(x=>x.id===logId);if(!log)return;
    const entry=edit.closest(".diary-entry");entry.innerHTML=`<form class="diary-form" data-edit-form="${esc(logId)}"><div><label>Episódio</label><input name="episode" type="number" min="0" step="1" value="${Number(log.episode)||0}" required></div><div><label>Data</label><input name="watchedAt" type="date" value="${esc(log.watchedAt||"")}" ${log.watchedAt?"":"disabled"}><label style="display:flex;align-items:center;gap:7px;margin-top:8px"><input name="dateForgotten" type="checkbox" style="width:auto" ${log.watchedAt?"":"checked"}> Esqueci a data</label></div><div class="wide-field"><label>Comentário</label><textarea name="comment" required>${esc(log.comment)}</textarea></div><button type="submit">Salvar edição</button><button type="button" data-cancel-edit>Cancelar</button></form>`;
  }catch(err){alert("Não foi possível abrir o registro: "+(err.code||err.message))}return;}
  const del=e.target.closest("[data-delete-log]");
  if(del){if(!confirm("Excluir este registro do diário?"))return;try{await hubFB.deleteLog(del.dataset.deleteLog);await loadDiary(activeDiaryAnime)}catch(err){alert("Não foi possível excluir: "+(err.code||err.message))}return;}
  const cancel=e.target.closest("[data-cancel-edit]");if(cancel){loadDiary(activeDiaryAnime);return;}
  const sv=e.target.closest("[data-save]");
  if(sv){
    const key=sv.dataset.save,v=document.getElementById("sc-"+key).value.trim().replace(",","."),st=document.getElementById("st-"+key);
    try{
      if(v===""){await hubFB.remove(key);delete SONG_SCORES[key];st.textContent="nota removida";return}
      const n=parseFloat(v);
      if(isNaN(n)||n<0||n>10){st.textContent="use um número de 0 a 10";return}
      await hubFB.save(key,n);SONG_SCORES[key]=n;st.textContent="salvo";
    }catch(err){st.textContent="erro: "+(err.code||err.message)}
    return;
  }
  const g=e.target.closest("[data-go]");
  if(g){const [y,k]=g.dataset.go.split("|");tab="top";$("year").value=y;$("season").value=k;
    document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-selected",x.dataset.tab==="top"));
    render();$("sub").scrollIntoView({behavior:"smooth"});return}
const b=e.target.closest("[data-id]");if(b&&!$("dlg").contains(b))openAnime(+b.dataset.id);
  const c=e.target.closest("[data-copy]");if(c){navigator.clipboard?.writeText(c.dataset.copy);c.textContent="Copiado"}});
$("dlg").addEventListener("close",()=>{
  const dialog=$("dlg"),id=Number(window.activeDiaryAnime);
  dialog.classList.remove("fullscreen");
  if(getAnimeUrlId()===id){
    if(history.state?.hubAnimeFromCompact&&history.state?.hubAnimeFullscreen){
      history.back();
    }else{
      updateAnimeUrl(null,{state:{hubAnimeId:null,hubAnimeFullscreen:false,hubAnimeDirect:false,hubAnimeFromCompact:false,hubCompactAnime:null}});
    }
  }
  if(history.state?.hubCompactAnime===id)updateAnimeUrl(null,{state:{hubCompactAnime:null}});
});
window.addEventListener("popstate",()=>{
  const id=getAnimeUrlId(),dialog=$("dlg");
  if(id!==null){
    if(dialog.open&&Number(window.activeDiaryAnime)===id){
      dialog.classList.add("fullscreen");
    }else if(animes.length){
      openAnime(id,{fullscreen:true,fromUrl:true});
    }
    const button=dialog.querySelector("[data-dialog-mode]");
    if(button){button.textContent="↙";button.setAttribute("aria-label","Voltar à janela compacta");button.title="Voltar à janela compacta";}
    return;
  }
  if(!dialog.open)return;
  if(history.state?.hubCompactAnime===Number(window.activeDiaryAnime)){
    dialog.classList.remove("fullscreen");
    const button=dialog.querySelector("[data-dialog-mode]");
    if(button){button.textContent="⛶";button.setAttribute("aria-label","Expandir para tela cheia");button.title="Expandir para tela cheia";}
  }else{
    dialog.close();
  }
});
$("load").addEventListener("click",()=>load({sync:true}));
$("export-data").addEventListener("click",async()=>{
  const button=$("export-data");button.disabled=true;button.textContent="Preparando backup…";
  try{
    const data=await hubFB.exportData();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`meu-hub-animes-backup-${localDateISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    $("sync-status").textContent="Backup JSON exportado com sucesso.";
  }catch(err){alert("Não foi possível exportar seus dados: "+(err.code||err.message))}
  finally{button.disabled=false;button.textContent="Exportar meus dados (JSON)"}
});
$("import-data").addEventListener("click",()=>{
  if(!fbUser){alert("Entre com Google antes de importar um backup.");return}
  $("import-file").click();
});
