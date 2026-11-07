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

// Funções auxiliares seguras para evitar erros de elementos nulos
function safeText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function safeHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function performAniListSync(user) {
  safeText("sync-status", "A sincronizar com o AniList…");
  const fresh = await fetchList(user);
  await window.hubFB.saveAniListCache(user, fresh);
  renderCatalog(fresh, user);
  safeText("sync-status", `Sincronizado · ${fresh.length} animes`);
  return fresh;
}

function renderCatalog(items, user) {
  animes = items;
  setCatalogAnimes(items);
  
  const yearSelect = document.getElementById("year");
  if (yearSelect) {
    const ys = [...new Set(animes.map(a => a.year).filter(Boolean))].sort((a, b) => b - a);
    yearSelect.innerHTML = '<option value="">Todos os anos</option>' + ys.map(y => `<option>${y}</option>`).join("");
  }
  
  safeText("sub", `${user} · ${animes.length} animes.`);
  
  const heroEl = document.getElementById("hero");
  const heroinEl = document.getElementById("heroin");
  if (heroEl && heroinEl) {
    renderHero(heroEl, heroinEl, animes);
  }
  
  render();
}

function render() {
  const viewEl = document.getElementById("view");
  if (!viewEl) return;

  const filtersEl = document.getElementById("filters");
  const typeEl = document.getElementById("type");

  if (tab === "ranking") { 
    filtersEl?.classList.add("hidden"); 
    typeEl?.classList.add("hidden"); 
    renderRanking(animes, viewEl, fbUser); 
    return; 
  }
  
  if (tab === "stats") { 
    filtersEl?.classList.add("hidden"); 
    typeEl?.classList.add("hidden"); 
    renderStats(animes, viewEl, fbUser); 
    return; 
  }
  
  filtersEl?.classList.toggle("hidden", tab === "now" || tab === "panel");
  typeEl?.classList.toggle("hidden", tab !== "hall");
  
  if (tab === "now") renderNow(animes, viewEl);
  if (tab === "panel") renderPanel(animes, viewEl);
  if (tab === "top") renderTop(animes, viewEl, document.getElementById("year"), document.getElementById("season"), document.getElementById("limit"));
  if (tab === "hall") renderHall(animes, viewEl, typeEl, document.getElementById("year"), document.getElementById("season"), document.getElementById("limit"));
}

async function load({ sync = false } = {}) {
  const user = OWNER_ANILIST_USERNAME; 
  if (loadingCatalog) return;
  
  loadingCatalog = true; 
  const button = document.getElementById("load"); 
  if (button) button.disabled = true;
  
  try {
    if (!sync) {
      const cached = await window.hubFB?.getAniListCache(user).catch(() => null);
      if (cached?.items?.length) { 
        renderCatalog(cached.items, user); 
        loadingCatalog = false; 
        if (button) button.disabled = false; 
        return; 
      }
    }
    await performAniListSync(user);
  } catch (e) {
    safeHTML("view", `<div class="msg err">Erro ao carregar: ${esc(e.message)}</div>`);
  } finally { 
    loadingCatalog = false; 
    if (button) button.disabled = false; 
  }
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  tab = b.dataset.tab;
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
  if (animes.length || tab === "stats" || tab === "ranking") render();
}));

// Proteção para os seletores de filtros
["type", "year", "season", "limit"].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", () => animes.length && render());
  }
});

window.addEventListener("fb-user", e => { 
  fbUser = e.detail; 
  updateMe(); 
  load({ sync: false }); 
});

function updateMe() {
  safeText("me", fbUser ? `Logado como ${esc(fbUser.name)}` : "");
  safeText("login", fbUser ? "Sair" : "Entrar com Google");
  document.getElementById("stats-tab")?.classList.toggle("hidden", !fbUser);
  document.getElementById("ranking-tab")?.classList.toggle("hidden", !fbUser);
}

// Botão de login blindado
const loginBtn = document.getElementById("login");
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    if (!window.hubFB) { alert("Firebase não carregado."); return; }
    (fbUser ? window.hubFB.logout() : window.hubFB.login()).catch(err => alert("Erro: " + err.code));
  });
}

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
  const dlg = document.getElementById("dlg");
  if (b && dlg && !dlg.contains(b)) openAnimeModal(+b.dataset.id, animes, dlg, {}, fbUser);
  
  const sv = e.target.closest("[data-save]");
  if (sv) {
    const key = sv.dataset.save, v = document.getElementById("sc-" + key)?.value.trim().replace(",", ".");
    const stEl = document.getElementById("st-" + key);
    try {
      if (v === "") { await window.hubFB.remove(key); if (stEl) stEl.textContent = "removido"; return; }
      const n = parseFloat(v);
      if (isNaN(n) || n < 0 || n > 10) { if (stEl) stEl.textContent = "0 a 10"; return; }
      await window.hubFB.save(key, n);
      if (stEl) stEl.textContent = "salvo";
    } catch (err) { if (stEl) stEl.textContent = "erro"; }
    return;
  }
});

// Botão de carregar blindado
const loadBtn = document.getElementById("load");
if (loadBtn) {
  loadBtn.addEventListener("click", () => load({ sync: true }));
}

load({ sync: false });