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

function WeightCard({ todayKg, lastKg, onSave }) {
  const seed = todayKg != null ? todayKg : lastKg != null ? lastKg : "";
  const [txt, setTxt] = useState(String(seed));
  const num = parseFloat(txt);
  const valid = !isNaN(num) && num > 0 && num < 500;
  const bump = (d) => {
    const base = valid ? num : lastKg != null ? lastKg : 80;
    setTxt(String(+(base + d).toFixed(1)));
  };
  const btn = {
    width: 62,
    height: 62,
    fontSize: 26,
    background: CARD,
    border: `1px solid ${MUTE}`,
    color: TEXT,
    lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div className="orn" style={{ border: `1px solid ${RULE}`, borderRadius: 14, padding: "12px 12px 14px", marginTop: 12 }}>
      <SectionLabel style={{ marginBottom: 8 }}>
        {todayKg != null ? "Today — logged" : "Today's weigh-in"}
      </SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Btn aria="Decrease weight" onClick={() => bump(-0.1)} style={btn}>
          &minus;
        </Btn>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "center" }}>
          <input
            value={txt}
            onChange={(e) => setTxt(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            aria-label="Weight in kilograms"
            placeholder="—"
            style={{
              width: 132,
              maxWidth: "100%",
              minWidth: 0,
              border: "none",
              outline: "none",
              textAlign: "right",
              fontFamily: DISPLAY,
              fontSize: 40,
              letterSpacing: "-0.03em",
              color: TEXT,
              background: "transparent",
              padding: 0,
            }}
          />
          <span style={{ fontFamily: DISPLAY, fontSize: 20, color: MUTE, marginLeft: 3 }}>
            kg
          </span>
        </div>
        <Btn aria="Increase weight" onClick={() => bump(0.1)} style={btn}>
          +
        </Btn>
      </div>
      <Btn
        onClick={() => valid && onSave(+num.toFixed(1))}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "16px 0",
          fontSize: 19,
          background: valid ? PUSH_C : WASH,
          color: valid ? ON_ACCENT : MUTE,
        }}
      >
        {todayKg != null ? "Update today" : "Save weight"}
      </Btn>
      <div style={{ fontSize: 13, color: MUTE, marginTop: 8, lineHeight: 1.35 }}>
        Type it in, or nudge it 0.1 at a time. One a day is plenty — same time,
        same scale.
      </div>
    </div>
  );
}

/* The whole Body weight screen: hero, line, weigh-in, and the list underneath
   that keeps every value readable without the chart. Both trackers use it. */
export function WeightPanel({ weights, onSave }) {
  const [picked, setPicked] = useState(null);
  const t = today();

  const wPoints = Object.entries(weights || {})
    .map(([d, kg]) => ({ d, kg }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const latest = wPoints[wPoints.length - 1];
  /* compare against the last weigh-in a month or more back, or the first one */
  const monthAgo = shiftDay(t, -30);
  const prior = wPoints.filter((p) => p.d <= monthAgo);
  const ref = prior.length ? prior[prior.length - 1] : wPoints[0];
  const change =
    latest && ref && ref !== latest ? +(latest.kg - ref.kg).toFixed(1) : null;

  return (
<div>
          <div style={{ background: INK, color: TEXT, padding: "16px" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
              }}
            >
              Body weight
            </div>
          </div>

          <div style={{ padding: "14px 16px 0" }}>
            {latest ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 52, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {latest.kg}
                  <span style={{ fontSize: 22, color: MUTE }}>kg</span>
                </div>
                {change != null && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: MUTE }}>
                    {change > 0 ? "+" : ""}
                    {change}kg since {shortDate(ref.d)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 17, color: MUTE, lineHeight: 1.4 }}>
                No weigh-ins yet. Put today&rsquo;s number in and the graph starts
                from there.
              </div>
            )}

            {wPoints.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <SectionLabel style={{ marginBottom: 4 }}>
                  {wPoints.length > 1 ? "Every weigh-in" : "First weigh-in"}
                </SectionLabel>
                <TrendChart
                  points={wPoints.map((p) => ({ d: p.d, v: p.kg }))}
                  unit="kg"
                  color={PUSH_C}
                  label="Body weight over time"
                  selected={picked}
                  onSelect={setPicked}
                />
                <div style={{ fontSize: 14, fontWeight: 700, color: MUTE, minHeight: 20 }}>
                  {picked != null
                    ? `${shortDate(wPoints[picked].d)} · ${wPoints[picked].kg}kg`
                    : wPoints.length > 1
                    ? "Tap the line to read a day."
                    : ""}
                </div>
              </div>
            )}

            <WeightCard
              todayKg={weights && weights[t] != null ? weights[t] : null}
              lastKg={latest ? latest.kg : null}
              onSave={onSave}
            />

            {wPoints.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Recent</SectionLabel>
                {wPoints
                  .slice(-8)
                  .reverse()
                  .map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const diff = prev ? +(p.kg - prev.kg).toFixed(1) : null;
                    return (
                      <div
                        key={p.d}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "11px 12px",
                          background: WASH,
                          borderRadius: 10,
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 800, color: MUTE }}>
                          {shortDate(p.d)}
                        </span>
                        <span
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: 19,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {p.kg}kg
                          {diff != null && (
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
