import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadJSON, saveJSON } from "./storage";
import {
  buildBackup,
  checkBackup,
  readBackupFile,
  restoreBackup,
  saveBackup,
} from "./backup";
import {
  ACH_AT,
  BADGES,
  BADGE_BY_ID,
  BUILDINGS,
  BUILDING_BY_ID,
  BURNT_CHANCE,
  CRUMB_UPGRADES,
  GOLD_LIFE,
  TIER_AT,
  UPGRADES,
  UPGRADE_BY_ID,
  affordable,
  ascend,
  bakedForCrumbs,
  blankState,
  bulkPrice,
  contextOf,
  crumbsFrom,
  crumbsWaiting,
  effectOf,
  fmt,
  fmtTime,
  fmtWhole,
  nextGoldenAt,
  newBadges,
  offlineGain,
  offlineRules,
  priceOf,
  refundFor,
  reviveState,
  rollEffect,
  shopFor,
  stats,
} from "./biscuit-data";

/* ============================ the look ============================ */

/* Dark cocoa, cream type, one gold. Nothing like the other five apps on this
   domain — a game should not be mistaken for a training log at a glance.
 *
 * Contrast, against the ground: type 16.4:1, muted 8.3:1, faint 5.4:1,
 * gold 10.0:1, green 9.9:1, red 7.7:1. Against a raised row, faint drops to
 * 4.2:1 — so FAINT is never used on RAISED, only MUTE. */
const GROUND = "#1A0F0A";
const PANEL = "#2A1A11";
const RAISED = "#3A2417";
const TYPE = "#F7EEDF";
const MUTE = "#C0A88F";
const FAINT = "#9C8570";
const GOLD = "#F0B429";
const DOUGH = "#D9A05B";
const CHIP = "#4A2C1A";
const GREEN = "#6BD08A";
const RED = "#F08A73";
const BURNT = "#7A3A28";
const EDGE = "rgba(247,238,223,0.12)";

const BODY = "'Helvetica Neue',Arial,Helvetica,sans-serif";

const KEY_STATE = "bs-game";
const KEY_PREFS = "bs-prefs";
const APP = "biscuit";
const KEYS = [KEY_STATE, KEY_PREFS];

/* Twenty ticks a second is smooth enough that the counter never looks like it
   is stepping, and cheap enough that a phone left open all day does not warm
   up. Every tick uses the real clock rather than counting ticks, so a
   backgrounded tab catches up instead of falling behind. */
const TICK_MS = 50;
/* localStorage is synchronous: writing it on every tick would be felt. */
const SAVE_MS = 10000;

const TABS = [
  { id: "bake", label: "Bake" },
  { id: "shop", label: "Shop" },
  { id: "badges", label: "Badges" },
  { id: "tin", label: "Tin" },
];

/* ============================ drawn things ============================ */

/* Every icon is drawn here rather than fetched: the app has to work with no
   signal on the first run, and 26 small marks are smaller than one sprite
   sheet. All of them sit in a 24×24 box and take their colour from the caller,
   through `style` rather than a presentation attribute. */
function Glyph({ id, size = 24, colour = TYPE }) {
  const s = { fill: colour };
  const line = { stroke: colour, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const thin = { stroke: colour, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" };

  const marks = {
    finger: (
      <>
        <rect x="9.5" y="4" width="5" height="12" rx="2.5" style={s} />
        <path d="M7 12h10v5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" style={s} />
      </>
    ),
    nan: (
      <>
        <circle cx="12" cy="7" r="3" style={s} />
        <circle cx="12" cy="13" r="5" style={s} />
        <circle cx="10" cy="12.5" r="1.6" style={{ fill: GROUND }} />
        <circle cx="14" cy="12.5" r="1.6" style={{ fill: GROUND }} />
        <path d="M6 20h12" style={line} />
      </>
    ),
    allotment: (
      <>
        <path d="M4 19h16" style={line} />
        <path d="M8 19c0-4 1.5-6 4-6M16 19c0-4-1.5-6-4-6M12 13V7" style={thin} />
        <ellipse cx="12" cy="6" rx="2.6" ry="3.4" style={s} />
      </>
    ),
    quarry: (
      <>
        <path d="M5 7c5-3 9-3 14 0" style={{ ...line, strokeWidth: 2.6 }} />
        <rect x="10.8" y="6" width="2.4" height="14" rx="1.2" style={s} />
      </>
    ),
    bakery: (
      <>
        <rect x="3" y="9" width="18" height="5" rx="2.5" style={s} />
        <circle cx="7" cy="18" r="2.4" style={s} />
        <circle cx="17" cy="18" r="2.4" style={s} />
        <circle cx="9" cy="5.5" r="2" style={s} />
        <circle cx="15" cy="5.5" r="2" style={s} />
      </>
    ),
    vault: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" style={line} />
        <circle cx="12" cy="12" r="4" style={line} />
        <path d="M12 8.5v-2M12 17.5v2M8 12H6M18 12h-2" style={thin} />
      </>
    ),
    chapel: (
      <>
        <path d="M12 2.5 20 9v11H4V9z" style={line} />
        <path d="M12 20v-6a2.5 2.5 0 0 1 5 0v6" style={{ ...thin, fill: colour, opacity: 0.5 }} />
        <path d="M12 5.5v3M10.5 7h3" style={thin} />
      </>
    ),
    shed: (
      <>
        <path d="M12 2.5 17.5 16h-11z" style={s} />
        <ellipse cx="12" cy="17.5" rx="8.5" ry="2.6" style={s} />
        <circle cx="12" cy="10" r="1.2" style={{ fill: GROUND }} />
      </>
    ),
    freighter: (
      <>
        <path d="M2.5 14h19l-2.5 6H5z" style={s} />
        <rect x="6" y="8" width="5" height="5" rx="1" style={s} />
        <rect x="13" y="5" width="5" height="8" rx="1" style={s} />
      </>
    ),
    lab: (
      <>
        <path d="M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3" style={line} />
        <path d="M8.5 3h7" style={line} />
        <circle cx="11" cy="16" r="1.3" style={s} />
        <circle cx="14" cy="18" r="1" style={s} />
      </>
    ),
    portal: (
      <>
        <ellipse cx="12" cy="12" rx="6" ry="9" style={line} />
        <ellipse cx="12" cy="12" rx="2.4" ry="4.4" style={s} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" style={line} />
        <path d="M12 7v5.4l3.4 2.2" style={line} />
      </>
    ),
    antimatter: (
      <>
        <circle cx="12" cy="12" r="3.2" style={s} />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" style={thin} />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" style={{ ...thin, transform: "rotate(60deg)", transformOrigin: "12px 12px" }} />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" style={{ ...thin, transform: "rotate(-60deg)", transformOrigin: "12px 12px" }} />
      </>
    ),
    prism: (
      <>
        <path d="M12 3.5 21 19H3z" style={line} />
        <path d="M2 12h6" style={thin} />
        <path d="M15 13h7M15.6 16h6.4M15.6 10h6.4" style={thin} />
      </>
    ),
    fate: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" style={line} />
        <circle cx="9" cy="9" r="1.6" style={s} />
        <circle cx="12" cy="12" r="1.6" style={s} />
        <circle cx="15" cy="15" r="1.6" style={s} />
      </>
    ),
    fractal: (
      <>
        <rect x="2.5" y="2.5" width="19" height="19" rx="3" style={thin} />
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" style={thin} />
        <rect x="10" y="10" width="4" height="4" rx="1" style={s} />
      </>
    ),
    console: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="3" style={line} />
        <path d="M7 10l2.5 2.5L7 15" style={line} />
        <path d="M12.5 15.5h4.5" style={line} />
      </>
    ),
    idleverse: (
      <>
        <circle cx="12" cy="12" r="5" style={s} />
        <ellipse cx="12" cy="12" rx="10" ry="3.6" style={{ ...thin, transform: "rotate(-24deg)", transformOrigin: "12px 12px" }} />
        <circle cx="20" cy="5" r="1.3" style={s} />
        <circle cx="4" cy="6.5" r="1" style={s} />
      </>
    ),
    tap: (
      <>
        <circle cx="12" cy="12" r="9" style={{ ...thin, opacity: 0.55 }} />
        <rect x="10" y="6.5" width="4" height="8" rx="2" style={s} />
        <path d="M8 11.5h8v4a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z" style={s} />
      </>
    ),
    tea: (
      <>
        <path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" style={s} />
        <path d="M16 11h1.8a2.6 2.6 0 0 1 0 5.2H16" style={thin} />
        <path d="M8 5.5c0 1 1 1.4 1 2.4M12 4.5c0 1 1 1.4 1 2.4" style={thin} />
      </>
    ),
    all: (
      <>
        <path d="M12 2.5l2.6 6.2 6.9.6-5.2 4.5 1.6 6.7L12 16.9l-5.9 3.6 1.6-6.7L2.5 9.3l6.9-.6z" style={s} />
      </>
    ),
    golden: (
      <>
        <circle cx="11" cy="13" r="8" style={s} />
        <circle cx="8.5" cy="11" r="1.3" style={{ fill: GROUND, opacity: 0.45 }} />
        <circle cx="13" cy="15" r="1.3" style={{ fill: GROUND, opacity: 0.45 }} />
        <path d="M19 2.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" style={s} />
      </>
    ),
    burnt: (
      <>
        <circle cx="12" cy="12" r="8.5" style={s} />
        <path d="M9 5.5l2.5 5-2 3 3 4.5" style={{ stroke: GROUND, strokeWidth: 1.8, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }} />
      </>
    ),
    biscuit: (
      <>
        <circle cx="12" cy="12" r="8.5" style={s} />
        <circle cx="9" cy="10" r="1.4" style={{ fill: GROUND, opacity: 0.5 }} />
        <circle cx="14.5" cy="13" r="1.4" style={{ fill: GROUND, opacity: 0.5 }} />
        <circle cx="10.5" cy="15.5" r="1" style={{ fill: GROUND, opacity: 0.5 }} />
      </>
    ),
    sleep: (
      <>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" style={s} />
        <path d="M14.5 3h4l-4 4.5h4" style={thin} />
      </>
    ),
    crumb: (
      <>
        <circle cx="8" cy="14" r="3.2" style={s} />
        <circle cx="15" cy="10" r="2.2" style={s} />
        <circle cx="16" cy="17" r="1.6" style={s} />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      {marks[id] || marks.biscuit}
    </svg>
  );
}

