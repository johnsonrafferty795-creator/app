import { useState } from "react";

import { HOLDS } from "./lifts";
import { Btn } from "./ui";
import { CARD, DISPLAY, MUTE, ON_ACCENT, PUSH_C, RULE, TEXT, WASH } from "./tokens";

/* ---- per-exercise rules ----
 * Sets, the rep count that moves the weight, and how many sessions a target is
 * held for. These sit on the exercise rather than the muscle group: a heavy
 * compound and a cable movement share a muscle and nothing else about how they
 * progress. The kilo step stays with the group, since that is a property of
 * the plates and the stack rather than the movement.
 */

function SettingRow({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 6,
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
        {label}
      </div>
      {children}
    </div>
  );
}

/* A rep count is a number, not a shortlist: four buttons could not hold every
   count worth training to, so this one is typed. The arrows are still there
   for a one-rep nudge, which is what most changes here are. */
export function NumberField({ value, min, max, onChange, aria, accent = PUSH_C }) {
  /* keep whatever is being typed while the field has focus, so a half-typed
     number is not parsed back into the box mid-keystroke */
  const [text, setText] = useState(null);
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const btn = {
    width: 40,
    height: 40,
    padding: 0,
    fontSize: 22,
    lineHeight: 1,
    flexShrink: 0,
    background: CARD,
    color: TEXT,
    border: `1px solid ${RULE}`,
    borderRadius: 8,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <Btn aria={`One rep fewer for ${aria}`} onClick={() => onChange(clamp(value - 1))} style={btn}>
        &minus;
      </Btn>
      <input
        value={text === null ? String(value) : text}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
          setText(t);
          const n = parseInt(t, 10);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setText(null)}
        inputMode="numeric"
        aria-label={`Reps that move ${aria} up`}
        style={{
          width: 52,
          textAlign: "center",
          fontFamily: DISPLAY,
          fontSize: 20,
          letterSpacing: "-0.02em",
          color: TEXT,
          background: CARD,
          border: `1px solid ${accent}`,
          borderRadius: 8,
          padding: "8px 0",
          outline: "none",
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 800, color: MUTE }}>reps</span>
      <Btn aria={`One rep more for ${aria}`} onClick={() => onChange(clamp(value + 1))} style={btn}>
        +
      </Btn>
    </div>
  );
}

export function ChoiceRow({ label, choices, value, onPick, aria, suffix, accent = PUSH_C }) {
  return (
    <SettingRow label={label}>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {choices.map((n) => {
          const on = value === n;
          return (
            <Btn
              key={n}
              plain
              aria={aria(n)}
              onClick={() => onPick(n)}
              style={{
                padding: "7px 10px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 8,
                background: on ? accent : CARD,
                color: on ? ON_ACCENT : MUTE,
                border: `1px solid ${on ? accent : RULE}`,
              }}
            >
              {n}
              {suffix || ""}
            </Btn>
          );
        })}
      </div>
    </SettingRow>
  );
}

export function ExerciseRules({ name, rules, showSets, setChoices, minTop, onChange, accent }) {
  const low = name.toLowerCase();
  return (
    <div
      style={{
        background: WASH,
        borderRadius: 10,
        padding: "10px 12px 6px",
        margin: "0 0 6px",
        border: `1px solid ${RULE}`,
      }}
    >
      {showSets && (
        <ChoiceRow
          label="Sets"
          choices={setChoices}
          value={rules.sets}
          accent={accent}
          onPick={(n) => onChange({ sets: n })}
          aria={(n) => `${n} sets of ${low}`}
        />
      )}
      <SettingRow label="Weight up at">
        <NumberField
          value={rules.top}
          min={minTop}
          max={50}
          accent={accent}
          aria={low}
          onChange={(n) => onChange({ top: n })}
        />
      </SettingRow>
      <ChoiceRow
        label="Hold each target"
        choices={HOLDS}
        value={rules.hold}
        accent={accent}
        onPick={(n) => onChange({ hold: n })}
        aria={(n) => `Hold ${low} for ${n} sessions`}
      />
      <div style={{ fontSize: 13, color: MUTE, lineHeight: 1.35, paddingBottom: 4 }}>
        {rules.hold === 1
          ? `A rep every session, and at ${rules.top} reps the weight goes up.`
          : `${rules.hold} sessions at each target, then a rep. At ${rules.top} reps the weight goes up.`}
      </div>
    </div>
  );
}

/* the little control that opens the panel, on the row itself */
export function RulesButton({ open, onClick, name, accent = PUSH_C }) {
  return (
    <Btn
      plain
      aria={`${open ? "Hide" : "Show"} rules for ${name.toLowerCase()}`}
      onClick={onClick}
      style={{
        width: 66,
        flexShrink: 0,
        padding: 0,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        background: open ? accent : CARD,
        color: open ? ON_ACCENT : TEXT,
        border: `1px solid ${open ? accent : RULE}`,
      }}
    >
      Rules
    </Btn>
  );
}
