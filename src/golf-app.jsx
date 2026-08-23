import { useEffect, useRef, useState } from "react";

import { Diagram } from "./golf-figures.jsx";
import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
} from "./backup";

/* ============================ constants ============================ */

/* Deep fairway green, chalk type, bunker gold. Nothing like the other four
   apps on this domain — that is the point of it. */
const GROUND = "#08251C";
const PANEL = "#0E362A";
const TYPE = "#F2F0E8";
const MUTE = "#9FB3A9";
const FAINT = "#7E948A";
const EDGE = "rgba(242,240,232,0.12)";

/* One colour per block, so a block is known before it is read. Each was
   checked against both GROUND and PANEL for WCAG AA as type: grass 8.3:1,
   sand 7.6:1, sky 7.4:1 on the ground, and none drops below 6:1 on a panel. */
const GRASS = "#5FCF8E";
const SAND = "#E0A83E";
const SKY = "#6FB6E8";

const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const KEY_LOG = "gf-log";
const APP = "golf";
const KEYS = [KEY_LOG];

/* half a year of days is plenty to look back on, and keeps the store small
   enough to never think about */
const KEEP_DAYS = 180;

/* The week runs Monday to Sunday, which is how "twice a week" is counted. */
const WEEK_START = 1;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/* ============================ the plan ============================ */

/* Three blocks, exactly as they are written on the plan. The doses are not
   free text: every one is a number of sets, of either seconds held or reps,
   done once or on each side — which is what lets the runner count through a
   session rather than just show a list. */
const BLOCKS = [
  {
    id: "A",
    name: "Daily Flexibility",
    short: "Flexibility",
    minutes: "10 min",
    cadence: "Every day",
    when: "Any time, every day",
    why: "Keeps everything loose day to day, and undoes what the gym tightens.",
    colour: GRASS,
    items: [
      {
        id: "a1",
        name: "Couch stretch",
        detail: "hip flexor and quad",
        kind: "hold", sets: 1, secs: 60, sides: true,
        cue: "Back knee on something soft, foot up the wall. Squeeze the glute and tuck the pelvis under — the stretch belongs in the front of the hip, not the knee.",
      },
      {
        id: "a2",
        name: "90/90 hip switch",
        detail: "stretch",
        kind: "hold", sets: 1, secs: 60, sides: true,
        cue: "Both knees at right angles, sit tall over the front hip. Switch slowly rather than dropping between the sides.",
      },
      {
        id: "a3",
        name: "World's greatest stretch",
        detail: "lunge and rotation",
        kind: "reps", sets: 1, reps: 5, sides: true,
        cue: "Lunge, front elbow down to the instep, then reach the same arm to the sky and follow the hand with your eyes.",
      },
      {
        id: "a4",
        name: "Cat–cow",
        kind: "reps", sets: 1, reps: 10, sides: false,
        cue: "Move one vertebra at a time. Breathe out as the back rounds, in as it arches.",
      },
      {
        id: "a5",
        name: "Open-book thoracic rotation",
        detail: "lying",
        kind: "reps", sets: 1, reps: 8, sides: true,
        cue: "On your side, knees stacked and held down. Open the top arm and let the ribs turn — chase the range through the ribs, not the low back.",
      },
    ],
  },
  {
    id: "B",
    name: "Pilates Core & Rotation",
    short: "Pilates core",
    minutes: "20–25 min",
    cadence: "Twice a week",
    when: "Rest days, or before golf",
    why: "Builds the anti-rotation stability the swing turns around.",
    colour: SAND,
    target: 2,
    items: [
      {
        id: "b1",
        name: "Dead bug",
        kind: "reps", sets: 3, reps: 10, sides: true,
        cue: "Low back pressed flat the whole time. Opposite arm and leg out slowly — if the back lifts off, shorten the reach.",
      },
      {
        id: "b2",
        name: "Bird dog",
        kind: "reps", sets: 3, reps: 10, sides: true,
        cue: "Long from heel to fingertip, hips level. Move as if balancing a glass of water on your lower back.",
      },
      {
        id: "b3",
        name: "Pallof press",
        detail: "band or cable, anti-rotation",
        kind: "reps", sets: 3, reps: 12, sides: true,
        cue: "Band at chest height, pressed straight out from the sternum. The work is refusing to turn — stand square and let the arms do nothing.",
      },
      {
        id: "b4",
        name: "Plank with shoulder taps",
        kind: "hold", sets: 3, secs: 30, sides: false,
        cue: "Feet wide, ribs down. Tap without letting the hips rock — that stillness is the whole exercise.",
      },
      {
        id: "b5",
        name: "Side plank with rotation",
        detail: "thread the needle",
        kind: "reps", sets: 3, reps: 8, sides: true,
        cue: "Thread the top arm under the ribs, then open it back to the ceiling. The hips stay high the whole way through.",
      },
      {
        id: "b6",
        name: "Controlled Russian twist",
        kind: "reps", sets: 3, reps: 15, sides: false,
        cue: "Chest tall, turn from the ribs. Slow beats heavy — no swinging the weight from side to side.",
      },
    ],
  },
  {
    id: "C",
    name: "Golf Swing Specific",
    short: "Swing work",
    minutes: "10–15 min",
    cadence: "Before you play",
    when: "Before the range or a round, or added to a Pilates session",
    why: "The most direct carryover there is to swing speed and smoothness.",
    colour: SKY,
    items: [
      {
        id: "c1",
        name: "Standing thoracic rotation",
        detail: "club across the shoulders",
        kind: "reps", sets: 3, reps: 10, sides: true,
        cue: "Set up as if to hit. Turn the shoulders over a quiet lower half and feel the separation between chest and hips.",
      },
      {
        id: "c2",
        name: "Seated trunk rotation with band",
        kind: "reps", sets: 3, reps: 10, sides: true,
        cue: "Sitting takes the hips out of it, so every degree has to come from the mid-back. Return under control rather than letting it snap back.",
      },
      {
        id: "c3",
        name: "Hip 90/90 rotation",
        detail: "internal and external",
        kind: "reps", sets: 3, reps: 8, sides: true,
        cue: "Lift and lower the knee without letting the torso follow it. This is the range the backswing borrows from.",
      },
      {
        id: "c4",
        name: "Medicine ball rotational throw",
        detail: "power and speed",
        kind: "reps", sets: 3, reps: 8, sides: true,
        cue: "Push off the back foot, turn, and let it go fast. This one is for speed — rest between the sets and throw hard.",
      },
      {
        id: "c5",
        name: "Glute bridge",
        kind: "reps", sets: 3, reps: 12, sides: false,
        cue: "Drive through the heels, ribs down, hold a second at the top. The glutes are what stops the hips sliding through the ball.",
      },
    ],
  },
];

