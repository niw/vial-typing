// HID transport abstraction. Protocol handling (hid.ts) runs through this interface,
// so the browser (WebHID) and Tauri (Rust hidapi) implementations can be swapped at runtime
import { isTauri } from "./platform";

export interface HidConnection {
  label: string; // device name used in log/status display
  vendorId?: number;
  productId?: number;
  command(bytes: number[], timeoutMs: number): Promise<Uint8Array>; // send 32B -> wait for one response report
  close(): Promise<void>;
}

export interface HidTransport {
  available: boolean; // whether HID is usable in this environment
  open(): Promise<HidConnection | null>; // pick a device and connect; null if cancelled
}

export async function getHidTransport(): Promise<HidTransport> {
  if (isTauri()) {
    const { tauriHidTransport } = await import("./hidTauri");
    return tauriHidTransport;
  }
  const { webHidTransport } = await import("./hidWeb");
  return webHidTransport;
}
