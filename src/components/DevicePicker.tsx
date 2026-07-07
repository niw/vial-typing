import "./DevicePicker.css";
import { useEffect, useRef } from "react";
import { picker, resolveDevicePick } from "../lib/devicePicker";

// Selection dialog shown on the Tauri build when multiple HID devices are found (the web build uses the browser's own dialog)
export function DevicePicker() {
  const ref = useRef<HTMLDialogElement>(null);
  const devices = picker.devices;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (devices && !dialog.open) dialog.showModal();
    else if (!devices && dialog.open) dialog.close();
  }, [devices]);
  return (
    <dialog
      id="devicePicker"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        resolveDevicePick(null);
      }}
    >
      <h2>キーボードを選択</h2>
      <div className="device-list">
        {devices?.map((d) => (
          <button type="button" key={d.path} className="device" onClick={() => resolveDevicePick(d)}>
            <b>{d.product || "(名称不明)"}</b>
            <span className="mono">
              {d.vendorId.toString(16).padStart(4, "0")}:{d.productId.toString(16).padStart(4, "0")}
            </span>
          </button>
        ))}
      </div>
      <div className="device-cancel">
        <button type="button" onClick={() => resolveDevicePick(null)}>
          キャンセル
        </button>
      </div>
    </dialog>
  );
}
