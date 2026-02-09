# Correlate Tracker - Complete Project Documentation

## Overview

Correlate Tracker (also referred to as "Buddy") is a personal companion web application built for executive function support, self-regulation, and holistic life tracking. It combines health metric tracking, AI-powered daily planning, task management, focus tools, and a personal strategies library into a single Progressive Web App (PWA).

The application is a **frontend-only SPA** (no custom backend server). All data persistence, authentication, and real-time capabilities are provided by Supabase (a hosted PostgreSQL backend-as-a-service). AI features call external APIs directly from the browser.

---

## Technology Stack

### Core Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2.0 | UI framework |
| **TypeScript** | 5.9.3 | Static type safety |
| **Vite** | 7.2.4 | Build tool, dev server, HMR |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS styling |

### State Management & Data Fetching

| Technology | Version | Purpose |
|---|---|---|
| **React Query** (@tanstack/react-query) | 5.51.0 | Server state caching, queries, mutations |
| **React Context** | (built-in) | Legacy wrappers over hooks (backward compat) |

### Backend & Database

| Technology | Version | Purpose |
|---|---|---|
| **Supabase** (@supabase/supabase-js) | 2.45.0 | PostgreSQL database, Auth, real-time subscriptions |

### AI Integrations

| Technology | Version | Purpose |
|---|---|---|
| **OpenAI SDK** | 6.16.0 | GPT-4o for daily plan generation |
| **Anthropic SDK** | 0.71.2 | Claude for daily plan generation |
| **Google GenAI** | 1.38.0 | Gemini for daily plan generation |

### UI & Utilities

| Technology | Version | Purpose |
|---|---|---|
| **Lucide React** | 0.556.0 | Icon library |
| **Recharts** | 3.5.1 | Data visualization and charts |
| **date-fns** | 4.1.0 | Date manipulation |
| **ical.js** | 2.2.1 | iCal calendar format parsing |
| **uuid** | 13.0.0 | Unique ID generation |
| **Zod** | 4.3.6 | Runtime schema validation |

### PWA

| Technology | Version | Purpose |
|---|---|---|
| **vite-plugin-pwa** | 1.2.0 | Service worker generation via Workbox |
| **workbox-window** | 7.4.0 | Service worker registration and updates |

### Development & Testing

| Technology | Version | Purpose |
|---|---|---|
| **Vitest** | 4.0.17 | Unit test runner |
| **jsdom** | 27.4.0 | DOM simulation for tests |
| **@testing-library/jest-dom** | 6.9.1 | DOM assertion matchers |
| **ESLint** | 9.39.1 | Code linting |
| **typescript-eslint** | 8.46.4 | TypeScript lint rules |
| **PostCSS** | 8.5.6 | CSS processing pipeline |
| **Autoprefixer** | 10.4.22 | Browser CSS compatibility |

### Deployment

| Technology | Purpose |
|---|---|
| **Netlify** | Hosting, builds, SPA redirect rules |

---

## Project Structure

```
buddy/
├── public/                          # Static assets served as-is
│   ├── manifest.json                # PWA manifest (name, icons, theme)
│   ├── sw.js                        # Custom service worker
│   └── icons/                       # PWA icons (192x192, 512x512)
│
├── src/
│   ├── main.tsx                     # Application entry point
│   ├── App.tsx                      # Root component (routing, providers, settings modals)
│   ├── index.css                    # Global Tailwind CSS imports
│   │
│   ├── features/                    # Feature modules (vertical slices)
│   │   ├── core/                    #   Home page, login, account, settings
│   │   ├── health-tracking/         #   Metrics, protocols, experiments, check-ins
│   │   ├── planning/                #   AI daily plans, calendar, reflection
│   │   ├── tasks/                   #   Todos, smart notes
│   │   ├── focus/                   #   Pomodoro timer
│   │   ├── checklists/              #   Reusable checklists
│   │   └── toolbox/                 #   Personal strategies library
│   │
│   ├── context/                     # Legacy React Context wrappers
│   ├── hooks/                       # Shared hooks (useAuth, useTimer, useNotifications)
│   ├── services/                    # Shared services
│   │   ├── supabase.ts              #   Supabase client, DB types, converters
│   │   ├── supabase/                #   Modular Supabase service files
│   │   ├── notifications/           #   Push notification service
│   │   └── settings/                #   Settings CRUD with caching
│   │
│   ├── layouts/                     # Layout components (MainLayout)
│   ├── components/                  # Shared UI components (Modal, Toast)
│   ├── utils/                       # Utility functions (analysis, formatting)
│   ├── lib/                         # Validation schemas (Zod)
│   └── types/                       # TypeScript type definitions
│
├── supabase/
│   └── migrations/                  # SQL migration files
│
├── docs/                            # Documentation
│
├── package.json                     # Dependencies and scripts
├── vite.config.ts                   # Vite build config + PWA plugin
├── vitest.config.ts                 # Test runner config
├── tsconfig.json                    # TypeScript project references
├── tsconfig.app.json                # App TypeScript config
├── tsconfig.node.json               # Node/tooling TypeScript config
├── tailwind.config.js               # Tailwind CSS config
├── postcss.config.js                # PostCSS plugins
├── eslint.config.js                 # ESLint rules
├── netlify.toml                     # Netlify deployment config
├── .env.example                     # Required environment variables
└── index.html                       # HTML shell (Vite entry)
```

