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

const INK = "#1E1B2E";
const MUTE = "#5F5A73";
const RULE = "#E3DFF0";
const CARD = "#FFFFFF";
const WASH = "#EFEBFA";
const INDIGO = "#4B3FA6";
const INDIGO_WASH = "#E8E4F8";
const DONE = "#1F6E52";
const DONE_WASH = "#E4F0EA";
const NOW = "#B04A12";
const DISPLAY = "'Arial Black','Helvetica Neue',Impact,sans-serif";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const dayNumber = (day) => Number(day.slice(8));

const shortDate = (day) => {
  const d = asDate(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

const longDate = (day) => {
  const d = asDate(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
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

/* "This week", "Last week", or the dates it runs between. */
function weekLabel(start, thisWeek) {
  if (start === thisWeek) return "This week";
  if (start === shiftDay(thisWeek, -7)) return "Last week";
  if (start === shiftDay(thisWeek, 7)) return "Next week";
  return `${shortDate(start)} – ${shortDate(weekEnd(start))}`;
}

const weekRange = (start) => `${shortDate(start)} – ${shortDate(weekEnd(start))}`;

/* When the ticks go back to nothing, said the way you would say it out loud. */
function resetLine(thisWeek, now, startsOn) {
  const left = 7 - ((weekdayOf(now) - startsOn + 7) % 7);
  const dayName = WEEKDAYS[startsOn];
  if (left === 1) return `Everything unticks tomorrow morning, for ${dayName}.`;
  return `Everything unticks in ${left} days, on ${dayName} morning.`;
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

/* Everything set for one day of the week; `day` of null means the loose ones,
   the things that want doing this week but not on any particular day. */
const tasksOnDay = (list, weekday) =>
  list.filter((t) => t.day === weekday);

const loose = (list) => list.filter((t) => t.day === null);

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
      /* a tick from before the stamps were dates only knows its old week */
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

/* ============================ small pieces ============================ */

function Tick({ size = 22, colour = "#FFF" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 12.5 L9.5 18 L20 6.5"
        fill="none"
        stroke={colour}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Bar({ done, total, colour, height = 10 }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ height, borderRadius: height, background: WASH, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: height,
          background: colour,
          transition: "width 220ms ease-out",
        }}
      />
    </div>
  );
}

function Header({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1
        style={{
          margin: 0,
          fontFamily: DISPLAY,
          fontSize: 34,
          lineHeight: 1.1,
          letterSpacing: -0.4,
          color: INK,
        }}
      >
        {title}
      </h1>
      {sub ? (
        <p style={{ margin: "6px 0 0", fontSize: 16, color: MUTE }}>{sub}</p>
      ) : null}
    </div>
  );
}

/* One task. The whole row is the button, tick box and all. */
function TaskRow({ task, done, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        marginBottom: 8,
        font: "inherit",
        color: INK,
        border: `1px solid ${done ? DONE : RULE}`,
        borderRadius: 16,
        background: done ? DONE_WASH : CARD,
        cursor: "pointer",
      }}
    >
      <span
        key={done ? "on" : "off"}
        className={done ? "pop" : undefined}
        style={{
          flex: "0 0 auto",
          width: 36,
          height: 36,
          borderRadius: 12,
          border: done ? "none" : `2px solid ${RULE}`,
          background: done ? DONE : "#FFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done ? <Tick /> : null}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>
          {task.name}
        </span>
      </span>

      {!task.repeat ? (
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: NOW,
            border: `1px solid ${NOW}`,
            borderRadius: 999,
            padding: "3px 8px",
          }}
        >
          Once
        </span>
      ) : null}
    </button>
  );
}

/* A day's worth of the week view. */
function DayBlock({ title, sub, list, log, week, isToday, onToggle }) {
  const done = countDone(log, week, list);
  const total = list.length;
  const full = total > 0 && done === total;

  return (
    <div
      style={{
        padding: 16,
        marginBottom: 14,
        border: isToday ? `2px solid ${NOW}` : `1px solid ${RULE}`,
        borderRadius: 20,
        background: CARD,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: total ? 12 : 0,
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: 22,
              letterSpacing: -0.3,
              color: isToday ? NOW : INK,
            }}
          >
            {title}
          </span>
          {sub ? (
            <span style={{ fontSize: 14, color: MUTE, marginLeft: 8 }}>{sub}</span>
          ) : null}
        </span>
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 14,
            fontWeight: 700,
            color: full ? DONE : MUTE,
          }}
        >
          {total ? `${done}/${total}` : "—"}
        </span>
      </div>

      {list.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          done={isDone(log, week, task.id)}
          onToggle={() => onToggle(task.id)}
        />
      ))}
    </div>
  );
}

