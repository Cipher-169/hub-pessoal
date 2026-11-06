// src/views/modal.js
import { esc, badge, sbadge, bg, localDateISO, when } from '../utils/helpers.js';
import { fetchThemes } from '../services/animethemes.js';
import { themeTypeFromSlug, isProvisionalThemeSlug, PROVISIONAL_THEME_SLUGS } from '../config.js';

let activeDiaryAnime = null;
export function getActiveDiaryAnime() { return activeDiaryAnime; }
export function setActiveDiaryAnime(id) { activeDiaryAnime = id; window.activeDiaryAnime = id; }

export async function openAnimeModal(id, animes, dlgEl, SONG_SCORES, fbUser) {
  const a = animes.find(item => item.id === id);
  setActiveDiaryAnime(id);
  dlgEl.innerHTML = `<div class="dh" ${bg(a?.banner || a?.cover)}><button class="dx" onclick="this.closest('dialog').close()">Fechar</button><h2>${esc(a?.title || "Anime " + id)}</h2>
   <div class="meta">${a ? when(a) : ""} ${a?.score ? badge(a.score) : ""} · <a href="${a?.url || "https://anilist.co/anime/" + id}" target="_blank" rel="noopener">AniList</a></div>
   <div><button type="button" class="anime-refresh" data-refresh-anime="${id}">↻ Atualizar dados</button><span class="anime-refresh-status" id="anime-refresh-status" role="status"></span></div></div>
   <div class="db"><div class="detail-tabs"><button type="button" data-detail-tab="themes" aria-selected="true">OP e ED</button><button type="button" data-detail-tab="experience" aria-selected="false">A minha experiência</button><button type="button" data-detail-tab="diary" aria-selected="false">Diário de episódios</button></div>
   <section id="detail-themes"><div id="themes" class="msg">A carregar músicas…</div></section>
   <section id="detail-experience" class="hidden"><div id="experience-content" class="msg">A carregar…</div></section>
   <section id="detail-diary" class="hidden"><div id="diary-content" class="msg">A carregar diário…</div></section></div>`;
  dlgEl.showModal();
  let note = {}; try { note = await window.hubFB.getAnimeNote(id); } catch (e) {}
  let apiAvailable = false;
  try {
    const th = await fetchThemes(id); apiAvailable = true;
    if (!th.length && (!Array.isArray(note.themeCatalog) || !note.themeCatalog.length)) {
      try { note = await window.hubFB.getAnimeNote(id, { refresh: true }); } catch (e) {}
    }
    const themeList = th.length ? th : (note.themeCatalog || []);
    if (th.length && fbUser) {
      const clean = th.map(t => ({ slug: t.slug, type: t.type, title: t.title, artist: t.artist, eps: t.eps || "", video: t.video || "" }));
      if (JSON.stringify(clean) !== JSON.stringify(note.themeCatalog || [])) {
        try { await window.hubFB.saveThemeCatalog(id, th); note = { ...note, themeCatalog: clean }; } catch (e) {}
      }
    }
    const slugs = [...new Set([...themeList.map(t => t.slug), ...Object.keys(note.themeComments || {}), ...Object.values(PROVISIONAL_THEME_SLUGS)])];
    if (slugs.length) { try { Object.assign(SONG_SCORES, await window.hubFB.getSongScoresForAnime(id, slugs)); } catch (e) {} }
    renderThemeList(id, themeList, note, false, SONG_SCORES, fbUser, dlgEl);
  } catch (e) {
    if (!Array.isArray(note.themeCatalog) || !note.themeCatalog.length) {
      try { note = await window.hubFB.getAnimeNote(id, { refresh: true }); } catch (refreshError) {}
    }
    const themeList = Array.isArray(note.themeCatalog) ? note.themeCatalog : [];
    const slugs = [...new Set([...themeList.map(t => t.slug), ...Object.keys(note.themeComments || {}), ...Object.values(PROVISIONAL_THEME_SLUGS)])];
    if (slugs.length) { try { Object.assign(SONG_SCORES, await window.hubFB.getSongScoresForAnime(id, slugs)); } catch (ignore) {} }
    renderThemeList(id, themeList, note, true, SONG_SCORES, fbUser, dlgEl);
  }
  loadDiary(id, animes, fbUser); loadExperience(id, fbUser);
}

