import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  use: {
    baseURL: "http://localhost:3999",
    channel: "chrome",
    locale: "en-US",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 3999 --strictPort",
    url: "http://localhost:3999/",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
