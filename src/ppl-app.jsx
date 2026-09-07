import { useEffect, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import { BackupCard } from "./backup-card";
import { shortDate, today } from "./dates";
import { TrendChart } from "./charts";
import { Btn, SectionLabel } from "./ui";
import { WeightPanel } from "./weight";
import { MONTH_NAMES, MonthGrid, daysInMonth, iso } from "./month";
import {
  BAT_THEMES,
  BG,
  BODY,
  CARD,
  DISPLAY,
  INK,
  LEGS_C,
  LINE,
  MUTE,
  ON_ACCENT,
  PULL_C,
  PUSH_C,
  RAISED,
  RULE,
  TEXT,
  WASH,
  applyTheme,
} from "./tokens";

/* ============================ what this app is ============================
 * Three things, and nothing that tells you how to train:
 *
 *   Overload  - every exercise, and the weight on it over time
 *   Weight    - one number a day, on a line
 *   Month     - a block a day for the gym, eating clean and cardio
 *
 * There is no split, no session runner and no plan, because the training does
 * not come from the app. It only has to remember what happened.
 */

const GOALS = {
  cut: { label: "Cut", cardio: "daily", note: "Cardio every day." },
  maintain: { label: "Maintain", cardio: "often", note: "Cardio five days a week." },
  bulk: { label: "Bulk", cardio: null, note: "No cardio while bulking." },
};

const TRACKS = [
  { key: "workout", label: "Gym", verb: "gone", colour: () => PUSH_C },
  { key: "eat", label: "Eat clean", verb: "done", colour: () => PULL_C },
  { key: "cardio", label: "Cardio", verb: "done", colour: () => LEGS_C },
];

/* the weight the app opens the logger on: the last one entered, or a round
   number to start from */
const lastWeight = (hist) => (hist && hist.length ? hist[hist.length - 1].w : 20);

/* One point a day for the chart - the heaviest of that day. Two sets logged
   on one day are not two points on a line. */
const perDay = (hist) => {
  const byDate = {};
  (hist || []).forEach((s) => {
    if (byDate[s.d] == null || s.w > byDate[s.d]) byDate[s.d] = s.w;
  });
  return Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, w]) => ({ d, v: w }));
};

/* Sets, the same way: the most done in a day, and only for the days that
   carry a figure - everything logged before sets existed simply has none, so
   the second line starts where the counting started. */
const setsPerDay = (hist) => {
  const byDate = {};
  (hist || []).forEach((s) => {
    if (s.s == null) return;
    if (byDate[s.d] == null || s.s > byDate[s.d]) byDate[s.d] = s.s;
  });
  return Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, n]) => ({ d, v: n }));
};

const lastSets = (hist) => {
  const withSets = (hist || []).filter((e) => e.s != null);
  return withSets.length ? withSets[withSets.length - 1].s : 3;
};

/* ---- moving over from the old app ----
 * The exercise list used to be picks per muscle group plus anything added on
 * the phone. It is one flat list now, so it is built once from whatever that
 * profile held, plus anything with logged sets that is no longer ticked, so
 * nothing with history falls off the list. */
function migrateExercises(profile, lifts) {
  if (Array.isArray(profile.exercises)) return profile.exercises;
  const out = [];
  const add = (n) => {
    if (n && !out.includes(n)) out.push(n);
  };
  Object.values(profile.picks || {}).forEach((names) => (names || []).forEach(add));
  Object.values(profile.custom || {}).forEach((names) => (names || []).forEach(add));
  Object.keys(lifts || {}).forEach(add);
  return out;
}

/* the sets logged on a given day, if any were */
const setsOn = (setPoints, day) => {
  const hit = setPoints.find((p) => p.d === day);
  return hit ? hit.v : null;
};

/* ============================ overload detail ============================ */