function renderThemeList(id, th, note, offline = false, SONG_SCORES = {}, fbUser = null, dlgEl = document) {
  const root = dlgEl.querySelector("#themes"); if (!root) return;
  const comments = note?.themeComments || {}, themes = Array.isArray(th) ? th : [];
  root.className = "";
  const realSlugs = new Set(themes.map(t => t.slug));
  const scoreSlugs = Object.keys(SONG_SCORES).filter(key => key.startsWith(`${id}:`)).map(key => key.slice(String(id).length + 1));
  const savedOrphans = [...new Set([...Object.keys(comments), ...scoreSlugs])].filter(slug => !realSlugs.has(slug) && !isProvisionalThemeSlug(slug));
  const orphanTypes = new Set(savedOrphans.map(themeTypeFromSlug).filter(Boolean));
  const provisionalKinds = offline && !themes.length ? ["OP", "ED"].filter(kind => !orphanTypes.has(kind)) : [];
  const hasSavedProvisional = Object.entries(PROVISIONAL_THEME_SLUGS).some(([kind, slug]) =>
    Object.prototype.hasOwnProperty.call(comments, slug) || SONG_SCORES[`${id}:${slug}`] != null);
  const provisionalKindsToRender = [...new Set([...provisionalKinds, ...(hasSavedProvisional ? Object.keys(PROVISIONAL_THEME_SLUGS).filter(kind => Object.prototype.hasOwnProperty.call(comments, PROVISIONAL_THEME_SLUGS[kind]) || SONG_SCORES[`${id}:${PROVISIONAL_THEME_SLUGS[kind]}`] != null) : [])])];
  
  const renderCard = (t, { provisional = false, orphan = false, label = "" } = {}) => {
    const key = `${id}:${t.slug}`, sc = SONG_SCORES[key], comment = comments[t.slug] || "";
    const title = provisional ? `${t.type} provisória` : t.title || t.slug;
    const meta = provisional ? "Registo temporário" : (orphan ? "Informações indisponíveis" : "");
    let association = "";
    if (provisional && !offline && themes.length && fbUser) {
      association = `<div class="theme-comment-wrap"><label for="associate-${t.type}">Associar avaliação:</label><select id="associate-${t.type}" style="width:100%;background:#0c1220;border:1px solid var(--line);border-radius:9px;padding:9px;color:var(--text)"><option value="">Selecione…</option>${themes.filter(x => x.type === t.type).map(x => `<option value="${esc(x.slug)}">${esc(x.title || x.slug)}</option>`).join("")}</select><button class="theme-comment-save" data-associate-provisional="${t.type}">Associar</button><span class="experience-status" id="associate-status-${t.type}"></span></div>`;
    }
    const kind = themeTypeFromSlug(t.slug) || String(t.type || "").toUpperCase();
    const kindBadge = !provisional && label ? `<span class="theme-kind-badge ${kind.toLowerCase()}">${esc(label)}</span>` : "";
    return `<div class="theme ${provisional ? "theme-provisional" : ""}"><b>${esc(title)}</b>${kindBadge} ${!provisional && t.title ? `<span class="meta">${esc(t.artist || "")}</span>` : `<span class="meta">${esc(meta)}</span>`} ${sc != null ? sbadge(sc) : ""}
      ${t.video && !offline ? `<video controls preload="none" src="${esc(t.video)}"></video>` : ""}
      ${fbUser ? `<div style="margin-top:8px"><label class="meta" for="sc-${key}">Nota</label><input class="sc" id="sc-${key}" type="text" inputmode="decimal" placeholder="0 a 10" value="${sc ?? ""}"> <button class="cp" data-save="${key}">Salvar</button> <code id="st-${key}"></code></div><div class="theme-comment-wrap"><label for="tc-${key}">Comentário</label><textarea class="theme-comment" id="tc-${key}" maxlength="5000" placeholder="O que achou…">${esc(comment)}</textarea><button class="theme-comment-save" data-save-theme-comment="${esc(t.slug)}">Salvar</button> <span class="experience-status" id="tcs-${key}"></span></div>${association}` : (comment ? `<div class="theme-comment-wrap"><p style="white-space:pre-wrap;margin:8px 0 0">${esc(comment)}</p></div>` : "")}</div>`;
  };
  
  const typeCounters = { OP: 0, ED: 0 };
  const cards = themes.map(t => {
    const kind = themeTypeFromSlug(t.slug) || String(t.type || "").toUpperCase();
    if (kind === "OP" || kind === "ED") typeCounters[kind]++;
    const label = (kind === "OP" || kind === "ED") ? `${kind}${typeCounters[kind]}` : "";
    return renderCard(t, { label });
  });
  savedOrphans.forEach(slug => {
    const kind = themeTypeFromSlug(slug); if (!kind) return;
    cards.push(renderCard({ slug, type: kind, title: slug, artist: "", video: "" }, { orphan: true, label: slug }));
  });
  provisionalKindsToRender.forEach(kind => {
    const slug = PROVISIONAL_THEME_SLUGS[kind];
    cards.push(renderCard({ slug, type: kind, title: `${kind} provisória`, artist: "", video: "" }, { provisional: true }));
  });
  root.innerHTML = cards.join("") || '<div class="msg">Sem temas disponíveis.</div>';
}

