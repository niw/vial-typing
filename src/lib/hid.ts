// Vial/VIAプロトコルでのキーマップ読み取りと .vil / vial.json の取り込み。
// HIDの送受信はHidTransport越しに行い、ブラウザ(WebHID)とTauri(Rust)で共通のロジックが動く
import { engine } from "./engine";
import { getHidTransport, type HidConnection } from "./hidTransport";
import { KB, setKeymap } from "./kb";
import { decodeNum, K_NONE, type KeyDef, parseVil } from "./keycodes";
import { parseKLE, type VialDefinition } from "./layout";
import { invalidate, setStatus, ui } from "./store";

function dlog(msg: string) {
  ui.log.push(msg);
  console.log("[vial-typing]", msg);
  invalidate();
}

// apply a vial.json-style definition: {name, matrix:{rows,cols}, layouts:{keymap:[KLE]}}
export function applyDefinition(def: VialDefinition, label?: string) {
  if (!def?.matrix || !def.layouts || !Array.isArray(def.layouts.keymap))
    throw new Error("vial.json形式ではありません");
  const keys = parseKLE(def.layouts.keymap);
  if (!keys.length) throw new Error("レイアウトにキーがありません");
  KB.rows = def.matrix.rows;
  KB.cols = def.matrix.cols;
  KB.physKeys = keys;
  // some stock firmwares ship a generic name ("HID Keyboard") — prefer the OS device name then
  const generic = !def.name || /^hid[ _-]?keyboard$/i.test(def.name.trim()) || /^keyboard$/i.test(def.name.trim());
  KB.name = (generic ? label : def.name) || def.name || label || "Keyboard";
  const empty = [Array.from({ length: KB.rows }, () => Array(KB.cols).fill(K_NONE))];
  setKeymap(empty, "sample");
}

// vial definitions are xz-compressed JSON (RMK & vial-qmk both use the XZ container).
// デコーダはバンドル済みで、必要になったときだけ動的importで読み込む
export async function decompressDefinition(buf: Uint8Array): Promise<string> {
  if (buf[0] === 0xfd && buf[1] === 0x37 && buf[2] === 0x7a) {
    // .xz magic
    const { XzReadableStream } = await import("xz-decompress");
    return await new Response(new XzReadableStream(new Blob([buf as BlobPart]).stream())).text();
  }
  const { LZMA_WORKER } = await import("lzma/src/lzma_worker.js"); // LZMA_ALONE fallback
  return new Promise((res, rej) => {
    LZMA_WORKER.decompress(Array.from(buf), (r, e) => {
      if (e) rej(new Error(String(e)));
      else res(typeof r === "string" ? r : new TextDecoder().decode(new Uint8Array(r)));
    });
  });
}

const CMD_GET_LAYER_COUNT = 0x11,
  CMD_GET_BUFFER = 0x12;

const hex = (u8: Uint8Array, n: number) =>
  Array.from(u8.subarray(0, n))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

