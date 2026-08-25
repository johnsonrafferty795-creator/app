import { useState } from "react";

import {
  BODY,
  CARD,
  DISPLAY,
  MUTE,
  TEXT,
} from "./tokens";

export function Btn({ children, onClick, style, aria, plain }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      style={{
        border: "none",
        borderRadius: 12,
        cursor: "pointer",
        /* blackletter is unreadable at control sizes, so small buttons opt out */
        fontFamily: plain ? BODY : DISPLAY,
        letterSpacing: plain ? "0.02em" : "-0.02em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Stepper({ label, value, unit, onChange, step, min }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const btn = {
    width: 56,
    height: 56,
    fontSize: 30,
    background: CARD,
    border: `1px solid ${MUTE}`,
    color: TEXT,
    lineHeight: 1,
    flexShrink: 0,
  };
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: MUTE,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Btn
          aria={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          style={btn}
        >
          &minus;
        </Btn>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
          }}
        >
          {/* tap the number to type it, for the jumps the buttons would take
              all day to walk up */}
          <input
            value={editing ? text : String(value)}
            onFocus={(e) => {
              setEditing(true);
              setText(String(value));
              e.target.select();
            }}
            onChange={(e) => {
              const t = e.target.value.replace(/[^0-9.]/g, "");
              setText(t);
              const n = parseFloat(t);
              if (!isNaN(n) && n >= min && n < 1000) onChange(+n.toFixed(1));
            }}
            onBlur={() => setEditing(false)}
            inputMode="decimal"
            aria-label={label}
            style={{
              width: unit ? "62%" : "100%",
              minWidth: 0,
              border: "none",
              outline: "none",
              textAlign: unit ? "right" : "center",
              fontFamily: DISPLAY,
              fontSize: 30,
              letterSpacing: "-0.03em",
              color: TEXT,
              background: "transparent",
              padding: 0,
            }}
          />
          {unit && <span style={{ fontSize: 15 }}>{unit}</span>}
        </div>
        <Btn
          aria={`Increase ${label}`}
          onClick={() => onChange(+(value + step).toFixed(1))}
          style={btn}
        >
          +
        </Btn>
      </div>
    </div>
  );
}

export function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: MUTE,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

