# Workout

Four offline, installable trackers built from one repo. Vite + React,
everything stored on the phone itself.

| App | Lives at | What it tracks |
| --- | --- | --- |
| **Workout** | `/` | 2-week rotation, 3 days a week |
| **PPL** | `/ppl/` | Push, Pull, Legs, Rest |
| **Dog Training** | `/dogs/` | Two dogs' daily training checklists |
| **Weekly** | `/week/` | A task list that unticks itself every week |

They build, install and cache separately — four home-screen icons, four stores
of data, one deploy. `src/workout-app.jsx`, `src/ppl-app.jsx`,
`src/dogs-app.jsx` and `src/weekly-app.jsx` are deliberately kept as
independent files: none can break another.

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
| `tk-tasks`   | the weekly list: name, day, and whether it repeats   |
| `tk-log`     | which tasks were ticked, filed under the week they belong to |
| `tk-prefs`   | which day the week starts on                        |

The apps share an origin, so the `wk-` / `ppl-` / `dg-` / `tk-` prefixes are
what keep them out of each other's data.

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
npm run build   # builds all three apps; then drag dist/ onto app.netlify.com/drop
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

## Dog Training

The third app, at `/dogs/`. A daily checklist per dog, built for someone who
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

`public/*.png`, `ppl/public/*.png`, `dogs/public/*.png` and `week/public/*.png`
are generated with the standard library only — a red dumbbell for one app, a
blue plate for the second, a white paw on green for the third, an indigo
calendar page and tick for the fourth:

```sh
python3 tools/make-icons.py
python3 tools/make-ppl-icons.py
python3 tools/make-dogs-icons.py
python3 tools/make-weekly-icons.py
```

## Backup

Every app keeps everything on the one phone, so each has an **Export a backup**
button — Plan tab in the PPL app, Exercises tab in the first, Week tab in the
dog app, Past tab in the weekly one. It writes a dated
JSON file through the iOS share sheet, falling back to a download elsewhere.
**Restore from a file** puts it back, after saying what the file holds and that
the phone's current data is written over. A backup is stamped with the app it
came from, since they share an origin and would otherwise overwrite each
other.

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

The weekly app is the cool one: a lilac-grey page, indigo for the app itself,
the same green for anything done and a rust orange for today and for anything
happening only once — see `src/weekly-theme.css`.

Charts are single-series, drawn as inline SVG: a line for anything over time
(body weight, and each exercise's weight), bars for sessions a week. Every value
a chart shows is also written out underneath, so the graph is never the only way
to read a number.

## Weekly

The fourth app, at `/week/`. A task list where a week is the unit: put things
on the days you mean to do them, and on the first morning of the next week the
whole lot goes back to unticked on its own.

- **Today** — what is set for today, plus anything wanted this week but not on
  any particular day, and a line saying when the unticking happens
- **Week** — the seven days, each with its own tasks, so a day missed on
  Tuesday can still be ticked on Friday. `‹ Earlier` steps back through
  finished weeks
- **Tasks** — the list itself. Each task has a day (or **any day**) and is
  either **every week** or **just this week**; the second kind is marked
  **once** and is gone when the week turns over
- **Past** — the last eight weeks, each as a percentage, and the backup buttons

Nothing is ever cleared to make the reset happen. Every tick is filed under the
week it belongs to, so a new week is simply a new key with nothing in it yet —
there is no job to run, nothing to go wrong overnight, and last week is still
there to look at. A tick records the date it was made, which is what lets the
**week starts on** setting (Monday or Sunday, on the Tasks tab) be changed
later without stranding anything.
