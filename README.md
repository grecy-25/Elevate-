# 🌍 GlobeTrotter — Travel Planning Platform

A full-stack travel itinerary planner. Plan multi-city trips, build day-by-day
schedules, track budgets, discover destinations and experiences anywhere in
the world, and share itineraries with the community.

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (via `sql.js`, a pure JavaScript/WASM SQLite engine — no
  native database installation required)

---

## 1. What you need before you start

Install these once on your computer:

| Tool | Why you need it | Check you have it |
|---|---|---|
| [Node.js](https://nodejs.org/) v18 or newer (v20+ recommended) | Runs both the backend and frontend | `node -v` |
| npm (comes with Node.js) | Installs dependencies | `npm -v` |
| [Git](https://git-scm.com/) | Version control / pushing to GitHub | `git --version` |
| A code editor, e.g. [VS Code](https://code.visualstudio.com/) | Optional, but handy | — |

You do **not** need to install SQLite, MySQL, Postgres, or any other database
software — see [section 4](#4-how-the-backend--database-works) for why.

---

## 2. Running it on your own computer (localhost)

### Step 1 — Get the files onto your machine

If you downloaded this project as a `.zip`, unzip it anywhere, e.g.:

```
GlobeTrotter/
├── backend/
├── frontend/
├── package.json
└── README.md
```

Open a terminal and `cd` into that folder:

```bash
cd path/to/GlobeTrotter
```

### Step 2 — Install dependencies

This project has three `package.json` files (root, `backend/`, `frontend/`).
Install all of them in one go:

```bash
npm install
npm run install:all
```

This installs the root helper tools, then installs the backend's packages
(Express, sql.js, JWT auth, etc.) and the frontend's packages (React, Vite,
etc.).

> **Note:** `node_modules` folders are *not* included in this download —
> some packages contain compiled binaries that differ by operating system
> (Windows vs. macOS vs. Linux), so they're always meant to be installed
> fresh on whichever machine will run the app. This is standard practice
> for every Node.js project.

### Step 3 — (Optional) Seed the database with demo data

The database is created automatically the first time the backend starts, but
it starts **empty**. If you'd like some ready-made example trips, cities, and
two demo accounts to explore, run:

```bash
cd backend
npm run seed
cd ..
```

This creates two demo logins you can use on the sign-in screen:

| Role | Email | Password |
|---|---|---|
| Traveler | `traveler@globetrotter.com` | `password123` |
| Admin | `admin@globetrotter.com` | `admin123` |

If you skip this step, that's completely fine — just register your own new
account from the app's sign-up screen, and you'll correctly start with all
counters at zero, an empty trip list, and an empty wishlist.

### Step 4 — Run the app

From the project root, this starts **both** the backend API and the frontend
dev server together:

```bash
npm run dev
```

You should see logs from both:

```
[BACKEND] 🚀 GlobeTrotter Backend Server running on http://localhost:5000
[FRONTEND]   VITE ready ...  ➜  Local:   http://localhost:5173/
```

Open your browser to:

```
http://localhost:5173
```

That's it — the frontend automatically forwards its `/api/...` calls to the
backend on port 5000 (configured in `frontend/vite.config.js`), so you don't
need to configure anything else.

### Running backend/frontend separately (alternative)

If you'd rather run them in two separate terminals:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

### Stopping the app

Press `Ctrl + C` in the terminal running `npm run dev`.

---

## 3. Worldwide city search needs an internet connection

The "Explore Global Cities" and "Experiences" search boxes work in two
layers:

1. They first search the small set of curated destinations already stored in
   the local database.
2. If you search for a city that isn't there yet, the backend calls the free
   [OpenStreetMap Nominatim](https://nominatim.org/) geocoding API to look it
   up — this covers essentially any city in the world. Once found, that city
   (and a starter set of activities for it) is saved into your local
   database, so searching for it again later works instantly, even offline.

This means the **first** search for a brand-new city needs your computer to
be online. If you're running fully offline, only the pre-seeded/previously
searched cities will be found.

---

## 4. How the backend & database work

- The backend is a standard Express REST API (`backend/src/server.js`) —
  routes live in `backend/src/routes/`, and the logic for each feature lives
  in `backend/src/controllers/`.
- The database is **SQLite**, accessed through a package called `sql.js`.
  Unlike the usual `sqlite3` or `better-sqlite3` packages, `sql.js` is
  compiled to WebAssembly, so it runs anywhere Node.js runs with **zero
  native/system installation** — nothing to download or configure.
- The actual database file lives at:

  ```
  backend/data/globetrotter.db
  ```

  It's a real, standard SQLite file. Every time data changes, the backend
  writes the updated database back to this file (see `persistDb()` in
  `backend/src/config/db.js`), so your data survives restarts.

- The full table schema (users, trips, cities, activities, trip_stops,
  trip_activities, expenses, saved_destinations, trip_likes) is defined in
  `backend/src/config/db.js` inside `initDatabase()`, and is created
  automatically the first time you start the server.

### Inspecting or resetting the database

Because it's a normal `.db` file, you can open it with any SQLite viewer,
for example [DB Browser for SQLite](https://sqlitebrowser.org/) (free,
cross-platform) — just open `backend/data/globetrotter.db`.

To wipe the database and start over:

```bash
# Stop the server first, then:
rm backend/data/globetrotter.db      # macOS/Linux
del backend\data\globetrotter.db     # Windows (cmd)

# Then either restart the server (creates a fresh empty database), or:
cd backend && npm run seed           # restart with demo data
```

There's also an in-app "Reset Database" option on the Admin dashboard
(available to the `admin@globetrotter.com` demo account) that does the same
thing without touching the terminal.

---

## 5. Environment variables

The backend reads settings from `backend/.env`:

```
PORT=5000
JWT_SECRET=globetrotter_super_secret_jwt_key_2026_travel
NODE_ENV=development
```

A working `.env` is already included so the app runs immediately. For your
own deployment, copy `backend/.env.example` to `backend/.env` and set a
different, private `JWT_SECRET` (this is what signs users' login tokens —
never reuse the example value in production).

---

## 6. Project structure

```
GlobeTrotter/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # SQLite setup, schema, query helpers
│   │   ├── controllers/          # Business logic per feature
│   │   ├── routes/               # Express route definitions
│   │   ├── middleware/auth.js    # JWT auth middleware
│   │   ├── seed/seedData.js      # Demo data generator
│   │   └── server.js             # App entry point
│   ├── data/globetrotter.db      # SQLite database file (auto-created)
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/                # One file per app screen
│   │   ├── components/           # Reusable UI (cards, forms, modals, charts)
│   │   ├── context/               # Auth + currency React context
│   │   ├── services/api.js       # Single place all API calls go through
│   │   └── styles/index.css      # Design system (colors, typography, layout)
│   └── vite.config.js
└── package.json                  # Root scripts to run everything together
```

---

## 7. Publishing this project to GitHub

If you're new to Git/GitHub, here's the full path from your local folder to
a public (or private) GitHub repository.

### Step 1 — Create the repository on GitHub

1. Go to [github.com/new](https://github.com/new).
2. Give it a name, e.g. `globetrotter`.
3. **Do not** check "Add a README" or "Add .gitignore" — this project
   already has both, and GitHub will ask you to merge unrelated histories if
   you do.
4. Click **Create repository**. Keep the page open — you'll need the URL it
   shows you (something like `https://github.com/your-username/globetrotter.git`).

### Step 2 — Initialize Git locally and push

From the project root folder, in your terminal:

```bash
git init
git add .
git commit -m "Initial commit: GlobeTrotter travel planning platform"
git branch -M main
git remote add origin https://github.com/your-username/globetrotter.git
git push -u origin main
```

Replace the `your-username/globetrotter.git` URL with the one GitHub showed
you in Step 1.

If this is your first time using Git on this computer, it may ask you to set
your identity first:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### What gets pushed (and what doesn't)

The included `.gitignore` deliberately keeps a few things out of the repo:

- `node_modules/` (everyone who clones the repo regenerates this with
  `npm install` — see Step 2 above)
- `backend/data/*.db` (your local database/personal data shouldn't be
  committed; each person who runs the project gets their own fresh one)
- `.env` files (kept local since they can hold secrets; `.env.example` is
  committed instead, as a template)
- `frontend/dist/` (build output — regenerated with `npm run build`, not
  meant to be committed)

### Making future changes

After the initial push, the normal day-to-day flow is:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

---

## 8. What's new in this version

- **Dashboard stat cards** (Total Itineraries, Countries Explored, Scheduled
  Experiences, Wishlist Destinations) are now clickable and correctly show
  **0** for brand-new accounts instead of leftover placeholder numbers.
- **Worldwide city search** — the "Explore Global Cities" page and the
  "Experiences" destination filter can now find essentially any city in the
  world, not just a small curated list.
- **Experiences tab:** the "All Destinations" filter is now a type-to-search
  box (no giant dropdown) with live matching suggestions, and the keyword
  search box was fixed (a query-string bug meant filters silently sent the
  text `"undefined"` to the server instead of being left out).
- **City details:** clicking "Explore" on any city now opens a detail view
  with a description, live weather preview, popular experiences in that
  city, and a few other popular destinations nearby.
- **Visual refresh:** a new warm, travel-themed color palette (sunset coral,
  ocean teal, sand gold) applied consistently across the whole app, plus a
  couple of small UI/accessibility fixes (missing badge style, unclickable
  cards).

---

## 9. Troubleshooting

**"Port 5000 already in use"** — another process is using that port. Either
stop it, or change `PORT` in `backend/.env` (remember to also update
`frontend/vite.config.js`'s proxy target to match).

**"Port 5173 already in use"** — Vite will automatically offer the next free
port (5174, etc.) — just use the URL it prints.

**City search isn't finding a new city** — check your internet connection;
see [section 3](#3-worldwide-city-search-needs-an-internet-connection).

**`npm install` fails on a native module** — make sure you're installing
fresh (not reusing a `node_modules` folder copied from a different
operating system) and that you're on Node.js 18+.
