// WebKit(WKWebView)はWebHID非対応なので、raw HIDアクセスをRust側(hidapi)で提供し、
// フロントエンドからinvokeで叩けるようにする。プロトコル処理はフロント側(hid.ts)が担う。
use std::collections::HashMap;
use std::sync::Mutex;

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use tauri::State;

// VialのキーボードはUSB HIDの usage_page=0xFF60 / usage=0x61 のインターフェースを持つ
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

// hidapiのHidApi/HidDeviceは生ポインタを持ちSyncではないため、状態全体をMutexで包んで
// Tauriのmanaged stateにする（同時に触るのは常に1コマンドだけ）
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

// Vial対応(usage_page/usageが一致する)キーボードを列挙する
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

// パス指定でデバイスを開き、以後のコマンドで使うハンドルを返す
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

// 32バイトのレポートを送り、1レポート(32バイト)の応答をタイムアウト付きで待つ。
// WebHIDの sendReport(0, data) に相当（report id 0 を先頭に付けて書き込む）
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

// ハンドルを閉じてデバイスを解放する（Vial本家が接続できるよう即座に手放す）
#[tauri::command]
fn hid_close(state: State<HidManager>, handle: u32) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    guard.open.remove(&handle);
    Ok(())
}

// macOS デスクトップ専用（iOS/Android は対象外）
pub fn run() {
    tauri::Builder::default()
        .manage(HidManager::new().expect("HID APIの初期化に失敗"))
        .invoke_handler(tauri::generate_handler![
            hid_list,
            hid_open,
            hid_command,
            hid_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
