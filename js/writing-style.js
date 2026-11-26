let writingStyleReferences=[],writingStyleProfile="",writingStyleSections=null,writingStyleEditingId=null,writingStyleLoaded=false;
function writingStyleReferenceCard(item){
  const active=item.active!==false;
  return `<article class="ws-reference ${active?'':'ws-inactive'}" data-reference-id="${esc(item.id)}">
    <div class="ws-reference-head"><div><h3>${esc(item.title||"Referência sem título")}</h3>${item.animeTitle?`<p class="meta">${esc(item.animeTitle)}</p>`:""}</div><span class="ws-state">${active?'Ativa':'Desativada'}</span></div>
    ${item.note?`<p class="ws-note"><strong>Observação:</strong> ${esc(item.note)}</p>`:""}
    <p class="ws-preview">${esc(item.text).slice(0,420)}${item.text.length>420?'…':''}</p>
    <div class="ws-actions"><button type="button" data-ws-action="edit" data-id="${esc(item.id)}">Editar</button><button type="button" data-ws-action="toggle" data-id="${esc(item.id)}">${active?'Desativar':'Ativar'}</button><button type="button" class="ws-delete" data-ws-action="delete" data-id="${esc(item.id)}">Excluir</button></div>
  </article>`;
}
function renderWritingStyleForm(item=null){
  writingStyleEditingId=item?.id||null;
  const root=document.getElementById('ws-form');if(!root)return;
  root.innerHTML=`<form id="ws-reference-form" class="ws-form">
    <h3>${item?'Editar referência':'Adicionar resenha de referência'}</h3>
    <label>Título (opcional)<input name="title" maxlength="160" value="${esc(item?.title||'')}" placeholder="Ex.: Uma resenha que representa meu estilo"></label>
    <label>Anime associado (opcional)<input name="animeTitle" maxlength="160" value="${esc(item?.animeTitle||'')}" placeholder="Nome do anime"></label>
    <label>Texto da resenha<textarea name="text" rows="8" required placeholder="Cole aqui a resenha que você gostaria de utilizar como referência…">${esc(item?.text||'')}</textarea></label>
    <label>Observação sobre o que você gosta neste texto (opcional)<textarea name="note" rows="3" placeholder="Ex.: Gosto do desenvolvimento, mas prefiro textos um pouco mais curtos.">${esc(item?.note||'')}</textarea></label>
    <div class="ws-actions"><button class="primary" type="submit">${item?'Salvar alterações':'Adicionar referência'}</button><button type="button" data-ws-action="cancel">Cancelar</button></div><p class="ws-feedback" id="ws-form-feedback" role="status"></p>
  </form>`;
}

const wsProfileFields=[['tonePersonality','Tom e personalidade'],['vocabularyLanguage','Vocabulário e linguagem'],['structure','Estrutura textual'],['argumentationCriticism','Argumentação e crítica'],['personalExpression','Expressão pessoal'],['avoid','O que evitar']];
function renderWritingStyleProfileEditor(sections=null,legacyText=''){const root=$('ws-profile-editor');if(!root)return;const data=sections||Object.fromEntries(wsProfileFields.map(([key])=>[key,'']));root.innerHTML=`${wsProfileFields.map(([key,label])=>`<label class="ws-profile-field">${label}<textarea rows="3" data-profile-field="${key}" placeholder="${label}…">${esc(data[key]||'')}</textarea></label>`).join('')}<div class="ws-actions"><button type="button" class="primary" data-ws-action="save-profile">Salvar perfil</button></div>`;if(!sections&&legacyText){const first=root.querySelector('[data-profile-field="tonePersonality"]');if(first)first.value=legacyText;}}
function readWritingStyleProfile(){return Object.fromEntries(wsProfileFields.map(([key])=>[key,$(`[data-profile-field="${key}"]`)?.value.trim()||'']));}

