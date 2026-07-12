import { expect, test } from "@playwright/test";

// Drop a file inside the browser to load it (goes through the app's global drop handler)
async function dropFile(page: import("@playwright/test").Page, text: string, name: string) {
  await page.evaluate(
    ({ text, name }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([text], name, { type: "application/json" }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    { text, name },
  );
}

// Minimal QWERTY keymap for testing (restored as if it were a saved keymap)
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

test("saves keymap, practice records, and settings to a file, and restores them from a different state", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of "abcdef") histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);

  // Set the settings that restore will revert, to values different from the defaults
  await page.selectOption("#selTime", "30");
  await page.selectOption("#selRomaji", "kunrei");

  // Save: capture the written Blob's contents and confirm it contains the version plus the keymap and practice records
  await page.evaluate(() => {
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      blob.text().then((t) => ((window as unknown as { __backup?: string }).__backup = t));
      return orig(blob);
    };
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#btnSave").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vial-typing.*\.json$/);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __backup?: string }).__backup ?? null))
    .not.toBeNull();
  const backupText = await page.evaluate(() => (window as unknown as { __backup: string }).__backup);
  const backup = JSON.parse(backupText);
  expect(backup.app).toBe("vial-typing");
  expect(backup.version).toBe(1);
  expect(backup.keymap.label).toBe("Test QWERTY");
  expect(backup.guided.results).toHaveLength(1);
  expect(backup.settings.runSeconds).toBe(30);
  expect(backup.settings.romajiStyle).toBe("kunrei");

  // Reset to the default state, then restore from the file
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#status")).toContainText("default US keyboard");
  await expect(page.locator("#selTime")).not.toHaveValue("30"); // settings are also back to default
  await expect(page.locator("#selRomaji")).toHaveValue("hepburn");
  await dropFile(page, backupText, "backup.json");
  await expect(page.locator("#status")).toContainText("Restored");
  await expect(page.locator("#status")).toHaveClass(/ok/);

  // Settings are also reflected in the UI
  await expect(page.locator("#selTime")).toHaveValue("30");
  await expect(page.locator("#selRomaji")).toHaveValue("kunrei");

  // The restored state is also saved to localStorage and persists after reload
  await page.reload();
  const stored = await page.evaluate(() => ({
    keymap: JSON.parse(localStorage.getItem("vialTypingKeymap") ?? "null"),
    guided: JSON.parse(localStorage.getItem("vialTypingGuided") ?? "null"),
    time: localStorage.getItem("cornixTime"),
    romaji: localStorage.getItem("cornixRomaji"),
  }));
  expect(stored.keymap.label).toBe("Test QWERTY");
  expect(stored.guided.results).toHaveLength(1);
  expect(stored.time).toBe("30");
  expect(stored.romaji).toBe("kunrei");
});

test("does not restore a backup with a newer version", async ({ page }) => {
  await page.goto("/");
  await dropFile(
    page,
    JSON.stringify({ app: "vial-typing", kind: "backup", version: 999, keymap: null, guided: null }),
    "future.json",
  );
  await expect(page.locator("#status")).toContainText("newer version");
  await expect(page.locator("#status")).toHaveClass(/err/);
});

test("loads practice data and shows the start screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.location().url.includes("favicon")) return;
    errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#typeline .start-prompt")).toHaveText("▶ Start");
  expect(errors).toEqual([]);
});

test("shows elapsed time in unlimited mode", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selTime", "0");
  await expect(page.locator("#stTimeLbl")).toHaveText("Elapsed");
  await expect(page.locator("#stTime")).toHaveText("0.0");
});

test("the selected play time persists after reload", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selTime", "30");
  await page.reload();
  await expect(page.locator("#selTime")).toHaveValue("30");
  await expect(page.locator("#stTime")).toHaveText("30.0");
});

test("can start with the default US keyboard even without a loaded keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("default US keyboard");
  await expect(page.locator("#btnForget")).toBeHidden();
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
});

test("romaji style defaults to Hepburn and persists after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#selRomaji")).toHaveValue("hepburn");
  await page.selectOption("#selRomaji", "kunrei");
  await page.reload();
  await expect(page.locator("#selRomaji")).toHaveValue("kunrei");
});

test("settings and stats move to a left sidebar on wide screens", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/");
  const display = await page.locator(".layout").evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("grid");
  const side = (await page.locator(".side").boundingBox())!;
  const main = (await page.locator(".main").boundingBox())!;
  expect(side.x + side.width).toBeLessThanOrEqual(main.x + 1);
  expect(Math.abs(side.y - main.y)).toBeLessThan(30);
});

test("stays stacked vertically as before on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");
  const side = (await page.locator(".side").boundingBox())!;
  const main = (await page.locator(".main").boundingBox())!;
  expect(main.y).toBeGreaterThan(side.y + side.height - 1);
});

