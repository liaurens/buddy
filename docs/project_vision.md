# Student Buddy App: Project Vision & Roadmap

## 1. Project Overview
The **Student Buddy App** is a personal companion designed to support students in managing their daily lives, with a specific focus on **Executive Function** and **Self-Regulation**. While built with the needs of neurodivergent individuals (ADHD, Autism) in mind, its tools for structure, focus, and reflection are universally beneficial.

### Core Philosophy
- **Structure without Rigidity**: Providing frameworks (like subtasks and timers) that guide rather than force.
- **Data-Driven Self-Awareness**: Using tracking data to reveal patterns (e.g., "I sleep better when I exercise") rather than just logging for the sake of it.
- **Compassionate Productivity**: Focusing on intentions and reflection rather than just "grinding" through tasks.

## 2. Current Features (The "Toolbox")
- **Task Management**:
    - **Chunking**: Breaking big tasks into subtasks to overcome paralysis.
    - **Prioritization**: Visual cues (Urgent/High/Medium/Low) to aid decision-making.
    - **Time Estimation**: Combatting time blindness.
- **Focus Tools**:
    - **Pomodoro Timer**: Visual countdowns to structure work/break cycles.
- **Life Tracking**:
    - **Custom Metrics**: Sleep, Mood, Caffeine, etc.
    - **Correlation Analysis**: Finding relationships between habits.
- **Reflection**:
    - **Daily Journal**: Setting intentions and reviewing the day.
    - **Strategy Toolbox**: Built-in guides for coping mechanisms (Body Doubling, etc.).

## 3. Future Ideas & Research Topics
This section outlines potential directions for the app. These are ideas for brainstorming and feasibility research.

### 🧠 AI Integration (The "Smart Buddy")
*Research Goal: How can LLMs provide personalized, proactive support without being intrusive?*
- **Smart Task Breakdown**:
    - *Idea*: User types "Write History Paper", AI suggests a checklist: "1. Choose topic, 2. Find 3 sources, 3. Write thesis..."
    - *Benefit*: Reduces cognitive load of planning.
- **Pattern Recognition & Insights**:
    - *Idea*: AI analyzes journal entries + tracker data. "I noticed you report 'Low Mood' on days you have high 'Caffeine' and low 'Sleep'. Maybe try cutting off coffee at 2 PM?"
    - *Benefit*: Connects qualitative (journal) and quantitative (tracker) data.
- **The "Compassionate Nudge" Chatbot**:
    - *Idea*: A chat interface that acts as a body double or coach. "Hey, you've been on this task for 2 hours. Want to take a stretch break?"
    - *Benefit*: Provides real-time regulation support.

### 🎮 Gamification & Motivation
*Research Goal: How to make consistency rewarding without creating anxiety?*
- **XP & Leveling**: Earn XP for completing tasks, sticking to habits, or journaling.
- **Streaks (with "Freeze" options)**: Visual streaks for habits, but with "forgiveness" mechanics so one missed day doesn't kill motivation.
- **Collectibles**: Unlock virtual stickers or themes for the dashboard.

### 📊 Advanced Data & Health
*Research Goal: How to reduce manual data entry friction?*
- **Wearable Integration**: Sync Sleep/Heart Rate from Apple Health/Google Fit.
- **Location Context**: "You're at the library. Switch to 'Study Mode'?"
- **Voice Logging**: "Hey Buddy, log 200mg caffeine." (Uses Speech-to-Text).

### 🤝 Community & Social
*Research Goal: How to provide support without social pressure?*
- **Anonymous Strategy Sharing**: Users submit strategies that worked for them to a global "Community Toolbox".
- **Accountability Partners**: Pair up with a friend to see *if* they are working (status only), not *what* they are working on.

### 🎨 Accessibility & Sensory
*Research Goal: How to make the app comfortable for everyone?*
- **Sensory Themes**: "Low Contrast", "Dark Mode", "High Legibility" modes.
- **Text-to-Speech**: Read out tasks or journal prompts for users who prefer audio.
- **Voice Input**: Dictate journal entries.

## 4. Immediate Next Steps for Research
1.  **AI API Feasibility**: Look into OpenAI API or Anthropic API for the "Smart Task Breakdown" feature. Cost vs. Benefit?
2.  **Voice Input**: Research browser-based Speech Recognition APIs (Web Speech API) for easier logging.
3.  **Gamification Logic**: Brainstorm a simple "XP System" that rewards *effort* (e.g., logging an entry) rather than just *success* (e.g., meeting a goal).
