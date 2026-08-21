import { useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
  summarise,
} from "./backup";

/* ============================ constants ============================ */

const INK = "#0D1014";
const PUSH = "#A81419";
const HOLD = "#0F4A72";
const WIN = "#1E6B41";
const WASH = "#F1F3F6";
const RULE = "#B0B7C0";
const MUTE = "#333B45";
const DISPLAY = "'Arial Black','Helvetica Neue',Impact,sans-serif";
const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const LIBRARY = {
  chest: ["Bench press", "Incline bench press", "Cable flys"],
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
  shoulders: ["Lateral raises", "Shoulder press"],
  triceps: ["Tricep rope pushdowns"],
  rearDelts: ["Face pulls", "Cable pulls"],
  legs: [
    "Squat",
    "Bulgarian split squat",
    "Leg extension",
    "Seated leg curl",
    "Calf raises",
    "Wall sits",
  ],
  abs: ["Cable crunches", "Hanging leg raises", "V-ups", "Bicycle crunches"],
};

const GROUP_NAMES = {
  chest: "Chest",
  back: "Back",
  biceps: "Biceps",
  shoulders: "Shoulders",
  triceps: "Triceps",
  rearDelts: "Rear delts",
  legs: "Legs",
  abs: "Abs",
};

const FOCUS = ["chest", "back", "biceps"];

const DEFAULT_PICKS = {
  chest: ["Bench press", "Incline bench press"],
  back: ["Lat pulldowns", "Machine rows"],
  biceps: ["African curls", "Incline curls"],
  shoulders: ["Lateral raises", "Shoulder press"],
  triceps: ["Tricep rope pushdowns"],
  rearDelts: ["Face pulls"],
  legs: ["Squat", "Leg extension", "Seated leg curl"],
  abs: ["Cable crunches", "Hanging leg raises"],
};

const FULL_BODY = [
  "chest",
  "back",
  "biceps",
  "shoulders",
  "triceps",
  "rearDelts",
  "legs",
];

const PLAN = {
  1: {
    1: { label: "Focus day", groups: ["chest", "biceps"] },
    2: { label: "Maintenance", groups: ["chest", "triceps", "shoulders"] },
    3: { label: "Focus day", groups: ["back", "rearDelts", "biceps"] },
  },
  2: {
    1: { label: "Full body", groups: FULL_BODY },
    2: { label: "Leg day", groups: ["legs"], week1Rules: true },
    3: { label: "Full body", groups: FULL_BODY },
  },
};

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

const dayLetter = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(y, m - 1, d).getDay()];
};

/* The built-in list for a muscle group plus anything added on the phone. */
const listFor = (g, custom) => [...LIBRARY[g], ...((custom && custom[g]) || [])];

/* Least recently trained first, so the full-body days work round every
   exercise on the list instead of always reaching for the same one. Anything
   never logged comes first; ties keep list order. */
function byStalest(names, lifts) {
  const lastDone = (n) => {
    const h = lifts && lifts[n];
    return h && h.length ? h[h.length - 1].d : "";
  };
  return names
    .map((name, i) => ({ name, i }))
    .sort(
      (a, b) =>
        lastDone(a.name).localeCompare(lastDone(b.name)) || a.i - b.i
    )
    .map((x) => x.name);
}

/* Two different days, two different rules.
 *
 * Hard days — all of week 1, plus the leg day — are everything ticked for the
 * muscle group, three sets each, to failure.
 *
 * Full-body days are the light ones: one exercise per muscle group, two for
 * chest, back and biceps, a single set each. That keeps a full-body day at the
 * volume it was designed for however many exercises are ticked.
 */
function buildSession(week, day, picks, custom, lifts) {
  const spec = PLAN[week][day];
  const hardRules = week === 1 || spec.week1Rules;
  const groups = [...spec.groups, "abs"];

  const items = [];
  groups.forEach((g) => {
    const chosen = listFor(g, custom).filter((n) => (picks[g] || []).includes(n));
    if (!chosen.length) return;

    if (hardRules) {
      chosen.forEach((name) => items.push({ group: g, name, sets: 3 }));
      return;
    }

    const slots = FOCUS.includes(g) ? 2 : 1;
    const picked = byStalest(chosen, lifts).slice(0, slots);
    /* only one ticked where two were wanted: it carries both sets itself */
    const sets = Math.ceil(slots / picked.length);
    picked.forEach((name) => items.push({ group: g, name, sets }));
  });

  return {
    week,
    day,
    label: spec.label,
    toFailure: hardRules,
    accent: hardRules ? PUSH : HOLD,
    items,
  };
}