export async function loadExperience(id, fbUser) {
  const root = document.getElementById("experience-content"); if (!root) return;
  root.className = "msg"; root.textContent = "A carregar…";
  try {
    const data = await window.hubFB.getAnimeNote(id); if (activeDiaryAnime !== id) return;
    const platforms = Array.isArray(data.platforms) ? data.platforms : [];
    const languageLabel = ({ sub: "Legendado", dub: "Dublado", other: "Outro" })[data.language] || "Não informado";
    if (!fbUser) {
      const hasData = !!(data.language || platforms.length || data.otherPlatform || data.viewingNotes);
      root.className = "";
      root.innerHTML = hasData ? `<div><p><strong>${esc(languageLabel)}</strong></p><p>${esc([...platforms, ...(data.otherPlatform ? [data.otherPlatform] : [])].join(", "))}</p></div>` : '<div class="msg">Sem informações.</div>';
      return;
    }
    root.className = "";
    root.innerHTML = `<form class="experience-form" id="experience-form">
     <div><label for="watch-language">Idioma</label><select id="watch-language"><option value="">Não informado</option><option value="sub" ${data.language === "sub" ? "selected" : ""}>Legendado</option><option value="dub" ${data.language === "dub" ? "selected" : ""}>Dublado</option></select></div>
     <div><label>Plataformas</label><div class="platform-picker" id="watch-platforms">${["Crunchyroll", "Netflix", "Prime Video", "Outra"].map(p => `<label class="platform-option"><input type="checkbox" name="watch-platform" value="${p}" ${platforms.includes(p) ? "checked" : ""}><span>${p}</span></label>`).join("")}</div></div>
     <div><label for="watch-notes">Notas</label><textarea id="watch-notes" maxlength="5000">${esc(data.viewingNotes || "")}</textarea></div>
     <button type="submit">Salvar</button><span class="experience-status" id="experience-status"></span>
    </form>`;
    document.getElementById("experience-form")?.addEventListener("submit", async ev => {
      ev.preventDefault(); const btn = ev.currentTarget.querySelector('button[type="submit"]'), status = document.getElementById("experience-status");
      btn.disabled = true; status.textContent = "A salvar…";
      const selectedPlatforms = [...document.querySelectorAll("#watch-platforms input[name=\"watch-platform\"]:checked")].map(o => o.value);
      try {
        await window.hubFB.saveAnimeNote(id, { language: document.getElementById("watch-language").value, platforms: selectedPlatforms, viewingNotes: document.getElementById("watch-notes").value.trim() });
        status.textContent = "Salvo!";
      } catch (err) { status.textContent = "Erro ao salvar"; } finally { btn.disabled = false; }
    });
  } catch (err) { root.className = ""; root.innerHTML = `<div class="msg err">Erro ao carregar.</div>`; }
}

export async function loadDiary(id, animes, fbUser) {
  activeDiaryAnime = id;
  const root = document.getElementById("diary-content"); if (!root) return;
  root.className = "msg"; root.textContent = "A carregar diário…";
  try {
    const logs = await window.hubFB.getLogs(id);
    if (activeDiaryAnime === id) renderDiaryEntries(id, logs, !!fbUser, animes);
  } catch (err) { root.innerHTML = `<div class="msg err">Erro ao carregar diário.</div>`; }
}

function renderDiaryEntries(id, logs, editable = false, animes = []) {
  const a = animes.find(item => item.id === id), next = (a?.progress || 0) + 1;
  const sorted = [...logs].sort((x, y) => String(y.watchedAt || "").localeCompare(String(x.watchedAt || "")) || ((y.createdAtMs || 0) - (x.createdAtMs || 0)));
  const root = document.getElementById("diary-content"); if (!root) return;
  root.className = "";
  const form = editable ? `<form class="diary-form" id="diary-form">
   <div><label for="diary-episode">Episódio</label><input id="diary-episode" type="number" min="0" value="${next}" required></div>
   <div><label for="diary-date">Data</label><input id="diary-date" type="date" value="${localDateISO()}"></div>
   <div class="wide-field"><label for="diary-comment">Comentário</label><textarea id="diary-comment" required></textarea></div>
   <button type="submit">Adicionar</button><span class="diary-status" id="diary-status"></span>
  </form>` : "";
  root.innerHTML = form + `<div class="diary-list">${sorted.length ? sorted.map(log => `<article class="diary-entry"><div class="diary-entry-head"><strong>Ep. ${log.episode}</strong><span>${log.watchedAt || ""}</span></div><p>${esc(log.comment)}</p>${editable ? `<div class="diary-actions"><button type="button" data-delete-log="${log.id}">Excluir</button></div>` : ""}</article>`).join("") : '<div class="msg">Sem registos.</div>'}</div>`;
  if (!editable) return;
  document.getElementById("diary-form")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const status = document.getElementById("diary-status"), episode = Number(document.getElementById("diary-episode").value), watchedAt = document.getElementById("diary-date").value, comment = document.getElementById("diary-comment").value.trim();
    try {
      await window.hubFB.addLog({ animeId: id, episode, watchedAt, comment });
      loadDiary(id, animes, true);
    } catch (err) { status.textContent = "Erro ao salvar"; }
  });
}