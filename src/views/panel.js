import { esc, badge, bg } from '../utils/helpers.js';

export function renderPanel(animes, viewEl) {
  const rated = animes.filter(a => a.score > 0 && a.year);
  const years = [...new Set(rated.map(a => a.year))].sort((a, b) => b - a);
  const SEASONS = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };
  if (!years.length) { viewEl.innerHTML = '<div class="msg">Ainda não há animes com nota e ano.</div>'; return; }
  viewEl.innerHTML = '<p class="meta">Clique num ano ou numa temporada pra ver o top completo.</p>' + years.map(y => {
    const ys = rated.filter(a => a.year === y).sort((a, b) => b.score - a.score);
    const cells = Object.keys(SEASONS).map(k => {
      const l = ys.filter(a => a.season === k);
      if (!l.length) return `<div class="cell empty"><span class="meta">${SEASONS[k]}</span><span class="meta">sem notas</span></div>`;
      const t = l[0];
      return `<button class="cell" data-go="${y}|${k}" ${bg(t.banner || t.cover)}><span class="sn">${SEASONS[k]}<em>${l.length} com nota</em></span><b>${esc(t.title)}</b>${badge(t.score)}${l.slice(1, 3).map(a => `<span class="mini"><span>${esc(a.title)}</span><i>${a.score}</i></span>`).join("")}</button>`;
    }).join("");
    return `<section class="yr"><h2><button class="yb" data-go="${y}|">${y}</button><span class="meta">${ys.length} com nota · melhor do ano: ${esc(ys[0].title)} (${ys[0].score})</span></h2><div class="seasons">${cells}</div></section>`;
  }).join("");
}