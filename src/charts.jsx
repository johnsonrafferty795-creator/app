import { shortDate, dayNum } from "./dates";
import {
  BG,
  CHART,
  CHART_OK,
  FIGURES,
  GRID,
  MUTE,
  RULE,
  TEXT,
} from "./tokens";

/* whole numbers where the series is whole, one decimal where it is not */
const fmtTick = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* One series, so no legend — the heading names it. Solid hairline grid, a 2px
   line, and every value also readable in the list underneath, so the chart is
   never the only way to get a number. */
export function TrendChart({ points, unit, color, label, selected, onSelect }) {
  const W = 320;
  const H = 210;
  const L = 36;
  const R = 310;
  const T = 14;
  const B = 168;

  const lo = Math.min(...points.map((p) => p.v));
  const hi = Math.max(...points.map((p) => p.v));
  const pad = hi - lo < 1 ? 1 : (hi - lo) * 0.15;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const t0 = dayNum(points[0].d);
  const span = Math.max(1, dayNum(points[points.length - 1].d) - t0);

  const x = (p) => (points.length === 1 ? (L + R) / 2 : L + ((dayNum(p.d) - t0) / span) * (R - L));
  const y = (kg) => B - ((kg - yMin) / (yMax - yMin)) * (B - T);

  const ticks = [yMax, (yMax + yMin) / 2, yMin];
  const path = points.map((p) => `${x(p)},${y(p.v)}`).join(" ");
  const showDots = points.length <= 24;
  const lastP = points[points.length - 1];
  const sel = selected != null ? points[selected] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", touchAction: "manipulation" }}
      role="img"
      aria-label={`${label}, ${points.length} points, latest ${lastP.v}${unit}`}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} style={{ stroke: GRID }} strokeWidth="1" />
          <text
            x={L - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fontFamily={FIGURES}
            style={{ fill: MUTE, fontVariantNumeric: "tabular-nums" }}
          >
            {fmtTick(t)}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {showDots &&
        points.map((p, i) => (
          <circle
            key={p.d}
            cx={x(p)}
            cy={y(p.v)}
            r={i === points.length - 1 ? 5 : 4}
            style={{ fill: color, stroke: BG }}
            strokeWidth="2"
          />
        ))}

      {!showDots && (
        <circle cx={x(lastP)} cy={y(lastP.v)} r="5" style={{ fill: color, stroke: BG }} strokeWidth="2" />
      )}

      {sel && (
        <g>
          <line x1={x(sel)} x2={x(sel)} y1={T} y2={B} style={{ stroke: MUTE }} strokeWidth="1" />
          <circle cx={x(sel)} cy={y(sel.v)} r="6" style={{ fill: TEXT, stroke: BG }} strokeWidth="2" />
        </g>
      )}

      <line x1={L} x2={R} y1={B} y2={B} style={{ stroke: RULE }} strokeWidth="1" />

      <text x={L} y={B + 18} fontSize="11" fontWeight="700" style={{ fill: MUTE }} fontFamily={FIGURES}>
        {shortDate(points[0].d)}
      </text>
      {points.length > 1 && (
        <text
          x={R}
          y={B + 18}
          textAnchor="end"
          fontSize="11"
          fontWeight="700"
          style={{ fill: MUTE }}
          fontFamily={FIGURES}
        >
          {shortDate(lastP.d)}
        </text>
      )}

      {/* tap targets — full plot height, so a point never has to be hit dead-on */}
      {points.map((p, i) => {
        const w = points.length === 1 ? R - L : (R - L) / points.length;
        return (
          <rect
            key={`hit-${p.d}`}
            x={Math.max(L, x(p) - w / 2)}
            y={T}
            width={Math.max(24, w)}
            height={B - T}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(selected === i ? null : i)}
          />
        );
      })}
    </svg>
  );
}

/* Sessions per week. Counts over ordered buckets, so bars rather than a line;
   the running week is outlined instead of filled, since it is not done yet. */
export function WeekBars({ weeks, target }) {
  const W = 320;
  const H = 132;
  const L = 26;
  const R = 312;
  const T = 20;
  const B = 112;
  const top = Math.max(target, ...weeks.map((w) => w.n), 1);
  const y = (v) => B - (v / top) * (B - T);
  const slot = (R - L) / weeks.length;
  const barW = Math.min(18, slot - 12);

  return (
    <>
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Sessions a week for the last ${weeks.length} weeks`}
    >
      {[top, target].map((v, i) => (
        <g key={i}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} style={{ stroke: i ? RULE : GRID }} strokeWidth="1" />
          <text
            x={L - 5}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="10"
            fontWeight="800"
            style={{ fill: MUTE }}
            fontFamily={FIGURES}
          >
            {v}
          </text>
        </g>
      ))}

      {weeks.map((w, i) => {
        const cx = L + slot * i + slot / 2;
        const h = Math.max(0, B - y(w.n));
        return (
          <g key={w.label}>
            {w.n > 0 && (
              <rect
                x={cx - barW / 2}
                y={y(w.n)}
                width={barW}
                height={h}
                rx="4"
                style={{
                  fill: w.running ? "none" : w.n >= target ? CHART_OK : CHART,
                  stroke: w.running ? CHART : "none",
                }}
                strokeWidth="2"
              />
            )}
            <text
              x={cx}
              y={B + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              style={{ fill: MUTE }}
              fontFamily={FIGURES}
            >
              {w.label}
            </text>
            {i === weeks.length - 1 && w.n > 0 && (
              <text
                x={cx}
                y={y(w.n) - 6}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                style={{ fill: TEXT }}
                fontFamily={FIGURES}
              >
                {w.n}
              </text>
            )}
          </g>
        );
      })}

      <line x1={L} x2={R} y1={B} y2={B} style={{ stroke: RULE }} strokeWidth="1" />
    </svg>
    <div style={{ fontSize: 12, color: MUTE, marginTop: 2, lineHeight: 1.35 }}>
      Reaching the line clears the week&rsquo;s target of {target}. This week is
      still open.
    </div>
    </>
  );
}
