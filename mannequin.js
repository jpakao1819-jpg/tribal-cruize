/* Tribal Cruize — 3D fashion mannequin (Designer side)
 *
 * A neutral, anatomically proportioned full-body figure in a relaxed stance
 * (arms slightly away from the torso, legs slightly apart): smooth featureless
 * head, defined torso/hips/arms/hands/legs/feet, matte light-gray material,
 * no clothing, seams, patterns or accessories.
 *
 * - Drag to rotate, scroll to zoom (OrbitControls), plus Front / Back / Side
 *   preset views and an auto-rotate toggle.
 * - Proportion sliders make the model editable (height, shoulders, hips,
 *   limb thickness, arm spread, stance width).
 * - Export: GLB (glTF binary), OBJ, or a PNG snapshot of the current view.
 *
 * Loaded as an ES module; three.js comes from the jsdelivr CDN import map.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------- state */

const P = {
  height: 1.0,    // uniform scale (base figure ≈ 1.72 m)
  shoulders: 1.0, // torso shoulder/chest width factor
  hips: 1.0,      // hip width factor
  limbs: 1.0,     // arm/leg thickness factor
  armDeg: 12,     // arm spread away from the torso (relaxed)
  stanceDeg: 8,   // leg stance width (slightly apart)
};

const MAT = new THREE.MeshStandardMaterial({
  color: 0xd7d7d7,
  roughness: 0.95,
  metalness: 0.0,
  name: "MatteGray",
});

let renderer, scene, camera, controls, figure, grid;
let initialized = false;
let spinning = false;
let camAnim = null;

const VIEWS = {
  front: new THREE.Vector3(0, 1.0, 2.4),
  back: new THREE.Vector3(0, 1.0, -2.4),
  side: new THREE.Vector3(2.4, 1.0, 0),
};

/* ------------------------------------------------------------ geometry */

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

function capsule(r, len) {
  return new THREE.CapsuleGeometry(r, len, 6, 24);
}

function buildFigure() {
  const g = new THREE.Group();
  g.name = "Mannequin";

  const sh = P.shoulders;
  const hip = P.hips;
  const lb = P.limbs;
  const armRad = (P.armDeg * Math.PI) / 180;
  const stanceRad = (P.stanceDeg * Math.PI) / 180;

  /* --- torso: lathe profile, scaled in depth for an elliptical section --- */
  const profile = [
    [0.100, 0.85],
    [0.155 * hip, 0.90],
    [0.160 * hip, 0.96],
    [0.140 * hip, 1.04],
    [0.133, 1.12],
    [0.152 * sh, 1.22],
    [0.163 * sh, 1.32],
    [0.158 * sh, 1.38],
    [0.055, 1.41],
    [0.001, 1.415],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 48),
    MAT
  );
  torso.name = "Torso";
  torso.scale.z = 0.72; // flatten front-to-back: human, not cylindrical
  g.add(torso);

  /* --- neck + featureless head --- */
  const neck = new THREE.Mesh(capsule(0.043, 0.05), MAT);
  neck.name = "Neck";
  neck.position.set(0, 1.44, 0);
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 40, 32), MAT);
  head.name = "Head";
  head.scale.set(1, 1.12, 1.04);
  head.position.set(0, 1.595, 0);
  g.add(head);

  /* --- arms: slightly away from the torso, relaxed, hands at the side --- */
  for (const side of [1, -1]) {
    const arm = new THREE.Group();
    arm.name = side > 0 ? "Arm.L" : "Arm.R";
    arm.position.set(side * 0.155 * sh, 1.355, 0);
    arm.rotation.z = side * armRad;

    const upper = new THREE.Mesh(capsule(0.042 * lb, 0.24), MAT);
    upper.name = "UpperArm";
    upper.position.y = -0.16;
    arm.add(upper);

    const fore = new THREE.Group();
    fore.name = "Forearm";
    fore.position.y = -0.30;
    fore.rotation.x = -0.14; // slight natural bend forward at the elbow

    const lower = new THREE.Mesh(capsule(0.037 * lb, 0.22), MAT);
    lower.name = "LowerArm";
    lower.position.y = -0.14;
    fore.add(lower);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 20), MAT);
    hand.name = "Hand";
    hand.scale.set(0.78, 1.3, 0.45);
    hand.position.set(0, -0.31, 0.012);
    fore.add(hand);

    arm.add(fore);
    g.add(arm);
  }

  /* --- legs: slightly apart, feet flat on the ground --- */
  for (const side of [1, -1]) {
    const leg = new THREE.Group();
    leg.name = side > 0 ? "Leg.L" : "Leg.R";
    leg.position.set(side * 0.095 * hip, 0.88, 0);
    leg.rotation.z = side * stanceRad;

    const thigh = new THREE.Mesh(capsule(0.068 * lb, 0.30), MAT);
    thigh.name = "Thigh";
    thigh.position.y = -0.22;
    leg.add(thigh);

    const calf = new THREE.Mesh(capsule(0.052 * lb, 0.30), MAT);
    calf.name = "Calf";
    calf.position.y = -0.64;
    leg.add(calf);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 20), MAT);
    foot.name = "Foot";
    foot.scale.set(1.0, 0.7, 2.2);
    foot.position.set(0, -0.845, 0.05);
    leg.add(foot);

    g.add(leg);
  }

  g.scale.setScalar(P.height);
  return g;
}

