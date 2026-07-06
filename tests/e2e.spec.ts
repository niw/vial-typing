import { expect, test } from "@playwright/test";

// テスト用の最小QWERTYキーマップ（保存済みキーマップとして復元させる）
function fakeKeymap() {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const physKeys: Record<string, number>[] = [];
  const grid: { t: string; code?: number; mods?: number }[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: { t: string; code?: number; mods?: number }[] = [];
    for (let c = 0; c < 10; c++) {
      physKeys.push({ row: r, col: c, x: c, y: r, w: 1, h: 1, r: 0, rx: 0, ry: 0 });
      const ch = rows[r][c];
      row.push(ch ? { t: "kc", code: 4 + "abcdefghijklmnopqrstuvwxyz".indexOf(ch), mods: 0 } : { t: "none" });
    }
    grid.push(row);
  }
  return {
    v: 1,
    source: "vil",
    label: "Test QWERTY",
    matrixRows: 3,
    matrixCols: 10,
    physKeys,
    kbName: "Test",
    layers: [grid],
  };
}

test("練習データを読み込みスタート画面を表示する", async ({ page }) => {
  const errors: string[] = [];
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

test("ローマ字スタイルはヘボン式が既定でリロード後も保持される", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#selRomaji")).toHaveValue("hepburn");
  await page.selectOption("#selRomaji", "kunrei");
  await page.reload();
  await expect(page.locator("#selRomaji")).toHaveValue("kunrei");
});

test("幅の広い画面では設定と統計が左サイドバーになる", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/");
  const display = await page.locator(".layout").evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("grid");
  const side = (await page.locator(".side").boundingBox())!;
  const main = (await page.locator(".main").boundingBox())!;
  expect(side.x + side.width).toBeLessThanOrEqual(main.x + 1);
  expect(Math.abs(side.y - main.y)).toBeLessThan(30);
});

test("狭い画面では従来どおり縦積みになる", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  const side = (await page.locator(".side").boundingBox())!;
  const main = (await page.locator(".main").boundingBox())!;
  expect(main.y).toBeGreaterThan(side.y + side.height - 1);
});

test("押すべきキーとヒントに指番号が表示される", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0");
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  // 標準的なタッチタイピングの指割り当て (2=人差し指...5=小指)
  const fingers = {
    ...{ q: 5, a: 5, z: 5, w: 4, s: 4, x: 4, e: 3, d: 3, c: 3 },
    ...{ r: 2, f: 2, v: 2, t: 2, g: 2, b: 2, y: 2, h: 2, n: 2, u: 2, j: 2, m: 2 },
    ...{ i: 3, k: 3, o: 4, l: 4, p: 5 },
  };
  const ch = ((await page.locator("#typeline .cur").textContent()) ?? "").trim() as keyof typeof fingers;
  await expect(page.locator("#hint .chip.t .fnum")).toHaveText(String(fingers[ch]));
  await expect(page.locator("#kb .key.hl-target .fingertag")).toHaveText(String(fingers[ch]));
});

test("キー習得モードでも練習モードを選べる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "キー習得" }).click();
  await expect(page.locator("#guided")).toBeVisible();
  await page.getByRole("button", { name: "日本語ローマ字" }).click();
  await expect(page.locator("#guided")).toBeVisible();
  await page.getByRole("button", { name: "記号・レイヤー" }).click();
  await expect(page.locator("#guided")).toBeVisible();
  await page.getByRole("button", { name: "通常" }).click();
  await expect(page.locator("#guided")).toBeHidden();
});

test("キー習得モードでキー一覧とグラフを表示する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "キー習得" }).click();
  await expect(page.locator("#guided")).toBeVisible();
  await expect(page.locator("#keyset .gkey")).toHaveCount(26);
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(20);
  await expect(page.locator("#keyset .gkey.focused")).toHaveCount(1);
  await expect(page.locator("#keyInfo")).toContainText("未計測");
  await expect(page.locator("#keyChart")).toBeVisible();
  await expect(page.locator("#btnGuidedReset")).toBeDisabled(); // 履歴が無いうちは消せない
});

