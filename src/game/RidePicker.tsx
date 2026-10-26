/**
 * The garage (asked 2026-10-26): choose your ride the way a racing game does, each one seen from the side on its
 * own card with its name and three bars (speed, handling, grip), the art cars you have found on the playa after
 * them. ← → or a tap moves the choice, Enter or a second tap takes it, Escape closes.
 */
import { useEffect, useRef, useState } from "react";
import { VEHICLES, type VehicleId } from "@/lib/playa";
import { ART_CARS } from "./artcars";
import { SIDE_VIEWS } from "./sideviews";
import { soundOf } from "./PlayaLounge";

/** The rides in the garage's order, and what they are called on the cards. */
export const GARAGE_RIDES: { id: VehicleId; name: string; line: string }[] = [
  { id: "unicycle", name: "Unicycle", line: "one wheel, all balance: slow, turns on a dime, goes anywhere" },
  { id: "bike", name: "Playa Cruiser", line: "the fat-tyred beach bike every burner rides: 21 mph, through the camps" },
  { id: "tuktuk", name: "Tuktuk", line: "a three-wheeled cab with a canopy: 30 mph, quick on its feet, sticks to the streets" },
  { id: "ebike", name: "eBike", line: "the cruiser with a battery: 50 mph, a strong pull, still through the camps" },
  { id: "fish", name: "Cuttlefish Art Car", line: "a cuttlefish on wheels, colours rolling, 32 mph, loose in the dust" },
  { id: "artcar", name: "Golden Ticket Art Car", line: "a San Francisco meter-maid cart reborn in gold overnight: a bus seat, LEDs, Void sound, 36 mph" },
];
type Card = { key: string; name: string; line: string; stats: [number, number, number]; draw: (c: CanvasRenderingContext2D, t: number, night: number) => void; found?: string; near?: boolean };

