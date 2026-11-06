// src/views/hall.js
import { esc, badge, sbadge, themeTypeFromSlug, isProvisionalThemeSlug } from '../utils/helpers.js';
import { fetchThemes } from '../services/animethemes.js';

const filtered = (l, yearEl, seasonEl) => { const y = yearEl.value, s = seasonEl.value; return l.filter(i => (!y || String(i.year) === y) && (!s || i.season === s)); };

function ranking(items) {
  if (!items.length) return '<div class="msg">Nada com esses filtros.</div>';
  const pod = items.slice(0, 3), rest = items.slice(3);
  return `<div class="podium">${pod.map((a, k) => `<div class="pod"><span class="num">${k + 1}</span><button class="poster" data-id="${a.id}"><img src="${a.cover}" alt=""></button>
    <div class="info"><b>${esc(a.title)}</b><small class="meta">${esc(a.sub)}</small><div style="margin-top:6px">${(a.song ? sbadge(a.score) : badge(a.score))}</div></div></div>`).join("")}</div>
   <ol class="list">${rest.map((a, k) => `<li><button class="row" data-id="${a.id}"><span class="pos">${k + 4}</span><img src="${a.cover}" alt="" loading="lazy"><div><b>${esc(a.title)}</b><div class="meta">${esc(a.sub)}</div></div>${(a.song ? sbadge(a.score) : badge(a.score))}</button></li>`).join("")}</ol>`;
}

export async function renderHall(animes, viewEl, typeEl, yearEl, seasonEl, limitEl) {
  viewEl.innerHTML = '<div class="msg">A carregar notas das músicas…</div>';
  let SONG_SCORES = {};
  try {
    SONG_SCORES = await window.hubFB.getSongScores();
  } catch (e) {
    viewEl.innerHTML = `<div class="msg err">Não consegui carregar as notas das músicas (${esc(e.code || e.message)}).</div>`; return;
  }
  const keys = Object.keys(SONG_SCORES);
  if (!keys.length) { viewEl.innerHTML = '<div class="msg">Ainda não há músicas com nota.</div>'; return; }
  const ids = [...new Set(keys.map(k => Number(k.split(":")[0])).filter(Number.isFinite))], catalogs = new Map();
  let offlineCount = 0, apiFailureCount = 0;
  const byId = id => animes.find(a => a.id === id);
  await Promise.all(ids.map(async id => {
    let themes = [];
    try { themes = await fetchThemes(id); } catch (e) { apiFailureCount++; }
    if (!themes.length) {
      try {
        const note = await window.hubFB.getAnimeNote(id);
        if (Array.isArray(note?.themeCatalog) && note.themeCatalog.length) { themes = note.themeCatalog; offlineCount++; }
      } catch (e) {}
    }
    catalogs.set(id, new Map(themes.map(t => [t.slug, t])));
  }));
  const items = [];
  keys.forEach(key => {
    const cut = key.indexOf(":"); if (cut < 1) return;
    const id = Number(key.slice(0, cut)), slug = key.slice(cut + 1), score = SONG_SCORES[key];
    if (!Number.isFinite(id) || score == null) return;
    const theme = catalogs.get(id)?.get(slug), a = byId(id);
    const inferredType = themeTypeFromSlug(slug);
    const type = theme?.type || inferredType;
    items.push({ type, season: a?.season, year: a?.year, id, cover: a?.cover || "", title: theme?.title || (isProvisionalThemeSlug(slug) ? `${inferredType} provisória` : slug), sub: `${theme?.artist ? theme.artist + " · " : ""}${a?.title || "Anime " + id}`, score, song: true });
  });
  const selected = items.filter(i => i.type === typeEl.value);
  const l = filtered(selected, yearEl, seasonEl).sort((a, b) => b.score - a.score).slice(0, +limitEl.value);
  const notice = apiFailureCount ? `<p class="meta">AnimeThemes falhou ao responder para ${apiFailureCount} anime(s).</p>` : "";
  viewEl.innerHTML = notice + ranking(l);
}