const GOALS = [
  ["Smoother swing", "Better thoracic rotation, and separation between hips and shoulders"],
  ["Faster swing", "Rotational core power is what feeds club-head speed"],
  ["Stability", "The anti-rotation control the swing turns around"],
  ["Wellbeing", "Undo what the gym tightens, and stay loose day to day"],
];

const FIT = "A every day. B twice a week, on the days you are not lifting. C as a warm-up before golf, or added on to a B session.";

const CARE = "Every rotational drill is done controlled and pain-free. Never force the range.";

const blockById = (id) => BLOCKS.find((b) => b.id === id);

/* How the plan writes a dose, rebuilt from the numbers rather than stored as
   words — so the runner and the printed plan can never disagree. */
function dose(ex) {
  const unit = ex.kind === "hold" ? `${ex.secs}s` : `${ex.reps}`;
  if (ex.sets > 1) return `${ex.sets} × ${unit}${ex.sides ? " each side" : ""}`;
  if (ex.sides) return `${unit} each side`;
  return ex.kind === "hold" ? unit : `${unit} reps`;
}

/* A set on each side is two goes at it. Everything the runner counts — and
   everything stored — is measured in these. */
const effortsOf = (ex) => ex.sets * (ex.sides ? 2 : 1);

const effortsIn = (block) => block.items.reduce((n, ex) => n + effortsOf(ex), 0);

/* "Set 2 · Right", or just "Left", or nothing at all when there is only one
   go at it. */
function effortLabel(ex, i) {
  const parts = [];
  if (ex.sets > 1) parts.push(`Set ${Math.floor(i / (ex.sides ? 2 : 1)) + 1}`);
  if (ex.sides) parts.push(i % 2 === 0 ? "Left" : "Right");
  return parts.join(" · ");
}

/* ============================ dates ============================ */

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const today = () => iso(new Date());

const shiftDay = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return iso(new Date(y, m - 1, d + n));
};

const asDate = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const weekdayOf = (day) => asDate(day).getDay();