const advance = (pos) =>
  pos.day < 3
    ? { week: pos.week, day: pos.day + 1 }
    : { week: pos.week === 1 ? 2 : 1, day: 1 };

const bestOf = (history) => {
  if (!history || !history.length) return null;
  return history.reduce((a, b) => (b.w * b.r >= a.w * a.r ? b : a));
};

/* progressive overload rule: add a rep until 12, then add 2.5kg and drop to 8 */
const nextTarget = (best) => {
  if (!best) return null;
  return best.r < 12
    ? { w: best.w, r: best.r + 1 }
    : { w: +(best.w + 2.5).toFixed(1), r: 8 };
};

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

/* ============================ add an exercise ============================ */

function AddExercise({ group, existing, onAdd }) {
  const [text, setText] = useState("");
  const name = text.trim().replace(/\s+/g, " ");
  const clash = existing.some((n) => n.toLowerCase() === name.toLowerCase());
  const valid = name.length > 1 && name.length <= 40 && !clash;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              onAdd(name);
              setText("");
            }
          }}
          placeholder={`Add a ${GROUP_NAMES[group].toLowerCase()} exercise`}
          aria-label={`Add a ${GROUP_NAMES[group].toLowerCase()} exercise`}
          maxLength={40}
          style={{
            flex: 1,
            minWidth: 0,
            border: `3px solid ${RULE}`,
            padding: "12px 10px",
            fontSize: 16,
            fontFamily: BODY,
            color: INK,
            background: "#fff",
            outline: "none",
          }}
        />
        <Btn
          onClick={() => {
            if (!valid) return;
            onAdd(name);
            setText("");
          }}
          style={{
            padding: "0 16px",
            fontSize: 16,
            background: valid ? PUSH : WASH,
            color: valid ? "#fff" : MUTE,
            flexShrink: 0,
          }}
        >
          Add
        </Btn>
      </div>
      {clash && (
        <div style={{ fontSize: 13, color: MUTE, marginTop: 5 }}>
          That one is already on the list.
        </div>
      )}
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
        i === idx
          ? e.map((s, j) => (j === si ? { ...s, [field]: val } : s))
          : e
      )
    );

  const beaten =
    last && sets.some((s) => s.done && s.w * s.r > last.w * last.r);

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
      <div
        style={{
          background: session.accent,
          color: "#fff",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Week {session.week} &middot; Day {session.day}
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
          {session.toFailure ? "To true failure" : "Stop close to failure"}
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: MUTE,
            textTransform: "uppercase",
          }}
        >
          {GROUP_NAMES[item.group]} &middot; {idx + 1} of {session.items.length}
        </div>

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
            {target
              ? `${target.w}kg × ${target.r}`
              : "Set your starting weight"}
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
              background: s.done ? "#F0F7F3" : "#fff",
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
              Set {si + 1} &middot; 8&ndash;12 reps
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
    <div style={{ fontFamily: BODY, color: INK, background: "#fff", minHeight: "100vh", paddingBottom: 40 }}>
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
          <div style={{ fontFamily: DISPLAY, fontSize: 38, letterSpacing: "-0.03em", marginTop: 2 }}>
            {target ? `${target.w}kg × ${target.r}` : "—"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            Add a rep each time. At 12 reps, add 2.5kg and drop back to 8.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[
            ["Started", first ? `${first.w}kg × ${first.r}` : "—"],
            ["Best", best ? `${best.w}kg × ${best.r}` : "—"],
            ["Weight up", `${gain >= 0 ? "+" : ""}${gain}kg`],
          ].map(([label, val]) => (
            <div key={label} style={{ flex: 1, background: WASH, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: "-0.02em" }}>{val}</div>
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

        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTE,
            margin: "20px 0 8px",
          }}
        >
          Every session
        </div>

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
                  background: isBest ? WIN : "#D6DBE1",
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
                  {s.d.slice(8)}/{s.d.slice(5, 7)}
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

/* ============================ backup ============================ */

function BackupCard({ app, prefix, keys, accent }) {
  const [stage, setStage] = useState("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(null);

  const filename = `${prefix}-backup-${today()}.json`;

  const doExport = async () => {
    const how = await saveBackup(buildBackup(app, keys), filename);
    setNote(
      how === "shared"
        ? "Saved. Put it somewhere that is not this phone."
        : how === "downloaded"
        ? `Saved as ${filename}.`
        : how === "cancelled"
        ? ""
        : "This phone would not let the app save a file."
    );
  };

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const payload = await readBackupFile(file);
      const problem = checkBackup(payload, app, keys);
      if (problem) {
        setNote(problem);
        setStage("idle");
        return;
      }
      setPending(payload);
      setNote("");
      setStage("confirm");
    } catch (err) {
      setNote(err.message);
      setStage("idle");
    }
  };

  const confirmRestore = () => {
    restoreBackup(pending, keys);
    /* simplest way to be sure every screen reads the restored data */
    window.location.reload();
  };

  const sum = pending ? summarise(pending, prefix) : null;

  return (
    <div style={{ borderTop: `4px solid ${INK}`, marginTop: 20, paddingTop: 14 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTE,
          marginBottom: 8,
        }}
      >
        Backup
      </div>
      <div style={{ fontSize: 15, color: MUTE, lineHeight: 1.4, marginBottom: 10 }}>
        Everything is stored on this phone and nowhere else. Save a copy now and
        again — email it to yourself, drop it in Files, anywhere but here.
      </div>

      {stage !== "confirm" && (
        <>
          <Btn
            onClick={doExport}
            style={{
              width: "100%",
              padding: "16px 0",
              fontSize: 18,
              background: accent,
              color: "#fff",
            }}
          >
            Export a backup
          </Btn>

          <label
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "16px 0",
              fontSize: 18,
              fontFamily: DISPLAY,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              textAlign: "center",
              background: "#fff",
              color: INK,
              border: `3px solid ${RULE}`,
              cursor: "pointer",
            }}
          >
            Restore from a file
            <input
              type="file"
              accept="application/json,.json"
              onChange={pickFile}
              style={{ display: "none" }}
            />
          </label>
        </>
      )}

      {stage === "confirm" && sum && (
        <div style={{ border: `3px solid ${accent}`, padding: "12px 12px 14px" }}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
            }}
          >
            Replace everything on this phone?
          </div>
          <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.4 }}>
            That file holds <strong>{sum.sessions}</strong> session
            {sum.sessions === 1 ? "" : "s"}, <strong>{sum.exercises}</strong> exercise
            {sum.exercises === 1 ? "" : "s"}
            {sum.weighIns ? (
              <>
                {" "}
                and <strong>{sum.weighIns}</strong> weigh-in
                {sum.weighIns === 1 ? "" : "s"}
              </>
            ) : null}
            {sum.exportedAt ? `, saved ${sum.exportedAt}` : ""}. What is on this phone
            now will be written over and cannot be got back.
          </div>
          <Btn
            onClick={confirmRestore}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "16px 0",
              fontSize: 18,
              background: accent,
              color: "#fff",
            }}
          >
            Replace everything
          </Btn>
          <Btn
            onClick={() => {
              setStage("idle");
              setPending(null);
            }}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "14px 0",
              fontSize: 16,
              background: "#fff",
              color: INK,
              border: `3px solid ${RULE}`,
            }}
          >
            Cancel
          </Btn>
        </div>
      )}

      {note && (
        <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  );
}

