// src/services/animethemes.js
const themeCache = new Map();

export async function fetchThemes(id) {
  if (themeCache.has(id)) return themeCache.get(id);
  const r = await fetch(`https://api.animethemes.moe/anime?filter[has]=resources&filter[site]=AniList&filter[external_id]=${id}&include=animethemes.animethemeentries.videos,animethemes.song.artists`);
  if (!r.ok) throw new Error(`AnimeThemes HTTP ${r.status}`);
  const j = await r.json();
  if (!j || !Array.isArray(j.anime)) throw new Error("Resposta inválida do AnimeThemes");
  
  const th = (j.anime[0]?.animethemes || []).map(t => ({
    slug: t.slug,
    type: t.type,
    title: t.song?.title || "(sem título)",
    artist: (t.song?.artists || []).map(a => a.name).join(", "),
    eps: t.animethemeentries?.[0]?.episodes || "",
    video: (t.animethemeentries?.[0]?.videos || []).sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0]?.link
  }));
  
  if (th.length) themeCache.set(id, th);
  return th;
}