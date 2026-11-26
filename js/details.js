async function openAnime(id,{fullscreen=false,fromUrl=false}={}){
  const a=byId(id),d=$("dlg"),wasOpen=d.open,wasFullscreen=d.classList.contains("fullscreen");activeDiaryAnime=id;window.activeDiaryAnime=id;
  if(!wasOpen&&!fromUrl){
    updateAnimeUrl(null,{state:{hubCompactAnime:id,hubAnimeId:null,hubAnimeFullscreen:false,hubAnimeDirect:false,hubAnimeFromCompact:false}});
  }
  let note={};try{note=await hubFB.getAnimeNote(id)}catch(e){}
  
  // Selo visual da nota provisória para o cabeçalho (compatível com registros antigos).
  const headerProvisionalScore = note?.provisionalScore;
  const provBadge = headerProvisionalScore !== null && headerProvisionalScore !== undefined && Number.isFinite(Number(headerProvisionalScore))
    ? `<span class="tier provisional-rating-badge" style="--c:var(--gold)">${esc(headerProvisionalScore)} <small>Provisória</small></span>`
    : (note?.provisionalTier ? `<span class="tier provisional-rating-badge" style="--c:var(--gold)">${esc(note.provisionalTier)} <small>Provisória antiga</small></span>` : '');

  d.innerHTML=`<div class="dh" ${bg(a?.banner||a?.cover)}><button type="button" class="dmode" data-dialog-mode aria-label="Expandir para tela cheia" title="Expandir para tela cheia">⛶</button><button class="dx" onclick="dlg.close()">Fechar</button><h2>${esc(a?.title||"Anime "+id)}</h2>
   <div class="meta">${a?when(a):""} ${a?.score?badge(a.score):""} ${provBadge} · <a href="${a?.url||"https://anilist.co/anime/"+id}" target="_blank" rel="noopener">AniList</a></div>
   <div><button type="button" class="anime-refresh" data-refresh-anime="${id}">↻ Atualizar dados deste anime</button><span class="anime-refresh-status" id="anime-refresh-status" role="status"></span></div></div>
   <div class="db"><div class="detail-tabs"><button type="button" data-detail-tab="themes" aria-selected="true">OP e ED</button><button type="button" data-detail-tab="experience" aria-selected="false">Minha experiência</button><button type="button" data-detail-tab="diary" aria-selected="false">Diário de episódios</button></div>
   <section id="detail-themes"><div id="themes" class="msg">Carregando músicas e comentários salvos…</div></section>
   <section id="detail-experience" class="hidden"><div id="experience-content" class="msg">Carregando…</div></section>
   <section id="detail-diary" class="hidden"><div id="diary-content" class="msg">Carregando diário…</div></section></div>`;
  if(!d.open)d.showModal();
  if(fullscreen||wasFullscreen)d.classList.add("fullscreen");else d.classList.remove("fullscreen");
  const modeControl=d.querySelector("[data-dialog-mode]");
  if(modeControl){
    const expanded=d.classList.contains("fullscreen");
    modeControl.textContent=expanded?"↙":"⛶";
    modeControl.setAttribute("aria-label",expanded?"Voltar à janela compacta":"Expandir para tela cheia");
    modeControl.title=expanded?"Voltar à janela compacta":"Expandir para tela cheia";
  }
  let apiAvailable=false;
  try{
    const th=await fetchThemes(id);apiAvailable=true;
    // Se a API responder sem catálogo e o cache local não tiver metadados,
    // tenta recuperar a cópia persistida no Firestore antes de mostrar OP1/ED1.
    if(!th.length&&(!Array.isArray(note.themeCatalog)||!note.themeCatalog.length)){
      try{note=await hubFB.getAnimeNote(id,{refresh:true})}catch(e){console.warn("Não foi possível atualizar o catálogo salvo de OP/ED",e)}
    }
    const themeList=th.length?th:(note.themeCatalog||[]);
    // Backfill do catálogo no Firestore somente quando a lista mudou e a conta proprietária está conectada.
    if(th.length&&fbUser){
      const clean=th.map(t=>({slug:t.slug,type:t.type,title:t.title,artist:t.artist,eps:t.eps||"",video:t.video||""}));
      if(JSON.stringify(clean)!==JSON.stringify(note.themeCatalog||[])){
        try{await hubFB.saveThemeCatalog(id,th);note={...note,themeCatalog:clean}}catch(e){console.warn("Não foi possível salvar o catálogo de OP/ED",e)}
      }
    }
    const slugs=[...new Set([...themeList.map(t=>t.slug),...Object.keys(note.themeComments||{}),...Object.values(PROVISIONAL_THEME_SLUGS)])];
    if(slugs.length){try{Object.assign(SONG_SCORES,await hubFB.getSongScoresForAnime(id,slugs))}catch(e){}}
    renderThemeList(id,themeList,note,false);
  }catch(e){
    // Em caso de indisponibilidade da AnimeThemes, não confia apenas no cache:
    // se ele não tiver catálogo, consulta o Firestore diretamente (sem TTL).
    if(!Array.isArray(note.themeCatalog)||!note.themeCatalog.length){
      try{note=await hubFB.getAnimeNote(id,{refresh:true})}catch(refreshError){console.warn("Não foi possível recuperar o catálogo salvo no Firestore",refreshError)}
    }
    const themeList=Array.isArray(note.themeCatalog)?note.themeCatalog:[];
    const slugs=[...new Set([...themeList.map(t=>t.slug),...Object.keys(note.themeComments||{}),...Object.values(PROVISIONAL_THEME_SLUGS)])];
    if(slugs.length){try{Object.assign(SONG_SCORES,await hubFB.getSongScoresForAnime(id,slugs))}catch(ignore){}}
    renderThemeList(id,themeList,note,true);
  }
  loadDiary(id);loadExperience(id);
}

