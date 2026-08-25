/* Every colour and face is a CSS variable, so flipping data-theme on the root
   repaints an app without threading a palette through its tree. The palettes
   themselves live in theme.css, shared by both trackers. */

export const BG = "var(--bg)";
export const INK = "var(--ink)";
export const CARD = "var(--card)";
export const WASH = "var(--wash)";
export const RAISED = "var(--raised)";
export const RULE = "var(--rule)";
export const MUTE = "var(--mute)";
export const TEXT = "var(--text)";
export const GRID = "var(--grid)";

export const PUSH_C = "var(--push)";
export const PULL_C = "var(--pull)";
export const LEGS_C = "var(--legs)";
export const REST_C = "var(--rest)";
export const WIN = "var(--win)";
export const WARN = "var(--warn)";
export const ON_ACCENT = "var(--on-accent)";

/* A fill colour and a type colour are not the same job. These are the steps
   that have to carry as type on the ground, which the fills do not always do:
   gothic's blood red is 2.2:1 at body size. */
export const CHART = "var(--chart)";
export const CHART_OK = "var(--chart-ok)";
export const GOOD = "var(--good-text)";
export const ACCENT_TEXT = "var(--accent-text)";

export const DISPLAY = "var(--display)";
export const BODY = "var(--body)";
/* chart labels always take a face with lining figures: an old-style 6 in a
   serif reads as a b, which is no good on an axis */
export const FIGURES = "var(--figures)";

export const THEMES = {
  steel: { label: "Steel", note: "Blue on black." },
  gothic: { label: "Gothic", note: "Iron, bone and blood red." },
};

/* Paint the root, and keep the iOS status bar in step with it. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    meta.setAttribute("content", bg || "#0B0C0F");
  }
}