const shortDate = (day) => {
  const d = asDate(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

const longDate = (day) => {
  const d = asDate(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/* The Monday on or before `day`. Twice a week is counted inside one of these. */
const weekStartOf = (day) =>
  shiftDay(day, -((weekdayOf(day) - WEEK_START + 7) % 7));

const weekDays = (start) => Array.from({ length: 7 }, (_, i) => shiftDay(start, i));

/* ============================ the log ============================ */

/* Everything the app knows is one shape:
 *
 *   log[day][blockId][exerciseId] = how many goes at it are finished
 *
 * A count rather than a flag, so a session put down half way through is still
 * there when the phone comes back out, and so a block's progress can be read
 * without keeping a second tally anywhere. */

const blockLog = (log, day, blockId) => (log[day] && log[day][blockId]) || {};

const progressOf = (log, day, blockId, exId) => blockLog(log, day, blockId)[exId] || 0;

const exDone = (log, day, blockId, ex) =>
  progressOf(log, day, blockId, ex.id) >= effortsOf(ex);

const doneIn = (log, day, block) =>
  block.items.filter((ex) => exDone(log, day, block.id, ex)).length;

const blockDone = (log, day, block) => doneIn(log, day, block) === block.items.length;

const blockStarted = (log, day, block) =>
  block.items.some((ex) => progressOf(log, day, block.id, ex.id) > 0);

function setProgress(log, day, blockId, exId, n) {
  const block = { ...blockLog(log, day, blockId) };
  if (n <= 0) delete block[exId];
  else block[exId] = n;
  const dayLog = { ...(log[day] || {}) };
  if (Object.keys(block).length) dayLog[blockId] = block;
  else delete dayLog[blockId];
  const next = { ...log };
  if (Object.keys(dayLog).length) next[day] = dayLog;
  else delete next[day];
  return next;
}

/* Ticking an exercise off the list, rather than working through it in the
   runner: all of it, or none of it. */
const toggleExercise = (log, day, blockId, ex) =>
  setProgress(log, day, blockId, ex.id, exDone(log, day, blockId, ex) ? 0 : effortsOf(ex));

function pruneLog(log, now) {
  const cutoff = shiftDay(now, -KEEP_DAYS);
  const out = {};
  Object.keys(log).forEach((day) => {
    if (day >= cutoff) out[day] = log[day];
  });
  return out;
}

/* How many days in a week a block was finished on. */
const timesInWeek = (log, start, block) =>
  weekDays(start).filter((day) => blockDone(log, day, block)).length;

/* Consecutive days finishing the daily block, counting back from today. Today
   not being done yet does not break it — the day is not over. */
function streakOf(log, now, block) {
  let day = blockDone(log, now, block) ? now : shiftDay(now, -1);
  let n = 0;
  while (blockDone(log, day, block)) {
    n += 1;
    day = shiftDay(day, -1);
  }
  return n;
}

/* What is owed today. The daily block is owed until it is done; the twice-a-week
   one until the week has had its two; the swing work is never owed — it is
   asked for by going to play. */
function isDue(log, now, block) {
  if (blockDone(log, now, block)) return false;
  if (block.id === "A") return true;
  if (block.target) return timesInWeek(log, weekStartOf(now), block) < block.target;
  return false;
}

/* ============================ small pieces ============================ */

function Tick({ size = 16, colour = GROUND }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 12.5 L9.5 18 L20 6.5"
        fill="none"
        stroke={colour}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* A thin bar under a block's name. Every number it stands for is also written
   out beside it — the bar is never the only way to read the progress. */
function Bar({ value, total, colour }) {
  const share = total ? Math.min(value / total, 1) : 0;
  return (
    <div
      style={{
        height: 5,
        borderRadius: 3,
        background: "rgba(242,240,232,0.14)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${share * 100}%`,
          height: "100%",
          background: colour,
          borderRadius: 3,
          transition: "width 220ms ease-out",
        }}
      />
    </div>
  );
}

/* The ring around the big button in the runner: full at the start of a hold,
   empty when the time is up. */
function Ring({ share, colour, size = 190 }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2} cy={size / 2} r={r}
        style={{ fill: "none", stroke: "rgba(242,240,232,0.14)", strokeWidth: 6 }}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        style={{
          fill: "none",
          stroke: colour,
          strokeWidth: 6,
          strokeLinecap: "round",
          strokeDasharray: c,
          strokeDashoffset: c * (1 - Math.max(0, Math.min(share, 1))),
          transition: "stroke-dashoffset 220ms linear",
        }}
      />
    </svg>
  );
}

const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/* A finished hold is worth feeling as well as seeing — the phone is usually
   face down on the floor at that point. */
const buzz = (pattern) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* not allowed here, which is no reason to stop the timer */
  }
};

/* ============================ the runner ============================ */

/* Where to pick a block up: the first exercise that is not finished, and how
   far into it you got. Everything before it is behind you. */
function startingPoint(block, log, day) {
  for (let i = 0; i < block.items.length; i += 1) {
    const ex = block.items[i];
    const p = progressOf(log, day, block.id, ex.id);
    if (p < effortsOf(ex)) return { index: i, effort: p };
  }
  /* the whole block is done — opening it again means going round twice */
  return { index: 0, effort: 0 };
}

/* One exercise at a time, full screen. A hold counts itself down; a set of
   reps waits for the tap that says it is finished. Either way the phone can
   go on the floor between goes, which is where it ends up anyway. */
function Runner({ block, log, day, onProgress, onClose }) {
  const [{ index, effort }, setAt] = useState(() => startingPoint(block, log, day));
  const [finished, setFinished] = useState(false);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const endsAt = useRef(0);
  const complete = useRef(() => {});

  const ex = block.items[index];
  const efforts = effortsOf(ex);
  const passed =
    block.items.slice(0, index).reduce((n, e) => n + effortsOf(e), 0) + effort;
  const total = effortsIn(block);

  /* A new go at something starts stopped and full. */
  useEffect(() => {
    setRunning(false);
    setRemaining(ex.kind === "hold" ? ex.secs : 0);
  }, [ex.id, ex.kind, ex.secs, effort]);

  const finishEffort = () => {
    const n = effort + 1;
    onProgress(ex.id, Math.max(n, progressOf(log, day, block.id, ex.id)));
    if (n < efforts) setAt({ index, effort: n });
    else if (index + 1 < block.items.length) setAt({ index: index + 1, effort: 0 });
    else setFinished(true);
  };
  complete.current = finishEffort;

  /* The countdown is driven off a timestamp rather than a running total, so a
     phone that sleeps mid-hold comes back with the right number on it. */
  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (Date.now() >= endsAt.current) {
        setRunning(false);
        buzz([140, 70, 140]);
        complete.current();
      }
    };
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [running]);

  /* Holding a stretch for a minute is exactly how long a phone waits before
     locking itself. Keep the screen up while the clock is going. */
  useEffect(() => {
    if (!running || !navigator.wakeLock) return undefined;
    let lock = null;
    let dropped = false;
    navigator.wakeLock
      .request("screen")
      .then((held) => {
        if (dropped) held.release().catch(() => {});
        else lock = held;
      })
      .catch(() => {});
    return () => {
      dropped = true;
      if (lock) lock.release().catch(() => {});
    };
  }, [running]);

  const press = () => {
    if (ex.kind !== "hold") {
      buzz(20);
      finishEffort();
      return;
    }
    if (running) {
      setRunning(false);
      return;
    }
    endsAt.current = Date.now() + (remaining || ex.secs) * 1000;
    if (!remaining) setRemaining(ex.secs);
    setRunning(true);
  };

  const step = (by) => {
    setRunning(false);
    const next = index + by;
    if (next < 0) return;
    if (next >= block.items.length) setFinished(true);
    else setAt({ index: next, effort: 0 });
  };

  const ghost = {
    font: "inherit",
    padding: "13px 18px",
    fontSize: 15,
    fontWeight: 700,
    border: `1px solid ${EDGE}`,
    borderRadius: 14,
    background: "transparent",
    color: TYPE,
    cursor: "pointer",
  };

  if (finished) {
    const count = doneIn(log, day, block);
    /* Skipping to the end is not finishing it, and the screen should not say
       it was — what is left is still owed, and still on today's list. */
    const whole = count === block.items.length;
    return (
      <div className="sheet" style={runnerShell}>
        <div style={{ ...runnerBody, justifyContent: "center", textAlign: "center" }}>
          <div
            style={{
              width: 84,
              height: 84,
              margin: "0 auto 22px",
              borderRadius: 42,
              background: whole ? block.colour : "transparent",
              border: whole ? "none" : `3px solid ${block.colour}`,
              color: block.colour,
              fontSize: 34,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {whole ? <Tick size={44} /> : count}
          </div>
          <h2 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 800, letterSpacing: -0.3 }}>
            {whole ? `${block.name} done` : "Session over"}
          </h2>
          <p style={{ margin: "0 0 26px", fontSize: 16, color: MUTE, lineHeight: 1.5 }}>
            {count} of {block.items.length} exercises finished today.
            {whole
              ? block.id === "C"
                ? " Go and hit some."
                : ""
              : " The rest are still on today's list."}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{ ...ghost, background: block.colour, color: GROUND, border: "none", width: "100%" }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet" style={runnerShell}>
      <header style={{ padding: "16px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: block.colour,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {block.name}
          </span>
          <span style={{ fontSize: 13, color: MUTE }}>
            {index + 1} of {block.items.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the session"
            style={{
              font: "inherit",
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 17,
              border: `1px solid ${EDGE}`,
              background: "transparent",
              color: TYPE,
              cursor: "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                style={{ fill: "none", stroke: TYPE, strokeWidth: 2.4, strokeLinecap: "round" }}
              />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Bar value={passed} total={total} colour={block.colour} />
        </div>
      </header>

      <div style={runnerBody}>
        <h2 style={{ margin: 0, fontSize: 25, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.4 }}>
          {ex.name}
          {ex.detail ? (
            <span style={{ display: "block", fontSize: 15, fontWeight: 400, color: MUTE, marginTop: 3 }}>
              {ex.detail}
            </span>
          ) : null}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 15.5, fontWeight: 700, color: block.colour }}>
          {dose(ex)}
        </p>

        {/* what the position actually looks like — the words are no use to
            anyone who has not seen the movement before */}
        <div style={{ margin: "12px 0 0", flexShrink: 0 }}>
          <Diagram id={ex.id} colour={block.colour} height={126} />
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 14.5, color: MUTE, lineHeight: 1.5, maxWidth: 460 }}>
          {ex.cue}
        </p>

        <div style={{ margin: "16px 0 0", minHeight: 24 }}>
          {effortLabel(ex, effort) ? (
            <span
              style={{
                display: "inline-block",
                padding: "6px 13px",
                borderRadius: 999,
                border: `1px solid ${block.colour}`,
                fontSize: 14,
                fontWeight: 700,
                color: block.colour,
              }}
            >
              {effortLabel(ex, effort)}
            </span>
          ) : null}
        </div>

        <div
          style={{
            position: "relative",
            width: 168,
            height: 168,
            margin: "12px auto 0",
            flexShrink: 0,
          }}
        >
          <Ring
            share={ex.kind === "hold" ? (ex.secs ? remaining / ex.secs : 0) : 1}
            colour={block.colour}
            size={168}
          />
          <button
            type="button"
            onClick={press}
            aria-label={
              ex.kind === "hold"
                ? running
                  ? "Pause the hold"
                  : "Start the hold"
                : `Mark ${effortLabel(ex, effort) || ex.name} as done`
            }
            style={{
              position: "absolute",
              inset: 7,
              borderRadius: "50%",
              border: "none",
              background: "rgba(242,240,232,0.06)",
              color: TYPE,
              font: "inherit",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: ex.kind === "hold" ? 40 : 48,
                fontWeight: 800,
                letterSpacing: -1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ex.kind === "hold" ? clock(remaining) : ex.reps}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: MUTE, letterSpacing: 0.4 }}>
              {ex.kind === "hold" ? (running ? "TAP TO PAUSE" : "TAP TO START") : "REPS — TAP WHEN DONE"}
            </span>
          </button>
        </div>

        {efforts > 1 ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
            {Array.from({ length: efforts }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  width: i === effort ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i <= effort ? block.colour : "rgba(242,240,232,0.18)",
                  transition: "width 160ms ease-out",
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="safe-nav"
        style={{ display: "flex", gap: 10, padding: "12px 18px 16px" }}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index === 0}
          style={{ ...ghost, flex: 1, opacity: index === 0 ? 0.4 : 1 }}
        >
          Back
        </button>
        <button type="button" onClick={() => step(1)} style={{ ...ghost, flex: 1 }}>
          {index + 1 === block.items.length ? "Finish" : "Skip"}
        </button>
      </div>
    </div>
  );
}

const runnerShell = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
  background: GROUND,
  color: TYPE,
  fontFamily: BODY,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const runnerBody = {
  flex: 1,
  overflowY: "auto",
  padding: "10px 18px 18px",
  display: "flex",
  flexDirection: "column",
  maxWidth: 560,
  width: "100%",
  margin: "0 auto",
};

/* ============================ today ============================ */

/* One exercise on the block's own list: the box ticks the whole thing off for
   anyone who has just done it and does not want walking through it. */
function ListRow({ ex, block, done, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 0",
        font: "inherit",
        textAlign: "left",
        border: "none",
        borderTop: `1px solid ${EDGE}`,
        background: "transparent",
        color: TYPE,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          width: 25,
          height: 25,
          borderRadius: 7,
          border: `2px solid ${done ? block.colour : "rgba(242,240,232,0.35)"}`,
          background: done ? block.colour : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span key={done ? "on" : "off"} className={done ? "pop" : undefined}>
          {done ? <Tick /> : null}
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 16,
            color: done ? FAINT : TYPE,
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {ex.name}
        </span>
        {ex.detail ? (
          <span style={{ display: "block", fontSize: 13.5, color: FAINT, marginTop: 2 }}>
            {ex.detail}
          </span>
        ) : null}
      </span>
      <span style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 700, color: done ? FAINT : block.colour }}>
        {dose(ex)}
      </span>
    </button>
  );
}

