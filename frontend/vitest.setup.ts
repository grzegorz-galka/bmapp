// Several tests assert on formatted wall-clock output, so the suite runs in
// one fixed zone rather than whatever the machine running it is set to.
process.env.TZ = 'UTC';

import '@testing-library/jest-dom/vitest';

// jsdom has <dialog> without showModal() or close(); every modal goes through them.
import { stubDialog } from './src/features/auth/dialogStub';

stubDialog();