/* ============================ views ============================ */

function TodayView({ tasks, log, thisWeek, now, prefs, onToggle, onGoTasks }) {
  const list = tasksForWeek(tasks, thisWeek, prefs.weekStart);
  const mine = tasksOnDay(list, weekdayOf(now));
  const spare = loose(list);
  const all = [...mine, ...spare];
  const done = countDone(log, thisWeek, all);
  const total = all.length;
  const full = total > 0 && done === total;

  return (
    <div>
      <Header title="Today" sub={longDate(now)} />

      {total ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "0 2px 8px",
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>
              {full ? "All done" : `${done} of ${total} done`}
            </span>
            {full ? <Tick size={18} colour={DONE} /> : null}
          </div>
          <div style={{ marginBottom: 20 }}>
            <Bar done={done} total={total} colour={full ? DONE : INDIGO} />
          </div>
        </>
      ) : null}

      {mine.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          done={isDone(log, thisWeek, task.id)}
          onToggle={() => onToggle(task.id, thisWeek)}
        />
      ))}

      {spare.length ? (
        <>
          <p
            style={{
              margin: mine.length ? "20px 2px 8px" : "0 2px 8px",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: MUTE,
            }}
          >
            Any day this week
          </p>
          {spare.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              done={isDone(log, thisWeek, task.id)}
              onToggle={() => onToggle(task.id, thisWeek)}
            />
          ))}
        </>
      ) : null}

      {total === 0 ? (
        <div
          style={{
            padding: 20,
            border: `1px solid ${RULE}`,
            borderRadius: 20,
            background: CARD,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>
            Nothing set for today.
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
            Put things on the days you want to do them. They come back every week,
            unticked, so the week always starts clean.
          </p>
          <button
            type="button"
            onClick={onGoTasks}
            style={{
              font: "inherit",
              padding: "12px 18px",
              fontSize: 16,
              fontWeight: 700,
              border: "none",
              borderRadius: 14,
              background: INDIGO,
              color: "#FFF",
              cursor: "pointer",
            }}
          >
            Add a task
          </button>
        </div>
      ) : (
        <p style={{ margin: "18px 2px 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          {full
            ? `Today is finished. ${resetLine(thisWeek, now, prefs.weekStart)}`
            : resetLine(thisWeek, now, prefs.weekStart)}
        </p>
      )}
    </div>
  );
}

function WeekView({ tasks, log, week, thisWeek, now, prefs, onToggle, onPickWeek }) {
  const list = tasksForWeek(tasks, week, prefs.weekStart);
  const done = countDone(log, week, list);
  const total = list.length;
  const full = total > 0 && done === total;
  const days = weekDays(week);
  const spare = loose(list);

  const step = {
    font: "inherit",
    padding: "10px 14px",
    fontSize: 16,
    fontWeight: 700,
    border: `1px solid ${RULE}`,
    borderRadius: 12,
    background: CARD,
    color: INK,
    cursor: "pointer",
  };

  return (
    <div>
      <Header title={weekLabel(week, thisWeek)} sub={weekRange(week)} />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button type="button" style={step} onClick={() => onPickWeek(shiftDay(week, -7))}>
          ‹ Earlier
        </button>
        {week !== thisWeek ? (
          <button type="button" style={{ ...step, flex: 1 }} onClick={() => onPickWeek(thisWeek)}>
            This week
          </button>
        ) : null}
        <button
          type="button"
          style={{ ...step, opacity: week >= thisWeek ? 0.4 : 1 }}
          disabled={week >= thisWeek}
          onClick={() => onPickWeek(shiftDay(week, 7))}
        >
          Later ›
        </button>
      </div>

      {total ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "0 2px 8px",
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>
              {full ? "The whole week done" : `${done} of ${total} done`}
            </span>
            <span style={{ fontSize: 15, color: MUTE }}>
              {Math.round((done / total) * 100)}%
            </span>
          </div>
          <div style={{ marginBottom: 20 }}>
            <Bar done={done} total={total} colour={full ? DONE : INDIGO} />
          </div>
        </>
      ) : (
        <p
          style={{
            margin: "0 2px 20px",
            fontSize: 15,
            color: MUTE,
            lineHeight: 1.5,
          }}
        >
          Nothing on the list for this week.
        </p>
      )}

      {spare.length ? (
        <DayBlock
          title="Any day"
          sub="this week"
          list={spare}
          log={log}
          week={week}
          isToday={false}
          onToggle={(id) => onToggle(id, week)}
        />
      ) : null}

      {days.map((day) => {
        const wd = weekdayOf(day);
        const dayList = tasksOnDay(list, wd);
        if (!dayList.length) return null;
        return (
          <DayBlock
            key={day}
            title={WEEKDAYS[wd]}
            sub={String(dayNumber(day))}
            list={dayList}
            log={log}
            week={week}
            isToday={day === now}
            onToggle={(id) => onToggle(id, week)}
          />
        );
      })}

      {week === thisWeek && total ? (
        <p style={{ margin: "4px 2px 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          {resetLine(thisWeek, now, prefs.weekStart)} Weekly tasks come back
          unticked; anything marked <strong>once</strong> goes away.
        </p>
      ) : null}
    </div>
  );
}

/* The day picker, shared by the add form and the row editor. */
function DayPicker({ value, onPick, startsOn }) {
  const order = Array.from({ length: 7 }, (_, i) => (startsOn + i) % 7);
  const chip = (on) => ({
    font: "inherit",
    padding: "9px 11px",
    fontSize: 15,
    fontWeight: 700,
    border: on ? `2px solid ${INDIGO}` : `1px solid ${RULE}`,
    borderRadius: 12,
    background: on ? INDIGO_WASH : CARD,
    color: on ? INDIGO : INK,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <button
        type="button"
        aria-pressed={value === null}
        style={chip(value === null)}
        onClick={() => onPick(null)}
      >
        Any
      </button>
      {order.map((wd) => (
        <button
          key={wd}
          type="button"
          style={chip(value === wd)}
          onClick={() => onPick(wd)}
          aria-label={WEEKDAYS[wd]}
          aria-pressed={value === wd}
        >
          {SHORT[wd]}
        </button>
      ))}
    </div>
  );
}

function RepeatPicker({ repeat, onPick }) {
  const opt = (on) => ({
    font: "inherit",
    flex: 1,
    padding: "11px 10px",
    fontSize: 15,
    fontWeight: 700,
    border: on ? `2px solid ${INDIGO}` : `1px solid ${RULE}`,
    borderRadius: 12,
    background: on ? INDIGO_WASH : CARD,
    color: on ? INDIGO : INK,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        aria-pressed={repeat}
        style={opt(repeat)}
        onClick={() => onPick(true)}
      >
        Every week
      </button>
      <button
        type="button"
        aria-pressed={!repeat}
        style={opt(!repeat)}
        onClick={() => onPick(false)}
      >
        Just this week
      </button>
    </div>
  );
}

function AddTask({ startsOn, defaultDay, onAdd }) {
  const [name, setName] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [repeat, setRepeat] = useState(true);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, day, repeat });
    setName("");
  };

  return (
    <form
      onSubmit={submit}
      style={{
        padding: 18,
        marginBottom: 18,
        border: `1px solid ${RULE}`,
        borderRadius: 20,
        background: CARD,
      }}
    >
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
          What needs doing?
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wash the car"
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 17,
            color: INK,
            border: `1px solid ${RULE}`,
            borderRadius: 12,
            background: "#FFF",
          }}
        />
      </label>

      <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
        Which day?
      </span>
      <div style={{ marginBottom: 14 }}>
        <DayPicker value={day} onPick={setDay} startsOn={startsOn} />
      </div>

      <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
        How often?
      </span>
      <div style={{ marginBottom: 16 }}>
        <RepeatPicker repeat={repeat} onPick={setRepeat} />
      </div>

      <button
        type="submit"
        disabled={!name.trim()}
        style={{
          font: "inherit",
          width: "100%",
          padding: "14px 18px",
          fontSize: 17,
          fontWeight: 700,
          border: "none",
          borderRadius: 14,
          background: name.trim() ? INDIGO : WASH,
          color: name.trim() ? "#FFF" : MUTE,
          cursor: name.trim() ? "pointer" : "default",
        }}
      >
        Add it
      </button>
    </form>
  );
}

