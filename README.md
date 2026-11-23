# To-Do React App

A simple, fast, and accessible to-do list built with React and Vite.

## Features

- **Add** tasks with priority level (`Low`, `Medium`, `High`) via the form
- **Priority badges** colour-coded for quick visual triage (green for Low, amber for Medium, red for High)
- **Task descriptions / notes** — attach a longer description to any task, collapsed by default and expanded via a `Notes` button
- **Due dates** with a date picker, shown as a badge (`Today`, `Tomorrow`, `15 Mar 2025`)
- **Overdue highlighting** — overdue tasks get a red-tinted row, an `Overdue` badge, and a summary count under the title
- **Undo delete** toast notification allowing one-click restore after deleting a task or clearing completed tasks
- **Complete** tasks by ticking the checkbox
- **Edit** a task inline (title, priority, due date, notes) — `Enter` saves, `Escape` cancels
- **Delete** a task with the trash icon
- **Filter** by All / Active / Completed
- **Clear completed** in one click (with Undo support)
- **Persists** your tasks in `localStorage`, so they survive a refresh
- **Responsive** layout with automatic light and dark themes
- **Accessible**: semantic HTML, labelled controls, visible focus rings, keyboard operable

## Tech stack

- [React 19](https://react.dev)
- [Vite 8](https://vite.dev)
- Plain CSS with custom properties
- [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) for tests

## Getting started

```bash
npm install
npm run dev
```

## Available scripts

| Script          | Description                                     |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Start the dev server with hot module reloading   |
| `npm run build` | Build the production bundle into `dist/`        |
| `npm run preview` | Serve the production build locally            |
| `npm run lint`  | Run ESLint over the source                      |
| `npm test`      | Run the Vitest test suite once                  |

## Project structure

```
src/
├── App.jsx                    # Root component — owns task state, undo logic, and actions
├── main.jsx                   # React entry point
├── styles.css                 # All styling (light + dark themes, badges, notes, toast)
├── components/
│   ├── Icon.jsx               # Inline SVG icons
│   ├── TaskForm.jsx           # Add-task form with priority, due date and notes
│   ├── TaskItem.jsx           # A single task row with badges, notes & edit mode
│   ├── TaskList.jsx           # Task list and empty state
│   ├── TaskFilters.jsx        # All / Active / Completed filter buttons
│   └── UndoToast.jsx          # Accessible floating toast with Undo action
├── hooks/
│   ├── useLocalStorage.js     # State hook backed by localStorage
│   └── useToday.js            # Keeps "today" accurate across midnight
├── utils/
│   ├── tasks.js               # Task factory, priority constants, filtering and counting helpers
│   └── dates.js               # Due date formatting and overdue detection helpers
└── test/
    ├── setup.js
    ├── App.test.jsx           # Behavioural tests (26 tests)
    └── dates.test.js          # Date utility unit tests (8 tests)
```

## How it works

`App.jsx` holds the list of tasks as state via the `useLocalStorage` hook. Every
mutation (add, toggle, update, delete, clear, undo) updates that state, and the hook
writes the result to `localStorage` so the list is restored on the next visit.
When a task or group of tasks is deleted, a temporary undo state is captured and
displayed in an accessible floating toast notification (`UndoToast`), auto-dismissed after 6 seconds.
`filterTasks` derives the visible rows from the selected filter, and `countTasks`
produces the numbers shown on the filter buttons and in the footer.

Due dates are stored as plain `YYYY-MM-DD` strings, which sort lexicographically, so
overdue detection is a simple string comparison against today. The `useToday` hook
recomputes the current date just after midnight so the overdue state never goes stale
if the app is left open overnight.

## Library Management System

Full-stack app: React (Vite) frontend, Express API, SQLite database (`better-sqlite3`).

- Auth with JWT + bcrypt; roles `admin`, `librarian`, `member` (first registered user is admin)
- Catalog search/pagination, book CRUD, checkout/return/renew, reservation queue, overdue fines, member management, dashboard stats, audit log
- Run: `npm run build`, then `JWT_SECRET=<secret> npm start` (optional `PORT`, `DB_FILE`); dev: `npm run dev:server` + `npm run dev`
- Tests: `npm test` (API integration tests with supertest + UI tests)
