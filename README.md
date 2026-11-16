# To-Do React App

A simple, fast, and accessible to-do list built with React and Vite.

## Features

- **Add** tasks with the form at the top (submit with the button or `Enter`)
- **Complete** tasks by ticking the checkbox
- **Edit** a task inline — `Enter` saves, `Escape` cancels
- **Delete** a task with the trash icon
- **Filter** by All / Active / Completed
- **Clear completed** in one click
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
├── App.jsx                    # Root component — owns task state and actions
├── main.jsx                   # React entry point
├── styles.css                 # All styling (light + dark themes)
├── components/
│   ├── Icon.jsx               # Inline SVG icons
│   ├── TaskForm.jsx           # Add-task form
│   ├── TaskItem.jsx           # A single task row (view + inline edit mode)
│   ├── TaskList.jsx           # Task list and empty state
│   └── TaskFilters.jsx        # All / Active / Completed filter buttons
├── hooks/
│   └── useLocalStorage.js     # State hook backed by localStorage
├── utils/
│   └── tasks.js               # Task factory, filtering and counting helpers
└── test/
    ├── setup.js
    └── App.test.jsx           # Behavioural tests
```

## How it works

`App.jsx` holds the list of tasks as state via the `useLocalStorage` hook. Every
mutation (add, toggle, rename, delete, clear) updates that state, and the hook
writes the result to `localStorage` so the list is restored on the next visit.
`filterTasks` derives the visible rows from the selected filter, and `countTasks`
produces the numbers shown on the filter buttons and in the footer.
