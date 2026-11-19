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
      return `<button class="cell" data-go="${y}|${k}" ${bg(t.banner||t.cover)}><span class="sn">${SEASONS[k]}<em>${l.length} com nota</em></span><b>${esc(t.title)}</b>${badge(t.score)}${l.slice(1,3).map(a=>`<span class="mini"><span>${esc(a.title)}</span><i>${a.score}</i></span>`).join("")}</button>`}).join("");
    return `<section class="yr"><h2><button class="yb" data-go="${y}|">${y}</button><span class="meta">${ys.length} com nota · melhor do ano: ${esc(ys[0].title)} (${ys[0].score})</span></h2><div class="seasons">${cells}</div></section>`}).join("");
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
  const root=$("themes"),comments=note?.themeComments||{},themes=Array.isArray(th)?th:[];
  root.className="";
  const realSlugs=new Set(themes.map(t=>t.slug));
  const scoreSlugs=Object.keys(SONG_SCORES).filter(key=>key.startsWith(`${id}:`)).map(key=>key.slice(String(id).length+1));
  const savedOrphans=[...new Set([...Object.keys(comments),...scoreSlugs])].filter(slug=>!realSlugs.has(slug)&&!isProvisionalThemeSlug(slug));
  const orphanTypes=new Set(savedOrphans.map(themeTypeFromSlug).filter(Boolean));
  const provisionalKinds=offline&&!themes.length?["OP","ED"].filter(kind=>!orphanTypes.has(kind)):[];
  const hasSavedProvisional=Object.entries(PROVISIONAL_THEME_SLUGS).some(([kind,slug])=>
    Object.prototype.hasOwnProperty.call(comments,slug)||SONG_SCORES[`${id}:${slug}`]!=null);
  const provisionalKindsToRender=[...new Set([...provisionalKinds,...(hasSavedProvisional?Object.keys(PROVISIONAL_THEME_SLUGS).filter(kind=>Object.prototype.hasOwnProperty.call(comments,PROVISIONAL_THEME_SLUGS[kind])||SONG_SCORES[`${id}:${PROVISIONAL_THEME_SLUGS[kind]}`]!=null):[])])];
  const renderCard=(t,{provisional=false,orphan=false,label=""}={})=>{
    const key=`${id}:${t.slug}`,sc=SONG_SCORES[key],comment=comments[t.slug]||"";
    const title=provisional?`${t.type} provisória`:t.title||t.slug;
    const meta=provisional?"Cadastro temporário · sem identificação da música":(orphan?"Informações da música indisponíveis":"");
    let association="";
    if(provisional&&!offline&&themes.length&&fbUser){
      association=`<div class="theme-comment-wrap"><label for="associate-${t.type}">Quando a API voltou, escolha a música correspondente para transferir sua avaliação:</label><select id="associate-${t.type}" style="width:100%;background:#0c1220;border:1px solid var(--line);border-radius:9px;padding:9px;color:var(--text)"><option value="">Selecione uma música…</option>${themes.filter(x=>x.type===t.type).map(x=>`<option value="${esc(x.slug)}">${esc(x.title||x.slug)}${x.artist?` — ${esc(x.artist)}`:""}</option>`).join("")}</select><button class="theme-comment-save" data-associate-provisional="${t.type}">Associar avaliação</button><span class="experience-status" id="associate-status-${t.type}"></span></div>`;
    }
    const kind=themeTypeFromSlug(t.slug)||String(t.type||"").toUpperCase();
    const kindBadge=!provisional&&label?`<span class="theme-kind-badge ${kind.toLowerCase()}">${esc(label)}</span>`:"";
    return `<div class="theme ${provisional?"theme-provisional":""}"><b>${esc(title)}</b>${kindBadge} ${!provisional&&t.title?`<span class="meta">${esc(t.artist||"")}${t.eps?" · eps "+esc(t.eps):""}</span>`:`<span class="meta">${esc(meta)}</span>`} ${sc!=null?sbadge(sc):""}
      ${t.video&&!offline?`<video controls preload="none" src="${esc(t.video)}"></video>`:""}
      ${fbUser?`<div style="margin-top:8px"><label class="meta" for="sc-${key}">Nota (opcional)</label><input class="sc" id="sc-${key}" type="text" inputmode="decimal" placeholder="0 a 10" value="${sc??""}"> <button class="cp" data-save="${key}">Salvar nota</button> <code id="st-${key}"></code></div><div class="theme-comment-wrap"><label for="tc-${key}">Minha impressão sobre esta música (opcional)</label><textarea class="theme-comment" id="tc-${key}" maxlength="5000" placeholder="O que achou da música, animação, cenas…">${esc(comment)}</textarea><button class="theme-comment-save" data-save-theme-comment="${esc(t.slug)}">Salvar comentário</button> <span class="experience-status" id="tcs-${key}"></span></div>${association}`:(comment?`<div class="theme-comment-wrap public-theme-comment"><span class="meta">Minha impressão</span><p style="white-space:pre-wrap;margin:8px 0 0">${esc(comment)}</p></div>`:"")}</div>`;
  };
  const typeCounters={OP:0,ED:0};
  const cards=themes.map(t=>{
    const kind=themeTypeFromSlug(t.slug)||String(t.type||"").toUpperCase();
    if(kind==="OP"||kind==="ED")typeCounters[kind]++;
    const label=(kind==="OP"||kind==="ED")?`${kind}${typeCounters[kind]}`:"";
    return renderCard(t,{label});
  });
  // Comentários de músicas antigas que não estão no catálogo atual continuam acessíveis.
  savedOrphans.forEach(slug=>{
    const kind=themeTypeFromSlug(slug);if(!kind)return;
    cards.push(renderCard({slug,type:kind,title:slug,artist:"",video:""},{orphan:true,label:slug}));
  });
  provisionalKindsToRender.forEach(kind=>{
    const slug=PROVISIONAL_THEME_SLUGS[kind];
    cards.push(renderCard({slug,type:kind,title:`${kind} provisória`,artist:"",video:""},{provisional:true}));
  });
  if(!cards.length){
    root.innerHTML=`<div class="msg">${offline?"AnimeThemes indisponível e ainda não há catálogo salvo. Você pode começar com uma avaliação provisória de OP e ED.":"O AnimeThemes não tem OP/ED cadastrado pra esse anime."}</div>`;
    if(offline){
      // As duas entradas temporárias aparecem apenas durante a indisponibilidade, quando não há catálogo salvo.
      root.innerHTML='<p class="meta">AnimeThemes indisponível. Você pode registrar uma avaliação provisória de cada tipo; quando a API voltar, poderá associá-las às músicas reais.</p>'+["OP","ED"].map(kind=>renderCard({slug:PROVISIONAL_THEME_SLUGS[kind],type:kind,title:kind,artist:"",video:""},{provisional:true})).join("");
    }
    return;
  }
  const intro=offline?'<p class="meta">AnimeThemes indisponível. Exibindo o catálogo salvo e suas anotações; os vídeos voltarão quando a API estiver disponível.</p>':(provisionalKindsToRender.length?'<p class="meta">A API voltou. Suas avaliações provisórias foram preservadas; associe cada uma à música correta para transferi-las.</p>':(savedOrphans.length?'<p class="meta">Algumas anotações antigas não foram encontradas no catálogo atual e continuam disponíveis abaixo.</p>':""));
  root.innerHTML=intro+cards.join("");
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
