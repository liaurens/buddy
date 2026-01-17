# Architecture & Directory Structure

This project follows a feature-based architecture to ensure scalability and maintainability.

## Directory Structure

```
src/
├── components/       # Shared UI components (Buttons, Inputs, Cards)
├── features/         # Feature-specific logic and components
│   ├── tracker/      # Tracker feature (Dashboard, EntryForm, Analysis)
│   ├── tasks/        # Task management feature
│   ├── focus/        # Focus tools (Pomodoro)
│   └── resources/    # Resources (Journal, Toolbox)
├── pages/            # Top-level application pages/views
├── layouts/          # Layout components (MainLayout)
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
├── App.tsx           # Main application entry point
└── main.tsx          # React DOM rendering
```

## Key Concepts

- **Features**: Self-contained modules that group related components and logic.
- **Pages**: Composition of features and components to form a complete view.
- **Context**: Global state management for cross-cutting concerns (e.g., `TrackerContext`, `TaskContext`).
