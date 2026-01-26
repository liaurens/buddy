# Health Tracking Feature

**Purpose**: Track biometrics, manage supplements/medications, run experiments

## Structure

- `pages/` - Main pages (TrackerPage, ProtocolsPage, ExperimentsPage, CheckInPage)
- `components/` - Feature-specific components organized by subdomain (tracker, protocols, experiments)
- `hooks/` - Custom hooks (useTrackers, useProtocols, useExperiments)
- `services/` - Business logic and API calls (tracker.service.ts, protocol.service.ts, experiment.service.ts)
- `types.ts` - TypeScript types for this feature

## Responsibilities

- Daily health metrics tracking (weight, sleep, mood, etc.)
- Supplement and medication protocol management
- Health experiments with hypothesis testing
- Daily check-in reporting