/* ============================ main app ============================ */

export default function WorkoutHub() {
  const [tab, setTab] = useState("today");
  const [detail, setDetail] = useState(null);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState(false);

  /* ---- load (localStorage is synchronous, so read it up front) ---- */
  const profile = loadJSON("wk-profile", {});
  const [picks, setPicks] = useState(profile.picks || DEFAULT_PICKS);
  const [custom, setCustom] = useState(profile.custom || {});
  const [pos, setPos] = useState(profile.pos || { week: 1, day: 1 });
  const [days, setDays] = useState(() => loadJSON("wk-days", {}));
  const [lifts, setLifts] = useState(() => loadJSON("wk-lifts", {}));

  const persist = (key, value) => {
    try {
      saveJSON(key, value);
      setSaveError(false);
    } catch (e) {
      /* storage full, or blocked in private browsing */
      setSaveError(true);
    }
  };

  const saveProfile = (nextPicks, nextPos, nextCustom = custom) => {
    setPicks(nextPicks);
    setPos(nextPos);
    setCustom(nextCustom);
    persist("wk-profile", { picks: nextPicks, pos: nextPos, custom: nextCustom });
  };

  /* a new exercise goes on the list and is ticked straight away */
  const addExercise = (g, name) =>
    saveProfile({ ...picks, [g]: [...(picks[g] || []), name] }, pos, {
      ...custom,
      [g]: [...(custom[g] || []), name],
    });

  /* only ones added here can be taken off again; any logged history stays */
  const removeExercise = (g, name) =>
    saveProfile({ ...picks, [g]: (picks[g] || []).filter((n) => n !== name) }, pos, {
      ...custom,
      [g]: (custom[g] || []).filter((n) => n !== name),
    });

  const t = today();
  const flags = days[t] || {};

  const toggleFlag = (k) => {
    const next = { ...days, [t]: { ...flags, [k]: !flags[k] } };
    setDays(next);
    persist("wk-days", next);
  };

  const session = buildSession(pos.week, pos.day, picks, custom, lifts);

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

    persist("wk-lifts", nextLifts);
    persist("wk-days", nextDays);
    persist("wk-profile", { picks, pos: nextPos, custom });
  };

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
      <ExerciseDetail
        name={detail}
        hist={lifts[detail]}
        onBack={() => setDetail(null)}
      />
    );
  }

  /* ---- weekly counts (last 7 days) ---- */
  const week7 = Array.from({ length: 7 }, (_, i) => shiftDay(t, -6 + i));
  const count = (k) => week7.filter((d) => days[d] && days[d][k]).length;

  /* ---- keeping him honest: how long since the last one, how many lately ---- */
  const workoutDays = Object.keys(days)
    .filter((d) => days[d] && days[d].workout)
    .sort();
  const lastWorkout = workoutDays.length ? workoutDays[workoutDays.length - 1] : null;
  const daysSince = lastWorkout ? dayNum(t) - dayNum(lastWorkout) : null;
  const cutoff = shiftDay(t, -27);
  const last28 = workoutDays.filter((d) => d >= cutoff).length;
  /* three sessions a week is the plan, so a three-day gap is a real slip */
  const slipping = daysSince !== null && daysSince >= 3;
  const recency =
    daysSince === 0
      ? "Done today"
      : daysSince === 1
      ? "Last one yesterday"
      : `Last one ${daysSince} days ago`;

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
            background: PUSH,
            color: "#fff",
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Couldn&rsquo;t save just then — the phone&rsquo;s storage is full or
          blocked.
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
              Next session
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 40,
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              Week {session.week}
              <br />
              Day {session.day}
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 19,
                marginTop: 10,
                color: "#fff",
                background: session.accent,
                display: "inline-block",
                padding: "6px 10px",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}
            >
              {session.label}
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {daysSince === null ? (
              <div
                style={{
                  background: HOLD,
                  color: "#fff",
                  padding: "12px 14px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 26,
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Session one
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                  Nothing logged yet. Today is the one that starts it.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: slipping ? PUSH : WIN,
                  color: "#fff",
                  padding: "12px 14px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 26,
                    lineHeight: 1.05,
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {slipping ? `${daysSince} days since your last session` : recency}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                  {last28} session{last28 === 1 ? "" : "s"} in the last 4 weeks
                  {slipping ? " · get one in today" : ""}
                </div>
              </div>
            )}

            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 26,
                lineHeight: 1.08,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
              }}
            >
              {[...new Set(session.items.map((i) => i.group))]
                .map((g) => GROUP_NAMES[g])
                .join(" · ")}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: session.accent,
                marginTop: 8,
              }}
            >
              {session.toFailure
                ? "3 sets · 8–12 reps · to true failure"
                : "1 exercise per group, 2 for chest/back/biceps · 1 set each · stop close to failure"}
            </div>

            {session.items.length === 0 ? (
              <div
                style={{
                  background: WASH,
                  padding: "14px 12px",
                  marginTop: 14,
                  borderLeft: `8px solid ${HOLD}`,
                }}
              >
                <div style={{ fontSize: 16, lineHeight: 1.35 }}>
                  Nothing ticked for today&rsquo;s muscle groups. Open{" "}
                  <strong>Exercises</strong> and choose the ones you use.
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 22,
                    letterSpacing: "-0.03em",
                    textTransform: "uppercase",
                    marginTop: 10,
                  }}
                >
                  {session.items.length} exercises &middot;{" "}
                  {session.items.reduce((n, i) => n + i.sets, 0)} sets
                </div>
                <div style={{ fontSize: 15, color: MUTE, marginTop: 6, lineHeight: 1.4 }}>
                  {session.items.map((i) => i.name).join(", ")}
                </div>

                <Btn
                  onClick={() => setRunning(true)}
                  style={{
                    width: "100%",
                    marginTop: 16,
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

            <div
              style={{
                marginTop: 22,
                borderTop: `4px solid ${INK}`,
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTE,
                  marginBottom: 10,
                }}
              >
                Today
              </div>

              {[
                ["workout", "Worked out"],
                ["light", "Light cardio"],
                ["hard", "Hard cardio"],
                ["clean", "Ate clean"],
              ].map(([k, label]) => (
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
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MUTE,
              }}
            >
              Last 7 days
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[
                ["workout", "Workouts", 3],
                ["light", "Light cardio", 3],
                ["hard", "Hard cardio", 1],
                ["clean", "Ate clean", 7],
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
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTE,
                  marginBottom: 8,
                }}
              >
                Last 4 weeks
              </div>
              {[
                ["workout", "Gym"],
                ["light", "Light"],
                ["hard", "Hard"],
                ["clean", "Food"],
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
                            border: `1px solid ${on ? WIN : WASH}`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: MUTE, marginTop: 4 }}>
                Oldest on the left, today on the right. Green is a day it got
                done — the plan is three sessions a week, so most days are meant
                to be blank.
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTE,
                  marginBottom: 8,
                }}
              >
                Progressive overload &middot; tap to open
              </div>
              {Object.keys(lifts).length === 0 && (
                <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4 }}>
                  Nothing logged yet. Finish a session and your numbers show up
                  here.
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
                      {b.w}kg × {b.r} {up ? "↑" : ""} <span style={{ color: MUTE }}>›</span>
                    </div>
                  </Btn>
                );
              })}
            </div>
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
              My exercises
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
              Tap the ones you use, or add your own. Every session is built from these.
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {Object.keys(LIBRARY).map((g) => (
              <div key={g} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 24,
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                    color: FOCUS.includes(g) ? PUSH : INK,
                    borderBottom: `4px solid ${FOCUS.includes(g) ? PUSH : MUTE}`,
                    paddingBottom: 4,
                    marginBottom: 8,
                  }}
                >
                  {GROUP_NAMES[g]}
                </div>
                {listFor(g, custom).map((name) => {
                  const on = (picks[g] || []).includes(name);
                  const mine = (custom[g] || []).includes(name);
                  const toggle = () => {
                    const cur = picks[g] || [];
                    saveProfile(
                      { ...picks, [g]: on ? cur.filter((n) => n !== name) : [...cur, name] },
                      pos
                    );
                  };
                  /* two separate buttons, never one inside the other */
                  return (
                    <div key={name} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <Btn
                        onClick={toggle}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: "left",
                          padding: "13px 12px",
                          fontSize: 18,
                          background: on ? INK : "#fff",
                          color: on ? "#fff" : INK,
                          border: `3px solid ${on ? INK : RULE}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>{name}</span>
                        <span style={{ fontSize: 22 }}>{on ? "✓" : ""}</span>
                      </Btn>
                      {mine && (
                        <Btn
                          aria={`Remove ${name}`}
                          onClick={() => removeExercise(g, name)}
                          style={{
                            width: 52,
                            flexShrink: 0,
                            fontSize: 20,
                            background: "#fff",
                            color: MUTE,
                            border: `3px solid ${RULE}`,
                          }}
                        >
                          ×
                        </Btn>
                      )}
                    </div>
                  );
                })}
                <AddExercise
                  group={g}
                  existing={listFor(g, custom)}
                  onAdd={(name) => addExercise(g, name)}
                />
              </div>
            ))}

            <BackupCard
              app="workout"
              prefix="wk"
              keys={["wk-profile", "wk-days", "wk-lifts"]}
              accent={PUSH}
            />

            <div style={{ borderTop: `4px solid ${INK}`, paddingTop: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTE,
                  marginBottom: 8,
                }}
              >
                Where am I in the rotation?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[1, 2].map((w) =>
                  [1, 2, 3].map((d) => {
                    const on = pos.week === w && pos.day === d;
                    return (
                      <Btn
                        key={`${w}-${d}`}
                        onClick={() => saveProfile(picks, { week: w, day: d })}
                        style={{
                          flex: "1 0 30%",
                          padding: "12px 6px",
                          fontSize: 15,
                          background: on ? (w === 1 ? PUSH : HOLD) : "#fff",
                          color: on ? "#fff" : INK,
                          border: `3px solid ${on ? (w === 1 ? PUSH : HOLD) : RULE}`,
                        }}
                      >
                        W{w} D{d}
                      </Btn>
                    );
                  })
                )}
              </div>
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
          ["setup", "Exercises"],
        ].map(([k, label]) => (
          <Btn
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "18px 0",
              fontSize: 16,
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
