import { Btn } from "./ui";
import { CARD, MUTE, ON_ACCENT, RULE, TEXT, WASH } from "./tokens";

/* ---- the month, as blocks ----
 * One block a day, filled when the day was done. Nothing here is a streak or
 * a score: the point is to see a month at a glance and know which days went
 * missing, which a running total never shows you.
 */

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* how many days a month holds */
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

export const iso = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function MonthGrid({ year, month, done, colour, today, onToggle, label }) {
  const n = daysInMonth(year, month);

  /* Ten across rather than a seven-wide calendar: three tracks have to sit on
     one screen, and a month of thirty blocks reads as a month either way. */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(10, 1fr)",
        gap: 4,
        marginTop: 8,
      }}
    >
      {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
        const day = iso(year, month, d);
        const on = !!done[day];
        const future = day > today;
        return (
          <Btn
            key={day}
            plain
            aria={`${label}, ${d} ${MONTH_NAMES[month - 1]}${on ? ", done" : ""}`}
            onClick={() => !future && onToggle(day)}
            style={{
              aspectRatio: "1 / 1",
              padding: 0,
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 4,
              /* filled for done, an empty frame for a day that went past, and
                 barely there for one that has not happened yet */
              background: on ? colour : future ? "transparent" : CARD,
              color: on ? ON_ACCENT : future ? RULE : MUTE,
              border: `1px solid ${on ? colour : future ? RULE : WASH}`,
              opacity: future ? 0.55 : 1,
              cursor: future ? "default" : "pointer",
              /* today is ringed rather than filled, so it reads before it is done */
              boxShadow: day === today ? `0 0 0 2px ${TEXT}` : "none",
            }}
          >
            {/* a day still to come is an empty frame; the number would only be
                a grey smudge, and there is nothing yet to read */}
            {future ? "" : d}
          </Btn>
        );
      })}
    </div>
  );
}
