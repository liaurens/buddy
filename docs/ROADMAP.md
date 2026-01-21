# Project Roadmap

This document outlines the planned improvements and features for the Student Buddy App.

## 🚧 Immediate Priorities (Refactoring & Basics)

**High Priority**
- [ ] **Tests**: Add unit tests for critical paths (Analysis, Contexts). currently 0% coverage.
    -   Target: `src/utils/analysis.ts` and basic component rendering.
- [ ] **Security**:
    -   Encrypt API keys before storing them in IndexedDB.
    -   Enable proper authentication for Dexie Cloud/Supabase (ensure RLS is active).
    -   Review AI prompts to ensure data is anonymized before sending.
- [ ] **Documentation**:
    -   [x] Create User Manual
    -   [x] Create Quickstart Guide
    -   [x] Update Architecture Docs
- [ ] **Refactoring**:
    -   Continue moving feature-specific code into `src/features/`.
    -   Extract `MainLayout` from `App.tsx` (if not already done).
    -   Address "Magic Strings" for tracker IDs (use constants/enums).

## 🚀 Phase 2: Enhancements

**User Experience**
-   [ ] **Routing**: Implement `react-router-dom` for robust navigation and deep linking.
-   [ ] **Onboarding**: Create a "First Run" tutorial or wizard for new users.
-   [ ] **Error Feedback**: Replace generic `alert()` calls with a proper Toast notification system.
-   [ ] **Accessibility**: Add ARIA labels and improve keyboard navigation.

**Tech Debt**
-   [ ] **Environment Config**: Ensure all secrets and URLs are loaded from `.env` files.
-   [ ] **Performance**: Virtualize long lists (like the history log) to improve rendering speed.

## 🔮 Phase 3: Future Features (The "Wishlist")

-   **Mobile App**: Wrap the PWA in a native container (Capacitor/Tauri) for app store release.
-   **Advanced AI**:
    -   "Smart Task Breakdown" using LLMs to auto-generate subtasks.
    -   "Compassionate Nudge" chatbot for motivation.
-   **Social**:
    -   Anonymous strategy sharing.
    -   Accountability partners (status sharing only).
-   **Wearable Integration**: Sync data from Apple Health/Google Fit.

---
*Based on Technical Assessment (Jan 2026) and internal task lists.*
