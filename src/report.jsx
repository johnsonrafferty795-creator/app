import { dayNum, shiftDay, shortDate } from "./dates";
import { bestOf } from "./lifts";
import { Btn, SectionLabel } from "./ui";
import {
  BG,
  BODY,
  DISPLAY,
  GOOD,
  INK,
  MUTE,
  RAISED,
  REST_C,
  RULE,
  TEXT,
  WASH,
  WIN,
  ON_ACCENT,
} from "./tokens";

/* a report block: four weeks */
export const BLOCK = 28;

/* ---- four-week blocks ----
 * Blocks run from the first day with any data, 28 days at a time. A block is
 * summarised the moment it closes and written to ppl-reports, so old numbers
 * stay put even once the rolling per-exercise history has scrolled past them.
 */
const dataDates = (days, lifts, weights) => {
  const seen = new Set([...Object.keys(days || {}), ...Object.keys(weights || {})]);
  Object.values(lifts || {}).forEach((h) => h.forEach((e) => seen.add(e.d)));
  return [...seen].filter(Boolean).sort();
};

/* Sets are ranked for the report the same way the overload rule works: heavier
   wins, and at equal weight more reps wins. Ranking by volume (weight x reps)
   would read the intended 12-reps-then-add-weight jump as a step backwards. */
const cmpLift = (a, b) => (a.w !== b.w ? a.w - b.w : a.r - b.r);
const bestLift = (list) => list.reduce((a, b) => (cmpLift(b, a) > 0 ? b : a));

function summariseBlock(i, start, end, days, lifts, weights, t, habits) {
  const within = (d) => d >= start && d <= end;
  const dayList = Object.keys(days || {}).filter(within);
  const count = (k) => dayList.filter((d) => days[d][k]).length;

  const weighIns = Object.entries(weights || {})
    .filter(([d]) => within(d))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const moves = [];
  Object.entries(lifts || {}).forEach(([name, hist]) => {
    const here = hist.filter((e) => within(e.d));
    if (!here.length) return;
    const before = hist.filter((e) => e.d < start);
    /* measured against where the last block left off, or against the first set
       of this one if there is nothing earlier */
    const from = before.length ? bestLift(before) : here[0];
    const to = bestLift(here);
    const step = cmpLift(to, from);
    moves.push({
      name,
      from,
      to,
      dir: step > 0 ? "up" : step < 0 ? "down" : "flat",
      step,
      sets: here.length,
    });
  });
  moves.sort((a, b) => b.step - a.step);

  const elapsed = Math.min(BLOCK, Math.max(0, dayNum(t) - dayNum(start) + 1));

  return {
    i,
    start,
    end,
    elapsed,
    complete: end < t,
    counts: Object.fromEntries(habits.map((k) => [k, count(k)])),
    weightFrom: weighIns.length ? weighIns[0][1] : null,
    weightTo: weighIns.length ? weighIns[weighIns.length - 1][1] : null,
    weightChange:
      weighIns.length > 1
        ? +(weighIns[weighIns.length - 1][1] - weighIns[0][1]).toFixed(1)
        : null,
    up: moves.filter((m) => m.dir === "up"),
    stalled: moves.filter((m) => m.dir !== "up"),
  };
}

export function buildBlocks(days, lifts, weights, t, habits) {
  const dates = dataDates(days, lifts, weights);
  if (!dates.length) return [];
  const anchor = dates[0];
  const n = Math.floor((dayNum(t) - dayNum(anchor)) / BLOCK) + 1;
  return Array.from({ length: n }, (_, i) =>
    summariseBlock(
      i,
      shiftDay(anchor, i * BLOCK),
      shiftDay(anchor, i * BLOCK + BLOCK - 1),
      days,
      lifts,
      weights,
      t,
      habits
    )
  );
}

/* ---- the written overview ----
 * The tiles carry the numbers; this says what they add up to, in the order
 * anyone would say it out loud: how the training went, then eating and cardio,
 * then body weight, then what moved on the bar. Every clause is computed - a
 * block with nothing in it says so rather than inventing a good month. */
