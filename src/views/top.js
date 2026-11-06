import { esc, when, badge, sbadge } from '../utils/helpers.js';

const filtered = (l, yearEl, seasonEl) => { const y = yearEl.value, s = seasonEl.value; return l.filter(i => (!y || String(i.year) === y) && (!s || i.season === s)); };

function ranking(items) {
  if (!items.length) return '<div class="msg">Nada com esses filtros.</div>';
  const pod = items.slice(0, 3), rest = items.slice(3);
  return `<div class="podium">${pod.map((a, k) => `<div class="pod"><span class="num">${k + 1}</span><button class="poster" data-id="${a.id}"><img src="${a.cover}" alt=""></button>
    <div class="info"><b>${esc(a.title)}</b><small class="meta">${esc(a.sub)}</small><div style="margin-top:6px">${(a.song ? sbadge(a.score) : badge(a.score))}</div></div></div>`).join("")}</div>
   <ol class="list">${rest.map((a, k) => `<li><button class="row" data-id="${a.id}"><span class="pos">${k + 4}</span><img src="${a.cover}" alt="" loading="lazy"><div><b>${esc(a.title)}</b><div class="meta">${esc(a.sub)}</div></div>${(a.song ? sbadge(a.score) : badge(a.score))}</button></li>`).join("")}</ol>`;
}

export function renderTop(animes, viewEl, yearEl, seasonEl, limitEl) {
  const l = filtered(animes.filter(a => a.score > 0), yearEl, seasonEl).sort((a, b) => b.score - a.score).slice(0, +limitEl.value);
  viewEl.innerHTML = ranking(l.map(a => ({ id: a.id, cover: a.cover, title: a.title, sub: when(a), score: a.score })));
}