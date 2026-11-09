// Desktop shell for AtelierRoot: serves dist/ in the system WebView and exposes the folder
// commands used by TauriBackend (src/js/81-ws-backends.js). No generic filesystem access is
// granted to the page: every operation goes through fsops::Root and its rules.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fsops;

use fsops::{Entry, FileData, Root, Stat};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

const POLL: Duration = Duration::from_millis(1200);

#[derive(Default)]
struct App {
    root: Mutex<Option<Arc<Root>>>,
    gen: Mutex<u64>,
}

#[derive(Serialize)]
struct Folder { name: String }

fn settings_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

fn save_root(app: &tauri::AppHandle, root: Option<&std::path::Path>) {
    let Some(f) = settings_file(app) else { return };
    if let Some(d) = f.parent() { let _ = std::fs::create_dir_all(d); }
    let v = serde_json::json!({ "root": root.map(|p| p.to_string_lossy().into_owned()) });
    let _ = std::fs::write(f, v.to_string());
}

fn load_root(app: &tauri::AppHandle) -> Option<PathBuf> {
    let text = std::fs::read_to_string(settings_file(app)?).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    v.get("root")?.as_str().map(PathBuf::from)
}

fn current(state: &State<App>) -> Result<Arc<Root>, String> {
    state.root.lock().unwrap().clone().ok_or_else(|| "offline:no hay carpeta abierta".to_string())
}

/// Starts (or restarts) the change poller for the current root; an older poller stops by itself.
fn watch(app: &tauri::AppHandle, root: Arc<Root>) {
    let state = app.state::<App>();
    let my_gen = { let mut g = state.gen.lock().unwrap(); *g += 1; *g };
    let app = app.clone();
    std::thread::spawn(move || {
        let sig = |r: &Root| r.list(false).map(|l| l.iter().map(|e| format!("{}|{}|{}", e.p, e.s, e.m)).collect::<Vec<_>>().join("\n")).unwrap_or_default();
        let mut last = sig(&root);
        loop {
            std::thread::sleep(POLL);
            if *app.state::<App>().gen.lock().unwrap() != my_gen { return; }
            let now = sig(&root);
            if now != last { last = now; let _ = app.emit("ws-changed", ()); }
        }
    });
}

fn open_root(app: &tauri::AppHandle, state: &State<App>, path: PathBuf) -> Result<Folder, String> {
    let root = Arc::new(Root::new(&path).map_err(|e| e.wire())?);
    let name = root.name();
    save_root(app, Some(root.path()));
    *state.root.lock().unwrap() = Some(root.clone());
    watch(app, root);
    Ok(Folder { name })
}

#[tauri::command]
fn ws_root(app: tauri::AppHandle, state: State<App>) -> Option<Folder> {
    if let Some(r) = state.root.lock().unwrap().as_ref() { return Some(Folder { name: r.name() }); }
    let p = load_root(&app)?;
    open_root(&app, &state, p).ok()
}

#[tauri::command]
async fn ws_pick(app: tauri::AppHandle) -> Result<Option<Folder>, String> {
    let picked = app.dialog().file().set_title("Elige la carpeta de tus documentos").blocking_pick_folder();
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| format!("io:{e}"))?;
    let state = app.state::<App>();
    open_root(&app, &state, path).map(Some)
}

#[tauri::command]
fn ws_clear(app: tauri::AppHandle, state: State<App>) {
    *state.root.lock().unwrap() = None;
    *state.gen.lock().unwrap() += 1;
    save_root(&app, None);
}

#[tauri::command]
fn ws_list(state: State<App>, hidden: bool) -> Result<Vec<Entry>, String> {
    current(&state)?.list(hidden).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_read(state: State<App>, p: String, optional: bool) -> Result<Option<FileData>, String> {
    current(&state)?.read(&p, optional).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_write(state: State<App>, p: String, text: String, expect: Option<u64>) -> Result<Stat, String> {
    current(&state)?.write(&p, &text, expect).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_mkdir(state: State<App>, p: String) -> Result<(), String> {
    current(&state)?.mkdir(&p).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_move(state: State<App>, from: String, to: String) -> Result<(), String> {
    current(&state)?.mv(&from, &to).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_remove(state: State<App>, p: String, recursive: bool) -> Result<(), String> {
    current(&state)?.remove(&p, recursive).map_err(|e| e.wire())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(App::default())
        .invoke_handler(tauri::generate_handler![ws_root, ws_pick, ws_clear, ws_list, ws_read, ws_write, ws_mkdir, ws_move, ws_remove])
        .run(tauri::generate_context!())
        .expect("error while running AtelierRoot");
}
