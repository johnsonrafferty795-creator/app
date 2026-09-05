import { useEffect, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import { dayNum, shiftDay, shortDate, today } from "./dates";
import {
  DEFAULT_TOP,
  HOLD_SESSIONS,
  bestPerDay,
  overloadNote,
  overloadTarget,
  topSet,
} from "./lifts";
import { ExerciseRules, RulesButton } from "./rules";
import { Btn, SectionLabel, Stepper } from "./ui";
import { TrendChart, WeekBars } from "./charts";
import { WeightPanel } from "./weight";
import { BLOCK, ReportScreen, buildBlocks } from "./report";
import { OrderPanel, inOrder } from "./order";
import {
  ACCENT_TEXT,
  BG,
  BODY,
  CARD,
  DISPLAY,
  GOOD,
  INK,
  LEGS_C,
  MUTE,
  ON_ACCENT,
  PULL_C,
  PUSH_C,
  RAISED,
  REST_C,
  RULE,
  TEXT,
  THEMES,
  WASH,
  WIN,
  applyTheme,
} from "./tokens";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
  summarise,
} from "./backup";

/* ============================ constants ============================ */

/* Dark gym: a near-black ground with one bright accent per day type. Kept
   deliberately unlike the other app on this domain, so the two home-screen
   icons and the two apps are never mistaken for each other.
   INK is a raised surface here, not the type colour — TEXT is the type. */

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
/* three training days in every four: exactly 21 in a 28-day block. The weekly
   figure is derived from logged rest days instead, so it can say five or six. */
const SESSIONS_PER_BLOCK = 21;

/* the habits this app tracks, and what a four-week block should hold of each */
const HABITS = ["workout", "eat", "cardio"];

const SET_CHOICES = [2, 3];
const DEFAULT_SETS = 3;
const REP_LOW = 6;
/* the rep the weight moves up at by default: reach 13 and the next session is
   heavier. Each exercise can pick its own. */
const REP_HIGH = DEFAULT_TOP;

/* Sets, the rep count that moves the weight, and how long a target is held all
   belong to the exercise rather than the muscle group. An older profile has
   sets per group and nothing else, so those are the fallbacks: it trains
   exactly as it did before anything here is touched. */
const rulesFor = (name, g, rules, sets) => {
  const r = (rules && rules[name]) || {};
  return {
    sets: r.sets || (sets && sets[g]) || DEFAULT_SETS,
    top: r.top || REP_HIGH,
    hold: r.hold || HOLD_SESSIONS,
  };
};

/* How much weight a muscle group adds once the top of the rep range is reached.
   A dumbbell curl and a leg press do not move up by the same amount, so each
   group carries its own step. Anything unset stays at 2.5kg, which is what
   every exercise used before this was a choice. */
const STEP_CHOICES = [1.25, 2.5, 5, 10];
const DEFAULT_STEP = 2.5;
const stepFor = (g, steps) => (steps && steps[g]) || DEFAULT_STEP;

/* days: how many cardio days a seven-day stretch should hold, for the weekly
   tile. perBlock: the same over a 28-day report block — three training days in
   every four is 21, not 20, so it is spelled out rather than multiplied. */
const GOALS = {
  bulk: { label: "Bulk", cardio: "No cardio", days: 0, perBlock: 0 },
  cut: { label: "Cut", cardio: "Cardio every day", days: 7, perBlock: BLOCK },
  maintain: {
    label: "Maintain",
    cardio: "Cardio every day except the rest day",
    days: 5,
    perBlock: 21,
  },
};

/* Cut = every day. Bulk = never. Maintain = every training day, so it follows
   the rotation and skips only the rest day. */
const cardioDue = (goal, pos) =>
  goal === "cut" ? true : goal === "maintain" ? CYCLE[pos - 1].key !== "rest" : false;

/* ============================ helpers ============================ */

/* The built-in list for a muscle group plus anything added on the phone. */
const listFor = (g, custom) => [...LIBRARY[g], ...((custom && custom[g]) || [])];

