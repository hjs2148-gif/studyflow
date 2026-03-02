# CLAUDE.md — StudyFlow

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**StudyFlow** is a comprehensive study planner and timer web application built for the Google AI Studio platform. It features real-time task/session tracking, multiple timer modes, analytics dashboards, a community/gamification layer, and AI-powered insights via the Gemini API.

- **AI Studio URL**: https://ai.studio/apps/drive/19KDI20x4xMuIDypULslAxGmjtHaU1Pe6
- **Stack**: React 19, TypeScript, Firebase (Firestore + Auth), Vite, Tailwind CSS, Recharts, Google Gemini AI

---

## Repository Layout

```
studyflow/
├── CLAUDE.md                  ← this file
└── study flow/                ← all source lives here (note the space in the name)
    ├── index.html             ← HTML entry point; loads Tailwind via CDN
    ├── index.tsx              ← React DOM root
    ├── App.tsx                ← Root component; Firebase init, auth, global state, routing
    ├── types.ts               ← All TypeScript interfaces / Firestore data models
    ├── vite.config.ts         ← Vite config (port 3000, @ alias, env var injection)
    ├── tsconfig.json          ← TS config (ES2022, strict, @ path alias)
    ├── package.json           ← Dependencies and npm scripts
    ├── metadata.json          ← AI Studio app metadata
    ├── README.md              ← Basic local-run instructions
    ├── components/
    │   ├── Common.tsx         ← Shared UI: SimpleCircularProgress, MiniDonut,
    │   │                         CollapsibleCard, BottomNav
    │   └── Modals.tsx         ← All modal dialogs (Settings, Confirmation,
    │                             ManualRecord, PreTimer, AmountInput, AI, etc.)
    ├── views/
    │   ├── TodayView.tsx      ← Daily dashboard (countdown, goal circle, tasks widget)
    │   ├── TasksView.tsx      ← Task CRUD, StudyCalendar, session history
    │   ├── StatsView.tsx      ← Analytics (charts, AI insights button)
    │   ├── TimerView.tsx      ← Timer engine (stopwatch / countdown / pomodoro)
    │   └── CommunityView.tsx  ← Social feed, live presence, clans, gamification
    └── services/
        └── geminiService.ts   ← Thin wrapper around @google/genai callGemini()
```

> **Important**: The working directory for all source is `study flow/` (with a space). When running shell commands, always quote the path: `cd "study flow"`.

---

## Development Setup

### Prerequisites
- Node.js (any recent LTS)

### Install & Run
```bash
cd "study flow"
npm install
# Create .env.local and add your Gemini key:
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run dev        # http://localhost:3000
```

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build locally |

### Environment Variables
Only one variable is needed locally:
```
GEMINI_API_KEY=<your Google AI Studio API key>
```
Vite exposes this as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` (see `vite.config.ts`).

When deployed on AI Studio, Firebase config, app ID, and auth token are injected as globals:
- `window.__firebase_config` — JSON string of Firebase project config
- `window.__app_id` — Application identifier used as Firestore path prefix
- `window.__initial_auth_token` — Pre-auth token (custom or anonymous fallback)

---

## Architecture

### State Management
All state lives in `App.tsx` and is passed down as props. There is no external state library (no Redux, Zustand, etc.).

Key state variables:
| Variable | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | Firebase Auth user |
| `tasks` | `Task[]` | All tasks for current user |
| `sessions` | `Session[]` | All recorded study sessions |
| `settings` | `Settings` | User preferences (synced to Firestore) |
| `activeTask` | `Task \| null` | Task currently being timed |
| `view` | `string` | Active page (`today \| tasks \| stats \| community \| timer`) |

### Data Flow
1. Firebase Auth resolves → sets `user`
2. Firestore `onSnapshot` listeners attach for `tasks`, `sessions`, `settings`
3. Views receive data and callbacks as props
4. Mutations call Firestore `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` directly from views
5. Listeners re-render automatically on remote changes

### Firestore Structure
```
artifacts/
  {appId}/
    users/
      {userId}/
        settings/profile    ← UserProfile document
        tasks/              ← Task collection
        sessions/           ← Session collection
    community_feed/         ← CommunityFeedItem collection (shared)
    presence/               ← LivePresence collection (ephemeral)
    clan_challenges/        ← ClanChallenge collection (shared)
