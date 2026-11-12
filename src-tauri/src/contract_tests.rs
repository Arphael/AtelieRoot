//! Shared backend contract against the desktop backend (`fsops`). The Node server runs the same
//! scenarios in server/test/contract.test.mjs; both read tests/contract/scenarios.json.

use crate::fsops::{Code, OpError, ReadItem, Root};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

fn code(e: &OpError) -> Value {
    Value::String(match e.code {
        Code::Denied => "denied".into(),
        Code::Missing => "missing".into(),
        Code::Exists => "exists".into(),
        Code::Conflict => "conflict".into(),
        Code::Io => format!("io:{}", e.msg),
    })
}

fn run_step(root: &Root, s: &Value) -> Value {
    let st = |k: &str| s.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let flag = |k: &str| s.get(k).and_then(Value::as_bool).unwrap_or(false);
    match st("op").as_str() {
        "list" => match root.list(flag("hidden")) {
            Ok(es) => { let mut v: Vec<String> = es.iter().map(|e| format!("{}:{}", e.t, e.p)).collect(); v.sort(); json!({ "entries": v }) }
            Err(e) => code(&e),
        },
        "read" => match root.read(&st("path"), flag("optional")) {
            Ok(Some(f)) => json!({ "text": f.text }),
            Ok(None) => json!({ "absent": true }),
            Err(e) => code(&e),
        },
        "read_many" => {
            let paths: Vec<String> = s["paths"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
            match root.read_many(&paths) {
                Ok(items) => json!({ "files": items.iter().map(|it| match it {
                    ReadItem::File(f) => json!({ "text": f.text }),
                    ReadItem::Failed { error } => json!({ "error": error }),
                }).collect::<Vec<_>>() }),
                Err(e) => code(&e),
            }
        }
        "write" => {
            let expect = match st("expect_mtime").as_str() {
                "current" => root.read(&st("path"), false).ok().flatten().map(|f| f.m),
                "stale" => Some(1),
                _ => None,
            };
            match root.write(&st("path"), &st("text"), expect) { Ok(_) => json!("ok"), Err(e) => code(&e) }
        }
        "mkdir" => match root.mkdir(&st("path")) { Ok(_) => json!("ok"), Err(e) => code(&e) },
        "move" => match root.mv(&st("from"), &st("to")) { Ok(_) => json!("ok"), Err(e) => code(&e) },
        "delete" => match root.remove(&st("path"), flag("recursive")) { Ok(_) => json!("ok"), Err(e) => code(&e) },
        other => panic!("unknown op {other}"),
    }
}

#[test]
fn shared_contract_scenarios() {
    let file = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("tests").join("contract").join("scenarios.json");
    let spec: Value = serde_json::from_str(&fs::read_to_string(&file).expect("scenarios.json")).expect("valid JSON");
    let mut failures = Vec::new();
    for c in spec["cases"].as_array().unwrap() {
        let name = c["name"].as_str().unwrap();
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("notas");
        for (rel, text) in spec["fixture"].as_object().unwrap() {
            let f = rel.split('/').fold(dir.clone(), |p, x| p.join(x));
            fs::create_dir_all(f.parent().unwrap()).unwrap();
            fs::write(&f, text.as_str().unwrap()).unwrap();
        }
        let root = Root::new(&dir).unwrap();
        for (i, s) in c["steps"].as_array().unwrap().iter().enumerate() {
            let got = run_step(&root, s);
            if got != s["expect"] {
                failures.push(format!("{name} / step {} ({} {}): expected {}, got {}", i + 1, s["op"], s.get("path").or(s.get("from")).unwrap_or(&Value::Null), s["expect"], got));
            }
        }
    }
    assert!(failures.is_empty(), "contract differences:\n{}", failures.join("\n"));
}
