import { useEffect, useState } from "react";

import { loadJSON, saveJSON } from "./storage";

/* ============================ constants ============================ */

/* Deliberately a different palette to the other app on this domain: navy and
   blue instead of near-black and red, so the two home-screen icons and the two
   apps are never mistaken for each other. */
const INK = "#0B1220";
const PUSH_C = "#1D4ED8";
const PULL_C = "#0E7490";
const LEGS_C = "#6D28D9";
const REST_C = "#475569";
const WIN = "#15803D";
const WASH = "#F2F4F8";
const RULE = "#AEB6C2";
const MUTE = "#334155";
const GRID = "#DDE2EA";
const DISPLAY = "'Arial Black','Helvetica Neue',Impact,sans-serif";
const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const LIBRARY = {
  chest: ["Bench press", "Incline bench press", "Cable flys"],
  triceps: ["Tricep rope pushdowns", "Overhead extensions", "Lion push downs"],
  shoulders: ["Lateral raises", "Shoulder press"],
  back: [
    "Lat pulldowns",
    "1-arm lat pulldowns",
    "Machine rows",
    "1-arm dumbbell rows",
    "Barbell shrugs",
  ],
  biceps: [
    "African curls",
    "Incline curls",
    "Cable hammer curls",
    "Spider curls",
    "Preacher curls",
    "EZ bar curls",
    "Cable curls",
  ],
  rearDelts: ["Face pulls", "Cable pulls"],
  legs: [
    "Squat",
    "Bulgarian split squat",
    "Leg extension",
    "Seated leg curl",
    "Calf raises",
    "Wall sits",
  ],
};

const GROUP_NAMES = {
  chest: "Chest",
  triceps: "Triceps",
  shoulders: "Shoulders",
  back: "Back",
  biceps: "Biceps",
  rearDelts: "Rear delts",
  legs: "Legs",
};

const DEFAULT_PICKS = {
  chest: ["Bench press", "Incline bench press"],
  triceps: ["Tricep rope pushdowns", "Overhead extensions"],
  shoulders: ["Lateral raises", "Shoulder press"],
  back: ["Lat pulldowns", "Machine rows"],
  biceps: ["African curls", "Incline curls"],
  rearDelts: ["Face pulls"],
  legs: ["Squat", "Leg extension", "Seated leg curl"],
};

const PUSH_DAY = {
  key: "push",
  label: "Push",
  groups: ["chest", "triceps", "shoulders"],
  color: PUSH_C,
};
const PULL_DAY = {
  key: "pull",
  label: "Pull",
  groups: ["back", "biceps", "rearDelts"],
  color: PULL_C,
};
const LEGS_DAY = { key: "legs", label: "Legs", groups: ["legs"], color: LEGS_C };
const REST_DAY = { key: "rest", label: "Rest", groups: [], color: REST_C };

/* Push, Pull, Legs, Rest — then round again. Four days, so the rest day walks
   through the week rather than landing on a fixed day. */
const CYCLE = [PUSH_DAY, PULL_DAY, LEGS_DAY, REST_DAY];
const CYCLE_LEN = CYCLE.length;
/* three training days in every four: about five a week */
const SESSIONS_PER_WEEK = 5;

const SETS = 3;
const REP_LOW = 6;
const REP_HIGH = 12;

const GOALS = {
  bulk: { label: "Bulk", cardio: "No cardio", days: 0 },
  cut: { label: "Cut", cardio: "Cardio every day", days: 7 },
  maintain: { label: "Maintain", cardio: "Cardio Monday to Friday", days: 5 },
};

/* Cut = every day. Bulk = never. Maintain = five a week, and since a four-day
   rotation drifts through the week that has to key off the date, not the cycle:
   Monday to Friday, weekends clear. */
const weekday = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};
const cardioDue = (goal, iso) =>
  goal === "cut"
    ? true
    : goal === "maintain"
    ? weekday(iso) >= 1 && weekday(iso) <= 5
    : false;

/* ============================ helpers ============================ */

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const shiftDay = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
};

const dayNum = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const shortDate = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/* Every exercise ticked for a muscle group is in the session — not one of them.
   Library order, so the session doesn't reshuffle when a choice is toggled. */
function buildSession(pos, picks) {
  const spec = CYCLE[pos - 1];
  const items = [];
  spec.groups.forEach((g) => {
    const chosen = picks[g] || [];
    LIBRARY[g].forEach((name) => {
      if (chosen.includes(name)) items.push({ group: g, name, sets: SETS });
    });
  });
  return { pos, key: spec.key, label: spec.label, accent: spec.color, items };
}

const advance = (pos) => (pos % CYCLE_LEN) + 1;

const bestOf = (history) => {
  if (!history || !history.length) return null;
  return history.reduce((a, b) => (b.w * b.r >= a.w * a.r ? b : a));
};

/* progressive overload: add a rep to the top of the range, then add 2.5kg and
   start again at the bottom of it */
const nextTarget = (best) => {
  if (!best) return null;
  return best.r < REP_HIGH
    ? { w: best.w, r: best.r + 1 }
    : { w: +(best.w + 2.5).toFixed(1), r: REP_LOW };
};

/* ---- four-week blocks ----
 * Blocks run from the first day with any data, 28 days at a time. A block is
 * summarised the moment it closes and written to ppl-reports, so old numbers
 * stay put even once the rolling per-exercise history has scrolled past them.
 */
const BLOCK = 28;

const dataDates = (days, lifts, weights) => {
  const seen = new Set([...Object.keys(days || {}), ...Object.keys(weights || {})]);
  Object.values(lifts || {}).forEach((h) => h.forEach((e) => seen.add(e.d)));
  return [...seen].filter(Boolean).sort();
};

