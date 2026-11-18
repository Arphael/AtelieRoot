// Desktop shell for AtelieRoot: serves dist/ in the system WebView and exposes the folder
// commands used by TauriBackend (src/js/81-ws-backends.js). No generic filesystem access is
// granted to the page: every operation goes through fsops::Root and its rules.
// Several folders can be open at once (v2.1): each command takes `r`, the index of the folder
// (0 when it is missing, so a v2.0 page keeps working).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fsops;
#[cfg(test)]
mod contract_tests;

use fsops::{Entry, FileData, Root, Stat};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

const POLL: Duration = Duration::from_millis(1200);
const MAX_ROOTS: usize = 12;

#[derive(Default)]
struct App {
    roots: Mutex<Vec<Arc<Root>>>,
    gen: Mutex<u64>,
}

#[derive(Serialize)]
struct Folder { name: String, path: String }

fn folder(r: &Root) -> Folder { Folder { name: r.name(), path: r.path().to_string_lossy().into_owned() } }

fn settings_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

fn save_roots(app: &tauri::AppHandle, roots: &[Arc<Root>]) {
    let Some(f) = settings_file(app) else { return };
    if let Some(d) = f.parent() { let _ = std::fs::create_dir_all(d); }
    let list: Vec<String> = roots.iter().map(|r| r.path().to_string_lossy().into_owned()).collect();
    // "root" keeps the first one for an older version of the app
    let v = serde_json::json!({ "root": list.first(), "roots": list });
    let _ = std::fs::write(f, v.to_string());
}

fn load_roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let Some(text) = settings_file(app).and_then(|f| std::fs::read_to_string(f).ok()) else { return vec![] };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { return vec![] };
    if let Some(a) = v.get("roots").and_then(|x| x.as_array()) {
        return a.iter().filter_map(|x| x.as_str().map(PathBuf::from)).collect();
    }
    v.get("root").and_then(|x| x.as_str()).map(|s| vec![PathBuf::from(s)]).unwrap_or_default()
}

fn current(state: &State<App>, r: Option<usize>) -> Result<Arc<Root>, String> {
    state.roots.lock().unwrap().get(r.unwrap_or(0)).cloned().ok_or_else(|| "offline:no hay carpeta abierta".to_string())
}

/// Starts (or restarts) the change poller for the open folders; an older poller stops by itself.
fn watch(app: &tauri::AppHandle) {
    let state = app.state::<App>();
    let my_gen = { let mut g = state.gen.lock().unwrap(); *g += 1; *g };
    let roots: Vec<Arc<Root>> = state.roots.lock().unwrap().clone();
    let app = app.clone();
    std::thread::spawn(move || {
        let sig = || roots.iter().map(|r| r.list(false).map(|l| l.iter().map(|e| format!("{}|{}|{}", e.p, e.s, e.m)).collect::<Vec<_>>().join("\n")).unwrap_or_default()).collect::<Vec<_>>().join("\n--\n");
        let mut last = sig();
        loop {
            std::thread::sleep(POLL);
            if *app.state::<App>().gen.lock().unwrap() != my_gen { return; }
            let now = sig();
            if now != last { last = now; let _ = app.emit("ws-changed", ()); }
        }
    });
}

fn set_roots(app: &tauri::AppHandle, state: &State<App>, roots: Vec<Arc<Root>>) {
    save_roots(app, &roots);
    *state.roots.lock().unwrap() = roots;
    watch(app);
}

fn pick(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    let picked = app.dialog().file().set_title("Elige la carpeta de tus documentos").blocking_pick_folder();
    let Some(fp) = picked else { return Ok(None) };
    fp.into_path().map(Some).map_err(|e| format!("io:{e}"))
}

#[tauri::command]
fn ws_root(app: tauri::AppHandle, state: State<App>) -> Option<Folder> {
    ws_roots(app, state).into_iter().next()
}

/// The open folders; the first call opens the ones remembered from last time (those that still exist).
#[tauri::command]
fn ws_roots(app: tauri::AppHandle, state: State<App>) -> Vec<Folder> {
    {
        let cur = state.roots.lock().unwrap();
        if !cur.is_empty() { return cur.iter().map(|r| folder(r)).collect(); }
    }
    let roots: Vec<Arc<Root>> = load_roots(&app).iter().filter_map(|p| Root::new(p).ok()).map(Arc::new).take(MAX_ROOTS).collect();
    if roots.is_empty() { return vec![]; }
    let out = roots.iter().map(|r| folder(r)).collect();
    set_roots(&app, &state, roots);
    out
}

/// Opens one folder instead of the open ones.
#[tauri::command]
async fn ws_pick(app: tauri::AppHandle) -> Result<Option<Folder>, String> {
    let Some(path) = pick(&app)? else { return Ok(None) };
    let root = Arc::new(Root::new(&path).map_err(|e| e.wire())?);
    let f = folder(&root);
    let state = app.state::<App>();
    set_roots(&app, &state, vec![root]);
    Ok(Some(f))
}

/// Adds a folder next to the open ones; its index is the last one.
#[tauri::command]
async fn ws_add(app: tauri::AppHandle) -> Result<Option<Folder>, String> {
    let Some(path) = pick(&app)? else { return Ok(None) };
    let root = Arc::new(Root::new(&path).map_err(|e| e.wire())?);
    let state = app.state::<App>();
    let mut roots = state.roots.lock().unwrap().clone();
    if roots.iter().any(|r| r.path() == root.path()) { return Err("exists:esa carpeta ya está abierta".into()); }
    if roots.len() >= MAX_ROOTS { return Err(format!("denied:hasta {MAX_ROOTS} carpetas")); }
    let f = folder(&root);
    roots.push(root);
    set_roots(&app, &state, roots);
    Ok(Some(f))
}