function overview(b, prev, metrics) {
  const lines = [];
  const head = metrics[0];
  const n = (b.counts[head.key] || 0);
  const word = (k, c) => (c === 1 ? k.one : k.many);

  if (!b.complete) {
    lines.push(
      `Day ${b.elapsed} of ${BLOCK}, so this one is still open. ${n} ${word(head, n)} down, ${head.target} the aim.`
    );
  } else if (n > head.target) {
    lines.push(
      `${n} ${word(head, n)} in four weeks — ${n - head.target} more than the ${head.target} the plan asks for.`
    );
  } else if (n === head.target) {
    lines.push(
      `${n} ${word(head, n)} in four weeks — exactly the ${head.target} the plan asks for.`
    );
  } else {
    const short = head.target - n;
    lines.push(
      `${n} ${word(head, n)} in four weeks, ${short} short of the ${head.target} this plan asks for.`
    );
  }

  if (prev) {
    const was = prev.counts[head.key] || 0;
    const d = n - was;
    lines.push(
      d === 0
        ? `Same as the four weeks before.`
        : `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} on the four weeks before.`
    );
  }

  const rest = metrics.slice(1);
  if (rest.length)
    lines.push(
      rest
        .map((m) => `${m.label.toLowerCase()} ${b.counts[m.key] || 0} of ${m.target}`)
        .join(", ")
        .replace(/^./, (c) => c.toUpperCase()) + "."
    );

  if (b.weightFrom == null) {
    lines.push("No weigh-ins in this stretch.");
  } else if (b.weightChange == null) {
    lines.push(`One weigh-in: ${b.weightFrom}kg.`);
  } else if (b.weightChange === 0) {
    lines.push(`Body weight held at ${b.weightFrom}kg.`);
  } else {
    lines.push(
      `Body weight ${b.weightFrom} → ${b.weightTo}kg, ${
        b.weightChange > 0 ? "up" : "down"
      } ${Math.abs(b.weightChange)}kg.`
    );
  }

  const moved = b.up.length;
  const total = moved + b.stalled.length;
  if (!total) {
    lines.push("No sets logged, so there is nothing to compare on the bar.");
  } else if (!moved) {
    lines.push(
      `Nothing beat its previous best — ${total} ${total === 1 ? "lift" : "lifts"} held or dropped.`
    );
  } else {
    const top = b.up[0];
    lines.push(
      `${moved} of ${total} ${total === 1 ? "lift" : "lifts"} moved up, the biggest being ${top.name}, ${top.from.w}kg × ${top.from.r} to ${top.to.w}kg × ${top.to.r}.` +
        (b.stalled.length
          ? ` ${b.stalled.length} stalled or dropped.`
          : " Nothing stalled.")
    );
  }

  return lines;
}

