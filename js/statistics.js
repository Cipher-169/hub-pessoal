function statBars(entries,total){
  if(!entries.length)return '<p class="meta">Sem dados registrados.</p>';
  const max=Math.max(1,...entries.map(x=>x[1]));
  return entries.map(([label,value])=>`<div class="stat-line"><span>${esc(label)}</span><div class="stat-track"><i style="width:${Math.max(0,value/max*100)}%"></i></div><b>${statNum(value)} <span class="meta">(${statPct(value,total)})</span></b></div>`).join("");
}
function statList(entries,empty="Sem dados registrados."){
  return entries.length?`<ul class="stat-list">${entries.map(([label,value])=>`<li><span>${esc(label)}</span><b>${esc(value)}</b></li>`).join("")}</ul>`:`<p class="meta">${empty}</p>`;
}
async function renderStats(refresh=false){
  if(statsLoading)return;statsLoading=true;
  $("view").innerHTML='<div class="msg">Calculando suas estatísticas pessoais…</div>';
  try{
    const [notes,logs,scores]=await Promise.all([
      hubFB.getAllAnimeNotes({refresh}),hubFB.getAllEpisodeLogs({refresh}),hubFB.getSongScores()
    ]);
    const noteRows=Object.entries(notes||{}),noteValues=noteRows.map(([,v])=>v||{}),totalNotes=noteRows.length;
    const currentProvisionalRatings=noteRows.map(([id,n])=>({id,score:n?.provisionalScore})).filter(x=>x.score!==null&&x.score!==undefined&&Number.isFinite(Number(x.score)));
    const currentDefinitiveRatings=noteRows.map(([id,n])=>({id,score:n?.definitiveRating?.score})).filter(x=>x.score!==null&&x.score!==undefined&&Number.isFinite(Number(x.score)));
    const definitiveAverage=currentDefinitiveRatings.length?(currentDefinitiveRatings.reduce((sum,x)=>sum+Number(x.score),0)/currentDefinitiveRatings.length).toFixed(1).replace('.',','):'—';
    const definitiveRevisionCount=noteRows.reduce((sum,[,n])=>sum+(Array.isArray(n?.definitiveRatingHistory)?n.definitiveRatingHistory.length:0),0);
    const provisionalHistory=[];
    noteRows.forEach(([id,n])=>{
      (Array.isArray(n?.provisionalRatingHistory)?n.provisionalRatingHistory:[]).forEach(entry=>{
        const time=Date.parse(entry?.changedAt||"");
        provisionalHistory.push({id,anime:byId(Number(id))?.title||`Anime ${id}`,score:entry?.score??null,time,changedAt:entry?.changedAt||""});
      });
    });
    provisionalHistory.sort((a,b)=>(a.time||0)-(b.time||0));
    const provisionalMonthCounts=new Map();
    provisionalHistory.forEach(entry=>{if(Number.isFinite(entry.time)){const d=new Date(entry.time),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;provisionalMonthCounts.set(key,(provisionalMonthCounts.get(key)||0)+1);}});
    const provisionalMonthNames=new Intl.DateTimeFormat("pt-BR",{month:"short",year:"numeric"});
    const provisionalMonthEntries=[...provisionalMonthCounts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([key,count])=>{const [year,month]=key.split("-").map(Number);return [provisionalMonthNames.format(new Date(year,month-1,1)),count];});
    const provisionalRecent=[...provisionalHistory].sort((a,b)=>(b.time||0)-(a.time||0)).slice(0,8).map(entry=>[
      `${entry.anime} · ${entry.score===null?"nota removida":`${entry.score}/100`}`,
      Number.isFinite(entry.time)?new Date(entry.time).toLocaleDateString("pt-BR"):"Data indisponível"
    ]);
    let provisionalUps=0,provisionalDowns=0;
    const historyByAnime=new Map();
    provisionalHistory.forEach(entry=>{if(!historyByAnime.has(entry.id))historyByAnime.set(entry.id,[]);historyByAnime.get(entry.id).push(entry);});
    historyByAnime.forEach(entries=>{let previous=null;entries.forEach(entry=>{if(entry.score===null||!Number.isFinite(Number(entry.score))){previous=null;return;}const score=Number(entry.score);if(previous!==null){if(score>previous)provisionalUps++;else if(score<previous)provisionalDowns++;}previous=score;});});
    const provisionalAverage=currentProvisionalRatings.length?(currentProvisionalRatings.reduce((sum,x)=>sum+Number(x.score),0)/currentProvisionalRatings.length).toFixed(1).replace(".",","):"—";
    const languages={dub:0,sub:0,other:0,unknown:0};
    const platformCounts=new Map();let noPlatform=0,withPlatform=0,withViewingNotes=0,withThemeComments=0,totalThemeComments=0;
    noteValues.forEach(n=>{
      if(Object.prototype.hasOwnProperty.call(languages,n.language)&&n.language)languages[n.language]++;else languages.unknown++;
      const ps=Array.isArray(n.platforms)?n.platforms.filter(Boolean):[],customPlatform=String(n.otherPlatform||"").trim();
      const normalizedPlatforms=ps.map(p=>p==="Outra"&&customPlatform?customPlatform:p);
      if(customPlatform&&!normalizedPlatforms.includes(customPlatform))normalizedPlatforms.push(customPlatform);
      if(normalizedPlatforms.length){withPlatform++;normalizedPlatforms.forEach(p=>platformCounts.set(p,(platformCounts.get(p)||0)+1));}
      else noPlatform++;
      if(String(n.viewingNotes||"").trim())withViewingNotes++;
      const comments=Object.values(n.themeComments||{}).filter(v=>String(v||"").trim());
      if(comments.length)withThemeComments++;
      totalThemeComments+=comments.length;
    });
    const platforms=[...platformCounts.entries()].sort((a,b)=>b[1]-a[1]);
    const logRows=Array.isArray(logs)?logs:[],logAnimeCounts=new Map(),months=new Map();let datedLogs=0;
    logRows.forEach(l=>{
      const id=String(l.animeId??"");logAnimeCounts.set(id,(logAnimeCounts.get(id)||0)+1);
      const m=String(l.watchedAt||"").match(/^(\d{4})-(\d{2})/);
      if(m){const key=`${m[1]}-${m[2]}`;months.set(key,(months.get(key)||0)+1);datedLogs++;}
    });
    const monthNames=new Intl.DateTimeFormat("pt-BR",{month:"short",year:"numeric"});
    const monthEntries=[...months.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([k,v])=>{const [y,m]=k.split("-").map(Number);return [monthNames.format(new Date(y,m-1,1)),v]});
    const animeTitle=id=>byId(Number(id))?.title||`Anime ${id}`;
    const mostLogged=[...logAnimeCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n])=>[animeTitle(id),`${n} registro(s)`]);
    const catalogByAnime=new Map(noteRows.map(([id,n])=>[String(id),Array.isArray(n?.themeCatalog)?n.themeCatalog:[]]));
    const ratedSongs=[];
    Object.entries(scores||{}).forEach(([key,score])=>{
      const cut=key.indexOf(":");if(cut<1||!Number.isFinite(Number(score)))return;
      const id=key.slice(0,cut),slug=key.slice(cut+1),catalog=catalogByAnime.get(id)||[],theme=catalog.find(t=>t.slug===slug);
      const type=theme?.type||themeTypeFromSlug(slug);if(!["OP","ED"].includes(type))return;
      ratedSongs.push({id,slug,type,score:Number(score),title:theme?.title|| (isProvisionalThemeSlug(slug)?`${type} provisória`:slug),artist:theme?.artist||"",anime:animeTitle(id)});
    });
    const songStats={OP:ratedSongs.filter(x=>x.type==="OP"),ED:ratedSongs.filter(x=>x.type==="ED")};
    const avg=arr=>arr.length?(arr.reduce((sum,x)=>sum+x.score,0)/arr.length).toFixed(1).replace(".",","):"—";
    const artistCounts=new Map();ratedSongs.filter(x=>x.artist).forEach(x=>x.artist.split(/,\s*/).filter(Boolean).forEach(a=>artistCounts.set(a,(artistCounts.get(a)||0)+1)));
    const topArtists=[...artistCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([a,n])=>[a,`${n} música(s)`]);
    const topSongs=[...ratedSongs].sort((a,b)=>b.score-a.score).slice(0,5).map(x=>[`${x.title} · ${x.anime}`,`${x.score}/10`]);
    const scoreRanges=[["0–5,9",0],["6–6,9",0],["7–7,9",0],["8–8,9",0],["9–9,4",0],["9,5–10",0]];
    ratedSongs.forEach(x=>{const i=x.score<6?0:x.score<7?1:x.score<8?2:x.score<9?3:x.score<9.5?4:5;scoreRanges[i][1]++});
    const scoreTotal=ratedSongs.length;
    const diaryAnimeCount=logAnimeCounts.size,unknownDate=logRows.length-datedLogs;
    const html=`<div class="stats-head"><p>Indicadores calculados a partir das suas anotações, avaliações e diário. Não inclui estatísticas gerais do AniList.</p><button type="button" id="stats-refresh" ${statsLoading?"disabled":""}>Atualizar dados</button></div>
      <div class="stats-grid">
       <article class="stat-card"><small>Animes com dados pessoais</small><strong>${statNum(totalNotes)}</strong><span>Documentos de experiência/OP-ED</span></article>
       <article class="stat-card"><small>Registros no diário</small><strong>${statNum(logRows.length)}</strong><span>${statNum(diaryAnimeCount)} anime(s) com diário</span></article>
       <article class="stat-card"><small>Músicas avaliadas</small><strong>${statNum(scoreTotal)}</strong><span>${songStats.OP.length} OPs · ${songStats.ED.length} EDs</span></article>
       <article class="stat-card"><small>Comentários de OP/ED</small><strong>${statNum(totalThemeComments)}</strong><span>Em ${statNum(withThemeComments)} anime(s)</span></article>
      </div>
      <section class="stats-section"><h2>Avaliações consolidadas</h2><div class="stats-grid">
       <article class="stat-card"><small>Animes com nota definitiva</small><strong>${statNum(currentDefinitiveRatings.length)}</strong><span>Avaliação consolidada mais recente</span></article>
       <article class="stat-card"><small>Média das notas definitivas</small><strong>${definitiveAverage}</strong><span>Escala de 0 a 100</span></article>
       <article class="stat-card"><small>Definições e revisões</small><strong>${statNum(definitiveRevisionCount)}</strong><span>Registros preservados no histórico</span></article>
      </div><p class="stats-note">A média consolidada considera somente a nota definitiva atual de cada anime. Revisões anteriores permanecem armazenadas, mas não são contadas novamente nessa média.</p></section>
      <section class="stats-section"><h2>Evolução das notas provisórias</h2><div class="stats-grid">
       <article class="stat-card"><small>Animes com nota provisória</small><strong>${statNum(currentProvisionalRatings.length)}</strong><span>Notas numéricas atuais</span></article>
       <article class="stat-card"><small>Média das notas provisórias</small><strong>${provisionalAverage}</strong><span>Escala de 0 a 100</span></article>
       <article class="stat-card"><small>Alterações registradas</small><strong>${statNum(provisionalHistory.length)}</strong><span>Inclui remoções de nota</span></article>
       <article class="stat-card"><small>Variações</small><strong>+${statNum(provisionalUps)} / −${statNum(provisionalDowns)}</strong><span>Aumentos / reduções entre notas registradas</span></article>
      </div><div class="stats-columns">
       <div class="stats-panel"><h3>Alterações por mês</h3>${statBars(provisionalMonthEntries,provisionalHistory.length)}<p class="stats-note">Exibindo até os 12 meses mais recentes com alterações.</p></div>
       <div class="stats-panel"><h3>Alterações recentes</h3>${statList(provisionalRecent,"Ainda não há alterações de notas provisórias.")}</div>
      </div><p class="stats-note">O histórico registra somente quando a nota muda. A nota provisória permanece separada da avaliação definitiva do AniList.</p></section>
      <section class="stats-section"><h2>Como você assiste</h2><div class="stats-columns">
       <div class="stats-panel"><h3>Idioma de consumo</h3>${statBars([["Legendado",languages.sub],["Dublado",languages.dub],["Outro",languages.other]],totalNotes)}${languages.unknown?`<p class="stats-note">Sem idioma informado: ${languages.unknown} anime(s).</p>`:""}<p class="stats-note">Base: ${totalNotes} anime(s) com documento de dados pessoais.</p></div>
       <div class="stats-panel"><h3>Plataformas</h3>${statBars(platforms,totalNotes)}${noPlatform?`<p class="stats-note">Sem plataforma informada: ${noPlatform} anime(s).</p>`:""}<p class="stats-note">Um anime pode aparecer em mais de uma plataforma; por isso, a soma pode superar o total de animes.</p></div>
      </div></section>
      <section class="stats-section"><h2>Diário de episódios</h2><div class="stats-columns">
       <div class="stats-panel"><h3>Registros por mês</h3>${statBars(monthEntries,logRows.length)}<p class="stats-note">${datedLogs} registro(s) com data; ${unknownDate} sem data informada. Exibindo até os 12 meses mais recentes com atividade.</p></div>
       <div class="stats-panel"><h3>Animes com mais registros</h3>${statList(mostLogged,"Ainda não há registros no diário.")}</div>
      </div></section>
      <section class="stats-section"><h2>Openings e endings</h2><div class="stats-grid">
       <article class="stat-card"><small>Média das OPs</small><strong>${avg(songStats.OP)}<span style="display:inline;font:400 .85rem var(--sans)"> / 10</span></strong><span>${songStats.OP.length} avaliadas</span></article>
       <article class="stat-card"><small>Média das EDs</small><strong>${avg(songStats.ED)}<span style="display:inline;font:400 .85rem var(--sans)"> / 10</span></strong><span>${songStats.ED.length} avaliadas</span></article>
      </div><div class="stats-columns">
       <div class="stats-panel"><h3>Distribuição das notas</h3>${statBars(scoreRanges,scoreTotal)}</div>
       <div class="stats-panel"><h3>Artistas mais avaliados</h3>${statList(topArtists,"Não há artistas identificados nos catálogos salvos.")}<h3 style="margin-top:22px">Músicas mais bem avaliadas</h3>${statList(topSongs,"Ainda não há músicas avaliadas.")}</div>
      </div><p class="stats-note">Músicas provisórias ou sem catálogo salvo entram nas médias e na distribuição quando o tipo OP/ED pode ser identificado, mas não entram no ranking de artistas quando não há artista registrado.</p></section>
      <section class="stats-section"><h2>Suas anotações</h2><div class="stats-grid">
       <article class="stat-card"><small>Experiência preenchida</small><strong>${withViewingNotes}</strong><span>Anime(s) com texto em “Outras informações”</span></article>
       <article class="stat-card"><small>Idioma informado</small><strong>${totalNotes-languages.unknown}</strong><span>Anime(s) com idioma registrado</span></article>
       <article class="stat-card"><small>Plataforma informada</small><strong>${withPlatform}</strong><span>Anime(s) com ao menos uma opção marcada</span></article>
       <article class="stat-card"><small>Comentários OP/ED</small><strong>${totalThemeComments}</strong><span>${withThemeComments} anime(s) com comentários</span></article>
      </div></section>`;
    $("view").innerHTML=html;
    $("stats-refresh")?.addEventListener("click",()=>renderStats(true));
  }catch(e){$("view").innerHTML=`<div class="msg err">Não consegui calcular as estatísticas (${esc(e.code||e.message)}). Confira sua conexão e se as regras do Firestore permitem leitura pública.</div>`;}
  finally{statsLoading=false;}
}
