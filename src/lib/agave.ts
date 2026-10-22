/** Agave Lounge: the camp whose dome the game starts at, its DJ sets and the SoundCloud embed. (From AgentCamp's lib/agave.ts.) */
export const AGAVE_IMG = "/agave/";
export const SETS: { url: string; title: string; artist: string; year?: number; where?: string; art: string }[] = [
  { url: "https://soundcloud.com/brunchlife/brunchlife-live-at-agave-lounge-burning-man-2022", title: "Live at Agave Lounge · Burning Man 2022", artist: "Brunch Life", year: 2022, art: "https://i1.sndcdn.com/artworks-5AvsMRVLnbVZBCMg-s3YBzw-t500x500.jpg" },
  { url: "https://soundcloud.com/bossbagels/burning-man-2023-agave-lounge", title: "Burning Man 2023 · Agave Lounge", artist: "Lou E. Bagels", year: 2023, art: "https://i1.sndcdn.com/artworks-PUMkmaLlDyxV3oVb-v6iwZg-t500x500.jpg" },
  { url: "https://soundcloud.com/paloma_music/paloma-burning-man-live-agave-loungewav", title: "Burning Man live @ Agave Lounge", artist: "PALOMA", art: "https://i1.sndcdn.com/artworks-gwO4q0uuJJUNSzqr-LZ1oUQ-t500x500.jpg" },
  { url: "https://soundcloud.com/bearfoot_sound/burning-man-2022-agave-lounge-crisis-averted", title: "Crisis Averted @ Agave Lounge", artist: "Bear Foot Sound", year: 2022, art: "https://i1.sndcdn.com/artworks-gIRBQpfbAwaFew0l-jADyMQ-t500x500.jpg" },
];
export const scPlayer = (url: string, autoPlay: boolean, visual = true) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff6b9a&auto_play=${autoPlay}&hide_related=true&show_comments=false&show_reposts=false&show_teaser=false&visual=${visual}`;

