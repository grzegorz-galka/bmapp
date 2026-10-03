/**
 * Where the development session reads which identity to sign in as.
 *
 * Its own module, holding a constant and nothing else, so that the
 * end-to-end suite can import the key without dragging in anything that
 * touches `import.meta.env` - which exists in the browser and the Vite dev
 * server, but not in the Node process Playwright runs tests in.
 */
export const DEV_EMAIL_KEY = 'bmapp.devEmail';
