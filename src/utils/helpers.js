// src/utils/helpers.js
import { TIERS, SEASONS, PROVISIONAL_THEME_SLUGS } from '../config.js';

export const tier = s => TIERS.find(t => s >= t[0]);

export const badge = s => {
  const t = tier(s);
  return `<span class="tier" style="--c:${t[2]}">${s}<small>${t[1]}</small></span>`;
};

export const sbadge = s => {
  const t = tier(s * 10);
  return `<span class="tier" style="--c:${t[2]}">${s}<small>/10</small></span>`;
};

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const $ = id => document.getElementById(id);

export const when = a => [SEASONS[a.season], a.year].filter(Boolean).join(" ");

export const bg = u => u ? `style="background-image:url('${u}')"` : "";

export const localDateISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const themeTypeFromSlug = slug => {
  const value = String(slug || "");
  if (value === PROVISIONAL_THEME_SLUGS.OP) return "OP";
  if (value === PROVISIONAL_THEME_SLUGS.ED) return "ED";
  return value.toUpperCase().match(/^(OP|ED)/)?.[1] || "";
};

export const isProvisionalThemeSlug = slug => Object.values(PROVISIONAL_THEME_SLUGS).includes(slug);