function Overload({ name, hist, onLog, onRemove, onBack }) {
  const [picked, setPicked] = useState(null);
  const [kg, setKg] = useState(() => String(lastWeight(hist)));
  const [sets, setSets] = useState(() => lastSets(hist));
  const [confirmGone, setConfirmGone] = useState(false);

  const points = perDay(hist);
  const setPoints = setsPerDay(hist);
  const entries = [...(hist || [])].sort((a, b) => (a.d < b.d ? 1 : -1));
  const num = parseFloat(kg);
  const valid = !isNaN(num) && num > 0 && num < 1000;
  const bump = (d) => setKg(String(+(Math.max(0, (valid ? num : 0) + d)).toFixed(2)));

  const heaviest = entries.length ? Math.max(...entries.map((e) => e.w)) : null;
  const first = hist && hist.length ? hist[0] : null;
  const gain = first && heaviest != null ? +(heaviest - first.w).toFixed(1) : null;

  const pad = { width: 62, height: 62, fontSize: 26, background: CARD,
    border: `1px solid ${RULE}`, color: TEXT, lineHeight: 1, flexShrink: 0 };

  return (
    <div className="pad-nav" style={{ fontFamily: BODY, color: TEXT, background: BG, minHeight: "100vh" }}>
      <div className="cut" style={{ background: INK, padding: "14px 16px 26px" }}>
        <Btn
          plain
          onClick={onBack}
          style={{ background: "transparent", color: TEXT, border: `1px solid ${RULE}`,
            fontSize: 13, padding: "6px 11px", marginBottom: 12 }}
        >
          ← All exercises
        </Btn>
        <div style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, lineHeight: 1,
          textTransform: "uppercase", letterSpacing: "-0.02em" }}>
          {name}
        </div>
        {heaviest != null && (
          <div style={{ fontSize: 15, fontWeight: 700, color: MUTE, marginTop: 8 }}>
            Heaviest {heaviest}kg
            {gain ? ` · ${gain > 0 ? "+" : ""}${gain}kg since the first` : ""}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {points.length > 0 ? (
          <div>
            <SectionLabel style={{ marginBottom: 4 }}>
              {points.length > 1 ? "Every session" : "First session"}
            </SectionLabel>
            <TrendChart
              points={points}
              unit="kg"
              color={PUSH_C}
              label={`${name} weight over time`}
              selected={picked}
              onSelect={setPicked}
              second={setPoints}
            />
            <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20 }}>
              {picked != null
                ? `${shortDate(points[picked].d)} · ${points[picked].v}kg${
                    setsOn(setPoints, points[picked].d) != null
                      ? ` · ${setsOn(setPoints, points[picked].d)} sets`
                      : ""
                  }`
                : points.length > 1
                ? "Tap the line to read a day."
                : ""}
            </div>
            {setPoints.length > 0 && (
              /* the only thing saying which line is which, since neither has an
                 axis of its own and a full legend would be more furniture than
                 two lines are worth */
              <div style={{ display: "flex", gap: 14, fontSize: 13, fontWeight: 800,
                letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE, marginTop: 2 }}>
                <span style={{ color: TEXT }}>
                  <span style={{ opacity: 0.6 }}>&#9473;</span> Weight
                </span>
                <span>
                  <span style={{ opacity: 0.55 }}>&#9473;</span> Sets
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4 }}>
            Nothing logged yet. Put today&rsquo;s weight in and the graph starts here.
          </div>
        )}

        <div className="orn" style={{ border: `1px solid ${RULE}`, borderRadius: 14,
          padding: "12px 12px 14px", marginTop: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Log the weight</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn aria="Less weight" onClick={() => bump(-2.5)} style={pad}>&minus;</Btn>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "center" }}>
              <input
                value={kg}
                onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                aria-label="Weight in kilograms"
                style={{ width: 132, maxWidth: "100%", minWidth: 0, border: "none", outline: "none",
                  textAlign: "right", fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em",
                  color: TEXT, background: "transparent", padding: 0 }}
              />
              <span style={{ fontFamily: DISPLAY, fontSize: 20, color: MUTE, marginLeft: 3 }}>kg</span>
            </div>
            <Btn aria="More weight" onClick={() => bump(2.5)} style={pad}>+</Btn>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
              textTransform: "uppercase", color: MUTE }}>
              Sets
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Btn
                aria="One set fewer"
                onClick={() => setSets(Math.max(1, sets - 1))}
                style={{ width: 44, height: 44, padding: 0, fontSize: 22, lineHeight: 1,
                  background: CARD, border: `1px solid ${RULE}`, color: TEXT }}
              >
                &minus;
              </Btn>
              <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, minWidth: 34,
                textAlign: "center" }}>
                {sets}
              </span>
              <Btn
                aria="One set more"
                onClick={() => setSets(Math.min(20, sets + 1))}
                style={{ width: 44, height: 44, padding: 0, fontSize: 22, lineHeight: 1,
                  background: CARD, border: `1px solid ${RULE}`, color: TEXT }}
              >
                +
              </Btn>
            </div>
          </div>

          <Btn
            onClick={() => valid && onLog(+num.toFixed(2), sets)}
            style={{ width: "100%", marginTop: 10, padding: "16px 0", fontSize: 19,
              background: valid ? PUSH_C : WASH, color: valid ? ON_ACCENT : MUTE }}
          >
            Log {valid ? `${+num.toFixed(2)}kg × ${sets}` : "it"}
          </Btn>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 8, lineHeight: 1.35 }}>
            Type it, or nudge it 2.5 at a time. Whatever you actually lifted, and
            how many sets of it.
          </div>
        </div>

        {entries.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Past weights</SectionLabel>
            {entries.slice(0, 20).map((e, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? +(e.w - prev.w).toFixed(2) : null;
              return (
                <div
                  key={`${e.d}-${i}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 10, padding: "11px 12px", background: WASH, borderRadius: 10, marginBottom: 5 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 800, color: MUTE }}>{shortDate(e.d)}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {e.w}kg
                    {e.s != null ? (
                      <span style={{ fontSize: 14, color: MUTE }}> × {e.s} sets</span>
                    ) : e.r ? (
                      <span style={{ fontSize: 14, color: MUTE }}> × {e.r}</span>
                    ) : null}
                    {diff != null && diff !== 0 && (
                      <span style={{ fontSize: 14, color: MUTE, marginLeft: 8 }}>
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {entries.length > 20 && (
              <div style={{ fontSize: 13, color: MUTE, marginTop: 4 }}>
                Showing the last 20 of {entries.length}.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 26, borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
          {confirmGone ? (
            <>
              <div style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 8 }}>
                Take <strong>{name}</strong> off the list? What is logged against it
                is kept, so putting it back brings the graph back with it.
              </div>
              <Btn
                onClick={onRemove}
                style={{ width: "100%", padding: "14px 0", fontSize: 16, background: CARD,
                  color: TEXT, border: `1px solid ${RULE}` }}
              >
                Take it off
              </Btn>
              <Btn
                plain
                onClick={() => setConfirmGone(false)}
                style={{ width: "100%", marginTop: 6, padding: "12px 0", fontSize: 15,
                  background: "transparent", color: MUTE }}
              >
                Keep it
              </Btn>
            </>
          ) : (
            <Btn
              plain
              onClick={() => setConfirmGone(true)}
              style={{ padding: "10px 12px", fontSize: 14, background: "transparent",
                color: MUTE, border: `1px solid ${RULE}` }}
            >
              Remove from the list
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ the list, four ways ============================
 * Four ways to lay out the same list, kept side by side while one is chosen.
 * All four share the search, which is the point of the exercise: the list is
 * long enough now that scrolling it is the slow way to reach anything.
 */

function SearchBar({ value, onChange, count }) {
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
        aria-label="Search exercises"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "16px 2px",
          fontSize: 17,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${LINE}`,
          borderRadius: 0,
          outline: "none",
        }}
      />
      {count != null && (
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em",
          textTransform: "uppercase", color: MUTE, marginTop: 10 }}>
          {count} exercise{count === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function ExerciseList({ names, lifts, onOpen }) {
  const lastOf = (n) => {
    const h = lifts[n];
    return h && h.length ? h[h.length - 1].w : null;
  };

  /* Two across with nothing drawn round a cell: the rules between them are
     the only structure, which is the same move as a lit edge on a dark wall.
     Ten exercises to a screen rather than six, and no boxes to read past. */
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {names.map((name, i) => {
        const w = lastOf(name);
        return (
          <Btn
            key={name}
            onClick={() => onOpen(name)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 10,
              background: "transparent",
              color: TEXT,
              borderRadius: 0,
              border: "none",
              borderTop: i >= 2 ? `1px solid ${LINE}` : "none",
              borderRight: i % 2 === 0 ? `1px solid ${LINE}` : "none",
              padding: i % 2 === 0 ? "20px 14px 22px 2px" : "20px 2px 22px 14px",
              textAlign: "left",
              fontSize: 15,
              lineHeight: 1.25,
            }}
          >
            {/* two lines held open whether the name needs them or not, so the
                weights all sit on one baseline and the grid stays even */}
            <span style={{ minWidth: 0, minHeight: 38 }}>{name}</span>
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: w != null ? TEXT : MUTE,
              }}
            >
              {w != null ? `${w}kg` : "—"}
            </span>
          </Btn>
        );
      })}
    </div>
  );
}

/* ============================ add an exercise ============================ */

function AddExercise({ existing, onAdd, seed }) {
  const [text, setText] = useState("");
  /* what was searched for and not found is almost always what wants adding */
  const value = text || seed || "";
  const name = value.trim().replace(/\s+/g, " ");
  const clash = existing.some((n) => n.toLowerCase() === name.toLowerCase());
  const ok = name.length > 0 && !clash;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an exercise"
          aria-label="Add an exercise"
          style={{ flex: 1, minWidth: 0, padding: "14px 12px", fontSize: 17, background: CARD,
            border: `1px solid ${RULE}`, borderRadius: 10, outline: "none" }}
        />
        <Btn
          onClick={() => {
            if (!ok) return;
            onAdd(name);
            setText("");
          }}
          style={{ flexShrink: 0, padding: "0 18px", fontSize: 16,
            background: ok ? PUSH_C : CARD, color: ok ? ON_ACCENT : MUTE,
            border: `1px solid ${ok ? PUSH_C : RULE}` }}
        >
          Add
        </Btn>
      </div>
      {clash && (
        <div style={{ fontSize: 14, color: MUTE, marginTop: 6 }}>
          {name} is already on the list.
        </div>
      )}
    </div>
  );
}

