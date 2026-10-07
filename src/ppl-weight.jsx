import { useState } from "react";

import { shiftDay, shortDate, today } from "./dates";
import { TrendChart } from "./charts";
import { Btn, SectionLabel } from "./ui";
import {
  CARD,
  DISPLAY,
  INK,
  MUTE,
  ON_ACCENT,
  PUSH_C,
  RULE,
  TEXT,
  WASH,
} from "./tokens";

/* ---- body weight, this app's version ----
 * The original tracker keeps the panel in weight.jsx; this one is centred and
 * stripped to the two figures that matter, which is where the two apps have
 * ended up differing rather than a thing worth threading a flag through.
 */
export function WeightScreen({ weights, onSave }) {
  const t = today();
  const points = Object.entries(weights || {})
    .map(([d, kg]) => ({ d, kg }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const latest = points[points.length - 1];

  const [picked, setPicked] = useState(null);
  const [kg, setKg] = useState(() =>
    String(weights && weights[t] != null ? weights[t] : latest ? latest.kg : 70)
  );

  /* against the last weigh-in a month or more back, or the first one */
  const monthAgo = shiftDay(t, -30);
  const prior = points.filter((p) => p.d <= monthAgo);
  const ref = prior.length ? prior[prior.length - 1] : points[0];
  const change =
    latest && ref && ref !== latest ? +(latest.kg - ref.kg).toFixed(1) : null;

  const num = parseFloat(kg);
  const valid = !isNaN(num) && num > 0 && num < 500;
  const bump = (d) => setKg(String(+((valid ? num : 70) + d).toFixed(1)));
  const key = {
    width: 52, height: 52, padding: 0, fontSize: 24, lineHeight: 1, flexShrink: 0,
    background: CARD, border: `1px solid ${RULE}`, color: TEXT,
  };

  return (
    <div>
      <div className="cut" style={{ background: INK, padding: "16px 16px 26px" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, lineHeight: 1,
          textTransform: "uppercase", letterSpacing: "-0.02em", textAlign: "center" }}>
          Body weight
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: MUTE, marginTop: 8,
          textAlign: "center" }}>
          {latest ? (
            <>
              {latest.kg}kg
              {change != null ? `  ${change > 0 ? "+" : ""}${change}` : ""}
            </>
          ) : (
            "Nothing weighed yet"
          )}
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {points.length > 0 && (
          <div>
            <TrendChart
              points={points.map((p) => ({ d: p.d, v: p.kg }))}
              unit="kg"
              color={PUSH_C}
              label="Body weight over time"
              selected={picked}
              onSelect={setPicked}
            />
            <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20,
              textAlign: "center" }}>
              {picked != null
                ? `${shortDate(points[picked].d)} · ${points[picked].kg}kg`
                : ""}
            </div>
          </div>
        )}

        <div className="orn" style={{ border: `1px solid ${RULE}`, borderRadius: 14,
          padding: "14px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12 }}>
            <Btn aria="Less weight" onClick={() => bump(-0.1)} style={key}>&minus;</Btn>
            <input
              value={kg}
              onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              aria-label="Weight in kilograms"
              style={{ width: 120, minWidth: 0, border: "none", outline: "none",
                textAlign: "center", fontFamily: DISPLAY, fontSize: 40, fontWeight: 700,
                letterSpacing: "-0.02em", color: TEXT, background: "transparent", padding: 0 }}
            />
            <Btn aria="More weight" onClick={() => bump(0.1)} style={key}>+</Btn>
          </div>
          <Btn
            onClick={() => valid && onSave(+num.toFixed(1))}
            style={{ width: "100%", marginTop: 12, padding: "16px 0", fontSize: 19,
              background: valid ? PUSH_C : WASH, color: valid ? ON_ACCENT : MUTE }}
          >
            Update
          </Btn>
        </div>

        {points.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SectionLabel style={{ marginBottom: 8, textAlign: "center" }}>Recent</SectionLabel>
            {points
              .slice(-10)
              .reverse()
              .map((p, i, arr) => {
                const prev = arr[i + 1];
                const diff = prev ? +(p.kg - prev.kg).toFixed(1) : null;
                return (
                  <div
                    key={p.d}
                    style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 10, padding: "11px 12px",
                      background: WASH, borderRadius: 10, marginBottom: 5 }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 800, color: MUTE }}>
                      {shortDate(p.d)}
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700,
                      letterSpacing: "-0.01em" }}>
                      {p.kg}kg
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
          </div>
        )}
      </div>
    </div>
  );
}
