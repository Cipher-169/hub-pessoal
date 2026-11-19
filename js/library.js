function renderHero(){
  const pool=animes.filter(a=>a.banner&&["CURRENT","REPEATING"].includes(a.status));
  const best=animes.filter(a=>a.banner&&a.score>=95);
  const list=pool.length?pool:best.length?best:animes.filter(a=>a.banner);
  const a=list[Math.floor(Math.random()*list.length)];
  if(!a){$("heroin").innerHTML="<h1>Meu hub de animes</h1>";return}
  $("hero").style.backgroundImage=`url('${a.banner}')`;
  const cur=["CURRENT","REPEATING"].includes(a.status);
  $("heroin").innerHTML=`<small>${cur?`Assistindo agora, ep ${a.progress}${a.eps?" de "+a.eps:""}`:`Um dos meus ${a.score}+`}</small>
   <h1>${esc(a.title)}</h1><p>${when(a)}</p><button class="go" data-id="${a.id}">Ver OP e ED</button>`;
}

const poster=a=>{
  const cur=["CURRENT","REPEATING"].includes(a.status),pct=a.eps?Math.min(100,a.progress/a.eps*100):0;
  return `<button class="poster" data-id="${a.id}"><img src="${a.cover}" alt="" loading="lazy"><div class="cap"><b>${esc(a.title)}</b>${cur?`<div class="pb"><i style="width:${pct}%"></i></div><span>ep ${a.progress}${a.eps?" / "+a.eps:""}</span>`:`<span>${when(a)}</span>`}</div></button>`};
const wide=a=>{const pct=a.eps?Math.min(100,a.progress/a.eps*100):0;
  return `<button class="wide" data-id="${a.id}" ${bg(a.banner)}><img src="${a.cover}" alt=""><div><b>${esc(a.title)}</b><div class="meta">${when(a)}</div><div class="pb"><i style="width:${pct}%"></i></div><span class="meta">ep ${a.progress}${a.eps?" / "+a.eps:""}</span></div></button>`};
const sec=(t,l,f,c)=>l.length?`<h2>${t} <span class="meta">${l.length}</span></h2><div class="${c}">${l.map(f).join("")}</div>`:"";

function renderNow(){
  const w=animes.filter(a=>["CURRENT","REPEATING"].includes(a.status)),p=animes.filter(a=>a.status==="PLANNING");
  const now=p.filter(a=>a.airing==="RELEASING"),soon=p.filter(a=>a.airing==="NOT_YET_RELEASED"),old=p.filter(a=>!["RELEASING","NOT_YET_RELEASED"].includes(a.airing));
  $("view").innerHTML=sec("Assistindo",w,wide,"wides")+sec("Planejo, no ar agora",now,poster,"grid")+sec("Planejo, em breve",soon,poster,"grid")+
   (old.length?`<details><summary>Planejo, já lançados (${old.length})</summary><div class="grid">${old.map(poster).join("")}</div></details>`:"");
}
const filtered = l => {
  const y = $("year").value;
  const s = $("season").value;
  const q = ($("search-query")?.value || "").trim().toLowerCase();
  
  return l.filter(i => {
    const matchYear = !y || String(i.year) === y;
    const matchSeason = !s || i.season === s;
    const matchQuery = !q || String(i.title || "").toLowerCase().includes(q);
    return matchYear && matchSeason && matchQuery;
  });
};

