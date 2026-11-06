// src/services/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, deleteDoc, deleteField, serverTimestamp, addDoc, getDocs, getDoc, getDocFromServer, getDocsFromCache, getDocsFromServer, getDocFromCache, query, where, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { cacheGet, cacheSet, cacheDelete, freshOrCached } from "./cache.js";
import { OWNER_UID, PROVISIONAL_THEME_SLUGS } from "../config.js";

const app = initializeApp({
  apiKey: "AIzaSyCgHMZV_wIFOV4QuJi3bBRbu_iOXSJ1ahY",
  authDomain: "hub-pesoal.firebaseapp.com",
  projectId: "hub-pesoal",
  storageBucket: "hub-pesoal.firebasestorage.app",
  messagingSenderId: "335710840559",
  appId: "1:335710840559:web:1d99e078383a9819a99d1a"
});

const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const emit = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }));

const isOwner = () => auth.currentUser?.uid === OWNER_UID;
const requireOwner = () => { if (!isOwner()) throw new Error("Somente a conta proprietária pode editar este Hub."); };

const notePath = animeId => doc(db, "users", OWNER_UID, "animeNotes", String(animeId));
const logsPath = () => collection(db, "users", OWNER_UID, "episodeLogs");
const noteCacheKey = id => `note:${id}`, logsCacheKey = id => `logs:${id}`;

