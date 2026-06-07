mod file_bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            file_bridge::local_list,
            file_bridge::local_read,
            file_bridge::local_read_b64,
            file_bridge::local_write,
            file_bridge::local_open,
            file_bridge::pick_root,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
