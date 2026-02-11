# Student Buddy App

**A personal companion for executive function, self-regulation, and holistic life tracking.**

The Student Buddy App helps you manage your daily life, understand your habits through data, and stay focused on your goals. It combines task management, focus tools, and detailed life tracking with correlation analysis.

## Documentation

- **[User Manual](./docs/USER_MANUAL.md)** - Complete guide on how to use the app
- **[Quickstart Guide](./docs/QUICKSTART.md)** - Set up and run the project locally
- **[iPhone Shortcut Setup](./docs/iphone_shortcut_setup.md)** - Add Buddy to your iPhone home screen

## Key Features

### Health Tracking
- **Custom Metrics**: Track any biometric data (sleep, mood, energy, etc.)
- **Correlation Analysis**: Discover hidden patterns in your data
- **Protocol Management**: Manage supplements and medications with cycle tracking
- **Experiments**: Test hypotheses about your health and habits

### Planning & Productivity
- **AI-Powered Daily Planning**: Generate optimized daily schedules
- **Time Blocking**: Visual calendar with time block management
- **Daily Reflection**: Review and learn from each day
- **Focus Timer**: Pomodoro-style focus sessions with break management

### Task Management
- **Smart Task List**: Prioritization, time estimation, and subtasks
- **Quick Notes**: Fast note capture with flag-based auto-categorization
- **Checklists**: Reusable checklists for recurring routines

### Personal Growth
- **Strategy Library**: Build your personal playbook of tactics and best practices

## Project Structure

```
src/features/
├── health-tracking/    # Analytics and experimentation
├── planning/           # Daily planning and time management
├── tasks/              # Task and note management
├── focus/              # Focus tools and timers
├── checklists/         # Reusable checklists
├── toolbox/            # Personal strategies library
└── core/               # Shared infrastructure
```

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query + custom hooks
- **Database**: Supabase (PostgreSQL)
- **PWA**: Offline-capable Progressive Web App
