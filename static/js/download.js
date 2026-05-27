/**
 * HoI! Dataset Download Tool
 *
 * Selection model: sel.tree[type][module] = Set<stream>
 * Types → Modules → Streams are rendered as a nested tree.
 * Modules/streams are duplicated across types for independent control.
 */
(function () {
  'use strict';

  const DATAVERSE_BASE  = 'https://bonndata.uni-bonn.de';
  const MANIFEST_URL    = './static/data/manifest.json';

  // ─── Labels ───────────────────────────────────────────────────────────────

  const TYPE_ORDER  = ['gripper', 'hand', 'wrist', 'umi', 'leica'];
  const TYPE_LABELS = {
    gripper: 'Hoi! Gripper', hand: 'Human Hand',
    wrist:   'Wrist Camera', umi:  'UMI Gripper', leica: 'Leica Scan',
  };
  const TYPE_ICONS = {
    gripper: 'fa-robot', hand: 'fa-hand-paper',
    wrist:   'fa-watch',  umi: 'fa-grip-horizontal', leica: 'fa-cube',
  };

  const MODULE_ORDER  = ['aria_human','aria_gripper','aria_wrist',
                         'iphone_1','iphone_2','gripper','umi_gripper'];
  const MODULE_LABELS = {
    aria_human:  'Aria (Human)',   aria_gripper: 'Aria (Gripper)',
    aria_wrist:  'Aria (Wrist)',   iphone_1:     'iPhone 1',
    iphone_2:    'iPhone 2',       gripper:      'Gripper Sensors',
    umi_gripper: 'UMI Gripper',
  };

  const STREAM_LABELS = {
    camera_rgb:           'RGB Camera',
    camera_depth:         'Depth Camera',
    slam:                 'SLAM',
    multi_slam:           'Multi-SLAM',
    eye_gaze:             'Eye Gaze',
    hand_tracking:        'Hand Tracking',
    visual_registration:  'Visual Reg.',
    calib:                'Calibration',
    anonymization_cache:  'Anon. Cache',
    rgbd:                 'RGB-D',
    poses:                'Poses',
    poses_aligned:        'Poses (Aligned)',
    force_torque:         'Force / Torque',
    digit:                'DIGIT Tactile',
    zedm:                 'ZED Mini',
    dynamixel_workbench:  'Dynamixel',
    gripper_force_trigger:'Force Trigger',
    tf_static:            'TF Static',
    telemetry:            'Telemetry',
    odometry:             'Odometry',
    images:               'Images',
    points:               'Point Cloud',
    points_downsampled:   'Point Cloud (DS)',
    mesh:                 'Mesh',
    pano_tiles:           'Pano Tiles',
    instance_annotations: 'Inst. Annot.',
    instance_annotations_3d: '3D Annot.',
  };

  const LARGE_STREAMS = new Set(['camera_depth','camera_rgb','visual_registration','rgbd','points']);

  // ─── State ────────────────────────────────────────────────────────────────

  let allFiles = [];
  let typeToMods  = {};   // Map<type,  Set<module>>
  let modToStreams = {};   // Map<module, Set<stream>>

  const sel = {
    locations: new Set(),     // empty = all
    tree: {},                 // { type: { module: Set<stream> } }  present+non-empty = selected
  };

  // ─── Utilities ────────────────────────────────────────────────────────────

  function fmt(bytes) {
    if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB';
    if (bytes >= 1e9)  return (bytes / 1e9).toFixed(1)  + ' GB';
    if (bytes >= 1e6)  return (bytes / 1e6).toFixed(1)  + ' MB';
    return Math.round(bytes / 1e3) + ' KB';
  }

  function baseStream(fn) { return fn.replace(/\.zip$/i, '').replace(/-\d+$/, ''); }

  function modLabel(mod) {
    if (/^\d+$/.test(mod)) return `Setup ${mod}`;
    return MODULE_LABELS[mod] || mod;
  }

  // ─── Parsing ──────────────────────────────────────────────────────────────

  function parseEntry({ id, path, size }) {
    const parts = path.split('/');
    const fname = parts[parts.length - 1];
    const dirs  = parts.slice(0, -1);
    const isZip = fname.toLowerCase().endsWith('.zip');
    return {
      id, path, size,
      location: dirs[0] || null,
      type:     dirs[1] || null,
      module:   dirs[2] || null,
      stream:   isZip ? baseStream(fname) : null,
    };
  }

  async function fetchManifest() {
    const resp = await fetch(MANIFEST_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  // ─── Lookups & tree init ──────────────────────────────────────────────────

  function buildLookups() {
    typeToMods  = {};
    modToStreams = {};
    for (const f of allFiles) {
      if (f.type && f.module) {
        (typeToMods[f.type] = typeToMods[f.type] || new Set()).add(f.module);
      }
      if (f.module && f.stream) {
        (modToStreams[f.module] = modToStreams[f.module] || new Set()).add(f.stream);
      }
    }
  }

  /** Initialise sel.tree with everything selected. */
  function initTree() {
    sel.tree = {};
    for (const [type, mods] of Object.entries(typeToMods)) {
      sel.tree[type] = {};
      for (const mod of mods) {
        sel.tree[type][mod] = new Set(modToStreams[mod] || []);
      }
    }
  }

  // ─── Selection read helpers ───────────────────────────────────────────────

  function modSelSize(type, mod) { return sel.tree[type]?.[mod]?.size ?? 0; }
  function modTotalSize(mod)     { return modToStreams[mod]?.size ?? 0; }

  function typeSelSize(type) {
    return Object.keys(sel.tree[type] || {})
                 .reduce((s, m) => s + modSelSize(type, m), 0);
  }
  function typeTotalSize(type) {
    return [...(typeToMods[type] || [])].reduce((s, m) => s + modTotalSize(m), 0);
  }

  /** 'checked' | 'indeterminate' | 'unchecked' */
  function modState(type, mod) {
    const s = modSelSize(type, mod), t = modTotalSize(mod);
    if (s === 0) return 'unchecked';
    if (s === t) return 'checked';
    return 'indeterminate';
  }
  function typeState(type) {
    const s = typeSelSize(type), t = typeTotalSize(type);
    if (s === 0) return 'unchecked';
    if (s === t) return 'checked';
    return 'indeterminate';
  }

  function applyState(chk, state) {
    chk.indeterminate = (state === 'indeterminate');
    chk.checked       = (state === 'checked');
  }

  // ─── Filtering ────────────────────────────────────────────────────────────

  function getSelectedFiles() {
    return allFiles.filter(f => {
      if (!f.stream) return false;
      if (sel.locations.size && !sel.locations.has(f.location)) return false;
      return sel.tree[f.type]?.[f.module]?.has(f.stream) ?? false;
    });
  }

  // ─── DOM helpers ─────────────────────────────────────────────────────────

  function qTypeChk(type)      { return document.getElementById(`dl-t-${type}`); }
  function qModChk(type, mod)  { return document.getElementById(`dl-m-${type}-${mod}`); }

  function refreshModChk(type, mod) {
    const chk = qModChk(type, mod);
    if (chk) applyState(chk, modState(type, mod));
  }
  function refreshTypeChk(type) {
    const chk = qTypeChk(type);
    if (chk) applyState(chk, typeState(type));
  }
  function refreshModStreams(type, mod) {
    document.querySelectorAll(`[data-type="${type}"][data-mod="${mod}"]`)
      .forEach(c => { c.checked = sel.tree[type]?.[mod]?.has(c.dataset.stream) ?? false; });
  }
  function refreshTypeModules(type) {
    (typeToMods[type] || []).forEach(mod => {
      refreshModChk(type, mod);
      refreshModStreams(type, mod);
    });
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  function updateSummary() {
    const files = getSelectedFiles();
    const total = files.reduce((s, f) => s + f.size, 0);
    document.getElementById('dl-size').textContent  = fmt(total);
    document.getElementById('dl-count').textContent = files.length.toLocaleString();
    document.getElementById('dl-script-area').style.display = 'none';
  }

  // ─── Tree rendering ───────────────────────────────────────────────────────

  function makeChk(id, opts = {}) {
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = true;
    if (id)          c.id          = id;
    if (opts.dataset) Object.assign(c.dataset, opts.dataset);
    return c;
  }

  function renderTree() {
    const root = document.getElementById('dl-tree');
    root.innerHTML = '';

    const knownMods = new Set(MODULE_ORDER);

    for (const type of TYPE_ORDER) {
      if (!typeToMods[type]) continue;

      // Order modules: known first, then leica setups sorted
      const mods = [
        ...MODULE_ORDER.filter(m => typeToMods[type].has(m)),
        ...[...typeToMods[type]].filter(m => !knownMods.has(m)).sort(),
      ];

      // ── Type group ────────────────────────────────────────────────
      const group = document.createElement('div');
      group.className = 'dl-type-group';

      // Type header
      const typeHdr = document.createElement('div');
      typeHdr.className = 'dl-type-hdr';
      const typeChk = makeChk(`dl-t-${type}`);
      typeHdr.appendChild(typeChk);
      const typeLabel = document.createElement('span');
      typeLabel.innerHTML = `<i class="fas ${TYPE_ICONS[type] || 'fa-folder'}"></i> ${TYPE_LABELS[type] || type}`;
      typeHdr.appendChild(typeLabel);
      group.appendChild(typeHdr);

      // Type body (all modules)
      const typeBody = document.createElement('div');
      typeBody.className = 'dl-type-body';

      for (const mod of mods) {
        const streams = [...(modToStreams[mod] || [])].sort();

        const modBlock = document.createElement('div');
        modBlock.className = 'dl-mod-block';

        // Module header
        const modHdr = document.createElement('div');
        modHdr.className = 'dl-mod-hdr';
        const modChk = makeChk(`dl-m-${type}-${mod}`);
        modHdr.appendChild(modChk);
        const modSpan = document.createElement('span');
        modSpan.textContent = modLabel(mod);
        modHdr.appendChild(modSpan);
        // Collapse toggle
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'dl-collapse-btn';
        collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        collapseBtn.title = 'Expand streams';
        modHdr.appendChild(collapseBtn);
        modBlock.appendChild(modHdr);

        // Streams (collapsed by default)
        const streamWrap = document.createElement('div');
        streamWrap.className = 'dl-stream-wrap dl-stream-wrap--collapsed';

        collapseBtn.addEventListener('click', () => {
          const collapsed = streamWrap.classList.toggle('dl-stream-wrap--collapsed');
          collapseBtn.innerHTML = collapsed
            ? '<i class="fas fa-chevron-right"></i>'
            : '<i class="fas fa-chevron-down"></i>';
          collapseBtn.title = collapsed ? 'Expand streams' : 'Collapse streams';
        });

        for (const stream of streams) {
          const lbl = document.createElement('label');
          lbl.className = 'dl-stream-label';

          const strmChk = makeChk(null, { dataset: { type, mod, stream } });
          lbl.appendChild(strmChk);

          const txt = document.createTextNode(' ' + (STREAM_LABELS[stream] || stream));
          lbl.appendChild(txt);

          if (LARGE_STREAMS.has(stream)) {
            const b = document.createElement('span');
            b.className = 'dl-large'; b.textContent = 'large';
            lbl.appendChild(b);
          }
          streamWrap.appendChild(lbl);

          // Stream checkbox event
          strmChk.addEventListener('change', function () {
            const { type: t, mod: m, stream: s } = this.dataset;
            if (this.checked) sel.tree[t][m].add(s);
            else              sel.tree[t][m].delete(s);
            refreshModChk(t, m);
            refreshTypeChk(t);
            updateSummary();
          });
        }

        modBlock.appendChild(streamWrap);
        typeBody.appendChild(modBlock);

        // Module header click (handles indeterminate correctly)
        modChk.addEventListener('click', function (e) {
          e.preventDefault();
          const fullyOn = modSelSize(type, mod) === modTotalSize(mod);
          sel.tree[type][mod] = fullyOn
            ? new Set()
            : new Set([...(modToStreams[mod] || [])]);
          refreshModStreams(type, mod);
          refreshTypeChk(type);
          updateSummary();
          setTimeout(() => refreshModChk(type, mod), 0);
        });
      }

      group.appendChild(typeBody);
      root.appendChild(group);

      // Type header click
      typeChk.addEventListener('click', function (e) {
        e.preventDefault();
        const fullyOn = typeSelSize(type) === typeTotalSize(type);
        for (const mod of mods) {
          sel.tree[type][mod] = fullyOn
            ? new Set()
            : new Set([...(modToStreams[mod] || [])]);
        }
        refreshTypeModules(type);
        updateSummary();
        setTimeout(() => refreshTypeChk(type), 0);
      });
    }
  }

  // ─── Locations ────────────────────────────────────────────────────────────

  function renderLocations(locs) {
    const el = document.getElementById('dl-locations');
    el.innerHTML = '';
    for (const loc of locs) {
      const label = document.createElement('label');
      label.className = 'dl-cb-label';
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.value = loc; chk.checked = true;
      chk.addEventListener('change', () => {
        const boxes = [...el.querySelectorAll('input')];
        sel.locations.clear();
        if (!boxes.every(b => b.checked)) boxes.forEach(b => b.checked && sel.locations.add(b.value));
        updateSummary();
      });
      label.appendChild(chk);
      label.appendChild(document.createTextNode(' ' + loc.replace(/_/g, ' ')));
      el.appendChild(label);
    }
  }

  // ─── Script generation ────────────────────────────────────────────────────

  function generateScript(outputDir) {
    const files     = getSelectedFiles();
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    const date      = new Date().toISOString().split('T')[0];
    const lines = [
      '#!/bin/bash',
      `# HoI! Dataset — Download Script  (generated ${date})`,
      `# ${files.length} files  ·  ~${fmt(totalSize)}`,
      '#',
      '# Usage:',
      '#   chmod +x download_hoi.sh',
      '#   ./download_hoi.sh [output_dir]',
      '',
      `OUTPUT_DIR="\${1:-${outputDir || './hoi_dataset'}}"`,
      `BASE_URL="${DATAVERSE_BASE}"`,
      '',
      'set -euo pipefail',
      '',
      'dl() {',
      '  local id="$1" dest="$2"',
      '  [[ -f "$dest" ]] && { echo "  skip  $dest"; return; }',
      '  mkdir -p "$(dirname "$dest")"',
      '  echo "  get   $dest"',
      `  curl -fL --progress-bar "\${BASE_URL}/api/access/datafile/\${id}" -o "\${dest}"`,
      '}',
      '',
      `echo "HoI! download → \${OUTPUT_DIR}"`,
      `echo "${files.length} files  (~${fmt(totalSize)})"`,
      'echo',
    ];
    const byLoc = {};
    for (const f of files) (byLoc[f.location] = byLoc[f.location] || []).push(f);
    for (const loc of Object.keys(byLoc).sort()) {
      lines.push(`\necho "── ${loc} ──"`);
      for (const f of byLoc[loc]) lines.push(`dl ${f.id} "\${OUTPUT_DIR}/${f.path}"`);
    }
    lines.push('\necho\necho "Done."');
    return lines.join('\n');
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  function showUI(slim) {
    allFiles = slim.map(parseEntry);
    buildLookups();
    initTree();

    const locs = [...new Set(allFiles.map(f => f.location).filter(Boolean))].sort();
    renderLocations(locs);
    renderTree();

    applyState(document.getElementById('dl-t-gripper') || {}, typeState('gripper')); // no-op if missing

    document.getElementById('dl-loading').style.display = 'none';
    document.getElementById('dl-ui').style.display      = 'block';
    updateSummary();
  }

  async function init() {
    try {
      showUI(await fetchManifest());
    } catch (e) {
      document.getElementById('dl-loading').style.display = 'none';
      const err = document.getElementById('dl-error');
      err.style.display = 'block';
      document.getElementById('dl-error-msg').textContent = e.message;
    }
  }

  // ─── Event wiring ─────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('dl-all-loc')?.addEventListener('click', () => {
      const boxes = [...document.getElementById('dl-locations').querySelectorAll('input')];
      const allOn = boxes.every(b => b.checked);
      boxes.forEach(b => b.checked = !allOn);
      sel.locations.clear();
      if (!allOn) {} // all checked → empty set = all selected
      else boxes.forEach(b => b.checked && sel.locations.add(b.value));
      updateSummary();
    });

    document.getElementById('dl-generate')?.addEventListener('click', () => {
      const outDir = document.getElementById('dl-output').value.trim();
      const pre    = document.getElementById('dl-script');
      const area   = document.getElementById('dl-script-area');
      pre.textContent    = generateScript(outDir);
      area.style.display = 'block';
      area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('dl-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById('dl-script').textContent).then(() => {
        const btn = document.getElementById('dl-copy');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = orig, 2000);
      });
    });

    init();
  });
})();
