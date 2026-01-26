# Buddy App Architecture

## Overview

Buddy App is organized using a **feature-based architecture**, where each main tool is self-contained with its own pages, components, hooks, services, and types. This structure prioritizes vertical slicing by domain over horizontal slicing by technical layer.

## Core Principles

1. **Feature Independence** - Each feature folder is self-contained and can be modified without affecting others
2. **Clear Boundaries** - Components, services, and types are organized by feature, not by technical layer
3. **Backward Compatibility** - Legacy context-based state management is maintained through thin wrappers
4. **Consistent Structure** - Every feature follows the same organizational pattern

## Project Structure

```
src/
├── features/                    # Feature-based organization
│   ├── health-tracking/         # Health analytics hub
│   │   ├── pages/              # TrackerPage, ProtocolsPage, ExperimentsPage, CheckInPage
│   │   ├── components/         # Feature-specific UI components
│   │   │   ├── tracker/        # Tracker management UI
│   │   │   ├── protocols/      # Protocol management UI
│   │   │   └── experiments/    # Experiment management UI
│   │   ├── hooks/              # useTrackers, useProtocols, useExperiments
│   │   ├── services/           # Data layer (future extraction from supabase.ts)
│   │   ├── types.ts            # Health tracking type definitions
│   │   ├── index.ts            # Barrel exports
│   │   └── README.md           # Feature documentation
│   │
│   ├── planning/               # Daily planning & execution hub
│   │   ├── pages/              # PlanPage, CalendarPage, ReflectionPage
│   │   ├── components/         # PlanGenerator, TimeBlockList, etc.
│   │   ├── hooks/              # usePlan, useTimer
│   │   ├── services/           # planning.service, ai.service, calendar.service
│   │   ├── types.ts            # Planning type definitions
│   │   ├── index.ts            # Barrel exports
│   │   └── README.md           # Feature documentation
│   │
│   ├── tasks/                  # Task & note management hub
│   │   ├── pages/              # TodoPage, NotesPage
│   │   ├── components/         # Task and note UI components
│   │   │   └── notes/          # Note management UI
│   │   ├── hooks/              # useTasks, useNotes
│   │   ├── services/           # Data layer (future extraction)
│   │   ├── types.ts            # Task and note type definitions
│   │   ├── index.ts            # Barrel exports
│   │   └── README.md           # Feature documentation
│   │
│   ├── focus/                  # Focus tools
│   │   ├── components/         # PomodoroTimer
│   │   ├── types.ts            # Focus type definitions
│   │   ├── index.ts            # Barrel exports
│   │   └── README.md           # Feature documentation
│   │
│   ├── toolbox/                # Personal strategies library
│   │   ├── pages/              # ToolboxPage
│   │   ├── types.ts            # Strategy type definitions
│   │   ├── index.ts            # Barrel exports
│   │   └── README.md           # Feature documentation
│   │
│   └── core/                   # Shared infrastructure
│       ├── pages/              # HomePage, SettingsPage
│       ├── components/         # LoginScreen, ErrorBoundary
│       ├── hooks/              # Shared hooks
│       ├── services/           # Shared services
│       ├── types.ts            # Core type definitions
│       ├── index.ts            # Barrel exports
│       └── README.md           # Feature documentation
│
├── context/                    # Backward compatibility wrappers
│   ├── TrackerContext.tsx      # Delegates to useTrackers hook
│   ├── ExperimentContext.tsx   # Delegates to useExperiments hook
│   ├── ProtocolContext.tsx     # Delegates to useProtocols hook
│   ├── TaskContext.tsx         # Delegates to useTasks hook
│   └── SmartNotesContext.tsx   # Delegates to useNotes hook
│
├── layouts/                    # Layout components
│   └── MainLayout.tsx          # Main app layout with navigation
│
├── hooks/                      # Shared hooks
│   └── useAuth.tsx             # Authentication hook
│
├── services/                   # Shared services
│   └── supabase.ts             # Database client and converters
│
├── types.ts                    # Central type re-exports
└── types/
    └── planning.ts             # Planning type re-exports (backward compatibility)
```

## Feature Organization Pattern

Each feature follows this consistent structure:

```
feature-name/
├── pages/              # Feature-specific pages
├── components/         # Feature-specific components
├── hooks/              # Custom hooks for state management
├── services/           # Business logic and API calls
├── types.ts            # TypeScript type definitions
├── index.ts            # Barrel exports for clean imports
└── README.md           # Feature documentation
```

## Features

### 1. Health Tracking
**Purpose**: Track biometrics, manage supplements/medications, run experiments

**Key Components**:
- Tracker management (custom metrics)
- Daily check-ins (formerly DailyReport)
- Protocol management (supplements/medications)
- Experiment tracking (hypothesis testing)

**State Management**: `useTrackers`, `useProtocols`, `useExperiments` hooks

### 2. Planning
**Purpose**: AI-powered daily planning, calendar integration, time tracking

**Key Components**:
- Daily plan generation (AI-powered)
- Time block management
- Calendar integration
- Daily reflection

**State Management**: `usePlan`, `useTimer` hooks
**AI Services**: OpenAI integration for plan generation

### 3. Tasks
**Purpose**: Todo list management, quick note capture

