import { useEffect, useRef, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
} from "./backup";

/* ============================ constants ============================ */

const INK = "#23201B";
const MUTE = "#6B6459";
const RULE = "#E4DCD0";
const CARD = "#FFFFFF";
const WASH = "#F1EBE1";
const GREEN = "#1F6A4A";
const GREEN_WASH = "#E7F1EB";
const MAISIE = "#7B4A2E";
const GEORGE = "#2E6272";
const DISPLAY = "'Arial Black','Helvetica Neue',Impact,sans-serif";
const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const KEY_DAYS = "dg-days";
const APP = "dogs";
const KEYS = [KEY_DAYS];
/* a year and a bit of history is plenty, and keeps the store small */
const KEEP_DAYS = 400;

/* The routines, one list each. `key` marks the two the breed notes call
   non-negotiable — they get a marker on the row so a rushed day still gets
   the important half done. */
const DOGS = [
  {
    id: "maisie",
    name: "Maisie",
    breed: "German Shorthaired Pointer",
    accent: MAISIE,
    tasks: [
      { id: "sit", name: "Sit, down, stay", note: "Short session, a few minutes" },
      { id: "recall", name: "Recall", note: "On the long line — the priority for a pointer", key: true },
      { id: "leash", name: "Loose-leash walking" },
      { id: "leave", name: "Leave it, drop it" },
      { id: "wait", name: "Wait", note: "At doors, at meals, at the car" },
      { id: "social", name: "Meeting the world", note: "New people, new dogs, new places" },
      { id: "nose", name: "Nose work", note: "Scent games — an outlet for her instincts" },
      { id: "exercise", name: "Proper exercise", note: "Non-negotiable for this breed", key: true },
      { id: "settle", name: "Settle and crate" },
    ],
  },
  {
    id: "george",
    name: "George",
    breed: "Border Terrier",
    accent: GEORGE,
    tasks: [
      { id: "sit", name: "Sit, down, stay", note: "Keep it snappy — terriers bore fast" },
      { id: "recall", name: "Recall", note: "On the long line — prey drive means bolting", key: true },
      { id: "leash", name: "Loose-leash walking" },
      { id: "leave", name: "Leave it, drop it", note: "They grab and chase anything that moves" },
      { id: "wait", name: "Wait", note: "At doors, at meals, at the car" },
      { id: "social", name: "Meeting the world", note: "People, dogs, and small animals especially" },
      { id: "dig", name: "Digging outlet", note: "Sandbox or dig zone, to save the garden" },
      { id: "exercise", name: "Proper exercise", note: "Tireless — needs real output", key: true },
      { id: "settle", name: "Settle and crate" },
    ],
  },
];

const dogById = (id) => DOGS.find((d) => d.id === id);

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

const dayLetter = (day) => WEEKDAYS[asDate(day).getDay()][0];

const dayNumber = (day) => Number(day.slice(8));