async function refreshOpenAnimeData(id,button){
  const status=$("anime-refresh-status");
  if(!button||button.disabled||activeDiaryAnime!==id)return;
  button.disabled=true;button.textContent="Atualizando…";if(status)status.textContent="Buscando dados atuais no Firestore…";
  try{
    // Atualiza apenas os documentos vinculados ao anime aberto, ignorando o TTL local.
    const freshNote=await hubFB.getAnimeNote(id,{refresh:true});
    let themes=[],apiAvailable=true;
    try{themes=await fetchThemes(id)}catch(err){apiAvailable=false;}
    const themeList=themes.length?themes:(Array.isArray(freshNote.themeCatalog)?freshNote.themeCatalog:[]);
    const previousScoreSlugs=Object.keys(SONG_SCORES).filter(key=>key.startsWith(`${id}:`)).map(key=>key.slice(String(id).length+1));
    const slugs=[...new Set([...themeList.map(t=>t.slug),...Object.keys(freshNote.themeComments||{}),...Object.values(PROVISIONAL_THEME_SLUGS),...previousScoreSlugs])];
    const freshScores=slugs.length?await hubFB.getSongScoresForAnime(id,slugs,{refresh:true}):{};
    const freshLogs=await hubFB.getLogs(id,{refresh:true});
    if(activeDiaryAnime!==id||!$("dlg").open)return;
    Object.keys(SONG_SCORES).filter(key=>key.startsWith(`${id}:`)).forEach(key=>delete SONG_SCORES[key]);
    Object.assign(SONG_SCORES,freshScores);
    renderThemeList(id,themeList,freshNote,!apiAvailable);
    renderDiaryEntries(id,freshLogs,!!fbUser);
    await loadExperience(id);
    if(status)status.textContent="Dados atualizados com sucesso.";
  }catch(err){
    if(status)status.textContent=`Falha ao atualizar: ${err.code||err.message||"erro desconhecido"}. Os dados exibidos foram mantidos.`;
  }finally{
    if(button.isConnected){button.disabled=false;button.textContent="↻ Atualizar dados deste anime";}
  }
}