**Key Components**:
- Task management with subtasks
- Priority and time estimation
- Quick notes with category sorting
- Flag-based auto-categorization (e.g., "-todo", "-boodschap")

**State Management**: `useTasks`, `useNotes` hooks

### 4. Focus
**Purpose**: Pomodoro timer, focus session tracking

**Key Components**:
- Pomodoro timer
- Break management
- Session history

### 5. Toolbox
**Purpose**: Personal strategies and tactics library

**Key Components**:
- Strategy management
- Personal best practices collection

### 6. Core
**Purpose**: Shared infrastructure, authentication, settings

**Key Components**:
- Authentication (Supabase Auth)
- User settings
- Error boundaries
- Shared utilities

## State Management

### Modern Approach (Preferred)
Features use **custom hooks** with React Query for data fetching and mutations:

```typescript
// Direct hook usage (preferred)
import { useTrackers } from '@/features/health-tracking';

function MyComponent() {
    const { trackers, addTracker } = useTrackers();
    // ...
}
```

### Legacy Approach (Backward Compatible)
Context providers are maintained as thin wrappers for backward compatibility:

```typescript
// Context usage (legacy, but still supported)
import { useTracker } from '@/context/TrackerContext';

function MyComponent() {
    const { trackers, addTracker } = useTracker();
    // ...
}
```

Both approaches work identically - contexts simply delegate to the underlying hooks.

## Navigation & Routing

The app uses a tab-based navigation system (not URL-based routing):

```typescript
type AppRoute =
  | 'home'
  | 'health'           // Health tracking dashboard
  | 'protocols'        // Supplement management
  | 'experiments'      // Hypothesis testing
  | 'check-in'         // Daily check-in
  | 'planning'         // Daily plan
  | 'calendar'         // Calendar view
  | 'reflection'       // Daily reflection
  | 'tasks'            // Todo list
  | 'notes'            // Quick notes
  | 'toolbox'          // Personal strategies
  | 'focus'            // Pomodoro timer
  | 'settings';        // User settings
```

## Database Schema

The app uses Supabase (PostgreSQL) with the following main tables:

- `trackers` - Custom metric definitions
- `entries` - Tracker data points
- `protocols` - Supplement/medication protocols
- `cycles` - Protocol cycles
- `doses` - Individual doses
- `experiments` - Hypothesis testing experiments
- `todos` - Task list items
- `smart_notes` - Quick notes with categories
- `note_categories` - Note categorization system
- `daily_plans` - AI-generated daily plans
- `time_blocks` - Scheduled time blocks
- `calendar_events` - Calendar integration

## Type System

Types are organized by feature with central re-exports for backward compatibility:

```typescript
// Feature-specific types
import type { Tracker, Entry } from '@/features/health-tracking/types';
import type { Task } from '@/features/tasks/types';

// Central re-exports (backward compatible)
import type { Tracker, Entry, Task } from '@/types';
```

## Migration History

**Session 1** (Foundation & Pages):
- Created feature directory structure
- Moved all pages to feature folders
- Renamed: DailyReportPage → CheckInPage, SmartNotesPage → NotesPage
- Updated navigation labels

**Session 2** (Components & Services):
- Moved components to feature folders
- Extracted planning services from monolithic files
- Split types into feature-specific files with re-export layer

**Session 3** (Hooks & Cleanup):
- Migrated React Context to custom hooks pattern
- Created backward compatibility wrappers
- Removed empty directories
- Created documentation

## Benefits

### Developer Experience
- **Clear mental model** - Each tool is self-contained
- **Easy to find code** - All task code is in `/features/tasks/`
- **Safe to modify** - Changes to planning don't affect health-tracking
- **Faster onboarding** - New devs can understand one tool at a time
- **Better imports** - `import { PlanGenerator } from '@/features/planning'`

### Maintainability
- **No naming confusion** - One source of truth per concept
- **Consistent structure** - Every tool follows same pattern
- **Easier testing** - Test each feature in isolation
- **Code splitting** - Bundle only needed tools
- **Scalability** - Add new tools without affecting existing ones

## Future Improvements

1. **Path aliases** - Configure `@/features/planning` instead of relative paths
2. **Lazy loading** - Code split each tool for faster initial load
3. **Service extraction** - Move remaining database logic out of supabase.ts
4. **Feature flags** - Enable/disable tools per user
5. **Testing** - Add unit tests per feature folder
6. **URL routing** - Consider React Router for deep linking
7. **Micro-frontends** - If tools become very large

## Contributing

When adding new features:

1. Create feature folder following the standard structure
2. Add README.md explaining the feature's purpose
3. Use custom hooks for state management (not Context API)
4. Keep services feature-specific
5. Export types from feature's types.ts
6. Add barrel export (index.ts)
7. Update this documentation

## Naming Conventions

- **Folders**: kebab-case (`health-tracking/`, `focus/`)
- **Components**: PascalCase (`PlanGenerator.tsx`, `TaskList.tsx`)
- **Services**: camelCase with suffix (`planning.service.ts`)
- **Hooks**: camelCase with prefix (`usePlan.ts`, `useTrackers.ts`)
- **Types**: PascalCase (`Task`, `Tracker`, `DailyPlan`)
