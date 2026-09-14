// Several tests assert on formatted wall-clock output, so the suite runs in
// one fixed zone rather than whatever the machine running it is set to.
process.env.TZ = 'UTC';

import '@testing-library/jest-dom/vitest';
