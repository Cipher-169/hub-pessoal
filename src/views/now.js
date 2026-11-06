import { esc, when, bg } from '../utils/helpers.js';

export const poster = a => {
  const cur = ["CURRENT", "REPEATING"].includes(a.status), pct = a.eps ? Math.min(100, a.progress / a.eps * 100) : 0;
  return `<button class="poster" data-id="${a.id}"><img src="${a.cover}" alt="" loading="lazy"><div class="cap"><b>${esc(a.title)}</b>${cur ? `<div class="pb"><i style="width:${pct}%"></i></div><span>ep ${a.progress}${a.eps ? " / " + a.eps : ""}</span>` : `<span>${when(a)}</span>`}</div></button>`;
};

export const wide = a => {
  const pct = a.eps ? Math.min(100, a.progress / a.eps * 100) : 0;
  return `<button class="wide" data-id="${a.id}" ${bg(a.banner)}><img src="${a.cover}" alt=""><div><b>${esc(a.title)}</b><div class="meta">${when(a)}</div><div class="pb"><i style="width:${pct}%"></i></div><span class="meta">ep ${a.progress}${a.eps ? " / " + a.eps : ""}</span></div></button>`;
};

const sec = (t, l, f, c) => l.length ? `<h2>${t} <span class="meta">${l.length}</span></h2><div class="${c}">${l.map(f).join("")}</div>` : "";

export function renderNow(animes, viewEl) {
  const w = animes.filter(a => ["CURRENT", "REPEATING"].includes(a.status)), p = animes.filter(a => a.status === "PLANNING");
  const now = p.filter(a => a.airing === "RELEASING"), soon = p.filter(a => a.airing === "NOT_YET_RELEASED"), old = p.filter(a => !["RELEASING", "NOT_YET_RELEASED"].includes(a.airing));
  viewEl.innerHTML = sec("Assistindo", w, wide, "wides") + sec("Planejo, no ar agora", now, poster, "grid") + sec("Planejo, em breve", soon, poster, "grid") +
   (old.length ? `<details><summary>Planejo, já lançados (${old.length})</summary><div class="grid">${old.map(poster).join("")}</div></details>` : "");
}