---

## Architecture

### Pattern: Feature-Based Vertical Slicing

Each feature is a self-contained module with its own pages, components, hooks, services, and types. Features only depend on shared utilities and the Supabase service layer. There is no cross-feature coupling.

```
feature/
├── pages/              # Full-page components
├── components/         # Feature-scoped UI components
├── hooks/              # Custom hooks (useTrackers, useTasks, etc.)
├── services/           # Business logic and API calls
├── types.ts            # Feature-specific type definitions
└── index.ts            # Barrel exports
```

### Seven Features

| Feature | Directory | Description |
|---|---|---|
| **Core** | `src/features/core/` | Home dashboard, login/signup, account page, settings |
| **Health Tracking** | `src/features/health-tracking/` | Custom metric trackers, daily check-ins, protocols (supplements/meds), cycles, doses, experiments, correlation analysis |
| **Planning** | `src/features/planning/` | AI-generated daily plans, time block management, calendar integration (Google/Outlook/iCloud via iCal), daily reflections |
| **Tasks** | `src/features/tasks/` | Todo list with priorities/subtasks/time estimates, smart notes with flag-based auto-categorization |
| **Focus** | `src/features/focus/` | Pomodoro timer with configurable work/break intervals and session history |
| **Checklists** | `src/features/checklists/` | Reusable checklist templates with pin/reset functionality |
| **Toolbox** | `src/features/toolbox/` | Personal strategies library with categories, tags, favorites, and findings |

---

## How Everything Connects

### 1. Application Bootstrap

The startup chain in `src/main.tsx`:

```
index.html
  └── src/main.tsx
        ├── ErrorBoundary           (catches uncaught errors)
        ├── QueryClientProvider      (React Query cache, 1-min stale time)
        └── AuthProvider             (Supabase auth state)
              └── App.tsx
                    ├── [Not configured] → Supabase config error screen
                    ├── [Loading]        → Loading spinner with 5s timeout
                    ├── [Not logged in]  → LoginScreen
                    └── [Logged in]      → ToastProvider → Context Providers → MainLayout
```

### 2. Provider Hierarchy (when authenticated)

```
<ToastProvider>                          ← Toast notification system
  <TrackerProvider>                       ← Health tracker context (legacy)
    <ProtocolProvider>                    ← Protocol context (legacy)
      <ExperimentProvider>               ← Experiment context (legacy)
        <TaskProvider>                   ← Task context (legacy)
          <SmartNotesProvider>           ← Notes context (legacy)
            <MainLayout>                 ← Header + content + bottom nav
              {activeTab page}           ← Current feature page
            </MainLayout>
            {settings modals}            ← Context-aware settings per tab
```

Note: The Context Providers are thin legacy wrappers. The actual state management is in feature-specific hooks backed by React Query.

### 3. Navigation System

Navigation is **tab-based** (no URL router). The `App.tsx` component maintains an `activeTab` state and renders the corresponding page via a switch statement. The bottom navigation bar in `MainLayout` is **context-aware**: it shows different buttons depending on which feature hub is active.

**Hub Groupings:**

| Hub | Tabs | Bottom Nav Shows |
|---|---|---|
| Health Hub | `health`, `protocols`, `experiments` | Metrics, Experiments, Protocols |
| Calendar Hub | `calendar`, `planning`, `reflection` | Calendar, Plan, Reflect |
| Tasks Hub | `tasks`, `checklists` | Tasks, Lists |
| Notebook | `notes` | Tasks, Notes |
| Standalone | `home`, `focus`, `toolbox`, `account`, `check-in` | Home only |

All hubs always show the **Home** button and the **Settings** button. Settings opens a context-aware modal specific to the currently active tab.