/* which muscle group an exercise belongs to, for the screens that only know a
   name - the overload step is a property of the group, not the movement */
const groupOf = (name, custom) =>
  Object.keys(LIBRARY).find((g) => listFor(g, custom).includes(name));

/* Every exercise ticked for a muscle group is in the session — not one of them.
   List order, so the session doesn't reshuffle when a choice is toggled. */
function buildSession(pos, picks, custom, sets, steps, order, rules) {
  const spec = CYCLE[pos - 1];
  const items = [];
  spec.groups.forEach((g) => {
    const chosen = picks[g] || [];
    listFor(g, custom).forEach((name) => {
      if (!chosen.includes(name)) return;
      const r = rulesFor(name, g, rules, sets);
      items.push({
        group: g,
        name,
        sets: r.sets,
        top: r.top,
        hold: r.hold,
        step: stepFor(g, steps),
      });
    });
  });
  return {
    pos,
    key: spec.key,
    label: spec.label,
    accent: spec.color,
    items: inOrder(items, order && order[spec.key], (n) => groupOf(n, custom)),
  };
}

const advance = (pos) => (pos % CYCLE_LEN) + 1;

/* progressive overload, on this app's rep range: a rep every third session at
   the same weight, and at 13 the weight goes up by the group's step */
const nextTarget = (hist, step = DEFAULT_STEP, top = REP_HIGH, hold = HOLD_SESSIONS) =>
  overloadTarget(hist, { step, low: REP_LOW, top, hold });


/* ============================ session runner ============================ */