function ranking(items){ /* items: {id,cover,title,sub,score} */
  if(!items.length) return '<div class="msg">Nada com esses filtros.</div>';
  const pod=items.slice(0,3),rest=items.slice(3);
  return `<div class="podium">${pod.map((a,k)=>`<div class="pod"><span class="num">${k+1}</span><button class="poster" data-id="${a.id}"><img src="${a.cover}" alt=""></button>
    <div class="info"><b>${esc(a.title)}</b><small class="meta">${esc(a.sub)}</small><div style="margin-top:6px">${(a.song?sbadge(a.score):badge(a.score))}</div></div></div>`).join("")}</div>
   <ol class="list">${rest.map((a,k)=>`<li><button class="row" data-id="${a.id}"><span class="pos">${k+4}</span><img src="${a.cover}" alt="" loading="lazy"><div><b>${esc(a.title)}</b><div class="meta">${esc(a.sub)}</div></div>${(a.song?sbadge(a.score):badge(a.score))}</button></li>`).join("")}</ol>`;
}
function renderPanel(){
  const rated=animes.filter(a=>a.score>0&&a.year);
  const years=[...new Set(rated.map(a=>a.year))].sort((a,b)=>b-a);
  if(!years.length){$("view").innerHTML='<div class="msg">Ainda não há animes com nota e ano.</div>';return}
  $("view").innerHTML='<p class="meta">Clique num ano ou numa temporada pra ver o top completo.</p>'+years.map(y=>{
    const ys=rated.filter(a=>a.year===y).sort((a,b)=>b.score-a.score);
    const cells=Object.keys(SEASONS).map(k=>{
      const l=ys.filter(a=>a.season===k);
      if(!l.length) return `<div class="cell empty"><span class="meta">${SEASONS[k]}</span><span class="meta">sem notas</span></div>`;
      const t=l[0];
      return `<button class="cell" data-go="${y}|${k}" ${bg(t.banner||t.cover)}><span class="sn"><span class="season-name">${SEASONS[k]}</span><span class="season-count">${l.length} com nota</span></span><b>${esc(t.title)}</b>${badge(t.score)}${l.slice(1,3).map(a=>`<span class="mini"><span>${esc(a.title)}</span><i>${a.score}</i></span>`).join("")}</button>`}).join("");
    return `<section class="yr"><h2><button class="yb" data-go="${y}|">${y}</button><span class="year-summary"><span class="year-count">${ys.length} com nota</span><span class="year-best-label">Melhor do ano</span><strong class="year-best-title">${esc(ys[0].title)}</strong><span class="year-best-score">${ys[0].score}</span></span></h2><div class="seasons">${cells}</div></section>`}).join("");
}
function renderTop(){
  const l=filtered(animes.filter(a=>a.score>0)).sort((a,b)=>b.score-a.score).slice(0,+$("limit").value);
  $("view").innerHTML=ranking(l.map(a=>({id:a.id,cover:a.cover,title:a.title,sub:when(a),score:a.score})));
}
async function renderHall(){
  $("view").innerHTML='<div class="msg">Carregando notas das músicas…</div>';
  try{
    const scores=await hubFB.getSongScores();
    Object.keys(SONG_SCORES).forEach(k=>delete SONG_SCORES[k]);Object.assign(SONG_SCORES,scores);
  }catch(e){
    $("view").innerHTML=`<div class="msg err">Não consegui carregar as notas das músicas (${esc(e.code||e.message)}).</div>`;return;
  }
  const keys=Object.keys(SONG_SCORES);
  if(!keys.length){$("view").innerHTML='<div class="msg">Ainda não há músicas com nota.</div>';return}
  const ids=[...new Set(keys.map(k=>Number(k.split(":")[0])).filter(Number.isFinite))],catalogs=new Map();
  let offlineCount=0,apiFailureCount=0;
  await Promise.all(ids.map(async id=>{
    let themes=[];
    try{themes=await fetchThemes(id)}catch(e){apiFailureCount++;/* usa o catálogo salvo abaixo */}
    if(!themes.length){
      try{
        const note=await hubFB.getAnimeNote(id);
        if(Array.isArray(note?.themeCatalog)&&note.themeCatalog.length){themes=note.themeCatalog;offlineCount++;}
      }catch(e){}
    }
    catalogs.set(id,new Map(themes.map(t=>[t.slug,t])));
  }));
  // Monta o ranking a partir das notas salvas, não da lista retornada pela API.
  // Assim, mesmo sem metadados, OP1/ED1 continuam aparecendo com sua nota.
  const items=[];
  keys.forEach(key=>{
    const cut=key.indexOf(":");if(cut<1)return;
    const id=Number(key.slice(0,cut)),slug=key.slice(cut+1),score=SONG_SCORES[key];
    if(!Number.isFinite(id)||score==null)return;
    const theme=catalogs.get(id)?.get(slug),a=byId(id);
    const inferredType=themeTypeFromSlug(slug);
    const type=theme?.type||inferredType;
    items.push({type,season:a?.season,year:a?.year,id,cover:a?.cover||"",title:theme?.title||(isProvisionalThemeSlug(slug)?`${inferredType} provisória`:slug),
      sub:`${theme?.artist?theme.artist+" · ":""}${a?.title||"Anime "+id}`,score,song:true});
  });
  const selected=items.filter(i=>i.type===$("type").value);
  const l=filtered(selected).sort((a,b)=>b.score-a.score).slice(0,+$("limit").value);
  const notice=apiFailureCount?`<p class="meta">AnimeThemes falhou ao responder para ${apiFailureCount} anime(s). O ranking está usando listas salvas e, quando necessário, os códigos OP/ED das suas avaliações.</p>`:(offlineCount?`<p class="meta">O ranking está usando listas de músicas salvas anteriormente para ${offlineCount} anime(s).</p>`:"");
  const genericCount=l.filter(i=>!catalogs.get(i.id)?.has(i.title) && i.title===i.title.toUpperCase() && /^(OP|ED)\d*$/i.test(i.title)).length;
  const genericNotice=genericCount?'<p class="meta">Algumas músicas aparecem pelo código (OP1, ED1 etc.) porque os títulos não estão disponíveis no momento.</p>':"";
  $("view").innerHTML=notice+genericNotice+ranking(l);
}