/* One block, as it stands today. Tap the head to see what is in it, or Start
   to be walked through it. */
function BlockCard({ block, log, now, open, onOpen, onStart, onToggle }) {
  const done = doneIn(log, now, block);
  const all = done === block.items.length;
  const thisWeek = block.target ? timesInWeek(log, weekStartOf(now), block) : 0;
  const due = isDue(log, now, block);

  const status = all
    ? "Done today"
    : block.target
    ? `${thisWeek} of ${block.target} this week`
    : block.cadence;

  return (
    <section
      style={{
        background: PANEL,
        border: `1px solid ${all ? block.colour : EDGE}`,
        borderRadius: 18,
        padding: "16px 16px 14px",
        marginBottom: 12,
      }}
    >
      <h2 style={{ margin: 0, font: "inherit" }}>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            width: "100%",
            padding: 0,
            font: "inherit",
            textAlign: "left",
            border: "none",
            background: "transparent",
            color: TYPE,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              flex: "0 0 auto",
              width: 38,
              height: 38,
              borderRadius: 12,
              background: all ? block.colour : "rgba(242,240,232,0.08)",
              color: all ? GROUND : block.colour,
              fontSize: 18,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {all ? <Tick size={20} /> : block.id}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
              {block.name}
            </span>
            <span style={{ display: "block", fontSize: 13.5, color: MUTE, marginTop: 3 }}>
              {status} · {block.minutes}
            </span>
          </span>
          {due ? (
            <span
              style={{
                flex: "0 0 auto",
                padding: "4px 10px",
                borderRadius: 999,
                background: block.colour,
                color: GROUND,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
              }}
            >
              DUE
            </span>
          ) : null}
        </button>
      </h2>

      <div style={{ margin: "14px 0 10px" }}>
        <Bar value={done} total={block.items.length} colour={block.colour} />
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13.5, color: MUTE }}>
        {done} of {block.items.length} exercises · {block.why}
      </p>

      {open ? (
        <div className="unfold" style={{ marginBottom: 12 }}>
          {block.items.map((ex) => (
            <ListRow
              key={ex.id}
              ex={ex}
              block={block}
              done={exDone(log, now, block.id, ex)}
              onToggle={() => onToggle(block.id, ex)}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onStart}
        style={{
          width: "100%",
          padding: "13px 16px",
          font: "inherit",
          fontSize: 16,
          fontWeight: 800,
          border: "none",
          borderRadius: 14,
          background: block.colour,
          color: GROUND,
          cursor: "pointer",
        }}
      >
        {all
          ? "Go through it again"
          : blockStarted(log, now, block)
          ? "Carry on"
          : `Start · ${block.minutes}`}
      </button>
    </section>
  );
}

function TodayView({ log, now, open, onOpen, onStart, onToggle }) {
  const owed = BLOCKS.filter((b) => isDue(log, now, b));

  return (
    <div>
      <header style={{ margin: "0 0 18px" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: SAND }}>
          {longDate(now)}
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 800, letterSpacing: -0.6 }}>
          {owed.length === 0 ? "All clear" : "Today"}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          {owed.length === 0
            ? "Everything owed today is done. The swing work is always there if you are playing."
            : `${owed.map((b) => b.short).join(" and ")} — ${owed
                .map((b) => b.minutes)
                .join(" and ")}.`}
        </p>
      </header>

      {BLOCKS.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          log={log}
          now={now}
          open={open === block.id}
          onOpen={() => onOpen(block.id)}
          onStart={() => onStart(block.id)}
          onToggle={onToggle}
        />
      ))}

      <p style={{ margin: "18px 0 0", fontSize: 13.5, color: FAINT, lineHeight: 1.6 }}>
        {FIT}
      </p>
    </div>
  );
}

