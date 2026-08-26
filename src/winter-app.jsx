/* Winter Arc — the workout tracker run as a winter arc.
 *
 * The same session runner and the same overload maths as the original
 * tracker, under its own keys (wa-) so a winter is counted on its own and
 * nothing here touches the year-round history next door.
 *
 * The plan is not the same. This one is a six-day bulk: push, pull, a focus
 * day for chest and arms, then push, pull, legs. Every session is heavy and
 * every exercise goes to failure — there is no light day, because there is no
 * cardio at all and nothing to save anything for. The food side is one toggle
 * that stays the same all winter: eat big.
 *
 * The face it puts on is black, heavy and cold, with the arc itself on the
 * front — which day of it you are on, and how many are left.
 */
import { useEffect, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
  summarise,
} from "./backup";
import { dayNum, shiftDay, shortDate, today } from "./dates";
import { bestOf, bestPerDay } from "./lifts";
import { Btn, SectionLabel, Stepper } from "./ui";
import { TrendChart, WeekBars } from "./charts";
import { WeightPanel } from "./weight";
import { BLOCK, ReportScreen, buildBlocks } from "./report";
import {
  ACCENT_TEXT,
  BG,
  BODY,
  CARD,
  CHART,
  DISPLAY,
  GOOD,
  INK,
  MUTE,
  ON_ACCENT,
  RAISED,
  RULE,
  TEXT,
  WASH,
  WIN,
  applyTheme,
  PULL_C,
  PUSH_C,
} from "./tokens";

/* ============================ constants ============================ */

/* Two winter looks, switched from the Plan tab and painted by winter-theme.css.
   PUSH is the bright accent, kept for the focus day; HOLD carries the rest. */
const THEMES = {
  blackout: { label: "Blackout", note: "Black, bone and cold steel." },
  frostbite: { label: "Frostbite", note: "Black and ice, lit like a cold morning." },
};

const PUSH = PUSH_C;
const HOLD = PULL_C;

/* What a four-week block should hold. Six days a week is the plan, so a block
   is 24 sessions; the surplus is meant to be every day of it, cardio none of
   them — which is why there are two habits here and not four. */
const HABITS = ["workout", "eat"];
const PER_BLOCK = { workout: 24, eat: BLOCK };
const PER_WEEK = 6;

/* The original tracker's library, with the gaps this split opens filled in:
   push comes round twice a cycle and one rope pushdown will not carry it, and
   there is only ever the one leg day. Anything else goes on from the phone. */
const LIBRARY = {
  chest: ["Bench press", "Incline bench press", "Dumbbell bench press", "Cable flys"],
  back: [
    "Lat pulldowns",
    "1-arm lat pulldowns",
    "Barbell rows",
    "Pull-ups",
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
  shoulders: ["Lateral raises", "Shoulder press", "Arnold press", "Cable lateral raises"],
  triceps: [
    "Tricep rope pushdowns",
    "Skull crushers",
    "Close-grip bench press",
    "Overhead cable extension",
    "Dips",
  ],
  rearDelts: ["Face pulls", "Cable pulls"],
  legs: [
    "Squat",
    "Leg press",
    "Romanian deadlift",
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

/* the groups the focus day is built from — chest and arms */
const FOCUS = ["chest", "biceps", "triceps"];

const DEFAULT_PICKS = {
  chest: ["Bench press", "Incline bench press"],
  back: ["Lat pulldowns", "Machine rows"],
  biceps: ["African curls", "Incline curls"],
  shoulders: ["Lateral raises", "Shoulder press"],
  triceps: ["Tricep rope pushdowns", "Skull crushers"],
  rearDelts: ["Face pulls"],
  legs: ["Squat", "Leg extension", "Seated leg curl"],
  abs: ["Cable crunches", "Hanging leg raises"],
};

const PUSH_GROUPS = ["chest", "shoulders", "triceps"];
const PULL_GROUPS = ["back", "rearDelts", "biceps"];

/* Six days, then round again. Nothing here is dated: the cycle only moves when
   a session is finished, so a day off costs you the day and not your place. */
const PLAN = {
  1: { label: "Push", groups: PUSH_GROUPS },
  2: { label: "Pull", groups: PULL_GROUPS },
  3: { label: "Focus day", groups: FOCUS, focus: true },
  4: { label: "Push", groups: PUSH_GROUPS },
  5: { label: "Pull", groups: PULL_GROUPS },
  /* abs ride with legs rather than with every session: six days of them is
     how a bulk turns into a sore back */
  6: { label: "Legs", groups: ["legs", "abs"] },
};

const CYCLE = 6;

/* ============================ helpers ============================ */

const dayLetter = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(y, m - 1, d).getDay()];
};

/* ---- the arc ----
 * A winter arc is a fixed stretch, not a mood: 1 November to the last day of
 * February. It is worked out from the date every time, so there is nothing to
 * set up and nothing to store — the front page simply knows which day of it
 * today is, and how many are left.
 */
const arcWindow = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  /* January and February belong to the arc that opened the November before */
  const from = m >= 11 ? y : y - 1;
  const to = from + 1;
  const leap = (to % 4 === 0 && to % 100 !== 0) || to % 400 === 0;
  const start = `${from}-11-01`;
  const end = `${to}-02-${leap ? 29 : 28}`;
  return { start, end, length: dayNum(end) - dayNum(start) + 1 };
};

