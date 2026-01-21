# Architecture & Directory Structure

This project follows a feature-based architecture to ensure scalability and maintainability.

## Directory Structure

```
src/
├── assets/           # Static assets (images, fonts)
├── components/       # Shared UI components (Buttons, Inputs, Cards)
├── context/          # React Context providers (Global State)
├── features/         # Feature-specific logic and components
│   ├── tracker/      # Tracker feature (Dashboard, EntryForm, Analysis)
│   ├── tasks/        # Task management feature
│   ├── focus/        # Focus tools (e.g., Pomodoro)
│   └── ...           # Other feature modules
├── hooks/            # Custom React hooks (e.g., useLocalStorage)
├── layouts/          # Layout components (MainLayout, AuthLayout)
├── pages/            # Top-level application pages/views
├── services/         # External services (API, Database, AI)
├── test/             # Global test utilities and setup
├── utils/            # Shared helper functions (Date formatting, Math)
├── types.ts          # Shared TypeScript type definitions
├── App.tsx           # Main application component and routing logic
└── main.tsx          # React DOM entry point
```

## Architectural Concepts

### 1. Feature-First Organization
Code is organized by **feature** rather than by technical type. For example, everything related to the "Tracker" (components, hooks, types) should ideally live within `features/tracker/`. This makes it easier to scale the application and potentially split it into micro-frontends or packages later.

### 2. State Management
We use **React Context** for global state management.
-   `TrackerContext`: Manages entries, trackers, and correlation data.
-   `TaskContext`: Manages todo items and lists.
-   `ProtocolContext`: Manages experimental protocols.

### 3. Database
The app uses **Dexie.js**, a wrapper around IndexedDB, for local storage. This ensures the app works offline.
-   **Sync**: Dexie Cloud is used to sync data between devices.
-   **Schema**: Defined in `src/services/db.ts`.

### 4. Styling
We use **Tailwind CSS** for utility-first styling. Global styles and variables are defined in `src/index.css` and `src/App.css`.

### 5. Type Safety
The codebase is written in **TypeScript** (Strict Mode). Shared types are located in `src/types.ts`, while feature-specific types can be co-located in their respective feature folders.
