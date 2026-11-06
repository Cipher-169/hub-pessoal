// src/config.js
export const HUB_VERSION = 9;
export const OWNER_ANILIST_USERNAME = "Clpher";
export const OWNER_UID = "X569uLFYFgcX6i9mbEVsylUX7Li1";

export const QUERY = `query($u:String){MediaListCollection(userName:$u,type:ANIME){lists{entries{
 status progress score(format:POINT_100)
 media{id siteUrl season seasonYear episodes status bannerImage coverImage{extraLarge large} title{romaji english}}}}}}`;

export const TIERS = [
  [100, "Masterpiece", "#f2c46d"],
  [95, "Almost Perfect", "#ff7a4d"],
  [90, "Excellent", "#f5a63c"],
  [85, "Very Good", "#7ac36a"],
  [80, "Good", "#4aa8e0"],
  [75, "Decent", "#98a2bd"],
  [70, "Average", "#a89fb5"],
  [60, "Bad", "#d98a3a"],
  [0, "Very Bad", "#c0453f"]
];

export const SEASONS = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };

export const PROVISIONAL_THEME_SLUGS = { OP: "provisional_op", ED: "provisional_ed" };