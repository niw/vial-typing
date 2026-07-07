// Tauri transport (WKWebView doesn't support WebHID). HID access is delegated to the Rust side (hidapi) via invoke.
// This module is only dynamically imported when isTauri(), so @tauri-apps/api never ends up in the web bundle
import { type PickerDevice, requestDevicePick } from "./devicePicker";
import type { HidConnection, HidTransport } from "./hidTransport";
import { t } from "./i18n";

export const tauriHidTransport: HidTransport = {
  available: true,
  async open(): Promise<HidConnection | null> {
    const { invoke } = await import("@tauri-apps/api/core");
    const devices = await invoke<PickerDevice[]>("hid_list");
    if (!devices.length) throw new Error(t("device.notFound"));
    // Connect immediately if there's one device; show a picker dialog for multiple (stand-in for the web requestDevice dialog)
    const picked = devices.length === 1 ? devices[0] : await requestDevicePick(devices);
    if (!picked) return null;
    const handle = await invoke<number>("hid_open", { path: picked.path });
    return {
      label: picked.product || t("device.unknownName"),
      vendorId: picked.vendorId,
      productId: picked.productId,
      async command(bytes, timeoutMs) {
        const out = await invoke<number[]>("hid_command", { handle, bytes, timeoutMs });
        return new Uint8Array(out);
      },
      close: () => invoke("hid_close", { handle }).then(() => undefined),
    };
  },
};