/* "Friday 21 August", or "Today" / "Yesterday" where that is friendlier. */
function dayLabel(day, now) {
  if (day === now) return "Today";
  if (day === shiftDay(now, -1)) return "Yesterday";
  const d = asDate(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const longDate = (day) => {
  const d = asDate(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/* The last n days, oldest first, ending on `end`. */
const window7 = (end, n = 7) =>
  Array.from({ length: n }, (_, i) => shiftDay(end, -(n - 1 - i)));

/* ============================ the log ============================ */

const BLANK = { done: {}, note: "" };

const entryFor = (days, day, dogId) =>
  (days[day] && days[day][dogId]) || BLANK;

const isDone = (days, day, dogId, taskId) =>
  !!entryFor(days, day, dogId).done[taskId];

/* Only tasks still on the dog's list count, so an old routine left behind in
   storage can never push a day over its own total. */
const countDone = (days, day, dog) =>
  dog.tasks.filter((t) => isDone(days, day, dog.id, t.id)).length;

const isFullDay = (days, day, dog) => countDone(days, day, dog) === dog.tasks.length;

/* Full days in a row, counting back. Today only breaks the streak once it is
   over — an unfinished today is still in progress, so it is skipped. */
function streak(days, dog, now) {
  let day = isFullDay(days, now, dog) ? now : shiftDay(now, -1);
  let n = 0;
  while (isFullDay(days, day, dog)) {
    n += 1;
    day = shiftDay(day, -1);
  }
  return n;
}

function updateEntry(days, day, dogId, change) {
  const dayEntry = days[day] || {};
  const before = dayEntry[dogId] || BLANK;
  const after = { done: { ...before.done }, note: before.note, ...change };
  return { ...days, [day]: { ...dayEntry, [dogId]: after } };
}

/* Drop anything older than KEEP_DAYS on the way to storage. */
function prune(days, now) {
  const cutoff = shiftDay(now, -KEEP_DAYS);
  const out = {};
  Object.keys(days).forEach((day) => {
    if (day >= cutoff) out[day] = days[day];
  });
  return out;
}

/* ============================ small pieces ============================ */

function Bar({ done, total, colour, height = 10 }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      style={{
        height,
        borderRadius: height,
        background: WASH,
        overflow: "hidden",
      }}
    >
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

/* One task. The whole row is the button — nothing here needs a careful aim. */
function TaskRow({ task, done, colour, onToggle }) {
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
        padding: "16px 16px",
        marginBottom: 10,
        font: "inherit",
        color: INK,
        border: `1px solid ${done ? GREEN : RULE}`,
        borderRadius: 16,
        background: done ? GREEN_WASH : CARD,
        cursor: "pointer",
      }}
    >
      <span
        key={done ? "on" : "off"}
        className={done ? "pop" : undefined}
        style={{
          flex: "0 0 auto",
          width: 38,
          height: 38,
          borderRadius: 12,
          border: done ? "none" : `2px solid ${RULE}`,
          background: done ? GREEN : "#FFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done ? <Tick /> : null}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {task.name}
        </span>
        {task.note ? (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 15,
              color: MUTE,
              lineHeight: 1.35,
            }}
          >
            {task.note}
          </span>
        ) : null}
      </span>

      {task.key ? (
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: colour,
            border: `1px solid ${colour}`,
            borderRadius: 999,
            padding: "3px 8px",
          }}
        >
          Must
        </span>
      ) : null}
    </button>
  );
}