### 4. Data Flow

All data flows through this pipeline:

```
React Component
    │
    ▼
Feature Hook (e.g., useTrackers, useTasks)
    │  uses useQuery() for reads
    │  uses useMutation() for writes
    ▼
React Query Cache
    │  manages stale time, refetch, invalidation
    ▼
Service Layer (feature-specific or shared)
    │  contains business logic
    ▼
Data Converters (dbToTracker, trackerToDb, etc.)
    │  snake_case ↔ camelCase mapping
    ▼
Supabase Client (@supabase/supabase-js)
    │  .from('table').select() / .insert() / .update() / .delete()
    ▼
PostgreSQL Database (hosted by Supabase)
```

**Query cache configuration** (from `main.tsx`):
- Stale time: 1 minute
- Refetch on window focus: enabled
- Retry: 1 attempt on failure

### 5. Authentication Flow

```
User enters email + password
    │
    ▼
useAuth hook → supabase.auth.signInWithPassword()
    │                          or
    │            supabase.auth.signUp()
    ▼
Supabase Auth service validates credentials
    │
    ▼
On success: session stored, auth state updated
    │
    ▼
supabase.auth.onAuthStateChange() fires
    │
    ▼
initializeUserData(userId) seeds default trackers if first login
    │
    ▼
App renders authenticated UI with feature providers
```

All database queries include `user_id` filtering. Data isolation between users is enforced at the query level (and can be reinforced with Supabase Row-Level Security policies).

### 6. AI Integration

The Planning feature uses a unified `AIService` class (`src/features/planning/services/ai.service.ts`) that supports three providers:

```
User configures API key + provider in Planning Settings
    │
    ▼
AIService singleton initialized with config
    │
    ▼
Plan generation request:
    ├── Gathers context (tasks, calendar events, mood, energy, sleep)
    ├── Builds system prompt + user prompt from templates
    └── Sends to selected provider:
          ├── OpenAI  → gpt-4o (JSON mode)
          ├── Anthropic → claude-sonnet-4-20250514
          └── Google  → gemini-3-flash-preview (JSON mime type)
    │
    ▼
Response parsed as JSON → PlanSuggestion → Time blocks created
```

AI features include:
- **Daily plan generation** based on tasks, calendar, and current state
- **Adaptive replanning** when circumstances change during the day
- **Task breakdown** to split large tasks into subtasks

### 7. Calendar Integration

External calendars connect via iCal URL:

```
User provides iCal URL (Google Calendar / Outlook / iCloud)
    │
    ▼
ical.js parses the .ics feed
    │
    ▼
Events extracted and stored in calendar_events table
    │
    ▼
Calendar page displays combined timeline
    │
    ▼
AI planner incorporates calendar events when generating plans
```

### 8. PWA Architecture

```
vite-plugin-pwa (build time)
    │
    ├── Generates Workbox service worker with precache manifest
    ├── Caches all JS, CSS, HTML, images, fonts
    └── Runtime caching: Google Fonts (CacheFirst, 1-year expiry)

public/manifest.json
    ├── App name: "Correlate Tracker"
    ├── Display: standalone (full-screen on mobile)
    ├── Theme: #6366f1 (indigo)
    └── Icons: 192px + 512px

public/sw.js
    └── Custom service worker for push notifications
```

### 9. Notification System

```
supabase/migrations/
    ├── 20260129000000_create_notifications.sql
    │     ├── notification_subscriptions (Web Push endpoints)
    │     ├── scheduled_notifications (queue with send_at timestamps)
    │     └── notification_logs (delivery history)
    │
    └── 20260130000000_setup_notification_cron.sql
          └── Periodic job to process scheduled notifications

src/services/notifications/
    ├── notification.service.ts      Core notification operations
    ├── push.service.ts              Web Push API integration
    ├── scheduler.service.ts         Scheduling logic
    └── notification.types.ts        Type definitions
```

---

## Database Schema

All tables live in Supabase-hosted PostgreSQL. Every table has a `user_id` column for data isolation.

### Health Tracking Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `trackers` | id, user_id, name, emoji, type (number/rating/boolean/text), unit, group, goal, checkin_config | Metric definitions |
| `entries` | id, user_id, tracker_id, value, text_value, timestamp, notes, metadata | Individual data points |
| `protocols` | id, user_id, name, category, dose_amount, dose_unit, frequency, route, active, expected_outcomes, linked_tracker_id | Supplement/medication definitions |
| `cycles` | id, user_id, protocol_id, cycle_number, start_date, planned_end_date, status | On/off protocol cycles |
| `doses` | id, user_id, protocol_id, cycle_id, taken_at, actual_amount, skipped | Individual dose records |
| `experiments` | id, user_id, name, independent_ids, tracker2_id, start_date, end_date, active | Hypothesis testing |
| `experiment_logs` | id, user_id, experiment_id, date, content, mood_rating | Experiment journal entries |
| `correlations` | id, user_id, input_tracker_id, output_tracker_id, correlation, p_value, optimal_lag_hours, sample_size | Correlation analysis results (TLCC) |

