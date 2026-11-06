// src/views/ranking.js
import { esc, themeTypeFromSlug, isProvisionalThemeSlug } from '../utils/helpers.js';

let rankingLoading = false;
export async function renderRanking(animes, viewEl, fbUser) {
  const byId = id => animes.find(a => a.id === id);
  if (!fbUser) { viewEl.innerHTML = '<div class="msg">Entre com a conta proprietária para consultar o seu ranking musical.</div>'; return; }
  if (rankingLoading) return; rankingLoading = true;
  viewEl.innerHTML = '<div class="msg">A montar o seu ranking musical…</div>';
  try {
    const [notes, scores] = await Promise.all([window.hubFB.getAllAnimeNotes(), window.hubFB.getSongScores()]);
    const catalogByAnime = new Map(Object.entries(notes || {}).map(([id, n]) => [String(id), Array.isArray(n?.themeCatalog) ? n.themeCatalog : []]));
    const tracks = [];
    Object.entries(scores || {}).forEach(([key, rawScore]) => {
      const cut = key.indexOf(":"); if (cut < 1 || !Number.isFinite(Number(rawScore))) return;
      const id = key.slice(0, cut), slug = key.slice(cut + 1);
      if (isProvisionalThemeSlug(slug)) return;
      const theme = (catalogByAnime.get(id) || []).find(t => t.slug === slug);
      if (!theme || !['OP', 'ED'].includes(String(theme.type || themeTypeFromSlug(slug)).toUpperCase()) || !String(theme.title || '').trim()) return;
      const anime = byId(Number(id));
      const rawVideo = String(theme.video || '').trim(), video = /^https?:\/\//i.test(rawVideo) ? rawVideo : '';
      tracks.push({ id, slug, type: String(theme.type || themeTypeFromSlug(slug)).toUpperCase(), score: Number(rawScore), title: String(theme.title).trim(), artist: String(theme.artist || '').trim(), anime: anime?.title || `Anime ${id}`, video });
    });
    tracks.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt'));
    const opCount = tracks.filter(t => t.type === 'OP').length, edCount = tracks.filter(t => t.type === 'ED').length;
    const average = list => list.length ? (list.reduce((sum, t) => sum + t.score, 0) / list.length).toFixed(2).replace('.', ',') : '—';
    const renderList = (type = 'ALL', query = '') => {
      const q = query.trim().toLocaleLowerCase('pt');
      const filtered = tracks.filter(t => (type === 'ALL' || t.type === type) && (!q || [t.title, t.artist, t.anime].some(v => v.toLocaleLowerCase('pt').includes(q))));
      if (!filtered.length) return '<div class="msg">Nenhuma música encontrada com esses filtros.</div>';
      return `<ol class="ranking-list">${filtered.map((t, i) => `<li class="ranking-item"><span class="ranking-position">${i + 1}</span><div class="ranking-main"><strong>${esc(t.title)} <span class="meta">· ${t.score.toLocaleString('pt')}/10</span></strong><small>${esc(t.artist || 'Artista não identificado')} · ${t.type} · ${esc(t.anime)}</small></div><div class="ranking-links"><button type="button" data-ranking-anime="${esc(t.id)}">Ver anime</button>${t.video ? `<a href="${esc(t.video)}" target="_blank" rel="noopener noreferrer">Assistir ↗</a>` : ''}</div></li>`).join('')}</ol>`;
    };
    const html = `<div class="stats-head"><p>As suas músicas avaliadas, ordenadas da maior para a menor nota.</p><button type="button" id="ranking-refresh">Atualizar dados</button></div>
      <div class="ranking-summary"><article class="stat-card"><small>OPs no ranking</small><strong>${opCount}</strong><span>Média: ${average(tracks.filter(t => t.type === 'OP'))}/10</span></article><article class="stat-card"><small>EDs no ranking</small><strong>${edCount}</strong><span>Média: ${average(tracks.filter(t => t.type === 'ED'))}/10</span></article><article class="stat-card"><small>Total de músicas</small><strong>${tracks.length}</strong><span>Somente músicas reais</span></article></div>
      <div class="ranking-tools"><select id="ranking-type" aria-label="Tipo de música"><option value="ALL">OPs e EDs</option><option value="OP">Somente OPs</option><option value="ED">Somente EDs</option></select><input id="ranking-search" type="search" placeholder="Pesquisar música, artista ou anime…" aria-label="Pesquisar no ranking"></div>
      <div id="ranking-results">${renderList()}</div>`;
    viewEl.innerHTML = html;
    const update = () => { viewEl.querySelector("#ranking-results").innerHTML = renderList(viewEl.querySelector("#ranking-type").value, viewEl.querySelector("#ranking-search").value); };
    viewEl.querySelector("#ranking-type")?.addEventListener('change', update);
    viewEl.querySelector("#ranking-search")?.addEventListener('input', update);
    viewEl.querySelector("#ranking-refresh")?.addEventListener('click', async () => { await window.hubFB.getAllAnimeNotes({ refresh: true }); rankingLoading = false; await renderRanking(animes, viewEl, fbUser); });
  } catch (e) {
    viewEl.innerHTML = `<div class="msg err">Não consegui montar o ranking (${esc(e.code || e.message)}).</div>`;
  } finally { rankingLoading = false; }
}