/* ============================ main app ============================ */

export default function GothamApp() {
  const [tab, setTab] = useState("overload");
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState("");
  const [saveError, setSaveError] = useState(false);

  const profile = loadJSON("ppl-profile", {});
  const [lifts, setLifts] = useState(() => loadJSON("ppl-lifts", {}));
  const [exercises, setExercises] = useState(() =>
    migrateExercises(profile, loadJSON("ppl-lifts", {}))
  );
  const [days, setDays] = useState(() => loadJSON("ppl-days", {}));
  const [weights, setWeights] = useState(() => loadJSON("ppl-weight", {}));
  const [goal, setGoal] = useState(profile.goal || "maintain");
  const [theme, setTheme] = useState(
    BAT_THEMES[profile.theme] ? profile.theme : "cave"
  );

  const t = today();
  const [month, setMonth] = useState(() => ({
    y: Number(t.slice(0, 4)),
    m: Number(t.slice(5, 7)),
  }));

  const persist = (key, value) => {
    try {
      saveJSON(key, value);
      setSaveError(false);
    } catch (e) {
      /* storage full, or blocked in private browsing */
      setSaveError(true);
    }
  };

  /* the old profile is kept whole underneath, so nothing logged under the
     previous app is thrown away by this one saving over it */
  const saveProfile = (next) => {
    const merged = { ...profile, goal, theme, exercises, ...next };
    if (next.goal) setGoal(next.goal);
    if (next.theme) setTheme(next.theme);
    if (next.exercises) setExercises(next.exercises);
    persist("ppl-profile", merged);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  /* write the flattened list back once, so it stops being derived */
  useEffect(() => {
    if (!Array.isArray(profile.exercises))
      persist("ppl-profile", { ...profile, goal, theme, exercises });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const toggleDay = (key, day) => {
    const was = days[day] || {};
    const next = { ...days, [day]: { ...was, [key]: !was[key] } };
    setDays(next);
    persist("ppl-days", next);
  };

  const saveWeight = (kg) => {
    const next = { ...weights, [t]: kg };
    setWeights(next);
    persist("ppl-weight", next);
  };

  const logLift = (name, w, sets) => {
    const hist = lifts[name] ? [...lifts[name]] : [];
    hist.push({ d: t, w, s: sets });
    const next = { ...lifts, [name]: hist.slice(-200) };
    setLifts(next);
    persist("ppl-lifts", next);
  };

  const addExercise = (name) =>
    saveProfile({ exercises: [...exercises, name] });

  const removeExercise = (name) => {
    saveProfile({ exercises: exercises.filter((n) => n !== name) });
    setOpen(null);
  };

  if (open) {
    return (
      <Overload
        name={open}
        hist={lifts[open]}
        onLog={(w, sets) => logLift(open, w, sets)}
        onRemove={() => removeExercise(open)}
        onBack={() => setOpen(null)}
      />
    );
  }

  const shown = exercises.filter((n) =>
    n.toLowerCase().includes(query.trim().toLowerCase())
  );

  const stepMonth = (d) => {
    const m = month.m + d;
    setMonth(m < 1 ? { y: month.y - 1, m: 12 } : m > 12 ? { y: month.y + 1, m: 1 } : { ...month, m });
  };

  /* how much of this month has already happened, for the skipped count */
  const size = daysInMonth(month.y, month.m);
  const elapsed = (() => {
    const last = iso(month.y, month.m, size);
    if (last <= t) return size;
    const first = iso(month.y, month.m, 1);
    if (first > t) return 0;
    return Number(t.slice(8));
  })();
  const inMonth = (key) =>
    Array.from({ length: size }, (_, i) => iso(month.y, month.m, i + 1)).filter(
      (d) => days[d] && days[d][key]
    ).length;

  const tracks = TRACKS.filter((x) => x.key !== "cardio" || GOALS[goal].cardio);
  const aimFor = (key) => {
    if (key === "cardio") return GOALS[goal].cardio === "often" ? Math.round((size * 5) / 7) : null;
    return null;
  };

  return (
    <div
      className="pad-nav"
      style={{ fontFamily: BODY, color: TEXT, background: BG, minHeight: "100vh",
        WebkitTextSizeAdjust: "100%" }}
    >
      {saveError && (
        <div style={{ background: PUSH_C, color: ON_ACCENT, padding: "8px 14px",
          fontSize: 14, fontWeight: 700 }}>
          Couldn&rsquo;t save just then — the phone&rsquo;s storage is full or blocked.
        </div>
      )}

      {/* ---------------- OVERLOAD ---------------- */}
      {tab === "overload" && (
        <div>
          <div className="cut" style={{ background: INK, padding: "16px 16px 26px" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 800, lineHeight: 0.98,
              textTransform: "uppercase", letterSpacing: "-0.02em" }}>
              Progressive
              <br />
              overload
            </div>
            {exercises.length === 0 && (
              <div style={{ fontSize: 15, fontWeight: 700, color: MUTE, marginTop: 8 }}>
                Every exercise you run. Tap one to log the weight and see the graph.
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              count={query ? null : exercises.length}
            />
            {exercises.length === 0 && (
              <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4, marginBottom: 4 }}>
                Nothing on the list yet. Add the first one below.
              </div>
            )}
            <ExerciseList names={shown} lifts={lifts} onOpen={setOpen} />
            {query && shown.length === 0 && (
              <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4, padding: "8px 0 2px" }}>
                Nothing matches &ldquo;{query}&rdquo;.
              </div>
            )}
            <AddExercise existing={exercises} onAdd={addExercise} seed={query} />
          </div>
        </div>
      )}

      {/* ---------------- WEIGHT ---------------- */}
      {tab === "weight" && <WeightPanel weights={weights} onSave={saveWeight} />}

      {/* ---------------- MONTH ---------------- */}
      {tab === "month" && (
        <div>
          <div className="cut" style={{ background: INK, padding: "16px 16px 26px" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 800, lineHeight: 1,
              textTransform: "uppercase", letterSpacing: "-0.02em" }}>
              Monthly overview
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <Btn
                plain
                aria="Previous month"
                onClick={() => stepMonth(-1)}
                style={{ width: 46, height: 46, padding: 0, fontSize: 20, background: CARD,
                  color: TEXT, border: `1px solid ${RULE}` }}
              >
                ‹
              </Btn>
              <div style={{ flex: 1, textAlign: "center", fontFamily: DISPLAY, fontSize: 19, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.14em" }}>
                {MONTH_NAMES[month.m - 1]} {month.y}
              </div>
              <Btn
                plain
                aria="Next month"
                onClick={() => stepMonth(1)}
                style={{ width: 46, height: 46, padding: 0, fontSize: 20, background: CARD,
                  color: TEXT, border: `1px solid ${RULE}` }}
              >
                ›
              </Btn>
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {tracks.map((track) => {
              const done = inMonth(track.key);
              const aim = aimFor(track.key);
              const missed = Math.max(0, elapsed - done);
              return (
                <div key={track.key} className="orn" style={{ border: `1px solid ${RULE}`,
                  borderRadius: 14, padding: "12px 12px 14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, textTransform: "uppercase",
                      letterSpacing: "0.02em" }}>
                      {track.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: MUTE }}>
                      {done} {track.verb}
                      {aim != null
                        ? ` · ${aim} is the aim`
                        : elapsed
                        ? ` · ${missed} skipped`
                        : ""}
                    </div>
                  </div>
                  <MonthGrid
                    year={month.y}
                    month={month.m}
                    done={Object.fromEntries(
                      Object.entries(days).map(([d, f]) => [d, !!f[track.key]])
                    )}
                    colour={track.colour()}
                    today={t}
                    label={track.label}
                    onToggle={(d) => toggleDay(track.key, d)}
                  />
                </div>
              );
            })}

            <div style={{ marginTop: 18, borderTop: `1px solid ${RULE}`, paddingTop: 14 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Right now I am</SectionLabel>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(GOALS).map(([k, g]) => {
                  const on = goal === k;
                  return (
                    <Btn
                      key={k}
                      onClick={() => saveProfile({ goal: k })}
                      style={{ flex: 1, padding: "13px 0", fontSize: 16,
                        background: on ? PUSH_C : CARD, color: on ? ON_ACCENT : TEXT,
                        border: `1px solid ${on ? PUSH_C : RULE}` }}
                    >
                      {g.label}
                    </Btn>
                  );
                })}
              </div>
              <div style={{ fontSize: 14, color: MUTE, marginTop: 8 }}>
                {GOALS[goal].note}
              </div>
            </div>

            <div style={{ marginTop: 20, borderTop: `1px solid ${RULE}`, paddingTop: 14 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Look</SectionLabel>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(BAT_THEMES).map(([k, th]) => {
                  const on = theme === k;
                  return (
                    <Btn
                      key={k}
                      onClick={() => saveProfile({ theme: k })}
                      style={{ flex: 1, padding: "13px 0", fontSize: 16,
                        background: on ? PUSH_C : CARD, color: on ? ON_ACCENT : TEXT,
                        border: `1px solid ${on ? PUSH_C : RULE}` }}
                    >
                      {th.label}
                    </Btn>
                  );
                })}
              </div>
              <div style={{ fontSize: 14, color: MUTE, marginTop: 8 }}>
                {BAT_THEMES[theme].note}
              </div>
            </div>

            <BackupCard
              app="ppl"
              prefix="ppl"
              keys={["ppl-profile", "ppl-days", "ppl-lifts", "ppl-weight"]}
              accent={PUSH_C}
            />
          </div>
        </div>
      )}

      {/* ---------------- NAV ---------------- */}
      <div
        className="safe-nav"
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex",
          borderTop: `1px solid ${RULE}`, background: INK }}
      >
        {[
          ["overload", "Overload"],
          ["weight", "Weight"],
          ["month", "Month"],
        ].map(([k, label]) => (
          <Btn
            key={k}
            plain
            onClick={() => setTab(k)}
            style={{ flex: 1, padding: "18px 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.14em",
              borderRadius: 0, background: tab === k ? RAISED : BG, color: tab === k ? TEXT : MUTE }}
          >
            {label}
          </Btn>
        ))}
      </div>
    </div>
  );
}
