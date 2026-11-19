async function renderRanking(){
  if(rankingLoading)return;rankingLoading=true;
  $("view").innerHTML='<div class="msg">Montando seu ranking musical…</div>';
  try{
    const [notes,scores]=await Promise.all([hubFB.getAllAnimeNotes(),hubFB.getSongScores()]);
    const catalogByAnime=new Map(Object.entries(notes||{}).map(([id,n])=>[String(id),Array.isArray(n?.themeCatalog)?n.themeCatalog:[]]));
    const tracks=[];
    Object.entries(scores||{}).forEach(([key,rawScore])=>{
      const cut=key.indexOf(":");if(cut<1||!Number.isFinite(Number(rawScore)))return;
      const id=key.slice(0,cut),slug=key.slice(cut+1);
      if(isProvisionalThemeSlug(slug))return;
      const theme=(catalogByAnime.get(id)||[]).find(t=>t.slug===slug);
      if(!theme||!['OP','ED'].includes(String(theme.type||themeTypeFromSlug(slug)).toUpperCase())||!String(theme.title||'').trim())return;
      const anime=byId(Number(id));
      const rawVideo=String(theme.video||'').trim(),video=/^https?:\/\//i.test(rawVideo)?rawVideo:'';
      tracks.push({id,slug,type:String(theme.type||themeTypeFromSlug(slug)).toUpperCase(),score:Number(rawScore),title:String(theme.title).trim(),artist:String(theme.artist||'').trim(),anime:anime?.title||`Anime ${id}`,video});
    });
    tracks.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'pt-BR'));
    const opCount=tracks.filter(t=>t.type==='OP').length,edCount=tracks.filter(t=>t.type==='ED').length;
    const average=list=>list.length?(list.reduce((sum,t)=>sum+t.score,0)/list.length).toFixed(2).replace('.',','):'—';
    const renderList=(type='ALL',query='')=>{
      const q=query.trim().toLocaleLowerCase('pt-BR');
      const filtered=tracks.filter(t=>(type==='ALL'||t.type===type)&&(!q||[t.title,t.artist,t.anime].some(v=>v.toLocaleLowerCase('pt-BR').includes(q))));
      if(!filtered.length)return '<div class="msg">Nenhuma música encontrada com esses filtros.</div>';
      return `<ol class="ranking-list">${filtered.map((t,i)=>`<li class="ranking-item"><span class="ranking-position">${i+1}</span><div class="ranking-main"><strong>${esc(t.title)} <span class="meta">· ${t.score.toLocaleString('pt-BR')}/10</span></strong><small>${esc(t.artist||'Artista não identificado')} · ${t.type} · ${esc(t.anime)}</small></div><div class="ranking-links"><button type="button" data-ranking-anime="${esc(t.id)}">Ver anime</button>${t.video?`<a href="${esc(t.video)}" target="_blank" rel="noopener noreferrer">Assistir ↗</a>`:''}</div></li>`).join('')}</ol>`;
    };
    const html=`<div class="stats-head"><p>Suas músicas avaliadas, ordenadas da maior para a menor nota. Empates ficam em sequência.</p><button type="button" id="ranking-refresh">Atualizar dados</button></div>
      <div class="ranking-summary"><article class="stat-card"><small>OPs no ranking</small><strong>${opCount}</strong><span>Média: ${average(tracks.filter(t=>t.type==='OP'))}/10</span></article><article class="stat-card"><small>EDs no ranking</small><strong>${edCount}</strong><span>Média: ${average(tracks.filter(t=>t.type==='ED'))}/10</span></article><article class="stat-card"><small>Total de músicas</small><strong>${tracks.length}</strong><span>Somente músicas reais identificadas</span></article></div>
      <div class="ranking-tools"><select id="ranking-type" aria-label="Tipo de música"><option value="ALL">OPs e EDs</option><option value="OP">Somente OPs</option><option value="ED">Somente EDs</option></select><input id="ranking-search" type="search" placeholder="Buscar música, artista ou anime…" aria-label="Buscar no ranking"></div>
      <div id="ranking-results">${renderList()}</div>
      <p class="stats-note">Avaliações provisórias ou músicas sem catálogo identificado não aparecem aqui. Elas continuam salvas e podem ser associadas quando o AnimeThemes estiver disponível.</p>`;
    $("view").innerHTML=html;
    const update=()=>{$("ranking-results").innerHTML=renderList($("ranking-type").value,$("ranking-search").value);};
    $("ranking-type").addEventListener('change',update);$("ranking-search").addEventListener('input',update);
    $("ranking-refresh").addEventListener('click',async()=>{await hubFB.getAllAnimeNotes({refresh:true});await cacheDelete('songScores');rankingLoading=false;await renderRanking();});
    $("ranking-results").addEventListener('click',e=>{const b=e.target.closest('[data-ranking-anime]');if(b)openAnime(Number(b.dataset.rankingAnime));});
  }catch(e){$("view").innerHTML=`<div class="msg err">Não consegui montar o ranking (${esc(e.code||e.message)}). Confira sua conexão e se as regras do Firestore permitem leitura pública.</div>`;}
  finally{rankingLoading=false;}
}
