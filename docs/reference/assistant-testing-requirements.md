Here is the complete, compiled document of unit testing requirements for your Multi-Agent AI Assistant.

# Unit Testing Requirements: Multi-Agent AI Assistant

**Terminology Mapping**
* **Manager**: `General Manager` (Tier 1-3 router)
* **Subagent**: `Domain Managers` (Planning, Health, Mental, Content, Personal Improvement, Studying, Projects, Extra)
* **Teacher**: The self-learning pipeline consisting of the `HR Agent` (analyzes logs) and `Trainer Agent` (generates rules).

---

## Part 1: Routing & Fast-Paths (Zero-AI)
*Ensuring common tasks are handled instantly and efficiently without incurring AI API costs.*

* **1.1 Slash Command Execution (Tier 1):** Verify that explicit commands (e.g., `/task Buy milk`) completely bypass the AI classifier and route instantly to the correct tool.
* **1.2 Natural Language Static Rules (Tier 2a):** Verify that hardcoded static rules in the rule engine (e.g., "hoe voel ik me" → mood query) route instantly without invoking the AI wrapper.
* **1.3 Dynamic Rule Injection (Tier 2b):** Verify that the General Manager successfully loads and applies custom, Trainer-generated rules from the `assistant_rules` table at runtime.

---

## Part 2: Tool Execution & Availability
*Ensuring all features are accessible and capable of working together through the central Manager.*

* **2.1 Tool Registry Discovery:** Verify that the General Manager correctly maps and initializes all registered tools defined in the central tool registry.
* **2.2 Multi-Agent Orchestration:** Verify that compound prompts (e.g., "Log my mood as 4 and remind me to call mom") are parsed correctly, triggering the respective Subagents in sequence or parallel.
* **2.3 AI Parameter Extraction:** Verify that Tier 3 AI Classification successfully extracts the required JSON parameters for specific tools (e.g., mapping "I ran for 2 hours" to `duration_minutes: 120`).

---

## Part 3: Error Handling & The "Teacher" Loop
*Ensuring robust error logging and a self-healing architecture.*

* **3.1 Hard Failures & Logging:** Verify that exceptions thrown by a Subagent or tool are caught safely, preventing crashes, returning a friendly explanation, and writing the full stack trace to the `assistant_error_logs` table.
* **3.2 User Feedback Trigger:** Verify that when a user flags a response as "weird" or incorrect via a UI button or feedback command, the interaction is logged with a specific flag in `assistant_logs` for the HR Agent to review.
* **3.3 Subagent Self-Reporting:** Verify that if a Subagent receives an intent but lacks critical data to execute it, it logs this gap to the `assistant_learnings` table before asking the user for clarification.
* **3.4 The Teacher Pipeline Execution:** Simulate the HR Agent finding an anomaly in the logs and verify that it successfully triggers the Trainer Agent to generate a valid correction rule in the `assistant_rules` table.

---

## Part 4: AI Provider Wrapper & Security
*Ensuring secure API handling, proper fallback mechanisms, and strict data isolation.*

* **4.1 AI Provider Switching:** Verify that the AI wrapper correctly reads the user's settings and routes prompts to the configured provider (Anthropic, OpenAI, or Gemini) using the correct API key.
* **4.2 API Fallback & Timeout Handling:** Verify that if the primary AI provider times out or returns a server error, the wrapper logs the failure and gracefully informs the user or attempts a retry.
* **4.3 Conversational Fallback Restrictions:** Verify that unmatched input routes to the Extra Domain's conversational AI, respects the designated token limit, and does not execute unauthorized database mutations.
* **4.4 Strict Data Isolation (RLS Bypass Check):** Because edge functions use the service role key, tests must rigorously verify that all database operations explicitly filter by the authenticated `userId` to prevent cross-user data leakage.

---

## Part 5: Intelligent Parsing & Convenience
*Ensuring the assistant feels intuitive, forgiving, and frictionless.*

* **5.1 Bilingual Date/Time Parsing:** Verify that the date parser accurately translates relative natural language in supported languages (e.g., "volgende week dinsdag", "tomorrow at 5 PM") into correct ISO timestamps without AI processing.
* **5.2 Fuzzy Matching & Typo Resilience:** Verify that minor typos in commands (e.g., `/tasl` instead of `/task`) are fuzzy-matched to the correct Tier 1 command or gracefully handled by Tier 3 AI without throwing rigid "not found" errors.
* **5.3 Contextual Conversation Memory:** Verify that the General Manager passes recent conversation history to the AI, allowing it to correctly resolve relative references (e.g., "Mark the first one as done" after asking for a task list).
* **5.4 Partial Intent Resolution:** Verify that incomplete requests (e.g., `/study` with no subject) pause execution, trigger a conversational follow-up for the missing data, and resume successfully once the user answers.

---

## Part 6: Advanced Self-Learning
*Ensuring the assistant adapts to the specific habits, phrasing, and preferences of the user.*

* **6.1 Explicit Preference Memorization:** Verify that direct user corrections (e.g., "Always put 'reading' in Studying, not Content") are logged as corrections and result in a permanent personalized routing rule for that user.
* **6.2 Implicit Route Optimization:** Simulate repeated use of a Tier 3 AI-classified phrase. Verify that the Teacher pipeline detects this cost inefficiency and creates a permanent zero-cost Tier 2b rule for that phrase.
* **6.3 Proactive Correlation Recognition:** Simulate highly correlated data entries (e.g., logging a low mood whenever a specific task type is entered). Verify that the Teacher flags this as a behavioral note, allowing the conversational AI to proactively adjust its tone or offer relevant strategies.
* **6.4 Ambiguity Resolution Learning:** Verify that when the AI asks the user to clarify an ambiguous single-word entry (e.g., logging "Apple" as a grocery note vs. a project), the user's choice is saved to dictate the default behavior for future identical entries.