export function RidePicker({ open, current, skin, garage, night, near, onPick, onDrive, onRideAlong, onClose }: {
  open: boolean; current: VehicleId; skin: string | null; garage: string[]; night: boolean;
  /** the art car you are parked beside, aboard or driving (asked 2026-10-26: R opens the garage and it is the first card) */
  near?: { id: string; name: string; aboard: boolean; driving: boolean } | null;
  onPick: (id: VehicleId) => void; onDrive: (id: string) => void; onRideAlong: () => void; onClose: () => void;
}) {
  const maxSpeed = Math.max(...GARAGE_RIDES.map((r) => VEHICLES[r.id].maxSpeed)), maxYaw = Math.max(...GARAGE_RIDES.map((r) => VEHICLES[r.id].maxYaw)), maxGrip = Math.max(...GARAGE_RIDES.map((r) => VEHICLES[r.id].grip));
  const nearDraw = near && ART_CARS[near.id];
  const cards: Card[] = [
    ...(near ? [{ key: `near:${near.id}`, name: near.name, line: near.driving ? "you are at its wheel" : near.aboard ? "you are riding along on it" : "right beside you: ride along on it, or take its wheel", stats: [VEHICLES.found.maxSpeed / maxSpeed, VEHICLES.found.maxYaw / maxYaw, VEHICLES.found.grip / maxGrip] as [number, number, number],
      draw: (c: CanvasRenderingContext2D, t: number, n: number) => { c.save(); c.translate(0, -30); c.scale(1.3, 1.3); c.rotate(Math.PI / 2); if (nearDraw) nearDraw(c, t, n); else { c.fillStyle = "#4b5068"; c.beginPath(); c.roundRect(-10, -32, 20, 64, 5); c.fill(); } c.restore(); }, near: true }] : []),
    ...GARAGE_RIDES.map((r) => { const v = VEHICLES[r.id]; return { key: r.id, name: r.name, line: r.line, stats: [v.maxSpeed / maxSpeed, v.maxYaw / maxYaw, v.grip / maxGrip] as [number, number, number], draw: SIDE_VIEWS[r.id] }; }),
    ...garage.filter((id) => ART_CARS[id] && id !== near?.id).map((id) => { // the car beside you is the first card already, not a second one here
      const v = VEHICLES.found, draw = ART_CARS[id];
      return { key: `found:${id}`, name: soundOf(`mutant:${id}`).name, line: "found on the playa: yours to drive, its music aboard", stats: [v.maxSpeed / maxSpeed, v.maxYaw / maxYaw, v.grip / maxGrip] as [number, number, number],
        draw: (c: CanvasRenderingContext2D, t: number, n: number) => { c.save(); c.translate(0, -30); c.scale(1.3, 1.3); c.rotate(Math.PI / 2); draw(c, t, n); c.restore(); }, found: id };
    }),
  ];
  const currentKey = near && (near.aboard || near.driving) ? `near:${near.id}` : current === "found" && skin ? `found:${skin}` : current;
  const [sel, setSel] = useState(Math.max(0, cards.findIndex((c) => c.key === currentKey)));
  useEffect(() => { if (open) setSel(Math.max(0, cards.findIndex((c) => c.key === currentKey))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const take = (i: number) => { const c = cards[i]; if (!c) return; if (c.near) onRideAlong(); else if (c.found) onDrive(c.found); else onPick(c.key as VehicleId); };
  // one loop draws every card, so the wheels turn and the lights play
  useEffect(() => {
    if (!open) return;
    let raf = 0; const t0 = performance.now();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = (performance.now() - t0) / 1000;
      cards.forEach((card, i) => {
        const cv = canvases.current[i]; if (!cv) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), w = 220, h = 124;
        if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
        const c = cv.getContext("2d"); if (!c) return;
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
        c.fillStyle = night ? "#2b2f52" : "#e6d3ae"; c.fillRect(0, 0, w, h);
        c.fillStyle = night ? "#20233f" : "#d8c095"; c.fillRect(0, h - 22, w, 22);
        c.save(); c.translate(w / 2, h - 22); card.draw(c, t, night ? 1 : 0); c.restore();
      });
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [open, night, cards.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const row = document.querySelector<HTMLElement>(".pl-garage-cards"), el = row?.children[sel] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [open, sel]);
  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    const cols = (() => { const row = document.querySelector<HTMLElement>(".pl-garage-cards"); if (!row || row.children.length < 2) return 1; const top = (row.children[0] as HTMLElement).offsetTop; let n = 1; while (n < row.children.length && (row.children[n] as HTMLElement).offsetTop === top) n++; return n; })();
    if (e.key === "ArrowRight") { e.preventDefault(); setSel((s) => Math.min(cards.length - 1, s + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(cards.length - 1, s + cols)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - cols)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); take(sel); }
    else if (e.key === "Escape" || e.key === "v" || e.key === "V") { e.preventDefault(); onClose(); }
    e.stopPropagation();
  };
  return (
    <div className="pl-garage" role="dialog" aria-modal="true" aria-label="choose your ride" onKeyDown={onKey} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="pl-garage-head"><b>choose your ride</b><button type="button" className="pl-lg-btn" onClick={onClose} aria-label="close">×</button></div>
      <div className="pl-garage-cards" role="listbox" aria-activedescendant={`pl-card-${sel}`}>
        {cards.map((card, i) => (
          <button type="button" key={card.key} id={`pl-card-${i}`} role="option" aria-selected={i === sel} className={`pl-card${i === sel ? " pl-card-sel" : ""}${card.found || card.near ? " pl-card-found" : ""}`}
            onClick={() => (i === sel ? take(i) : setSel(i))} onDoubleClick={() => take(i)}>
            <canvas ref={(el) => { canvases.current[i] = el; }} width={220} height={124} aria-hidden="true" />
            <span className="pl-card-name">{card.found || card.near ? "★ " : ""}{card.name}{card.key === currentKey ? <span className="pl-card-now"> · yours now</span> : null}</span>
            <span className="pl-card-line">{card.line}</span>
            {card.near && near && (
              <span className="pl-card-acts">
                <span role="button" tabIndex={0} className="pl-lg-btn pl-lg-ride" onClick={(e) => { e.stopPropagation(); onRideAlong(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRideAlong(); } }}>{near.aboard || near.driving ? "hop off" : "ride along"}</span>
                {nearDraw && !near.driving && <span role="button" tabIndex={0} className="pl-lg-btn pl-lg-ride pl-lg-drive" onClick={(e) => { e.stopPropagation(); onDrive(near.id); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDrive(near.id); } }}>drive it</span>}
              </span>
            )}
            <span className="pl-card-stats">
              {(["speed", "handling", "grip"] as const).map((label, k) => (
                <span key={label} className="pl-card-stat"><span className="pl-card-stat-name">{label}</span><span className="pl-card-bar"><span style={{ width: `${Math.round(card.stats[k] * 100)}%` }} /></span></span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="pl-garage-hint">{cards[sel]?.near ? "ride along on it, or take its wheel" : cards[sel]?.found ? "tap again to take the wheel" : "tap again or press Enter to ride it"} · arrows to look · Esc to close</div>
    </div>
  );
}
