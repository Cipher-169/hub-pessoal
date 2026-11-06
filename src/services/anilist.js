// src/services/anilist.js
import { QUERY } from '../config.js';

export async function fetchList(user) {
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { u: user } })
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  
  const seen = new Map();
  j.data.MediaListCollection.lists.forEach(l => l.entries.forEach(e => {
    if (!seen.has(e.media.id)) seen.set(e.media.id, e);
  }));
  
  return [...seen.values()].map(e => ({
    id: e.media.id,
    title: e.media.title.english || e.media.title.romaji,
    cover: e.media.coverImage.extraLarge || e.media.coverImage.large,
    banner: e.media.bannerImage,
    url: e.media.siteUrl,
    season: e.media.season,
    year: e.media.seasonYear,
    eps: e.media.episodes,
    airing: e.media.status,
    status: e.status,
    progress: e.progress,
    score: e.score
  }));
}