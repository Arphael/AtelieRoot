//! Folder operations for the desktop app. Mirrors server/atelieroot-server.js and docs/CONTRACT.md:
//! relative "/" paths only, everything confined to the chosen root (symlinks resolved), only
//! `.md`/`.markdown` outside hidden folders and anything inside `.atelieroot/` may be written,
//! atomic writes, and `expect` (mtime last read) prevents overwriting outside changes.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

pub const MAX_ENTRIES: usize = 50_000;
pub const MAX_BODY: usize = 25 * 1024 * 1024;
const RESTORE_EXT: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "pdf", "txt", "csv", "tsv", "json", "yml",
    "yaml", "toml", "ini", "log", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "zip",
    "mp3", "mp4", "wav", "webm",
];

/// Error codes understood by the frontend (WsError.code).
#[derive(Debug, PartialEq)]
pub enum Code { Conflict, Exists, Missing, Denied, Io }

#[derive(Debug)]
pub struct OpError { pub code: Code, pub msg: String }

impl OpError {
    fn new(code: Code, msg: impl Into<String>) -> Self { OpError { code, msg: msg.into() } }
    /// "code:message", parsed by TauriBackend in src/js/81-ws-backends.js.
    pub fn code_str(&self) -> &'static str {
        match self.code { Code::Conflict => "conflict", Code::Exists => "exists", Code::Missing => "missing", Code::Denied => "denied", Code::Io => "io" }
    }
    pub fn wire(&self) -> String { format!("{}:{}", self.code_str(), self.msg) }
}

impl From<std::io::Error> for OpError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => OpError::new(Code::Missing, "no existe"),
            std::io::ErrorKind::PermissionDenied => OpError::new(Code::Denied, e.to_string()),
            std::io::ErrorKind::AlreadyExists => OpError::new(Code::Exists, "el destino ya existe"),
            _ => OpError::new(Code::Io, e.to_string()),
        }
    }
}