// wireless boards can be slow to answer the first command — retry with growing timeouts
async function hidCmdRetry(conn: HidConnection, bytes: number[], tries?: number): Promise<Uint8Array> {
  let err: unknown;
  for (let i = 0; i < (tries || 3); i++) {
    try {
      return await conn.command(bytes, 1200 + i * 1200);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

export async function connectHID() {
  if (engine.running) engine.idle(); // reading a keymap resets to the pre-start menu
  const transport = await getHidTransport();
  if (!transport.available) {
    setStatus("err", "この環境はHID接続に非対応です。Chrome/Edgeを使うか .vil を読み込んでください");
    return;
  }
  let conn: HidConnection | null = null;
  try {
    conn = await transport.open();
    if (!conn) return; // デバイス選択をキャンセル
    setStatus("", "レイアウト定義を読み取り中…");
    ui.log.length = 0;
    dlog(
      "デバイス: " +
        conn.label +
        (conn.vendorId != null ? "  vendor=0x" + conn.vendorId.toString(16) : "") +
        (conn.productId != null ? " product=0x" + conn.productId.toString(16) : ""),
    );

    // --- vial_get_size / vial_get_def: layout definition embedded in the firmware ---
    try {
      try {
        const idr = await hidCmdRetry(conn, [0xfe, 0x00]); // vial_get_keyboard_id (optional)
        dlog("vial応答(FE00): " + hex(idr, 12) + "  → プロトコルv" + (idr[0] | (idr[1] << 8)));
      } catch {
        dlog("FE00応答なし（continue）");
      }
      const szr = await hidCmdRetry(conn, [0xfe, 0x01]);
      dlog("サイズ応答(FE01): " + hex(szr, 8));
      const sz = (szr[0] | (szr[1] << 8) | (szr[2] << 16) | (szr[3] << 24)) >>> 0;
      dlog("定義サイズ: " + sz + " bytes");
      if (sz > 0 && sz < 200000) {
        const comp = new Uint8Array(sz);
        for (let blk = 0; blk * 32 < sz; blk++) {
          const r = await hidCmdRetry(conn, [
            0xfe,
            0x02,
            blk & 0xff,
            (blk >> 8) & 0xff,
            (blk >> 16) & 0xff,
            (blk >> 24) & 0xff,
          ]);
          comp.set(r.subarray(0, Math.min(32, sz - blk * 32)), blk * 32);
        }
        dlog("定義先頭: " + hex(comp, 8) + (comp[0] === 0xfd ? " (xz形式)" : " (xz以外)"));
        const json = await decompressDefinition(comp);
        dlog("展開OK: " + json.length + "文字");
        window.lastDefJson = json; // debugging: raw definition
        const def = JSON.parse(json);
        dlog(
          "定義: name=" +
            def.name +
            " matrix=" +
            (def.matrix && def.matrix.rows + "x" + def.matrix.cols) +
            " layouts=" +
            !!def.layouts?.keymap,
        );
        applyDefinition(def, conn.label);
        dlog("レイアウト適用OK: " + KB.physKeys.length + "キー（マトリクス " + KB.rows + "x" + KB.cols + "）");
        dlog("--- 定義JSON全文（不具合報告用） ---");
        dlog(json);
      } else throw new Error("定義サイズが不正 (" + sz + ")");
    } catch (e) {
      dlog("✗ 定義読み取り失敗: " + e.message);
      dlog(
        "レイアウト不明のままキーマップは読み取りません。vial.jsonをドロップしてから.vilを読み込むか、再試行してください。",
      );
      console.warn("definition read failed:", e);
      setStatus("err", "レイアウト定義の読み取りに失敗: " + e.message + "（読み取りログ参照）");
      const dbg = document.getElementById("dbgwrap") as HTMLDetailsElement | null;
      if (dbg) dbg.open = true;
      return;
    }
    setStatus("", "キーマップを読み取り中…");

    let layerCount = 4;
    try {
      const r = await hidCmdRetry(conn, [CMD_GET_LAYER_COUNT]);
      if (r[1] >= 1 && r[1] <= 16) layerCount = r[1];
    } catch {
      /* keep default */
    }

    const total = layerCount * KB.rows * KB.cols * 2;
    const buf = new Uint8Array(total);
    for (let off = 0; off < total; off += 28) {
      const size = Math.min(28, total - off);
      const r = await hidCmdRetry(conn, [CMD_GET_BUFFER, (off >> 8) & 0xff, off & 0xff, size]);
      buf.set(r.subarray(4, 4 + size), off);
    }
    const layers: KeyDef[][][] = [];
    let i = 0;
    for (let L = 0; L < layerCount; L++) {
      const g: KeyDef[][] = [];
      for (let r = 0; r < KB.rows; r++) {
        const row: KeyDef[] = [];
        for (let c = 0; c < KB.cols; c++) {
          row.push(decodeNum((buf[i] << 8) | buf[i + 1]));
          i += 2;
        }
        g.push(row);
      }
      layers.push(g);
    }
    dlog("キーマップ読み取りOK: " + layerCount + "レイヤー (" + KB.rows + "x" + KB.cols + ")");
    setKeymap(layers, "hid", KB.name || conn.label || "Keyboard");
  } catch (err) {
    setStatus("err", "読み取り失敗: " + err.message + "（USB接続を確認するか .vil を読み込んでください）");
  } finally {
    // release the raw-HID interface right away — only one app can hold it,
    // and keeping it open blocks Vial from connecting to the keyboard
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

export function loadVilText(text: string, name: string) {
  if (engine.running) engine.idle(); // loading a keymap resets to the pre-start menu
  try {
    const data = JSON.parse(text);
    if (data.layouts && data.matrix) {
      // vial.json -> layout definition
      applyDefinition(data, name);
      setStatus("ok", "✓ レイアウト適用: " + KB.name + "（キーマップは未読込）");
      return;
    }
    if (!Array.isArray(data.layout)) throw new Error("layoutがありません");
    const layers = (data.layout as (string | number)[][][]).map((layer) => {
      const g: KeyDef[][] = Array.from({ length: KB.rows }, () => Array(KB.cols).fill(K_NONE));
      layer.forEach((row, r) => {
        if (r < KB.rows && Array.isArray(row))
          row.forEach((k, c) => {
            if (c < KB.cols) g[r][c] = parseVil(k);
          });
      });
      return g;
    });
    // drop trailing layers that are entirely empty/none
    while (
      layers.length > 1 &&
      layers[layers.length - 1].every((row) => row.every((k) => k.t === "none" || k.t === "trans"))
    )
      layers.pop();
    setKeymap(layers, "vil", name);
  } catch (err) {
    setStatus("err", ".vilの解析に失敗: " + err.message);
  }
}
