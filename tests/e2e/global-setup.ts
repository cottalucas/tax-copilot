import { startFakeVertex } from "./fake-vertex.js";

/** Starts the fake Vertex endpoint for the whole run; Playwright calls the returned teardown. */
export default async function globalSetup() {
  const server = await startFakeVertex();
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