test("既存キーがすべて目標速度に達すると次のキーが解放される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "キー習得" }).click();
  const baseKeys = await page.locator("#keyset .gkey:not(.locked)").allTextContents();
  expect(baseKeys).toHaveLength(6);
  await page.evaluate((letters) => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of letters) histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  }, baseKeys);
  await page.reload();
  await page.getByRole("button", { name: "キー習得" }).click();
  await expect(page.locator("#keyset .gkey:not(.locked)")).toHaveCount(7);
  await expect(page.locator("#keyset .gkey.focused")).toHaveCount(1);
});

test("キー習得モードの走行で打鍵が記録されキーに色が付く", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0"); // 無制限モードならEscで走行を終了できる
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.getByRole("button", { name: "キー習得" }).click();
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 }); // 3-2-1カウントダウン待ち
  for (let i = 0; i < 20; i++) {
    const ch = ((await page.locator("#typeline .cur").textContent()) ?? "").trim();
    await page.keyboard.press(ch);
    await page.waitForTimeout(60);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#resultDlg")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vialTypingGuided") ?? "null"));
  expect(stored.results).toHaveLength(1);
  await expect(page.locator("#keyset .gkey.colored")).not.toHaveCount(0);
});

test("キー習得モードの日本語走行でも打鍵が記録される", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0");
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.getByRole("button", { name: "キー習得" }).click();
  await page.getByRole("button", { name: "日本語ローマ字" }).click();
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  for (let i = 0; i < 20; i++) {
    const ch = ((await page.locator("#typeline .cur").textContent()) ?? "").trim();
    await page.keyboard.press(ch);
    await page.waitForTimeout(60);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#resultDlg")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vialTypingGuided") ?? "null"));
  expect(stored.results).toHaveLength(1);
});

test("コースごとに解放順が変わり記号コースには記号キーも並ぶ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "キー習得" }).click();
  const enOrder = await page.locator("#keyset .gkey").allTextContents();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  const jpOrder = await page.locator("#keyset .gkey").allTextContents();
  expect(jpOrder.join("")).not.toBe(enOrder.join(""));
  await page.getByRole("button", { name: "記号", exact: true }).click();
  await expect(page.locator("#keyset .keyrow")).toHaveCount(2);
  const symbolChips = await page.locator("#keyset .keyrow").nth(1).locator(".gkey").allTextContents();
  expect(symbolChips.length).toBeGreaterThan(10);
  expect(symbolChips).toContain("=");
});

test("練習モードに合わせてコース表示が切り替わる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "キー習得" }).click();
  await page.getByRole("button", { name: "記号・レイヤー" }).click();
  await expect(page.locator(".course-tabs button.active")).toHaveText("記号");
  await expect(page.locator("#keyset .keyrow")).toHaveCount(2);
});

test("キー習得モードの記号走行でもお題が出る", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.getByRole("button", { name: "キー習得" }).click();
  await page.getByRole("button", { name: "記号・レイヤー" }).click();
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#typeline .cur")).not.toBeEmpty();
});

test("全キーが目標速度に達すると解放完了の表示になる", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of "abcdefghijklmnopqrstuvwxyz") histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  });
  await page.reload();
  await page.getByRole("button", { name: "キー習得" }).click();
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(0);
  await expect(page.locator("#guidedStatus")).toContainText("すべてのキーを解放しました");
});

test("履歴を消すボタンで未習得の状態に戻る", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of "abcdefghijklmnopqrstuvwxyz") histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  });
  await page.reload();
  await page.getByRole("button", { name: "キー習得" }).click();
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(0);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "履歴を消す" }).click();
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(20);
  await expect(page.locator("#btnGuidedReset")).toBeDisabled();
  const stored = await page.evaluate(() => localStorage.getItem("vialTypingGuided"));
  expect(stored).toBeNull();
});