function renderThemeList(id,th,note,offline=false){
  const root=$( "themes" ),comments=note?.themeComments||{},themes=Array.isArray(th)?th:[];
  root.className="";
  const realSlugs=new Set(themes.map(t=>t.slug));
  const scoreSlugs=Object.keys(SONG_SCORES).filter(key=>key.startsWith(`${id}:`)).map(key=>key.slice(String(id).length+1));
  const savedOrphans=[...new Set([...Object.keys(comments),...scoreSlugs])].filter(slug=>!realSlugs.has(slug)&&!isProvisionalThemeSlug(slug));
  const orphanThemes=savedOrphans.map(slug=>({slug,type:themeTypeFromSlug(slug),title:slug,artist:"",video:"",orphan:true})).filter(t=>t.type);
  const provisionalKinds=new Set(offline&&!themes.length? ["OP","ED"]:[]);
  Object.entries(PROVISIONAL_THEME_SLUGS).forEach(([kind,slug])=>{
    if(Object.prototype.hasOwnProperty.call(comments,slug)||SONG_SCORES[`${id}:${slug}`]!=null)provisionalKinds.add(kind);
  });
  const provisionalItems=[...provisionalKinds].map(kind=>({slug:PROVISIONAL_THEME_SLUGS[kind],type:kind,title:`${kind} provisória`,artist:"Sem identificação",video:"",provisional:true}));
  const allThemes=[...themes,...orphanThemes,...provisionalItems];
  if(!allThemes.length){
    root.innerHTML=`<div class="msg">${offline?"AnimeThemes indisponível e ainda não há catálogo salvo. Você pode começar com avaliações provisórias de OP e ED.":"O AnimeThemes não tem OP/ED cadastrado pra esse anime."}</div>`;
    return;
  }
  const counters={OP:0,ED:0};
  const items=allThemes.map(t=>{const kind=themeTypeFromSlug(t.slug)||String(t.type||"").toUpperCase();if(kind==="OP"||kind==="ED")counters[kind]++;return {...t,kind,label:(kind==="OP"||kind==="ED")?`${kind}${counters[kind]}`:kind};});
  const selected=items.find(t=>t.kind==="OP")||items[0];
  const initialFilter=selected.kind==="ED"?"ED":"OP";
  const intro=offline?'<p class="meta theme-offline-note">AnimeThemes indisponível. Exibindo catálogo salvo e suas anotações.</p>':(provisionalItems.length?'<p class="meta theme-offline-note">A API voltou. Suas avaliações provisórias foram preservadas; associe-as às músicas correspondentes.</p>':(orphanThemes.length?'<p class="meta theme-offline-note">Algumas anotações antigas não estão no catálogo atual e continuam disponíveis.</p>':""));
  const makePlayer=t=>{
    const key=`${id}:${t.slug}`,sc=SONG_SCORES[key],comment=comments[t.slug]||"",kind=t.kind||themeTypeFromSlug(t.slug)||String(t.type||"").toUpperCase();
    let association="";
    if(t.provisional&&!offline&&themes.length&&fbUser)association=`<div class="theme-comment-wrap"><label for="associate-${kind}">Associar esta avaliação à música real</label><select id="associate-${kind}" class="theme-associate-select"><option value="">Selecione uma música…</option>${themes.filter(x=>(themeTypeFromSlug(x.slug)||String(x.type||"").toUpperCase())===kind).map(x=>`<option value="${esc(x.slug)}">${esc(x.title||x.slug)}${x.artist?` — ${esc(x.artist)}`:""}</option>`).join("")}</select><button class="theme-comment-save" data-associate-provisional="${kind}">Associar avaliação</button><span class="experience-status" id="associate-status-${kind}"></span></div>`;
    const publicComment=comment&&!fbUser?`<div class="theme-public-comment"><div class="meta">Minha impressão</div><p>${esc(comment)}</p></div>`:"";
    const editing=fbUser?`<div class="theme-rating-row"><label for="sc-${key}">Minha nota</label><input class="sc" id="sc-${key}" type="text" inputmode="decimal" placeholder="0 a 10" value="${sc??""}"><button class="cp" data-save="${key}">Salvar nota</button><code id="st-${key}"></code></div><div class="theme-comment-wrap"><label for="tc-${key}">Minha impressão sobre esta música</label><textarea class="theme-comment" id="tc-${key}" maxlength="5000" placeholder="O que achou da música, animação, cenas…">${esc(comment)}</textarea><button class="theme-comment-save" data-save-theme-comment="${esc(t.slug)}">Salvar comentário</button><span class="experience-status" id="tcs-${key}"></span></div>${association}`:"";
    return `<article class="theme theme-selected ${t.provisional?"theme-provisional":""}"><div class="theme-selected-head"><div><span class="theme-kind-badge ${kind.toLowerCase()}">${esc(t.label||kind)}</span><h3>${esc(t.title||t.slug)}</h3><div class="meta">${esc(t.artist||"Artista não identificado")}${t.eps?` · eps ${esc(t.eps)}`:""}</div></div>${sc!=null?sbadge(sc):""}</div>${t.video&&!offline&&!t.provisional?`<video controls preload="none" src="${esc(t.video)}"></video>`:'<div class="theme-video-placeholder">Vídeo indisponível para esta música</div>'}${publicComment}${editing}</article>`;
  };
  root.innerHTML=intro+`<div class="theme-library"><div class="theme-library-controls"><button type="button" class="theme-filter ${initialFilter==="OP"?"active":""}" data-theme-filter="OP" ${items.filter(t=>t.kind==="OP").length?"":"disabled"}>Openings <span>${items.filter(t=>t.kind==="OP").length}</span></button><button type="button" class="theme-filter ${initialFilter==="ED"?"active":""}" data-theme-filter="ED" ${items.filter(t=>t.kind==="ED").length?"":"disabled"}>Endings <span>${items.filter(t=>t.kind==="ED").length}</span></button></div><div class="theme-track-list" data-theme-track-list></div><div class="theme-active-player" data-active-theme>${makePlayer(selected)}</div></div>`;
  root.dataset.animeId=String(id);root.dataset.themeOffline=String(offline);
  root.dataset.themeSelected=selected.slug;
  root.dataset.themeFilter=initialFilter;
  root._themeItems=items;root._themeNote=note;root._themeComments=comments;root._themeOffline=offline;
  root._makeThemePlayer=makePlayer;
  renderThemeTrackButtons(root);
  // Bind category controls directly after every render. The modal replaces innerHTML,
  // so a one-time delegated handler can become detached from the recreated controls.
  root.querySelectorAll("[data-theme-filter]").forEach(button=>{
    button.addEventListener("click",()=>filterThemeList(root,button.dataset.themeFilter));
  });
}