/* The last seven days, so a day missed in the evening can still be ticked. */
function DayStrip({ days, dog, selected, now, onPick }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {window7(now).map((day) => {
        const done = countDone(days, day, dog);
        const full = done === dog.tasks.length;
        const on = day === selected;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onPick(day)}
            aria-label={`${longDate(day)} — ${done} of ${dog.tasks.length} done`}
            aria-pressed={on}
            style={{
              flex: 1,
              padding: "8px 0 10px",
              font: "inherit",
              color: INK,
              border: on ? `2px solid ${dog.accent}` : `1px solid ${RULE}`,
              borderRadius: 12,
              background: on ? "#FFF" : CARD,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "block", fontSize: 12, color: MUTE }}>
              {dayLetter(day)}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              {dayNumber(day)}
            </span>
            <span
              style={{
                display: "block",
                width: 8,
                height: 8,
                margin: "4px auto 0",
                borderRadius: 8,
                background: full ? GREEN : done ? dog.accent : "transparent",
                opacity: full || done ? (full ? 1 : 0.45) : 0,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function Header({ title, sub, colour }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1
        style={{
          margin: 0,
          fontFamily: DISPLAY,
          fontSize: 34,
          lineHeight: 1.1,
          letterSpacing: -0.4,
          color: colour || INK,
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

/* ============================ views ============================ */

function TodayView({ days, now, onOpen }) {
  const allDone = DOGS.every((d) => isFullDay(days, now, d));

  return (
    <div>
      <Header title="Today" sub={longDate(now)} />

      {DOGS.map((dog) => {
        const done = countDone(days, now, dog);
        const total = dog.tasks.length;
        const full = done === total;
        return (
          <button
            key={dog.id}
            type="button"
            onClick={() => onOpen(dog.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 18,
              marginBottom: 14,
              font: "inherit",
              color: INK,
              border: `1px solid ${full ? GREEN : RULE}`,
              borderRadius: 20,
              background: CARD,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 28,
                  color: dog.accent,
                  letterSpacing: -0.3,
                }}
              >
                {dog.name}
              </span>
              <span style={{ fontSize: 14, color: MUTE }}>{dog.breed}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "12px 0 8px",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700 }}>
                {full ? "All done" : `${done} of ${total} done`}
              </span>
              {full ? <Tick size={18} colour={GREEN} /> : null}
            </div>

            <Bar done={done} total={total} colour={full ? GREEN : dog.accent} />

            <div style={{ marginTop: 12, fontSize: 15, color: dog.accent, fontWeight: 700 }}>
              {full ? "See the list" : "Open the list ›"}
            </div>
          </button>
        );
      })}

      {allDone ? (
        <p
          style={{
            margin: "18px 2px 0",
            fontSize: 17,
            color: GREEN,
            fontWeight: 700,
          }}
        >
          Both dogs trained today. Put the kettle on.
        </p>
      ) : (
        <p style={{ margin: "18px 2px 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
          Tick things off as you go. Nothing is lost if you close the app, and a
          day missed can still be ticked from its own page.
        </p>
      )}
    </div>
  );
}

function DogView({ dog, days, now, day, onPickDay, onToggle, onNote }) {
  const done = countDone(days, day, dog);
  const total = dog.tasks.length;
  const full = done === total;
  const note = entryFor(days, day, dog.id).note || "";
  const run = streak(days, dog, now);

  return (
    <div>
      <Header
        title={dog.name}
        sub={`${dog.breed}${run ? ` · ${run} full ${run === 1 ? "day" : "days"} in a row` : ""}`}
        colour={dog.accent}
      />

      <DayStrip days={days} dog={dog} selected={day} now={now} onPick={onPickDay} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "18px 2px 8px",
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700 }}>
          {full ? "All done" : `${done} of ${total} done`}
        </span>
        <span style={{ fontSize: 15, color: MUTE }}>{dayLabel(day, now)}</span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Bar done={done} total={total} colour={full ? GREEN : dog.accent} />
      </div>

      {dog.tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          colour={dog.accent}
          done={isDone(days, day, dog.id, task.id)}
          onToggle={() => onToggle(day, dog.id, task.id)}
        />
      ))}

      <label
        style={{
          display: "block",
          marginTop: 18,
          padding: 16,
          border: `1px solid ${RULE}`,
          borderRadius: 16,
          background: CARD,
        }}
      >
        <span style={{ display: "block", fontSize: 15, color: MUTE, marginBottom: 8 }}>
          How did {dog.name} get on? (optional)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => onNote(day, dog.id, e.target.value)}
          placeholder="Anything worth remembering"
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 17,
            color: INK,
            border: `1px solid ${RULE}`,
            borderRadius: 12,
            background: "#FFF",
          }}
        />
      </label>
    </div>
  );
}

/* One dog's seven days, as bars, plus the per-task tally underneath. */
function WeekBlock({ dog, days, now }) {
  const week = window7(now);
  const before = window7(shiftDay(now, -7));
  const total = dog.tasks.length;

  const share = (list) => {
    const got = list.reduce((sum, day) => sum + countDone(days, day, dog), 0);
    return Math.round((got / (list.length * total)) * 100);
  };

  const pct = share(week);
  const wasPct = share(before);
  const fullDays = week.filter((day) => isFullDay(days, day, dog)).length;

  const perTask = dog.tasks.map((task) => ({
    task,
    hits: week.filter((day) => isDone(days, day, dog.id, task.id)).length,
  }));
  const weakest = perTask.reduce(
    (worst, row) => (worst === null || row.hits < worst.hits ? row : worst),
    null
  );
  const anything = perTask.some((row) => row.hits > 0);

  return (
    <div
      style={{
        padding: 18,
        marginBottom: 16,
        border: `1px solid ${RULE}`,
        borderRadius: 20,
        background: CARD,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            color: dog.accent,
            letterSpacing: -0.3,
          }}
        >
          {dog.name}
        </span>
        <span style={{ fontSize: 14, color: MUTE }}>last 7 days</span>
      </div>

      <div style={{ display: "flex", gap: 18, margin: "14px 0 16px" }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 14, color: MUTE, marginTop: 4 }}>of the list done</div>
        </div>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1 }}>
            {fullDays}
            <span style={{ fontSize: 18, color: MUTE }}>/7</span>
          </div>
          <div style={{ fontSize: 14, color: MUTE, marginTop: 4 }}>complete days</div>
        </div>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1 }}>
            {streak(days, dog, now)}
          </div>
          <div style={{ fontSize: 14, color: MUTE, marginTop: 4 }}>day streak</div>
        </div>
      </div>

      {/* the week itself: one column per day, filled by how much got done */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 92 }}>
        {week.map((day) => {
          const got = countDone(days, day, dog);
          const full = got === total;
          return (
            <div key={day} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 64,
                  display: "flex",
                  alignItems: "flex-end",
                  background: WASH,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.round((got / total) * 100)}%`,
                    background: full ? GREEN : dog.accent,
                    opacity: full ? 1 : 0.8,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: MUTE, marginTop: 6 }}>
                {dayLetter(day)}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>
        {!anything
          ? "Nothing ticked yet this week — it starts filling in as soon as you do."
          : pct === 100
          ? "A perfect week. Every session, every day."
          : `${
              pct >= wasPct
                ? `Up from ${wasPct}% the week before.`
                : `Down from ${wasPct}% the week before.`
            } Most missed: ${weakest.task.name.toLowerCase()} (${weakest.hits} of 7).`}
      </p>

      <div style={{ marginTop: 16, borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
        {perTask.map(({ task, hits }) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
            }}
          >
            <span style={{ flex: 1, fontSize: 15, minWidth: 0 }}>{task.name}</span>
            <span style={{ display: "flex", gap: 4 }}>
              {week.map((day) => (
                <span
                  key={day}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    background: isDone(days, day, dog.id, task.id) ? GREEN : WASH,
                  }}
                />
              ))}
            </span>
            <span
              style={{
                width: 38,
                textAlign: "right",
                fontSize: 14,
                color: hits === 7 ? GREEN : MUTE,
                fontWeight: hits === 7 ? 700 : 400,
              }}
            >
              {hits}/7
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Everything is on this phone and nowhere else, so a file she can put in
   iCloud or email to herself is the only safety net there is. */
function Backup({ days, onRestored }) {
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const dayCount = Object.keys(days).length;

  const exportNow = async () => {
    const payload = buildBackup(APP, KEYS);
    const result = await saveBackup(payload, `dog-training-${today()}.json`);
    if (result === "shared" || result === "downloaded") {
      setMessage("Backup saved.");
    } else if (result === "cancelled") {
      setMessage(null);
    } else {
      setMessage("That did not work here — try from the browser rather than the home-screen app.");
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
      onRestored(loadJSON(KEY_DAYS, {}));
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
        Everything is saved on this phone only. {dayCount} {dayCount === 1 ? "day" : "days"}{" "}
        logged so far.
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

function WeekView({ days, now, onRestored }) {
  return (
    <div>
      <Header title="This week" sub="How the training has been going" />
      {DOGS.map((dog) => (
        <WeekBlock key={dog.id} dog={dog} days={days} now={now} />
      ))}
      <Backup days={days} onRestored={onRestored} />
    </div>
  );
}

/* ============================ shell ============================ */

const TABS = [
  { id: "today", label: "Today" },
  { id: "maisie", label: "Maisie" },
  { id: "george", label: "George" },
  { id: "week", label: "Week" },
];

export default function DogsHub() {
  const [days, setDays] = useState(() => loadJSON(KEY_DAYS, {}));
  const [view, setView] = useState("today");
  const [now, setNow] = useState(today);
  const [day, setDay] = useState(now);

  /* A home-screen app is rarely closed, so it can be sitting open when
     midnight passes. Whenever it comes back to the front, check the date and
     move the app on to the new day. */
  useEffect(() => {
    const check = () => {
      const fresh = today();
      setNow((was) => {
        if (was === fresh) return was;
        setDay(fresh);
        return fresh;
      });
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
    const tidied = prune(next, now);
    setDays(tidied);
    saveJSON(KEY_DAYS, tidied);
  };

  const toggle = (onDay, dogId, taskId) => {
    const was = isDone(days, onDay, dogId, taskId);
    const before = entryFor(days, onDay, dogId).done;
    const done = { ...before };
    if (was) delete done[taskId];
    else done[taskId] = true;
    commit(updateEntry(days, onDay, dogId, { done }));
  };

  const setNote = (onDay, dogId, text) =>
    commit(updateEntry(days, onDay, dogId, { note: text }));

  const openDog = (dogId) => {
    setDay(now);
    setView(dogId);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        fontFamily: BODY,
        color: INK,
      }}
    >
      <div
        className="pad-nav"
        style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 0" }}
      >
        {view === "today" ? (
          <TodayView days={days} now={now} onOpen={openDog} />
        ) : view === "week" ? (
          <WeekView days={days} now={now} onRestored={setDays} />
        ) : (
          <DogView
            dog={dogById(view)}
            days={days}
            now={now}
            day={day}
            onPickDay={setDay}
            onToggle={toggle}
            onNote={setNote}
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
          background: "rgba(250,246,239,0.96)",
          backdropFilter: "blur(8px)",
          borderTop: `1px solid ${RULE}`,
        }}
      >
        {TABS.map((tab) => {
          const on = view === tab.id;
          const dog = dogById(tab.id);
          const colour = dog ? dog.accent : GREEN;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (dog ? openDog(dog.id) : setView(tab.id))}
              aria-current={on ? "page" : undefined}
              style={{
                font: "inherit",
                flex: 1,
                padding: "12px 4px",
                border: "none",
                borderRadius: 14,
                background: on ? colour : "transparent",
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
