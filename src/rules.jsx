import { HOLDS, REP_TOPS } from "./lifts";
import { Btn } from "./ui";
import { CARD, MUTE, ON_ACCENT, PUSH_C, RULE, TEXT, WASH } from "./tokens";

/* ---- per-exercise rules ----
 * Sets, the rep count that moves the weight, and how many sessions a target is
 * held for. These sit on the exercise rather than the muscle group: a heavy
 * compound and a cable movement share a muscle and nothing else about how they
 * progress. The kilo step stays with the group, since that is a property of
 * the plates and the stack rather than the movement.
 */

export function ChoiceRow({ label, choices, value, onPick, aria, suffix, accent = PUSH_C }) {
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
    </div>
  );
}

export function ExerciseRules({ name, rules, showSets, setChoices, onChange, accent }) {
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
      <ChoiceRow
        label="Weight up at"
        choices={REP_TOPS}
        value={rules.top}
        accent={accent}
        onPick={(n) => onChange({ top: n })}
        aria={(n) => `Move ${low} up at ${n} reps`}
        suffix=" reps"
      />
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