/* The biscuit itself. Chips and dock holes are fixed rather than random, so it
   is the same biscuit every time the app opens — it is meant to be a thing you
   recognise, not a thing that is regenerated. */
const CHIPS = [
  [-22, -30, 9], [24, -22, 11], [-38, 6, 8], [6, 2, 12], [40, 16, 9],
  [-16, 36, 10], [22, 44, 8], [-44, -20, 6], [2, -52, 7], [46, -6, 6],
];
const DOCKS = [[-6, -14], [16, 22], [-30, 22], [30, -40], [-2, 50]];

function BigBiscuit({ size = 240, gold = false, burnt = false }) {
  const face = burnt ? BURNT : gold ? GOLD : DOUGH;
  const rim = burnt ? "#5A2418" : gold ? "#C88A12" : "#B37E3E";
  const chip = burnt ? "#2A0F08" : gold ? "#8A5A06" : CHIP;

  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block", overflow: "visible" }}>
      <circle cx="0" cy="4" r="92" style={{ fill: "rgba(0,0,0,0.35)" }} />
      <circle cx="0" cy="0" r="92" style={{ fill: rim }} />
      <circle cx="0" cy="-3" r="86" style={{ fill: face }} />
      {/* the light comes from the top left, as it does on everything else */}
      <circle cx="-26" cy="-32" r="46" style={{ fill: "#FFFFFF", opacity: 0.09 }} />
      {DOCKS.map(([x, y], i) => (
        <circle key={`d${i}`} cx={x} cy={y} r="3.4" style={{ fill: rim, opacity: 0.55 }} />
      ))}
      {CHIPS.map(([x, y, r], i) => (
        <g key={`c${i}`}>
          <circle cx={x} cy={y + 1.5} r={r} style={{ fill: "#000000", opacity: 0.22 }} />
          <circle cx={x} cy={y} r={r} style={{ fill: chip }} />
          <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.3} style={{ fill: "#FFFFFF", opacity: 0.16 }} />
        </g>
      ))}
      {gold ? (
        <>
          <path d="M62 -62l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" style={{ fill: "#FFF3D0" }} />
          <path d="M-70 34l3.4 8.6 8.6 3.4-8.6 3.4-3.4 8.6-3.4-8.6-8.6-3.4 8.6-3.4z" style={{ fill: "#FFF3D0", opacity: 0.85 }} />
        </>
      ) : null}
    </svg>
  );
}

/* ============================ small pieces ============================ */

const panel = {
  background: PANEL,
  border: `1px solid ${EDGE}`,
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
};

const heading = {
  margin: "0 0 12px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: FAINT,
};

const plainButton = {
  font: "inherit",
  padding: "11px 15px",
  fontSize: 15,
  fontWeight: 700,
  border: `1px solid ${EDGE}`,
  borderRadius: 12,
  background: "transparent",
  color: TYPE,
  cursor: "pointer",
};

/* A count of things over a target, drawn as a bar. Every one of these is
   written out in words underneath as well, so the bar is never the only way to
   read the number. */
function Meter({ value, total, colour = GOLD, height = 8 }) {
  const share = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div style={{ height, borderRadius: height / 2, background: "rgba(247,238,223,0.1)", overflow: "hidden" }}>
      <div style={{ width: `${share * 100}%`, height: "100%", background: colour, borderRadius: height / 2, transition: "width 200ms linear" }} />
    </div>
  );
}

/* The running total, and the rate. This is the one thing on screen that is
   always true, so it sits above everything and never scrolls away. */
function Counter({ biscuits, cps, notation, buffed }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0 8px" }}>
      <p
        style={{
          margin: 0,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: -0.8,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
          color: TYPE,
        }}
      >
        {fmt(Math.floor(biscuits), notation)}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 13.5, color: MUTE, letterSpacing: 0.2 }}>
        biscuits
        <span style={{ color: FAINT }}> · </span>
        <span style={{ color: buffed ? GOLD : MUTE, fontWeight: buffed ? 800 : 400 }}>
          {fmt(cps, notation)} a second
        </span>
      </p>
    </div>
  );
}

/* What a golden biscuit is currently doing to you, and for how long. The bar
   is the clock — there is no number to read while a frenzy is running. */