function rebuild() {
  if (!figure) return;
  while (figure.children.length) {
    const child = figure.children[0];
    disposeGroup(child);
    figure.remove(child);
  }
  figure.add(buildFigure());
  groundFigure();
}

/* Keep the feet planted on y = 0 — splaying the legs raises the chain, so
   re-seat the whole figure on the ground after every rebuild. */
function groundFigure() {
  if (!figure) return;
  figure.position.y = 0;
  const box = new THREE.Box3().setFromObject(figure);
  figure.position.y = -box.min.y;
}

/* -------------------------------------------------------------- render */

function init() {
  const host = $("mannequinCanvas");
  if (!host) return false;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  camera.position.copy(VIEWS.front);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true, // enables PNG snapshots
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(-2, 2.5, -3);
  scene.add(rim);

  grid = new THREE.GridHelper(4, 24, 0x4a453d, 0x2b2723);
  grid.position.y = 0;
  const gm = grid.material;
  if (Array.isArray(gm)) gm.forEach((m) => (m.transparent = true, (m.opacity = 0.55)));
  else { gm.transparent = true; gm.opacity = 0.55; }
  scene.add(grid);

  figure = new THREE.Group();
  figure.add(buildFigure());
  scene.add(figure);
  groundFigure();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.92, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.8;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.autoRotateSpeed = 2.4;

  resize();
  window.addEventListener("resize", resize);

  (function loop() {
    requestAnimationFrame(loop);
    if ($("mannequinStage") && $("mannequinStage").hidden) return;
    if (camAnim) stepCamera();
    controls.update();
    renderer.render(scene, camera);
  })();

  initialized = true;
  return true;
}

function resize() {
  if (!renderer) return;
  const host = $("mannequinCanvas");
  const stage = $("mannequinStage");
  if (!host || !stage || stage.hidden) return;
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function setView(name) {
  const target = VIEWS[name];
  if (!target) return;
  camAnim = {
    from: camera.position.clone(),
    to: target.clone(),
    t: 0,
  };
}

function stepCamera() {
  camAnim.t = Math.min(1, camAnim.t + 0.055);
  const e = 1 - Math.pow(1 - camAnim.t, 3); // ease-out cubic
  camera.position.lerpVectors(camAnim.from, camAnim.to, e);
  if (camAnim.t >= 1) camAnim = null;
}

/* -------------------------------------------------------------- export */

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportGLB() {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      figure,
      (result) => {
        const blob = new Blob([result], { type: "model/gltf-binary" });
        download(blob, "tribal-cruize-mannequin.glb");
        resolve(blob);
      },
      (err) => reject(err),
      { binary: true, onlyVisible: false }
    );
  });
}

function exportOBJ() {
  const text = new OBJExporter().parse(figure);
  const blob = new Blob([text], { type: "text/plain" });
  download(blob, "tribal-cruize-mannequin.obj");
  return blob;
}