```

### Auto-Share Logic (App.tsx)
After a timer session ends, the app automatically posts to `community_feed` if:
- Session duration > 30 minutes, OR
- `actualFocus` score >= 8

This can be disabled in Settings → auto-share toggle.

---

## TypeScript Types (`types.ts`)

All Firestore document shapes are defined here. Key interfaces:

```typescript
Task        — id, name, totalAmount, currentAmount, unit, status, targetDate?, repeatDays?
Session     — id, taskId, duration, amount?, mode, timestamp, predictedFocus?, actualFocus?, keyword?
UserProfile — uid, displayName, level, title, tier?, weeklyExp?, autoShare
Settings    — dailyGoalMinutes, timerMode, timerTheme, pomoFocus, examDate, widget configs, …
CommunityFeedItem — id, userId, type, content, fires, firedBy[]
LivePresence      — uid, displayName, taskName, startedAt, boosts, boostedBy[]
ClanChallenge     — id, name, goalType, targetValue, currentValue, participants, expiresAt
```

Global declarations (injected by AI Studio runtime):
```typescript
declare global {
  var __firebase_config: string;
  var __app_id: string;
  var __initial_auth_token: string;
}
```

---

## Key Conventions

### Styling
- **Tailwind CSS via CDN** — no PostCSS, no `tailwind.config.js`. All styling is done with Tailwind utility classes directly in JSX.
- Two custom utilities are defined in `index.html`:
  - `.no-scrollbar` — hides scrollbars
  - `.safe-pb` — bottom padding respecting mobile safe areas
- Do not introduce a CSS preprocessor or component library without discussion.

### Component Patterns
- Functional components with hooks only (no class components).
- Props are typed inline or with local interfaces; no global prop-type files.
- Modals are centralised in `components/Modals.tsx`. Add new modals there.
- Shared UI primitives belong in `components/Common.tsx`.
- View-specific logic stays inside the relevant `views/*.tsx` file.

### AI Integration
- All Gemini calls go through `services/geminiService.ts → callGemini(prompt)`.
- Model in use: `gemini-3-flash-preview`.
- The API key is read from `process.env.API_KEY` (set by Vite from `GEMINI_API_KEY`).
- Error messages from Gemini are in Korean (matching the app's UI language).

### Firebase Usage
- Firestore paths always include `appId` prefix: `artifacts/${appId}/users/${uid}/…`
- Use `serverTimestamp()` for `createdAt` fields.
- Presence documents use `onDisconnect().delete()` for cleanup.
- Auth: anonymous sign-in is the fallback; Google sign-in is optional for community features.

### Language & Localisation
- The app's UI and some error strings are in **Korean**.
- When adding user-facing strings, follow the existing Korean convention unless the string is purely technical/developer-facing.

### Path Alias
`@` resolves to the `study flow/` project root (configured in both `vite.config.ts` and `tsconfig.json`). Prefer `@/types` over relative `../types`.

---

## Adding Features

### New View
1. Create `views/NewView.tsx`.
2. Add the tab entry to `BottomNav` in `components/Common.tsx`.
3. Add the view to the `view` state switch in `App.tsx`.
4. Pass required state/callbacks as props from `App.tsx`.

### New Modal
1. Add the component to `components/Modals.tsx`.
2. Export it and import where needed.
3. Control visibility with a boolean state variable in the parent view.

### New Firestore Collection
1. Define the TypeScript interface in `types.ts`.
2. Document the Firestore path in this file (under "Firestore Structure" above).
3. Use the `appId` prefix for all paths.

### New Gemini Prompt
- Call `callGemini(prompt)` from `services/geminiService.ts`.
- Add the trigger UI in the relevant modal (`AIMenuModal` / `AIModal` in `Modals.tsx`) or view.

---

## No Test Suite

There are currently **no automated tests** in this repository. There is no Jest, Vitest, or testing library configured. When adding tests, use **Vitest** (already compatible with Vite) and place test files alongside source as `*.test.tsx`.

## No Linter

There is currently **no ESLint configuration**. TypeScript strict mode (`"strict": true` in `tsconfig.json`) is the primary code-quality gate. If adding ESLint, use a flat config (`eslint.config.ts`) compatible with Vite's ESM setup.

---

## Git Workflow

- Default branch: `master`
- Feature branches follow the pattern: `claude/<description>-<session-id>`
- Commit messages are plain English imperatives (e.g., `Add pomodoro auto-start setting`).
- There is no CI pipeline; build verification is manual (`npm run build`).
