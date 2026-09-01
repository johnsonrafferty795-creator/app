/* Reading a set history. Shared by both trackers; the progression rule that
   picks the next target is not, since the rep ranges differ. */

export const bestOf = (history) => {
  if (!history || !history.length) return null;
  return history.reduce((a, b) => (b.w * b.r >= a.w * a.r ? b : a));
};

/* one row per day: the best set of that session */
export const bestPerDay = (hist) => {
  const byDate = {};
  (hist || []).forEach((s) => {
    const cur = byDate[s.d];
    if (!cur || s.w * s.r > cur.w * cur.r) byDate[s.d] = s;
  });
  return Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([d, s]) => ({ ...s, d }));
};

/* ---- the progression rule ----
 * Shared by both trackers now that they run the same one; only the bottom of
 * the rep range differs.
 *
 * Reps move up every third session at the same weight and reps, not every
 * session: three goes at 60kg x 8 before 60kg x 9 is asked for. Once a set
 * reaches the top of the range the weight goes up by the muscle group's step
 * and the reps drop back to the bottom.
 */
export const HOLD_SESSIONS = 3;

/* The working set is the heaviest one lifted, and the most reps at that
   weight - not the biggest weight x reps. After a weight jump the volume of
   the old lighter set is still the larger number, and counting sessions
   against that would hold the target on a weight already left behind. */
export const topSet = (hist) =>
  (hist || []).reduce(
    (a, b) => (!a || b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a),
    null
  );

/* how many sessions have already met this weight and rep count */
export const sessionsAt = (hist, w, r) =>
  new Set((hist || []).filter((s) => s.w === w && s.r >= r).map((s) => s.d)).size;

export function overloadTarget(hist, { step, low, top }) {
  const best = topSet(hist);
  if (!best) return null;
  if (best.r >= top)
    return {
      w: +(best.w + step).toFixed(2),
      r: low,
      best,
      sessions: 0,
      weightUp: true,
      repUp: false,
    };
  const sessions = sessionsAt(hist, best.w, best.r);
  const repUp = sessions >= HOLD_SESSIONS;
  return {
    w: best.w,
    r: repUp ? best.r + 1 : best.r,
    best,
    sessions,
    weightUp: false,
    repUp,
  };
}

/* the line under the target that says where in the three this session sits */
export function overloadNote(tgt, top) {
  if (!tgt) return "";
  if (tgt.weightUp)
    return `${tgt.best.r} reps last time — the weight goes up and the reps start again.`;
  if (tgt.repUp)
    return `${HOLD_SESSIONS} sessions at ${tgt.best.w}kg × ${tgt.best.r} — one more rep today.`;
  return `Session ${tgt.sessions + 1} of ${HOLD_SESSIONS} at ${tgt.best.w}kg × ${tgt.best.r}. The reps go up after the third${tgt.best.r + 1 > top ? ", and at " + top + " the weight does" : ""}.`;
}