test("shows finger numbers on the key to press and the hint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0");
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  // Standard touch-typing finger assignment (2=index finger...5=pinky)
  const fingers = {
    ...{ q: 5, a: 5, z: 5, w: 4, s: 4, x: 4, e: 3, d: 3, c: 3 },
    ...{ r: 2, f: 2, v: 2, t: 2, g: 2, b: 2, y: 2, h: 2, n: 2, u: 2, j: 2, m: 2 },
    ...{ i: 3, k: 3, o: 4, l: 4, p: 5 },
  };
  const ch = ((await page.locator("#typeline .cur").textContent()) ?? "").trim() as keyof typeof fingers;
  await expect(page.locator("#hint .chip.t .fnum")).toHaveText(String(fingers[ch]));
  await expect(page.locator("#kb .key.hl-target .fingertag")).toHaveText(String(fingers[ch]));
});

test("can select a practice mode even in key-mastery mode", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#guided")).toBeVisible();
  await page.selectOption("#selMode", "jp");
  await expect(page.locator("#guided")).toBeVisible();
  await page.selectOption("#selMode", "sym");
  await expect(page.locator("#guided")).toBeVisible();
  await page.selectOption("#selPlaystyle", "normal");
  await expect(page.locator("#guided")).toBeHidden();
});

test("shows the key list and chart in key-mastery mode", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#guided")).toBeVisible();
  await expect(page.locator("#keyset .gkey")).toHaveCount(26);
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(20);
  await expect(page.locator("#keyset .gkey.focused")).toHaveCount(1);
  await expect(page.locator("#keyInfo")).toContainText("Unmeasured");
  await expect(page.locator("#keyChart")).toBeVisible();
  await expect(page.locator("#btnGuidedReset")).toBeDisabled(); // can't be cleared while there's no history yet
});

test("unlocks the next key once all existing keys reach the target speed", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  const baseKeys = await page.locator("#keyset .gkey:not(.locked)").allTextContents();
  expect(baseKeys).toHaveLength(6);
  await page.evaluate((letters) => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of letters) histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  }, baseKeys);
  await page.reload();
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#keyset .gkey:not(.locked)")).toHaveCount(7);
  await expect(page.locator("#keyset .gkey.focused")).toHaveCount(1);
});

test("records keystrokes and colors keys during a key-mastery run", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0"); // in unlimited mode, Esc can end the run
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.selectOption("#selPlaystyle", "guided");
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 }); // waiting for the 3-2-1 countdown
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

test("updates the chart and unlock view live during a key-mastery run", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0"); // unlimited: the run keeps going while we inspect it mid-run
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.selectOption("#selPlaystyle", "guided");

  // No records yet, so the unlocked keys start uncolored
  await expect(page.locator("#keyset .gkey.colored")).toHaveCount(0);

  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 }); // 3-2-1 countdown
  let last = "";
  for (let i = 0; i < 24; i++) {
    const ch = ((await page.locator("#typeline .cur").textContent()) ?? "").trim();
    await page.keyboard.press(ch);
    if (ch) last = ch;
    await page.waitForTimeout(60);
  }

  // Still running (no Escape): the live overlay has already colored keys, and nothing is persisted yet
  await expect(page.locator("#keyset .gkey.colored")).not.toHaveCount(0);
  // The chart/detail follows the most recently typed key, and auto-follow does not pin any cell
  await expect(page.locator("#keyInfo .gkey-name")).toHaveText(last.toUpperCase());
  await expect(page.locator("#keyset .gkey.pinned")).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem("vialTypingGuided"));
  expect(stored).toBeNull();

  // Aborting the run (switch to Normal, then back) reverts the overlay to committed data (none)
  await page.selectOption("#selPlaystyle", "normal");
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#keyset .gkey.colored")).toHaveCount(0);
});

test("clicking a key chip pins the chart, clicking it again returns to auto-follow", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");

  // Idle default: the chart follows the focus key
  const focused = ((await page.locator("#keyset .gkey.focused").textContent()) ?? "").trim();
  await expect(page.locator("#keyInfo .gkey-name")).toHaveText(focused.toUpperCase());

  // Pin a different unlocked key by clicking its chip
  const others = (await page.locator("#keyset .gkey:not(.locked)").allTextContents())
    .map((s) => s.trim())
    .filter((ch) => ch && ch !== focused);
  const pinned = others[0];
  const chip = page.locator("#keyset .gkey", { hasText: new RegExp(`^${pinned}$`) });
  await chip.click();
  await expect(chip).toHaveClass(/pinned/);
  await expect(page.locator("#keyInfo .gkey-name")).toHaveText(pinned.toUpperCase());
  await expect(page.locator("#keyset .gkey.pinned")).toHaveCount(1); // only one cell is pinned

  // Click the same chip again to release the pin and return to the focus key
  await chip.click();
  await expect(chip).not.toHaveClass(/pinned/);
  await expect(page.locator("#keyset .gkey.pinned")).toHaveCount(0);
  await expect(page.locator("#keyInfo .gkey-name")).toHaveText(focused.toUpperCase());
});