/* ============================ the week ============================ */

/* Seven days across, three marks down: one row per block, filled on the days
   it was finished. The whole week at a glance, and no number in it that is
   not also written out underneath. */
function WeekStrip({ log, start, now }) {
  const days = weekDays(start);
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {days.map((day) => {
        const ahead = day > now;
        return (
          <div key={day} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: day === now ? SAND : FAINT,
                marginBottom: 6,
              }}
            >
              {WEEKDAYS[weekdayOf(day)].slice(0, 1)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {BLOCKS.map((block) => {
                const done = blockDone(log, day, block);
                return (
                  <div
                    key={block.id}
                    title={`${block.name}, ${shortDate(day)}`}
                    style={{
                      height: 16,
                      borderRadius: 5,
                      background: done ? block.colour : "rgba(242,240,232,0.08)",
                      opacity: ahead ? 0.45 : 1,
                      border: day === now ? `1px solid ${done ? block.colour : "rgba(242,240,232,0.28)"}` : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ block, value, of, note }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "12px 0",
        borderTop: `1px solid ${EDGE}`,
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          width: 10,
          height: 10,
          borderRadius: 5,
          background: block.colour,
          alignSelf: "center",
        }}
      />
      <span style={{ flex: 1, minWidth: 0, fontSize: 15.5 }}>{block.name}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: block.colour, fontVariantNumeric: "tabular-nums" }}>
        {value}
        {of ? <span style={{ fontSize: 14, color: MUTE, fontWeight: 700 }}>/{of}</span> : null}
      </span>
      {note ? <span style={{ flex: "0 0 auto", fontSize: 13, color: MUTE }}>{note}</span> : null}
    </div>
  );
}

function WeekView({ log, now }) {
  const start = weekStartOf(now);
  const last = shiftDay(start, -7);
  const daily = blockById("A");
  const pilates = blockById("B");
  const swing = blockById("C");

  const dailyThis = timesInWeek(log, start, daily);
  const dailyLast = timesInWeek(log, last, daily);
  const pilatesThis = timesInWeek(log, start, pilates);
  const pilatesLast = timesInWeek(log, last, pilates);
  const swingThis = timesInWeek(log, start, swing);
  const swingLast = timesInWeek(log, last, swing);
  const streak = streakOf(log, now, daily);

  const heading = {
    margin: "0 0 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: FAINT,
  };
  const card = {
    background: PANEL,
    border: `1px solid ${EDGE}`,
    borderRadius: 18,
    padding: "16px",
    marginBottom: 12,
  };

  return (
    <div>
      <header style={{ margin: "0 0 18px" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.6 }}>This week</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: MUTE }}>
          {shortDate(start)} – {shortDate(shiftDay(start, 6))}
        </p>
      </header>

      <div style={card}>
        <p style={heading}>Monday to Sunday</p>
        <WeekStrip log={log} start={start} now={now} />
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {BLOCKS.map((block) => (
            <span key={block.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTE }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: block.colour }} />
              {block.short}
            </span>
          ))}
        </div>
      </div>

      <div style={card}>
        <p style={heading}>Where it stands</p>
        <Stat block={daily} value={dailyThis} of={7} note={streak ? `${streak}-day streak` : "no streak yet"} />
        <Stat
          block={pilates}
          value={pilatesThis}
          of={pilates.target}
          note={pilatesThis >= pilates.target ? "target met" : `${pilates.target - pilatesThis} to go`}
        />
        <Stat block={swing} value={swingThis} note={swingThis === 1 ? "session" : "sessions"} />
      </div>

      <div style={card}>
        <p style={heading}>The week before</p>
        <p style={{ margin: 0, fontSize: 15, color: MUTE, lineHeight: 1.6 }}>
          {dailyLast + pilatesLast + swingLast === 0
            ? "Nothing logged last week — this is the one to compare everything after it against."
            : `Flexibility ${dailyLast} of 7, pilates ${pilatesLast} of ${pilates.target}, swing work ${swingLast}. ` +
              (dailyThis > dailyLast
                ? "Ahead of it on the daily work so far."
                : dailyThis === dailyLast
                ? "Level on the daily work so far."
                : "Behind it on the daily work so far.")}
        </p>
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 13.5, color: FAINT, lineHeight: 1.6 }}>
        A day is counted once every exercise in that block is ticked. Days are
        kept for {KEEP_DAYS} days.
      </p>
    </div>
  );
}