/* A task on the Tasks tab: tap it to change the day, change how often, or
   take it off the list. */
function EditRow({ task, open, startsOn, onOpen, onChange, onDelete }) {
  return (
    <div
      style={{
        marginBottom: 10,
        border: open ? `2px solid ${INDIGO}` : `1px solid ${RULE}`,
        borderRadius: 16,
        background: CARD,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          font: "inherit",
          color: INK,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>
            {task.name}
          </span>
          <span style={{ display: "block", marginTop: 3, fontSize: 14, color: MUTE }}>
            {task.day === null ? "Any day" : WEEKDAYS[task.day]} ·{" "}
            {task.repeat ? "every week" : "this week only"}
          </span>
        </span>
        <span style={{ flex: "0 0 auto", fontSize: 15, color: INDIGO, fontWeight: 700 }}>
          {open ? "Done" : "Change"}
        </span>
      </button>

      {open ? (
        <div style={{ padding: "0 16px 16px" }}>
          <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
            Which day?
          </span>
          <div style={{ marginBottom: 14 }}>
            <DayPicker
              value={task.day}
              startsOn={startsOn}
              onPick={(day) => onChange({ day })}
            />
          </div>

          <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
            How often?
          </span>
          <div style={{ marginBottom: 14 }}>
            <RepeatPicker repeat={task.repeat} onPick={(repeat) => onChange({ repeat })} />
          </div>

          <button
            type="button"
            onClick={onDelete}
            style={{
              font: "inherit",
              padding: "11px 16px",
              fontSize: 15,
              fontWeight: 700,
              border: `1px solid ${NOW}`,
              borderRadius: 12,
              background: "#FFF",
              color: NOW,
              cursor: "pointer",
            }}
          >
            Take it off the list
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TasksView({ tasks, thisWeek, now, prefs, onAdd, onChange, onDelete, onPrefs }) {
  const [open, setOpen] = useState(null);
  const list = tasksForWeek(tasks, thisWeek, prefs.weekStart);

  const order = Array.from({ length: 7 }, (_, i) => (prefs.weekStart + i) % 7);
  const spare = loose(list);

  const setting = (on) => ({
    font: "inherit",
    flex: 1,
    padding: "11px 10px",
    fontSize: 15,
    fontWeight: 700,
    border: on ? `2px solid ${INDIGO}` : `1px solid ${RULE}`,
    borderRadius: 12,
    background: on ? INDIGO_WASH : CARD,
    color: on ? INDIGO : INK,
    cursor: "pointer",
  });

  const group = (title, rows) =>
    rows.length ? (
      <div key={title} style={{ marginBottom: 18 }}>
        <p
          style={{
            margin: "0 2px 8px",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: MUTE,
          }}
        >
          {title}
        </p>
        {rows.map((task) => (
          <EditRow
            key={task.id}
            task={task}
            open={open === task.id}
            startsOn={prefs.weekStart}
            onOpen={() => setOpen(open === task.id ? null : task.id)}
            onChange={(change) => onChange(task.id, change)}
            onDelete={() => {
              if (window.confirm(`Take "${task.name}" off the list?`)) {
                setOpen(null);
                onDelete(task.id);
              }
            }}
          />
        ))}
      </div>
    ) : null;

  return (
    <div>
      <Header
        title="Tasks"
        sub={`${list.length} on the list${list.length ? "" : " yet"}`}
      />

      <AddTask startsOn={prefs.weekStart} defaultDay={weekdayOf(now)} onAdd={onAdd} />

      {group("Any day this week", spare)}
      {order.map((wd) => group(WEEKDAYS[wd], tasksOnDay(list, wd)))}

      <div
        style={{
          padding: 18,
          marginBottom: 16,
          border: `1px solid ${RULE}`,
          borderRadius: 20,
          background: CARD,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>The week starts on</div>
        <p style={{ margin: "6px 0 12px", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          This is the morning everything goes back to unticked.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {/* the day chips on this same screen are called Monday and Sunday
              too, so these two say what they are for out loud */}
          <button
            type="button"
            aria-label="Start the week on Monday"
            aria-pressed={prefs.weekStart === 1}
            style={setting(prefs.weekStart === 1)}
            onClick={() => onPrefs({ weekStart: 1 })}
          >
            Monday
          </button>
          <button
            type="button"
            aria-label="Start the week on Sunday"
            aria-pressed={prefs.weekStart === 0}
            style={setting(prefs.weekStart === 0)}
            onClick={() => onPrefs({ weekStart: 0 })}
          >
            Sunday
          </button>
        </div>
      </div>
    </div>
  );
}

/* Everything is on this phone and nowhere else, so a file that can go in
   iCloud or an email to yourself is the only safety net there is. */
function Backup({ tasks, onRestored }) {
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const exportNow = async () => {
    const payload = buildBackup(APP, KEYS);
    const result = await saveBackup(payload, `weekly-${today()}.json`);
    if (result === "shared" || result === "downloaded") {
      setMessage("Backup saved.");
    } else if (result === "cancelled") {
      setMessage(null);
    } else {
      setMessage(
        "That did not work here — try from the browser rather than the home-screen app."
      );
    }
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
      if (
        !window.confirm(
          "Replace everything on this phone with the backup? What is here now will be lost."
        )
      ) {
        return;
      }
      restoreBackup(payload, KEYS);
      onRestored();
      setMessage("Backup restored.");
    } catch (e) {
      setMessage(e.message || "That file could not be read.");
    }
  };

  const button = {
    font: "inherit",
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 700,
    border: `1px solid ${RULE}`,
    borderRadius: 12,
    background: "#FFF",
    color: INK,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: 18,
        border: `1px solid ${RULE}`,
        borderRadius: 20,
        background: CARD,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700 }}>Keep a copy</div>
      <p style={{ margin: "6px 0 14px", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
        Everything is saved on this phone only. {tasks.length}{" "}
        {tasks.length === 1 ? "task" : "tasks"} set up so far.
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
        <p style={{ margin: "12px 0 0", fontSize: 15, color: INK }}>{message}</p>
      ) : null}
    </div>
  );
}

/* The weeks behind this one, so a run of good ones is visible and a bad one
   is over rather than sitting on today's list. */
function PastView({ tasks, log, thisWeek, startsOn, onOpenWeek, onRestored }) {
  const weeks = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 8; i += 1) {
      const start = shiftDay(thisWeek, -7 * i);
      const list = tasksForWeek(tasks, start, startsOn);
      if (!list.length && !Object.keys(ticksFor(log, start)).length) continue;
      out.push({ start, list, done: countDone(log, start, list) });
    }
    return out;
  }, [tasks, log, thisWeek, startsOn]);

  const best = weeks.reduce(
    (top, w) => Math.max(top, w.list.length ? w.done / w.list.length : 0),
    0
  );

  return (
    <div>
      <Header title="Past weeks" sub="Finished and left behind" />

      {weeks.length === 0 ? (
        <p
          style={{
            margin: "0 2px 20px",
            fontSize: 15,
            color: MUTE,
            lineHeight: 1.5,
          }}
        >
          Nothing behind you yet. Weeks land here as they finish, and what is on
          this week's list is never affected by them.
        </p>
      ) : (
        weeks.map(({ start, list, done }) => {
          const total = list.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const full = total > 0 && done === total;
          return (
            <button
              key={start}
              type="button"
              onClick={() => onOpenWeek(start)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 18,
                marginBottom: 12,
                font: "inherit",
                color: INK,
                border: `1px solid ${full ? DONE : RULE}`,
                borderRadius: 20,
                background: CARD,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 700 }}>
                  {weekLabel(start, thisWeek)}
                </span>
                <span style={{ fontSize: 15, color: MUTE }}>{weekRange(start)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  margin: "10px 0 8px",
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: 1 }}>
                  {pct}%
                </span>
                <span style={{ fontSize: 15, color: MUTE }}>
                  {done} of {total} done
                </span>
              </div>
              <Bar done={done} total={total} colour={full ? DONE : INDIGO} />
              <div style={{ marginTop: 12, fontSize: 15, color: INDIGO, fontWeight: 700 }}>
                Look at it ›
              </div>
            </button>
          );
        })
      )}

      {weeks.length ? (
        <p style={{ margin: "0 2px 18px", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          Best of the last {weeks.length} {weeks.length === 1 ? "week" : "weeks"}:{" "}
          {Math.round(best * 100)}%.
        </p>
      ) : null}

      <Backup tasks={tasks} onRestored={onRestored} />
    </div>
  );
}

/* ============================ shell ============================ */

const TABS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "tasks", label: "Tasks" },
  { id: "past", label: "Past" },
];

export default function WeeklyApp() {
  const [tasks, setTasks] = useState(() => loadJSON(KEY_TASKS, []));
  const [log, setLog] = useState(() => loadJSON(KEY_LOG, {}));
  const [prefs, setPrefs] = useState(() => ({
    ...DEFAULT_PREFS,
    ...loadJSON(KEY_PREFS, {}),
  }));
  const [view, setView] = useState("today");
  const [now, setNow] = useState(today);

  const thisWeek = weekStartOf(now, prefs.weekStart);
  const [week, setWeek] = useState(thisWeek);

  /* A home-screen app is rarely closed, so it can be sitting open when
     midnight passes — and the whole point of this one is that the new week
     arrives on its own. Whenever it comes back to the front, check the date. */
  useEffect(() => {
    const check = () => {
      const fresh = today();
      setNow((was) => was === fresh ? was : fresh);
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

  /* Follow the week along when it turns over, or when the start day is
     changed — unless a past week is deliberately being looked at. */
  const wasWeek = useRef(thisWeek);
  useEffect(() => {
    if (wasWeek.current !== thisWeek) {
      setWeek((shown) => (shown === wasWeek.current ? thisWeek : shown));
      wasWeek.current = thisWeek;
    }
  }, [thisWeek]);

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

  const addTask = ({ name, day, repeat }) =>
    commitTasks([...tasks, { id: newId(), name, day, repeat, since: now }]);

  const changeTask = (id, change) =>
    commitTasks(tasks.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const deleteTask = (id) => {
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
     that is this week, the week's own Monday when an earlier one is being
     caught up. That keeps every tick self-describing, which is what lets the
     week-start setting be changed without losing any of them. */
  const toggle = (taskId, onWeek) => {
    const inside = now >= onWeek && now <= weekEnd(onWeek);
    commitLog(toggleTick(log, onWeek, taskId, inside ? now : onWeek));
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

  const openWeek = (start) => {
    setWeek(start);
    setView("week");
  };

  return (
    <div style={{ minHeight: "100dvh", fontFamily: BODY, color: INK }}>
      <div
        className="pad-nav"
        /* longhands, not the padding shorthand: an inline shorthand would set
           padding-bottom to 0 and beat .pad-nav, putting the last card under
           the fixed bar */
        style={{
          maxWidth: 560,
          margin: "0 auto",
          paddingTop: 22,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        {view === "today" ? (
          <TodayView
            tasks={tasks}
            log={log}
            thisWeek={thisWeek}
            now={now}
            prefs={prefs}
            onToggle={toggle}
            onGoTasks={() => setView("tasks")}
          />
        ) : view === "week" ? (
          <WeekView
            tasks={tasks}
            log={log}
            week={week}
            thisWeek={thisWeek}
            now={now}
            prefs={prefs}
            onToggle={toggle}
            onPickWeek={setWeek}
          />
        ) : view === "tasks" ? (
          <TasksView
            tasks={tasks}
            thisWeek={thisWeek}
            now={now}
            prefs={prefs}
            onAdd={addTask}
            onChange={changeTask}
            onDelete={deleteTask}
            onPrefs={changePrefs}
          />
        ) : (
          <PastView
            tasks={tasks}
            log={log}
            thisWeek={thisWeek}
            startsOn={prefs.weekStart}
            onOpenWeek={openWeek}
            onRestored={reload}
          />
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
          background: "rgba(245,243,251,0.96)",
          backdropFilter: "blur(8px)",
          borderTop: `1px solid ${RULE}`,
        }}
      >
        {TABS.map((tab) => {
          const on = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === "week") setWeek(thisWeek);
                setView(tab.id);
              }}
              aria-current={on ? "page" : undefined}
              style={{
                font: "inherit",
                flex: 1,
                padding: "12px 4px",
                border: "none",
                borderRadius: 14,
                background: on ? INDIGO : "transparent",
                color: on ? "#FFF" : MUTE,
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
    </div>
  );
}
