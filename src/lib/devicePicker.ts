// 複数デバイスから1つを選ばせるためのUI橋渡し（Tauriにはネイティブの選択ダイアログが無い）。
// requestDevicePick()がPromiseを返し、DevicePickerコンポーネントの選択で解決される
import { invalidate } from "./store";

export interface PickerDevice {
  path: string;
  product: string;
  vendorId: number;
  productId: number;
}

export const picker = {
  devices: null as PickerDevice[] | null, // 表示中(null=非表示)
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