const arcStatus = (iso) => {
  const { start, end, length } = arcWindow(iso);
  const n = dayNum(iso);
  if (n >= dayNum(start) && n <= dayNum(end)) {
    const day = n - dayNum(start) + 1;
    return { on: true, day, length, left: length - day };
  }
  /* out of season: count the days to the next 1 November */
  const [y, m] = iso.split("-").map(Number);
  const next = m >= 11 ? `${y + 1}-11-01` : `${y}-11-01`;
  return { on: false, length, until: dayNum(next) - n };
};

/* The built-in list for a muscle group plus anything added on the phone. */
const listFor = (g, custom) => [...LIBRARY[g], ...((custom && custom[g]) || [])];

/* One rule, every day of the cycle: everything ticked for the day's muscle
   groups, three sets each, to failure. The original tracker had a light day to
   protect; this one does not, so there is nothing to build around. */
function buildSession(day, picks, custom, lifts) {
  const spec = PLAN[day];

  const items = [];
  spec.groups.forEach((g) => {
    listFor(g, custom)
      .filter((n) => (picks[g] || []).includes(n))
      .forEach((name) => items.push({ group: g, name, sets: 3 }));
  });

  return {
    day,
    label: spec.label,
    /* the focus day is the one that is not push, pull or legs, so it is the
       one that gets the bright accent */
    accent: spec.focus ? PUSH : HOLD,
    items,
  };
}

/* the cycle only turns on a finished session, never on the calendar */
const advance = (pos) => ({ day: pos.day < CYCLE ? pos.day + 1 : 1 });

