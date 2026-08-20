# Workout

Two offline, installable workout trackers built from one repo. Vite + React,
everything stored on the phone itself.

| App | Lives at | Split |
| --- | --- | --- |
| **Workout** | `/` | 2-week rotation, 3 days a week |
| **PPL** | `/ppl/` | Push, Pull, Legs, Rest |

They build, install and cache separately — two home-screen icons, two stores of
data, one deploy. `src/workout-app.jsx` and `src/ppl-app.jsx` are deliberately
kept as independent files: neither can break the other.

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

The two apps share an origin, so the `wk-` / `ppl-` prefixes are what keep them
out of each other's data.

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
npm run build   # builds both apps; then drag dist/ onto app.netlify.com/drop
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

## Icons

`public/*.png` and `ppl/public/*.png` are generated with the standard library
only — a red dumbbell for one app, a blue plate for the other:

```sh
python3 tools/make-icons.py
python3 tools/make-ppl-icons.py
```

## Backup

Both apps keep everything on the one phone, so each has an **Export a backup**
button — Plan tab in the PPL app, Exercises tab in the other. It writes a dated
JSON file through the iOS share sheet, falling back to a download elsewhere.
**Restore from a file** puts it back, after saying what the file holds and that
the phone's current data is written over. A backup is stamped with the app it
came from, since the two share an origin and would otherwise overwrite each
other.