async function loadExperience(id){
  const root=$("experience-content");
  root.className="msg";root.textContent="Carregando informações…";
  try{
    const data=await hubFB.getAnimeNote(id);if(activeDiaryAnime!==id||!$("dlg").open)return;
    const platforms=Array.isArray(data.platforms)?data.platforms:[];
    const languageLabel=({sub:"Legendado",dub:"Dublado",other:"Outro"})[data.language]||"Não informado";
    const currentScore = data.provisionalScore !== null && data.provisionalScore !== undefined && Number.isFinite(Number(data.provisionalScore))
      ? String(data.provisionalScore) : "";
    const legacyTier = data.provisionalTier || "";
    const ratingHistory = Array.isArray(data.provisionalRatingHistory) ? data.provisionalRatingHistory : [];
    const definitiveRating=data.definitiveRating&&typeof data.definitiveRating==="object"?data.definitiveRating:null;
    const definitiveScore=definitiveRating?.score!==null&&definitiveRating?.score!==undefined&&Number.isFinite(Number(definitiveRating.score))
      ? Number(definitiveRating.score) : null;
    const definitiveHistory=Array.isArray(data.definitiveRatingHistory)?data.definitiveRatingHistory:[];
    const dateValue=value=>{
      if(!value)return null;
      if(typeof value.toDate==="function")return value.toDate();
      if(typeof value==="object"&&Number.isFinite(value.seconds))return new Date(value.seconds*1000+(Number(value.nanoseconds)||0)/1e6);
      const parsed=new Date(value);
      return Number.isNaN(parsed.getTime())?null:parsed;
    };
    const historyDate = value => {
      const date=dateValue(value);
      return date?date.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Data não disponível";
    };
    const historyHtml = ratingHistory.length
      ? `<div class="rating-history"><h3>Histórico da nota provisória</h3><ol>${ratingHistory.map(entry=>`<li><strong>${entry.score===null||entry.score===undefined?"Nota removida":`${esc(entry.score)}/100`}</strong><span>${esc(historyDate(entry.changedAt))}</span></li>`).join("")}</ol><p class="platform-hint">Cada registro representa uma alteração real da nota. O histórico é preservado mesmo quando você terminar o anime.</p></div>`
      : '<p class="platform-hint">As alterações da nota serão registradas aqui com data e horário.</p>';
    const definitiveHistoryHtml=definitiveHistory.length
      ? `<div class="rating-history"><h3>Histórico da nota definitiva</h3><ol>${definitiveHistory.map((entry,index)=>({...entry,previousScore:entry.previousScore??(index>0?definitiveHistory[index-1]?.score:null)})).reverse().map(entry=>`<li><strong>${esc(entry.score)}/100</strong><span>Anterior: ${entry.previousScore===null||entry.previousScore===undefined?"Não registrada":`${esc(entry.previousScore)}/100`}<br>Provisória: ${entry.provisionalScoreAtConfirmation===null||entry.provisionalScoreAtConfirmation===undefined?"Não informada":`${esc(entry.provisionalScoreAtConfirmation)}/100`}<br>${esc(historyDate(entry.changedAt))}</span></li>`).join("")}</ol><p class="platform-hint">Cada definição ou revisão preserva a nota anterior, a nova nota e a nota provisória daquele momento.</p></div>`
      : "";
    const definitiveSection=definitiveScore!==null
      ? `<div class="definitive-rating"><div class="definitive-rating-head"><div><span class="meta">Nota definitiva do Hub</span><div class="definitive-rating-score">${esc(definitiveScore)}/100</div></div><button type="button" class="primary" data-open-definitive>Revisar nota definitiva</button></div><div class="definitive-rating-meta">Nota provisória na confirmação: ${definitiveRating.provisionalScoreAtConfirmation===null||definitiveRating.provisionalScoreAtConfirmation===undefined?"Não informada":`${esc(definitiveRating.provisionalScoreAtConfirmation)}/100`} · Última confirmação: ${esc(historyDate(definitiveRating.confirmedAt))}</div>${definitiveHistoryHtml}</div>`
      : `<div class="definitive-rating"><div><span class="meta">Nota definitiva do Hub</span><p class="platform-hint">Ainda não definida. A nota provisória não será convertida automaticamente.</p></div><button type="button" class="primary" data-open-definitive>Definir nota definitiva</button></div>`;
    const definitiveEditor=`<div class="definitive-editor" id="definitive-editor" hidden><div><label for="definitive-score">Nota definitiva (0 a 100)</label><input id="definitive-score" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="Ex.: 90" value="${definitiveScore===null?esc(currentScore):esc(definitiveScore)}"><p class="platform-hint">A nota provisória atual (${currentScore!==""?`${esc(currentScore)}/100`:"não informada"}) será registrada como fotografia desta confirmação. Ela não será alterada se você mudar a nota provisória depois.</p></div><div class="definitive-editor-actions"><button type="button" class="primary" data-confirm-definitive>Confirmar nota definitiva</button><button type="button" data-cancel-definitive>Cancelar</button></div><span class="experience-status" id="definitive-status" role="status"></span></div>`;

    if(!fbUser){
      const hasData=!!(data.language||platforms.length||data.otherPlatform||data.viewingNotes||currentScore||legacyTier||definitiveScore!==null);
      root.className="";
      root.innerHTML=hasData?`<div class="experience-public">
       ${definitiveScore!==null?`<p><span class="meta">Nota definitiva do Hub</span><br><strong>${esc(definitiveScore)}/100</strong></p>`:""}
       <p><span class="meta">Nota provisória</span><br><strong>${esc(currentScore!==""?`${currentScore}/100`:legacyTier||"Não informada")}</strong></p>
       <p><span class="meta">Idioma</span><br><strong>${esc(languageLabel)}</strong></p>
       <p><span class="meta">Plataforma(s)</span><br><strong>${esc([...platforms,...(data.otherPlatform?[data.otherPlatform]:[])].join(", ")||"Não informado")}</strong></p>
       <p><span class="meta">Outras informações</span></p><p style="white-space:pre-wrap">${esc(data.viewingNotes||"Não informado")}</p></div>`:'<div class="msg">Ainda não há informações públicas sobre como assisti a este anime.</div>';
      return;
    }

    root.className="";
    root.innerHTML=`<p class="diary-intro">A nota provisória é independente da nota definitiva do Hub. Você pode alterá-la durante a experiência; cada mudança real fica registrada no histórico.</p>
      <form class="experience-form" id="experience-form">
       ${definitiveSection}
       ${definitiveEditor}
       <div>
         <label for="provisional-score">Nota provisória (0 a 100)</label>
         <div class="score-control"><button type="button" class="score-step" data-score-step="-1" aria-label="Diminuir nota">−</button><input id="provisional-score" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="Ex.: 85" value="${esc(currentScore)}"><button type="button" class="score-step" data-score-step="1" aria-label="Aumentar nota">+</button></div>
         <button type="button" class="save-score-button" id="save-provisional-score">Salvar somente a nota</button><span class="experience-status" id="score-save-status" role="status"></span>
         <p class="platform-hint">Essa nota é independente da nota definitiva e não altera sua avaliação no AniList. Deixe em branco se ainda não quiser avaliar.${legacyTier?` Registro antigo encontrado (${esc(legacyTier)}); ao salvar uma nota numérica, ele será substituído.`:""}</p>
       </div>
       ${historyHtml}
       <div class="language-picker" id="language-picker"><label>Idioma</label><input type="hidden" id="watch-language" value="${esc(data.language||"")}"><button type="button" class="language-trigger" id="language-trigger" aria-expanded="false"><span id="language-label">${({sub:"Legendado",dub:"Dublado",other:"Outro"}[data.language]||"Não informado")}</span><span class="language-chevron">⌄</span></button><div class="language-menu hidden" id="language-menu"><button type="button" data-language-value="" ${!data.language?"aria-selected=\"true\"":""}>Não informado</button><button type="button" data-language-value="sub" ${data.language==="sub"?"aria-selected=\"true\"":""}>Legendado</button><button type="button" data-language-value="dub" ${data.language==="dub"?"aria-selected=\"true\"":""}>Dublado</button><button type="button" data-language-value="other" ${data.language==="other"?"aria-selected=\"true\"":""}>Outro</button></div></div>
       <div><label>Plataforma(s) em que assistiu</label><div class="platform-picker" id="watch-platforms">
        ${["Crunchyroll","Netflix","Prime Video","Disney+","Max","YouTube","Outra"].map(platform=>`<label class="platform-option"><input type="checkbox" name="watch-platform" value="${platform}" ${platforms.includes(platform)?"checked":""}><span class="platform-check"></span><span>${platform}</span></label>`).join("")}
       </div><p class="platform-hint">Selecione quantas plataformas quiser.</p></div>
       <div><label for="watch-platform-other">Outra plataforma (opcional)</label><input id="watch-platform-other" maxlength="100" value="${esc(data.otherPlatform||"")}" placeholder="Nome da plataforma"></div>
       <div><label for="watch-notes">Outras informações (opcional)</label><textarea id="watch-notes" maxlength="5000" placeholder="Ex.: acompanhei semanalmente, assisti com amigos…">${esc(data.viewingNotes||"")}</textarea></div>
       <button type="submit">Salvar minha experiência</button><span class="experience-status" id="experience-status" role="status"></span>
      </form>`;

    $("definitive-score").addEventListener("keydown",ev=>{
      if(ev.key==="Enter"){ev.preventDefault();$("experience-form").querySelector("[data-confirm-definitive]")?.click();}
    });
    $("save-provisional-score").addEventListener("click",async()=>{
      const input=$("provisional-score"),status=$("score-save-status"),button=$("save-provisional-score"),raw=input.value.trim(),score=raw===""?null:Number(raw);
      if(raw!==""&&(!Number.isInteger(score)||score<0||score>100)){status.textContent="Informe uma nota inteira entre 0 e 100.";input.focus();return;}
      button.disabled=true;status.textContent="Salvando nota…";
      try{await hubFB.saveAnimeNote(id,{provisionalScore:score});status.textContent="Nota salva!";const badgeNode=$("dlg").querySelector(".dh .meta");if(badgeNode){const oldBadge=badgeNode.querySelector(".provisional-rating-badge");if(oldBadge)oldBadge.remove();if(score!==null){const scoreBadge=document.createElement("span");scoreBadge.className="tier provisional-rating-badge";scoreBadge.style.setProperty("--c","var(--gold)");scoreBadge.innerHTML=`${esc(score)} <small>Provisória</small>`;badgeNode.insertBefore(scoreBadge,badgeNode.querySelector("a")||null);}}await loadExperience(id);}
      catch(err){status.textContent="Não foi possível salvar: "+(err.code||err.message||"erro desconhecido");button.disabled=false;}
    });
    $("experience-form").addEventListener("submit",async ev=>{
      ev.preventDefault();const btn=ev.currentTarget.querySelector('button[type="submit"]'),status=$("experience-status");btn.disabled=true;status.textContent="Salvando…";
      const selectedPlatforms=[...$("watch-platforms").querySelectorAll("input[name=\"watch-platform\"]:checked")].map(o=>o.value);
      const rawProvisionalScore=$("provisional-score").value.trim();
      const provisionalScore=rawProvisionalScore===""?null:Number(rawProvisionalScore);
      if(rawProvisionalScore!==""&&(!Number.isInteger(provisionalScore)||provisionalScore<0||provisionalScore>100)){
        status.textContent="Informe uma nota inteira entre 0 e 100.";btn.disabled=false;return;
      }
      try{
        await hubFB.saveAnimeNote(id,{
          provisionalScore,
          language:$("watch-language").value,
          platforms:selectedPlatforms,
          otherPlatform:$("watch-platform-other").value.trim(),
          viewingNotes:$("watch-notes").value.trim()
        });
        status.textContent="Salvo com sucesso!";
        const badgeNode=$("dlg").querySelector(".dh .meta");
        if(badgeNode){
          const oldBadge=badgeNode.querySelector(".provisional-rating-badge");
          if(oldBadge)oldBadge.remove();
          if(provisionalScore!==null){const scoreBadge=document.createElement("span");scoreBadge.className="tier provisional-rating-badge";scoreBadge.style.setProperty("--c","var(--gold)");scoreBadge.innerHTML=`${esc(provisionalScore)} <small>Provisória</small>`;badgeNode.insertBefore(scoreBadge,badgeNode.querySelector("a")||null);}
        }
        await loadExperience(id);
      }
      catch(err){status.textContent="Não foi possível salvar: "+(err.code||err.message)}finally{btn.disabled=false}
    });
  }catch(err){root.className="";root.innerHTML=`<div class="msg err">Não consegui carregar as informações (${esc(err.code||err.message)}).</div>`}
}
let activeDiaryAnime=null;window.activeDiaryAnime=null;window.addEventListener("diary-auth-refresh",()=>{if(activeDiaryAnime!=null){loadDiary(activeDiaryAnime);loadExperience(activeDiaryAnime)}});
function localDateISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function diaryDate(value){
  if(!value)return "Esqueci a data";
  const d=new Date(value+"T12:00:00");
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString("pt-BR");
}
function renderDiaryCalendar(value,monthOverride=null,yearOverride=null){
  const input=$("diary-date"),calendar=$("diary-calendar");if(!input||!calendar)return;
  const chosen=value?new Date(value+"T12:00:00"):new Date();
  const view=new Date(yearOverride??chosen.getFullYear(),monthOverride??chosen.getMonth(),1);
  const monthNames=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const offset=view.getDay(),days=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
  const prevDays=new Date(view.getFullYear(),view.getMonth(),0).getDate();
  let cells="";for(let i=0;i<42;i++){let day=i-offset+1,other=false,num=day;if(day<1){num=prevDays+day;other=true}else if(day>days){num=day-days;other=true}const date=new Date(view.getFullYear(),view.getMonth()+(day<1?-1:day>days?1:0),num),iso=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;cells+=`<button type="button" class="calendar-day ${other?"other-month":""} ${iso===input.value?"selected":""} ${iso===localDateISO()?"today":""}" data-calendar-date="${iso}">${num}</button>`}
  const currentYear=new Date().getFullYear(),years=Array.from({length:currentYear+10-1900+1},(_,i)=>1900+i);
  calendar.innerHTML=`<div class="calendar-head"><button type="button" data-calendar-nav="-1" aria-label="Mês anterior">‹</button><div class="calendar-pickers"><div class="calendar-picker"><button type="button" class="calendar-picker-trigger" data-calendar-month-trigger aria-expanded="false">${monthNames[view.getMonth()].replace(/^./,c=>c.toUpperCase())}<span class="picker-chevron">⌄</span></button><div class="calendar-picker-menu calendar-month-menu hidden" data-calendar-month-menu>${monthNames.map((m,i)=>`<button type="button" data-calendar-month="${i}" class="${i===view.getMonth()?"active":""}">${m.replace(/^./,c=>c.toUpperCase())}</button>`).join("")}</div></div><div class="calendar-picker year-picker"><button type="button" class="calendar-picker-trigger" data-calendar-year-trigger aria-expanded="false">${view.getFullYear()}<span class="picker-chevron">⌄</span></button><div class="calendar-picker-menu calendar-year-menu hidden" data-calendar-year-menu>${years.map(y=>`<button type="button" data-calendar-year="${y}" class="${y===view.getFullYear()?"active":""}">${y}</button>`).join("")}</div></div></div><button type="button" data-calendar-nav="1" aria-label="Próximo mês">›</button></div><div class="calendar-weekdays">${["D","S","T","Q","Q","S","S"].map(x=>`<span>${x}</span>`).join("")}</div><div class="calendar-grid">${cells}</div><div class="calendar-foot"><button type="button" data-calendar-today>Hoje</button></div>`;
  calendar.dataset.viewMonth=String(view.getMonth());calendar.dataset.viewYear=String(view.getFullYear());
}
function renderDiaryEntries(id,logs,editable=false){
  const a=byId(id),next=(a?.progress||0)+1;
  const sorted=[...logs].sort((x,y)=>String(y.watchedAt||"").localeCompare(String(x.watchedAt||""))||((y.createdAtMs||0)-(x.createdAtMs||0)));
  $("diary-content").className="";
  const form=editable?`<p class="diary-intro">Registre suas impressões episódio por episódio. Você pode adicionar mais de uma anotação ao mesmo episódio.</p>
   <form class="diary-form" id="diary-form">
    <div class="episode-control-wrap"><label for="diary-episode">Episódio</label><div class="episode-control"><input id="diary-episode" type="number" min="0" step="1" value="${next}" required><div class="episode-stepper"><button type="button" data-episode-step="1" aria-label="Aumentar episódio">+</button><button type="button" data-episode-step="-1" aria-label="Diminuir episódio">−</button></div></div></div>
    <div class="diary-date-field"><label>Data em que assistiu</label><input id="diary-date" type="hidden" value="${localDateISO()}"><button type="button" class="diary-date-trigger" id="diary-date-trigger" aria-expanded="false"><span class="diary-date-icon">▦</span><span id="diary-date-label">${diaryDate(localDateISO())}</span><span class="diary-date-caret">⌄</span></button><div class="diary-calendar hidden" id="diary-calendar" aria-label="Calendário"></div><button type="button" class="diary-forgot" id="diary-forgot" aria-pressed="false"><span class="diary-forgot-mark"></span>Não lembro a data</button></div>
    <div class="wide-field"><label for="diary-comment">Seu comentário</label><textarea id="diary-comment" maxlength="10000" placeholder="O que aconteceu? O que achou do episódio?" required></textarea></div>
    <button type="submit">Adicionar registro</button><span class="diary-status" id="diary-status" role="status"></span>
   </form>`:'<p class="diary-intro">Diário público de episódios e impressões.</p>';
  $("diary-content").innerHTML=form+`<h3 style="font:600 1.2rem var(--serif);margin:0 0 12px">Histórico <span class="meta">${sorted.length} registro(s)</span></h3>
   <div class="diary-list">${sorted.length?sorted.map(log=>`<article class="diary-entry"><div class="diary-entry-head"><strong>Episódio ${Number(log.episode)||0}</strong><span class="meta">${diaryDate(log.watchedAt)}</span></div><p>${esc(log.comment)}</p>${editable?`<div class="diary-actions"><button type="button" data-edit-log="${esc(log.id)}">Editar</button><button type="button" data-delete-log="${esc(log.id)}">Excluir</button></div>`:""}</article>`).join(""):'<div class="msg">Ainda não há registros públicos para este anime.</div>'}</div>`;
  if(!editable)return;
  renderDiaryCalendar(localDateISO());
  const formEl=$("diary-form");
  formEl.addEventListener("submit",async ev=>{
    ev.preventDefault();const status=$("diary-status"),episode=Number($("diary-episode").value),watchedAt=$("diary-forgot").getAttribute("aria-pressed")==="true"?"":$("diary-date").value,comment=$("diary-comment").value.trim();
    if(!Number.isInteger(episode)||episode<0||($("diary-forgot").getAttribute("aria-pressed")!=="true"&&!watchedAt)||!comment){status.textContent="Preencha episódio, data (ou marque Esqueci) e comentário.";return}
    const submit=formEl.querySelector('button[type="submit"]');submit.disabled=true;status.textContent="Salvando…";
    try{await hubFB.addLog({animeId:id,episode,watchedAt,comment});await loadDiary(id);}
    catch(err){status.textContent="Não foi possível salvar: "+(err.code||err.message);submit.disabled=false;}
  });
}
async function loadDiary(id){
  activeDiaryAnime=id;
  $("diary-content").className="msg";$("diary-content").textContent="Carregando diário…";
  try{const logs=await hubFB.getLogs(id);if(activeDiaryAnime===id&&$("dlg").open){renderDiaryEntries(id,logs,!!fbUser);if(fbUser&&typeof renderAnimeReviewPanel==="function")await renderAnimeReviewPanel(id);}}
  catch(err){$("diary-content").innerHTML=`<div class="msg err">Não consegui carregar o diário (${esc(err.code||err.message)}). Confira se a leitura pública está liberada nas regras do Firestore.</div>`}
}

const statNum=n=>Number(n||0).toLocaleString("pt-BR");
const statPct=(n,total)=>total?`${Math.round(n/total*100)}%`:"0%";
