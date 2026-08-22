import { useEffect, useMemo, useRef, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
} from "./backup";

/* ============================ constants ============================ */

const GROUND = "#0B0B0C";
const TYPE = "#E9E7E3";
const DAY_TYPE = "#EDEDEB";
const MUTE = "#A0A09E";
const FAINT = "#8B8985";
const FLAME = "#E8451C";
/* the accent used as type needs its own lighter step: at 17px on the sheet
   the fill colour itself only just clears AA, and on a pale band it does not */
const FLAME_TYPE = "#FF7A52";
const SPENT = "#FFB6A0";
const ONCE = "#FFA88E";
const SHEET = "#161618";
const EDGE = "rgba(255,255,255,0.10)";

/* Monday is the top of the stack and the lightest; the week darkens as it
   goes, so where you are in it is legible before a single word is read.
 *
 * The light end stops at #4A4A4E rather than the mid grey it wants to be. A
 * band that light caps out around 5:1 against white and 4:1 against black, so
 * nothing written on it can clear AA — not the day name, and certainly not a
 * muted colour for a finished task. This is the lightest the top of the stack
 * can be while everything on it stays readable. */
const SHADES = ["#4A4A4E", "#414145", "#38383C", "#2F2F33", "#26262A", "#1C1C20", "#121216"];

const DISPLAY = "'Avenir Next Condensed','Helvetica Neue',Impact,'Arial Black',sans-serif";
const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const KEY_TASKS = "tk-tasks";
const KEY_LOG = "tk-log";
const KEY_PREFS = "tk-prefs";
const APP = "weekly";
const KEYS = [KEY_TASKS, KEY_LOG, KEY_PREFS];

/* half a year of finished weeks is enough to look back on, and keeps the
   store small enough to never think about */
const KEEP_WEEKS = 26;

const DEFAULT_PREFS = { weekStart: 1 };

/* every task row is this tall, which is what lets a drag be read as a
   whole number of places moved rather than a pixel offset */
const ROW = 46;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

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

