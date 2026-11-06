/**
 * Everyone's counters and today's board, on the title and pause card (asked 2026-11-05, from Collin): fetched when
 * it opens, "—" when the API does not answer. Your name is made up from the word lists; "new name" draws another.
 */
import { useEffect, useState } from "react";
import { fmtSecs } from "@/lib/scores";
import { myName, newName, totals, type Totals } from "./scores";

const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("en-US"));

export function ScoresCard({ onBack }: { onBack: () => void }) {
  const [t, setT] = useState<Totals | null>(null);
  const [name, setName] = useState(myName);
  useEffect(() => { let live = true; void totals().then((x) => { if (live) setT(x); }); return () => { live = false; }; }, []);
  const c = t?.counts ?? undefined;
  return (
    <>
      <div className="pl-title pl-title-s">today&apos;s best</div>
      <div className="pl-sub">everyone, ever: <b>{n(c?.moop)}</b> MOOP picked up · <b>{n(c?.angel)}</b> dust angels · <b>{n(c?.bell)}</b> rings of the bell · <b>{n(c?.bump)}</b> bumps</div>
      <div className="pl-board">
        {!t ? <p>…</p> : !t.rows ? <p>the board is not answering: —</p> : !t.rows.length ? <p>no runs yet today. deliver a ride job: the clock runs from the pickup to the drop</p> : (
          <ol className="pl-board-jobs">
            {t.rows.map((r) => (
              <li key={r.job}>
                <div className="pl-board-job">{r.label}</div>
                <ol className="pl-board-top">{r.top.map((e, i) => <li key={e.name} className={e.name === name ? "pl-me" : undefined}><span>{i + 1}. {e.name}</span><span>{fmtSecs(e.secs)}</span></li>)}</ol>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="pl-board-name">you are <b>{name}</b> <button type="button" className="pl-btn" onClick={() => setName(newName())}>new name</button></div>
      <button type="button" className="pl-btn" onClick={onBack}>back</button>
    </>
  );
}
