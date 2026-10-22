import { useSyncExternalStore } from "react";

/** A phone: narrow, or a touch screen on its side. (From AgentCamp's MobileShell.) */
export const MOBILE_QUERY = "(max-width: 760px), (max-height: 500px) and (pointer: coarse), (max-width: 834px) and (pointer: coarse)";
let mql: MediaQueryList | null = null;
const query = () => (mql ??= matchMedia(MOBILE_QUERY));
const subscribe = (cb: () => void) => {
  const mq = query();
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => query().matches, () => false);
}