### Task Management Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `todos` | id, user_id, title, completed, priority, due_date, due_time, location, labels, estimated_time, subtasks, actual_minutes, started_at, completed_at | Task items |
| `smart_notes` | id, user_id, content, category_id, flag, processed | Quick notes |
| `note_categories` | id, user_id, name, flag, emoji, color | Flag-based note categories |
| `checklists` | id, user_id, title, items, pinned | Reusable checklists |

### Planning Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `daily_plans` | id, user_id, date, mood/energy/sleep at plan time, ai_prompt_used, ai_model_used, ai_reasoning, status | Daily plan metadata |
| `time_blocks` | id, user_id, plan_id, task_id, title, start_time, end_time, estimated_minutes, actual_minutes, status, sort_order | Scheduled time blocks |
| `activity_templates` | id, user_id, name, category, default_minutes, historical_minutes, preferred_time_slot | Reusable activity templates |
| `calendar_events` | id, user_id, title, start_time, end_time, is_all_day, source, external_id, calendar_name | External calendar events |

### User & Settings Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `settings` | user_id, key, value | Key-value settings store |
| `strategies` | id, user_id, title, description, category, tags, content, findings, is_favorite | Toolbox strategies |

### Notification Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `notification_subscriptions` | id, user_id, endpoint, keys | Web Push subscription records |
| `scheduled_notifications` | id, user_id, title, body, send_at, status | Notification queue |
| `notification_logs` | id, user_id, sent_at, status | Delivery history |

### Type Conversion Layer

The application maintains a strict separation between database types (snake_case) and application types (camelCase). Converter functions in `src/services/supabase.ts` handle bidirectional mapping:

- `dbToTracker()` / `trackerToDb()` - Tracker definitions
- `dbToEntry()` / `entryToDb()` - Data entries
- `dbToProtocol()` / `protocolToDb()` - Protocols
- `dbToCycle()` / `cycleToDb()` - Cycles
- `dbToDose()` / `doseToDb()` - Doses
- `dbToExperiment()` / `experimentToDb()` - Experiments
- `dbToTodo()` / `todoToDb()` - Tasks
- `dbToSmartNote()` / `smartNoteToDb()` - Notes
- `dbToDailyPlan()` / `dailyPlanToDb()` - Plans
- `dbToTimeBlock()` / `timeBlockToDb()` - Time blocks
- `dbToActivityTemplate()` / `activityTemplateToDb()` - Templates
- `dbToCalendarEvent()` / `calendarEventToDb()` - Calendar events
- `dbToStrategy()` / `strategyToDb()` - Strategies
- `dbToCorrelation()` - Correlation results
- `dbToExperimentLog()` / `experimentLogToDb()` - Experiment logs
- `dbToNoteCategory()` - Note categories

---

## Feature Details

### Health Tracking

The most complex feature. Users create custom **trackers** (metrics) of different types:

- **number** - Numeric values with optional unit (e.g., "Sleep Hours" in hrs)
- **rating** - 1-5 scale (e.g., Mood, Energy)
- **boolean** - Yes/no (e.g., "Took Medication")
- **text** - Free-form text (e.g., "Daily Notes")

Trackers can be organized into groups (Health, Mental, Diet, Journal) and configured for daily check-ins.

**Protocols** model supplement/medication regimens with dose amounts, frequency, routes, and expected outcomes. Protocols can be linked to trackers and organized into **cycles** (on/off periods). Individual **doses** are logged against cycles.

**Experiments** test hypotheses by tracking independent variables (protocols or trackers) against a dependent variable (outcome tracker) over a defined period. The system calculates **Time-Lagged Cross Correlation (TLCC)** to detect delayed relationships between metrics.

**Check-in** provides a daily data entry workflow for all trackers configured with `inCheckin: true`.

### Planning

The AI-powered planning system generates structured daily schedules:

1. User provides current state (mood, energy, sleep) and goals
2. System gathers context: pending tasks, calendar events, activity templates
3. AI generates a plan as a set of time blocks
4. User reviews, adjusts, and executes the plan
5. Time blocks can be started/paused/completed with actual time tracking
6. Replanning is available when circumstances change
7. End-of-day reflection captures learnings

