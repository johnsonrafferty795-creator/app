# Workout

Seven offline, installable apps built from one repo. Vite + React, everything
stored on the phone itself.

| App | Lives at | What it does |
| --- | --- | --- |
| **Workout** | `/` | 2-week rotation, 3 days a week |
| **PPL** | `/ppl/` | Push, Pull, Legs, Rest |
| **Winter Arc** | `/winter/` | The same rotation, run as a winter arc |
| **Dog Training** | `/dogs/` | Two dogs' daily training checklists |
| **Weekly** | `/week/` | A task list that unticks itself every week |
| **Golf Mobility** | `/golf/` | Mobility, pilates and rotation work for the swing |
| **Bertie's Biscuits** | `/biscuit/` | An idle biscuit game |

They build, install and cache separately — seven home-screen icons, seven
stores of data, one deploy. `src/workout-app.jsx`, `src/ppl-app.jsx`,
`src/winter-app.jsx`, `src/dogs-app.jsx`, `src/weekly-app.jsx`,
`src/golf-app.jsx` and `src/biscuit-app.jsx` are deliberately kept as
independent files: none can break another. The game is the one with a second file — `src/biscuit-data.js`
holds its economy, and nothing else imports it.

## Workout

- **Today** — the next session in the rotation, plus the daily habit toggles
- **Session** — one exercise at a time, with the target worked out from the
  best set logged so far (add a rep to 12, then +2.5 kg and back to 8). Every
  exercise ticked for a muscle group is in the session, in library order
- **Progress** — last 7 days, last 4 weeks, and per-exercise history
- **Exercises** — which movements the sessions get built from

Large type and heavy contrast throughout: it is built to be read at arm's
length in a gym, by someone with poor eyesight.