function Buffs({ buffs, now }) {
  const live = buffs.filter((b) => b.until > now);
  if (!live.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 0 8px" }}>
      {live.map((b) => {
        const left = (b.until - now) / 1000;
        const bad = b.mult < 1;
        const colour = bad ? RED : GOLD;
        return (
          <div
            key={b.id + b.until}
            className="shimmer"
            style={{
              background: RAISED,
              border: `1px solid ${colour}`,
              borderRadius: 12,
              padding: "7px 12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: colour }}>{b.label}</span>
              <span style={{ fontSize: 13, color: MUTE, fontVariantNumeric: "tabular-nums" }}>{Math.ceil(left)}s</span>
            </div>
            <Meter value={left} total={b.span} colour={colour} height={5} />
          </div>
        );
      })}
    </div>
  );
}

/* ============================ baking ============================ */

function BakeView({ game, s, notation, onTap, floats }) {
  const perTap = s.click;
  const share = s.mods.clickShare;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", margin: "6px 0 4px" }}>
        <button
          type="button"
          onPointerDown={onTap}
          aria-label={`Bake a biscuit. Worth ${fmt(perTap, notation)}.`}
          style={{
            font: "inherit",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            display: "block",
            borderRadius: "50%",
          }}
        >
          <span key={game.clicks} className="press" style={{ display: "block" }}>
            <BigBiscuit size={248} />
          </span>
        </button>

        {floats.map((f) => (
          <span
            key={f.key}
            className="float"
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              pointerEvents: "none",
              fontSize: f.big ? 22 : 17,
              fontWeight: 800,
              color: f.big ? GOLD : TYPE,
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
            }}
          >
            +{fmt(f.value, notation)}
          </span>
        ))}
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 15, color: MUTE, textAlign: "center", lineHeight: 1.5 }}>
        <strong style={{ color: TYPE, fontWeight: 800 }}>{fmt(perTap, notation)}</strong> a tap
        {share > 0 ? (
          <>
            <br />
            <span style={{ fontSize: 13.5, color: FAINT }}>
              including {Math.round(share * 100)}% of what you make in a second
            </span>
          </>
        ) : null}
      </p>

      <div style={{ ...panel, width: "100%", marginTop: 18 }}>
        <p style={heading}>This run</p>
        <Line label="Baked" value={fmt(game.baked, notation)} />
        <Line label="By hand" value={fmt(game.handMade, notation)} />
        <Line label="Taps" value={fmtWhole(game.clicks)} />
        <Line label="Buildings" value={fmtWhole(s.buildings)} />
        <Line label="Running for" value={fmtTime((Date.now() - game.runStartedAt) / 1000)} last />
      </div>
    </div>
  );
}

/* One fact, said once: a label on the left, the number on the right. Used on
   every screen that is a list of numbers rather than a list of buttons. */