function BlockCard({ b, prev, metrics }) {
  const stat = (label, value, tgt) => (
    <div key={label} style={{ flex: 1, background: WASH, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, letterSpacing: "-0.02em" }}>
        {value}
        {tgt ? <span style={{ fontSize: 13, color: MUTE }}>/{tgt}</span> : null}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: MUTE,
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );

  const line = (m, up) => (
    <div
      key={m.name}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "11px 12px",
        background: WASH,
        marginBottom: 5,
        borderLeft: `3px solid ${up ? WIN : RULE}`,
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0 }}>{m.name}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 15, flexShrink: 0, letterSpacing: "-0.02em" }}>
        {m.from.w}×{m.from.r}
        <span style={{ color: MUTE }}> → </span>
        <span style={{ color: up ? GOOD : MUTE }}>
          {m.to.w}×{m.to.r}
        </span>
      </span>
    </div>
  );

  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          background: b.complete ? RAISED : REST_C,
          color: b.complete ? TEXT : ON_ACCENT,
          padding: "10px 12px",
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: "-0.02em" }}>
          Weeks {b.i * 4 + 1}&ndash;{b.i * 4 + 4}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
          {shortDate(b.start)} – {shortDate(b.end)}
          {b.complete ? "" : " · still running"}
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          padding: "12px 12px 13px",
          background: WASH,
          borderRadius: 12,
          fontSize: 15,
          lineHeight: 1.45,
        }}
      >
        <SectionLabel style={{ marginBottom: 5 }}>In short</SectionLabel>
        {overview(b, prev, metrics).join(" ")}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {metrics.map((m) => stat(m.label, b.counts[m.key] || 0, m.target))}
      </div>

      {(() => {
        /* Only a finished block can be judged against a full four weeks — part
           way through, "missed" would just be "not yet". */
        if (!b.complete)
          return (
            <div style={{ fontSize: 14, color: MUTE, marginTop: 8, fontWeight: 700 }}>
              Day {b.elapsed} of {BLOCK} — {BLOCK - b.elapsed} to go.
            </div>
          );
        const missed = metrics
          .map((m) => [Math.max(0, m.target - (b.counts[m.key] || 0)), m.many, m.one])
          .filter(([n]) => n > 0);
        return (
          <div
            style={{
              marginTop: 8,
              padding: "10px 12px",
              background: WASH,
              borderLeft: `3px solid ${missed.length ? REST_C : WIN}`,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {missed.length ? (
              <>
                <span style={{ color: MUTE }}>Missed: </span>
                {missed.map(([n, many, one], i) => (
                  <span key={many}>
                    {i ? " · " : ""}
                    {n} {n === 1 ? one : many}
                  </span>
                ))}
              </>
            ) : (
              "Hit every target — nothing missed."
            )}
          </div>
        );
      })()}

      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          background: WASH,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>
          Body weight
        </span>
        <span style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: "-0.02em" }}>
          {b.weightFrom == null ? (
            <span style={{ color: MUTE }}>—</span>
          ) : (
            <>
              {b.weightFrom}
              <span style={{ color: MUTE }}> → </span>
              {b.weightTo}kg
              {b.weightChange != null && (
                <span style={{ color: b.weightChange > 0 ? MUTE : GOOD, marginLeft: 6 }}>
                  {b.weightChange > 0 ? "+" : ""}
                  {b.weightChange}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {b.up.length + b.stalled.length === 0 ? (
        <div style={{ fontSize: 15, color: MUTE, marginTop: 16, lineHeight: 1.4 }}>
          No sets logged in these four weeks yet.
        </div>
      ) : (
        <>
          <SectionLabel style={{ margin: "16px 0 8px" }}>
            Moved up &middot; {b.up.length}
          </SectionLabel>
          {b.up.length ? (
            b.up.map((m) => line(m, true))
          ) : (
            <div style={{ fontSize: 15, color: MUTE }}>Nothing beat its previous best.</div>
          )}

          <SectionLabel style={{ margin: "16px 0 8px" }}>
            Stalled or dropped &middot; {b.stalled.length}
          </SectionLabel>
          {b.stalled.length ? (
            b.stalled.map((m) => line(m, false))
          ) : (
            <div style={{ fontSize: 15, color: MUTE }}>
              Nothing stalled — every lift went up.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ReportScreen({ blocks, metrics, onBack }) {
  return (
    <div
      className="pad-nav"
      style={{ fontFamily: BODY, color: TEXT, background: BG, minHeight: "100vh" }}
    >
      <div style={{ background: INK, color: TEXT, padding: "14px 16px 16px" }}>
        <Btn
          plain
          onClick={onBack}
          style={{
            background: "transparent",
            color: TEXT,
            border: `2px solid ${RULE}`,
            fontSize: 13,
            padding: "5px 10px",
            marginBottom: 10,
          }}
        >
          ← Back
        </Btn>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 30,
            textTransform: "uppercase",
            letterSpacing: "-0.035em",
          }}
        >
          Four-week report
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, opacity: 0.9 }}>
          Newest first. Each block is measured against the one before it.
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {[...blocks].reverse().map((b) => (
          <BlockCard key={b.i} b={b} prev={blocks[b.i - 1]} metrics={metrics} />
        ))}
      </div>
    </div>
  );
}

