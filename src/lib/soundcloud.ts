/** SoundCloud's widget: its origin, the command shape api.js posts, and its event messages. (From AgentCamp's lib/soundcloud.ts.) */
export const SC_WIDGET_ORIGIN = "https://w.soundcloud.com";
export const SC_WIDGET_SRC = /^https:\/\/w\.soundcloud\.com\/player\//i;

/** A command for the widget, in the shape api.js posts: a JSON string of { method, value }. */
export function scWidgetCommand(method: "pause" | "play" | "addEventListener" | "setVolume", value?: string | number): string {
  return JSON.stringify(value === undefined ? { method } : { method, value });
}

/** A message from the widget → the event it reports ("ready", "play", …), or null for anything else. */
export function scWidgetEvent(origin: string, data: unknown): string | null {
  if (origin !== SC_WIDGET_ORIGIN) return null;
  let d: any = data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return null; } }
  return d && typeof d === "object" && typeof d.method === "string" ? d.method : null;
}