/* Sets are ranked for the report the same way the overload rule works: heavier
   wins, and at equal weight more reps wins. Ranking by volume (weight x reps)
   would read the intended 12-reps-then-add-weight jump as a step backwards. */
const cmpLift = (a, b) => (a.w !== b.w ? a.w - b.w : a.r - b.r);
const bestLift = (list) => list.reduce((a, b) => (cmpLift(b, a) > 0 ? b : a));

function summariseBlock(i, start, end, days, lifts, weights, t) {
  const within = (d) => d >= start && d <= end;
  const dayList = Object.keys(days || {}).filter(within);
  const count = (k) => dayList.filter((d) => days[d][k]).length;

  const weighIns = Object.entries(weights || {})
    .filter(([d]) => within(d))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const moves = [];
  Object.entries(lifts || {}).forEach(([name, hist]) => {
    const here = hist.filter((e) => within(e.d));
    if (!here.length) return;
    const before = hist.filter((e) => e.d < start);
    /* measured against where the last block left off, or against the first set
       of this one if there is nothing earlier */
    const from = before.length ? bestLift(before) : here[0];
    const to = bestLift(here);
    const step = cmpLift(to, from);
    moves.push({
      name,
      from,
      to,
      dir: step > 0 ? "up" : step < 0 ? "down" : "flat",
      step,
      sets: here.length,
    });
  });
  moves.sort((a, b) => b.step - a.step);

  return {
    i,
    start,
    end,
    complete: end < t,
    sessions: count("workout"),
    eat: count("eat"),
    cardio: count("cardio"),
    weightFrom: weighIns.length ? weighIns[0][1] : null,
    weightTo: weighIns.length ? weighIns[weighIns.length - 1][1] : null,
    weightChange:
      weighIns.length > 1
        ? +(weighIns[weighIns.length - 1][1] - weighIns[0][1]).toFixed(1)
        : null,
    up: moves.filter((m) => m.dir === "up"),
    stalled: moves.filter((m) => m.dir !== "up"),
  };
}

function buildBlocks(days, lifts, weights, t) {
  const dates = dataDates(days, lifts, weights);
  if (!dates.length) return [];
  const anchor = dates[0];
  const n = Math.floor((dayNum(t) - dayNum(anchor)) / BLOCK) + 1;
  return Array.from({ length: n }, (_, i) =>
    summariseBlock(
      i,
      shiftDay(anchor, i * BLOCK),
      shiftDay(anchor, i * BLOCK + BLOCK - 1),
      days,
      lifts,
      weights,
      t
    )
  );
}

const bestPerDay = (hist) => {
  const byDate = {};
  (hist || []).forEach((s) => {
    const cur = byDate[s.d];
    if (!cur || s.w * s.r > cur.w * cur.r) byDate[s.d] = s;
  });
  return Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, s]) => ({ ...s, d }));
};

/* ============================ shared UI ============================ */

function Btn({ children, onClick, style, aria }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      style={{
        border: "none",
        cursor: "pointer",
        fontFamily: DISPLAY,
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Stepper({ label, value, unit, onChange, step, min }) {
  const btn = {
    width: 56,
    height: 56,
    fontSize: 30,
    background: "#fff",
    border: `3px solid ${MUTE}`,
    color: INK,
    lineHeight: 1,
    flexShrink: 0,
  };
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: MUTE,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Btn
          aria={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          style={btn}
        >
          &minus;
        </Btn>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: DISPLAY,
            fontSize: 30,
            letterSpacing: "-0.03em",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {value}
          <span style={{ fontSize: 15 }}>{unit}</span>
        </div>
        <Btn
          aria={`Increase ${label}`}
          onClick={() => onChange(+(value + step).toFixed(1))}
          style={btn}
        >
          +
        </Btn>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: MUTE,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ============================ session runner ============================ */

function Session({ session, lifts, onFinish, onQuit }) {
  const [idx, setIdx] = useState(0);
  const [entries, setEntries] = useState(() =>
    session.items.map((it) => {
      const tgt = nextTarget(bestOf(lifts[it.name]));
      return Array.from({ length: it.sets }, () => ({
        w: tgt ? tgt.w : 20,
        r: tgt ? tgt.r : 10,
        done: false,
      }));
    })
  );

  const item = session.items[idx];
  const name = item.name;
  const last = bestOf(lifts[name]);
  const target = nextTarget(last);
  const sets = entries[idx];

  const setField = (si, field, val) =>
    setEntries(
      entries.map((e, i) =>
        i === idx ? e.map((s, j) => (j === si ? { ...s, [field]: val } : s)) : e
      )
    );

  const beaten = last && sets.some((s) => s.done && s.w * s.r > last.w * last.r);

  const finishExercise = () => {
    if (idx < session.items.length - 1) {
      setIdx(idx + 1);
      window.scrollTo(0, 0);
    } else {
      const result = {};
      session.items.forEach((it, i) => {
        const good = entries[i].filter((s) => s.done);
        if (good.length) result[it.name] = good.map((s) => ({ w: s.w, r: s.r }));
      });
      onFinish(result);
    }
  };

  return (
    <div className="pad-session" style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ background: session.accent, color: "#fff", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {session.label} &middot; Day {session.pos} of {CYCLE_LEN}
          </div>
          <Btn
            onClick={onQuit}
            style={{
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              border: "2px solid rgba(255,255,255,.6)",
              padding: "4px 9px",
            }}
          >
            Exit
          </Btn>
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 22,
            marginTop: 6,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
          }}
        >
          To true failure
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <SectionLabel style={{ letterSpacing: "0.1em" }}>
          {GROUP_NAMES[item.group]} &middot; {idx + 1} of {session.items.length}
        </SectionLabel>

        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 36,
            lineHeight: 1.02,
            letterSpacing: "-0.035em",
            textTransform: "uppercase",
            margin: "6px 0 8px",
          }}
        >
          {name}
        </div>

        <div
          style={{
            background: beaten ? WIN : WASH,
            color: beaten ? "#fff" : INK,
            padding: "10px 12px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            {last ? (beaten ? "Target hit" : "Today's target") : "First time"}
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 30,
              letterSpacing: "-0.03em",
              marginTop: 2,
            }}
          >
            {target ? `${target.w}kg × ${target.r}` : "Set your starting weight"}
          </div>
          {last && (
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              Best so far: {last.w}kg × {last.r}
            </div>
          )}
        </div>

        {sets.map((s, si) => (
          <div
            key={si}
            style={{
              border: `3px solid ${s.done ? WIN : RULE}`,
              padding: "10px 12px 12px",
              marginBottom: 10,
              background: s.done ? "#EFF6F1" : "#fff",
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 17,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              Set {si + 1} &middot; {REP_LOW}&ndash;{REP_HIGH} reps
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Stepper
                label="WEIGHT"
                value={s.w}
                unit="kg"
                step={2.5}
                min={0}
                onChange={(v) => setField(si, "w", v)}
              />
              <Stepper
                label="REPS"
                value={s.r}
                unit=""
                step={1}
                min={0}
                onChange={(v) => setField(si, "r", v)}
              />
            </div>
            <Btn
              onClick={() => setField(si, "done", !s.done)}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "14px 0",
                fontSize: 18,
                background: s.done ? WIN : INK,
                color: "#fff",
              }}
            >
              {s.done ? "Done ✓" : "Mark set done"}
            </Btn>
          </div>
        ))}
      </div>

      <div
        className="safe-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 12,
          background: "#fff",
          borderTop: `4px solid ${INK}`,
        }}
      >
        <Btn
          onClick={finishExercise}
          style={{
            width: "100%",
            padding: "18px 0",
            fontSize: 21,
            background: session.accent,
            color: "#fff",
          }}
        >
          {idx < session.items.length - 1 ? "Next exercise →" : "Finish session"}
        </Btn>
      </div>
    </div>
  );
}