/* "August 22, 2026", the way the date sits under a day name. */
const fullDate = (day) => {
  const d = asDate(day);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const clockTime = (d) => {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${m}${suffix}`;
};

/* ============================ weeks ============================ */

/* The Monday (or Sunday) on or before `day`. Every tick in the app is filed
   under one of these, which is the whole of the weekly reset: a new week is a
   new key, and a new key starts empty. Nothing is ever cleared. */
function weekStartOf(day, startsOn) {
  const back = (weekdayOf(day) - startsOn + 7) % 7;
  return shiftDay(day, -back);
}

const weekDays = (start) => Array.from({ length: 7 }, (_, i) => shiftDay(start, i));

const weekEnd = (start) => shiftDay(start, 6);

const weekRange = (start) => `${shortDate(start)} – ${shortDate(weekEnd(start))}`;

function weekLabel(start, thisWeek) {
  if (start === thisWeek) return "This week";
  if (start === shiftDay(thisWeek, -7)) return "Last week";
  return weekRange(start);
}

/* When the ticks go back to nothing, said the way you would say it out loud. */
function resetLine(now, startsOn) {
  const left = 7 - ((weekdayOf(now) - startsOn + 7) % 7);
  const dayName = WEEKDAYS[startsOn];
  if (left === 1) return `Unticks tomorrow morning, for ${dayName}`;
  return `Unticks in ${left} days, on ${dayName} morning`;
}

/* ============================ tasks and the log ============================ */

const newId = () =>
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* The week a task joined the list. It is worked out from the date it was
   added rather than stored as a week, because a week is only a key — move the
   day the week starts on and every key moves with it, while the date the task
   was written down never changes. */
const joinedWeek = (task, startsOn) => weekStartOf(task.since, startsOn);

/* What is on the list in a given week.
 *
 * A weekly task counts from the week it was added onwards, so adding one today
 * cannot make last week look like it was missed. A one-off belongs to its own
 * week and to no other — that is what makes it a one-off. */
const tasksForWeek = (tasks, week, startsOn) =>
  tasks.filter((t) => {
    const joined = joinedWeek(t, startsOn);
    return joined <= week && (t.repeat || joined === week);
  });

const tasksOnDay = (list, weekday) => list.filter((t) => t.day === weekday);

const ticksFor = (log, week) => log[week] || {};

const isDone = (log, week, taskId) => !!ticksFor(log, week)[taskId];

const countDone = (log, week, list) =>
  list.filter((t) => isDone(log, week, t.id)).length;

/* Tick or untick, filed under the week it belongs to. What is stored is the
   day it was ticked rather than a bare true, so a backup carries when things
   happened as well as that they did. */
function toggleTick(log, week, taskId, onDay) {
  const before = ticksFor(log, week);
  const after = { ...before };
  if (after[taskId]) delete after[taskId];
  else after[taskId] = onDay;
  return { ...log, [week]: after };
}

/* Regroup every tick under the weeks a different start day makes of them. */
function refile(log, startsOn) {
  const out = {};
  Object.keys(log).forEach((week) => {
    Object.keys(log[week]).forEach((taskId) => {
      const stamp = log[week][taskId];
      const day = typeof stamp === "string" && stamp.length === 10 ? stamp : week;
      const key = weekStartOf(day, startsOn);
      out[key] = { ...(out[key] || {}), [taskId]: day };
    });
  });
  return out;
}

function pruneLog(log, thisWeek) {
  const cutoff = shiftDay(thisWeek, -7 * KEEP_WEEKS);
  const out = {};
  Object.keys(log).forEach((week) => {
    if (week >= cutoff) out[week] = log[week];
  });
  return out;
}

/* One-offs from long-finished weeks are the only tasks that ever go stale. */
function pruneTasks(tasks, thisWeek) {
  const cutoff = shiftDay(thisWeek, -7 * KEEP_WEEKS);
  return tasks.filter((t) => t.repeat || t.since >= cutoff);
}

/* Move one task within its own day, leaving every other day where it was.
   The full list is rebuilt by walking it once and dealing the day's tasks
   back out in their new order, so nothing else shifts. */
function reorder(tasks, weekday, fromIndex, toIndex) {
  const mine = tasks.filter((t) => t.day === weekday);
  if (fromIndex === toIndex || !mine[fromIndex]) return tasks;
  const moved = mine.slice();
  moved.splice(toIndex, 0, moved.splice(fromIndex, 1)[0]);
  let n = 0;
  return tasks.map((t) => (t.day === weekday ? moved[n++] : t));
}

/* ============================ small pieces ============================ */

function Tick({ size = 17 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 12.5 L9.5 18 L20 6.5"
        fill="none"
        stroke="#FFF"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Two columns of three dots: the grip, in the corner of every row. */
function Grip() {
  return (
    <svg viewBox="0 0 12 18" width={12} height={18} aria-hidden="true">
      {[3, 9].map((x) =>
        [3, 9, 15].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill="currentColor" />
        ))
      )}
    </svg>
  );
}

/* One task. The box ticks it; the words open what to do with it. */
function TaskRow({ task, done, open, offset, dragging, onToggle, onOpen, onGrab }) {
  return (
    <div
      style={{
        height: ROW,
        display: "flex",
        alignItems: "center",
        gap: 12,
        transform: offset ? `translateY(${offset}px)` : undefined,
        transition: dragging ? "none" : "transform 140ms ease-out",
        position: "relative",
        zIndex: dragging ? 2 : 1,
        opacity: dragging ? 0.92 : 1,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={task.name}
        style={{
          flex: "0 0 auto",
          width: 27,
          height: 27,
          padding: 0,
          borderRadius: 7,
          /* the ring stays in both states: the orange fill on its own is only
             2.2:1 against the palest band, so the box would lose its edge up
             there, and a white tick rules out a lighter fill */
          border: `2px solid rgba(255,255,255,${done ? 0.65 : 0.55})`,
          background: done ? FLAME : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span key={done ? "on" : "off"} className={done ? "pop" : undefined}>
          {done ? <Tick /> : null}
        </span>
      </button>

      {/* the box and the words are two controls on one row, so they need
          names that tell them apart out loud as well as by sight */}
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        aria-label={`Options for ${task.name}`}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          padding: 0,
          font: "inherit",
          fontSize: 17,
          border: "none",
          background: "transparent",
          color: done ? SPENT : TYPE,
          textDecoration: done ? "line-through" : "none",
          textDecorationColor: done ? SPENT : undefined,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: "pointer",
        }}
      >
        {task.name}
        {!task.repeat ? (
          <span style={{ color: ONCE, fontSize: 13, marginLeft: 8 }}>once</span>
        ) : null}
      </button>

      <span
        onPointerDown={onGrab}
        role="button"
        tabIndex={-1}
        aria-label={`Reorder ${task.name}`}
        style={{
          flex: "0 0 auto",
          padding: "6px 2px 6px 10px",
          color: dragging ? TYPE : "rgba(255,255,255,0.50)",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Grip />
      </span>
    </div>
  );
}

/* What a task can be, once you have tapped its name. */
function TaskOptions({ task, onRepeat, onDelete }) {
  const chip = (on) => ({
    font: "inherit",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 700,
    border: `1px solid ${on ? FLAME : "rgba(255,255,255,0.22)"}`,
    borderRadius: 999,
    background: on ? "rgba(232,69,28,0.16)" : "transparent",
    color: on ? FLAME_TYPE : TYPE,
    cursor: "pointer",
  });

  return (
    <div
      className="unfold"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "2px 0 12px 39px",
      }}
    >
      <button type="button" style={chip(task.repeat)} onClick={() => onRepeat(true)}>
        Every week
      </button>
      <button type="button" style={chip(!task.repeat)} onClick={() => onRepeat(false)}>
        Just this week
      </button>
      <button
        type="button"
        onClick={onDelete}
        style={{
          font: "inherit",
          padding: "7px 12px",
          fontSize: 14,
          fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 999,
          background: "transparent",
          color: MUTE,
          cursor: "pointer",
        }}
      >
        Delete
      </button>
    </div>
  );
}

/* One band of the stack. Collapsed it is a name; open it is the day. */
function DayBand({
  day, weekday, shade, list, log, week, isToday, open, drag,
  openTask, addRef, clock,
  onOpen, onToggle, onOpenTask, onRepeat, onDelete, onAdd, onGrab,
}) {
  const done = countDone(log, week, list);
  const total = list.length;
  const all = total > 0 && done === total;

  /* where each row sits while one of them is being dragged */
  const offsetOf = (index) => {
    if (!drag || drag.weekday !== weekday) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -ROW;
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return ROW;
    return 0;
  };

  return (
    <section
      style={{
        background: shade,
        borderTop: `1px solid rgba(0,0,0,0.28)`,
        padding: "22px 20px",
        minHeight: open ? undefined : 96,
      }}
    >
      {/* the day name is the heading for everything under it, so the stack
          can be moved through a day at a time rather than row by row */}
      <h2 style={{ margin: 0, font: "inherit" }}>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: 0,
          border: "none",
          background: "transparent",
          font: "inherit",
          color: DAY_TYPE,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: 0.4,
            lineHeight: 1.05,
            textTransform: "uppercase",
          }}
        >
          {WEEKDAYS[weekday]}
          {total ? (
            <span
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0,
                color: all ? ONCE : "rgba(255,255,255,0.75)",
              }}
            >
              {done}/{total}
            </span>
          ) : null}
        </span>

        {isToday || open ? (
          <span
            style={{
              display: "block",
              marginTop: 8,
              fontSize: 14,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {fullDate(day)}
            {isToday ? ` — ${clockTime(clock)}` : ""}
          </span>
        ) : null}
      </button>
      </h2>

      {open ? (
        <div className="unfold" style={{ marginTop: 16 }}>
          <div style={{ position: "relative" }}>
            {list.map((task, index) => (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  done={isDone(log, week, task.id)}
                  open={openTask === task.id}
                  offset={offsetOf(index)}
                  dragging={!!drag && drag.weekday === weekday && drag.from === index}
                  onToggle={() => onToggle(task.id)}
                  onOpen={() => onOpenTask(task.id)}
                  onGrab={(e) => onGrab(e, weekday, index)}
                />
                {openTask === task.id ? (
                  <TaskOptions
                    task={task}
                    onRepeat={(repeat) => onRepeat(task.id, repeat)}
                    onDelete={() => onDelete(task.id)}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const field = e.currentTarget.elements.name;
              const trimmed = field.value.trim();
              if (!trimmed) return;
              onAdd(trimmed);
              field.value = "";
              field.focus();
            }}
          >
            <input
              ref={addRef}
              name="name"
              type="text"
              placeholder="Add a task…"
              enterKeyHint="done"
              autoComplete="off"
              style={{
                width: "100%",
                height: ROW,
                padding: "0 0 0 39px",
                fontSize: 17,
                border: "none",
                background: "transparent",
                color: TYPE,
              }}
            />
          </form>
        </div>
      ) : null}
    </section>
  );
}

/* ============================ the menu ============================ */

function Backup({ tasks, onRestored }) {
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const exportNow = async () => {
    const payload = buildBackup(APP, KEYS);
    const result = await saveBackup(payload, `weekly-${today()}.json`);
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
        Everything is saved on this phone only. {tasks.length}{" "}
        {tasks.length === 1 ? "task" : "tasks"} on the list.
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

function Menu({ tasks, log, thisWeek, week, prefs, now, onClose, onPickWeek, onPrefs, onRestored }) {
  const past = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 8; i += 1) {
      const start = shiftDay(thisWeek, -7 * i);
      const list = tasksForWeek(tasks, start, prefs.weekStart);
      if (!list.length && !Object.keys(ticksFor(log, start)).length) continue;
      out.push({ start, total: list.length, done: countDone(log, start, list) });
    }
    return out;
  }, [tasks, log, thisWeek, prefs.weekStart]);

  const here = tasksForWeek(tasks, week, prefs.weekStart);
  const doneHere = countDone(log, week, here);

  const heading = {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: FAINT,
  };
  const block = { padding: "20px 20px", borderTop: `1px solid ${EDGE}` };
  const opt = (on) => ({
    font: "inherit",
    flex: 1,
    padding: "11px 10px",
    fontSize: 15,
    fontWeight: 700,
    border: `1px solid ${on ? FLAME : EDGE}`,
    borderRadius: 12,
    background: on ? "rgba(232,69,28,0.16)" : "transparent",
    color: on ? FLAME_TYPE : TYPE,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="safe-nav"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "86dvh",
          overflowY: "auto",
          background: SHEET,
          borderRadius: "22px 22px 0 0",
          border: `1px solid ${EDGE}`,
          borderBottom: "none",
        }}
      >
        <div style={{ padding: "18px 20px 20px" }}>
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 4,
              background: "rgba(255,255,255,0.22)",
              margin: "0 auto 18px",
            }}
          />
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: DAY_TYPE,
            }}
          >
            {weekLabel(week, thisWeek)}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: MUTE }}>
            {weekRange(week)} · {doneHere} of {here.length} done
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: FLAME_TYPE }}>
            {week === thisWeek
              ? resetLine(now, prefs.weekStart)
              : "A finished week — still here to look at"}
          </p>
        </div>

        {week !== thisWeek ? (
          <div style={block}>
            <button
              type="button"
              onClick={() => {
                onPickWeek(thisWeek);
                onClose();
              }}
              style={{ ...opt(true), width: "100%" }}
            >
              Back to this week
            </button>
          </div>
        ) : null}

        <div style={block}>
          <p style={heading}>Weeks behind you</p>
          {past.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: MUTE, lineHeight: 1.5 }}>
              Nothing yet. Weeks land here as they finish, and what is on this
              week's list is never touched by them.
            </p>
          ) : (
            past.map(({ start, total, done }) => (
              <button
                key={start}
                type="button"
                onClick={() => {
                  onPickWeek(start);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "12px 0",
                  font: "inherit",
                  border: "none",
                  borderBottom: `1px solid ${EDGE}`,
                  background: "transparent",
                  color: TYPE,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 15 }}>{weekLabel(start, thisWeek)}</span>
                <span style={{ fontSize: 14, color: total && done === total ? FLAME_TYPE : MUTE }}>
                  {done}/{total}
                </span>
              </button>
            ))
          )}
        </div>

        <div style={block}>
          <p style={heading}>The week starts on</p>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: MUTE, lineHeight: 1.5 }}>
            The morning everything goes back to unticked.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              aria-label="Start the week on Monday"
              aria-pressed={prefs.weekStart === 1}
              style={opt(prefs.weekStart === 1)}
              onClick={() => onPrefs({ weekStart: 1 })}
            >
              Monday
            </button>
            <button
              type="button"
              aria-label="Start the week on Sunday"
              aria-pressed={prefs.weekStart === 0}
              style={opt(prefs.weekStart === 0)}
              onClick={() => onPrefs({ weekStart: 0 })}
            >
              Sunday
            </button>
          </div>
        </div>

        <div style={block}>
          <p style={heading}>Keep a copy</p>
          <Backup tasks={tasks} onRestored={onRestored} />
        </div>

        <div style={{ ...block, paddingBottom: 28 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...opt(false), width: "100%" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ shell ============================ */

export default function WeeklyApp() {
  const [tasks, setTasks] = useState(() => loadJSON(KEY_TASKS, []));
  const [log, setLog] = useState(() => loadJSON(KEY_LOG, {}));
  const [prefs, setPrefs] = useState(() => ({
    ...DEFAULT_PREFS,
    ...loadJSON(KEY_PREFS, {}),
  }));
  const [now, setNow] = useState(today);
  const [clock, setClock] = useState(() => new Date());

  const thisWeek = weekStartOf(now, prefs.weekStart);
  const [week, setWeek] = useState(thisWeek);
  const [open, setOpen] = useState(() => [weekdayOf(today())]);
  const [openTask, setOpenTask] = useState(null);
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(null);

  const addRefs = useRef({});

  /* A home-screen app is rarely closed, so it can be sitting open when
     midnight passes — and the whole point of this one is that the new week
     arrives on its own. Whenever it comes back to the front, check the date. */
  useEffect(() => {
    const check = () => {
      setClock(new Date());
      const fresh = today();
      setNow((was) => (was === fresh ? was : fresh));
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 30000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, []);

  /* Follow the week along when it turns over, or when the start day is
     changed — unless a past week is deliberately being looked at. */
  const wasWeek = useRef(thisWeek);
  useEffect(() => {
    if (wasWeek.current !== thisWeek) {
      setWeek((shown) => (shown === wasWeek.current ? thisWeek : shown));
      setOpen([weekdayOf(now)]);
      wasWeek.current = thisWeek;
    }
  }, [thisWeek, now]);

  const commitTasks = (next) => {
    const tidied = pruneTasks(next, thisWeek);
    setTasks(tidied);
    saveJSON(KEY_TASKS, tidied);
  };

  const commitLog = (next) => {
    const tidied = pruneLog(next, thisWeek);
    setLog(tidied);
    saveJSON(KEY_LOG, tidied);
  };

  const addTask = (weekday, name) =>
    commitTasks([
      ...tasks,
      { id: newId(), name, day: weekday, repeat: true, since: now },
    ]);

  const setRepeat = (id, repeat) =>
    commitTasks(tasks.map((t) => (t.id === id ? { ...t, repeat } : t)));

  const deleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (task && !window.confirm(`Delete "${task.name}"?`)) return;
    setOpenTask(null);
    commitTasks(tasks.filter((t) => t.id !== id));
    /* its ticks would otherwise sit in storage for months, unreadable */
    const next = {};
    Object.keys(log).forEach((w) => {
      const { [id]: gone, ...rest } = log[w];
      next[w] = rest;
    });
    commitLog(next);
  };

  /* Stamp the tick with a day inside the week it is filed under: today when
     that is this week, the week's own first day when an earlier one is being
     caught up. That keeps every tick self-describing, which is what lets the
     week-start setting be changed without losing any of them. */
  const toggle = (taskId) => {
    const inside = now >= week && now <= weekEnd(week);
    commitLog(toggleTick(log, week, taskId, inside ? now : week));
  };

  const changePrefs = (change) => {
    const next = { ...prefs, ...change };
    if (next.weekStart !== prefs.weekStart) {
      /* Every week in the log is keyed by its first day, so moving that day
         moves every key with it. Each tick knows the date it was made, so they
         can all be filed again exactly where they belong rather than stranded
         under a key nothing looks at any more. Tasks need no such thing: they
         work their week out from the day they were added. */
      commitLog(refile(log, next.weekStart));
    }
    setPrefs(next);
    saveJSON(KEY_PREFS, next);
    setWeek(weekStartOf(now, next.weekStart));
  };

  const reload = () => {
    setTasks(loadJSON(KEY_TASKS, []));
    setLog(loadJSON(KEY_LOG, {}));
    setPrefs({ ...DEFAULT_PREFS, ...loadJSON(KEY_PREFS, {}) });
  };

  const toggleDay = (weekday) => {
    setOpenTask(null);
    setOpen((was) =>
      was.includes(weekday) ? was.filter((d) => d !== weekday) : [...was, weekday]
    );
  };

  /* The + opens today and puts the cursor in its field: the shortest path
     from picking the phone up to having written the thing down. */
  const addToToday = () => {
    const weekday = weekdayOf(now);
    setOpen((was) => (was.includes(weekday) ? was : [...was, weekday]));
    setTimeout(() => {
      const field = addRefs.current[weekday];
      if (field) {
        field.scrollIntoView({ block: "center", behavior: "smooth" });
        field.focus();
      }
    }, 80);
  };

  /* Dragging a row: the grip captures the pointer, the row follows it, and
     what is committed is a whole number of places moved. */
  const grab = (e, weekday, from) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const count = tasksOnDay(tasksForWeek(tasks, week, prefs.weekStart), weekday).length;
    setOpenTask(null);
    setDrag({ weekday, from, to: from, dy: 0, startY, count, pointerId: e.pointerId });
  };

  useEffect(() => {
    if (!drag) return undefined;
    const move = (e) => {
      if (e.pointerId !== drag.pointerId) return;
      const dy = e.clientY - drag.startY;
      const places = Math.round(dy / ROW);
      const to = Math.min(Math.max(drag.from + places, 0), drag.count - 1);
      setDrag((was) => (was ? { ...was, dy, to } : was));
    };
    const drop = (e) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.to !== drag.from) {
        commitTasks(reorder(tasks, drag.weekday, drag.from, drag.to));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [drag, tasks]);

  const list = tasksForWeek(tasks, week, prefs.weekStart);
  const days = weekDays(week);
  const order = Array.from({ length: 7 }, (_, i) => (prefs.weekStart + i) % 7);
  const doneAll = countDone(log, week, list);

  const round = {
    width: 54,
    height: 54,
    borderRadius: 18,
    border: `1px solid ${EDGE}`,
    background: "rgba(28,28,30,0.86)",
    backdropFilter: "blur(10px)",
    color: TYPE,
    font: "inherit",
    fontSize: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  return (
    <div className="stack" style={{ minHeight: "100dvh", fontFamily: BODY, background: GROUND }}>
      <h1 className="sr-only">Weekly</h1>
      {week !== thisWeek ? (
        <button
          type="button"
          onClick={() => setWeek(thisWeek)}
          style={{
            display: "block",
            width: "100%",
            padding: "12px 20px",
            font: "inherit",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "left",
            border: "none",
            background: FLAME,
            color: "#FFF",
            cursor: "pointer",
          }}
        >
          {weekLabel(week, thisWeek)}, {weekRange(week)} — back to this week ›
        </button>
      ) : null}

      <div className="pad-nav">
        {order.map((weekday, i) => {
          const day = days.find((d) => weekdayOf(d) === weekday);
          return (
            <DayBand
              key={weekday}
              day={day}
              weekday={weekday}
              shade={SHADES[i]}
              list={tasksOnDay(list, weekday)}
              log={log}
              week={week}
              clock={clock}
              isToday={day === now}
              open={open.includes(weekday)}
              drag={drag}
              openTask={openTask}
              addRef={(el) => {
                addRefs.current[weekday] = el;
              }}
              onOpen={() => toggleDay(weekday)}
              onToggle={toggle}
              onOpenTask={(id) => setOpenTask((was) => (was === id ? null : id))}
              onRepeat={setRepeat}
              onDelete={deleteTask}
              onAdd={(name) => addTask(weekday, name)}
              onGrab={grab}
            />
          );
        })}

        <p
          style={{
            margin: 0,
            padding: "26px 20px 8px",
            fontSize: 14,
            color: FAINT,
            lineHeight: 1.5,
          }}
        >
          {list.length === 0
            ? "Nothing on the list yet. Open a day and write the first thing down."
            : `${doneAll} of ${list.length} done. ${
                week === thisWeek
                  ? `${resetLine(now, prefs.weekStart)} — everything comes back, unticked, except what is marked once.`
                  : "This week is finished."
              }`}
        </p>
      </div>

      <div
        className="safe-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 18px",
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMenu(true)}
          style={{ ...round, pointerEvents: "auto" }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {[7, 12, 17].map((y) => (
              <rect key={y} x="4" y={y - 1} width="16" height="2" rx="1" fill="currentColor" />
            ))}
          </svg>
        </button>
        <button
          type="button"
          aria-label="Add a task to today"
          onClick={addToToday}
          style={{ ...round, pointerEvents: "auto" }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <rect x="11" y="4" width="2" height="16" rx="1" fill="currentColor" />
            <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {menu ? (
        <Menu
          tasks={tasks}
          log={log}
          thisWeek={thisWeek}
          week={week}
          prefs={prefs}
          now={now}
          onClose={() => setMenu(false)}
          onPickWeek={setWeek}
          onPrefs={changePrefs}
          onRestored={reload}
        />
      ) : null}
    </div>
  );
}