function Line({ label, value, note, colour = TYPE, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "9px 0",
        borderBottom: last ? "none" : `1px solid ${EDGE}`,
      }}
    >
      <span style={{ fontSize: 14.5, color: MUTE }}>
        {label}
        {note ? <span style={{ display: "block", fontSize: 12.5, color: FAINT, marginTop: 2 }}>{note}</span> : null}
      </span>
      <span style={{ fontSize: 15.5, fontWeight: 800, color: colour, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

/* ============================ the shop ============================ */

const BUY_MODES = [1, 10, 100, "max"];

/* A building joins the shop once a third of its price has been baked — near
   enough to be worth wanting, far enough off to still be a target. */
const SHOW_AT = 0.35;

/* Upgrades are shown as a grid of marks rather than a list of paragraphs:
   there are 141 of them and by the end most are unlocked at once. Tapping one
   opens what it does — which is the phone version of the tooltip this genre
   has always used. */
function UpgradeGrid({ shelf, biscuits, notation, onOpen }) {
  if (!shelf.length) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: FAINT, lineHeight: 1.5 }}>
        Nothing new on the shelf. Buy more buildings and it will fill up.
      </p>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))", gap: 8 }}>
      {shelf.map((u) => {
        const can = biscuits >= u.cost;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onOpen(u.id)}
            aria-label={`${u.name}, ${fmt(u.cost, notation)} biscuits`}
            style={{
              font: "inherit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "9px 3px 7px",
              border: `1px solid ${can ? GOLD : EDGE}`,
              borderRadius: 13,
              background: can ? "rgba(240,180,41,0.12)" : RAISED,
              color: TYPE,
              cursor: "pointer",
              opacity: can ? 1 : 0.55,
            }}
          >
            <Glyph id={u.icon} size={22} colour={can ? GOLD : MUTE} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: can ? GOLD : MUTE, fontVariantNumeric: "tabular-nums" }}>
              {fmt(u.cost, "short")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* A building's share of everything. Rounding a twentieth of a percent to "0%"
   tells you nothing, so anything under a tenth keeps a decimal. */
function pct(part, total) {
  if (!(total > 0) || !(part > 0)) return "0%";
  const share = (part / total) * 100;
  if (share < 0.1) return "under 0.1%";
  return `${share < 10 ? share.toFixed(1) : Math.round(share)}%`;
}

/* One building. The row is the button — tapping it buys whatever the buy mode
   says, which is the whole interaction. */
function BuildingRow({ building, owned, price, count, can, each, share, total, notation, selling, onBuy }) {
  const seen = owned > 0;
  const label = selling
    ? `Sell ${count} ${count === 1 ? building.name.toLowerCase() : building.plural} for ${fmt(price, notation)}`
    : `Buy ${count} ${count === 1 ? building.name.toLowerCase() : building.plural} for ${fmt(price, notation)}`;

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!can}
      aria-label={label}
      style={{
        font: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        marginBottom: 8,
        border: `1px solid ${can ? (selling ? RED : GOLD) : EDGE}`,
        borderRadius: 15,
        background: can ? RAISED : PANEL,
        color: TYPE,
        cursor: can ? "pointer" : "default",
        opacity: can ? 1 : 0.6,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          flex: "none",
          borderRadius: 13,
          background: "rgba(247,238,223,0.07)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Glyph id={building.id} size={24} colour={can ? (selling ? RED : GOLD) : MUTE} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {building.name}
          </span>
          {owned > 0 ? (
            <span style={{ fontSize: 14, fontWeight: 800, color: GOLD, fontVariantNumeric: "tabular-nums" }}>×{fmtWhole(owned)}</span>
          ) : null}
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: MUTE, marginTop: 2, lineHeight: 1.4 }}>
          {seen
            ? `${fmt(each, notation)} a second each · ${pct(share, total)} of everything`
            : building.note}
        </span>
      </span>

      <span style={{ textAlign: "right", flex: "none" }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: can ? (selling ? RED : GOLD) : MUTE, fontVariantNumeric: "tabular-nums" }}>
          {fmt(price, notation)}
        </span>
        {count !== 1 ? (
          <span style={{ display: "block", fontSize: 11.5, color: FAINT, marginTop: 1 }}>
            {selling ? "sell" : "buy"} {count}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ShopView({ game, s, notation, buy, selling, onMode, onSelling, onBuy, onOpenUpgrade }) {
  /* both are cheap, and this screen only redraws four times a second */
  const shelf = shopFor(game, contextOf(game, s));

  /* the next building that is not on the list yet — one that is already shown
     needs no announcing, its own row says everything */
  const shownUntil = (b) => (game.owned[b.id] || 0) > 0 || game.bakedAll >= b.cost * SHOW_AT;
  const next = BUILDINGS.find((b) => !shownUntil(b));

  return (
    <div>
      <div style={panel}>
        <p style={heading}>Upgrades · {shelf.length} on the shelf</p>
        <UpgradeGrid shelf={shelf} biscuits={game.biscuits} notation={notation} onOpen={onOpenUpgrade} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {BUY_MODES.map((mode) => {
          const on = !selling && buy === mode;
          return (
            <button
              key={String(mode)}
              type="button"
              onClick={() => onMode(mode)}
              style={{
                font: "inherit",
                flex: 1,
                padding: "10px 4px",
                border: `1px solid ${on ? GOLD : EDGE}`,
                borderRadius: 12,
                background: on ? GOLD : "transparent",
                color: on ? GROUND : MUTE,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {mode === "max" ? "Max" : `×${mode}`}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onSelling}
          aria-pressed={selling}
          style={{
            font: "inherit",
            flex: 1,
            padding: "10px 4px",
            border: `1px solid ${selling ? RED : EDGE}`,
            borderRadius: 12,
            background: selling ? RED : "transparent",
            color: selling ? GROUND : MUTE,
            fontSize: 14.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Sell
        </button>
      </div>

      {BUILDINGS.map((b) => {
        const owned = game.owned[b.id] || 0;
        /* nothing is shown until it is nearly affordable, so the shop grows
           with the run rather than being a wall of locked rows on day one */
        if (!shownUntil(b)) return null;

        let count;
        let price;
        let can;
        if (selling) {
          count = buy === "max" ? owned : Math.min(buy, owned);
          count = Math.max(count, 0);
          price = refundFor(b, owned, count);
          can = count > 0;
        } else {
          count = buy === "max" ? Math.max(1, affordable(b, owned, game.biscuits)) : buy;
          price = bulkPrice(b, owned, count);
          can = game.biscuits >= price;
        }

        return (
          <BuildingRow
            key={b.id}
            building={b}
            owned={owned}
            price={price}
            count={count}
            can={can}
            each={s.each[b.id] * s.factor}
            share={s.share[b.id]}
            total={s.cps}
            notation={notation}
            selling={selling}
            onBuy={() => onBuy(b.id, count, selling)}
          />
        );
      })}

      {next ? (
        <p style={{ margin: "6px 2px 0", fontSize: 13, color: FAINT, lineHeight: 1.5 }}>
          Something new shows up around {fmt(next.cost * SHOW_AT, notation)} baked.
        </p>
      ) : null}
    </div>
  );
}

/* ============================ badges ============================ */

const FILTERS = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "locked", label: "Locked" },
];

function BadgesView({ game, s, notation }) {
  const [filter, setFilter] = useState("all");
  const have = useMemo(() => new Set(game.badges), [game.badges]);
  const shown = BADGES.filter((b) =>
    filter === "earned" ? have.has(b.id) : filter === "locked" ? !have.has(b.id) : true
  );

  return (
    <div>
      <div style={panel}>
        <p style={heading}>Tea</p>
        <p style={{ margin: "0 0 12px", fontSize: 14.5, color: MUTE, lineHeight: 1.55 }}>
          Every badge earned is worth 1% more a second — but only once there is
          tea in the shop to brew it with.
        </p>
        <Line label="Badges" value={`${fmtWhole(s.badges)} of ${fmtWhole(BADGES.length)}`} />
        <Line label="Tea brewing" value={`${(s.tea * 100).toFixed(0)}%`} note={s.mods.teaFactors.length ? `${s.mods.teaFactors.length} of 6 teas bought` : "no tea bought yet"} />
        <Line
          label="Worth"
          value={`×${s.teaMult.toFixed(3)}`}
          colour={s.teaMult > 1 ? GOLD : MUTE}
          note={s.teaMult > 1 ? `${fmt(s.cps - s.cps / s.teaMult, notation)} a second of your rate` : "buy a tea to turn badges into biscuits"}
          last
        />
        <div style={{ marginTop: 12 }}>
          <Meter value={s.badges} total={BADGES.length} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={on}
              style={{
                font: "inherit",
                flex: 1,
                padding: "10px 4px",
                border: `1px solid ${on ? GOLD : EDGE}`,
                borderRadius: 12,
                background: on ? GOLD : "transparent",
                color: on ? GROUND : MUTE,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        {shown.map((b) => {
          const got = have.has(b.id);
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "11px 12px",
                border: `1px solid ${got ? GOLD : EDGE}`,
                borderRadius: 14,
                background: got ? "rgba(240,180,41,0.1)" : PANEL,
                opacity: got ? 1 : 0.7,
              }}
            >
              <Glyph id={b.icon} size={20} colour={got ? GOLD : FAINT} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: got ? TYPE : MUTE, lineHeight: 1.25 }}>
                  {b.name}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: got ? MUTE : FAINT, lineHeight: 1.35 }}>{b.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p style={{ margin: "4px 2px", fontSize: 14, color: FAINT }}>
          {filter === "earned" ? "None yet. Go and bake something." : "Every badge earned. Genuinely well done."}
        </p>
      ) : null}
    </div>
  );
}

/* ============================ the tin ============================ */

function Backup({ onRestored }) {
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const exportNow = async () => {
    const payload = buildBackup(APP, KEYS);
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await saveBackup(payload, `biscuit-${stamp}.json`);
    if (result === "shared" || result === "downloaded") setMessage("Backup saved.");
    else if (result === "cancelled") setMessage(null);
    else setMessage("That did not work here — try from the browser rather than the home-screen app.");
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
      if (!window.confirm("Replace this save with the backup? Everything baked on this phone will be lost.")) return;
      restoreBackup(payload, KEYS);
      onRestored();
      setMessage("Backup restored.");
    } catch (e) {
      setMessage(e.message || "That file could not be read.");
    }
  };

  return (
    <div style={panel}>
      <p style={heading}>Backup</p>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: MUTE, lineHeight: 1.55 }}>
        The save lives on this phone and nowhere else. Clearing the browser's
        site data wipes it.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={plainButton} onClick={exportNow}>
          Save a backup
        </button>
        <button type="button" style={plainButton} onClick={() => fileInput.current.click()}>
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
      {message ? <p style={{ margin: "12px 0 0", fontSize: 14, color: TYPE }}>{message}</p> : null}
    </div>
  );
}

function TinView({ game, s, notation, prefs, onPrefs, onAscend, onBuyCrumb, onRestored, onWipe }) {
  const waiting = crumbsWaiting(game);
  const level = crumbsFrom(game.bakedAll);
  const nextAt = bakedForCrumbs(level + 1);
  const prevAt = bakedForCrumbs(level);
  const { cap, rate } = offlineRules(s.crumbUpgrades);

  const toggle = (key, label, note, value) => (
    <button
      type="button"
      onClick={() => onPrefs({ [key]: value })}
      aria-pressed={prefs[key] === value}
      style={{
        font: "inherit",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "12px 0",
        border: "none",
        borderBottom: `1px solid ${EDGE}`,
        background: "transparent",
        color: TYPE,
        cursor: "pointer",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12.5, color: FAINT, marginTop: 2 }}>{note}</span>
      </span>
      <span
        style={{
          flex: "none",
          width: 52,
          height: 30,
          borderRadius: 15,
          background: prefs[key] === value ? GOLD : "rgba(247,238,223,0.14)",
          position: "relative",
          transition: "background 150ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: prefs[key] === value ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: prefs[key] === value ? GROUND : TYPE,
            transition: "left 150ms",
          }}
        />
      </span>
    </button>
  );

  return (
    <div>
      <div style={panel}>
        <p style={heading}>Crumbs</p>
        <p style={{ margin: "0 0 12px", fontSize: 14.5, color: MUTE, lineHeight: 1.55 }}>
          Tipping the tin throws this run away and keeps the crumbs. Every crumb
          ever earned makes everything {(s.perCrumb * 100).toFixed(1)}% faster,
          for good — spending them never slows you down.
        </p>
        <Line label="Crumbs to spend" value={fmtWhole(game.crumbs)} colour={GOLD} />
        <Line label="Crumbs earned" value={fmtWhole(game.crumbsAll)} note={`everything runs ×${s.prestige.toFixed(3)}`} />
        <Line label="Waiting for you" value={fmtWhole(waiting)} colour={waiting > 0 ? GREEN : MUTE} note={waiting > 0 ? "banked when you tip the tin" : `${fmt(nextAt - game.bakedAll, notation)} more baked for the next one`} last />
        <div style={{ margin: "12px 0 14px" }}>
          <Meter value={game.bakedAll - prevAt} total={Math.max(1, nextAt - prevAt)} colour={waiting > 0 ? GREEN : GOLD} />
        </div>
        <button
          type="button"
          onClick={onAscend}
          disabled={waiting < 1}
          style={{
            font: "inherit",
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: 14,
            background: waiting >= 1 ? GOLD : "rgba(247,238,223,0.08)",
            color: waiting >= 1 ? GROUND : FAINT,
            fontSize: 16,
            fontWeight: 800,
            cursor: waiting >= 1 ? "pointer" : "default",
          }}
        >
          {waiting >= 1 ? `Tip the tin for ${fmtWhole(waiting)} ${waiting === 1 ? "crumb" : "crumbs"}` : "Nothing to tip out yet"}
        </button>
      </div>

      <div style={panel}>
        <p style={heading}>Spend crumbs</p>
        {CRUMB_UPGRADES.map((u) => {
          const got = s.crumbUpgrades.has(u.id);
          const can = !got && game.crumbs >= u.cost;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => can && onBuyCrumb(u.id)}
              disabled={!can}
              style={{
                font: "inherit",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                width: "100%",
                textAlign: "left",
                padding: "12px 0",
                border: "none",
                borderBottom: `1px solid ${EDGE}`,
                background: "transparent",
                color: TYPE,
                cursor: can ? "pointer" : "default",
                opacity: got ? 1 : can ? 1 : 0.55,
              }}
            >
              <Glyph id="crumb" size={20} colour={got ? GREEN : can ? GOLD : FAINT} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: got ? GREEN : TYPE }}>{u.name}</span>
                <span style={{ display: "block", fontSize: 13, color: MUTE, marginTop: 3, lineHeight: 1.45 }}>{u.note}</span>
              </span>
              <span style={{ flex: "none", fontSize: 14, fontWeight: 800, color: got ? GREEN : can ? GOLD : FAINT, fontVariantNumeric: "tabular-nums" }}>
                {got ? "owned" : fmtWhole(u.cost)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={panel}>
        <p style={heading}>All time</p>
        <Line label="Baked, ever" value={fmt(game.bakedAll, notation)} />
        <Line label="Baked this run" value={fmt(game.baked, notation)} />
        <Line label="By hand" value={fmt(game.handMade, notation)} note={`${fmtWhole(game.clicks)} taps`} />
        <Line label="A second" value={fmt(s.cps, notation)} colour={s.cpsBuff !== 1 ? GOLD : TYPE} note={s.cpsBuff !== 1 ? `×${s.cpsBuff.toFixed(2)} from a golden biscuit` : null} />
        <Line label="A tap" value={fmt(s.click, notation)} />
        <Line label="Buildings" value={fmtWhole(s.buildings)} note={`${fmtWhole(s.distinct)} of ${BUILDINGS.length} kinds`} />
        <Line label="Upgrades" value={`${fmtWhole(game.upgrades.length)} of ${fmtWhole(UPGRADES.length)}`} />
        <Line label="Badges" value={`${fmtWhole(s.badges)} of ${fmtWhole(BADGES.length)}`} />
        <Line label="Golden biscuits" value={fmtWhole(game.goldens)} note={game.burnt > 0 ? `and ${fmtWhole(game.burnt)} burnt ones` : null} />
        <Line label="Tins tipped" value={fmtWhole(game.ascensions)} />
        <Line label="This run" value={fmtTime((Date.now() - game.runStartedAt) / 1000)} />
        <Line label="Playing since" value={new Date(game.startedAt).toLocaleDateString("en-GB")} last />
      </div>

      <div style={panel}>
        <p style={heading}>While it is shut</p>
        <p style={{ margin: 0, fontSize: 14.5, color: MUTE, lineHeight: 1.55 }}>
          Time away earns {Math.round(rate * 100)}% of your rate, for up to{" "}
          {fmtTime(cap)}. Both go up with crumbs.
        </p>
      </div>

      <div style={panel}>
        <p style={heading}>Settings</p>
        {toggle("notation", "Short numbers", "1.24M rather than 1.24 million", "short")}
        {toggle("floats", "Numbers off the biscuit", "the +1s that fly up when you tap", true)}
        <p style={{ margin: "14px 0 0", fontSize: 13, color: FAINT, lineHeight: 1.5 }}>
          Each building has {TIER_AT.length} upgrades, unlocked at {TIER_AT.join(", ")} owned, and{" "}
          {ACH_AT.length} badges, at {ACH_AT.join(", ")}.
        </p>
      </div>

      <Backup onRestored={onRestored} />

      <div style={{ ...panel, borderColor: "rgba(240,138,115,0.35)" }}>
        <p style={{ ...heading, color: RED }}>Start over</p>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: MUTE, lineHeight: 1.55 }}>
          Throws away everything — the run, the crumbs, the badges, the lot. Not
          the same as tipping the tin, and there is no way back.
        </p>
        <button type="button" style={{ ...plainButton, borderColor: RED, color: RED }} onClick={onWipe}>
          Wipe the save
        </button>
      </div>

      <p style={{ margin: "4px 2px 8px", fontSize: 13, color: FAINT, textAlign: "center", lineHeight: 1.5 }}>
        Bertie's biscuits. Built for the one phone they live on.
      </p>
    </div>
  );
}

/* ============================ sheets ============================ */

/* Everything that interrupts comes up from the bottom, where a thumb is. */
function Sheet({ title, children, onClose }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,6,4,0.72)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        className="sheet safe-bar"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          background: PANEL,
          borderTop: `1px solid ${EDGE}`,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px 12px",
          maxHeight: "86dvh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function UpgradeSheet({ upgrade, biscuits, notation, onBuy, onClose }) {
  const can = biscuits >= upgrade.cost;
  const short = upgrade.cost - biscuits;
  return (
    <Sheet title={upgrade.name} onClose={onClose}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ width: 52, height: 52, flex: "none", borderRadius: 16, background: "rgba(240,180,41,0.14)", display: "grid", placeItems: "center" }}>
          <Glyph id={upgrade.icon} size={28} colour={GOLD} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>{upgrade.name}</h2>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: MUTE, lineHeight: 1.5 }}>{upgrade.note}</p>
        </div>
      </div>

      <Line label="Costs" value={fmt(upgrade.cost, notation)} colour={can ? GREEN : RED} note={can ? null : `${fmt(short, notation)} short`} last />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => onBuy(upgrade.id)}
          disabled={!can}
          style={{
            font: "inherit",
            flex: 2,
            padding: "14px",
            border: "none",
            borderRadius: 14,
            background: can ? GOLD : "rgba(247,238,223,0.08)",
            color: can ? GROUND : FAINT,
            fontSize: 16,
            fontWeight: 800,
            cursor: can ? "pointer" : "default",
          }}
        >
          Buy
        </button>
        <button type="button" onClick={onClose} style={{ ...plainButton, flex: 1, padding: "14px" }}>
          Close
        </button>
      </div>
    </Sheet>
  );
}

