# Student Buddy App

**A personal executive-function scaffold for capture, planning, routines, school organization, health tracking, reflection, and AI-assisted follow-through.**

Student Buddy helps you capture what is on your mind, decide what matters next, follow through during the day, and learn from what actually happened. It combines task and note management, daily planning, school workflows, reminders, focus tools, health and mood tracking, personal experiments, growth goals, and a natural-language AI assistant backed by structured Supabase data.

## Documentation

- **[User Manual](./docs/USER_MANUAL.md)** - Complete guide on how to use the app
- **[Quickstart Guide](./docs/QUICKSTART.md)** - Set up and run the project locally
- **[iPhone Shortcut Setup](./docs/iphone_shortcut_setup.md)** - Add Buddy to your iPhone home screen

## Key Features

### Health Tracking
- **Custom Metrics**: Track any biometric data (sleep, mood, energy, etc.)
- **Protocol Management**: Manage supplements and medications with cycle tracking
- **Experiments**: Test hypotheses about your health and habits

### Planning & Productivity
- **AI-Powered Daily Planning**: Generate optimized daily schedules
- **Time Blocking**: Visual calendar with time block management
- **Daily Reflection & Close Day**: Review each day and end it with an explicit one-tap close
- **Focus Timer**: Pomodoro-style focus sessions with break management

### Task Management
- **Smart Task List**: Prioritization, time estimation, and subtasks
- **Quick Notes**: Fast note capture with flag-based auto-categorization
- **Checklists**: Reusable checklists for recurring routines

### School & Capture
- **AI Capture Assistant**: Turn natural language into tasks, notes, reminders, logs, and plans
- **Offline-Safe Capture**: Captures queue locally when offline and sync automatically on reconnect
- **Share to Capture**: Share text or links from other apps straight into the capture input (installed PWA)
- **School Hub**: Manage classes, assignments, deadlines, weekly sessions, and course documents
- **Truthful Today View**: Overdue tasks and upcoming school deadlines surface on the home screen
- **Notifications**: Daily morning/evening anchor nudges, per-task reminders, and a push subscription health check

### Personal Growth
- **Growth Hub**: Track goals, skills, projects, XP, and long-term progress
- **Strategy Library**: Build your personal playbook of tactics and best practices

## Project Structure

```
src/features/
├── health-tracking/    # Analytics and experimentation
├── planning/           # Daily planning and time management
├── tasks/              # Task and note management
├── assistant/          # AI capture and structured assistant tools
├── school/             # Classes, deadlines, sessions, and documents
├── growth/             # Goals, skills, projects, and XP
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
