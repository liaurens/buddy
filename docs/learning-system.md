# AI Daily Planning - Learning System

## Overview

The learning system tracks how long tasks actually take vs. estimates, detects patterns in time estimation accuracy, and uses those insights to improve future planning.

## The Learning Loop

### 1. **Plan** (AI generates daily schedule)
- AI creates time blocks with estimated durations
- Considers user state (mood, energy, sleep)
- Respects fixed calendar events
- Applies learned patterns if available

### 2. **Track** (Record actual time spent)
- User starts timer for each time block
- Timer runs with pause/resume capability
- Persists across page refresh (localStorage)
- When completed, actual minutes are recorded

### 3. **Reflect** (Analyze estimation accuracy)
- Daily reflection page shows:
  - Completion rate (% of blocks completed)
  - Time accuracy (avg variance %)
  - Tasks categorized: underestimated / accurate / overestimated
  - Learning patterns with recommendations

### 4. **Learn** (Apply insights to future plans)
- System detects patterns over 30-day window
- Patterns categorized by:
  - **General**: Overall estimation bias
  - **Task Type**: Specific activity patterns (meetings, coding, writing)
  - **Time of Day**: Morning vs afternoon productivity (future)
  - **Buffer**: How much time needed between tasks (future)
- Patterns fed back into AI planning context

## Technical Implementation

### Data Flow

```
Time Block
  ├─ estimated_minutes (from AI or user)
  ├─ actual_minutes (from timer)
  └─ variance = actual - estimated

Learning Patterns (detectPatterns)
  ├─ Overall variance: User typically underestimates by X%
  ├─ Meeting variance: Meetings run Y% over
  ├─ Coding variance: Coding takes Z% longer
  └─ Sample sizes for statistical confidence

AI Planning Context
  ├─ tasks: pending todos
  ├─ calendarEvents: fixed appointments
  ├─ learningPatterns: detected insights ← FEEDBACK LOOP
  └─ activityTemplates: recurring activities

AI Adjustment Logic
  ├─ For new task "Code feature X" (90min estimate)
  ├─ Detect task type: coding
  ├─ Apply coding pattern: +30%
  └─ Adjusted estimate: 117min → 120min
```

### Key Files

#### Data Layer
- `src/services/reflection.ts` - Time tracking and pattern detection
  - `recordBlockCompletion()` - Save actual time
  - `generateDayReflection()` - Analyze single day
  - `detectPatterns()` - Find systematic biases
  - `getLearningPatternsForPlanning()` - Top patterns for AI
  - `applyLearningToEstimate()` - Auto-adjust estimates

#### AI Integration
- `src/services/ai-prompts.ts` - Prompt engineering
  - `formatLearningPatterns()` - Format for AI context
  - System prompt instructs AI to apply patterns
  - User prompt includes pattern section

#### UI Components
- `src/pages/ReflectionPage.tsx` - Daily insights dashboard
- `src/hooks/useTimer.ts` - Time tracking with persistence

#### Types
- `src/types/planning.ts` - PlanGenerationContext with learningPatterns field
- `src/services/reflection.ts` - LearningPattern interface

## Pattern Detection Logic

### Overall Estimation Bias
```typescript
// Analyze all completed tasks
variances = blocks.map(b => (actual - estimated) / estimated * 100)
avgVariance = sum(variances) / count

if (avgVariance > 15%) {
  pattern: "You typically underestimate tasks by 25%"
  recommendation: "Add 25% buffer to all task estimates"
}
```

### Task-Type Patterns
```typescript
// Group by keywords
if (title.includes('meeting')) category = 'meetings'
if (title.includes('code')) category = 'coding'
// ... etc

// Analyze each category
meetings.avgVariance = 18% over
coding.avgVariance = 30% over
writing.avgVariance = 5% under

if (sampleSize >= 3 && abs(variance) > 20%) {
  pattern: "Meetings typically take 18% longer than estimated"
  recommendation: "Increase meeting estimates by 18%"
}
```

### Confidence Requirements
- Minimum 3 samples for task-type patterns
- 30-day lookback window
- Patterns must show >10% variance to be actionable
- Top 5 patterns selected for AI context

