import { engine } from "./engine";
import { findKeyForChar, type Hint } from "./kb";

// The next character to type and how to type it (only while running). findKeyForChar is memoized, so it's fine to call on every render
export function currentExpected(): { ch: string | null; hint: Hint | null } {
  const ch = engine.running && engine.items.length ? engine.expect() : null;
  return { ch, hint: ch != null ? findKeyForChar(ch) : null };
}
