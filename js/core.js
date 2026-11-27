/* =====================================================================
   CONTROLE DE VERSÃO:
   Sempre que modificar este arquivo incremente HUB_VERSION em +1.
   ===================================================================== */
const HUB_VERSION = "24.5";
window.HUB_VERSION = HUB_VERSION;
document.getElementById("project-version").textContent = `v${HUB_VERSION}`;

/* ============ CONFIGURAÇÃO ============ */
const OWNER_ANILIST_USERNAME = "Clpher";
const OWNER_UID = "X569uLFYFgcX6i9mbEVsylUX7Li1";
window.HUB_OWNER_UID = OWNER_UID;
/* Notas das músicas (0-100). Chave: "IDdoAnimeNoAniList:OP1" (ou ED1, OP2...).
   Use o botão "Copiar linha" na janela do anime e cole aqui. */
const SONG_SCORES = {
  // "ID:OP1": 95,
};
/* ======================================= */

const QUERY = `query($u:String){MediaListCollection(userName:$u,type:ANIME){lists{entries{
 status progress score(format:POINT_100)
 media{id siteUrl season seasonYear episodes status bannerImage coverImage{extraLarge large} title{romaji english}}}}}}`;
const TIERS=[[100,"Masterpiece","#f2c46d"],[95,"Almost Perfect","#ff7a4d"],[90,"Excellent","#f5a63c"],[85,"Very Good","#7ac36a"],
 [80,"Good","#4aa8e0"],[75,"Decent","#98a2bd"],[70,"Average","#a89fb5"],[60,"Bad","#d98a3a"],[0,"Very Bad","#c0453f"]];
const tier=s=>TIERS.find(t=>s>=t[0]);
const badge=s=>{const t=tier(s);return `<span class="tier" style="--c:${t[2]}">${s}<small>${t[1]}</small></span>`};
const sbadge=s=>{const t=tier(s*10);return `<span class="tier" style="--c:${t[2]}">${s}<small>/10</small></span>`};
const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&amp;",">":"&gt;",'"':"&quot;"}[c]));
const $=id=>document.getElementById(id);
const SEASONS={WINTER:"Winter",SPRING:"Spring",SUMMER:"Summer",FALL:"Fall"};
const when=a=>[SEASONS[a.season],a.year].filter(Boolean).join(" ");
const bg=u=>u?`style="background-image:url('${u}')"`:"";

let animes=[],tab="now",fbUser=null,fbErr=null,loadingCatalog=false,statsLoading=false,rankingLoading=false;
const ANILIST_CALLBACK_CODES=new Set(["connected","denied","invalid_callback","invalid_state","token_error","verification_error","configuration_error"]);
const anilistCallback=(()=>{const params=new URLSearchParams(location.search),code=params.get("anilist");return ANILIST_CALLBACK_CODES.has(code)?{code,account:params.get("account")||""}:null})();
let anilistCallbackHandled=false,anilistStatus={kind:"unauthenticated"},anilistBusy=false;
const byId=id=>animes.find(a=>a.id===id);
let initialAnimeUrlHandled=false;
const getAnimeUrlId=()=>{
  const value=new URLSearchParams(location.search).get("anime");
  return value&&/^\d+$/.test(value)&&Number(value)>0?Number(value):null;
};
function updateAnimeUrl(id,{method="replaceState",state={}}={}){
  const url=new URL(location.href);
  if(id==null)url.searchParams.delete("anime");else url.searchParams.set("anime",String(id));
  history[method]({...history.state,...state},"",url);
}
function maybeOpenInitialAnime(){
  if(initialAnimeUrlHandled||!animes.length)return;
  const id=getAnimeUrlId();if(id==null)return;
  initialAnimeUrlHandled=true;
  updateAnimeUrl(id,{state:{hubAnimeId:id,hubAnimeFullscreen:true,hubAnimeDirect:true,hubAnimeFromCompact:false}});
  openAnime(id,{fullscreen:true,fromUrl:true});
}
const themeCache=new Map();
const PROVISIONAL_THEME_SLUGS={OP:"provisional_op",ED:"provisional_ed"};
const themeTypeFromSlug=slug=>{const value=String(slug||"");if(value===PROVISIONAL_THEME_SLUGS.OP)return "OP";if(value===PROVISIONAL_THEME_SLUGS.ED)return "ED";return value.toUpperCase().match(/^(OP|ED)/)?.[1]||""};
const isProvisionalThemeSlug=slug=>Object.values(PROVISIONAL_THEME_SLUGS).includes(slug);

