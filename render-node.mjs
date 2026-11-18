// Usage:
//   node render-node.mjs stills 0.5,3,7.2 out_dir      -> PNG stills
//   node render-node.mjs video out.mp4 [fps] [from] [to] -> frames piped to ffmpeg (no audio)

import { createCanvas } from 'canvas';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SHOTS, CAPTIONS, DURATION, FADES } from './src/shots.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const W = 720, H = 1280;

// Create node-canvas with WebGL2 context
const canvas = createCanvas(W, H);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
if (!gl) {
  console.error('WebGL2 not available. Ensure canvas was built with WebGL support.');
  process.exit(1);
}

// Three.js renderer using node-canvas WebGL context
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Post-processing (same as browser version)
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const dummyScene = new THREE.Scene(), dummyCam = new THREE.PerspectiveCamera();
const renderPass = new RenderPass(dummyScene, dummyCam);
const bokeh = new BokehPass(dummyScene, dummyCam, { focus: 2, aperture: 0.002, maxblur: 0.01 });
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.25, 0.4, 1.6);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.28 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.13) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5; q.x *= 0.5625;
      c.rgb *= 1.0 - uVig * smoothstep(0.18, 0.62, length(q));
      c.rgb += (h(vUv*1280.0) - 0.5) * 0.018;
      gl_FragColor = c; }`,
});
composer.addPass(renderPass);
composer.addPass(bokeh);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(grade);

// Caption overlay - draw directly on canvas 2D context
const ctx2d = canvas.getContext('2d');

const built = new Map();
function getShot(i) {
  if (!built.has(i)) built.set(i, SHOTS[i].build({ makeStage, W, H }));
  return built.get(i);
}

function makeStage({ shadowSize = 3, skyColor = 0x87ceeb, sunDir = [1, 5, 3] } = {}) {
  const scene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(50, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff8e7, 2);
  sun.position.set(...sunDir);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 20;
  sun.shadow.camera.left = -shadowSize;
  sun.shadow.camera.right = shadowSize;
  sun.shadow.camera.top = shadowSize;
  sun.shadow.camera.bottom = -shadowSize;
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
  fill.position.set(-sunDir[0], sunDir[1], -sunDir[2]);
  scene.add(fill);
  return scene;
}

// Draw caption on 2D canvas
function drawCaption(t) {
  const c = CAPTIONS.filter(c => t >= c[0]).pop();
  if (!c) return;
  const text = (c[2] == null || t < c[2]) ? c[1] : '';
  if (!text) return;

  ctx2d.save();
  ctx2d.font = '700 46px "Montserrat", sans-serif';
  ctx2d.fillStyle = '#fff';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'top';
  const x = W / 2;
  const y = 968;
  ctx2d.shadowColor = 'rgba(0,0,0,0.55)';
  ctx2d.shadowBlur = 10;
  ctx2d.shadowOffsetX = 0;
  ctx2d.shadowOffsetY = 3;
  ctx2d.fillText(text, x, y);
  ctx2d.restore();
}

// Draw fade overlay
function drawFade(t) {
  let f = 0;
  for (const [a, b, c2, d] of FADES) {
    if (t >= a && t < d) {
      f = Math.max(f, t < b ? (t - a) / (b - a) : t < c2 ? 1 : (d - t) / (d - c2));
    }
  }
  if (f > 0) {
    ctx2d.fillStyle = `rgba(0,0,0,${f})`;
    ctx2d.fillRect(0, 0, W, H);
  }
}

function renderAt(t) {
  let idx = SHOTS.findIndex(s => t >= s.start && t < s.end);
  if (idx < 0) idx = SHOTS.length - 1;
  const def = SHOTS[idx];
  const shot = getShot(idx);
  const lt = t - def.start;
  const r = shot.update(lt, t) || {};
  const cam = shot.camera;
  cam.aspect = W / H; cam.updateProjectionMatrix();
  shot.scene.userData.sky?.position?.copy?.(cam.position);
  renderPass.scene = bokeh.scene = shot.scene;
  renderPass.camera = bokeh.camera = cam;
  const dof = r.dof || { focus: 3, aperture: 0, maxblur: 0 };
  bokeh.enabled = dof.aperture > 0;
  bokeh.uniforms.focus.value = dof.focus;
  bokeh.uniforms.aperture.value = dof.aperture;
  bokeh.uniforms.maxblur.value = dof.maxblur ?? 0.012;
  bokeh.uniforms.nearClip.value = cam.near; bokeh.uniforms.farClip.value = cam.far;
  bloom.strength = (r.bloom ?? 0.35) * 0.6;
  renderer.toneMappingExposure = r.exposure ?? 1.0;
  grade.uniforms.uTime.value = t;
  composer.render();

  // Draw 2D overlays (caption + fade)
  ctx2d.clearRect(0, 0, W, H);
  drawCaption(t);
  drawFade(t);
}

const [mode, a, b, c, d, e] = process.argv.slice(2);

if (mode === 'stills') {
  const outDir = b;
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of a.split(',').map(Number)) {
    const t0 = Date.now();
    renderAt(t);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outDir, `t_${t.toFixed(2)}.png`), buf);
    console.log('still', t, Date.now() - t0, 'ms');
  }
} else {
  const fps = Number(b || 30);
  const dur = DURATION;
  const from = Number(c || 0), to = Math.min(Number(d || dur), dur);
  const n0 = Math.round(from * fps), n1 = Math.floor(to * fps);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', a], { stdio: ['pipe', 'inherit', 'inherit'] });
  const T0 = Date.now();
  for (let n = n0; n < n1; n++) {
    renderAt(n / fps);
    const buf = canvas.toBuffer('image/png');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 30 === 0) console.log(`frame ${n}/${n1} ${((Date.now() - T0) / (n - n0 + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}