pub type R<T> = Result<T, OpError>;

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Entry { pub p: String, pub t: &'static str, pub s: u64, pub m: u64 }

#[derive(Serialize, Debug)]
pub struct FileData { pub text: String, pub m: u64, pub s: u64 }

#[derive(Serialize, Debug)]
pub struct Stat { pub m: u64, pub s: u64 }

/// One result of read_many: the file, or { error: code } (same codes as the single read).
#[derive(Serialize, Debug)]
#[serde(untagged)]
pub enum ReadItem { File(FileData), Failed { error: &'static str } }

/// Paths per read_many call (same limit as POST /api/files in the dev server).
pub const MAX_MANY: usize = 500;

/// Relative "/" path -> parts, or None if it could escape or is malformed.
pub fn safe_rel(rel: &str) -> Option<Vec<String>> {
    if rel.is_empty() || rel.contains('\0') || rel.contains('\\') || rel.starts_with('/') { return None; }
    let b = rel.as_bytes();
    if b.len() >= 2 && b[1] == b':' && b[0].is_ascii_alphabetic() { return None; }
    let parts: Vec<String> = rel.split('/').filter(|p| !p.is_empty()).map(String::from).collect();
    if parts.is_empty() || parts.iter().any(|p| p == ".." || p == "." || p.len() > 255 || p.contains(':')) { return None; }
    Some(parts)
}

fn meta_dot_ok(p: &str) -> bool { !p.starts_with('.') || p == ".keep" || p == ".gitignore" }

fn is_md(name: &str) -> bool { let l = name.to_lowercase(); l.ends_with(".md") || l.ends_with(".markdown") }

pub fn writable(parts: &[String]) -> bool {
    if parts[0] == ".atelieroot" { return parts.len() > 1 && parts[1..].iter().all(|p| meta_dot_ok(p)); }
    if parts.iter().any(|p| p.starts_with('.')) { return false; }
    is_md(parts.last().unwrap())
}

pub fn writable_dir(parts: &[String]) -> bool {
    if parts[0] == ".atelieroot" { parts.len() > 1 } else { !parts.iter().any(|p| p.starts_with('.')) }
}

fn restorable_ext(name: &str) -> bool {
    name.rsplit_once('.').map(|(_, e)| RESTORE_EXT.contains(&e.to_lowercase().as_str())).unwrap_or(false)
}

fn ms(md: &fs::Metadata) -> u64 {
    md.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

pub struct Root { root: PathBuf }

impl Root {
    pub fn new(root: &Path) -> R<Self> {
        let root = fs::canonicalize(root)?;
        if !root.is_dir() { return Err(OpError::new(Code::Missing, "la carpeta no existe")); }
        // v2.0 renamed the hidden folder: .atelierroot/ (v1) becomes .atelieroot/
        let (old, new) = (root.join(".atelierroot"), root.join(".atelieroot"));
        if old.is_dir() && !new.exists() { let _ = fs::rename(&old, &new); }
        Ok(Root { root })
    }
    pub fn name(&self) -> String { self.root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default() }
    pub fn path(&self) -> &Path { &self.root }

    /// Absolute path for validated parts; the existing part of it must resolve inside the root.
    fn abs(&self, parts: &[String]) -> R<PathBuf> {
        let mut abs = self.root.clone();
        for p in parts { abs.push(p); }
        if abs.components().any(|c| matches!(c, Component::ParentDir)) { return Err(OpError::new(Code::Denied, "fuera de la carpeta")); }
        let mut cur = abs.clone();
        loop {
            match fs::canonicalize(&cur) {
                Ok(real) => { if real.starts_with(&self.root) { return Ok(abs); } return Err(OpError::new(Code::Denied, "fuera de la carpeta")); }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => { if !cur.pop() { return Err(OpError::new(Code::Denied, "fuera de la carpeta")); } }
                Err(_) => return Err(OpError::new(Code::Denied, "fuera de la carpeta")),
            }
        }
    }

    fn parts(rel: &str) -> R<Vec<String>> { safe_rel(rel).ok_or_else(|| OpError::new(Code::Denied, "ruta no válida")) }

    pub fn list(&self, hidden: bool) -> R<Vec<Entry>> {
        let mut out = Vec::new();
        self.walk(&self.root, "", hidden, &mut out);
        Ok(out)
    }

    fn walk(&self, dir: &Path, rel: &str, hidden: bool, out: &mut Vec<Entry>) {
        let Ok(rd) = fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            if out.len() >= MAX_ENTRIES { return; }
            let name = e.file_name().to_string_lossy().into_owned();
            let Ok(ft) = e.file_type() else { continue };
            if name == "node_modules" || ft.is_symlink() { continue; }
            let is_meta = rel.is_empty() && name == ".atelieroot";
            let in_meta = rel == ".atelieroot" || rel.starts_with(".atelieroot/");
            if name.starts_with('.') && !(hidden && (is_meta || in_meta)) { continue; }
            let p = if rel.is_empty() { name.clone() } else { format!("{}/{}", rel, name) };
            if ft.is_dir() {
                out.push(Entry { p: p.clone(), t: "d", s: 0, m: 0 });
                self.walk(&e.path(), &p, hidden, out);
            } else if ft.is_file() && (is_md(&name) || (hidden && p.starts_with(".atelieroot/"))) {
                if let Ok(md) = e.metadata() { out.push(Entry { p, t: "f", s: md.len(), m: ms(&md) }); }
            }
        }
    }

    pub fn read(&self, rel: &str, optional: bool) -> R<Option<FileData>> {
        let parts = Self::parts(rel)?;
        if parts[0] != ".atelieroot" && !writable(&parts) { return Err(OpError::new(Code::Denied, "solo se leen .md")); }
        let abs = self.abs(&parts)?;
        match fs::metadata(&abs) {
            Ok(md) if md.is_file() => Ok(Some(FileData { text: fs::read_to_string(&abs)?, m: ms(&md), s: md.len() })),
            Ok(_) => Err(OpError::new(Code::Missing, "no es un archivo")),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && optional => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Many reads in one call (opening a large folder); each path follows the rules of read.
    pub fn read_many(&self, paths: &[String]) -> R<Vec<ReadItem>> {
        if paths.len() > MAX_MANY { return Err(OpError::new(Code::Denied, format!("hasta {} rutas", MAX_MANY))); }
        Ok(paths.iter().map(|p| match self.read(p, false) {
            Ok(Some(f)) => ReadItem::File(f),
            Ok(None) => ReadItem::Failed { error: "missing" },
            Err(e) => ReadItem::Failed { error: e.code_str() },
        }).collect())
    }

    pub fn write(&self, rel: &str, text: &str, expect: Option<u64>) -> R<Stat> {
        let parts = Self::parts(rel)?;
        if !writable(&parts) { return Err(OpError::new(Code::Denied, "solo se escriben .md y .atelieroot/")); }
        if text.len() > MAX_BODY { return Err(OpError::new(Code::Io, "demasiado grande")); }
        let abs = self.abs(&parts)?;
        if let Some(exp) = expect {
            let cur = fs::metadata(&abs).map(|m| ms(&m)).unwrap_or(0);
            if cur != 0 && cur != exp { return Err(OpError::new(Code::Conflict, "el archivo cambió en el disco")); }
        }
        let dir = abs.parent().ok_or_else(|| OpError::new(Code::Io, "sin carpeta"))?;
        fs::create_dir_all(dir)?;
        let tmp = dir.join(format!(".atelieroot-tmp-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)));
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(text.as_bytes())?;
            f.sync_all()?;
        }
        if let Err(e) = fs::rename(&tmp, &abs) { let _ = fs::remove_file(&tmp); return Err(e.into()); }
        let md = fs::metadata(&abs)?;
        Ok(Stat { m: ms(&md), s: md.len() })
    }

    pub fn mkdir(&self, rel: &str) -> R<()> {
        let parts = Self::parts(rel)?;
        if !writable_dir(&parts) { return Err(OpError::new(Code::Denied, "ruta no válida")); }
        fs::create_dir_all(self.abs(&parts)?)?;
        Ok(())
    }

    pub fn remove(&self, rel: &str, recursive: bool) -> R<()> {
        let parts = Self::parts(rel)?;
        // Same rule as the Node server: only .md files and things inside .atelieroot/ are ever deleted.
        // Visible folders reach the trash by being moved, never by being deleted.
        if !writable(&parts) { return Err(OpError::new(Code::Denied, "solo se borran .md y .atelieroot/")); }
        let abs = self.abs(&parts)?;
        let r = match fs::symlink_metadata(&abs) {
            Ok(m) if m.is_dir() => if recursive { fs::remove_dir_all(&abs) } else { fs::remove_dir(&abs) },
            Ok(_) => fs::remove_file(&abs),
            Err(e) => Err(e),
        };
        match r { Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), r => r.map_err(Into::into) }
    }

    pub fn mv(&self, from: &str, to: &str) -> R<()> {
        let a = Self::parts(from)?;
        let b = Self::parts(to)?;
        let aa = self.abs(&a)?;
        let bb = self.abs(&b)?;
        let md = fs::metadata(&aa).map_err(|_| OpError::new(Code::Missing, "no existe"))?;
        let is_dir = md.is_dir();
        let from_trash = a[0] == ".atelieroot" && a.get(1).map(|s| s == "trash").unwrap_or(false);
        let safe_dest = !b.iter().any(|x| x.starts_with('.')) && b[0] != ".atelieroot";
        let restorable = from_trash && safe_dest && !is_dir && restorable_ext(b.last().unwrap());
        let ok = if is_dir { writable_dir(&a) && writable_dir(&b) } else { (writable(&a) && writable(&b)) || restorable };
        if !ok { return Err(OpError::new(Code::Denied, "movimiento no permitido")); }
        if bb.exists() { return Err(OpError::new(Code::Exists, "el destino ya existe")); }
        if let Some(p) = bb.parent() { fs::create_dir_all(p)?; }
        fs::rename(&aa, &bb)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v1_hidden_folder_is_renamed_on_open() {
        let d = tempfile::tempdir().unwrap();
        let dir = d.path().join("notas");
        fs::create_dir_all(dir.join(".atelierroot").join("trash")).unwrap();
        fs::write(dir.join(".atelierroot").join("state.json"), "{\"v\":1}").unwrap();
        let _r = Root::new(&dir).unwrap();
        assert!(!dir.join(".atelierroot").exists());
        assert_eq!(fs::read_to_string(dir.join(".atelieroot").join("state.json")).unwrap(), "{\"v\":1}");
        assert!(dir.join(".atelieroot").join("trash").is_dir());
    }

    fn setup() -> (tempfile::TempDir, Root) {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("notas")).unwrap();
        let r = Root::new(&d.path().join("notas")).unwrap();
        (d, r)
    }

    #[test]
    fn dangerous_paths_are_rejected() {
        for p in ["", "/etc/passwd", "../x.md", "a/../../x.md", "a\\b.md", "C:/x.md", "c:x.md", "./a.md", "a/./b.md", "a\0.md"] {
            assert!(safe_rel(p).is_none(), "{p:?} should be rejected");
        }
        assert_eq!(safe_rel("a//b.md").unwrap(), vec!["a", "b.md"]);
    }

    #[test]
    fn only_md_and_atelieroot_are_writable() {
        let (_d, r) = setup();
        assert!(r.write("a.md", "x", None).is_ok());
        assert!(r.write("A.MARKDOWN", "x", None).is_ok());
        assert!(r.write(".atelieroot/state.json", "{}", None).is_ok());
        for p in ["a.txt", "a.js", ".git/config", "dir/.hidden.md", ".atelieroot/.secret", ".atelieroot"] {
            assert_eq!(r.write(p, "x", None).unwrap_err().code, Code::Denied, "{p}");
        }
    }

    #[test]
    fn read_write_and_mtime() {
        let (_d, r) = setup();
        let st = r.write("sub/a.md", "hola", None).unwrap();
        let f = r.read("sub/a.md", false).unwrap().unwrap();
        assert_eq!(f.text, "hola");
        assert_eq!(f.m, st.m);
        assert!(r.read("nope.md", true).unwrap().is_none());
        assert_eq!(r.read("nope.md", false).unwrap_err().code, Code::Missing);
        assert_eq!(r.read("x.txt", true).unwrap_err().code, Code::Denied);
    }

    #[test]
    fn expect_prevents_overwriting_outside_changes() {
        let (d, r) = setup();
        let st = r.write("a.md", "v1", None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(30));
        fs::write(d.path().join("notas/a.md"), "outside").unwrap();
        assert_eq!(r.write("a.md", "mine", Some(st.m)).unwrap_err().code, Code::Conflict);
        assert_eq!(fs::read_to_string(d.path().join("notas/a.md")).unwrap(), "outside");
        let cur = r.read("a.md", false).unwrap().unwrap();
        assert!(r.write("a.md", "mine", Some(cur.m)).is_ok());
        assert!(r.write("new.md", "x", Some(12345)).is_ok(), "expect on a missing file is not a conflict");
    }

    #[test]
    fn list_shows_only_md_and_visible_folders() {
        let (d, r) = setup();
        let n = d.path().join("notas");
        fs::create_dir_all(n.join("P/Sub")).unwrap();
        fs::create_dir_all(n.join(".git")).unwrap();
        fs::create_dir_all(n.join("node_modules")).unwrap();
        fs::write(n.join("P/a.md"), "x").unwrap();
        fs::write(n.join("b.txt"), "x").unwrap();
        fs::write(n.join(".git/c.md"), "x").unwrap();
        r.write(".atelieroot/state.json", "{}", None).unwrap();
        let mut ps: Vec<String> = r.list(false).unwrap().into_iter().map(|e| e.p).collect();
        ps.sort();
        assert_eq!(ps, vec!["P", "P/Sub", "P/a.md"]);
        let hidden: Vec<String> = r.list(true).unwrap().into_iter().map(|e| e.p).collect();
        assert!(hidden.contains(&".atelieroot/state.json".to_string()));
        assert!(!hidden.iter().any(|p| p.starts_with(".git")));
    }

    #[test]
    fn mkdir_move_and_remove() {
        let (d, r) = setup();
        let n = d.path().join("notas");
        r.mkdir("A/B").unwrap();
        r.write("A/x.md", "x", None).unwrap();
        r.mv("A/x.md", "A/B/y.md").unwrap();
        assert!(n.join("A/B/y.md").exists());
        r.write("A/z.md", "z", None).unwrap();
        assert_eq!(r.mv("A/z.md", "A/B/y.md").unwrap_err().code, Code::Exists);
        assert_eq!(r.mv("A/z.md", "A/z.txt").unwrap_err().code, Code::Denied);
        r.mv("A", "C").unwrap();
        assert!(n.join("C/B/y.md").exists());
        assert_eq!(r.mkdir(".git/x").unwrap_err().code, Code::Denied);
        r.remove("C/B/y.md", false).unwrap();
        assert!(!n.join("C/B/y.md").exists());
        assert_eq!(r.remove("C", true).unwrap_err().code, Code::Denied, "visible folders are never deleted");
        assert!(n.join("C").exists());
        r.mv("C", ".atelieroot/trash/e2/C").unwrap();
        r.remove(".atelieroot/trash/e2", true).unwrap();
        assert!(!n.join(".atelieroot/trash/e2").exists());
        assert!(r.remove("gone.md", false).is_ok());
    }

    #[test]
    fn trash_restores_media_but_never_scripts() {
        let (d, r) = setup();
        let n = d.path().join("notas");
        fs::create_dir_all(n.join(".atelieroot/trash/e1")).unwrap();
        fs::write(n.join(".atelieroot/trash/e1/pic.png"), "x").unwrap();
        fs::write(n.join(".atelieroot/trash/e1/run.exe"), "x").unwrap();
        fs::write(n.join(".atelieroot/trash/e1/s.js"), "x").unwrap();
        r.mv(".atelieroot/trash/e1/pic.png", "pic.png").unwrap();
        assert_eq!(r.mv(".atelieroot/trash/e1/run.exe", "run.exe").unwrap_err().code, Code::Denied);
        assert_eq!(r.mv(".atelieroot/trash/e1/s.js", "s.js").unwrap_err().code, Code::Denied);
        assert_eq!(r.mv(".atelieroot/trash/e1/s.js", "dir/.hidden/s.js").unwrap_err().code, Code::Denied);
        assert!(!n.join("s.js").exists() && !n.join("run.exe").exists());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_cannot_escape_root() {
        let (d, r) = setup();
        fs::create_dir_all(d.path().join("outside")).unwrap();
        std::os::unix::fs::symlink(d.path().join("outside"), d.path().join("notas/link")).unwrap();
        assert_eq!(r.write("link/x.md", "x", None).unwrap_err().code, Code::Denied);
        assert!(!d.path().join("outside/x.md").exists());
    }

    #[cfg(windows)]
    #[test]
    fn junction_like_escape_is_blocked_by_canonical_check() {
        let (d, r) = setup();
        // Without admin rights symlinks may be unavailable; the canonical-prefix check is still exercised directly.
        let outside = d.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        if std::os::windows::fs::symlink_dir(&outside, d.path().join("notas/link")).is_ok() {
            assert_eq!(r.write("link/x.md", "x", None).unwrap_err().code, Code::Denied);
            assert!(!outside.join("x.md").exists());
        }
    }
}