async function fetchList(user){
  const r=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:QUERY,variables:{u:user}})});
  const j=await r.json(); if(j.errors) throw new Error(j.errors[0].message);
  const seen=new Map();
  j.data.MediaListCollection.lists.forEach(l=>l.entries.forEach(e=>{if(!seen.has(e.media.id))seen.set(e.media.id,e)}));
  return [...seen.values()].map(e=>({id:e.media.id,title:e.media.title.english||e.media.title.romaji,
    cover:e.media.coverImage.extraLarge||e.media.coverImage.large,banner:e.media.bannerImage,url:e.media.siteUrl,
    season:e.media.season,year:e.media.seasonYear,eps:e.media.episodes,airing:e.media.status,
    status:e.status,progress:e.progress,score:e.score}));
}

async function fetchThemes(id){
  if(themeCache.has(id)) return themeCache.get(id);
  const animeId=Number(id);
  if(!Number.isSafeInteger(animeId)||animeId<=0)throw new Error("AniList ID inválido");

  const query=`{
    findAnimeByExternalSite(site: ANILIST, id: [${animeId}]) {
      id
      animethemes {
        type
        sequence
        song {
          title { romaji native }
          performances {
            alias
            memberAlias
            artist { name { main native } }
            member { name { main native } }
          }
        }
        animethemeentries {
          episodes
          notes
          version
          videos { nodes { link resolution tags nc lyrics } }
        }
      }
    }
  }`;
  const r=await fetch("https://graphql.animethemes.moe/",{
    method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query})
  });
  if(!r.ok)throw new Error(`AnimeThemes GraphQL HTTP ${r.status}`);
  const j=await r.json();
  if(j?.errors?.length)throw new Error(`AnimeThemes GraphQL: ${j.errors[0].message}`);
  const anime=j?.data?.findAnimeByExternalSite?.[0];
  if(!anime||!Array.isArray(anime.animethemes))throw new Error("Resposta inválida ou anime não encontrado no AnimeThemes");

  const cleanText=value=>String(value||"").trim();
  const getTitle=title=>cleanText(title?.romaji)||cleanText(title?.native)||"(sem título)";
  const getArtist=performances=>{
    const names=[];
    for(const p of performances||[]){
      const name=cleanText(p.alias)||cleanText(p.memberAlias)||cleanText(p.artist?.name?.main)||cleanText(p.artist?.name?.native)||cleanText(p.member?.name?.main)||cleanText(p.member?.name?.native);
      if(name&&!names.includes(name))names.push(name);
    }
    return names.join(", ");
  };
  const videoScore=v=>{
    if(!v?.link)return -Infinity;
    let score=Number(v.resolution)||0;
    if(v.nc===false)score+=100000;
    else if(v.nc===true)score-=100000;
    if(v.lyrics===false)score+=10000;
    else if(v.lyrics===true)score-=10000;
    const tags=Array.isArray(v.tags)?v.tags.join(" ").toLowerCase():String(v.tags||"").toLowerCase();
    if(tags.includes("creditless"))score-=50000;
    if(tags.includes("lyrics"))score-=5000;
    return score;
  };
  const th=[];
  for(const t of anime.animethemes){
    const type=cleanText(t.type).toUpperCase();
    const sequence=Number(t.sequence);
    if(!["OP","ED"].includes(type)||!Number.isInteger(sequence)||sequence<1)continue;
    const slug=`${type}${sequence}`;
    const entries=(t.animethemeentries||[]).map(entry=>{
      const videos=(entry.videos?.nodes||[]).filter(v=>v?.link).sort((a,b)=>videoScore(b)-videoScore(a));
      return {entry,video:videos[0]||null,score:videos[0]?videoScore(videos[0]):-Infinity};
    }).filter(x=>x.video).sort((a,b)=>b.score-a.score);
    const chosen=entries[0];
    if(!chosen)continue;
    const item={slug,type,title:getTitle(t.song?.title),artist:getArtist(t.song?.performances),eps:cleanText(chosen.entry.episodes),video:chosen.video.link};
    const existing=th.findIndex(x=>x.slug===slug);
    if(existing<0)th.push(item);
    else if(!th[existing].video&&item.video)th[existing]=item;
  }
  th.sort((a,b)=>a.type===b.type?Number(a.slug.slice(2))-Number(b.slug.slice(2)):a.type==="OP"?-1:1);
  // Não guardar respostas vazias: uma falha/retorno transitório não deve virar cache permanente nesta sessão.
  if(th.length)themeCache.set(id,th);
  return th;
}
