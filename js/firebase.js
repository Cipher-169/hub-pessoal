import {initializeApp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,onSnapshot,doc,setDoc,deleteDoc,deleteField,arrayUnion,serverTimestamp,Timestamp,addDoc,getDocs,getDoc,getDocFromServer,getDocsFromCache,getDocsFromServer,getDocFromCache,query,where,updateDoc,writeBatch,runTransaction} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const app=initializeApp({
  apiKey:"AIzaSyCgHMZV_wIFOV4QuJi3bBRbu_iOXSJ1ahY",
  authDomain:"hub-pesoal.firebaseapp.com",
  projectId:"hub-pesoal",
  storageBucket:"hub-pesoal.firebasestorage.app",
  messagingSenderId:"335710840559",
  appId:"1:335710840559:web:1d99e078383a9819a99d1a"
});
const auth=getAuth(app);
const OWNER_UID=window.HUB_OWNER_UID;
const ANILIST_WORKER_URL="https://hub-animes-api.world-testaocenter790.workers.dev";
async function anilistWorkerRequest(path,method="GET"){
  requireOwner();
  const user=auth.currentUser;
  if(!user)throw new Error("Autenticação Firebase indisponível.");
  const idToken=await user.getIdToken();
  const response=await fetch(`${ANILIST_WORKER_URL}${path}`,{
    method,
    headers:{Authorization:`Bearer ${idToken}`,Accept:"application/json"},
    cache:"no-store",
    credentials:"omit"
  });
  const raw=await response.text();let payload=null;
  if(raw){try{payload=JSON.parse(raw)}catch(err){payload=null}}
  if(!response.ok)throw new Error(`Worker HTTP ${response.status}`);
  if(payload&&payload.ok===false)throw new Error("O Worker recusou a operação.");
  return payload;
}
/* O token AniList permanece exclusivamente no Worker; o frontend usa apenas o ID Token temporário do Firebase. */
/* O cache persistente do Firestore usa IndexedDB; este cache de aplicação acrescenta TTL por tipo de dado. */
const db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
const emit=(n,d)=>window.dispatchEvent(new CustomEvent(n,{detail:d}));
const CACHE_DB_NAME="hub-animes-public-cache-v1",CACHE_STORE="entries",PUBLIC_CACHE_TTL=6*60*60*1000;
let cacheDbPromise;
function openCacheDb(){
  if(cacheDbPromise)return cacheDbPromise;
  cacheDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(CACHE_DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(CACHE_STORE))req.result.createObjectStore(CACHE_STORE)};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return cacheDbPromise;
}
async function cacheGet(key){try{const d=await openCacheDb();return await new Promise((resolve,reject)=>{const r=d.transaction(CACHE_STORE,"readonly").objectStore(CACHE_STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}catch(e){return null}}
async function cacheSet(key,data){try{const d=await openCacheDb();await new Promise((resolve,reject)=>{const tx=d.transaction(CACHE_STORE,"readwrite");tx.objectStore(CACHE_STORE).put({data,savedAt:Date.now()},key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn("Cache local indisponível",e)}}
async function cacheDelete(key){try{const d=await openCacheDb();await new Promise((resolve,reject)=>{const tx=d.transaction(CACHE_STORE,"readwrite");tx.objectStore(CACHE_STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){}}
const isOwner=()=>auth.currentUser?.uid===OWNER_UID;
const requireOwner=()=>{if(!isOwner())throw new Error("Somente a conta proprietária pode editar este Hub.")};
const notePath=animeId=>doc(db,"users",OWNER_UID,"animeNotes",String(animeId));
const logsPath=()=>collection(db,"users",OWNER_UID,"episodeLogs");
const noteCacheKey=id=>`note:${id}`,logsCacheKey=id=>`logs:${id}`;
async function freshOrCached(key,fetcher){
  const cached=await cacheGet(key);
  if(cached&&Date.now()-cached.savedAt<PUBLIC_CACHE_TTL)return cached.data;
  try{const fresh=await fetcher();await cacheSet(key,fresh);return fresh}
  catch(err){if(cached)return cached.data;throw err}
}

window.hubFB={
  getAniListStatus:async()=>{
    const result=await anilistWorkerRequest("/auth/status","GET");
    if(!result||typeof result!=="object"||typeof result.connected!=="boolean")throw new Error("Resposta de status inválida.");
    return result;
  },
  beginAniListOAuth:async()=>{
    const result=await anilistWorkerRequest("/auth/anilist","POST");
    if(!result||result.ok!==true||typeof result.authorizationUrl!=="string")throw new Error("O Worker não forneceu uma URL de autorização válida.");
    const target=new URL(result.authorizationUrl);
    if(target.protocol!=="https:"||!(["anilist.co","www.anilist.co"].includes(target.hostname)))throw new Error("URL de autorização do AniList não permitida.");
    return target.href;
  },
  disconnectAniList:async()=>{
    await anilistWorkerRequest("/auth/disconnect","POST");
    return true;
  },
  login:async()=>{
    if(auth.currentUser&&!isOwner())await signOut(auth);
    const result=await signInWithPopup(auth,new GoogleAuthProvider());
    if(result.user.uid!==OWNER_UID){await signOut(auth);throw new Error("Esta conta Google não é a proprietária do Hub.")}
    return result;
  },
  logout:()=>signOut(auth),
  getAniListCache:async username=>{const entry=await cacheGet(`anilist:${username.toLowerCase()}`);return entry?{items:entry.data,savedAt:entry.savedAt}:null},
  saveAniListCache:(username,items)=>cacheSet(`anilist:${username.toLowerCase()}`,items),
  getSongScores:()=>freshOrCached("songScores",async()=>{const snap=await getDocs(collection(db,"songScores")),out={};snap.forEach(d=>out[d.id]=d.data().score);return out}),
  getSongScoresForAnime:async(animeId,slugs,{refresh=false}={})=>{
    const cacheKey=`songScoresAnime:${animeId}`,cached=await cacheGet(cacheKey),now=Date.now();
    const cacheValid=cached&&now-cached.savedAt<PUBLIC_CACHE_TTL;
    const out=!refresh&&cacheValid?{...cached.data}:{};
    const missing=slugs.filter(slug=>!Object.prototype.hasOwnProperty.call(out,`${animeId}:${slug}`));
    if(!refresh&&!missing.length&&cacheValid)return out;
    const requested=refresh?slugs:(cacheValid?missing:slugs);
    await Promise.all(requested.map(async slug=>{const key=`${animeId}:${slug}`,ref=doc(db,"songScores",key),snap=refresh?await getDocFromServer(ref):await getDoc(ref);if(snap.exists())out[key]=snap.data().score;else out[key]=null}));
    await cacheSet(cacheKey,out);return out;
  },
  save:async(key,n)=>{requireOwner();await setDoc(doc(db,"songScores",key),{score:n,updatedAt:serverTimestamp()},{merge:true});const scores=(await cacheGet("songScores"))?.data||{};scores[key]=n;await cacheSet("songScores",scores);const animeId=key.split(":")[0],byAnime=(await cacheGet(`songScoresAnime:${animeId}`))?.data||{};byAnime[key]=n;await cacheSet(`songScoresAnime:${animeId}`,byAnime)},
  remove:async key=>{requireOwner();await deleteDoc(doc(db,"songScores",key));const scores=(await cacheGet("songScores"))?.data||{};delete scores[key];await cacheSet("songScores",scores);const animeId=key.split(":")[0],byAnime=(await cacheGet(`songScoresAnime:${animeId}`))?.data||{};delete byAnime[key];await cacheSet(`songScoresAnime:${animeId}`,byAnime)},
  getAnimeCatalog:async username=>{
    if(!auth.currentUser)throw new Error("Faça login para consultar seu catálogo salvo.");
    const ref=collection(db,"users",auth.currentUser.uid,"animeCatalog");
    const matches=snap=>snap.docs.filter(d=>Number.isFinite(Number(d.id))).map(d=>({id:Number(d.id),...d.data()})).filter(a=>(a.anilistUser||"").toLowerCase()===username.toLowerCase()&&a.inList!==false);
    let snap,source="server";
    try{snap=await getDocsFromServer(ref)}
    catch(serverError){source="cache";try{snap=await getDocsFromCache(ref)}catch(cacheError){return {items:[],source:"empty",error:serverError,lastSyncedAt:null}}}
    let meta=null;const metaRef=doc(db,"users",auth.currentUser.uid,"animeCatalog","_meta");
    try{const m=source==="server"?await getDoc(metaRef):await getDocFromCache(metaRef);if(m.exists()&&(m.data().anilistUser||"").toLowerCase()===username.toLowerCase())meta=m.data()}
    catch(e){try{const m=await getDocFromCache(metaRef);if(m.exists()&&(m.data().anilistUser||"").toLowerCase()===username.toLowerCase())meta=m.data()}catch(ignore){}}
    return {items:matches(snap),source,lastSyncedAt:meta?.lastSyncedAt||null};
  },
  saveAnimeCatalog:async(username,items)=>{
    if(!auth.currentUser)throw new Error("Faça login para salvar seu catálogo.");
    const uid=auth.currentUser.uid,ref=collection(db,"users",uid,"animeCatalog");
    let existing=[];try{const snap=await getDocsFromServer(ref);existing=snap.docs.filter(d=>d.id!=="_meta"&&(d.data().anilistUser||"").toLowerCase()===username.toLowerCase());}catch(e){}
    const activeIds=new Set(items.map(a=>String(a.id)));
    const chunks=(arr,size)=>{const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;};
    // Primeiro grava a lista atual. Assim, uma falha posterior não apaga o catálogo válido.
    for(const group of chunks(items,400)){
      const batch=writeBatch(db);
      group.forEach(a=>batch.set(doc(db,"users",uid,"animeCatalog",String(a.id)),{
        ...a,anilistUser:username,inList:true,syncedAt:serverTimestamp()
      },{merge:true}));
      await batch.commit();
    }
    // Itens removidos da lista do AniList deixam de aparecer, mas seus metadados não são apagados.
    for(const group of chunks(existing.filter(d=>!activeIds.has(d.id)),400)){
      const batch=writeBatch(db);group.forEach(d=>batch.set(d.ref,{inList:false,syncedAt:serverTimestamp()},{merge:true}));await batch.commit();
    }
    await setDoc(doc(db,"users",uid,"animeCatalog","_meta"),{anilistUser:username,lastSyncedAt:serverTimestamp(),itemCount:items.length,syncIntervalHours:24},{merge:true});
    return items.length;
  },
  saveThemeCatalog:async(animeId,themes)=>{
    if(!auth.currentUser)throw new Error("Faça login para salvar a lista de músicas.");
    const catalog=themes.map(t=>({slug:t.slug,type:t.type,title:t.title,artist:t.artist,eps:t.eps||"",video:t.video||""}));
    await setDoc(doc(db,"users",auth.currentUser.uid,"animeNotes",String(animeId)),{animeId:Number(animeId),themeCatalog:catalog,themeCatalogUpdatedAt:serverTimestamp()},{merge:true});
    // Mantém o IndexedDB sincronizado com o Firestore sem sobrescrever comentários,
    // notas pessoais ou outros campos já presentes no cache.
    const key=noteCacheKey(animeId),old=(await cacheGet(key))?.data||{};
    await cacheSet(key,{...old,animeId:Number(animeId),themeCatalog:catalog});
  },
  // Biblioteca de estilo: referências e perfil pessoal de escrita, exclusivos do proprietário.
  getWritingStyleReferences:async()=>{requireOwner();const snap=await getDocs(collection(db,"users",OWNER_UID,"writingStyleReferences"));return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updatedAtMs||b.createdAtMs||0)-(a.updatedAtMs||a.createdAtMs||0));},
  saveWritingStyleReference:async(reference)=>{requireOwner();const ref=reference.id?doc(db,"users",OWNER_UID,"writingStyleReferences",reference.id):doc(collection(db,"users",OWNER_UID,"writingStyleReferences"));const data={title:String(reference.title||"").trim(),text:String(reference.text||""),animeTitle:String(reference.animeTitle||"").trim(),note:String(reference.note||"").trim(),active:reference.active!==false,updatedAt:serverTimestamp()};if(!reference.id)data.createdAt=serverTimestamp();await setDoc(ref,data,{merge:true});return ref.id;},
  deleteWritingStyleReference:async(id)=>{requireOwner();await deleteDoc(doc(db,"users",OWNER_UID,"writingStyleReferences",id));},
  getWritingStyleProfile:async()=>{requireOwner();const snap=await getDoc(doc(db,"users",OWNER_UID,"writingStyle","profile"));return snap.exists()?snap.data():{profileText:""};},
  saveWritingStyleProfile:async(profileText)=>{requireOwner();await setDoc(doc(db,"users",OWNER_UID,"writingStyle","profile"),{profileText:String(profileText||""),updatedAt:serverTimestamp()},{merge:true});},
  // Leitura pública das informações exibidas nas abas Estatísticas e Ranking.
  // A identidade do proprietário é fixa; as regras do Firestore permitem leitura,
  // enquanto todas as operações de escrita continuam exigindo autenticação do dono.
  getAllAnimeNotes:async({refresh=false}={})=>{
    if(refresh)await cacheDelete("stats:animeNotes");
    return freshOrCached("stats:animeNotes",async()=>{const snap=await getDocs(collection(db,"users",OWNER_UID,"animeNotes"));const out={};snap.forEach(d=>out[d.id]=d.data());return out;});
  },
  getAllEpisodeLogs:async({refresh=false}={})=>{
    if(refresh)await cacheDelete("stats:episodeLogs");
    return freshOrCached("stats:episodeLogs",async()=>{const snap=await getDocs(collection(db,"users",OWNER_UID,"episodeLogs"));return snap.docs.map(d=>({id:d.id,...d.data()}));});
  },
  exportData:async()=>{
    if(!auth.currentUser)throw new Error("Faça login para exportar seus dados.");
    const uid=auth.currentUser.uid;
    const [catalog,notes,logs,scores]=await Promise.all([
      getDocs(collection(db,"users",uid,"animeCatalog")),
      getDocs(collection(db,"users",uid,"animeNotes")),
      getDocs(collection(db,"users",uid,"episodeLogs")),
      getDocs(collection(db,"songScores"))
    ]);
    const clean=value=>{
      if(value&&typeof value.toDate==="function")return value.toDate().toISOString();
      if(Array.isArray(value))return value.map(clean);
      if(value&&typeof value==="object") {const out={};for(const [k,v] of Object.entries(value))out[k]=clean(v);return out;}
      return value;
    };
    const docs=snap=>snap.docs.map(d=>({id:d.id,...clean(d.data())}));
    return {format:"hub-animes-backup",version:1,exportedAt:new Date().toISOString(),user:{uid,displayName:auth.currentUser.displayName||null},data:{animeCatalog:docs(catalog),animeNotes:docs(notes),episodeLogs:docs(logs),songScores:docs(scores)}};
  },
  validateBackup:backup=>{
    if(!backup||typeof backup!=="object"||backup.format!=="hub-animes-backup"||backup.version!==1)throw new Error("Formato ou versão de backup não reconhecidos.");
    if(!backup.data||typeof backup.data!=="object")throw new Error("O arquivo não contém a seção de dados.");
    const names=["animeCatalog","animeNotes","episodeLogs","songScores"],counts={};
    for(const name of names){
      const rows=backup.data[name];
      if(!Array.isArray(rows))throw new Error(`A seção ${name} está ausente ou inválida.`);
      const seen=new Set();
      for(const row of rows){
        if(!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!row.id.trim()||row.id.includes("/"))throw new Error(`Há um registro inválido na seção ${name}.`);
        if(seen.has(row.id))throw new Error(`O backup contém IDs duplicados em ${name}.`);
        seen.add(row.id);
      }
      counts[name]=rows.length;
    }
    return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0)};
  },
  previewImport:async backup=>{
    requireOwner();
    const validation=window.hubFB.validateBackup(backup),uid=auth.currentUser.uid;
    const destinations={
      animeCatalog:row=>doc(db,"users",uid,"animeCatalog",row.id),
      animeNotes:row=>doc(db,"users",uid,"animeNotes",row.id),
      episodeLogs:row=>doc(db,"users",uid,"episodeLogs",row.id),
      songScores:row=>doc(db,"songScores",row.id)
    };
    const normalize=value=>{
      if(value&&typeof value.toDate==="function")return value.toDate().toISOString();
      if(value instanceof Date)return value.toISOString();
      if(Array.isArray(value))return value.map(normalize);
      if(value&&typeof value==="object"){
        const out={};for(const key of Object.keys(value).sort())out[key]=normalize(value[key]);return out;
      }
      return value;
    };
    const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
    const items=[];
    const tasks=[];
    for(const section of Object.keys(destinations))for(const row of backup.data[section])tasks.push({section,row,ref:destinations[section](row)});
    // Leituras pontuais ao servidor, com concorrência limitada para não disparar centenas de requisições simultâneas.
    for(let i=0;i<tasks.length;i+=12){
      const group=tasks.slice(i,i+12);
      const results=await Promise.all(group.map(async task=>{
        const snap=await getDocFromServer(task.ref);
        const {id,...incoming}=task.row;
        if(!snap.exists())return {...task,action:"add",label:task.row.title?.userPreferred||(typeof task.row.title==="string"?task.row.title:null)||task.row.name||task.row.animeTitle||(task.row.animeId?`Anime ${task.row.animeId}`:id)};
        const existing=snap.data();
        const keys=new Set([...Object.keys(existing),...Object.keys(incoming)]);
        const differences=[...keys].filter(key=>!same(existing[key],incoming[key]));
        return {...task,action:differences.length?"attention":"ignore",differences,label:task.row.title?.userPreferred||(typeof task.row.title==="string"?task.row.title:null)||task.row.name||task.row.animeTitle||(task.row.animeId?`Anime ${task.row.animeId}`:id)};
      }));
      items.push(...results);
    }
    const summary={add:items.filter(x=>x.action==="add").length,ignore:items.filter(x=>x.action==="ignore").length,attention:items.filter(x=>x.action==="attention").length};
    const bySection={};
    for(const section of Object.keys(destinations))bySection[section]={add:items.filter(x=>x.section===section&&x.action==="add").length,ignore:items.filter(x=>x.section===section&&x.action==="ignore").length,attention:items.filter(x=>x.section===section&&x.action==="attention").length};
    return {counts:validation.counts,total:validation.total,summary,bySection,items:items.map(item=>({section:item.section,id:item.row.id,action:item.action,differences:item.differences||[],label:item.label})),createdAt:Date.now()};
  },
  importData:async(backup,preview)=>{
    requireOwner();
    const validation=window.hubFB.validateBackup(backup),uid=auth.currentUser.uid;
    const plan=preview||await window.hubFB.previewImport(backup);
    const dateFields=new Set(["createdAt","updatedAt","syncedAt","lastSyncedAt","themeCatalogUpdatedAt","confirmedAt"]);
    const restoreDates=(value,key="",path=[])=>{
      if(value===null||value===undefined)return value;
      if(typeof value==="string"&&(dateFields.has(key)||(key==="changedAt"&&path.includes("definitiveRatingHistory")))){
        const time=Date.parse(value);if(Number.isFinite(time))return new Date(time);
      }
      if(Array.isArray(value))return value.map(v=>restoreDates(v,"",path));
      if(typeof value==="object"){const out={};for(const [k,v] of Object.entries(value))out[k]=restoreDates(v,k,[...path,k]);return out;}
      return value;
    };
    const destinations={
      animeCatalog:row=>doc(db,"users",uid,"animeCatalog",row.id),
      animeNotes:row=>doc(db,"users",uid,"animeNotes",row.id),
      episodeLogs:row=>doc(db,"users",uid,"episodeLogs",row.id),
      songScores:row=>doc(db,"songScores",row.id)
    };
    const rowsBySection=Object.fromEntries(Object.keys(destinations).map(name=>[name,new Map(backup.data[name].map(row=>[row.id,row]))]));
    const candidates=(plan.items||[]).filter(item=>item.action==="add");
    const counts=Object.fromEntries(Object.keys(destinations).map(name=>[name,{added:0,skipped:0,failed:0}]));
    const failures=[];
    // Cada criação é transacional: se outro processo criar o documento após a prévia, ele não será sobrescrito.
    for(let i=0;i<candidates.length;i+=5){
      const group=candidates.slice(i,i+5);
      const outcomes=await Promise.all(group.map(async item=>{
        const row=rowsBySection[item.section]?.get(item.id);
        if(!row)return {section:item.section,status:"failed",error:"Registro não encontrado no arquivo após a prévia."};
        try{
          const ref=destinations[item.section](row);
          const {id,...fields}=row;
          const data=restoreDates(fields);
          const status=await runTransaction(db,async transaction=>{
            const snap=await transaction.get(ref);
            if(snap.exists())return "skipped";
            transaction.set(ref,data);
            return "added";
          });
          return {section:item.section,status};
        }catch(error){return {section:item.section,status:"failed",error:error?.code||error?.message||"Erro desconhecido",id:item.id}}
      }));
      for(const outcome of outcomes){
        counts[outcome.section][outcome.status]++;
        if(outcome.status==="failed")failures.push(outcome);
      }
    }
    for(const section of Object.keys(counts)){
      counts[section].ignored=plan.bySection?.[section]?.ignore||0;
      counts[section].attention=plan.bySection?.[section]?.attention||0;
    }
    const added=Object.values(counts).reduce((sum,c)=>sum+c.added,0);
    const skipped=Object.values(counts).reduce((sum,c)=>sum+c.skipped+c.ignored+c.attention,0);
    const failed=Object.values(counts).reduce((sum,c)=>sum+c.failed,0);
    if(added){
      await cacheDelete("songScores");await cacheDelete("stats:animeNotes");await cacheDelete("stats:episodeLogs");
      for(const item of candidates){
        if(item.section==="animeNotes")await cacheDelete(noteCacheKey(item.id));
        if(item.section==="episodeLogs"){
          const row=rowsBySection.episodeLogs.get(item.id);if(row?.animeId!==undefined)await cacheDelete(logsCacheKey(row.animeId));
        }
        if(item.section==="songScores"){
          const animeId=String(item.id).split(":")[0];await cacheDelete(`songScoresAnime:${animeId}`);
        }
      }
      if(counts.animeCatalog.added)await cacheDelete(`anilist:${OWNER_ANILIST_USERNAME.toLowerCase()}`);
    }
    if(failures.length)console.error("Falhas na importação do backup:",failures);
    return {counts,added,skipped,failed,failures,total:validation.total};
  },
  getAnimeNote:async (animeId,{refresh=false}={})=>{
    const key=noteCacheKey(animeId);
    if(refresh){
      const snap=await getDocFromServer(notePath(animeId));
      const fresh=snap.exists()?snap.data():{};
      await cacheSet(key,fresh);
      return fresh;
    }
    return freshOrCached(key,async()=>{const snap=await getDoc(notePath(animeId));return snap.exists()?snap.data():{}});
  },
  saveAnimeNote:async(animeId,data)=>{
    requireOwner();
    const old=(await cacheGet(noteCacheKey(animeId)))?.data||{};
    const payload={animeId:Number(animeId),...data,updatedAt:serverTimestamp()};
    let updatedCache={...old,...data};
    if(Object.prototype.hasOwnProperty.call(data,"provisionalScore")){
      const nextScore=data.provisionalScore===null||data.provisionalScore===""?null:Number(data.provisionalScore);
      const previousScore=old.provisionalScore===null||old.provisionalScore===undefined?null:Number(old.provisionalScore);
      payload.provisionalScore=nextScore;
      // Remove a possible legacy category field when migrating to the numeric model.
      payload.provisionalTier=deleteField();
      delete updatedCache.provisionalTier;
      if(nextScore!==previousScore){
        const historyEntry={score:nextScore,changedAt:new Date().toISOString()};
        payload.provisionalRatingHistory=arrayUnion(historyEntry);
        updatedCache.provisionalRatingHistory=[...(Array.isArray(old.provisionalRatingHistory)?old.provisionalRatingHistory:[]),historyEntry];
      }
      updatedCache.provisionalScore=nextScore;
    }
    await setDoc(notePath(animeId),payload,{merge:true});
    await cacheSet(noteCacheKey(animeId),updatedCache);
    await cacheDelete("stats:animeNotes");
  },
  saveDefinitiveRating:async(animeId,score)=>{
    requireOwner();
    const numericScore=Number(score);
    if(!Number.isInteger(numericScore)||numericScore<0||numericScore>100)throw new Error("Informe uma nota definitiva inteira entre 0 e 100.");
    const ref=notePath(animeId);
    // A transação lê a versão atual no servidor: evita depender de cache antigo
    // e impede que duas revisões simultâneas sobrescrevam o histórico uma da outra.
    const result=await runTransaction(db,async transaction=>{
      const snap=await transaction.get(ref);
      const old=snap.exists()?snap.data():{};
      const rawPrevious=old.definitiveRating?.score;
      const previousScore=rawPrevious===null||rawPrevious===undefined?null:Number(rawPrevious);
      if(previousScore!==null&&Number.isFinite(previousScore)&&previousScore===numericScore){
        return {changed:false,score:numericScore,data:old};
      }
      const rawProvisional=old.provisionalScore;
      const provisionalSnapshot=rawProvisional===null||rawProvisional===undefined||rawProvisional===""?null:Number(rawProvisional);
      const changedAt=Timestamp.now();
      const historyEntry={
        previousScore:Number.isFinite(previousScore)?previousScore:null,
        score:numericScore,
        provisionalScoreAtConfirmation:Number.isFinite(provisionalSnapshot)?provisionalSnapshot:null,
        changedAt
      };
      const oldHistory=Array.isArray(old.definitiveRatingHistory)?old.definitiveRatingHistory:[];
      const definitiveRating={
        score:numericScore,
        provisionalScoreAtConfirmation:historyEntry.provisionalScoreAtConfirmation,
        confirmedAt:changedAt
      };
      const nextData={
        ...old,
        animeId:Number(animeId),
        definitiveRating,
        definitiveRatingHistory:[...oldHistory,historyEntry],
        updatedAt:changedAt
      };
      transaction.set(ref,{
        animeId:Number(animeId),
        definitiveRating,
        definitiveRatingHistory:nextData.definitiveRatingHistory,
        updatedAt:serverTimestamp()
      },{merge:true});
      return {
        changed:true,score:numericScore,previousScore:historyEntry.previousScore,
        provisionalScoreAtConfirmation:historyEntry.provisionalScoreAtConfirmation,
        confirmedAt:changedAt.toDate().toISOString(),data:nextData
      };
    });
    await cacheSet(noteCacheKey(animeId),result.data);
    if(result.changed)await cacheDelete("stats:animeNotes");
    return result;
  },
  saveThemeComment:async(animeId,slug,comment)=>{requireOwner();await setDoc(notePath(animeId),{animeId:Number(animeId),themeComments:{[slug]:comment},updatedAt:serverTimestamp()},{merge:true});const old=(await cacheGet(noteCacheKey(animeId)))?.data||{};await cacheSet(noteCacheKey(animeId),{...old,themeComments:{...(old.themeComments||{}),[slug]:comment}});await cacheDelete("stats:animeNotes");},
  associateProvisionalTheme:async(animeId,kind,targetSlug)=>{
    requireOwner();if(!["OP","ED"].includes(kind))throw new Error("Tipo de música inválido.");
    const sourceSlug=PROVISIONAL_THEME_SLUGS[kind],sourceKey=`${animeId}:${sourceSlug}`,targetKey=`${animeId}:${targetSlug}`;
    if(sourceKey===targetKey)throw new Error("Escolha uma música diferente.");
    const sourceRef=doc(db,"songScores",sourceKey),targetRef=doc(db,"songScores",targetKey),noteRef=notePath(animeId);
    const [sourceSnap,targetSnap,noteSnap]=await Promise.all([getDoc(sourceRef),getDoc(targetRef),getDoc(noteRef)]);
    const note=noteSnap.exists()?noteSnap.data():{},comments=note.themeComments||{},sourceComment=comments[sourceSlug]||"",targetComment=comments[targetSlug]||"";
    if((sourceSnap.exists()&&targetSnap.exists())||(sourceComment&&targetComment))throw new Error("Essa música já possui uma nota ou comentário do mesmo tipo. Para evitar sobrescrever seus dados, escolha outra música ou mantenha a avaliação provisória.");
    if(!sourceSnap.exists()&&!sourceComment)throw new Error("Não há nota ou comentário provisório para transferir.");
    const batch=writeBatch(db);
    if(sourceSnap.exists()){batch.set(targetRef,{...sourceSnap.data(),updatedAt:serverTimestamp()},{merge:true});batch.delete(sourceRef);}
    // Remove explicitamente a chave provisória do mapa aninhado no Firestore.
    // merge:true não remove campos omitidos de mapas; por isso usamos deleteField().
    if(noteSnap.exists()){
      const commentUpdate={[`themeComments.${sourceSlug}`]:deleteField(),updatedAt:serverTimestamp()};
      if(sourceComment)commentUpdate[`themeComments.${targetSlug}`]=sourceComment;
      batch.update(noteRef,commentUpdate);
    }
    await batch.commit();
    const old=(await cacheGet(noteCacheKey(animeId)))?.data||note,updatedComments={...(old.themeComments||{})};
    delete updatedComments[sourceSlug];if(sourceComment)updatedComments[targetSlug]=sourceComment;
    await cacheSet(noteCacheKey(animeId),{...old,themeComments:updatedComments});await cacheDelete("stats:animeNotes");
    const allScores=(await cacheGet("songScores"))?.data||{};
    if(sourceSnap.exists()){allScores[targetKey]=sourceSnap.data().score;delete allScores[sourceKey];await cacheSet("songScores",allScores);}
    const animeScores=(await cacheGet(`songScoresAnime:${animeId}`))?.data||{};
    if(sourceSnap.exists()){animeScores[targetKey]=sourceSnap.data().score;delete animeScores[sourceKey];await cacheSet(`songScoresAnime:${animeId}`,animeScores);}
    return true;
  },
  addLog:async({animeId,episode,watchedAt,comment})=>{requireOwner();await addDoc(logsPath(),{animeId:Number(animeId),episode:Number(episode),watchedAt,comment,createdAt:serverTimestamp()});await cacheDelete(logsCacheKey(animeId));await cacheDelete("stats:episodeLogs")},
  getLogs:async (animeId,{refresh=false}={})=>{
    const key=logsCacheKey(animeId),q=query(logsPath(),where("animeId","==",Number(animeId)));
    if(refresh){const snap=await getDocsFromServer(q),logs=snap.docs.map(d=>({id:d.id,...d.data(),createdAtMs:d.data().createdAt?.toMillis?.()||0}));await cacheSet(key,logs);return logs;}
    return freshOrCached(key,async()=>{const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data(),createdAtMs:d.data().createdAt?.toMillis?.()||0}))});
  },
  updateLog:async(id,changes)=>{requireOwner();await updateDoc(doc(db,"users",OWNER_UID,"episodeLogs",id),{...changes,updatedAt:serverTimestamp()});await cacheDelete(logsCacheKey(window.activeDiaryAnime));await cacheDelete("stats:episodeLogs")},
  deleteLog:async id=>{requireOwner();await deleteDoc(doc(db,"users",OWNER_UID,"episodeLogs",id));await cacheDelete(logsCacheKey(window.activeDiaryAnime));await cacheDelete("stats:episodeLogs")} 
};
onAuthStateChanged(auth,u=>{
  emit("fb-user",u&&u.uid===OWNER_UID?{uid:u.uid,name:u.displayName||u.email}:null);
  if(u&&u.uid!==OWNER_UID)signOut(auth).catch(()=>{});
  if(window.activeDiaryAnime&&document.getElementById("detail-diary")&&!document.getElementById("detail-diary").classList.contains("hidden"))window.dispatchEvent(new CustomEvent("diary-auth-refresh"));
});