## AI Prompt Integration

### Before Learning
```
PENDING TASKS:
1. Team standup meeting [HIGH] (~30min)
2. Code new feature [MEDIUM] (~90min)
```

### After Learning (with patterns)
```
LEARNING PATTERNS (Apply these to your estimates):
1. You typically underestimate tasks by 25% (42 samples)
   → Add 25% buffer to all task estimates
2. Meetings typically take 18% longer than estimated (15 samples)
   → Increase meeting estimates by 18%
3. Coding tasks typically take 30% longer than estimated (8 samples)
   → Increase coding estimates by 30%

PENDING TASKS:
1. Team standup meeting [HIGH] (~30min)
2. Code new feature [MEDIUM] (~90min)

IMPORTANT: Use the learning patterns above to adjust your time estimates.
```

### AI Response
```json
{
  "blocks": [
    {
      "title": "Team standup meeting",
      "estimatedMinutes": 36,  // 30 * 1.18 = 35.4 → 36
      "reasoning": "Applied 18% meeting pattern"
    },
    {
      "title": "Code new feature",
      "estimatedMinutes": 120,  // 90 * 1.30 = 117 → 120
      "reasoning": "Applied 30% coding pattern"
    }
  ]
}
```

## Usage Example

### Day 1: First Plan (No Learning Yet)
```
Morning:
  09:00-09:30  Standup meeting (30min estimate)
  09:30-11:00  Code feature (90min estimate)

Actual:
  09:00-09:35  Standup took 35min (+5min, +17%)
  09:35-11:30  Coding took 115min (+25min, +28%)

Learning: Underestimated both. No patterns yet (need 3+ samples).
```

### Day 5: After Several Days
```
Detected Patterns:
  - Meetings: 5 samples, avg +15%
  - Coding: 4 samples, avg +30%
  - General: Underestimate by 22% overall

Next Plan (AI adjusts automatically):
  09:00-09:35  Standup (30 * 1.15 = 35min)
  09:35-11:45  Code feature (90 * 1.30 = 120min)

Actual:
  09:00-09:33  Standup took 33min (accurate!)
  09:35-11:40  Coding took 125min (close!)

Learning: Accuracy improving. Keep refining.
```

## Future Enhancements

### Phase 5+ Features (Not Yet Implemented)
1. **Time-of-day patterns**
   - Morning productivity vs afternoon slump
   - Optimal time slots for different task types

2. **Activity templates with learning**
   - "Morning routine" learns actual duration
   - Auto-update template averages

3. **Buffer time learning**
   - How much transition time needed
   - Context switching costs

4. **Energy correlation**
   - Low energy days → reduce workload
   - Track mood impact on completion rate

5. **Smart task breakdown**
   - AI suggests subtasks based on similar task history
   - Uses historical data for better estimates

## Database Schema

```sql
-- Time blocks with actual tracking
CREATE TABLE time_blocks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  plan_id UUID REFERENCES daily_plans,
  title TEXT,
  estimated_minutes INTEGER,  -- Original estimate
  actual_minutes INTEGER,      -- Tracked actual
  status TEXT,                 -- pending/completed/skipped
  completed_at TIMESTAMPTZ,    -- When finished
  -- ... other fields
);

-- Pattern analysis uses this data
-- No separate patterns table - computed on demand
```

## Performance Considerations

- **Pattern detection**: Runs on-demand (not on every page load)
- **30-day window**: Balances recency with sample size
- **Top 5 patterns**: Keeps AI context focused
- **Cached reflections**: Daily reflection computed once per day

## Privacy & Data

- All learning data stays in user's Supabase database
- No cross-user learning (privacy-first)
- Patterns derived from user's own task history
- Can clear history by deleting time_blocks

---

**Status**: Phase 4 Complete
- ✅ Phase 4.1: Time tracking with actual vs estimated
- ✅ Phase 4.2: Daily reflection system with pattern detection
- ✅ Phase 4.3: Learning integration into AI planning

**Next**: Phase 5 - Planning UI Components