function renderThemeTrackButtons(root){
  const list=root.querySelector("[data-theme-track-list]");
  if(!list)return;
  const kind=root.dataset.themeFilter||"OP",selectedSlug=root.dataset.themeSelected;
  const visible=(root._themeItems||[]).filter(t=>t.kind===kind);
  list.innerHTML=visible.map(t=>`<button type="button" class="theme-track ${t.slug===selectedSlug?"active":""}" data-select-theme="${esc(t.slug)}" data-theme-kind="${esc(t.kind)}"><span class="theme-track-code">${esc(t.label)}</span><span class="theme-track-info"><b>${esc(t.title||t.slug)}</b><small>${esc(t.artist||"Artista não identificado")}</small></span><span class="theme-track-score">${SONG_SCORES[`${root.dataset.animeId}:${t.slug}`]!=null?esc(SONG_SCORES[`${root.dataset.animeId}:${t.slug}`]):"—"}</span></button>`).join("");
  // Bind each rendered track explicitly so selecting one always updates both the
  // selected state and the active detail/player panel.
  list.querySelectorAll("[data-select-theme]").forEach(button=>{
    button.addEventListener("click",()=>selectThemeInList(root,button.dataset.selectTheme));
  });
}
function selectThemeInList(root,slug){
  const item=root._themeItems?.find(t=>t.slug===slug);if(!item)return;
  root.dataset.themeSelected=slug;
  if(item.kind!==root.dataset.themeFilter)root.dataset.themeFilter=item.kind;
  root.querySelectorAll("[data-theme-filter]").forEach(b=>b.classList.toggle("active",b.dataset.themeFilter===root.dataset.themeFilter));
  renderThemeTrackButtons(root);
  const player=root.querySelector("[data-active-theme]");if(player)player.innerHTML=root._makeThemePlayer(item);
}
function filterThemeList(root,kind){
  if(!["OP","ED"].includes(kind))return;
  const available=root._themeItems?.filter(t=>t.kind===kind)||[];
  if(!available.length)return;
  root.dataset.themeFilter=kind;
  root.querySelectorAll("[data-theme-filter]").forEach(b=>b.classList.toggle("active",b.dataset.themeFilter===kind));
  const current=root._themeItems?.find(t=>t.slug===root.dataset.themeSelected);
  if(!current||current.kind!==kind){root.dataset.themeSelected=available[0].slug;}
  renderThemeTrackButtons(root);
  const selected=root._themeItems?.find(t=>t.slug===root.dataset.themeSelected);
  const player=root.querySelector("[data-active-theme]");if(player&&selected)player.innerHTML=root._makeThemePlayer(selected);
}

function render(){
  if(tab==="ranking"){ $("filters").classList.add("hidden");$("type").classList.add("hidden");renderRanking();return; }
  if(tab==="stats"){ $("filters").classList.add("hidden");$("type").classList.add("hidden");renderStats();return; }
  $("filters").classList.toggle("hidden",tab==="now"||tab==="panel");
  $("type").classList.toggle("hidden",tab!=="hall");
  ({now:renderNow,panel:renderPanel,top:renderTop,hall:renderHall})[tab]();
}
function renderCatalog(items,user,sourceLabel){
  animes=items;
  const ys=[...new Set(animes.map(a=>a.year).filter(Boolean))].sort((a,b)=>b-a);
  $("year").innerHTML='<option value="">Todos os anos</option>'+ys.map(y=>`<option>${y}</option>`).join("");
  $("sub").textContent=`${sourceLabel} · ${animes.length} animes${fbUser?" · catálogo pessoal":""}.`;
  renderHero();render();
  maybeOpenInitialAnime();
}
const SYNC_INTERVAL_MS=24*60*60*1000;