function AscendSheet({ game, waiting, notation, onConfirm, onClose }) {
  return (
    <Sheet title="Tip the tin" onClose={onClose}>
      <h2 style={{ margin: "0 0 8px", fontSize: 23, fontWeight: 800, letterSpacing: -0.4 }}>Tip the tin?</h2>
      <p style={{ margin: "0 0 14px", fontSize: 15, color: MUTE, lineHeight: 1.6 }}>
        Everything in this run goes: {fmt(game.biscuits, notation)} biscuits, every
        building, every upgrade. You keep your badges, your crumbs, and
        everything the crumbs have bought.
      </p>
      <Line label="Crumbs banked" value={`+${fmtWhole(waiting)}`} colour={GREEN} />
      <Line label="Crumbs after" value={fmtWhole(game.crumbsAll + waiting)} note="everything runs faster, for good" last />
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{ font: "inherit", flex: 2, padding: "14px", border: "none", borderRadius: 14, background: GOLD, color: GROUND, fontSize: 16, fontWeight: 800, cursor: "pointer" }}
        >
          Tip it out
        </button>
        <button type="button" onClick={onClose} style={{ ...plainButton, flex: 1, padding: "14px" }}>
          Not yet
        </button>
      </div>
    </Sheet>
  );
}

function AwaySheet({ away, notation, onClose }) {
  return (
    <Sheet title="While you were away" onClose={onClose}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <Glyph id="sleep" size={30} colour={GOLD} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>While you were away</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 16, color: MUTE, lineHeight: 1.6 }}>
        The oven kept going for {fmtTime(away.seconds)} at {Math.round(away.rate * 100)}% of your rate.
      </p>
      <p style={{ margin: "0 0 6px", fontSize: 34, fontWeight: 800, color: GOLD, letterSpacing: -0.8 }}>
        +{fmt(away.gain, notation)}
      </p>
      {away.capped ? (
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: FAINT, lineHeight: 1.5 }}>
          You were gone longer than that — time away only counts for {fmtTime(away.cap)}. Crumbs buy more.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        style={{ font: "inherit", width: "100%", marginTop: 18, padding: "14px", border: "none", borderRadius: 14, background: GOLD, color: GROUND, fontSize: 16, fontWeight: 800, cursor: "pointer" }}
      >
        Back to it
      </button>
    </Sheet>
  );
}

