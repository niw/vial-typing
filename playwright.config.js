const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  use: {
    baseURL: "http://localhost:3999",
    channel: "chrome",
  },
  webServer: {
    command: "python3 -m http.server 3999",
    url: "http://localhost:3999/",
    reuseExistingServer: true,
  },
});
