# Testing Guide

This project uses **Vitest** for unit and integration testing.

## Running Tests

To run the test suite once:
```bash
npm run test:run
```

To run tests in watch mode (re-runs on file changes):
```bash
npm test
```

## Code Coverage

To generate a code coverage report:
```bash
npm run test:coverage
```
This will show you which parts of the codebase are covered by tests.

## Writing Tests

-   **Location**: Test files should be co-located with the components they test (e.g., `Component.test.tsx` next to `Component.tsx`) or placed in the `src/test/` directory for general utilities.
-   **Naming**: Use the `.test.ts` or `.test.tsx` extension.
-   **Tools**: We use React Testing Library for component testing.

### Example Test
```tsx
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
});
```