window.hubFB = {
  login: async () => {
    if (auth.currentUser && !isOwner()) await signOut(auth);
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    if (result.user.uid !== OWNER_UID) { await signOut(auth); throw new Error("Esta conta Google não é a proprietária do Hub."); }
    return result;
  },
  logout: () => signOut(auth),
  getAniListCache: async username => { const entry = await cacheGet(`anilist:${username.toLowerCase()}`); return entry ? { items: entry.data, savedAt: entry.savedAt } : null; },
  saveAniListCache: (username, items) => cacheSet(`anilist:${username.toLowerCase()}`, items),
  getSongScores: () => freshOrCached("songScores", async () => { const snap = await getDocs(collection(db, "songScores")), out = {}; snap.forEach(d => out[d.id] = d.data().score); return out; }),
  getSongScoresForAnime: async (animeId, slugs, { refresh = false } = {}) => {
    const cacheKey = `songScoresAnime:${animeId}`, cached = await cacheGet(cacheKey), now = Date.now();
    const cacheValid = cached && now - cached.savedAt < 6 * 60 * 60 * 1000;
    const out = !refresh && cacheValid ? { ...cached.data } : {};
    const missing = slugs.filter(slug => !Object.prototype.hasOwnProperty.call(out, `${animeId}:${slug}`));
    if (!refresh && !missing.length && cacheValid) return out;
    const requested = refresh ? slugs : (cacheValid ? missing : slugs);
    await Promise.all(requested.map(async slug => { const key = `${animeId}:${slug}`, ref = doc(db, "songScores", key), snap = refresh ? await getDocFromServer(ref) : await getDoc(ref); if (snap.exists()) out[key] = snap.data().score; else out[key] = null; }));
    await cacheSet(cacheKey, out); return out;
  },
  save: async (key, n) => { requireOwner(); await setDoc(doc(db, "songScores", key), { score: n, updatedAt: serverTimestamp() }, { merge: true }); const scores = (await cacheGet("songScores"))?.data || {}; scores[key] = n; await cacheSet("songScores", scores); const animeId = key.split(":")[0], byAnime = (await cacheGet(`songScoresAnime:${animeId}`))?.data || {}; byAnime[key] = n; await cacheSet(`songScoresAnime:${animeId}`, byAnime); },
  remove: async key => { requireOwner(); await deleteDoc(doc(db, "songScores", key)); const scores = (await cacheGet("songScores"))?.data || {}; delete scores[key]; await cacheSet("songScores", scores); const animeId = key.split(":")[0], byAnime = (await cacheGet(`songScoresAnime:${animeId}`))?.data || {}; delete byAnime[key]; await cacheSet(`songScoresAnime:${animeId}`, byAnime); },
  saveThemeCatalog: async (animeId, themes) => {
    if (!auth.currentUser) throw new Error("Faça login para salvar a lista de músicas.");
    const catalog = themes.map(t => ({ slug: t.slug, type: t.type, title: t.title, artist: t.artist, eps: t.eps || "", video: t.video || "" }));
    await setDoc(doc(db, "users", OWNER_UID, "animeNotes", String(animeId)), { animeId: Number(animeId), themeCatalog: catalog, themeCatalogUpdatedAt: serverTimestamp() }, { merge: true });
    const key = noteCacheKey(animeId), old = (await cacheGet(key))?.data || {};
    await cacheSet(key, { ...old, animeId: Number(animeId), themeCatalog: catalog });
  },
  getAllAnimeNotes: async ({ refresh = false } = {}) => {
    if (!auth.currentUser || !isOwner()) throw new Error("Faça login com a conta proprietária para consultar suas anotações.");
    if (refresh) await cacheDelete("stats:animeNotes");
    return freshOrCached("stats:animeNotes", async () => { const snap = await getDocs(collection(db, "users", OWNER_UID, "animeNotes")); const out = {}; snap.forEach(d => out[d.id] = d.data()); return out; });
  },
  getAllEpisodeLogs: async ({ refresh = false } = {}) => {
    if (!auth.currentUser || !isOwner()) throw new Error("Faça login com a conta proprietária para consultar o diário.");
    if (refresh) await cacheDelete("stats:episodeLogs");
    return freshOrCached("stats:episodeLogs", async () => { const snap = await getDocs(collection(db, "users", OWNER_UID, "episodeLogs")); return snap.docs.map(d => ({ id: d.id, ...d.data() })); });
  },
  exportData: async () => {
    if (!auth.currentUser) throw new Error("Faça login para exportar seus dados.");
    const uid = auth.currentUser.uid;
    const [catalog, notes, logs, scores] = await Promise.all([
      getDocs(collection(db, "users", uid, "animeCatalog")),
      getDocs(collection(db, "users", uid, "animeNotes")),
      getDocs(collection(db, "users", uid, "episodeLogs")),
      getDocs(collection(db, "songScores"))
    ]);
    const clean = value => {
      if (value && typeof value.toDate === "function") return value.toDate().toISOString();
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === "object") { const out = {}; for (const [k, v] of Object.entries(value)) out[k] = clean(v); return out; }
      return value;
    };
    const docs = snap => snap.docs.map(d => ({ id: d.id, ...clean(d.data()) }));
    return { format: "hub-animes-backup", version: 1, exportedAt: new Date().toISOString(), user: { uid, displayName: auth.currentUser.displayName || null }, data: { animeCatalog: docs(catalog), animeNotes: docs(notes), episodeLogs: docs(logs), songScores: docs(scores) } };
  },
  validateBackup: backup => {
    if (!backup || typeof backup !== "object" || backup.format !== "hub-animes-backup" || backup.version !== 1) throw new Error("Formato ou versão de backup não reconhecidos.");
    if (!backup.data || typeof backup.data !== "object") throw new Error("O arquivo não contém a seção de dados.");
    const names = ["animeCatalog", "animeNotes", "episodeLogs", "songScores"], counts = {};
    for (const name of names) {
      const rows = backup.data[name];
      if (!Array.isArray(rows)) throw new Error(`A seção ${name} está ausente ou inválida.`);
      const seen = new Set();
      for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !row.id.trim() || row.id.includes("/")) throw new Error(`Há um registro inválido na seção ${name}.`);
        if (seen.has(row.id)) throw new Error(`O backup contém IDs duplicados em ${name}.`);
        seen.add(row.id);
      }
      counts[name] = rows.length;
    }
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  },
  importData: async backup => {
    if (!auth.currentUser) throw new Error("Faça login para importar seus dados.");
    const validation = window.hubFB.validateBackup(backup), uid = auth.currentUser.uid;
    const dateFields = new Set(["createdAt", "updatedAt", "syncedAt", "lastSyncedAt", "themeCatalogUpdatedAt"]);
    const restoreDates = (value, key = "") => {
      if (value === null || value === undefined) return value;
      if (dateFields.has(key) && typeof value === "string") {
        const time = Date.parse(value); if (Number.isFinite(time)) return new Date(time);
      }
      if (Array.isArray(value)) return value.map(v => restoreDates(v));
      if (typeof value === "object") { const out = {}; for (const [k, v] of Object.entries(value)) out[k] = restoreDates(v, k); return out; }
      return value;
    };
    const destinations = {
      animeCatalog: row => doc(db, "users", uid, "animeCatalog", row.id),
      animeNotes: row => doc(db, "users", uid, "animeNotes", row.id),
      episodeLogs: row => doc(db, "users", uid, "episodeLogs", row.id),
      songScores: row => doc(db, "songScores", row.id)
    };
    const operations = [];
    for (const name of Object.keys(destinations)) for (const row of backup.data[name]) {
      const { id, ...fields } = row;
      operations.push({ ref: destinations[name](row), data: restoreDates(fields) });
    }
    for (let i = 0; i < operations.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of operations.slice(i, i + 400)) batch.set(op.ref, op.data, { merge: true });
      await batch.commit();
    }
    await cacheDelete("songScores"); await cacheDelete("stats:animeNotes"); await cacheDelete("stats:episodeLogs");
    for (const row of backup.data.animeNotes) await cacheDelete(noteCacheKey(row.id));
    for (const row of backup.data.episodeLogs) await cacheDelete(logsCacheKey(row.animeId));
    return { counts: validation.counts, total: validation.total };
  },
  getAnimeNote: async (animeId, { refresh = false } = {}) => {
    const key = noteCacheKey(animeId);
    if (refresh) {
      const snap = await getDocFromServer(notePath(animeId));
      const fresh = snap.exists() ? snap.data() : {};
      await cacheSet(key, fresh);
      return fresh;
    }
    return freshOrCached(key, async () => { const snap = await getDoc(notePath(animeId)); return snap.exists() ? snap.data() : {}; });
  },
  saveAnimeNote: async (animeId, data) => { requireOwner(); await setDoc(notePath(animeId), { animeId: Number(animeId), ...data, updatedAt: serverTimestamp() }, { merge: true }); const old = (await cacheGet(noteCacheKey(animeId)))?.data || {}; await cacheSet(noteCacheKey(animeId), { ...old, ...data }); await cacheDelete("stats:animeNotes"); },
  saveThemeComment: async (animeId, slug, comment) => { requireOwner(); await setDoc(notePath(animeId), { animeId: Number(animeId), themeComments: { [slug]: comment }, updatedAt: serverTimestamp() }, { merge: true }); const old = (await cacheGet(noteCacheKey(animeId)))?.data || {}; await cacheSet(noteCacheKey(animeId), { ...old, themeComments: { ...(old.themeComments || {}), [slug]: comment } }); await cacheDelete("stats:animeNotes"); },
  associateProvisionalTheme: async (animeId, kind, targetSlug) => {
    requireOwner(); if (!["OP", "ED"].includes(kind)) throw new Error("Tipo de música inválido.");
    const sourceSlug = PROVISIONAL_THEME_SLUGS[kind], sourceKey = `${animeId}:${sourceSlug}`, targetKey = `${animeId}:${targetSlug}`;
    if (sourceKey === targetKey) throw new Error("Escolha uma música diferente.");
    const sourceRef = doc(db, "songScores", sourceKey), targetRef = doc(db, "songScores", targetKey), noteRef = notePath(animeId);
    const [sourceSnap, targetSnap, noteSnap] = await Promise.all([getDoc(sourceRef), getDoc(targetRef), getDoc(noteRef)]);
    const note = noteSnap.exists() ? noteSnap.data() : {}, comments = note.themeComments || {}, sourceComment = comments[sourceSlug] || "", targetComment = comments[targetSlug] || "";
    if ((sourceSnap.exists() && targetSnap.exists()) || (sourceComment && targetComment)) throw new Error("Essa música já possui uma nota ou comentário do mesmo tipo.");
    if (!sourceSnap.exists() && !sourceComment) throw new Error("Não há nota ou comentário provisório para transferir.");
    const batch = writeBatch(db);
    if (sourceSnap.exists()) { batch.set(targetRef, { ...sourceSnap.data(), updatedAt: serverTimestamp() }, { merge: true }); batch.delete(sourceRef); }
    if (noteSnap.exists()) {
      const commentUpdate = { [`themeComments.${sourceSlug}`]: deleteField(), updatedAt: serverTimestamp() };
      if (sourceComment) commentUpdate[`themeComments.${targetSlug}`] = sourceComment;
      batch.update(noteRef, commentUpdate);
    }
    await batch.commit();
    const old = (await cacheGet(noteCacheKey(animeId)))?.data || note, updatedComments = { ...(old.themeComments || {}) };
    delete updatedComments[sourceSlug]; if (sourceComment) updatedComments[targetSlug] = sourceComment;
    await cacheSet(noteCacheKey(animeId), { ...old, themeComments: updatedComments }); await cacheDelete("stats:animeNotes");
    const allScores = (await cacheGet("songScores"))?.data || {};
    if (sourceSnap.exists()) { allScores[targetKey] = sourceSnap.data().score; delete allScores[sourceKey]; await cacheSet("songScores", allScores); }
    const animeScores = (await cacheGet(`songScoresAnime:${animeId}`))?.data || {};
    if (sourceSnap.exists()) { animeScores[targetKey] = sourceSnap.data().score; delete animeScores[sourceKey]; await cacheSet(`songScoresAnime:${animeId}`, animeScores); }
    return true;
  },
  addLog: async ({ animeId, episode, watchedAt, comment }) => { requireOwner(); await addDoc(logsPath(), { animeId: Number(animeId), episode: Number(episode), watchedAt, comment, createdAt: serverTimestamp() }); await cacheDelete(logsCacheKey(animeId)); await cacheDelete("stats:episodeLogs"); },
  getLogs: async (animeId, { refresh = false } = {}) => {
    const key = logsCacheKey(animeId), q = query(logsPath(), where("animeId", "==", Number(animeId)));
    if (refresh) { const snap = await getDocsFromServer(q), logs = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtMs: d.data().createdAt?.toMillis?.() || 0 })); await cacheSet(key, logs); return logs; }
    return freshOrCached(key, async () => { const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtMs: d.data().createdAt?.toMillis?.() || 0 })); });
  },
  updateLog: async (id, changes) => { requireOwner(); await updateDoc(doc(db, "users", OWNER_UID, "episodeLogs", id), { ...changes, updatedAt: serverTimestamp() }); await cacheDelete(logsCacheKey(window.activeDiaryAnime)); await cacheDelete("stats:episodeLogs"); },
  deleteLog: async id => { requireOwner(); await deleteDoc(doc(db, "users", OWNER_UID, "episodeLogs", id)); await cacheDelete(logsCacheKey(window.activeDiaryAnime)); await cacheDelete("stats:episodeLogs"); }
};

onAuthStateChanged(auth, u => {
  emit("fb-user", u && u.uid === OWNER_UID ? { uid: u.uid, name: u.displayName || u.email } : null);
  if (u && u.uid !== OWNER_UID) signOut(auth).catch(() => {});
  if (window.activeDiaryAnime && document.getElementById("detail-diary") && !document.getElementById("detail-diary").classList.contains("hidden")) window.dispatchEvent(new CustomEvent("diary-auth-refresh"));
});