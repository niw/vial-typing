import { engine } from "./engine";
import { findKeyForChar, type Hint } from "./kb";

// 次に打つべき文字とその打ち方（走行中のみ）。findKeyForCharはメモ化済みなので毎描画で呼んでよい
export function currentExpected(): { ch: string | null; hint: Hint | null } {
  const ch = engine.running && engine.items.length ? engine.expect() : null;
  return { ch, hint: ch != null ? findKeyForChar(ch) : null };
}