/* ============================ overload detail ============================ */

function ExerciseDetail({ name, hist, onBack }) {
  const sessions = bestPerDay(hist);
  const first = sessions[0];
  const best = bestOf(hist);
  const target = nextTarget(best);
  const recent = sessions.slice(-12).reverse();
  const maxVol = Math.max(...recent.map((s) => s.w * s.r), 1);
  const gain = first && best ? +(best.w - first.w).toFixed(1) : 0;

  return (
    <div
      style={{
        fontFamily: BODY,
        color: INK,
        background: "#fff",
        minHeight: "100vh",
        paddingBottom: 40,
      }}
    >
      <div style={{ background: INK, color: "#fff", padding: "14px 16px 16px" }}>
        <Btn
          onClick={onBack}
          style={{
            background: "transparent",
            color: "#fff",
            border: "2px solid rgba(255,255,255,.6)",
            fontSize: 13,
            padding: "5px 10px",
            marginBottom: 10,
          }}
        >
          ← Back
        </Btn>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 30,
            lineHeight: 1.02,
            textTransform: "uppercase",
            letterSpacing: "-0.035em",
          }}
        >
          {name}
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ background: WIN, color: "#fff", padding: "12px 14px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Next time, aim for
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 38,
              letterSpacing: "-0.03em",
              marginTop: 2,
            }}
          >
            {target ? `${target.w}kg × ${target.r}` : "—"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            Add a rep each time. At {REP_HIGH} reps, add 2.5kg and drop back to{" "}
            {REP_LOW}.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[
            ["Started", first ? `${first.w}kg × ${first.r}` : "—"],
            ["Best", best ? `${best.w}kg × ${best.r}` : "—"],
            ["Weight up", `${gain >= 0 ? "+" : ""}${gain}kg`],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{ flex: 1, background: WASH, padding: "10px 8px", textAlign: "center" }}
            >
              <div style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: "-0.02em" }}>
                {val}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: MUTE,
                  marginTop: 3,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        <SectionLabel style={{ margin: "20px 0 8px" }}>Every session</SectionLabel>

        {recent.map((s, i) => {
          const pct = Math.max(14, Math.round((s.w * s.r * 100) / maxVol));
          const isBest = best && s.w === best.w && s.r === best.r;
          return (
            <div
              key={s.d}
              style={{
                position: "relative",
                marginBottom: 6,
                background: WASH,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${pct}%`,
                  background: isBest ? WIN : "#D3D9E2",
                }}
              />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 12px",
                }}
              >
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 21,
                    letterSpacing: "-0.03em",
                    color: isBest ? "#fff" : INK,
                  }}
                >
                  {s.w}kg × {s.r}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: isBest ? "#fff" : MUTE,
                    flexShrink: 0,
                  }}
                >
                  {shortDate(s.d)}
                  {i === 0 ? " · latest" : ""}
                </span>
              </div>
            </div>
          );
        })}

        {sessions.length < 2 && (
          <div style={{ fontSize: 15, color: MUTE, lineHeight: 1.4, marginTop: 4 }}>
            One session logged so far. The bars fill in as you go.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ weight chart ============================ */

/* One series, so no legend — the heading names it. Solid hairline grid, a 2px
   line, and every value also readable in the list underneath, so the chart is
   never the only way to get a number. */
function WeightChart({ points, selected, onSelect }) {
  const W = 320;
  const H = 210;
  const L = 36;
  const R = 310;
  const T = 14;
  const B = 168;

  const lo = Math.min(...points.map((p) => p.kg));
  const hi = Math.max(...points.map((p) => p.kg));
  const pad = hi - lo < 1 ? 1 : (hi - lo) * 0.15;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const t0 = dayNum(points[0].d);
  const span = Math.max(1, dayNum(points[points.length - 1].d) - t0);

  const x = (p) => (points.length === 1 ? (L + R) / 2 : L + ((dayNum(p.d) - t0) / span) * (R - L));
  const y = (kg) => B - ((kg - yMin) / (yMax - yMin)) * (B - T);

  const ticks = [yMax, (yMax + yMin) / 2, yMin];
  const path = points.map((p) => `${x(p)},${y(p.kg)}`).join(" ");
  const showDots = points.length <= 24;
  const lastP = points[points.length - 1];
  const sel = selected != null ? points[selected] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", touchAction: "manipulation" }}
      role="img"
      aria-label={`Body weight over time, ${points.length} weigh-ins, latest ${lastP.kg} kilograms`}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text
            x={L - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fill={MUTE}
            fontFamily={BODY}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          stroke={PUSH_C}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {showDots &&
        points.map((p, i) => (
          <circle
            key={p.d}
            cx={x(p)}
            cy={y(p.kg)}
            r={i === points.length - 1 ? 5 : 4}
            fill={PUSH_C}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}

      {!showDots && (
        <circle cx={x(lastP)} cy={y(lastP.kg)} r="5" fill={PUSH_C} stroke="#fff" strokeWidth="2" />
      )}

      {sel && (
        <g>
          <line x1={x(sel)} x2={x(sel)} y1={T} y2={B} stroke={INK} strokeWidth="1" />
          <circle cx={x(sel)} cy={y(sel.kg)} r="6" fill={INK} stroke="#fff" strokeWidth="2" />
        </g>
      )}

      <line x1={L} x2={R} y1={B} y2={B} stroke={RULE} strokeWidth="1" />

      <text x={L} y={B + 18} fontSize="11" fontWeight="700" fill={MUTE} fontFamily={BODY}>
        {shortDate(points[0].d)}
      </text>
      {points.length > 1 && (
        <text
          x={R}
          y={B + 18}
          textAnchor="end"
          fontSize="11"
          fontWeight="700"
          fill={MUTE}
          fontFamily={BODY}
        >
          {shortDate(lastP.d)}
        </text>
      )}

      {/* tap targets — full plot height, so a point never has to be hit dead-on */}
      {points.map((p, i) => {
        const w = points.length === 1 ? R - L : (R - L) / points.length;
        return (
          <rect
            key={`hit-${p.d}`}
            x={Math.max(L, x(p) - w / 2)}
            y={T}
            width={Math.max(24, w)}
            height={B - T}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(selected === i ? null : i)}
          />
        );
      })}
    </svg>
  );
}

/* ============================ four-week report ============================ */

function BlockCard({ b, goal }) {
  const target = { sessions: SESSIONS_PER_WEEK * 4, eat: BLOCK, cardio: GOALS[goal].days * 4 };
  const stat = (label, value, tgt) => (
    <div key={label} style={{ flex: 1, background: WASH, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, letterSpacing: "-0.02em" }}>
        {value}
        {tgt ? <span style={{ fontSize: 13, color: MUTE }}>/{tgt}</span> : null}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: MUTE,
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );

  const line = (m, up) => (
    <div
      key={m.name}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "11px 12px",
        background: WASH,
        marginBottom: 5,
        borderLeft: `6px solid ${up ? WIN : RULE}`,
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0 }}>{m.name}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 15, flexShrink: 0, letterSpacing: "-0.02em" }}>
        {m.from.w}×{m.from.r}
        <span style={{ color: MUTE }}> → </span>
        <span style={{ color: up ? WIN : INK }}>
          {m.to.w}×{m.to.r}
        </span>
      </span>
    </div>
  );

  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          background: b.complete ? INK : REST_C,
          color: "#fff",
          padding: "10px 12px",
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: "-0.02em" }}>
          Weeks {b.i * 4 + 1}&ndash;{b.i * 4 + 4}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
          {shortDate(b.start)} – {shortDate(b.end)}
          {b.complete ? "" : " · still running"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {stat("Sessions", b.sessions, target.sessions)}
        {stat("Ate well", b.eat, target.eat)}
        {target.cardio ? stat("Cardio", b.cardio, target.cardio) : null}
      </div>

      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          background: WASH,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>
          Body weight
        </span>
        <span style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: "-0.02em" }}>
          {b.weightFrom == null ? (
            <span style={{ color: MUTE }}>—</span>
          ) : (
            <>
              {b.weightFrom}
              <span style={{ color: MUTE }}> → </span>
              {b.weightTo}kg
              {b.weightChange != null && (
                <span style={{ color: b.weightChange > 0 ? INK : WIN, marginLeft: 6 }}>
                  {b.weightChange > 0 ? "+" : ""}
                  {b.weightChange}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {b.up.length + b.stalled.length === 0 ? (
        <div style={{ fontSize: 15, color: MUTE, marginTop: 16, lineHeight: 1.4 }}>
          No sets logged in these four weeks yet.
        </div>
      ) : (
        <>
          <SectionLabel style={{ margin: "16px 0 8px" }}>
            Moved up &middot; {b.up.length}
          </SectionLabel>
          {b.up.length ? (
            b.up.map((m) => line(m, true))
          ) : (
            <div style={{ fontSize: 15, color: MUTE }}>Nothing beat its previous best.</div>
          )}

          <SectionLabel style={{ margin: "16px 0 8px" }}>
            Stalled or dropped &middot; {b.stalled.length}
          </SectionLabel>
          {b.stalled.length ? (
            b.stalled.map((m) => line(m, false))
          ) : (
            <div style={{ fontSize: 15, color: MUTE }}>
              Nothing stalled — every lift went up.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportScreen({ blocks, goal, onBack }) {
  return (
    <div
      className="pad-nav"
      style={{ fontFamily: BODY, color: INK, background: "#fff", minHeight: "100vh" }}
    >
      <div style={{ background: INK, color: "#fff", padding: "14px 16px 16px" }}>
        <Btn
          onClick={onBack}
          style={{
            background: "transparent",
            color: "#fff",
            border: "2px solid rgba(255,255,255,.6)",
            fontSize: 13,
            padding: "5px 10px",
            marginBottom: 10,
          }}
        >
          ← Back
        </Btn>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 30,
            textTransform: "uppercase",
            letterSpacing: "-0.035em",
          }}
        >
          Four-week report
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, opacity: 0.9 }}>
          Newest first. Each block is measured against the one before it.
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {[...blocks].reverse().map((b) => (
          <BlockCard key={b.i} b={b} goal={goal} />
        ))}
      </div>
    </div>
  );
}

/* ============================ weight entry ============================ */

function WeightCard({ todayKg, lastKg, onSave }) {
  const seed = todayKg != null ? todayKg : lastKg != null ? lastKg : "";
  const [txt, setTxt] = useState(String(seed));
  const num = parseFloat(txt);
  const valid = !isNaN(num) && num > 0 && num < 500;
  const bump = (d) => {
    const base = valid ? num : lastKg != null ? lastKg : 80;
    setTxt(String(+(base + d).toFixed(1)));
  };
  const btn = {
    width: 62,
    height: 62,
    fontSize: 26,
    background: "#fff",
    border: `3px solid ${MUTE}`,
    color: INK,
    lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div style={{ border: `3px solid ${RULE}`, padding: "12px 12px 14px", marginTop: 12 }}>
      <SectionLabel style={{ marginBottom: 8 }}>
        {todayKg != null ? "Today — logged" : "Today's weigh-in"}
      </SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Btn aria="Decrease weight" onClick={() => bump(-0.1)} style={btn}>
          &minus;
        </Btn>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "center" }}>
          <input
            value={txt}
            onChange={(e) => setTxt(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            aria-label="Weight in kilograms"
            placeholder="—"
            style={{
              width: 132,
              maxWidth: "100%",
              minWidth: 0,
              border: "none",
              outline: "none",
              textAlign: "right",
              fontFamily: DISPLAY,
              fontSize: 40,
              letterSpacing: "-0.03em",
              color: INK,
              background: "transparent",
              padding: 0,
            }}
          />
          <span style={{ fontFamily: DISPLAY, fontSize: 20, color: MUTE, marginLeft: 3 }}>
            kg
          </span>
        </div>
        <Btn aria="Increase weight" onClick={() => bump(0.1)} style={btn}>
          +
        </Btn>
      </div>
      <Btn
        onClick={() => valid && onSave(+num.toFixed(1))}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "16px 0",
          fontSize: 19,
          background: valid ? PUSH_C : WASH,
          color: valid ? "#fff" : MUTE,
        }}
      >
        {todayKg != null ? "Update today" : "Save weight"}
      </Btn>
      <div style={{ fontSize: 13, color: MUTE, marginTop: 8, lineHeight: 1.35 }}>
        Type it in, or nudge it 0.1 at a time. One a day is plenty — same time,
        same scale.
      </div>
    </div>
  );
}

/* ============================ main app ============================ */

export default function PPLHub() {
  const [tab, setTab] = useState("today");
  const [detail, setDetail] = useState(null);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [picked, setPicked] = useState(null);
  const [report, setReport] = useState(false);

  const profile = loadJSON("ppl-profile", {});
  const [picks, setPicks] = useState(profile.picks || DEFAULT_PICKS);
  /* positions 5-7 exist only in the old seven-day rotation; fold them back in */
  const [pos, setPos] = useState(((profile.pos || 1) - 1) % CYCLE_LEN + 1);
  const [goal, setGoal] = useState(profile.goal || "maintain");
  const [days, setDays] = useState(() => loadJSON("ppl-days", {}));
  const [lifts, setLifts] = useState(() => loadJSON("ppl-lifts", {}));
  const [weights, setWeights] = useState(() => loadJSON("ppl-weight", {}));

  const blocks = buildBlocks(days, lifts, weights, today());

  /* Freeze each block's numbers as it closes: stored snapshots win over
     recomputed ones, so a finished report never shifts under you. */
  useEffect(() => {
    const done = blocks.filter((b) => b.complete);
    if (!done.length) return;
    const stored = loadJSON("ppl-reports", {});
    const missing = done.filter((b) => !stored[b.i]);
    if (!missing.length) return;
    missing.forEach((b) => {
      stored[b.i] = b;
    });
    try {
      saveJSON("ppl-reports", stored);
    } catch (e) {
      /* nothing to do — the block is recomputed from the raw data anyway */
    }
  });

  const persist = (key, value) => {
    try {
      saveJSON(key, value);
      setSaveError(false);
    } catch (e) {
      /* storage full, or blocked in private browsing */
      setSaveError(true);
    }
  };

  const saveProfile = (next) => {
    const merged = { picks, pos, goal, ...next };
    if (next.picks) setPicks(next.picks);
    if (next.pos) setPos(next.pos);
    if (next.goal) setGoal(next.goal);
    persist("ppl-profile", merged);
  };

  const t = today();
  const flags = days[t] || {};
  const session = buildSession(pos, picks);
  const isRest = session.key === "rest";
  const cardioOn = cardioDue(goal, t);

  const toggleFlag = (k) => {
    const next = { ...days, [t]: { ...flags, [k]: !flags[k] } };
    setDays(next);
    persist("ppl-days", next);
  };

  const saveWeight = (kg) => {
    const next = { ...weights, [t]: kg };
    setWeights(next);
    persist("ppl-weight", next);
  };

  const finishSession = (result) => {
    const nextLifts = { ...lifts };
    Object.entries(result).forEach(([name, arr]) => {
      const hist = nextLifts[name] ? [...nextLifts[name]] : [];
      arr.forEach((s) => hist.push({ d: t, w: s.w, r: s.r }));
      nextLifts[name] = hist.slice(-60);
    });
    const nextDays = { ...days, [t]: { ...flags, workout: true } };
    const nextPos = advance(pos);

    setLifts(nextLifts);
    setDays(nextDays);
    setPos(nextPos);
    setRunning(false);
    setTab("today");

    persist("ppl-lifts", nextLifts);
    persist("ppl-days", nextDays);
    persist("ppl-profile", { picks, pos: nextPos, goal });
  };

  const saved = loadJSON("ppl-reports", {});
  const shownBlocks = blocks.map((b) => (b.complete && saved[b.i] ? saved[b.i] : b));

  if (report) {
    return (
      <ReportScreen blocks={shownBlocks} goal={goal} onBack={() => setReport(false)} />
    );
  }

  if (running) {
    return (
      <Session
        session={session}
        lifts={lifts}
        onFinish={finishSession}
        onQuit={() => setRunning(false)}
      />
    );
  }

  if (detail && lifts[detail]) {
    return (
      <ExerciseDetail name={detail} hist={lifts[detail]} onBack={() => setDetail(null)} />
    );
  }

  const week7 = Array.from({ length: 7 }, (_, i) => shiftDay(t, -6 + i));
  const count = (k) => week7.filter((d) => days[d] && days[d][k]).length;

  const wPoints = Object.entries(weights)
    .map(([d, kg]) => ({ d, kg }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const latest = wPoints[wPoints.length - 1];
  const monthAgo = shiftDay(t, -30);
  const priorPoints = wPoints.filter((p) => p.d <= monthAgo);
  const ref = priorPoints.length ? priorPoints[priorPoints.length - 1] : wPoints[0];
  const change = latest && ref && ref !== latest ? +(latest.kg - ref.kg).toFixed(1) : null;

  const tasks = [["eat", "Eat well"]];
  if (!isRest) tasks.push(["workout", "Workout"]);
  if (cardioOn) tasks.push(["cardio", "Cardio"]);

  return (
    <div
      className="pad-nav"
      style={{
        fontFamily: BODY,
        color: INK,
        background: "#fff",
        minHeight: "100vh",
        WebkitTextSizeAdjust: "100%",
      }}
    >
      {saveError && (
        <div
          style={{
            background: PUSH_C,
            color: "#fff",
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Couldn&rsquo;t save just then — the phone&rsquo;s storage is full or blocked.
        </div>
      )}

      {/* ---------------- TODAY ---------------- */}
      {tab === "today" && (
        <div>
          <div style={{ background: INK, color: "#fff", padding: "16px 16px 18px" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              Day {pos} of {CYCLE_LEN} &middot; {GOALS[goal].label}
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 54,
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                textTransform: "uppercase",
                marginTop: 8,
                color: "#fff",
              }}
            >
              {session.label}
            </div>
            {!isRest && (
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 17,
                  marginTop: 10,
                  color: "#fff",
                  background: session.accent,
                  display: "inline-block",
                  padding: "6px 10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                }}
              >
                {[...new Set(session.items.map((i) => i.group))]
                  .map((g) => GROUP_NAMES[g])
                  .join(" · ")}
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {isRest ? (
              <div style={{ background: WASH, padding: "16px 14px", borderLeft: `8px solid ${REST_C}` }}>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 24,
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                  }}
                >
                  No session today
                </div>
                <div style={{ fontSize: 16, marginTop: 6, lineHeight: 1.35 }}>
                  Push starts again tomorrow. Tap below when the day&rsquo;s done to
                  roll the rotation on.
                </div>
                <Btn
                  onClick={() => saveProfile({ pos: advance(pos) })}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "18px 0",
                    fontSize: 20,
                    background: REST_C,
                    color: "#fff",
                  }}
                >
                  Rest day done →
                </Btn>
              </div>
            ) : (
              <>
                {session.items.length === 0 ? (
                  <div style={{ background: WASH, padding: "14px 12px", borderLeft: `8px solid ${REST_C}` }}>
                    <div style={{ fontSize: 16, lineHeight: 1.35 }}>
                      Nothing ticked for today&rsquo;s muscle groups. Open{" "}
                      <strong>Plan</strong> and choose the exercises you use.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
                      {session.items.length} exercises &middot; {session.items.length * SETS} sets
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: session.accent,
                        marginTop: 4,
                      }}
                    >
                      {SETS} sets each &middot; {REP_LOW}&ndash;{REP_HIGH} reps &middot; every set to
                      failure
                    </div>
                    <div style={{ fontSize: 15, color: MUTE, marginTop: 8, lineHeight: 1.4 }}>
                      {session.items.map((i) => i.name).join(", ")}
                    </div>
                    <Btn
                      onClick={() => setRunning(true)}
                      style={{
                        width: "100%",
                        marginTop: 14,
                        padding: "22px 0",
                        fontSize: 26,
                        background: session.accent,
                        color: "#fff",
                      }}
                    >
                      Start session
                    </Btn>
                  </>
                )}
              </>
            )}

            <div style={{ marginTop: 22, borderTop: `4px solid ${INK}`, paddingTop: 12 }}>
              <SectionLabel style={{ marginBottom: 10 }}>Today</SectionLabel>

              {tasks.map(([k, label]) => (
                <Btn
                  key={k}
                  onClick={() => toggleFlag(k)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "16px 14px",
                    marginBottom: 8,
                    fontSize: 20,
                    background: flags[k] ? WIN : WASH,
                    color: flags[k] ? "#fff" : INK,
                    border: `3px solid ${flags[k] ? WIN : RULE}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: 24 }}>{flags[k] ? "✓" : "+"}</span>
                </Btn>
              ))}

              {goal === "bulk" && (
                <div style={{ fontSize: 14, color: MUTE, marginTop: 2 }}>
                  Bulking — no cardio on the list.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PROGRESS ---------------- */}
      {tab === "progress" && (
        <div>
          <div style={{ background: INK, color: "#fff", padding: "16px" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
              }}
            >
              Progress
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {(() => {
              const done = shownBlocks.filter((b) => b.complete);
              const latest = done[done.length - 1];
              const current = shownBlocks[shownBlocks.length - 1];
              if (!current) {
                return (
                  <div style={{ background: WASH, padding: "12px 14px", marginBottom: 18 }}>
                    <SectionLabel>Four-week report</SectionLabel>
                    <div style={{ fontSize: 15, color: MUTE, marginTop: 6, lineHeight: 1.4 }}>
                      Starts as soon as there&rsquo;s something to report. Log a session or
                      a weigh-in.
                    </div>
                  </div>
                );
              }
              const head = latest || current;
              const left = dayNum(current.end) - dayNum(t);
              return (
                <Btn
                  onClick={() => setReport(true)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: INK,
                    color: "#fff",
                    padding: "14px 14px",
                    marginBottom: 18,
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      opacity: 0.8,
                      fontFamily: BODY,
                    }}
                  >
                    {latest ? "Four-week report" : "First report"}
                  </div>
                  <div style={{ fontSize: 24, letterSpacing: "-0.03em", marginTop: 4 }}>
                    {latest
                      ? `Weeks ${head.i * 4 + 1}–${head.i * 4 + 4}`
                      : `${left + 1} days to go`}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginTop: 4,
                      fontFamily: BODY,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    {latest
                      ? `${head.up.length} up · ${head.stalled.length} stalled${
                          head.weightChange != null
                            ? ` · ${head.weightChange > 0 ? "+" : ""}${head.weightChange}kg`
                            : ""
                        } — tap to read`
                      : "Tap to see how it's going so far"}
                  </div>
                </Btn>
              );
            })()}

            <SectionLabel>Last 7 days</SectionLabel>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[
                ["workout", "Sessions", SESSIONS_PER_WEEK],
                ["eat", "Ate well", 7],
                ...(GOALS[goal].days ? [["cardio", "Cardio", GOALS[goal].days]] : []),
              ].map(([k, label, target]) => {
                const c = count(k);
                const hit = c >= target;
                return (
                  <div
                    key={k}
                    style={{
                      flex: 1,
                      background: hit ? WIN : WASH,
                      color: hit ? "#fff" : INK,
                      padding: "10px 6px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontFamily: DISPLAY, fontSize: 28 }}>
                      {c}
                      <span style={{ fontSize: 14, opacity: 0.7 }}>/{target}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        marginTop: 3,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Last 4 weeks</SectionLabel>
              {[
                ["workout", "Gym"],
                ["eat", "Food"],
                ...(GOALS[goal].days ? [["cardio", "Cardio"]] : []),
              ].map(([k, label]) => (
                <div
                  key={k}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}
                >
                  <div
                    style={{
                      width: 52,
                      fontSize: 13,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ display: "flex", gap: 3, flex: 1 }}>
                    {Array.from({ length: 28 }, (_, i) => {
                      const d = shiftDay(t, -27 + i);
                      const on = days[d] && days[d][k];
                      return (
                        <div
                          key={d}
                          title={d}
                          style={{
                            flex: 1,
                            height: 22,
                            background: on ? WIN : WASH,
                            border: `1px solid ${on ? WIN : RULE}`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: MUTE, marginTop: 4 }}>
                Oldest on the left, today on the right.
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SectionLabel style={{ marginBottom: 8 }}>
                Progressive overload &middot; tap to open
              </SectionLabel>
              {Object.keys(lifts).length === 0 && (
                <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4 }}>
                  Nothing logged yet. Finish a session and your numbers show up here.
                </div>
              )}
              {Object.entries(lifts).map(([name, hist]) => {
                const b = bestOf(hist);
                const first = hist[0];
                const up = first && b && b.w * b.r > first.w * first.r;
                return (
                  <Btn
                    key={name}
                    onClick={() => setDetail(name)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      background: WASH,
                      color: INK,
                      padding: "13px 12px",
                      marginBottom: 6,
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 17,
                        textTransform: "uppercase",
                        letterSpacing: "-0.02em",
                        minWidth: 0,
                      }}
                    >
                      {name}
                    </div>
                    <div
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 20,
                        color: up ? WIN : INK,
                        flexShrink: 0,
                      }}
                    >
                      {b.w}kg × {b.r} {up ? "↑" : ""}{" "}
                      <span style={{ color: MUTE }}>›</span>
                    </div>
                  </Btn>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- WEIGHT ---------------- */}
      {tab === "weight" && (
        <div>
          <div style={{ background: INK, color: "#fff", padding: "16px" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
              }}
            >
              Body weight
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {latest ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 52, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {latest.kg}
                  <span style={{ fontSize: 22, color: MUTE }}>kg</span>
                </div>
                {change != null && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: MUTE }}>
                    {change > 0 ? "+" : ""}
                    {change}kg since {shortDate(ref.d)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 17, color: MUTE, lineHeight: 1.4 }}>
                No weigh-ins yet. Put today&rsquo;s number in and the graph starts
                from there.
              </div>
            )}

            {wPoints.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <SectionLabel style={{ marginBottom: 4 }}>
                  {wPoints.length > 1 ? "Every weigh-in" : "First weigh-in"}
                </SectionLabel>
                <WeightChart points={wPoints} selected={picked} onSelect={setPicked} />
                <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20 }}>
                  {picked != null
                    ? `${shortDate(wPoints[picked].d)} · ${wPoints[picked].kg}kg`
                    : wPoints.length > 1
                    ? "Tap the line to read a day."
                    : ""}
                </div>
              </div>
            )}

            <WeightCard
              todayKg={weights[t] != null ? weights[t] : null}
              lastKg={latest ? latest.kg : null}
              onSave={saveWeight}
            />

            {wPoints.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Recent</SectionLabel>
                {wPoints
                  .slice(-8)
                  .reverse()
                  .map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const diff = prev ? +(p.kg - prev.kg).toFixed(1) : null;
                    return (
                      <div
                        key={p.d}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "11px 12px",
                          background: WASH,
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 800, color: MUTE }}>
                          {shortDate(p.d)}
                        </span>
                        <span
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: 19,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {p.kg}kg
                          {diff != null && (
                            <span style={{ fontSize: 14, color: MUTE, marginLeft: 8 }}>
                              {diff > 0 ? "+" : ""}
                              {diff}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SETUP ---------------- */}
      {tab === "setup" && (
        <div>
          <div style={{ background: INK, color: "#fff", padding: "16px" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
              }}
            >
              My plan
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
              Goal, exercises, and where you are in the rotation.
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            <SectionLabel style={{ marginBottom: 8 }}>Right now I&rsquo;m on a</SectionLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(GOALS).map(([k, g]) => {
                const on = goal === k;
                return (
                  <Btn
                    key={k}
                    onClick={() => saveProfile({ goal: k })}
                    style={{
                      flex: 1,
                      padding: "16px 4px",
                      fontSize: 17,
                      background: on ? PUSH_C : "#fff",
                      color: on ? "#fff" : INK,
                      border: `3px solid ${on ? PUSH_C : RULE}`,
                    }}
                  >
                    {g.label}
                  </Btn>
                );
              })}
            </div>
            <div style={{ fontSize: 14, color: MUTE, marginTop: 8 }}>
              {GOALS[goal].cardio}.
            </div>

            <div style={{ borderTop: `4px solid ${INK}`, marginTop: 20, paddingTop: 14 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Where am I in the rotation?</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CYCLE.map((d, i) => {
                  const n = i + 1;
                  const on = pos === n;
                  return (
                    <Btn
                      key={n}
                      onClick={() => saveProfile({ pos: n })}
                      style={{
                        flex: "1 0 30%",
                        padding: "12px 6px",
                        fontSize: 15,
                        background: on ? d.color : "#fff",
                        color: on ? "#fff" : INK,
                        border: `3px solid ${on ? d.color : RULE}`,
                      }}
                    >
                      {n}. {d.label}
                    </Btn>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: `4px solid ${INK}`, marginTop: 20, paddingTop: 14 }}>
              <SectionLabel style={{ marginBottom: 10 }}>
                My exercises &middot; tap the ones you use
              </SectionLabel>
              {Object.entries(LIBRARY).map(([g, list]) => (
                <div key={g} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 24,
                      textTransform: "uppercase",
                      letterSpacing: "-0.03em",
                      color: INK,
                      borderBottom: `4px solid ${MUTE}`,
                      paddingBottom: 4,
                      marginBottom: 8,
                    }}
                  >
                    {GROUP_NAMES[g]}
                  </div>
                  {list.map((name) => {
                    const on = (picks[g] || []).includes(name);
                    return (
                      <Btn
                        key={name}
                        onClick={() => {
                          const cur = picks[g] || [];
                          const next = on ? cur.filter((n) => n !== name) : [...cur, name];
                          saveProfile({ picks: { ...picks, [g]: next } });
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "13px 12px",
                          marginBottom: 6,
                          fontSize: 18,
                          background: on ? INK : "#fff",
                          color: on ? "#fff" : INK,
                          border: `3px solid ${on ? INK : RULE}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>{name}</span>
                        <span style={{ fontSize: 22 }}>{on ? "✓" : ""}</span>
                      </Btn>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- NAV ---------------- */}
      <div
        className="safe-nav"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          borderTop: `4px solid ${INK}`,
          background: "#fff",
        }}
      >
        {[
          ["today", "Today"],
          ["progress", "Progress"],
          ["weight", "Weight"],
          ["setup", "Plan"],
        ].map(([k, label]) => (
          <Btn
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "18px 0",
              fontSize: 15,
              background: tab === k ? INK : "#fff",
              color: tab === k ? "#fff" : MUTE,
            }}
          >
            {label}
          </Btn>
        ))}
      </div>
    </div>
  );
}
