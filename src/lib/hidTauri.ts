// Tauri(WKWebViewはWebHID非対応)トランスポート。HIDアクセスはRust側(hidapi)へinvokeで委譲する。
// このモジュールはisTauri()時のみ動的importされるので、@tauri-apps/apiはwebバンドルに入らない
import { type PickerDevice, requestDevicePick } from "./devicePicker";
import type { HidConnection, HidTransport } from "./hidTransport";

export const tauriHidTransport: HidTransport = {
  available: true,
  async open(): Promise<HidConnection | null> {
    const { invoke } = await import("@tauri-apps/api/core");
    const devices = await invoke<PickerDevice[]>("hid_list");
    if (!devices.length) throw new Error("Vial対応キーボードが見つかりません");
    // 1台なら即接続、複数なら選択ダイアログを出す（WebのrequestDeviceダイアログの代替）
    const picked = devices.length === 1 ? devices[0] : await requestDevicePick(devices);
    if (!picked) return null;
    const handle = await invoke<number>("hid_open", { path: picked.path });
    return {
      label: picked.product || "(名称不明)",
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
