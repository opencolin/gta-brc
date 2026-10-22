"use client";
import { useEffect, type RefObject } from "react";

/**
 * A game board takes the keyboard when its window is the chosen one: on opening, and whenever
 * the desktop brings the window forward (its title bar, the dock — Desktop.tsx announces it
 * as agentcamp:focus-window, the way PtyWin hears it). Never while another window is the
 * focused one — a desk restored at login must not pull the keys out of a terminal — and never
 * away from a control in this window that already has them. Shared by every game in the
 * folder, so each board's keys behave the same.
 */
export function useBoardFocus(board: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = board.current;
    const win = el?.closest<HTMLElement>("[data-win]") ?? null;
    const take = () => {
      const a = document.activeElement;
      if (!el || (a && a !== document.body && win?.contains(a))) return;
      el.focus({ preventScroll: true });
    };
    if (!win || win.classList.contains("focused")) take();
    const onWindow = (e: Event) => { if (win && (e as CustomEvent).detail === win.dataset.win) take(); };
    window.addEventListener("agentcamp:focus-window", onWindow);
    return () => window.removeEventListener("agentcamp:focus-window", onWindow);
    // the ref object is stable; the board element is read once, when the window mounts
  }, [board]);
}
