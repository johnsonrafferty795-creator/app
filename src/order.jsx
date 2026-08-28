import { Btn } from "./ui";
import { CARD, DISPLAY, MUTE, ON_ACCENT, RULE, TEXT, WASH } from "./tokens";

/* ---- running order ----
 * A session is built in library order, which is not the order anyone trains
 * in. Both apps let that order be set on Today and keep it per day type.
 */

/* Apply a saved order to the exercises a day actually holds.
 *
 * Names come first, in the order they were left in. Anything the order does
 * not name falls back to the position of its muscle group, so a day that
 * rotates which exercise it picks - his dad's full-body days - keeps the legs
 * slot where legs was put, whichever leg movement comes up. Anything left over
 * keeps its place at the end in library order. */
export function inOrder(items, names, groupOf) {
  if (!names || !names.length) return items;
  const rank = new Map();
  const groupRank = new Map();
  /* the group has to be resolved by name, not by looking through the session:
     the whole point is the exercise the order names may not be in it today */
  names.forEach((n, i) => {
    if (!rank.has(n)) rank.set(n, i);
    const g = groupOf ? groupOf(n) : (items.find((x) => x.name === n) || {}).group;
    if (g && !groupRank.has(g)) groupRank.set(g, i);
  });
  const rankOf = (it) => {
    if (rank.has(it.name)) return rank.get(it.name);
    if (groupRank.has(it.group)) return groupRank.get(it.group);
    return Infinity;
  };
  return [...items]
    .map((it, i) => ({ it, i, r: rankOf(it) }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r - b.r))
    .map((x) => x.it);
}

/* The list itself: up and down beside each exercise. Swapping neighbours
   rather than dragging, which on a phone drops things half the time. */
export function OrderPanel({
  items,
  groupNames,
  accent,
  note,
  hasOrder,
  onMove,
  onReset,
  onDone,
}) {
  return (
    <div style={{ marginTop: 10 }}>
      {items.map((it, i) => (
        <div
          key={it.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            background: WASH,
            borderRadius: 10,
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: 18,
              color: MUTE,
              width: 20,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </span>
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{it.name}</span>
            <span style={{ fontSize: 13, color: MUTE, display: "block" }}>
              {groupNames[it.group]}
            </span>
          </span>
          <Btn
            aria={`Move ${it.name} up`}
            onClick={() => onMove(i, -1)}
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              fontSize: 20,
              background: CARD,
              color: i === 0 ? MUTE : TEXT,
              border: `1px solid ${RULE}`,
            }}
          >
            ↑
          </Btn>
          <Btn
            aria={`Move ${it.name} down`}
            onClick={() => onMove(i, 1)}
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              fontSize: 20,
              background: CARD,
              color: i === items.length - 1 ? MUTE : TEXT,
              border: `1px solid ${RULE}`,
            }}
          >
            ↓
          </Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <Btn
          onClick={onDone}
          style={{
            flex: 1,
            padding: "13px 0",
            fontSize: 17,
            background: accent,
            color: ON_ACCENT,
          }}
        >
          Done
        </Btn>
        {hasOrder && (
          <Btn
            onClick={onReset}
            style={{
              flexShrink: 0,
              padding: "13px 14px",
              fontSize: 15,
              background: CARD,
              color: TEXT,
              border: `1px solid ${RULE}`,
            }}
          >
            Reset
          </Btn>
        )}
      </div>
      <div style={{ fontSize: 14, color: MUTE, marginTop: 8, lineHeight: 1.35 }}>
        {note}
      </div>
    </div>
  );
}