## Running it locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve dist/ — needed to test the service worker
```

The service worker only runs in a real build, so use `preview` (not `dev`) when
checking offline behaviour.

## Storage

Everything lives in `localStorage` under three keys, wrapped by `src/storage.js`:

| Key          | Contents                                            |
| ------------ | --------------------------------------------------- |
| `wk-profile` | chosen exercises + where he is in the 2-week rotation |
| `wk-days`    | per-day habit flags (workout, cardio, food)          |
| `wk-lifts`   | per-exercise set history, last 60 sets each          |
| `ppl-profile`| chosen exercises, any added by hand, goal, and place in the 4-day cycle |
| `ppl-days`   | per-day flags (workout, eat, cardio)                |
| `ppl-lifts`  | per-exercise set history, last 60 sets each         |
| `ppl-weight` | one body-weight reading per day, for the graph      |
| `ppl-reports`| frozen four-week summaries, one per closed block    |
| `wa-profile` | Winter Arc: the same as `wk-profile`, plus which of its two looks is on |
| `wa-days`    | Winter Arc: per-day habit flags                     |
| `wa-lifts`   | Winter Arc: per-exercise set history, last 60 sets each |
| `wa-weight`  | Winter Arc: one body-weight reading per day         |
| `wa-reports` | Winter Arc: frozen four-week summaries              |
| `tk-tasks`   | the weekly list: name, day, and whether it repeats   |
| `tk-log`     | which tasks were ticked, filed under the week they belong to |
| `tk-prefs`   | which day the week starts on                        |
| `gf-log`     | per day, per block, how many goes at each exercise are finished |
| `bs-game`    | the whole save: biscuits, buildings, upgrades, badges, crumbs |
| `bs-prefs`   | how numbers are written, and whether they fly off the biscuit |

The apps share an origin, so the `wk-` / `ppl-` / `dg-` / `tk-` / `gf-` / `bs-`
prefixes are what keep them out of each other's data.

No account, no network, no sync — the data belongs to the phone it was entered
on. Clearing the browser's site data wipes it, and "Add to Home Screen" on iOS
keeps its own copy separate from Safari's, so install first, then log.

## Deploying

Any static host works; the whole app is the contents of `dist/`.

### GitHub Pages (set up in this repo)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
Enable it once: **Settings → Pages → Source: GitHub Actions**. The workflow
passes `BASE_PATH=/<repo>/` so the build works from a subpath; the URL is

```
https://<username>.github.io/<repo>/
```

### Anywhere else

```sh
npm run build   # builds all six apps; then drag dist/ onto app.netlify.com/drop
```

Netlify, Vercel, and Cloudflare Pages all serve `dist/` as-is from the domain
root, which needs no `BASE_PATH`. The one hard requirement is HTTPS — service
workers, and therefore installing and offline use, do not work over plain HTTP.

## PPL

The second app, at `/ppl/`. Same session runner and overload maths; different
plan and its own look (navy and blue, a plate icon, colour-coded day types).

- **Today** — Push / Pull / Legs / Rest by position in a 4-day cycle, plus the
  day's tasks: eat well, workout, and cardio when the goal calls for it
- **Progress** — last 7 days, last 4 weeks, per-exercise history
- **Weight** — one weigh-in a day, drawn as a line over time
- **Four-week report** — each 28-day block summarised as it closes and saved to
  `ppl-reports`: sessions, habits, body weight, and every lift sorted into
  moved-up or stalled
- **Plan** — bulk / cut / maintain, rotation position, exercise choices

Every exercise is 3 sets of 6–12 reps to failure; the overload target adds a rep
to 12, then +2.5 kg and back to 6.

The goal drives cardio only: **bulk** none, **cut** every day, **maintain**
every training day (so it skips the rest day) — three days in four, about five
a week.

## Winter Arc

The third app, at `/winter/`. The first tracker again — same two-week rotation,
same session runner, same overload maths, same screens — kept for the months it
is hardest to keep anything. It writes to its own keys (`wa-`), so a winter is
counted on its own and nothing in it touches the year-round history next door.

What is added is the arc itself, across the top of the front page: **1 November
to the last day of February**, which day of it today is, and how many are left.
Out of season it counts down to the next one instead. All of that is worked out
from the date every time it is drawn — there is nothing to start, nothing to
set and nothing stored, so it cannot get out of step with the calendar.

Two looks, switched from the Plan tab: **Blackout** (bone white on black, the
one the icon is cut from) and **Frostbite** (the same black, lit ice blue).
Both set their display type in Anton — heavy, condensed and carried in the app
rather than borrowed from the phone, since iOS has no Impact and falls back to
an ordinary Helvetica that reads nothing like it.

Because it is a copy and not a fork, a fix worth having in both has to be made
in both: `src/winter-app.jsx` and `src/workout-app.jsx` are independent files,
on purpose, and everything genuinely shared already lives in the modules under
**Shared code** below.

## Dog Training

The fourth app, at `/dogs/`. A daily checklist per dog, built for someone who
wants to open it, see what is left, tap it and put the phone down.

- **Today** — both dogs, how much of each list is done, tap through to either
- **Maisie** (German Shorthaired Pointer) and **George** (Border Terrier) — a
  page each, nine tasks each, from their own training routine. The two rated
  non-negotiable for the breed (recall and real exercise) are marked **must**
- **This week** — per dog: share of the list done, complete days, the current
  streak, the seven days as bars, and every task tallied out of 7, with the
  most-missed one named and the week before to compare against

The lists reset by date rather than being cleared, so the seven-day strip at the
top of a dog's page can go back and tick a day finished after the fact. There is
one optional note a day per dog. Nothing else to set up, no accounts, no
settings screen.

## Icons

`public/*.png`, `ppl/public/*.png`, `winter/public/*.png`, `dogs/public/*.png`,
`week/public/*.png`, `golf/public/*.png` and `biscuit/public/*.png` are
generated with the standard library only — a red dumbbell for one app, a blue
plate for the second, a bone-white barbell on black for the third, a white paw
on green for the fourth, a pale calendar page with an orange tick for the
fifth, a chalk flagstick and ball on fairway green for the sixth, and a
chocolate-chip biscuit on dark cocoa for the seventh:

```sh
python3 tools/make-icons.py
python3 tools/make-ppl-icons.py
python3 tools/make-winter-icons.py
python3 tools/make-dogs-icons.py
python3 tools/make-weekly-icons.py
python3 tools/make-golf-icons.py
python3 tools/make-biscuit-icons.py
```

The Winter Arc barbell is drawn from one description of half a bar — the plates
are mirrored about the centre — and the same shape is set beside the wordmark
inside the app, so the home screen and the front page agree.

## Backup

Every app keeps everything on the one phone, so each has an **Export a backup**
button — Plan tab in the PPL and golf apps, Exercises tab in the first and in
Winter Arc, Week tab in the dog app, the menu in the weekly one, the Tin tab in
the game. It writes a dated
JSON file through the iOS share sheet, falling back to a download elsewhere.
**Restore from a file** puts it back, after saying what the file holds and that
the phone's current data is written over. A backup is stamped with the app it
came from, since they share an origin and would otherwise overwrite each
other.

## Shared code

All three trackers now sit on the same small layer, so a fix lands in both at once
rather than in whichever one was open: `tokens.js` (the CSS-variable palette),
`theme.css` (the two themes and the gothic ornament), `dates.js`, `lifts.js`,
`ui.jsx` (buttons, the typeable stepper), `charts.jsx` (the trend line and the
weekly bars), `report.jsx` (four-week blocks, generic over whichever habits an
app tracks), `weight.jsx` (the whole body-weight screen) and `backup.js`.

What stays per app is the training plan: the rotation, the set rules and the
daily habits. Those are genuinely different and are meant to be.

## Look

The apps are deliberately unalike, so none is opened by mistake. The original is
black on white with a red accent.

The PPL app is dark, and carries two themes switched from its Plan tab:
**Steel** (blue on black) and **Gothic** (iron, bone and blood red, set in
Grenze Gotisch with a double rule and corner rosettes on its panels). Every
colour and face is a CSS variable, so the switch is one `data-theme` attribute
on the root — see `src/ppl-theme.css`. SVG takes its colours through `style`
rather than presentation attributes, which do not resolve `var()`.

Two things the palettes must each answer for: type sitting on an accent fill
goes dark in Steel and light in Gothic, and an accent used as *type* needs its
own lighter step. Every label on every screen of both themes was checked against
its computed background for WCAG AA.

The dog app is the warm one: paper-coloured background, a liver brown for
Maisie and a teal for George, green for anything done. Type starts at 18px and
every task is one full-width button, tick box and all — see `src/dogs-theme.css`.

The weekly app is the dark one, and the only one with no tab bar: seven day
bands stacked down a near-black page, Monday palest and Sunday darkest, with
one orange for ticks and for anything happening only once — see
`src/weekly-theme.css`.

Its band ramp stops at `#4A4A4E` rather than the mid grey the design wants. A
band lighter than that caps out at about 5:1 against white and 4:1 against
black, so nothing written on it can clear AA — not the day name, and certainly
not a muted colour for a finished task. For the same reason the tick box keeps
a pale ring whether it is filled or not: the orange fill alone is 2.2:1 against
the palest band, and a white tick rules out a lighter fill.

The biscuit game is the brown one: a dark cocoa ground, cream type and one
gold, with the dough and its chocolate chips as the only other colours — see
`src/biscuit-theme.css`. Against the ground, type is 16.4:1, muted 8.3:1,
faint 5.4:1, gold 10.0:1 and green 9.9:1. Faint drops to 4.2:1 on a raised row,
which is under AA, so it is never used there — raised rows take muted instead.
Type on a gold fill is the dark ground, at 10.0:1.

Winter Arc is the black one, and carries two looks switched from its Plan tab:
**Blackout** (bone white on black, with one cold blue-grey step for a focus
muscle group and the session's rule, and a muted green for a day that got done)
and **Frostbite** (the same black lit ice blue, with a cold teal for done —
mint would read as spring, which is the season it is not about). Both set their
display type in Anton and keep everything under 17px on Helvetica, since Anton
has one weight and nothing to give at label sizes. See `src/winter-theme.css`.

Type on the ground is 18.0:1 in Blackout and 18.0:1 in Frostbite, muted 7.1:1
and 7.9:1, the accent step 9.3:1 and 12.6:1; the weakest reading on either is
Blackout's muted on a raised row, at 5.6:1. Type sitting on a fill goes black in
both: the closest to the line is Blackout's steel at 6.5:1, and its red — unused
by this app's screens, but kept honest — was lifted to 5.2:1 so it would carry
type if it ever were.

The golf app is the green one: a deep fairway ground, chalk type and bunker
gold, with a colour per block — grass for the daily flexibility, gold for the
pilates, sky for the swing work — so a block is known before it is read. Each
was checked against both the ground and a panel for WCAG AA as type; the
weakest is sky at 7.4:1 on the ground and 6.0:1 on a panel. See
`src/golf-theme.css`.

Charts are single-series, drawn as inline SVG: a line for anything over time
(body weight, and each exercise's weight), bars for sessions a week. Every value
a chart shows is also written out underneath, so the graph is never the only way
to read a number.

## Weekly

The fifth app, at `/week/`. A task list where a week is the unit: put things
on the days you mean to do them, and on the first morning of the next week the
whole lot goes back to unticked on its own.

One screen, no tabs. The seven days are stacked down it, palest at the top and
darkening to the bottom, each one collapsed to its name until it is tapped.

- **A day** opens to its date and its list. Tick with the box, type into
  **Add a task…** at the end, drag by the grip on the right to reorder
- **A task** is **every week** by default, or **just this week** — tap its name
  for that, and to delete it. A one-off is marked **once** and is gone when the
  week turns over
- **The + button** opens today and puts the cursor in its field, which is the
  shortest path from picking the phone up to having written the thing down
- **The menu** holds the week so far, the weeks behind it, which day the week
  starts on, and the backup buttons

Nothing is ever cleared to make the reset happen. Every tick is filed under the
week it belongs to, so a new week is simply a new key with nothing in it yet —
there is no job to run, nothing to go wrong overnight, and last week is still
there to open. A tick records the date it was made and a task the date it was
added, which is what lets **the week starts on** (Monday or Sunday) be changed
later without stranding either: the log is filed again from the dates, and a
task works its week out from when it was written down.

## Golf Mobility

The sixth app, at `/golf/`. A golf mobility and pilates plan — the printed
sheet it came from, turned into something you work through rather than read.

Three blocks, each its own colour, each with its own place in the week:

| | Block | Dose | When |
| --- | --- | --- | --- |
| **A** | Daily Flexibility | 10 min | every day |
| **B** | Pilates Core & Rotation | 20–25 min | twice a week, on non-lifting days |
| **C** | Golf Swing Specific | 10–15 min | before the range or a round |

- **Today** — the three blocks, what is owed and what is done. **DUE** shows on
  the daily block until it is ticked, and on the pilates block until the week
  has had its two. The swing work is never owed: it is asked for by going to play
- **A block** opens to its exercises, each tickable on its own, or **Start**
  walks through it one movement at a time
- **The runner** — one movement a screen: what it looks like, what it asks
  for, and the cue. A hold counts itself down (and keeps the screen awake while
  it does, since a minute is exactly how long a phone waits before locking); a
  set of reps waits for the tap that says it is done. Each side and each set is
  its own go, so 3 × 10 each side is six of them, and the bar moves through all
  six rather than jumping at the end
- **Week** — Monday to Sunday, three marks a day, plus the daily streak, the
  pilates count against its target of two, and the week before to compare against
- **Plan** — the whole plan written out, dose and coaching cue per movement,
  and the backup buttons

Every dose is stored as numbers — sets, of either seconds or reps, on one side
or both — and the words are rebuilt from them, so the runner and the written
plan can never disagree about what a movement asks for. Progress is stored as a
count of goes finished rather than a flag, so a session put down half way
through is still where you left it when the phone comes back out.

The exercises are the plan's, and are fixed: this app is a plan to follow, not
a library to build.

### The figures

Every movement carries a drawing of the position, in the runner and again on
Plan. A plan that assumes you already know what a 90/90 hip switch looks like
is no use to anyone who does not, and a written cue does not fix that.

They live in `src/golf-figures.jsx` as coordinates rather than pictures — a
pose is a spine drawn as a curve and limbs drawn as polylines with a bend at
the elbow or knee, with the limbs on the far side of the body drawn faint,
which is the whole of the depth in them. All sixteen together cost about 3 kB
gzipped, so they precache with everything else and work with no signal; a
folder of illustrations would be both a download and something to keep.

The body is drawn in chalk and the floor, wall, bench, band and ball in a
fainter chalk, so the only thing in the app's own colour is the arrow — which
is to say, where the movement goes.

Two of them needed more than a side view. Cat–cow is drawn as two frames,
since the whole exercise is the change between them. The 90/90 hip switch is
drawn looking down, because from the side it is indistinguishable from sitting
with the legs splayed — and it is labelled **from above**, because a figure
drawn from above otherwise reads as one lying on the floor.

## Bertie's Biscuits

The seventh app, at `/biscuit/`. Bertie's, and an idle game — the only one here
that is not about getting something done: tap a biscuit, then buy something
that taps it for you, then buy something that buys those.

Its name is on the home-screen icon and in the title bar, which is where the
other five keep theirs; on screen it appears once, at the foot of the Tin tab.

It is built to the shape of the genre it belongs to — the numbers below are
tuned to that shape. Everything written on top of them, and everything drawn,
is this app's own.

- **Bake** — the biscuit, and what a tap is currently worth. On every other
  screen it comes back as a strip above the tab bar, because a shop you have to
  leave to keep baking is no use
- **Shop** — 18 buildings and 141 upgrades. Buy ×1, ×10, ×100 or as many as
  you can afford; sell a quarter back. A row says what one of them makes and
  what share of everything that building is, which is the only number that
  answers "is this worth buying"
- **Badges** — 112 of them, and each is worth 1% more a second once there is
  **tea** in the shop to brew it with. Nothing here is only decorative
- **Tin** — crumbs, the stats, the settings and the backup buttons

**Golden biscuits** turn up every few minutes and sit there for thirteen
seconds, anywhere on any screen. Tapping one is the only thing in the game that
is not a matter of waiting: a frenzy is seven times the rate for 77 seconds, a
tap frenzy is 777 times a tap for 13, and a storm rains them for 7. About one in
twelve comes out **burnt** — visibly, so it can be left alone, which is the
whole point of it being a decision.

**Tipping the tin** throws the run away and keeps the crumbs: one crumb for
every cube root of a trillion baked, each worth 1% more a second, for good. The
bonus counts crumbs *earned* rather than crumbs left, so spending them never
makes the next run slower. Ten things to spend them on, from a head start to
twin ovens.

The oven keeps going while the app is shut — half your rate for up to three
hours to begin with, the full rate for up to three days once the crumbs have
paid for it.

### How it is put together

`src/biscuit-data.js` is the rules and nothing else: the buildings, the
upgrades, the badges, and the maths that turns them into a number per second.
It holds no React and touches no storage, so the economy can be checked — and
corrected — without opening the screen code. Every upgrade declares its effect
as data rather than as a function, so the whole lot is summed in one pass and
nothing can quietly apply twice.

The save is held in a ref and changed in place rather than replaced. A clicker
ticks twenty times a second, and copying a save that deep that often is felt on
a phone. Two counters drive the drawing instead: one at 20 a second for the
header and the biscuit, one at 4 a second for the shop and the badge wall,
which do not need twenty frames to be right.

Every tick uses the real clock rather than counting ticks, because a
backgrounded tab is throttled to about once a second and has to catch up rather
than fall behind. Anything longer than a minute is not caught up at all — it is
handled as time away, at the offline rate.

A save read off a phone is not trusted: it may be from an older version, a
half-finished write, or a backup someone edited by hand. Every field is coerced
to the shape the game expects or replaced, so a bad save costs you the save and
not the app.