async function renderWritingStyle(){
  const view=$('view');view.innerHTML=`<section class="writing-style-page"><header class="ws-intro"><div><p class="eyebrow">PERSONALIZAÇÃO</p><h2>Biblioteca de estilo</h2><p>Reúna resenhas que representam o estilo de escrita que gostaria de usar nas futuras resenhas geradas a partir do seu diário.</p></div></header>
    ${!fbUser?`<div class="msg">Entre com a conta Google proprietária para acessar e gerenciar sua Biblioteca de estilo.</div>`:`<section class="ws-section"><div class="ws-section-head"><div><h3>Minhas referências</h3><p class="meta">Os textos adicionados aqui serão exemplos para a futura geração de resenhas.</p></div><button type="button" class="primary" data-ws-action="new">Adicionar referência</button></div><div id="ws-form"></div><div id="ws-reference-list" class="ws-reference-list"></div></section><section class="ws-section ws-profile"><div class="ws-section-head"><div><h3>Perfil de escrita</h3><p class="meta">Analise suas referências ativas. A proposta gerada não substitui o perfil salvo até você aprovar.</p></div></div><div class="ws-actions"><button type="button" class="primary" data-ws-action="analyze">Analisar referências ativas</button></div><div id="ws-profile-editor"></div><div id="ws-profile-feedback" class="ws-feedback" role="status"></div></section>`}</section>`;
  if(!fbUser)return;
  const list=$('ws-reference-list');list.innerHTML='<div class="msg">Carregando suas referências…</div>';
  try{
    const [refs,profile]=await Promise.all([hubFB.getWritingStyleReferences(),hubFB.getWritingStyleProfile()]);writingStyleReferences=refs;writingStyleProfile=profile?.profileText||"";writingStyleSections=profile?.sections||null;writingStyleLoaded=true;
    list.innerHTML=refs.length?refs.map(writingStyleReferenceCard).join(''):'<div class="msg">Ainda não há resenhas de referência. Adicione textos que representem o estilo que você gostaria de preservar.</div>';
    renderWritingStyleProfileEditor(writingStyleSections,writingStyleProfile);
  }catch(error){list.innerHTML=`<div class="msg err">Não foi possível carregar a biblioteca: ${esc(error.message)}</div>`;}
}
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-ws-action]');if(!button)return;const action=button.dataset.wsAction,id=button.dataset.id;
  if(action==='new'){renderWritingStyleForm();return;}
  if(action==='cancel'){renderWritingStyleForm(null);$('ws-form').innerHTML='';writingStyleEditingId=null;return;}
  if(!fbUser)return;
  const item=writingStyleReferences.find(x=>x.id===id);
  try{
    if(action==='edit'){renderWritingStyleForm(item);return;}
    if(action==='toggle'&&item){await hubFB.saveWritingStyleReference({...item,active:item.active===false});await renderWritingStyle();}
    if(action==='delete'&&item&&confirm(`Excluir a referência "${item.title||'sem título'}"?`)){await hubFB.deleteWritingStyleReference(id);await renderWritingStyle();}
    if(action==='analyze'){button.disabled=true;const feedback=$('ws-profile-feedback');feedback.textContent='Analisando referências ativas…';try{const active=writingStyleReferences.filter(r=>r.active!==false);if(!active.length)throw new Error('Ative pelo menos uma referência.');const result=await hubFB.analyzeWritingStyle(active);renderWritingStyleProfileEditor(result.profile);feedback.textContent=`Proposta gerada a partir de ${result.referenceCount} referência(s). Revise e salve para aprovar.`;button.disabled=false;}catch(error){feedback.textContent=`Falha na análise: ${error.message}`;button.disabled=false;}return;}if(action==='save-profile'){const feedback=$('ws-profile-feedback');button.disabled=true;try{await hubFB.saveWritingStyleProfile(readWritingStyleProfile());feedback.textContent='Perfil salvo.';}finally{button.disabled=false;}}
  }catch(error){const f=$('ws-profile-feedback');if(f)f.textContent=`Não foi possível concluir: ${error.message}`;button.disabled=false;}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='ws-reference-form')return;e.preventDefault();if(!fbUser)return;
  const form=e.target,fd=new FormData(form),text=String(fd.get('text')||'').trim(),feedback=$('ws-form-feedback'),submit=form.querySelector('[type=submit]');
  if(!text){feedback.textContent='Insira o texto da resenha.';return;}submit.disabled=true;feedback.textContent='Salvando…';
  try{await hubFB.saveWritingStyleReference({id:writingStyleEditingId,title:fd.get('title'),animeTitle:fd.get('animeTitle'),text,note:fd.get('note'),active:writingStyleEditingId? (writingStyleReferences.find(x=>x.id===writingStyleEditingId)?.active!==false):true});writingStyleEditingId=null;await renderWritingStyle();}
  catch(error){feedback.textContent=`Erro ao salvar: ${error.message}`;submit.disabled=false;}
});
