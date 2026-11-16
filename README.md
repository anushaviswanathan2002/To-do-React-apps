# To-Do React App

A simple, fast, and accessible to-do list built with React and Vite.

## Features

- **Add** tasks with priority level (`Low`, `Medium`, `High`) via the form
- **Priority badges** colour-coded for quick visual triage (green for Low, amber for Medium, red for High)
- **Undo delete** toast notification allowing one-click restore after deleting a task or clearing completed tasks
- **Complete** tasks by ticking the checkbox
- **Edit** a task inline (title and priority) — `Enter` saves, `Escape` cancels
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
├── styles.css                 # All styling (light + dark themes, priority badges, toast)
├── components/
│   ├── Icon.jsx               # Inline SVG icons
│   ├── TaskForm.jsx           # Add-task form with priority selector
│   ├── TaskItem.jsx           # A single task row with priority badge & edit mode
│   ├── TaskList.jsx           # Task list and empty state
│   ├── TaskFilters.jsx        # All / Active / Completed filter buttons
│   └── UndoToast.jsx          # Accessible floating toast with Undo action
├── hooks/
│   └── useLocalStorage.js     # State hook backed by localStorage
├── utils/
│   └── tasks.js               # Task factory, priority constants, filtering and counting helpers
└── test/
    ├── setup.js
    └── App.test.jsx           # Behavioural tests (16 tests)
```

## How it works

`App.jsx` holds the list of tasks as state via the `useLocalStorage` hook. Every
mutation (add, toggle, update, delete, clear, undo) updates that state, and the hook
writes the result to `localStorage` so the list is restored on the next visit.
When a task or group of tasks is deleted, a temporary undo state is captured and
displayed in an accessible floating toast notification (`UndoToast`), auto-dismissed after 6 seconds.
`filterTasks` derives the visible rows from the selected filter, and `countTasks`
produces the numbers shown on the filter buttons and in the footer.
