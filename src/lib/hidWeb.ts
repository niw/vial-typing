// WebHID (Chrome/Edge) transport. Device selection uses requestDevice's native dialog

import type { HidConnection, HidTransport } from "./hidTransport";
import { t } from "./i18n";

// Send to Vial's raw HID interface (usagePage 0xFF60 / usage 0x61) and wait for one report in response
function command(dev: HIDDevice, bytes: number[], timeoutMs: number): Promise<Uint8Array> {
  const data = new Uint8Array(32);
  data.set(bytes);
  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      dev.removeEventListener("inputreport", onRep);
      reject(new Error(t("device.noResponse")));
    }, timeoutMs);
    const onRep = (e: HIDInputReportEvent) => {
      clearTimeout(timer);
      dev.removeEventListener("inputreport", onRep);
      resolve(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength));
    };
    dev.addEventListener("inputreport", onRep);
    dev.sendReport(0, data).catch((err) => {
      clearTimeout(timer);
      dev.removeEventListener("inputreport", onRep);
      reject(err);
    });
  });
}

export const webHidTransport: HidTransport = {
  available: typeof navigator !== "undefined" && !!navigator.hid,
  async open(): Promise<HidConnection | null> {
    const devs = await navigator.hid.requestDevice({
      filters: [{ usagePage: 0xff60, usage: 0x61 }],
    });
    if (!devs.length) return null; // dialog was canceled
    const dev = devs.find((d) => d.collections.some((c) => c.usagePage === 0xff60)) || devs[0];
    if (!dev.opened) await dev.open();
    return {
      label: dev.productName || t("device.unknownName"),
      vendorId: dev.vendorId,
      productId: dev.productId,
      command: (bytes, timeoutMs) => command(dev, bytes, timeoutMs),
      close: () => dev.close(),
    };
  },
};
