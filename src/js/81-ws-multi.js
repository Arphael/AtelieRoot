"use strict";
/* ====== 75b. Varias carpetas a la vez ====== */
// MultiBackend joins several open folders into one, with the same interface as the others, so the rest of
// AtelieRoot (82-ws-core.js) does not change: each folder is a top-level folder of the tree named by its label,
// and "notas/ideas.md" means "ideas.md in the folder labelled notas".
// Each folder keeps its OWN .atelieroot/: reading ".atelieroot/state.json" joins the state of every folder
// (paths get the label in front) and writing it splits it again, so a folder opened alone later still has its
// order, folds, comments and trash. Things deleted go to the trash of the folder they came from.
const WS_META_KEYS = ['fills', 'extras'];
class MultiBackend {
  constructor(bes){
    const used = new Set();
    this.parts = bes.map(be => {
      const base = wsSafeName(be.name || T('name.folder'), false); let label = base, k = 2;
      while (used.has(label.toLowerCase())) label = base + ' (' + (k++) + ')';
      used.add(label.toLowerCase());
      return { be, label };
    });
    this.multi = true; this.kind = bes[0].kind; this.name = this.parts.map(x => x.label).join(' + ');
    this.trashPart = new Map(); this.metaCache = []; this.metaText = [];
    if (bes.every(b => b.absPath)) this.absPath = p => { const r = this.route(p); return r.part.be.absPath(r.p); };
    if (bes.every(b => b.reveal)) this.reveal = p => { const r = this.route(p); return r.part.be.reveal(r.p); };
    if (bes.every(b => b.openFile)) this.openFile = p => { const r = this.route(p); return r.part.be.openFile(r.p); };
  }
  partOf(label){ return this.parts.findIndex(x => x.label === label); }
  // a path of the joined tree -> { i, part, p } (p: path inside that folder, '' for the folder itself)
  route(p){
    if (p === '.atelieroot' || p.startsWith('.atelieroot/')){
      const m = p.match(/^\.atelieroot\/trash\/([^/]+)/), i = m && this.trashPart.has(m[1]) ? this.trashPart.get(m[1]) : 0;
      return { i, part: this.parts[i], p };
    }
    const cut = p.indexOf('/'), label = cut < 0 ? p : p.slice(0, cut), i = this.partOf(label);
    if (i < 0) throw new WsError('denied', T('ws.err.outside-folders'));
    return { i, part: this.parts[i], p: cut < 0 ? '' : p.slice(cut + 1) };
  }
  relOf(p){ return this.route(p).p; }
  async migrateHidden(){ for (const x of this.parts) if (x.be.migrateHidden) await x.be.migrateHidden(); }
  async list(hidden){
    const out = [];
    for (const [i, x] of this.parts.entries()){
      out.push({ p: x.label, t: 'd', s: 0, m: 0 });
      for (const e of await x.be.list(hidden)){
        if (e.p === '.atelieroot' || e.p.startsWith('.atelieroot/')){
          const m = e.p.match(/^\.atelieroot\/trash\/([^/]+)/);
          if (m){ if (!this.trashPart.has(m[1])) this.trashPart.set(m[1], i); out.push(e); }
          else if (i === 0) out.push(e);
          continue;
        }
        out.push(Object.assign({}, e, { p: x.label + '/' + e.p }));
      }
    }
    return out;
  }
  // ---- the joined state.json ----
  async readMeta(){
    const all = { v: 1, order: {}, open: [], fills: {}, extras: {}, trash: [], current: null };
    for (const [i, x] of this.parts.entries()){
      let j = {};
      try { const r = await x.be.read(WS_META, true); if (r){ this.metaText[i] = r.text; j = JSON.parse(r.text) || {}; } } catch(_){}
      this.metaCache[i] = j;
      const L = q => q ? x.label + '/' + q : x.label;
      Object.keys(j.order || {}).forEach(d => { all.order[L(d)] = j.order[d]; });
      all.open.push(x.label, ...(j.open || []).map(L));
      WS_META_KEYS.forEach(k => Object.keys(j[k] || {}).forEach(p => { all[k][L(p)] = j[k][p]; }));
      (j.trash || []).forEach(t => { if (!t || !t.id) return; this.trashPart.set(t.id, i); all.trash.push(Object.assign({}, t, { parentPath: L(t.parentPath || '') })); });
      if (j.current && !all.current) all.current = L(j.current);
    }
    all.order[''] = this.parts.map(x => x.label);
    return all;
  }
  async writeMeta(text){
    const all = JSON.parse(text), per = this.parts.map((x, i) => Object.assign({}, this.metaCache[i] || {}, { v: 1, order: {}, open: [], fills: {}, extras: {}, trash: [] }));
    const split = p => { const r = this.route(p); return [r.i, r.p]; };
    Object.keys(all.order || {}).forEach(d => { if (d === '') return; const [i, q] = split(d); per[i].order[q] = all.order[d]; });
    (all.open || []).forEach(p => { const [i, q] = split(p); if (q) per[i].open.push(q); });
    WS_META_KEYS.forEach(k => Object.keys(all[k] || {}).forEach(p => { const [i, q] = split(p); per[i][k][q] = all[k][p]; }));
    (all.trash || []).forEach(t => {
      let i = this.trashPart.has(t.id) ? this.trashPart.get(t.id) : 0, pp = null;
      if (t.parentPath){ const r = split(t.parentPath); i = r[0]; pp = r[1] || null; }
      this.trashPart.set(t.id, i); per[i].trash.push(Object.assign({}, t, { parentPath: pp }));
    });
    if (all.current){ const [i, q] = split(all.current); per[i].current = q; }
    let last = { m: 0, s: 0 };
    for (const [i, x] of this.parts.entries()){
      const o = per[i];
      const json = JSON.stringify(o, null, 1) + '\n';
      if (json === this.metaText[i]) continue;
      last = await x.be.write(WS_META, json); this.metaText[i] = json; this.metaCache[i] = o;
    }
    return last;
  }
  async read(p, optional){
    if (p === WS_META){ const text = JSON.stringify(await this.readMeta()); return { text, m: 0, s: text.length }; }
    const r = this.route(p); if (!r.p) throw new WsError('missing', T('ws.err.missing'));
    return r.part.be.read(r.p, optional);
  }
  async readMany(paths){
    const out = new Array(paths.length), groups = new Map();
    paths.forEach((p, k) => { try { const r = this.route(p); if (!groups.has(r.i)) groups.set(r.i, []); groups.get(r.i).push([k, r.p]); } catch(_){ out[k] = { error: 'denied' }; } });
    for (const [i, list] of groups){
      const be = this.parts[i].be;
      if (be.readMany){ for (let s = 0; s < list.length; s += 500){ const chunk = list.slice(s, s + 500), res = await be.readMany(chunk.map(x => x[1])); chunk.forEach(([k], j) => { out[k] = res[j]; }); } }
      else await wsPool(list, 8, async ([k, q]) => { try { out[k] = await be.read(q); } catch(e){ out[k] = { error: e.code || 'io' }; } });
    }
    return out;
  }
  write(p, text, expect){
    if (p === WS_META) return this.writeMeta(text);
    if (p === '.atelieroot/.gitignore') return Promise.all(this.parts.map(x => x.be.write(p, text))).then(r => r[0]);
    const r = this.route(p); return r.part.be.write(r.p, text, expect);
  }
  mkdir(p){ const r = this.route(p); return r.p ? r.part.be.mkdir(r.p) : Promise.resolve({}); }
  remove(p, recursive){ const r = this.route(p); if (!r.p) throw new WsError('denied', T('ws.err.root-folder')); return r.part.be.remove(r.p, recursive); }
  readBin(p){ const r = this.route(p); return r.part.be.readBin(r.p); }
  writeBin(p, bytes){ const r = this.route(p); return r.part.be.writeBin(r.p, bytes); }
  async move(a, b){
    const ra = this.route(a);
    const tm = b.match(/^\.atelieroot\/trash\/([^/]+)/);
    if (tm && !this.trashPart.has(tm[1])) this.trashPart.set(tm[1], ra.i);          // deleted things go to the trash of their own folder
    const rb = this.route(b);
    if (!ra.p || !rb.p) throw new WsError('denied', T('ws.err.root-folder'));
    if (ra.i === rb.i) return ra.part.be.move(ra.p, rb.p);
    // between two folders: documents (and images) are copied and then removed; folders are refused (the UI does not offer it)
    if (wsIsMd(ra.p)){
      const d = await ra.part.be.read(ra.p);
      if (await rb.part.be.read(rb.p, true)) throw new WsError('exists', T('ws.err.exists'));
      await rb.part.be.write(rb.p, d.text); await ra.part.be.remove(ra.p, false); return {};
    }
    if (/\.(png|jpe?g|gif|webp)$/i.test(ra.p) && ra.part.be.readBin && rb.part.be.writeBin){
      await rb.part.be.writeBin(rb.p, await ra.part.be.readBin(ra.p)); return {};
    }
    throw new WsError('denied', T('ws.err.move-between'));
  }
  watch(cb){ const stops = this.parts.map(x => x.be.watch(cb)); return () => stops.forEach(f => f()); }
}
const wsIsRootNode = n => !!n && Workspace.active && !!(Workspace.be && Workspace.be.multi) && state.tree.includes(n);
const wsRootOf = n => { if (!(Workspace.be && Workspace.be.multi)) return null; return state.tree.find(r => r === n || isInside(r, n.id)) || null; };