/// Stops showing a folder (nothing on disk changes).
#[tauri::command]
fn ws_drop(app: tauri::AppHandle, state: State<App>, r: usize) {
    let mut roots = state.roots.lock().unwrap().clone();
    if r < roots.len() { roots.remove(r); }
    set_roots(&app, &state, roots);
}

#[tauri::command]
fn ws_clear(app: tauri::AppHandle, state: State<App>) {
    state.roots.lock().unwrap().clear();
    *state.gen.lock().unwrap() += 1;
    save_roots(&app, &[]);
}

#[tauri::command]
fn ws_list(state: State<App>, r: Option<usize>, hidden: bool) -> Result<Vec<Entry>, String> {
    current(&state, r)?.list(hidden).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_read(state: State<App>, r: Option<usize>, p: String, optional: bool) -> Result<Option<FileData>, String> {
    current(&state, r)?.read(&p, optional).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_read_many(state: State<App>, r: Option<usize>, paths: Vec<String>) -> Result<Vec<fsops::ReadItem>, String> {
    current(&state, r)?.read_many(&paths).map_err(|e| e.wire())
}

/// An image of a document, as raw bytes (an ArrayBuffer in the page).
#[tauri::command]
fn ws_read_bin(state: State<App>, r: Option<usize>, p: String) -> Result<tauri::ipc::Response, String> {
    current(&state, r)?.read_bin(&p).map(tauri::ipc::Response::new).map_err(|e| e.wire())
}

/// Writes an image: the bytes are the raw body, the folder index and the path come in the headers `r` and `p` (URI-encoded).
#[tauri::command]
fn ws_write_bin(state: State<App>, request: tauri::ipc::Request) -> Result<Stat, String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else { return Err("io:se esperaban bytes".into()) };
    let h = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).map(String::from);
    let r = h("r").and_then(|s| s.parse().ok());
    let p = h("p").map(|s| percent_decode(&s)).ok_or("io:falta la ruta")?;
    current(&state, r)?.write_bin(&p, data).map_err(|e| e.wire())
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes(); let mut out = Vec::with_capacity(b.len()); let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Some(v) = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) { out.push(v); i += 3; continue; }
        }
        out.push(b[i]); i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Absolute path of a document or folder (for «Copy path»).
#[tauri::command]
fn ws_abs(state: State<App>, r: Option<usize>, p: String) -> Result<String, String> {
    current(&state, r)?.existing(&p).map(|a| a.to_string_lossy().into_owned()).map_err(|e| e.wire())
}

/// «Show in Explorer»: opens the system file manager with the item selected.
#[tauri::command]
fn ws_reveal(app: tauri::AppHandle, state: State<App>, r: Option<usize>, p: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let abs = current(&state, r)?.existing(&p).map_err(|e| e.wire())?;
    app.opener().reveal_item_in_dir(abs).map_err(|e| format!("io:{}", e))
}

/// Links of the "About" dialog open in the system browser; only the project's own pages are allowed.
const LINK_PREFIXES: [&str; 2] = ["https://github.com/Arphael/", "https://arphael.github.io/"];
fn link_allowed(url: &str) -> bool {
    LINK_PREFIXES.iter().any(|p| url.starts_with(p)) && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

#[tauri::command]
fn open_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !link_allowed(&url) { return Err("denied:enlace no permitido".into()); }
    app.opener().open_url(url, None::<&str>).map_err(|e| format!("io:{}", e))
}

#[tauri::command]
fn ws_write(state: State<App>, r: Option<usize>, p: String, text: String, expect: Option<u64>) -> Result<Stat, String> {
    current(&state, r)?.write(&p, &text, expect).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_mkdir(state: State<App>, r: Option<usize>, p: String) -> Result<(), String> {
    current(&state, r)?.mkdir(&p).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_move(state: State<App>, r: Option<usize>, from: String, to: String) -> Result<(), String> {
    current(&state, r)?.mv(&from, &to).map_err(|e| e.wire())
}

#[tauri::command]
fn ws_remove(state: State<App>, r: Option<usize>, p: String, recursive: bool) -> Result<(), String> {
    current(&state, r)?.remove(&p, recursive).map_err(|e| e.wire())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(App::default())
        .invoke_handler(tauri::generate_handler![ws_root, ws_roots, ws_pick, ws_add, ws_drop, ws_clear, ws_list, ws_read, ws_read_many, ws_read_bin, ws_write_bin, ws_abs, ws_reveal, ws_write, open_link, ws_mkdir, ws_move, ws_remove])
        .run(tauri::generate_context!())
        .expect("error while running AtelieRoot");
}

#[cfg(test)]
mod link_tests {
    use super::{link_allowed, percent_decode};
    #[test]
    fn only_project_links_open() {
        assert!(link_allowed("https://github.com/Arphael/AtelieRoot"));
        assert!(link_allowed("https://arphael.github.io/AtelieRoot/"));
        for bad in ["https://evil.example/", "http://github.com/Arphael/x", "file:///C:/x", "https://github.com/Arphael/x y", "https://github.com.evil/Arphael/", "javascript:alert(1)"] {
            assert!(!link_allowed(bad), "{bad}");
        }
    }
    #[test]
    fn image_paths_are_decoded() {
        assert_eq!(percent_decode("notas%2Fassets%2Fcaf%C3%A9%201.png"), "notas/assets/café 1.png");
        assert_eq!(percent_decode("a%2"), "a%2");
        assert_eq!(percent_decode("plain.png"), "plain.png");
    }
}
