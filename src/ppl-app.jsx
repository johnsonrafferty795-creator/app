import { useEffect, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import { BackupCard } from "./backup-card";
import { shortDate, today } from "./dates";
import { TrendChart } from "./charts";
import { Btn, SectionLabel } from "./ui";
import { WeightPanel } from "./weight";
import { MONTH_NAMES, MonthGrid, daysInMonth, iso } from "./month";
import {
  ACCENT_TEXT,
  BAT_THEMES,
  BG,
  BODY,
  CARD,
  DISPLAY,
  INK,
  LEGS_C,
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

/* ============================ overload detail ============================ */

function Overload({ name, hist, onLog, onRemove, onBack }) {
  const [picked, setPicked] = useState(null);
  const [kg, setKg] = useState(() => String(lastWeight(hist)));
  const [confirmGone, setConfirmGone] = useState(false);

  const points = perDay(hist);
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
            />
            <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20 }}>
              {picked != null
                ? `${shortDate(points[picked].d)} · ${points[picked].v}kg`
                : points.length > 1
                ? "Tap the line to read a day."
                : ""}
            </div>
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
          <Btn
            onClick={() => valid && onLog(+num.toFixed(2))}
            style={{ width: "100%", marginTop: 10, padding: "16px 0", fontSize: 19,
              background: valid ? PUSH_C : WASH, color: valid ? ON_ACCENT : MUTE }}
          >
            Log {valid ? `${+num.toFixed(2)}kg` : "it"}
          </Btn>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 8, lineHeight: 1.35 }}>
            Type it, or nudge it 2.5 at a time. Whatever you actually lifted.
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
                    {e.r ? <span style={{ fontSize: 14, color: MUTE }}> × {e.r}</span> : null}
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

/* ============================ add an exercise ============================ */

function AddExercise({ existing, onAdd }) {
  const [text, setText] = useState("");
  const name = text.trim().replace(/\s+/g, " ");
  const clash = existing.some((n) => n.toLowerCase() === name.toLowerCase());
  const ok = name.length > 0 && !clash;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
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

  const logLift = (name, w) => {
    const hist = lifts[name] ? [...lifts[name]] : [];
    hist.push({ d: t, w });
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
        onLog={(w) => logLift(open, w)}
        onRemove={() => removeExercise(open)}
        onBack={() => setOpen(null)}
      />
    );
  }

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
            <div style={{ fontSize: 15, fontWeight: 700, color: MUTE, marginTop: 8 }}>
              Every exercise you run. Tap one to log the weight and see the graph.
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {exercises.length === 0 && (
              <div style={{ fontSize: 16, color: MUTE, lineHeight: 1.4, marginBottom: 4 }}>
                Nothing on the list yet. Add the first one below.
              </div>
            )}
            {exercises.map((name) => {
              const hist = lifts[name];
              const last = hist && hist.length ? hist[hist.length - 1] : null;
              return (
                <Btn
                  key={name}
                  onClick={() => setOpen(name)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 10, background: CARD, color: TEXT,
                    border: `1px solid ${RULE}`, padding: "15px 13px", marginBottom: 6,
                    textAlign: "left", fontSize: 18 }}
                >
                  <span style={{ minWidth: 0 }}>{name}</span>
                  <span style={{ flexShrink: 0, fontSize: 17, color: last ? ACCENT_TEXT : MUTE }}>
                    {last ? `${last.w}kg` : "—"}
                    <span style={{ color: MUTE }}> ›</span>
                  </span>
                </Btn>
              );
            })}
            <AddExercise existing={exercises} onAdd={addExercise} />
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
