// Canvas rendering for the per-key speed-over-time chart (called from the component)
import { GUIDED_TARGET_TIME, type GuidedKey, guidedWpm } from "../lib/guided";

// Per-key speed-over-time chart (equivalent to keybr's KeyDetailsChart):
// per-run speed scatter plot + smoothed-speed curve + target-speed horizontal line + current-position vertical line
export function drawKeyChart(canvas: HTMLCanvasElement, key: GuidedKey) {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (!cssWidth) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.body);
  const colors = {
    grid: css.getPropertyValue("--border").trim() || "#eee",
    axis: css.getPropertyValue("--dim").trim() || "#999",
    dot: css.getPropertyValue("--accent2").trim() || "#7c6cf6",
    curve: css.getPropertyValue("--accent").trim() || "#ff5d8f",
    target: css.getPropertyValue("--good").trim() || "#18b566",
    text: css.getPropertyValue("--dim").trim() || "#999",
  };
  const pad = { left: 40, right: 52, top: 16, bottom: 22 };
  const box = { x: pad.left, y: pad.top, w: cssWidth - pad.left - pad.right, h: cssHeight - pad.top - pad.bottom };
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const samples = key.samples.slice(-30);
  const targetWpm = guidedWpm(GUIDED_TARGET_TIME);

  // Determine the tick range
  let xMax = samples.length;
  let nowX = 0;
  if (samples.length && (key.bestConfidence ?? 0) < 1) {
    nowX = samples.length;
    xMax = samples.length + 10; // extend right for an unmastered key to leave room for the outlook
  }
  const speeds = samples.flatMap((s) => [12000 / s.timeToType, 12000 / s.filtered]);
  let yMin = Math.min(targetWpm, ...speeds);
  let yMax = Math.max(targetWpm, ...speeds);
  yMin = Math.max(0, Math.floor(yMin / 5) * 5 - 5);
  yMax = Math.ceil(yMax / 5) * 5 + 5;

  const px = (i: number) => box.x + (xMax > 1 ? ((i - 1) / (xMax - 1)) * box.w : box.w / 2);
  const py = (wpm: number) => box.y + box.h - ((wpm - yMin) / (yMax - yMin)) * box.h;

  // Grid and axes
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const gy = box.y + (box.h / 5) * i;
    ctx.moveTo(box.x, gy);
    ctx.lineTo(box.x + box.w, gy);
    const gx = box.x + (box.w / 5) * i;
    ctx.moveTo(gx, box.y);
    ctx.lineTo(gx, box.y + box.h);
  }
  ctx.stroke();
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();

  ctx.font = "10px sans-serif";
  ctx.fillStyle = colors.text;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 5; i++) {
    const wpm = yMin + ((yMax - yMin) / 5) * i;
    ctx.fillText(String(Math.round(wpm)), box.x - 6, py(wpm));
  }

  if (!samples.length) {
    ctx.textAlign = "center";
    ctx.font = "12px sans-serif";
    ctx.fillText("まだ記録がありません — この文字を打つと記録されます", box.x + box.w / 2, box.y + box.h / 2);
    return;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 5; i++) {
    const v = 1 + ((xMax - 1) / 5) * i;
    ctx.fillText(String(Math.round(v)), px(v), box.y + box.h + 6);
  }

  // Target-speed horizontal line
  const ty = py(targetWpm);
  ctx.strokeStyle = colors.target;
  ctx.beginPath();
  ctx.moveTo(box.x - 6, ty);
  ctx.lineTo(box.x + box.w + 6, ty);
  ctx.stroke();
  ctx.fillStyle = colors.target;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("目標 " + targetWpm, box.x + box.w + 10, ty);

  // Current-position vertical line
  if (nowX > 0) {
    const nx = px(nowX);
    ctx.strokeStyle = colors.axis;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(nx, box.y - 6);
    ctx.lineTo(nx, box.y + box.h + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colors.text;
    ctx.fillText("今", nx + 3, box.y - 2);
  }

  // Per-run measured-speed scatter plot
  ctx.fillStyle = colors.dot;
  samples.forEach((s, i) => {
    ctx.beginPath();
    ctx.arc(px(i + 1), py(12000 / s.timeToType), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Smoothed-speed curve
  ctx.strokeStyle = colors.curve;
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, i) => {
    const x = px(i + 1);
    const y = py(12000 / s.filtered);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
