const { test, expect } = require("@playwright/test");

test("練習データを読み込みスタート画面を表示する", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.location().url.includes("favicon")) return;
    errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#typeline .start-prompt")).toHaveText("▶ スタート");
  expect(errors).toEqual([]);
});

test("無制限モードでは経過時間表示になる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "無制限" }).click();
  await expect(page.locator("#stTimeLbl")).toHaveText("経過時間");
  await expect(page.locator("#stTime")).toHaveText("0.0");
});

test("選択したプレイ時間はリロード後も保持される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "30秒" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "30秒" })).toHaveClass(/active/);
  await expect(page.locator("#stTime")).toHaveText("30.0");
});

test("キーボード未読込で開始すると案内を表示する", async ({ page }) => {
  await page.goto("/");
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline")).toContainText("先にキーボードを読み込んでください");
});
