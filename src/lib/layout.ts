// 物理レイアウト: KLE(Keyboard Layout Editor)データの型とパーサ

// 物理キー1個分の配置（KLE由来。x/y/w/hはキーユニット単位、rは回転角）
export interface PhysKey {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  rx: number;
  ry: number;
}

// KLEの1要素: メタオブジェクトか "row,col" ラベル文字列
export type KleItem = { [k: string]: number | boolean | undefined } | string;

// vial.json形式のレイアウト定義
export interface VialDefinition {
  name?: string;
  matrix?: { rows: number; cols: number };
  layouts?: { keymap?: KleItem[][] };
}

// KLE data taken from the Cornix vial.json (keys labelled "row,col")
export const KLE: KleItem[][] = [
  [{ x: 3.5 }, "0,3", { x: 10.5 }, "4,3"],
  [{ x: 2.5, y: -0.875 }, "0,2", { x: 1 }, "0,4", { x: 8.5 }, "4,4", { x: 1 }, "4,2"],
  [{ x: 5.5, y: -0.875 }, "0,5", { x: 6.5 }, "4,5"],
  [{ x: 0.5, y: -0.875 }, "0,0", "0,1", { x: 14.5 }, "4,1", "4,0"],
  [{ x: 3.5, y: -0.375 }, "1,3", { x: 10.5 }, "5,3"],
  [{ x: 2.5, y: -0.875 }, "1,2", { x: 1 }, "1,4", { x: 8.5 }, "5,4", { x: 1 }, "5,2"],
  [{ x: 5.5, y: -0.875 }, "1,5", { x: 6.5 }, "5,5"],
  [{ x: 8, y: -0.9 }, "0,1\n\n\n\n\n\n\n\n\ne", { x: 1.5 }, "1,1\n\n\n\n\n\n\n\n\ne"],
  [{ x: 0.5, y: -0.975 }, "1,0", "1,1", { x: 14.5 }, "5,1", "5,0"],
  [{ x: 3.5, y: -0.375 }, "2,3", { x: 2.2 }, "2,6", { x: 4.1 }, "5,6", { x: 2.2 }, "6,3"],
  [{ x: 2.5, y: -0.875 }, "2,2", { x: 1 }, "2,4", { x: 8.5 }, "6,4", { x: 1 }, "6,2"],
  [{ x: 5.5, y: -0.875 }, "2,5", { x: 6.5 }, "6,5"],
  [{ x: 0.5, y: -0.875 }, "2,0", "2,1", { x: 14.5 }, "6,1", "6,0"],
  [{ x: 8, y: -0.725 }, "0,0\n\n\n\n\n\n\n\n\ne", { x: 1.5 }, "1,0\n\n\n\n\n\n\n\n\ne"],
  [{ x: 2.5, y: -0.525 }, "3,2", { x: 12.5 }, "7,2"],
  [{ x: 0.5, y: -0.75 }, "3,0", "3,1", { x: 14.5 }, "7,1", "7,0"],
  [{ x: 4.1667, y: -0.95 }, "3,3", { x: 9.1666 }, "7,3"],
  [{ r: 8, rx: 5.22, ry: 4.43, y: -1 }, "3,4"],
  [{ r: 16, rx: 6.27, ry: 4.6, y: -1.02 }, "3,5"],
  [{ r: -16, rx: 13.23, x: -1, y: -1.02 }, "7,5"],
  [{ r: -8, rx: 14.28, ry: 4.43, x: -1, y: -1 }, "7,4"],
];

// Parse KLE -> array of physical keys {row,col,x,y,w,h,r,rx,ry}
export function parseKLE(kle: KleItem[][]): PhysKey[] {
  const keys: PhysKey[] = [];
  const c = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, clusterX: 0, clusterY: 0, decal: false };
  for (const row of kle) {
    if (!Array.isArray(row)) continue; // KLE metadata entry
    for (const item of row) {
      if (typeof item === "object") {
        if (item.d) c.decal = true;
        if (typeof item.r === "number") c.r = item.r;
        if (typeof item.rx === "number") {
          c.clusterX = c.rx = item.rx;
          c.x = c.clusterX;
          c.y = c.clusterY;
        }
        if (typeof item.ry === "number") {
          c.clusterY = c.ry = item.ry;
          c.x = c.clusterX;
          c.y = c.clusterY;
        }
        c.x += (item.x as number) || 0;
        c.y += (item.y as number) || 0;
        if (typeof item.w === "number") c.w = item.w;
        if (typeof item.h === "number") c.h = item.h;
      } else {
        const parts = item.split("\n");
        const isEncoder = parts[9] === "e"; // Vial: 10th legend "e" = encoder
        const opt = parts[3] ? parts[3].split(",").map(Number) : null; // VIA layout option "group,choice"
        const mpos = parts[0].split(",").map(Number);
        if (
          !isEncoder &&
          !c.decal &&
          mpos.length === 2 &&
          !Number.isNaN(mpos[0]) &&
          !Number.isNaN(mpos[1]) &&
          (!opt || opt.length < 2 || opt[1] === 0)
        ) {
          // show default layout option (0)
          keys.push({ row: mpos[0], col: mpos[1], x: c.x, y: c.y, w: c.w, h: c.h, r: c.r, rx: c.rx, ry: c.ry });
        }
        c.x += c.w;
        c.w = 1;
        c.h = 1;
        c.decal = false;
      }
    }
    c.y += 1;
    c.x = c.clusterX;
  }
  return keys;
}
