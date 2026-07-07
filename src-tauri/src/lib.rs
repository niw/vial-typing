// WKWebView doesn't support WebHID, so raw HID access is provided on the Rust side (hidapi)
// and exposed to the frontend via invoke. Protocol handling stays on the frontend (hid.ts).
use std::collections::HashMap;
use std::sync::Mutex;

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use tauri::State;

// Vial keyboards expose a USB HID interface with usage_page=0xFF60 / usage=0x61
const VIAL_USAGE_PAGE: u16 = 0xff60;
const VIAL_USAGE: u16 = 0x61;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceInfo {
    path: String,
    product: String,
    vendor_id: u16,
    product_id: u16,
}

struct HidState {
    api: HidApi,
    open: HashMap<u32, HidDevice>,
    next_handle: u32,
}

// hidapi's HidApi/HidDevice hold raw pointers and aren't Sync, so wrap the whole state in a
// Mutex and make it Tauri managed state (only one command touches it at a time)
struct HidManager(Mutex<HidState>);

impl HidManager {
    fn new() -> Result<Self, String> {
        let api = HidApi::new().map_err(|e| e.to_string())?;
        Ok(HidManager(Mutex::new(HidState {
            api,
            open: HashMap::new(),
            next_handle: 1,
        })))
    }
}

// Enumerate Vial-compatible keyboards (matching usage_page/usage)
#[tauri::command]
fn hid_list(state: State<HidManager>) -> Result<Vec<DeviceInfo>, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    guard.api.refresh_devices().map_err(|e| e.to_string())?;
    let devices = guard
        .api
        .device_list()
        .filter(|d| d.usage_page() == VIAL_USAGE_PAGE && d.usage() == VIAL_USAGE)
        .map(|d| DeviceInfo {
            path: d.path().to_string_lossy().into_owned(),
            product: d.product_string().unwrap_or("").to_string(),
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
        })
        .collect();
    Ok(devices)
}

// Open a device by path and return a handle for subsequent commands
#[tauri::command]
fn hid_open(state: State<HidManager>, path: String) -> Result<u32, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let cpath = std::ffi::CString::new(path).map_err(|e| e.to_string())?;
    let device = guard.api.open_path(&cpath).map_err(|e| e.to_string())?;
    let handle = guard.next_handle;
    guard.next_handle += 1;
    guard.open.insert(handle, device);
    Ok(handle)
}

// Send a 32-byte report and wait (with timeout) for a single 32-byte response report.
// Equivalent to WebHID's sendReport(0, data) (write with report id 0 prefixed)
#[tauri::command]
fn hid_command(
    state: State<HidManager>,
    handle: u32,
    bytes: Vec<u8>,
    timeout_ms: u32,
) -> Result<Vec<u8>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let device = guard
        .open
        .get(&handle)
        .ok_or_else(|| "デバイスが開かれていません".to_string())?;
    let mut report = [0u8; 33];
    for (i, b) in bytes.iter().take(32).enumerate() {
        report[i + 1] = *b;
    }
    device.write(&report).map_err(|e| e.to_string())?;
    let mut buf = [0u8; 32];
    let n = device
        .read_timeout(&mut buf, timeout_ms as i32)
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("デバイスからの応答がありません".to_string());
    }
    Ok(buf.to_vec())
}

// Close the handle and release the device (release it immediately so official Vial can connect)
#[tauri::command]
fn hid_close(state: State<HidManager>, handle: u32) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    guard.open.remove(&handle);
    Ok(())
}

// Read/write the path chosen via the OS save/open dialog (plugin-dialog).
// Web's Blob download/<input> don't work in WKWebView, so the frontend delegates here under Tauri
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

// macOS desktop only (iOS/Android not supported)
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(HidManager::new().expect("HID APIの初期化に失敗"))
        .invoke_handler(tauri::generate_handler![
            hid_list,
            hid_open,
            hid_command,
            hid_close,
            read_text_file,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