function Session({ session, lifts, onFinish, onQuit }) {
  const [idx, setIdx] = useState(0);
  const [entries, setEntries] = useState(() =>
    session.items.map((it) => {
      const tgt = nextTarget(lifts[it.name], it.step, it.top, it.hold);
      return Array.from({ length: it.sets }, () => ({
        w: tgt ? tgt.w : 20,
        r: tgt ? tgt.r : 10,
        done: false,
      }));
    })
  );

  const item = session.items[idx];
  const name = item.name;
  const target = nextTarget(lifts[name], item.step, item.top, item.hold);
  const last = target && target.best;
  const sets = entries[idx];

  const setField = (si, field, val) =>
    setEntries(
      entries.map((e, i) =>
        i === idx ? e.map((s, j) => (j === si ? { ...s, [field]: val } : s)) : e
      )
    );

  /* hit means the target itself was met - the weight and the reps asked for -
     rather than any set that happens to out-volume the old best */
  const beaten =
    target && sets.some((s) => s.done && s.w >= target.w && s.r >= target.r);

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
      <div style={{ background: session.accent, color: ON_ACCENT, padding: "14px 16px" }}>
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
            plain
            onClick={onQuit}
            style={{
              background: "transparent",
              color: ON_ACCENT,
              fontSize: 13,
              border: `2px solid ${ON_ACCENT}66`,
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
            color: beaten ? ON_ACCENT : TEXT,
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 14,
          }}
          className="orn"
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
              {overloadNote(target, item.top)}
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
              background: s.done ? "#12261F" : CARD,
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
              Set {si + 1} &middot; {REP_LOW}&ndash;{item.top} reps
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
                border: `2px solid ${s.done ? WIN : RULE}`,
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

function ExerciseDetail({ name, hist, step = DEFAULT_STEP, top = REP_HIGH, hold = HOLD_SESSIONS, onBack }) {
  const [picked, setPicked] = useState(null);
  const sessions = bestPerDay(hist);
  const first = sessions[0];
  const target = nextTarget(hist, step, top, hold);
  const best = target && target.best;
  const recent = sessions.slice(-12).reverse();
  const maxVol = Math.max(...recent.map((s) => s.w * s.r), 1);
  const gain = first && best ? +(best.w - first.w).toFixed(1) : 0;

  return (
    <div
      style={{
        fontFamily: BODY,
        color: TEXT,
        background: BG,
        minHeight: "100vh",
        paddingBottom: 40,
      }}
    >
      <div style={{ background: INK, color: TEXT, padding: "14px 16px 16px" }}>
        <Btn
          plain
          onClick={onBack}
          style={{
            background: "transparent",
            color: TEXT,
            border: `2px solid ${RULE}`,
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
            {overloadNote(target, top)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, opacity: 0.9 }}>
            {hold === 1 ? "A rep every session" : `A rep every ${hold} sessions`}. At{" "}
            {top} reps, add {step}kg and drop back to {REP_LOW}.
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
              style={{ flex: 1, background: WASH, padding: "10px 8px", textAlign: "center", borderRadius: 10 }}
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

        {sessions.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <SectionLabel style={{ marginBottom: 4 }}>Weight over time</SectionLabel>
            <TrendChart
              points={sessions.map((x) => ({ d: x.d, v: x.w }))}
              unit="kg"
              color={PUSH_C}
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
            borderRadius: 10,
            padding: "12px 10px",
            fontSize: 16,
            fontFamily: BODY,
            color: TEXT,
            background: CARD,
            outline: "none",
          }}
        />
        <Btn
          plain
          onClick={() => {
            if (!valid) return;
            onAdd(name);
            setText("");
          }}
          style={{
            padding: "0 16px",
            fontSize: 16,
            background: valid ? PUSH_C : WASH,
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

/* ============================ weight entry ============================ */

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
      <SectionLabel style={{ marginBottom: 8 }}>Backup</SectionLabel>
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
              borderRadius: 12,
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

/* ============================ main app ============================ */

export default function PPLHub() {
  const [tab, setTab] = useState("today");
  const [detail, setDetail] = useState(null);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [picked, setPicked] = useState(null);
  const [report, setReport] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const profile = loadJSON("ppl-profile", {});
  const [picks, setPicks] = useState(profile.picks || DEFAULT_PICKS);
  const [custom, setCustom] = useState(profile.custom || {});
  const [sets, setSets] = useState(profile.sets || {});
  const [steps, setSteps] = useState(profile.steps || {});
  const [order, setOrder] = useState(profile.order || {});
  const [rules, setRules] = useState(profile.rules || {});
  const [openRules, setOpenRules] = useState(null);
  /* positions 5-7 exist only in the old seven-day rotation; fold them back in */
  const [pos, setPos] = useState(((profile.pos || 1) - 1) % CYCLE_LEN + 1);
  const [goal, setGoal] = useState(profile.goal || "maintain");
  const [theme, setTheme] = useState(profile.theme || "steel");
  const [days, setDays] = useState(() => loadJSON("ppl-days", {}));
  const [lifts, setLifts] = useState(() => loadJSON("ppl-lifts", {}));
  const [weights, setWeights] = useState(() => loadJSON("ppl-weight", {}));

  const reportMetrics = [
    { key: "workout", label: "Sessions", target: SESSIONS_PER_BLOCK, one: "session", many: "sessions" },
    { key: "eat", label: "Ate well", target: BLOCK, one: "day eating well", many: "days eating well" },
    ...(GOALS[goal].perBlock
      ? [
          {
            key: "cardio",
            label: "Cardio",
            target: GOALS[goal].perBlock,
            one: "cardio day",
            many: "cardio days",
          },
        ]
      : []),
  ];
  const blocks = buildBlocks(days, lifts, weights, today(), HABITS);

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
    const merged = { picks, pos, goal, custom, theme, sets, steps, order, rules, ...next };
    if (next.picks) setPicks(next.picks);
    if (next.pos) setPos(next.pos);
    if (next.goal) setGoal(next.goal);
    if (next.custom) setCustom(next.custom);
    if (next.sets) setSets(next.sets);
    if (next.steps) setSteps(next.steps);
    if (next.order) setOrder(next.order);
    if (next.rules) setRules(next.rules);
    if (next.theme) setTheme(next.theme);
    persist("ppl-profile", merged);
  };

  /* one exercise's own rules; anything not set falls back to the group */
  const setRule = (name, patch) =>
    saveProfile({
      rules: { ...rules, [name]: { ...rulesFor(name, groupOf(name, custom), rules, sets), ...patch } },
    });

  /* a new exercise goes on the list and is ticked straight away */
  const addExercise = (g, name) =>
    saveProfile({
      custom: { ...custom, [g]: [...(custom[g] || []), name] },
      picks: { ...picks, [g]: [...(picks[g] || []), name] },
    });

  /* only ones added here can be taken off again; any logged history stays */
  const removeExercise = (g, name) =>
    saveProfile({
      custom: { ...custom, [g]: (custom[g] || []).filter((n) => n !== name) },
      picks: { ...picks, [g]: (picks[g] || []).filter((n) => n !== name) },
    });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const t = today();
  const flags = days[t] || {};
  const session = buildSession(pos, picks, custom, sets, steps, order, rules);
  const isRest = session.key === "rest";
  const cardioOn = cardioDue(goal, pos);

  /* The running order is saved per day type, so a push day keeps the order set
     on the last one. Swapping neighbours keeps every name in the list, which
     dragging on a small screen does not reliably do. */
  const moveExercise = (i, d) => {
    const names = session.items.map((it) => it.name);
    const j = i + d;
    if (j < 0 || j >= names.length) return;
    [names[i], names[j]] = [names[j], names[i]];
    saveProfile({ order: { ...order, [session.key]: names } });
  };

  const resetOrder = () => {
    const next = { ...order };
    delete next[session.key];
    saveProfile({ order: next });
  };

  const toggleFlag = (k) => {
    const next = { ...days, [t]: { ...flags, [k]: !flags[k] } };
    setDays(next);
    persist("ppl-days", next);
  };

  /* a rest day is marked as such, so nothing downstream reads it as a session
     that was skipped */
  const finishRestDay = () => {
    const nextDays = { ...days, [t]: { ...flags, rest: true } };
    setDays(nextDays);
    persist("ppl-days", nextDays);
    saveProfile({ pos: advance(pos) });
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
    persist("ppl-profile", {
      picks,
      pos: nextPos,
      goal,
      custom,
      theme,
      sets,
      steps,
      order,
      rules,
    });
  };

  const saved = loadJSON("ppl-reports", {});
  const shownBlocks = blocks.map((b) => (b.complete && saved[b.i] ? saved[b.i] : b));

  if (report) {
    return (
      <ReportScreen blocks={shownBlocks} metrics={reportMetrics} onBack={() => setReport(false)} />
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
      <ExerciseDetail
        name={detail}
        hist={lifts[detail]}
        step={stepFor(groupOf(detail, custom), steps)}
        top={rulesFor(detail, groupOf(detail, custom), rules, sets).top}
        hold={rulesFor(detail, groupOf(detail, custom), rules, sets).hold}
        onBack={() => setDetail(null)}
      />
    );
  }

  const week7 = Array.from({ length: 7 }, (_, i) => shiftDay(t, -6 + i));
  const count = (k) => week7.filter((d) => days[d] && days[d][k]).length;
  /* Rest days are not misses, so they come off the week's target rather than
     sitting there looking like sessions that never happened. Three training
     days in every four means a week holds five or six of them, so that is the
     range: a week with no rest day logged asks for six, not seven. */
  const restThisWeek = week7.filter((d) => days[d] && days[d].rest).length;
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
  const trainingTarget = Math.min(6, Math.max(4, 7 - restThisWeek));

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
        color: TEXT,
        background: BG,
        minHeight: "100vh",
        WebkitTextSizeAdjust: "100%",
      }}
    >
      {saveError && (
        <div
          style={{
            background: PUSH_C,
            color: ON_ACCENT,
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
          <div style={{ background: INK, color: TEXT, padding: "16px 16px 18px" }}>
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
                color: TEXT,
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
                  color: ON_ACCENT,
                  background: session.accent,
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
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
              <div className="orn" style={{ background: WASH, padding: "16px 14px", borderRadius: 12, borderLeft: `3px solid ${REST_C}` }}>
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
                  onClick={finishRestDay}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "18px 0",
                    fontSize: 20,
                    background: REST_C,
                    color: ON_ACCENT,
                  }}
                >
                  Rest day done →
                </Btn>
              </div>
            ) : (
              <>
                {session.items.length === 0 ? (
                  <div style={{ background: WASH, padding: "14px 12px", borderRadius: 12, borderLeft: `3px solid ${REST_C}` }}>
                    <div style={{ fontSize: 16, lineHeight: 1.35 }}>
                      Nothing ticked for today&rsquo;s muscle groups. Open{" "}
                      <strong>Plan</strong> and choose the exercises you use.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
                      {session.items.length} exercises &middot;{" "}
                      {session.items.reduce((n, i) => n + i.sets, 0)} sets
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: ACCENT_TEXT,
                        marginTop: 4,
                      }}
                    >
                      {(() => {
                        const counts = [...new Set(session.items.map((i) => i.sets))].sort();
                        return counts.length === 1
                          ? `${counts[0]} sets each`
                          : `${counts[0]}\u2013${counts[counts.length - 1]} sets`;
                      })()}{" "}
                      &middot; {REP_LOW}&ndash;
                      {Math.max(...session.items.map((i) => i.top))} reps &middot; every
                      set to failure
                    </div>
                    {ordering ? (
                      <OrderPanel
                        items={session.items}
                        groupNames={GROUP_NAMES}
                        accent={session.accent}
                        hasOrder={!!order[session.key]}
                        onMove={moveExercise}
                        onReset={resetOrder}
                        onDone={() => setOrdering(false)}
                        note={`This order is kept for every ${session.label.toLowerCase()} day until you change it again.`}
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: 15, color: MUTE, marginTop: 8, lineHeight: 1.4 }}>
                          {session.items.map((i, n) => `${n + 1}. ${i.name}`).join("  ·  ")}
                        </div>
                        {session.items.length > 1 && (
                          <Btn
                            onClick={() => setOrdering(true)}
                            style={{
                              marginTop: 8,
                              padding: "9px 12px",
                              fontSize: 15,
                              background: CARD,
                              color: TEXT,
                              border: `1px solid ${RULE}`,
                            }}
                          >
                            Change the order
                          </Btn>
                        )}
                      </>
                    )}
                    <Btn
                      onClick={() => setRunning(true)}
                      style={{
                        width: "100%",
                        marginTop: 14,
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
              </>
            )}

            <div style={{ marginTop: 22, borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
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
                    background: RAISED,
                    color: TEXT,
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
                ["workout", "Sessions", trainingTarget],
                ["eat", "Ate well", 7],
                ...(GOALS[goal].days
                  ? [["cardio", "Cardio", goal === "cut" ? 7 : trainingTarget]]
                  : []),
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
                      borderRadius: 10,
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
              <WeekBars weeks={weekBars} target={trainingTarget} />
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
                      /* nothing was due on a rest day, bar the eating */
                      const off = k !== "eat" && days[d] && days[d].rest && !on;
                      return (
                        <div
                          key={d}
                          title={off ? `${d} · rest day` : d}
                          style={{
                            flex: 1,
                            height: 22,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: on ? WIN : WASH,
                            border: `1px solid ${on ? WIN : off ? WASH : RULE}`,
                            color: MUTE,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {off ? "–" : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: MUTE, marginTop: 4 }}>
                Oldest on the left, today on the right. A dash is a rest day —
                nothing was due, so nothing was missed.
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
                const b = topSet(hist);
                const first = hist[0];
                const up = first && b && (b.w > first.w || (b.w === first.w && b.r > first.r));
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
              My plan
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
              Goal, exercises, and where you are in the rotation.
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
                    onClick={() => saveProfile({ theme: k })}
                    style={{
                      flex: 1,
                      padding: "16px 4px",
                      fontSize: 17,
                      background: on ? PUSH_C : CARD,
                      color: on ? ON_ACCENT : TEXT,
                      border: `1px solid ${on ? PUSH_C : RULE}`,
                    }}
                  >
                    {th.label}
                  </Btn>
                );
              })}
            </div>
            <div style={{ fontSize: 14, color: MUTE, marginTop: 8 }}>
              {THEMES[theme].note}
            </div>

            <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }} />

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
                      background: on ? PUSH_C : CARD,
                      color: on ? ON_ACCENT : TEXT,
                      border: `1px solid ${on ? PUSH_C : RULE}`,
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

            <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }}>
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
                        background: on ? d.color : CARD,
                        color: on ? ON_ACCENT : TEXT,
                        border: `1px solid ${on ? d.color : RULE}`,
                      }}
                    >
                      {n}. {d.label}
                    </Btn>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 20, paddingTop: 14 }}>
              <SectionLabel style={{ marginBottom: 10 }}>
                My exercises &middot; tap the ones you use
              </SectionLabel>
              {Object.keys(LIBRARY).map((g) => (
                <div key={g} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 24,
                      textTransform: "uppercase",
                      letterSpacing: "-0.03em",
                      color: TEXT,
                      borderBottom: `1px solid ${RULE}`,
                      paddingBottom: 6,
                      marginBottom: 8,
                    }}
                  >
                    {GROUP_NAMES[g]}
                  </div>
                  {/* how much this group adds once 13 reps are hit */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: MUTE,
                      }}
                    >
                      Weight step
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {STEP_CHOICES.map((n) => {
                        const on = stepFor(g, steps) === n;
                        return (
                          <Btn
                            key={n}
                            plain
                            aria={`Add ${n}kg for ${GROUP_NAMES[g].toLowerCase()}`}
                            onClick={() => saveProfile({ steps: { ...steps, [g]: n } })}
                            style={{
                              padding: "7px 9px",
                              fontSize: 14,
                              fontWeight: 800,
                              borderRadius: 8,
                              background: on ? PUSH_C : CARD,
                              color: on ? ON_ACCENT : MUTE,
                              border: `1px solid ${on ? PUSH_C : RULE}`,
                            }}
                          >
                            {n}kg
                          </Btn>
                        );
                      })}
                    </div>
                  </div>
                  {listFor(g, custom).map((name) => {
                    const on = (picks[g] || []).includes(name);
                    const mine = (custom[g] || []).includes(name);
                    const toggle = () => {
                      const cur = picks[g] || [];
                      saveProfile({
                        picks: {
                          ...picks,
                          [g]: on ? cur.filter((n) => n !== name) : [...cur, name],
                        },
                      });
                    };
                    const rulesOpen = openRules === name;
                    /* two separate buttons, never one inside the other */
                    return (
                      <div key={name}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
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
                        {on && (
                          <RulesButton
                            name={name}
                            open={rulesOpen}
                            accent={PUSH_C}
                            onClick={() => setOpenRules(rulesOpen ? null : name)}
                          />
                        )}
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
                      {on && rulesOpen && (
                        <ExerciseRules
                          name={name}
                          rules={rulesFor(name, g, rules, sets)}
                          showSets
                          setChoices={SET_CHOICES}
                          accent={PUSH_C}
                          onChange={(patch) => setRule(name, patch)}
                        />
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
                app="ppl"
                prefix="ppl"
                keys={["ppl-profile", "ppl-days", "ppl-lifts", "ppl-weight", "ppl-reports"]}
                accent={PUSH_C}
              />
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
              flex: 1,
              padding: "18px 0",
              fontSize: 15,
              borderRadius: 0,
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