/* ============================ the plan ============================ */

function Backup({ log, onRestored }) {
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const days = Object.keys(log).length;

  const exportNow = async () => {
    const payload = buildBackup(APP, KEYS);
    const result = await saveBackup(payload, `golf-${today()}.json`);
    if (result === "shared" || result === "downloaded") setMessage("Backup saved.");
    else if (result === "cancelled") setMessage(null);
    else setMessage("That did not work here — try from the browser rather than the home-screen app.");
  };

  const importNow = async (file) => {
    if (!file) return;
    try {
      const payload = await readBackupFile(file);
      const problem = checkBackup(payload, APP, KEYS);
      if (problem) {
        setMessage(problem);
        return;
      }
      if (!window.confirm("Replace everything on this phone with the backup? What is here now will be lost.")) return;
      restoreBackup(payload, KEYS);
      onRestored();
      setMessage("Backup restored.");
    } catch (e) {
      setMessage(e.message || "That file could not be read.");
    }
  };

  const button = {
    font: "inherit",
    padding: "11px 15px",
    fontSize: 15,
    fontWeight: 700,
    border: `1px solid ${EDGE}`,
    borderRadius: 12,
    background: "transparent",
    color: TYPE,
    cursor: "pointer",
  };

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: MUTE, lineHeight: 1.5 }}>
        Everything is saved on this phone only. {days} {days === 1 ? "day" : "days"} logged.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={button} onClick={exportNow}>
          Save a backup
        </button>
        <button type="button" style={button} onClick={() => fileInput.current.click()}>
          Restore
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            importNow(e.target.files && e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      {message ? (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: TYPE }}>{message}</p>
      ) : null}
    </div>
  );
}

