// src/main.js
import { OWNER_ANILIST_USERNAME } from './config.js';
import { fetchList } from './services/anilist.js';
import { esc } from './utils/helpers.js';
import { renderHero, renderNow, setCatalogAnimes } from './views/now.js';
import { renderPanel } from './views/panel.js';
import { renderTop } from './views/top.js';
import { renderHall } from './views/hall.js';
import { renderStats } from './views/stats.js';
import { renderRanking } from './views/ranking.js';
import { openAnimeModal, loadDiary, loadExperience, getActiveDiaryAnime } from './views/modal.js';

let animes = [], tab = "now", fbUser = null, loadingCatalog = false;

async function performAniListSync(user) {
  document.getElementById("sync-status").textContent = "A sincronizar com o AniList…";
  const fresh = await fetchList(user);
  await window.hubFB.saveAniListCache(user, fresh);
  renderCatalog(fresh, user);
  document.getElementById("sync-status").textContent = `Sincronizado · ${fresh.length} animes`;
  return fresh;
}

function renderCatalog(items, user) {
  animes = items;
  setCatalogAnimes(items);
  const ys = [...new Set(animes.map(a => a.year).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById("year").innerHTML = '<option value="">Todos os anos</option>' + ys.map(y => `<option>${y}</option>`).join("");
  document.getElementById("sub").textContent = `${user} · ${animes.length} animes.`;
  renderHero(document.getElementById("hero"), document.getElementById("heroin"), animes);
  render();
}

function render() {
  const viewEl = document.getElementById("view");
  if (tab === "ranking") { document.getElementById("filters").classList.add("hidden"); document.getElementById("type").classList.add("hidden"); renderRanking(animes, viewEl, fbUser); return; }
  if (tab === "stats") { document.getElementById("filters").classList.add("hidden"); document.getElementById("type").classList.add("hidden"); renderStats(animes, viewEl, fbUser); return; }
  document.getElementById("filters").classList.toggle("hidden", tab === "now" || tab === "panel");
  document.getElementById("type").classList.toggle("hidden", tab !== "hall");
  if (tab === "now") renderNow(animes, viewEl);
  if (tab === "panel") renderPanel(animes, viewEl);
  if (tab === "top") renderTop(animes, viewEl, document.getElementById("year"), document.getElementById("season"), document.getElementById("limit"));
  if (tab === "hall") renderHall(animes, viewEl, document.getElementById("type"), document.getElementById("year"), document.getElementById("season"), document.getElementById("limit"));
}

async function load({ sync = false } = {}) {
  const user = OWNER_ANILIST_USERNAME; if (loadingCatalog) return;
  loadingCatalog = true; const button = document.getElementById("load"); button.disabled = true;
  try {
    if (!sync) {
      const cached = await window.hubFB.getAniListCache(user).catch(() => null);
      if (cached?.items?.length) { renderCatalog(cached.items, user); loadingCatalog = false; button.disabled = false; return; }
    }
    await performAniListSync(user);
  } catch (e) {
    document.getElementById("view").innerHTML = `<div class="msg err">Erro ao carregar: ${esc(e.message)}</div>`;
  } finally { loadingCatalog = false; button.disabled = false; }
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  tab = b.dataset.tab;
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b));
  if (animes.length || tab === "stats" || tab === "ranking") render();
}));

["type", "year", "season", "limit"].forEach(id => document.getElementById(id).addEventListener("change", () => animes.length && render()));

window.addEventListener("fb-user", e => { fbUser = e.detail; updateMe(); load({ sync: false }); });

function updateMe() {
  document.getElementById("me").innerHTML = fbUser ? `Logado como ${esc(fbUser.name)}` : "";
  document.getElementById("login").textContent = fbUser ? "Sair" : "Entrar com Google";
  document.getElementById("stats-tab")?.classList.toggle("hidden", !fbUser);
  document.getElementById("ranking-tab")?.classList.toggle("hidden", !fbUser);
}

document.getElementById("login").addEventListener("click", () => {
  if (!window.hubFB) { alert("Firebase não carregado."); return; }
  (fbUser ? window.hubFB.logout() : window.hubFB.login()).catch(err => alert("Erro: " + err.code));
});

document.addEventListener("click", async e => {
  const detailTab = e.target.closest("[data-detail-tab]");
  if (detailTab) {
    const name = detailTab.dataset.detailTab;
    document.querySelectorAll("[data-detail-tab]").forEach(b => b.setAttribute("aria-selected", String(b === detailTab)));
    ["themes", "experience", "diary"].forEach(tabName => document.getElementById(`detail-${tabName}`)?.classList.toggle("hidden", name !== tabName));
    if (name === "diary" && getActiveDiaryAnime() != null) loadDiary(getActiveDiaryAnime(), animes, !!fbUser);
    if (name === "experience" && getActiveDiaryAnime() != null) loadExperience(getActiveDiaryAnime(), !!fbUser);
    return;
  }
  const b = e.target.closest("[data-id]");
  if (b && !document.getElementById("dlg").contains(b)) openAnimeModal(+b.dataset.id, animes, document.getElementById("dlg"), {}, fbUser);
  const sv = e.target.closest("[data-save]");
  if (sv) {
    const key = sv.dataset.save, v = document.getElementById("sc-" + key)?.value.trim().replace(",", ".");
    try {
      if (v === "") { await window.hubFB.remove(key); document.getElementById("st-" + key).textContent = "removido"; return; }
      const n = parseFloat(v);
      if (isNaN(n) || n < 0 || n > 10) { document.getElementById("st-" + key).textContent = "0 a 10"; return; }
      await window.hubFB.save(key, n);
      document.getElementById("st-" + key).textContent = "salvo";
    } catch (err) { document.getElementById("st-" + key).textContent = "erro"; }
    return;
  }
});

document.getElementById("load").addEventListener("click", () => load({ sync: true }));
load({ sync: false });