test("records keystrokes during a Japanese run in key-mastery mode too", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
    localStorage.setItem("cornixTime", "0");
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.selectOption("#selPlaystyle", "guided");
  await page.selectOption("#selMode", "jp");
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

test("unlock order differs per course, and the symbol course includes symbol keys", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  const enOrder = await page.locator("#keyset .gkey").allTextContents();
  await page.getByRole("button", { name: "Japanese", exact: true }).click();
  const jpOrder = await page.locator("#keyset .gkey").allTextContents();
  expect(jpOrder.join("")).not.toBe(enOrder.join(""));
  await page.getByRole("button", { name: "Symbols", exact: true }).click();
  await expect(page.locator("#keyset .keyrow")).toHaveCount(2);
  const symbolChips = await page.locator("#keyset .keyrow").nth(1).locator(".gkey").allTextContents();
  expect(symbolChips.length).toBeGreaterThan(10);
  expect(symbolChips).toContain("=");
});

test("the course display switches to match the practice mode", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  await page.selectOption("#selMode", "sym");
  await expect(page.locator(".course-tabs button.active")).toHaveText("Symbols");
  await expect(page.locator("#keyset .keyrow")).toHaveCount(2);
});

test("shows a prompt during a symbol run in key-mastery mode too", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.selectOption("#selPlaystyle", "guided");
  await page.selectOption("#selMode", "sym");
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#typeline .cur")).not.toBeEmpty();
});

test("shows a prompt during a normal vim-mode run", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keymap) => {
    localStorage.setItem("vialTypingKeymap", JSON.stringify(keymap));
  }, fakeKeymap());
  await page.reload();
  await expect(page.locator("#status")).toHaveClass(/ok/);
  await page.selectOption("#selMode", "vim");
  await page.locator("#typeline").click();
  await expect(page.locator("#typeline .cur")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#typeline .cur")).not.toBeEmpty();
});

test("shows the Vim course with letter and symbol tracks in key-mastery mode", async ({ page }) => {
  await page.goto("/");
  await page.selectOption("#selPlaystyle", "guided");
  await page.selectOption("#selMode", "vim");
  await expect(page.locator(".course-tabs button.active")).toHaveText("Vim");
  await expect(page.locator("#keyset .keyrow")).toHaveCount(2);
});

test("shows the all-unlocked state once every key reaches the target speed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of "abcdefghijklmnopqrstuvwxyz") histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  });
  await page.reload();
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(0);
  await expect(page.locator("#guidedStatus")).toContainText("All keys unlocked");
});

test("the clear-history button reverts to the unlearned state", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const histogram: Record<string, [number, number, number]> = {};
    for (const ch of "abcdefghijklmnopqrstuvwxyz") histogram[ch] = [10, 0, 200];
    localStorage.setItem("vialTypingGuided", JSON.stringify({ v: 1, results: [{ t: 1, h: histogram }] }));
  });
  await page.reload();
  await page.selectOption("#selPlaystyle", "guided");
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(0);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.locator("#keyset .gkey.locked")).toHaveCount(20);
  await expect(page.locator("#btnGuidedReset")).toBeDisabled();
  const stored = await page.evaluate(() => localStorage.getItem("vialTypingGuided"));
  expect(stored).toBeNull();
});

test.describe("Japanese browser locale", () => {
  test.use({ locale: "ja-JP" });

  test("auto-detects Japanese and renders the UI in Japanese", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "キーボードから読み取る" })).toBeVisible();
    await expect(page.locator("#status")).toContainText("既定のUS配列キーボード");
    await expect(page.locator("#selLang")).toHaveValue("ja");
    await expect(page).toHaveTitle(/タイピング/);
  });

  test("the language toggle overrides the detected locale after reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#selLang")).toHaveValue("ja");
    await page.selectOption("#selLang", "en"); // writes the override and reloads
    await expect(page.getByRole("button", { name: "Read from keyboard" })).toBeVisible();
    await expect(page.locator("#selLang")).toHaveValue("en");
  });
});

// navigator.languages is a preference order; the first supported language wins.
async function fakeLanguages(page: import("@playwright/test").Page, langs: string[]) {
  await page.addInitScript((languages) => {
    Object.defineProperty(navigator, "languages", { get: () => languages, configurable: true });
    Object.defineProperty(navigator, "language", { get: () => languages[0], configurable: true });
  }, langs);
}

test.describe("browser language preference order", () => {
  test("resolves to English when English is preferred over Japanese", async ({ page }) => {
    await fakeLanguages(page, ["en-US", "ja"]);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Read from keyboard" })).toBeVisible();
    await expect(page.locator("#selLang")).toHaveValue("en");
  });

  test("resolves to Japanese when Japanese is preferred over English", async ({ page }) => {
    await fakeLanguages(page, ["ja", "en-US"]);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "キーボードから読み取る" })).toBeVisible();
    await expect(page.locator("#selLang")).toHaveValue("ja");
  });
});