/* progressive overload rule: add a rep until 12, then add 2.5kg and drop to 8 */
const nextTarget = (best) => {
  if (!best) return null;
  return best.r < 12
    ? { w: best.w, r: best.r + 1 }
    : { w: +(best.w + 2.5).toFixed(1), r: 8 };
};

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
            border: `1px solid ${RULE}`,
            padding: "12px 10px",
            fontSize: 16,
            fontFamily: BODY,
            color: TEXT,
            background: CARD,
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
            color: valid ? ON_ACCENT : MUTE,
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
    <div className="pad-session" style={{ minHeight: "100vh", background: BG }}>
      <div
        style={{
          background: session.accent,
          color: ON_ACCENT,
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
            {session.label} &middot; Day {session.day} of {CYCLE}
          </div>
          <Btn
            onClick={onQuit}
            style={{
              background: "transparent",
              color: ON_ACCENT,
              fontSize: 13,
              border: `1px solid ${ON_ACCENT}66`,
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
            color: beaten ? ON_ACCENT : TEXT,
            borderRadius: 12,
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
            className="orn"
            style={{
              border: `1px solid ${s.done ? WIN : RULE}`,
              borderRadius: 14,
              padding: "10px 12px 12px",
              marginBottom: 10,
              /* the only ground that is not a token elsewhere: a finished set */
              background: s.done ? "var(--done)" : CARD,
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
                step={0.5}
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
                background: s.done ? WIN : RAISED,
                color: s.done ? ON_ACCENT : TEXT,
                border: `1px solid ${s.done ? WIN : RULE}`,
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
          background: INK,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        <Btn
          onClick={finishExercise}
          style={{
            width: "100%",
            padding: "18px 0",
            fontSize: 21,
            background: session.accent,
            color: ON_ACCENT,
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
  const [picked, setPicked] = useState(null);
  const sessions = bestPerDay(hist);
  const first = sessions[0];
  const best = bestOf(hist);
  const target = nextTarget(best);
  const recent = sessions.slice(-12).reverse();
  const maxVol = Math.max(...recent.map((s) => s.w * s.r), 1);
  const gain = first && best ? +(best.w - first.w).toFixed(1) : 0;

  return (
    <div style={{ fontFamily: BODY, color: TEXT, background: CARD, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ background: INK, color: TEXT, padding: "14px 16px 16px" }}>
        <Btn
          onClick={onBack}
          style={{
            background: "transparent",
            color: TEXT,
            border: `1px solid ${RULE}`,
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
        <div style={{ background: WIN, color: ON_ACCENT, padding: "12px 14px", borderRadius: 12 }}>
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
            <div key={label} style={{ flex: 1, background: WASH, padding: "10px 8px", textAlign: "center", borderRadius: 10 }}>
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

        {sessions.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <SectionLabel style={{ marginBottom: 4 }}>Weight over time</SectionLabel>
            <TrendChart
              points={sessions.map((x) => ({ d: x.d, v: x.w }))}
              unit="kg"
              color={CHART}
              label={`${name} weight over time`}
              selected={picked}
              onSelect={setPicked}
            />
            <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20 }}>
              {picked != null
                ? `${shortDate(sessions[picked].d)} · ${sessions[picked].w}kg × ${sessions[picked].r}`
                : "Tap the line to read a session."}
            </div>
          </div>
        )}

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
                borderRadius: 10,
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
                  background: isBest ? WIN : "rgba(59,130,246,0.32)",
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
                    color: isBest ? ON_ACCENT : TEXT,
                  }}
                >
                  {s.w}kg × {s.r}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: isBest ? ON_ACCENT : MUTE,
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
    <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }}>
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
              color: ON_ACCENT,
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
              background: CARD,
              color: TEXT,
              border: `1px solid ${RULE}`,
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
        <div className="orn" style={{ border: `1px solid ${accent}`, borderRadius: 14, padding: "12px 12px 14px" }}>
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
              color: ON_ACCENT,
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
              background: CARD,
              color: TEXT,
              border: `1px solid ${RULE}`,
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

/* The mark off the home-screen icon, at wordmark size: a bar and two plates a
   side. SVG takes its colour through style rather than a fill attribute, since
   presentation attributes do not resolve var(). */
function Barbell({ height = 20, color = TEXT }) {
  return (
    <svg
      viewBox="0 0 64 32"
      height={height}
      width={height * 2}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <g style={{ fill: color }}>
        <rect x="4" y="14" width="56" height="4" rx="2" />
        <rect x="10" y="10" width="5" height="12" rx="1.5" />
        <rect x="18" y="5" width="6" height="22" rx="1.5" />
        <rect x="40" y="5" width="6" height="22" rx="1.5" />
        <rect x="49" y="10" width="5" height="12" rx="1.5" />
      </g>
    </svg>
  );
}

/* ============================ main app ============================ */

export default function WinterArc() {
  const [tab, setTab] = useState("today");
  const [detail, setDetail] = useState(null);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState(false);

  /* ---- load (localStorage is synchronous, so read it up front) ---- */
  const profile = loadJSON("wa-profile", {});
  const [picks, setPicks] = useState(profile.picks || DEFAULT_PICKS);
  const [custom, setCustom] = useState(profile.custom || {});
  const [theme, setTheme] = useState(profile.theme || "blackout");
  const [pos, setPos] = useState(profile.pos || { day: 1 });
  const [days, setDays] = useState(() => loadJSON("wa-days", {}));
  const [lifts, setLifts] = useState(() => loadJSON("wa-lifts", {}));
  const [weights, setWeights] = useState(() => loadJSON("wa-weight", {}));
  const [report, setReport] = useState(false);

  const persist = (key, value) => {
    try {
      saveJSON(key, value);
      setSaveError(false);
    } catch (e) {
      /* storage full, or blocked in private browsing */
      setSaveError(true);
    }
  };

  const saveProfile = (nextPicks, nextPos, nextCustom = custom, nextTheme = theme) => {
    setPicks(nextPicks);
    setPos(nextPos);
    setCustom(nextCustom);
    setTheme(nextTheme);
    persist("wa-profile", {
      picks: nextPicks,
      pos: nextPos,
      custom: nextCustom,
      theme: nextTheme,
    });
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

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const t = today();
  const flags = days[t] || {};
  const arc = arcStatus(t);

  const saveWeight = (kg) => {
    const next = { ...weights, [t]: kg };
    setWeights(next);
    persist("wa-weight", next);
  };

  const toggleFlag = (k) => {
    const next = { ...days, [t]: { ...flags, [k]: !flags[k] } };
    setDays(next);
    persist("wa-days", next);
  };

  const session = buildSession(pos.day, picks, custom, lifts);

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

    persist("wa-lifts", nextLifts);
    persist("wa-days", nextDays);
    persist("wa-profile", { picks, pos: nextPos, custom, theme });
  };

  const reportMetrics = [
    { key: "workout", label: "Sessions", target: PER_BLOCK.workout, one: "session", many: "sessions" },
    { key: "eat", label: "Ate big", target: PER_BLOCK.eat, one: "day eating big", many: "days eating big" },
  ];
  const blocks = buildBlocks(days, lifts, weights, today(), HABITS);
  const shownBlocks = (() => {
    const stored = loadJSON("wa-reports", {});
    return blocks.map((b) => (b.complete && stored[b.i]) || b);
  })();

  useEffect(() => {
    const done = blocks.filter((b) => b.complete);
    if (!done.length) return;
    const stored = loadJSON("wa-reports", {});
    let changed = false;
    done.forEach((b) => {
      if (!stored[b.i]) {
        stored[b.i] = b;
        changed = true;
      }
    });
    if (changed) persist("wa-reports", stored);
  });

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

  if (report) {
    return (
      <ReportScreen
        blocks={shownBlocks}
        metrics={reportMetrics}
        onBack={() => setReport(false)}
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
  /* eight weekly buckets ending today; the last one is still running */
  const weekBars = Array.from({ length: 8 }, (_, i) => {
    const back = (7 - i) * 7 + 6;
    const window = Array.from({ length: 7 }, (_, j) => shiftDay(t, -back + j));
    return {
      label: i === 7 ? "now" : `${7 - i}w`,
      n: window.filter((d) => days[d] && days[d].workout).length,
      running: i === 7,
    };
  });
  const count = (k) => week7.filter((d) => days[d] && days[d][k]).length;

  /* ---- keeping him honest: how long since the last one, how many lately ---- */
  const workoutDays = Object.keys(days)
    .filter((d) => days[d] && days[d].workout)
    .sort();
  const lastWorkout = workoutDays.length ? workoutDays[workoutDays.length - 1] : null;
  const daysSince = lastWorkout ? dayNum(t) - dayNum(lastWorkout) : null;
  const cutoff = shiftDay(t, -27);
  const last28 = workoutDays.filter((d) => d >= cutoff).length;
  /* six sessions a week is the plan, so two days off is already a slip */
  const slipping = daysSince !== null && daysSince >= 2;
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
        color: TEXT,
        background: BG,
        minHeight: "100vh",
        WebkitTextSizeAdjust: "100%",
      }}
    >
      {saveError && (
        <div
          style={{
            background: PUSH,
            color: ON_ACCENT,
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
          <div style={{ background: INK, color: TEXT, padding: "16px 16px 18px" }}>
            {/* the wordmark, and where in the arc today falls — both read off
                the date, so there is nothing here to keep up to date */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                borderBottom: `1px solid ${RULE}`,
                paddingBottom: 10,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Barbell height={18} />
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 22,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  Winter Arc
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: arc.on ? ACCENT_TEXT : MUTE,
                  textAlign: "right",
                }}
              >
                {arc.on
                  ? `Day ${arc.day} of ${arc.length} · ${arc.left} left`
                  : `Opens in ${arc.until} day${arc.until === 1 ? "" : "s"}`}
              </div>
            </div>

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
              {session.label}
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 19,
                marginTop: 10,
                color: ON_ACCENT,
                background: session.accent,
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}
            >
              Day {session.day} of {CYCLE}
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {daysSince === null ? (
              <div
                style={{
                  background: HOLD,
                  color: ON_ACCENT,
                  padding: "12px 14px",
                  borderRadius: 12,
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
                  color: ON_ACCENT,
                  padding: "12px 14px",
                  borderRadius: 12,
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
                color: ACCENT_TEXT,
                marginTop: 8,
              }}
            >
              3 sets &middot; 8&ndash;12 reps &middot; to true failure
            </div>

            {session.items.length === 0 ? (
              <div
                style={{
                  background: WASH,
                  padding: "14px 12px",
                  marginTop: 14,
                  borderLeft: `3px solid ${HOLD}`,
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
                    color: ON_ACCENT,
                  }}
                >
                  Start session
                </Btn>
              </>
            )}

            <div
              style={{
                marginTop: 22,
                borderTop: `1px solid ${RULE}`,
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
                ["workout", "Trained"],
                ["eat", "Ate big"],
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
                    color: flags[k] ? ON_ACCENT : TEXT,
                    border: `1px solid ${flags[k] ? WIN : RULE}`,
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
          <div style={{ background: INK, color: TEXT, padding: "16px" }}>
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
            {shownBlocks.length > 0 && (
              <Btn
                onClick={() => setReport(true)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: RAISED,
                  color: TEXT,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}
              >
                <SectionLabel style={{ marginBottom: 2 }}>Four-week report</SectionLabel>
                <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: "-0.02em" }}>
                  Weeks {shownBlocks[shownBlocks.length - 1].i * 4 + 1}&ndash;
                  {shownBlocks[shownBlocks.length - 1].i * 4 + 4}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                  {shownBlocks[shownBlocks.length - 1].up.length} up &middot;{" "}
                  {shownBlocks[shownBlocks.length - 1].stalled.length} stalled — tap to read
                </div>
              </Btn>
            )}

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
                ["workout", "Sessions", PER_WEEK],
                ["eat", "Ate big", 7],
              ].map(([k, label, target]) => {
                const c = count(k);
                const hit = c >= target;
                return (
                  <div
                    key={k}
                    style={{
                      flex: 1,
                      background: hit ? WIN : WASH,
                      color: hit ? ON_ACCENT : TEXT,
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

            <div style={{ marginTop: 22 }}>
              <SectionLabel style={{ marginBottom: 4 }}>Sessions a week</SectionLabel>
              <WeekBars weeks={weekBars} target={PER_WEEK} />
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
                ["eat", "Food"],
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
                done — the plan is six sessions a week and eating big every day
                of it, so a gap is meant to be the exception.
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
                      color: TEXT,
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
                        color: up ? GOOD : TEXT,
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

      {tab === "weight" && <WeightPanel weights={weights} onSave={saveWeight} />}

      {/* ---------------- SETUP ---------------- */}
      {tab === "setup" && (
        <div>
          <div style={{ background: INK, color: TEXT, padding: "16px" }}>
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
            <div style={{ fontSize: 15, marginTop: 10, lineHeight: 1.4, color: ACCENT_TEXT }}>
              Push &middot; Pull &middot; Focus &middot; Push &middot; Pull &middot; Legs, then
              round again. Six days, everything to failure, no cardio, eating big the
              whole way.
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            <SectionLabel style={{ marginBottom: 8 }}>Look</SectionLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(THEMES).map(([k, th]) => {
                const on = theme === k;
                return (
                  <Btn
                    key={k}
                    onClick={() => saveProfile(picks, pos, custom, k)}
                    style={{
                      flex: 1,
                      padding: "16px 4px",
                      fontSize: 17,
                      background: on ? PUSH : CARD,
                      color: on ? ON_ACCENT : TEXT,
                      border: `1px solid ${on ? PUSH : RULE}`,
                    }}
                  >
                    {th.label}
                  </Btn>
                );
              })}
            </div>
            <div style={{ fontSize: 14, color: MUTE, marginTop: 8 }}>{THEMES[theme].note}</div>

            <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }} />

            {Object.keys(LIBRARY).map((g) => (
              <div key={g} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 24,
                    textTransform: "uppercase",
                    letterSpacing: "-0.03em",
                    color: FOCUS.includes(g) ? ACCENT_TEXT : TEXT,
                    borderBottom: `1px solid ${RULE}`,
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
                          background: on ? RAISED : CARD,
                          color: TEXT,
                          border: `1px solid ${on ? PUSH_C : RULE}`,
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
                            background: CARD,
                            color: MUTE,
                            border: `1px solid ${RULE}`,
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
              app="winter-arc"
              prefix="wa"
              keys={["wa-profile", "wa-days", "wa-lifts"]}
              accent={PUSH}
            />

            <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
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
                Where am I in the cycle?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(PLAN).map(Number).map((d) => {
                  const on = pos.day === d;
                  const accent = PLAN[d].focus ? PUSH : HOLD;
                  return (
                    <Btn
                      key={d}
                      onClick={() => saveProfile(picks, { day: d })}
                      style={{
                        flex: "1 0 30%",
                        padding: "12px 6px",
                        fontSize: 15,
                        background: on ? accent : CARD,
                        color: on ? ON_ACCENT : TEXT,
                        border: `1px solid ${on ? accent : RULE}`,
                      }}
                    >
                      {d}. {PLAN[d].label}
                    </Btn>
                  );
                })}
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
          borderTop: `1px solid ${RULE}`,
          background: INK,
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
            plain
            onClick={() => setTab(k)}
            style={{
              borderRadius: 0,
              flex: 1,
              padding: "18px 0",
              fontSize: 15,
              background: tab === k ? RAISED : BG,
              color: tab === k ? TEXT : MUTE,
            }}
          >
            {label}
          </Btn>
        ))}
      </div>
    </div>
  );
}