/* ============================ golden biscuits ============================ */

/* They float over everything, including the shop — the whole point is that one
   turns up while you are reading something else. */
function GoldenLayer({ goldens, onTap }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none" }}>
      {goldens.map((g) => (
        <button
          key={g.key}
          type="button"
          className="golden"
          onPointerDown={(e) => {
            e.preventDefault();
            onTap(g);
          }}
          aria-label={g.burnt ? "A burnt biscuit. Best left alone." : "A golden biscuit"}
          style={{
            position: "absolute",
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: g.size,
            height: g.size,
            padding: 0,
            border: "none",
            borderRadius: "50%",
            background: "transparent",
            cursor: "pointer",
            pointerEvents: "auto",
            filter: g.burnt ? "drop-shadow(0 0 10px rgba(122,58,40,0.8))" : "drop-shadow(0 0 14px rgba(240,180,41,0.65))",
          }}
        >
          <BigBiscuit size={g.size} gold={!g.burnt} burnt={g.burnt} />
        </button>
      ))}
    </div>
  );
}

/* ============================ toasts ============================ */

function Toasts({ items, top }) {
  if (!items.length) return null;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, top, zIndex: 55, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none", padding: "0 12px" }}>
      {items.map((t) => (
        <div
          key={t.key}
          className="pop"
          style={{
            maxWidth: 420,
            background: t.bad ? "rgba(122,58,40,0.96)" : "rgba(58,36,23,0.96)",
            border: `1px solid ${t.bad ? RED : GOLD}`,
            borderRadius: 14,
            padding: "9px 14px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <Glyph id={t.icon} size={18} colour={t.bad ? RED : GOLD} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: t.bad ? RED : GOLD }}>{t.title}</span>
            {t.note ? <span style={{ display: "block", fontSize: 12.5, color: MUTE, marginTop: 1, lineHeight: 1.35 }}>{t.note}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================ the game ============================ */

export default function BiscuitApp() {
  /* The save is held in a ref and changed in place rather than replaced.
     A clicker ticks twenty times a second and the state is deep enough that
     copying it that often would be felt on the phone this is built for; the
     two counters below are what actually asks React to draw. `fast` runs the
     header and the biscuit, `slow` runs the shop and the badge wall, which do
     not need twenty frames a second to be right. */
  const gameRef = useRef(null);
  if (gameRef.current === null) gameRef.current = reviveState(loadJSON(KEY_STATE, null));

  const [, setFast] = useState(0);
  const [slow, setSlow] = useState(0);
  const [view, setView] = useState("bake");
  const [prefs, setPrefs] = useState(() => ({ notation: "words", floats: true, buy: 1, ...loadJSON(KEY_PREFS, {}) }));
  const [selling, setSelling] = useState(false);
  const [goldens, setGoldens] = useState([]);
  const [floats, setFloats] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [sheet, setSheet] = useState(null);

  /* the header grows when a golden biscuit is running; the toasts sit under
     whatever height it currently is, rather than on top of the total */
  const headRef = useRef(null);
  const [headH, setHeadH] = useState(96);

  const lastTick = useRef(Date.now());
  const stormUntil = useRef(0);
  const nextStorm = useRef(0);
  const badgeGate = useRef(0);
  const started = useRef(false);
  const keys = useRef(1);
  const nextKey = () => (keys.current += 1);

  const bump = useCallback(() => {
    setFast((n) => n + 1);
    setSlow((n) => n + 1);
  }, []);

  const toast = useCallback((t) => {
    const key = nextKey();
    setToasts((list) => [...list.slice(-2), { key, ...t }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.key !== key)), 4200);
  }, []);

  /* ---------------- golden biscuits ---------------- */

  const spawnGolden = useCallback((storm, mods) => {
    const now = Date.now();
    const burnt = !storm && Math.random() < BURNT_CHANCE;
    setGoldens((list) =>
      [
        ...list,
        {
          key: nextKey(),
          /* kept off the sticky header and the tab bar, and off the very edges,
             so one never lands somewhere a thumb cannot reach */
          x: 8 + Math.random() * 70,
          y: 18 + Math.random() * 54,
          size: storm ? 52 : 76,
          burnt,
          storm,
          until: now + (storm ? 3000 : GOLD_LIFE * 1000 * mods.goldStay),
        },
      ].slice(-16)
    );
  }, []);

  const tapGolden = useCallback(
    (gold) => {
      const now = Date.now();
      const g = gameRef.current;
      const s = stats(g, now);
      setGoldens((list) => list.filter((x) => x.key !== gold.key));

      /* the ones that rain during a storm are small and simply pay out —
         rolling a fresh effect twenty times in seven seconds would be silly */
      if (gold.storm) {
        const gain = Math.min(g.biscuits * 0.05, s.cps * 60) + 13;
        g.biscuits += gain;
        g.baked += gain;
        g.bakedAll += gain;
        g.goldens += 1;
        bump();
        return;
      }

      const e = effectOf(rollEffect(gold.burnt), g, s, now);
      if (gold.burnt) g.burnt += 1;
      else g.goldens += 1;

      if (typeof e.gain === "number" && e.gain !== 0) {
        g.biscuits = Math.max(0, g.biscuits + e.gain);
        if (e.gain > 0) {
          g.baked += e.gain;
          g.bakedAll += e.gain;
        }
      }
      if (e.buff) {
        /* the same effect landing twice refreshes it rather than stacking */
        const buff = { ...e.buff, label: e.name, span: Math.max(1, (e.buff.until - now) / 1000) };
        g.buffs = [...g.buffs.filter((b) => b.id !== buff.id), buff];
      }
      if (e.storm) {
        stormUntil.current = e.storm;
        nextStorm.current = 0;
      }
      toast({ title: e.name, note: e.blurb, icon: gold.burnt ? "burnt" : "golden", bad: !!e.bad });
      bump();
    },
    [bump, toast]
  );

  /* ---------------- the tick ---------------- */

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const g = gameRef.current;
      /* the real clock, not a count of ticks: a backgrounded tab is throttled
         to about once a second and must catch up, not fall behind. The clamp
         is for a phone that slept — that time is handled as time away. */
      const dt = Math.min(Math.max(0, (now - lastTick.current) / 1000), 60);
      lastTick.current = now;

      const s = stats(g, now);
      if (dt > 0 && s.cps > 0) {
        const gain = s.cps * dt;
        g.biscuits += gain;
        g.baked += gain;
        g.bakedAll += gain;
      }
      if (g.buffs.length && g.buffs.some((b) => b.until <= now)) {
        g.buffs = g.buffs.filter((b) => b.until > now);
      }

      /* badges five times a second rather than twenty — a hundred-odd
         comparisons is cheap, but not cheap enough to do for no reason */
      badgeGate.current += 1;
      if (badgeGate.current >= 4) {
        badgeGate.current = 0;
        const won = newBadges(g, contextOf(g, s));
        if (won.length) {
          g.badges = [...g.badges, ...won];
          won.slice(0, 2).forEach((bid) => {
            const b = BADGE_BY_ID[bid];
            if (b) toast({ title: b.name, note: `Badge earned · ${b.note}`, icon: b.icon });
          });
        }
      }

      if (!g.nextGolden) g.nextGolden = nextGoldenAt(now, s.mods);
      if (now >= g.nextGolden) {
        spawnGolden(false, s.mods);
        g.nextGolden = nextGoldenAt(now, s.mods);
      }
      if (now < stormUntil.current && now >= nextStorm.current) {
        spawnGolden(true, s.mods);
        nextStorm.current = now + 340;
      }
      setGoldens((list) => (list.some((x) => x.until <= now) ? list.filter((x) => x.until > now) : list));

      setFast((n) => n + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [spawnGolden, toast]);

  useEffect(() => {
    const el = headRef.current;
    if (!el) return undefined;
    const measure = () => setHeadH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* the shop and the badge wall redraw four times a second, which is often
     enough that a row turns gold the moment it can be afforded */
  useEffect(() => {
    const id = window.setInterval(() => setSlow((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  /* ---------------- saving ---------------- */

  const save = useCallback(() => {
    const g = gameRef.current;
    g.lastSeen = Date.now();
    saveJSON(KEY_STATE, g);
  }, []);

  useEffect(() => {
    const id = window.setInterval(save, SAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [save]);

  /* ---------------- time away ---------------- */

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const g = gameRef.current;
    const elapsed = (Date.now() - g.lastSeen) / 1000;
    lastTick.current = Date.now();
    /* under a minute is a reload, not a night away */
    if (elapsed > 60) {
      const s = stats(g);
      const away = offlineGain(g, s, elapsed);
      if (away.gain > 0) {
        g.biscuits += away.gain;
        g.baked += away.gain;
        g.bakedAll += away.gain;
        g.offlineEarned += away.gain;
        setSheet({ kind: "away", away });
      }
    }
    g.lastSeen = Date.now();
  }, []);

  /* ---------------- buying ---------------- */

  const tapBiscuit = useCallback(
    (event) => {
      const now = Date.now();
      const g = gameRef.current;
      const s = stats(g, now);
      const value = s.click;
      g.biscuits += value;
      g.baked += value;
      g.bakedAll += value;
      g.handMade += value;
      g.clicks += 1;

      if (prefs.floats) {
        const box = event.currentTarget.getBoundingClientRect();
        const x = Number.isFinite(event.clientX) ? event.clientX - box.left : box.width / 2;
        const y = Number.isFinite(event.clientY) ? event.clientY - box.top : box.height / 2;
        const key = nextKey();
        setFloats((list) => [...list.slice(-14), { key, x, y, value, big: s.clickBuff > 1 }]);
        window.setTimeout(() => setFloats((list) => list.filter((f) => f.key !== key)), 950);
      }
      setFast((n) => n + 1);
    },
    [prefs.floats]
  );

  const buyBuilding = useCallback(
    (id, count, isSelling) => {
      const g = gameRef.current;
      const b = BUILDING_BY_ID[id];
      const owned = g.owned[id] || 0;
      if (isSelling) {
        const n = Math.min(count, owned);
        if (n <= 0) return;
        g.biscuits += refundFor(b, owned, n);
        if (owned - n > 0) g.owned[id] = owned - n;
        else delete g.owned[id];
      } else {
        if (count <= 0) return;
        const price = bulkPrice(b, owned, count);
        if (g.biscuits < price) return;
        g.biscuits -= price;
        g.owned[id] = owned + count;
      }
      bump();
    },
    [bump]
  );

  const buyUpgrade = useCallback(
    (id) => {
      const g = gameRef.current;
      const u = UPGRADE_BY_ID[id];
      if (!u || g.upgrades.includes(id) || g.biscuits < u.cost) return;
      g.biscuits -= u.cost;
      g.upgrades = [...g.upgrades, id];
      setSheet(null);
      bump();
    },
    [bump]
  );

  const buyCrumb = useCallback(
    (id) => {
      const g = gameRef.current;
      const u = CRUMB_UPGRADES.find((c) => c.id === id);
      if (!u || g.crumbUpgrades.includes(id) || g.crumbs < u.cost) return;
      g.crumbs -= u.cost;
      g.crumbUpgrades = [...g.crumbUpgrades, id];
      toast({ title: u.name, note: u.note, icon: "crumb" });
      bump();
    },
    [bump, toast]
  );

  /* ---------------- starting again ---------------- */

  const doAscend = useCallback(() => {
    const g = gameRef.current;
    const won = crumbsWaiting(g);
    gameRef.current = ascend(g);
    lastTick.current = Date.now();
    stormUntil.current = 0;
    setGoldens([]);
    setSheet(null);
    setView("bake");
    saveJSON(KEY_STATE, gameRef.current);
    toast({ title: `${fmtWhole(won)} ${won === 1 ? "crumb" : "crumbs"} banked`, note: "Everything runs faster from here.", icon: "crumb" });
    bump();
  }, [bump, toast]);

  const reload = useCallback(() => {
    gameRef.current = reviveState(loadJSON(KEY_STATE, null));
    setPrefs({ notation: "words", floats: true, buy: 1, ...loadJSON(KEY_PREFS, {}) });
    lastTick.current = Date.now();
    setGoldens([]);
    bump();
  }, [bump]);

  const wipe = useCallback(() => {
    if (!window.confirm("Wipe the save? Every biscuit, crumb and badge goes, and none of it comes back.")) return;
    if (!window.confirm("Really? There is no undo.")) return;
    gameRef.current = blankState();
    lastTick.current = Date.now();
    setGoldens([]);
    setView("bake");
    saveJSON(KEY_STATE, gameRef.current);
    bump();
  }, [bump]);

  const setBuyMode = useCallback((mode) => {
    setSelling(false);
    setPrefs((p) => {
      const next = { ...p, buy: mode };
      saveJSON(KEY_PREFS, next);
      return next;
    });
  }, []);

  /* the settings rows are toggles: pressing the one that is already on puts it
     back to the default rather than doing nothing */
  const updatePrefs = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p };
      Object.keys(patch).forEach((k) => {
        next[k] = p[k] === patch[k] ? (k === "notation" ? "words" : false) : patch[k];
      });
      saveJSON(KEY_PREFS, next);
      return next;
    });
  }, []);

  /* ---------------- drawing ---------------- */

  const game = gameRef.current;
  const now = Date.now();
  const s = stats(game, now);
  const notation = prefs.notation === "short" ? "short" : "words";

  /* everything but the bake screen is rebuilt on the slow beat: the element is
     the same object between beats, so React skips the whole subtree */
  const heavy = useMemo(() => {
    if (view === "bake") return null;
    const g = gameRef.current;
    const st = stats(g);
    if (view === "shop") {
      return (
        <ShopView
          game={g}
          s={st}
          notation={notation}
          buy={prefs.buy}
          selling={selling}
          onMode={setBuyMode}
          onSelling={() => setSelling((was) => !was)}
          onBuy={buyBuilding}
          onOpenUpgrade={(id) => setSheet({ kind: "upgrade", id })}
        />
      );
    }
    if (view === "badges") return <BadgesView game={g} s={st} notation={notation} />;
    return (
      <TinView
        game={g}
        s={st}
        notation={notation}
        prefs={prefs}
        onPrefs={updatePrefs}
        onAscend={() => setSheet({ kind: "ascend" })}
        onBuyCrumb={buyCrumb}
        onRestored={reload}
        onWipe={wipe}
      />
    );
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [view, slow, notation, prefs, selling, setBuyMode, buyBuilding, buyCrumb, updatePrefs, reload, wipe]);

  /* a dot on a tab when there is something worth going there for */
  const dots = useMemo(() => {
    const g = gameRef.current;
    const st = stats(g);
    const shelf = shopFor(g, contextOf(g, st));
    const canBuild = BUILDINGS.some((b) => g.biscuits >= priceOf(b, g.owned[b.id] || 0));
    return {
      shop: shelf.some((u) => g.biscuits >= u.cost) || canBuild,
      tin: crumbsWaiting(g) >= 1 || CRUMB_UPGRADES.some((u) => !g.crumbUpgrades.includes(u.id) && g.crumbs >= u.cost),
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slow]);

  const upgradeOpen = sheet && sheet.kind === "upgrade" ? UPGRADE_BY_ID[sheet.id] : null;

  return (
    <div style={{ minHeight: "100dvh", fontFamily: BODY, color: TYPE }}>
      <h1 className="sr-only">Bertie's Biscuits</h1>

      <div
        ref={headRef}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(26,15,10,0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${EDGE}`,
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <Counter biscuits={game.biscuits} cps={s.cps} notation={notation} buffed={s.cpsBuff !== 1} />
          <Buffs buffs={game.buffs} now={now} />
        </div>
      </div>

      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "14px 16px 0",
          paddingBottom: `calc(${view === "bake" ? 96 : 166}px + env(safe-area-inset-bottom))`,
        }}
      >
        {view === "bake" ? (
          <BakeView game={game} s={s} notation={notation} onTap={tapBiscuit} floats={floats} />
        ) : (
          heavy
        )}
      </div>

      <div
        className="safe-nav"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 45,
          background: "rgba(26,15,10,0.95)",
          backdropFilter: "blur(8px)",
          borderTop: `1px solid ${EDGE}`,
        }}
      >
        {/* the biscuit follows you around: the shop is no good if you have to
            leave it to keep baking. A strip rather than a floating button,
            because a floating one sits on top of the very numbers — a price,
            a total — that you came to this screen to read. */}
        {view !== "bake" ? (
          <button
            type="button"
            onPointerDown={tapBiscuit}
            aria-label={`Bake a biscuit. Worth ${fmt(s.click, notation)}.`}
            style={{
              font: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "calc(100% - 20px)",
              maxWidth: 540,
              margin: "8px auto 0",
              padding: "5px 16px 5px 5px",
              border: `1px solid ${EDGE}`,
              borderRadius: 18,
              background: RAISED,
              color: TYPE,
              cursor: "pointer",
            }}
          >
            <span key={game.clicks} className="press" style={{ display: "block", flex: "none" }}>
              <BigBiscuit size={52} />
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: MUTE }}>
              Bake · <strong style={{ color: TYPE, fontWeight: 800 }}>{fmt(s.click, notation)}</strong> a tap
            </span>
          </button>
        ) : null}

        <nav style={{ display: "flex", gap: 6, padding: "8px 10px" }}>
        {TABS.map((tab) => {
          const on = view === tab.id;
          const dot = !on && dots[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              aria-current={on ? "page" : undefined}
              style={{
                font: "inherit",
                position: "relative",
                flex: 1,
                padding: "12px 4px",
                border: "none",
                borderRadius: 14,
                background: on ? GOLD : "transparent",
                color: on ? GROUND : MUTE,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.label}
              {dot ? (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: "50%",
                    marginRight: -26,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: GOLD,
                  }}
                />
              ) : null}
            </button>
          );
        })}
        </nav>
      </div>

      <GoldenLayer goldens={goldens} onTap={tapGolden} />
      <Toasts items={toasts} top={headH + 8} />

      {upgradeOpen ? (
        <UpgradeSheet
          upgrade={upgradeOpen}
          biscuits={game.biscuits}
          notation={notation}
          onBuy={buyUpgrade}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet && sheet.kind === "ascend" ? (
        <AscendSheet
          game={game}
          waiting={crumbsWaiting(game)}
          notation={notation}
          onConfirm={doAscend}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet && sheet.kind === "away" ? (
        <AwaySheet away={sheet.away} notation={notation} onClose={() => setSheet(null)} />
      ) : null}
    </div>
  );
}