Calendar events from Google Calendar, Outlook, and iCloud are imported via iCal URLs and displayed alongside planned blocks.

### Tasks

Standard todo list with:
- Priority levels (low, medium, high, urgent)
- Due dates with optional specific times
- Location and labels
- Subtasks with individual completion
- Time estimation and actual time tracking
- Historical minutes for recurring tasks

**Smart Notes** are a quick-capture system. Notes can be tagged with flags that auto-categorize them into user-defined categories.

### Focus

A Pomodoro timer with:
- Configurable work interval length
- Configurable break interval length
- Session count tracking
- Session history
- Audio/visual notifications

### Checklists

Reusable checklist templates that can be:
- Created with named items
- Pinned for quick access
- Checked/unchecked item by item
- Reset (uncheck all) for repeated use

### Toolbox

A personal strategies library where users store:
- Strategies with title, description, and rich content
- Categories and tags for organization
- Findings (dated notes with effectiveness ratings)
- Favorites for quick access

---

## Settings System

Settings are stored per-user as key-value pairs in the `settings` table, with an in-memory cache for performance. Zod schemas validate settings values (`src/services/settings/settings.schemas.ts`).

Each feature has its own settings modal that opens contextually based on the active tab. The settings button in the bottom nav opens the modal for whichever feature page is currently displayed:

| Tab | Settings Modal |
|---|---|
| health | TrackerSettingsModal |
| protocols | ProtocolSettingsModal |
| experiments | ExperimentSettingsModal |
| check-in | CheckInSettingsModal |
| notes | NoteSettingsModal |
| calendar | CalendarSettingsModal |
| planning | PlanningSettingsModal |
| reflection | ReflectionSettingsModal |
| tasks | TaskSettingsModal |
| focus | PomodoroSettingsModal |
| toolbox | ToolboxSettingsModal |
| checklists | ChecklistSettingsModal |
| home / account | AccountPage (modal overlay) |

---

## Data Export & Import

The application supports full data export/import via JSON. The `exportAllData()` function in `src/services/supabase.ts` reads all tables for the current user and produces a versioned JSON backup (currently version 3). The `importAllData()` function clears existing data and restores from a backup, respecting foreign key ordering.

Exported data includes: trackers, entries, protocols, cycles, doses, experiments, experiment logs, correlations, strategies, and todos.

---

## Environment Variables

Required configuration (defined in `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous API key |
| `VITE_VAPID_PUBLIC_KEY` | No | Web Push VAPID public key (for notifications) |
| `VITE_AI_DEFAULT_PROVIDER` | No | Default AI provider (openai, anthropic, or gemini) |

AI API keys are stored in user settings (per-user, in the database), not as environment variables.

---

## Build & Development

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compilation + Vite production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Generate coverage report (v8 provider) |

### Build Pipeline

```
npm run build
    │
    ├── tsc -b          → TypeScript type checking (project references)
    └── vite build       → Bundle with Rollup
          ├── React plugin for JSX transform
          ├── PWA plugin generates Workbox service worker
          ├── Path alias: @ → ./src
          └── Output to dist/
```

### Deployment

Netlify builds and deploys from the `dist/` directory. The `netlify.toml` configures:
- Build command: `npm run build`
- Publish directory: `dist/`
- SPA fallback: all routes redirect to `/index.html` with status 200

---

## Error Handling

### Global Error Boundary

`src/main.tsx` wraps the entire application in a class-based `ErrorBoundary` that catches uncaught React errors and displays a recovery UI with a reload button.

### Global Event Listeners

Two window-level event listeners capture:
- `unhandledrejection` - Unhandled promise rejections (logged to console)
- `error` - General JavaScript errors (logged to console)

### Auth Loading Timeout

If authentication takes more than 5 seconds, a timeout message appears with a reload button to handle stuck loading states.

### Supabase Configuration Check

Before rendering anything, the app verifies that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. If missing, a configuration error screen is shown.

---

## Default Data Seeding

On first login, `initializeUserData()` checks if the user has any trackers. If not, it seeds 13 default trackers across four groups:

- **Health**: Sleep Hours, Sleep Quality, Training, Steps, Nose Blocked, Asthma, Hunger
- **Mental**: Mood, Energy, Mental Clarity, Stress
- **Diet**: Caffeine
- **Journal**: Daily Notes

Each default tracker has a predefined type (number, rating, or text), optional unit, and check-in configuration.