/* The plan itself, written out — what the paper version was, with the cue for
   each movement that the paper had no room for. */
function PlanView({ log, onRestored }) {
  const heading = {
    margin: "0 0 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: FAINT,
  };
  const card = {
    background: PANEL,
    border: `1px solid ${EDGE}`,
    borderRadius: 18,
    padding: "16px",
    marginBottom: 12,
  };

  return (
    <div>
      <header style={{ margin: "0 0 18px" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.6 }}>The plan</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          Core stability, rotational power and flexibility, to balance the gym work.
        </p>
      </header>

      <div style={card}>
        <p style={heading}>What it is for</p>
        {GOALS.map(([name, note]) => (
          <div key={name} style={{ padding: "10px 0", borderTop: `1px solid ${EDGE}` }}>
            <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: SAND }}>{name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 14.5, color: MUTE, lineHeight: 1.5 }}>{note}</p>
          </div>
        ))}
      </div>

      {BLOCKS.map((block) => (
        <div key={block.id} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                background: "rgba(242,240,232,0.08)",
                color: block.colour,
                fontSize: 17,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {block.id}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
                {block.name}
              </span>
              <span style={{ display: "block", fontSize: 13.5, color: MUTE, marginTop: 2 }}>
                {block.minutes} · {block.cadence}
              </span>
            </span>
          </div>
          <p style={{ margin: "8px 0 12px", fontSize: 14, color: MUTE, lineHeight: 1.5, fontStyle: "italic" }}>
            {block.when} — {block.why}
          </p>
          {block.items.map((ex) => (
            <div key={ex.id} style={{ padding: "11px 0", borderTop: `1px solid ${EDGE}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16 }}>
                  {ex.name}
                  {ex.detail ? (
                    <span style={{ color: FAINT, fontSize: 14 }}> — {ex.detail}</span>
                  ) : null}
                </span>
                <span style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 700, color: block.colour, whiteSpace: "nowrap" }}>
                  {dose(ex)}
                </span>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 14, color: MUTE, lineHeight: 1.5 }}>{ex.cue}</p>
              <div style={{ marginTop: 8 }}>
                <Diagram id={ex.id} colour={block.colour} height={118} />
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={card}>
        <p style={heading}>How it fits together</p>
        <p style={{ margin: 0, fontSize: 15, color: MUTE, lineHeight: 1.6 }}>{FIT}</p>
        <p style={{ margin: "10px 0 0", fontSize: 15, color: SAND, lineHeight: 1.6 }}>{CARE}</p>
      </div>

      <div style={card}>
        <p style={heading}>Keep a copy</p>
        <Backup log={log} onRestored={onRestored} />
      </div>
    </div>
  );
}

/* ============================ shell ============================ */

const TABS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "plan", label: "Plan" },
];

export default function GolfApp() {
  const [log, setLog] = useState(() => loadJSON(KEY_LOG, {}));
  const [view, setView] = useState("today");
  const [now, setNow] = useState(today);
  const [open, setOpen] = useState(null);
  const [running, setRunning] = useState(null);

  /* A home-screen app is rarely closed, so it can be sitting open when
     midnight passes. Whenever it comes back to the front, check the date and
     move the app on to the new day. */
  useEffect(() => {
    const check = () => {
      const fresh = today();
      setNow((was) => (was === fresh ? was : fresh));
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 60000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, []);

  const commit = (next) => {
    const tidied = pruneLog(next, now);
    setLog(tidied);
    saveJSON(KEY_LOG, tidied);
  };

  const record = (blockId, exId, n) => commit(setProgress(log, now, blockId, exId, n));

  const tick = (blockId, ex) => commit(toggleExercise(log, now, blockId, ex));

  const block = running ? blockById(running) : null;

  return (
    <div style={{ minHeight: "100dvh", fontFamily: BODY, color: TYPE }}>
      <div
        className="pad-nav"
        style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 0" }}
      >
        {view === "today" ? (
          <TodayView
            log={log}
            now={now}
            open={open}
            onOpen={(id) => setOpen((was) => (was === id ? null : id))}
            onStart={setRunning}
            onToggle={tick}
          />
        ) : view === "week" ? (
          <WeekView log={log} now={now} />
        ) : (
          <PlanView log={log} onRestored={() => setLog(loadJSON(KEY_LOG, {}))} />
        )}
      </div>

      <nav
        className="safe-nav"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          gap: 6,
          padding: "8px 10px",
          background: "rgba(8,37,28,0.94)",
          backdropFilter: "blur(8px)",
          borderTop: `1px solid ${EDGE}`,
        }}
      >
        {TABS.map((tab) => {
          const on = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              aria-current={on ? "page" : undefined}
              style={{
                font: "inherit",
                flex: 1,
                padding: "12px 4px",
                border: "none",
                borderRadius: 14,
                background: on ? SAND : "transparent",
                color: on ? GROUND : MUTE,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {block ? (
        <Runner
          block={block}
          log={log}
          day={now}
          onProgress={(exId, n) => record(block.id, exId, n)}
          onClose={() => setRunning(null)}
        />
      ) : null}
    </div>
  );
}
