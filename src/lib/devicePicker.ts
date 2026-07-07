// UI bridge for picking one device out of several (Tauri has no native picker dialog for this).
// requestDevicePick() returns a Promise that resolves when the DevicePicker component makes a selection.
import { invalidate } from "./store";

export interface PickerDevice {
  path: string;
  product: string;
  vendorId: number;
  productId: number;
}

export const picker = {
  devices: null as PickerDevice[] | null, // shown while non-null (null = hidden)
  resolve: null as ((device: PickerDevice | null) => void) | null,
};

export function requestDevicePick(devices: PickerDevice[]): Promise<PickerDevice | null> {
  return new Promise((resolve) => {
    picker.devices = devices;
    picker.resolve = resolve;
    invalidate();
  });
}

export function resolveDevicePick(device: PickerDevice | null) {
  const resolve = picker.resolve;
  picker.devices = null;
  picker.resolve = null;
  invalidate();
  resolve?.(device);
}