function exportPNG() {
  renderer.render(scene, camera); // draw fresh so the buffer is intact
  return new Promise((resolve) => {
    renderer.domElement.toBlob((blob) => {
      if (blob) download(blob, "tribal-cruize-mannequin.png");
      resolve(blob);
    }, "image/png");
  });
}

/* ------------------------------------------------------------------ UI */

function applySlider(id, key, fmt) {
  const el = $(id);
  const out = $(id + "Val");
  if (!el) return;
  const update = () => {
    const v = parseFloat(el.value);
    P[key] = v;
    if (out) out.textContent = fmt ? fmt(v) : v;
    rebuild();
  };
  el.addEventListener("input", update);
  if (out) out.textContent = fmt ? fmt(parseFloat(el.value)) : el.value;
}

function toggle(active) {
  const flat = $("flatStage");
  const stage = $("mannequinStage");
  const presetRow = $("presetRow");
  const mrow = $("mannequinRow");
  const section = $("mannequinSection");
  const title = $("garmentTitle");
  const btn = $("mode3dBtn");

  document.body.classList.toggle("mode-3d", active);
  if (flat) flat.hidden = active;
  if (presetRow) presetRow.hidden = active;
  if (stage) stage.hidden = !active;
  if (mrow) mrow.hidden = !active;
  if (section) section.hidden = !active;
  if (btn) {
    btn.textContent = active ? "Flat mockup" : "3D Mannequin";
    btn.classList.toggle("active", active);
  }
  if (title) {
    if (active) title.textContent = "3D Mannequin";
    else if (window.__tcDesign) title.textContent = window.__tcDesign.garment().name;
  }

  if (active) {
    if (!initialized) {
      const ok = init();
      if (!ok && title) title.textContent = "3D unavailable";
    } else {
      resize();
    }
  }
}

function wire() {
  const btn = $("mode3dBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      toggle(!document.body.classList.contains("mode-3d"));
    });
  }

  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.view))
  );

  const spin = $("spinBtn");
  if (spin) {
    spin.addEventListener("click", () => {
      spinning = !spinning;
      if (controls) controls.autoRotate = spinning;
      spin.classList.toggle("active", spinning);
    });
  }

  const glb = $("exportGlb");
  if (glb) glb.addEventListener("click", () => exportGLB().catch(() => {}));
  const obj = $("exportObj");
  if (obj) obj.addEventListener("click", () => exportOBJ());
  const png = $("exportPng3d");
  if (png) png.addEventListener("click", () => exportPNG());

  applySlider("mHeight", "height", (v) => Math.round(v * 100) + "%");
  applySlider("mShoulders", "shoulders", (v) => Math.round(v * 100) + "%");
  applySlider("mHips", "hips", (v) => Math.round(v * 100) + "%");
  applySlider("mLimbs", "limbs", (v) => Math.round(v * 100) + "%");
  applySlider("mArms", "armDeg", (v) => v + "°");
  applySlider("mStance", "stanceDeg", (v) => v + "°");
}

/* Test/debug hook used by automated verification. */
window.__tcMannequin = {
  params: P,
  toggle,
  setView,
  exportGLB,
  exportOBJ,
  exportPNG,
  info() {
    if (!renderer) return { initialized };
    const gl = renderer.getContext();
    let tris = 0, meshes = 0;
    figure.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const g = o.geometry;
        tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      }
    });
    const box = new THREE.Box3().setFromObject(figure);
    const size = box.getSize(new THREE.Vector3());
    return {
      initialized,
      renderer: gl.getParameter(gl.VERSION),
      meshes,
      triangles: Math.round(tris),
      camera: camera.position.toArray().map((n) => +n.toFixed(3)),
      size: size.toArray().map((n) => +n.toFixed(3)),
      footY: +box.min.y.toFixed(3),
      material: { color: "#" + MAT.color.getHexString(), roughness: MAT.roughness, metalness: MAT.metalness },
      params: { ...P },
      figureHeight: +(figure ? 1.72 * P.height : 0).toFixed(3),
    };
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}
