// src/views/stats.js
import { esc } from '../utils/helpers.js';
import { themeTypeFromSlug, isProvisionalThemeSlug } from '../utils/helpers.js';

const statNum = n => Number(n || 0).toLocaleString("pt-PT");
const statPct = (n, total) => total ? `${Math.round(n / total * 100)}%` : "0%";
const statBars = (entries, total) => {
  if (!entries.length) return '<p class="meta">Sem dados registados.</p>';
  const max = Math.max(1, ...entries.map(x => x[1]));
  return entries.map(([label, value]) => `<div class="stat-line"><span>${esc(label)}</span><div class="stat-track"><i style="width:${Math.max(0, value / max * 100)}%"></i></div><b>${statNum(value)} <span class="meta">(${statPct(value, total)})</span></b></div>`).join("");
};
const statList = (entries, empty = "Sem dados registados.") => {
  return entries.length ? `<ul class="stat-list">${entries.map(([label, value]) => `<li><span>${esc(label)}</span><b>${esc(value)}</b></li>`).join("")}</ul>` : `<p class="meta">${empty}</p>`;
};

let statsLoading = false;
export async function renderStats(animes, viewEl, fbUser, refresh = false) {
  const byId = id => animes.find(a => a.id === id);
  if (!fbUser) { viewEl.innerHTML = '<div class="msg">Entre com a conta proprietária para consultar as suas estatísticas pessoais.</div>'; return; }
  if (statsLoading) return; statsLoading = true;
  viewEl.innerHTML = '<div class="msg">A calcular as suas estatísticas pessoais…</div>';
  try {
    const [notes, logs, scores] = await Promise.all([
      window.hubFB.getAllAnimeNotes({ refresh }), window.hubFB.getAllEpisodeLogs({ refresh }), window.hubFB.getSongScores()
    ]);
    const noteRows = Object.entries(notes || {}), noteValues = noteRows.map(([, v]) => v || {}), totalNotes = noteRows.length;
    const languages = { dub: 0, sub: 0, other: 0, unknown: 0 };
    const platformCounts = new Map(); let noPlatform = 0, withPlatform = 0, withViewingNotes = 0, withThemeComments = 0, totalThemeComments = 0;
    noteValues.forEach(n => {
      if (Object.prototype.hasOwnProperty.call(languages, n.language) && n.language) languages[n.language]++; else languages.unknown++;
      const ps = Array.isArray(n.platforms) ? n.platforms.filter(Boolean) : [], customPlatform = String(n.otherPlatform || "").trim();
      const normalizedPlatforms = ps.map(p => p === "Outra" && customPlatform ? customPlatform : p);
      if (customPlatform && !normalizedPlatforms.includes(customPlatform)) normalizedPlatforms.push(customPlatform);
      if (normalizedPlatforms.length) { withPlatform++; normalizedPlatforms.forEach(p => platformCounts.set(p, (platformCounts.get(p) || 0) + 1)); }
      else noPlatform++;
      if (String(n.viewingNotes || "").trim()) withViewingNotes++;
      const comments = Object.values(n.themeComments || {}).filter(v => String(v || "").trim());
      if (comments.length) withThemeComments++;
      totalThemeComments += comments.length;
    });
    const platforms = [...platformCounts.entries()].sort((a, b) => b[1] - a[1]);
    const logRows = Array.isArray(logs) ? logs : [], logAnimeCounts = new Map(), months = new Map(); let datedLogs = 0;
    logRows.forEach(l => {
      const id = String(l.animeId ?? ""); logAnimeCounts.set(id, (logAnimeCounts.get(id) || 0) + 1);
      const m = String(l.watchedAt || "").match(/^(\d{4})-(\d{2})/);
      if (m) { const key = `${m[1]}-${m[2]}`; months.set(key, (months.get(key) || 0) + 1); datedLogs++; }
    });
    const monthNames = new Intl.DateTimeFormat("pt-PT", { month: "short", year: "numeric" });
    const monthEntries = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => { const [y, m] = k.split("-").map(Number); return [monthNames.format(new Date(y, m - 1, 1)), v]; });
    const animeTitle = id => byId(Number(id))?.title || `Anime ${id}`;
    const mostLogged = [...logAnimeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => [animeTitle(id), `${n} registo(s)`]);
    const catalogByAnime = new Map(noteRows.map(([id, n]) => [String(id), Array.isArray(n?.themeCatalog) ? n.themeCatalog : []]));
    const ratedSongs = [];
    Object.entries(scores || {}).forEach(([key, score]) => {
      const cut = key.indexOf(":"); if (cut < 1 || !Number.isFinite(Number(score))) return;
      const id = key.slice(0, cut), slug = key.slice(cut + 1), catalog = catalogByAnime.get(id) || [], theme = catalog.find(t => t.slug === slug);
      const type = theme?.type || themeTypeFromSlug(slug); if (!["OP", "ED"].includes(type)) return;
      ratedSongs.push({ id, slug, type, score: Number(score), title: theme?.title || (isProvisionalThemeSlug(slug) ? `${type} provisória` : slug), artist: theme?.artist || "", anime: animeTitle(id) });
    });
    const songStats = { OP: ratedSongs.filter(x => x.type === "OP"), ED: ratedSongs.filter(x => x.type === "ED") };
    const avg = arr => arr.length ? (arr.reduce((sum, x) => sum + x.score, 0) / arr.length).toFixed(1).replace(".", ",") : "—";
    const artistCounts = new Map(); ratedSongs.filter(x => x.artist).forEach(x => x.artist.split(/,\s*/).filter(Boolean).forEach(a => artistCounts.set(a, (artistCounts.get(a) || 0) + 1)));
    const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a, n]) => [a, `${n} música(s)`]);
    const topSongs = [...ratedSongs].sort((a, b) => b.score - a.score).slice(0, 5).map(x => [`${x.title} · ${x.anime}`, `${x.score}/10`]);
    const scoreRanges = [["0–5,9", 0], ["6–6,9", 0], ["7–7,9", 0], ["8–8,9", 0], ["9–9,4", 0], ["9,5–10", 0]];
    ratedSongs.forEach(x => { const i = x.score < 6 ? 0 : x.score < 7 ? 1 : x.score < 8 ? 2 : x.score < 9 ? 3 : x.score < 9.5 ? 4 : 5; scoreRanges[i][1]++; });
    const scoreTotal = ratedSongs.length;
    const diaryAnimeCount = logAnimeCounts.size, unknownDate = logRows.length - datedLogs;
    const html = `<div class="stats-head"><p>Indicadores calculados a partir das suas anotações, avaliações e diário.</p><button type="button" id="stats-refresh">Atualizar dados</button></div>
      <div class="stats-grid">
       <article class="stat-card"><small>Animes com dados pessoais</small><strong>${statNum(totalNotes)}</strong><span>Documentos de experiência/OP-ED</span></article>
       <article class="stat-card"><small>Registos no diário</small><strong>${statNum(logRows.length)}</strong><span>${statNum(diaryAnimeCount)} anime(s) com diário</span></article>
       <article class="stat-card"><small>Músicas avaliadas</small><strong>${statNum(scoreTotal)}</strong><span>${songStats.OP.length} OPs · ${songStats.ED.length} EDs</span></article>
       <article class="stat-card"><small>Comentários de OP/ED</small><strong>${statNum(totalThemeComments)}</strong><span>Em ${statNum(withThemeComments)} anime(s)</span></article>
      </div>
      <section class="stats-section"><h2>Como assiste</h2><div class="stats-columns">
       <div class="stats-panel"><h3>Idioma de consumo</h3>${statBars([["Legendado", languages.sub], ["Dublado", languages.dub], ["Outro", languages.other], ["Não informado", languages.unknown]], totalNotes)}</div>
       <div class="stats-panel"><h3>Plataformas</h3>${statBars(platforms, totalNotes)}</div>
      </div></section>
      <section class="stats-section"><h2>Diário de episódios</h2><div class="stats-columns">
       <div class="stats-panel"><h3>Registos por mês</h3>${statBars(monthEntries, logRows.length)}</div>
       <div class="stats-panel"><h3>Animes com mais registos</h3>${statList(mostLogged, "Ainda não há registos no diário.")}</div>
      </div></section>
      <section class="stats-section"><h2>Openings e endings</h2><div class="stats-grid">
       <article class="stat-card"><small>Média das OPs</small><strong>${avg(songStats.OP)}<span style="display:inline;font:400 .85rem var(--sans)"> / 10</span></strong><span>${songStats.OP.length} avaliadas</span></article>
       <article class="stat-card"><small>Média das EDs</small><strong>${avg(songStats.ED)}<span style="display:inline;font:400 .85rem var(--sans)"> / 10</span></strong><span>${songStats.ED.length} avaliadas</span></article>
      </div><div class="stats-columns">
       <div class="stats-panel"><h3>Distribuição das notas</h3>${statBars(scoreRanges, scoreTotal)}</div>
       <div class="stats-panel"><h3>Artistas mais avaliados</h3>${statList(topArtists, "Não há artistas identificados.")}<h3 style="margin-top:22px">Músicas mais bem avaliadas</h3>${statList(topSongs, "Ainda não há músicas avaliadas.")}</div>
      </div></section>`;
    viewEl.innerHTML = html;
    viewEl.querySelector("#stats-refresh")?.addEventListener("click", () => renderStats(animes, viewEl, fbUser, true));
  } catch (e) {
    viewEl.innerHTML = `<div class="msg err">Não consegui calcular as estatísticas (${esc(e.code || e.message)}).</div>`;
  } finally { statsLoading = false; }
}