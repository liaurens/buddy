# Student Buddy App

**A personal companion for executive function, self-regulation, and holistic life tracking.**

The Student Buddy App is designed to help you manage your daily life, understand your habits through data, and stay focused on your goals. It combines task management, Pomodoro-style focus tools, and detailed life tracking with correlation analysis.

## 📚 Documentation

Here is everything you need to get started, whether you are a user or a developer:

- **[User Manual](./docs/USER_MANUAL.md)**: A complete guide on how to use the app's features.
- **[Quickstart Guide](./docs/QUICKSTART.md)**: Instructions for developers to set up and run the project locally.
- **[Testing Guide](./docs/TESTING_GUIDE.md)**: How to run tests and check code coverage.
- **[Architecture](./docs/ARCHITECTURE.md)**: Overview of the codebase structure and design patterns.
- **[Project Vision](./docs/project_vision.md)**: The philosophy and future goals of the project.
- **[Tracker Logic](./docs/tracker_logic.md)**: Explanation of the mathematical models used for correlation analysis.
- **[Roadmap](./docs/ROADMAP.md)**: Upcoming features and improvements.
- **[Technical Assessment](./docs/TECHNICAL_ASSESSMENT.md)**: A recent audit of the codebase with scalability and security recommendations.

## 🚀 Key Features

### Health Tracking
-   **Custom Metrics**: Track any biometric data (sleep, mood, energy, etc.)
-   **Correlation Analysis**: Discover hidden patterns and relationships in your data
-   **Protocol Management**: Manage supplements and medications with cycle tracking
-   **Experiments**: Test hypotheses about your health and habits

### Planning & Productivity
-   **AI-Powered Daily Planning**: Generate optimized daily schedules
-   **Time Blocking**: Visual calendar with time block management
-   **Daily Reflection**: Review and learn from each day
-   **Focus Timer**: Pomodoro-style focus sessions with break management

### Task Management
-   **Smart Task List**: Prioritization, time estimation, and subtasks
-   **Quick Notes**: Fast note capture with flag-based auto-categorization
-   **Category System**: Organize notes with custom categories and emojis

### Personal Growth
-   **Strategy Library**: Build your personal playbook of tactics and best practices

## 🏗️ Project Structure

The app uses a **feature-based architecture** where each tool is self-contained:

```
src/features/
├── health-tracking/    # Analytics and experimentation
├── planning/           # Daily planning and time management
├── tasks/              # Task and note management
├── focus/              # Focus tools and timers
├── toolbox/            # Personal strategies library
└── core/               # Shared infrastructure
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed documentation.

## 🛠️ Technology Stack

-   **Frontend**: React 19, TypeScript, Vite
-   **Styling**: Tailwind CSS
-   **State Management**: Custom Hooks with React Query
-   **Database**: Supabase (PostgreSQL) with real-time sync
-   **Testing**: Vitest, React Testing Library
-   **PWA**: Offline-capable Progressive Web App
-   **Architecture**: Feature-based organization (vertical slicing)

## 🤝 Contributing

We welcome contributions! Please see the [Quickstart Guide](./docs/QUICKSTART.md) to set up your environment, and check the [Roadmap](./docs/ROADMAP.md) for tasks to work on.

## Legacy Documentation
*Note: The `docs/` folder may contain older design documents (PDFs, Docx) which serve as historical reference.*
