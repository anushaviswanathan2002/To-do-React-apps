# Student Test Portal

Enterprise-style online testing platform: **Angular 22** (standalone components, signals, lazy routes) + **Express** + **SQLite**.

## Features
- JWT auth (bcrypt), roles: `admin`, `teacher`, `student` (first registered user is admin), route guards, audit log
- Teachers: create tests, 4 question types (single, multiple, true/false, short answer), time limit, pass mark, attempt limit, open/close window, shuffle, publish/unpublish, analytics (average, median, pass rate, histogram, per-question difficulty), CSV export (formula-injection safe)
- Students: timed exam with server-authoritative deadline (client clock skew corrected), autosave, resume after refresh, auto-submit at deadline, answer review after submission
- Integrity: correct answers never sent to the client during an attempt; late edits rejected; proctoring flags (tab switch, blur, copy/paste) recorded for teachers
- Accessible UI: skip link, labelled controls, timer/alerts, keyboard navigable

## Run
```
cd web && npm install && npm run build
cd ../api && npm install && JWT_SECRET=<secret> npm start   # serves API + built UI (PORT, DB_FILE optional)
```
Development: `npm run dev` in `api/` (JWT_SECRET required) and `npm start` in `web/` (proxies `/api`).

## Tests
- `cd api && npm test` (API integration tests: grading, RBAC, timing, attempts, analytics)
- `cd web && npx ng test --watch=false` (Angular unit tests)
