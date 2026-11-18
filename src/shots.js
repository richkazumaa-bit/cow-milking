import * as THREE from 'three';
import { makeHuman } from './human.js';
import { materials } from './materials.js';
const M = materials();
import { kf, lerp, smooth, easeOut, easeIn, easeInOut, range, clamp, V, cam, place, shake, ikArm } from './anim.js';

export const DURATION = 41.46;

// [start, text, end?]
export const CAPTIONS = [
  [0.00, 'If you think'],
  [0.48, 'milking a cow'],
  [1.36, 'is just pulling'],
  [2.00, 'on teats'],
  [2.88, "you're wrong"],
  [3.68, 'Most people picture'],
  [4.64, 'a farmer tugging'],
  [5.68, 'away like a loose'],
  [6.72, 'tooth'],
  [7.20, "But that's not"],
  [7.76, 'how it works'],
  [8.40, 'at all'],
  [8.96, 'Inside each teat'],
  [10.16, 'a sphincter muscle'],
  [11.20, 'holds the milk'],
  [11.92, 'back'],
  [12.40, 'Squeezing the teat'],
  [13.36, 'shut at the top'],
  [14.08, 'traps milk in the'],
  [15.04, 'gland'],
  [15.68, 'Then rolling your'],
  [16.40, 'fingers down pushes'],
  [17.68, 'that milk out'],
  [18.48, "It's a trap-and-push"],
  [19.52, 'motion'],
  [20.08, 'not a pull'],
  [20.80, "The cow's body"],
  [21.84, 'only releases milk'],
  [23.04, 'when she feels'],
  [23.52, 'safe'],
  [24.08, 'Oxytocin triggers'],
  [26.16, 'let-down, and the'],
  [27.04, 'sphincter opens'],
  [27.60, 'Machines copy'],
  [28.64, 'this rhythm'],
  [29.36, 'vacuum on'],
  [30.24, 'vacuum off'],
  [31.20, 'Pulsating vacuum'],
  [32.88, "mimics the calf's"],
  [33.76, 'natural suckle'],
  [34.28, 'Sixty pulses per'],
  [35.36, 'minute'],
  [35.81, 'forty percent vacuum'],
  [37.20, 'sixty percent rest'],
  [38.72, "That's the secret"],
  [39.68, 'rhythm'],
  [40.16, 'not force', 41.26],
];
// [fadeInStart, fullStart, fullEnd, fadeOutEnd] to black
export const FADES = [[7.0, 7.2, 7.3, 7.46]];

const STAND = {
  lSh: [0.05, 0, 0.16], rSh: [0.05, 0, -0.16], lEl: [-0.25, 0, 0], rEl: [-0.25, 0, 0],
  lHip: [0, 0, 0.07], rHip: [0, 0, -0.07], lAn: [0, 0, -0.07], rAn: [0, 0, 0.07],
};
function standPose(h, t, extra = {}) {
  const p = { ...STAND, ...extra };
  p.chest = [Math.sin(t * 1.6) * 0.012 + (extra.chest?.[0] || 0), extra.chest?.[1] || 0, extra.chest?.[2] || 0];
  h.setPose(p);
}
function idle(t, k = 1) { return Math.sin(t * 1.6) * 0.012 * k; }

// ============ SHOT 1: Farmer tugging on teat (misconception) ============
function shot1({ makeStage }) {
  const scene = makeStage({ shadowSize: 3 });
  const farmer = makeHuman(); farmer.root.position.set(0.4, 0, 0.5); farmer.root.rotation.y = -0.8; scene.add(farmer.root);
  const c = makeCow(); c.group.position.set(-0.1, 0, 0); scene.add(c.group);
  const ud = makeUdder(); ud.group.position.set(-0.25, 0.75, -0.25); scene.add(ud.group);

  // Update matrices to get world positions
  scene.updateMatrixWorld(true);
  const frontRightTeat = ud.teats[0];
  const teatWorldPos = new THREE.Vector3();
  frontRightTeat.getWorldPosition(teatWorldPos);
  const handTarget = V(teatWorldPos.x, teatWorldPos.y - 0.1, teatWorldPos.z);
  const camObj = cam(38);
  return {
    scene, camera: camObj,
    update(t) {
      standPose(farmer, t, {
        spine: [0.1, -0.15, 0], chest: [0.05, -0.1, 0], neck: [0.05, 0.1, 0], head: [0.05, 0.05, 0],
        rSh: [-0.8, 0.3, -0.2], rEl: [-1.5, 0, 0], rWr: [0, -0.3, 0],
      });
      // pull motion
      const pull = easeInOut(range(t, 0.3, 1.5));
      const pullAmount = pull * 0.08;
      ikArm(farmer, 'r', handTarget.clone().add(V(0, -pullAmount, 0.02)), farmer.root.localToWorld(V(0.6, 1.2, -0.3)), V(0, 0, -1));
      farmer.setMouth(pull * 0.3);

      // cow reaction - uncomfortable
      c.update(t);
      c.group.updateMatrixWorld(true);

      // camera
      const k = easeInOut(range(t, 0, 2.8));
      place(camObj, [lerp(-0.3, -0.2, k), lerp(1.1, 1.05, k), lerp(2.5, 2.2, k)], [0.05, 1.0, 0.05]);
      return { dof: { focus: camObj.position.distanceTo(V(0.05, 1.0, 0.0)), aperture: 0.003, maxblur: 0.006 }, bloom: 0.1 };
    },
  };
}

// ============ SHOT 2: "But" - Cut to internal anatomy (fade to black) ============
function shot2({ makeStage }) {
  const scene = makeStage({ shadowSize: 1.5, skyColor: 0x1a1a2e });
  const ud = makeUdder({ transparent: true }); ud.group.position.set(0, 0.5, 0); scene.add(ud.group);
  const camObj = cam(45);
  return {
    scene, camera: camObj,
    update(t) {
      ud.update(t);
      const k = easeInOut(range(t, 0, 2));
      place(camObj, [lerp(0.4, 0.2, k), lerp(0.8, 0.7, k), lerp(0.8, 0.6, k)], [0, 0.6, 0]);
      return { dof: { focus: camObj.position.distanceTo(V(0, 0.6, 0)), aperture: 0.02, maxblur: 0.03 }, bloom: 0.3 };
    },
  };
}

// ============ SHOT 3: Sphincter muscle close-up ============
function shot3({ makeStage }) {
  const scene = makeStage({ shadowSize: 1, skyColor: 0x1a1a2e });
  const sph = makeSphincter(); sph.group.position.set(0, 0.5, 0); scene.add(sph.group);
  const camObj = cam(55);
  return {
    scene, camera: camObj,
    update(t) {
      sph.update(t);
      const k = easeInOut(range(t, 0, 2.5));
      place(camObj, [lerp(0.25, 0.15, k), lerp(0.55, 0.5, k), lerp(0.25, 0.18, k)], [0, 0.5, 0]);
      return { dof: { focus: camObj.position.distanceTo(V(0, 0.5, 0)), aperture: 0.08, maxblur: 0.04 }, bloom: 0.4 };
    },
  };
}

// ============ SHOT 4: Trap-and-push hand motion demo ============
function shot4({ makeStage }) {
  const scene = makeStage({ shadowSize: 2 });
  const hand = makeHand(); hand.group.position.set(0, 0.5, 0.2); scene.add(hand.group);
  const te = makeTeat({ transparent: true }); te.group.position.set(0, 0.45, 0); scene.add(te.group);
  const camObj = cam(50);
  return {
    scene, camera: camObj,
    update(t) {
      // Trap phase (squeeze base)
      const trap = easeInOut(range(t, 0.1, 1.0));
      // Push phase (roll down)
      const push = easeInOut(range(t, 1.0, 2.2));
      hand.update(t, trap, push);
      te.update(t, trap, push);
      // Milk drops
      if (push > 0.3) {
        // milk drops fall
      }
      const k = easeInOut(range(t, 0, 2.8));
      place(camObj, [lerp(0.3, 0.15, k), lerp(0.6, 0.55, k), lerp(0.35, 0.28, k)], [0, 0.5, 0]);
      return { dof: { focus: camObj.position.distanceTo(V(0, 0.5, 0)), aperture: 0.05, maxblur: 0.03 }, bloom: 0.2 };
    },
  };
}

// ============ SHOT 5: Cow anatomy cross-section - milk let-down ============
function shot5({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, skyColor: 0x0d1117 });
  const c = makeCow({ xray: true }); c.group.position.set(0, 0, 0); scene.add(c.group);
  const camObj = cam(35);
  return {
    scene, camera: camObj,
    update(t) {
      c.update(t, true);
      const k = easeInOut(range(t, 0, 3));
      place(camObj, [lerp(-0.4, -0.25, k), lerp(0.8, 0.7, k), lerp(2.2, 1.8, k)], [0, 0.8, 0]);
      return { dof: { focus: camObj.position.distanceTo(V(0, 0.8, 0)), aperture: 0.005, maxblur: 0.01 }, bloom: 0.3 };
    },
  };
}

// ============ SHOT 6: Oxytocin flow - brain to udder ============
function shot6({ makeStage }) {
  const scene = makeStage({ shadowSize: 3, skyColor: 0x0d1117 });
  const oxy = makeOxytocinFlow(); scene.add(oxy.root);
  const camObj = cam(40);
  return {
    scene, camera: camObj,
    update(t) {
      oxy.update(t);
      const k = easeInOut(range(t, 0, 3.5));
      place(camObj, [lerp(-0.2, 0.1, k), lerp(1.0, 0.9, k), lerp(2.0, 1.6, k)], [0.1, 0.8, 0]);
      return { dof: { focus: camObj.position.distanceTo(V(0.1, 0.8, 0)), aperture: 0.004, maxblur: 0.008 }, bloom: 0.5 };
    },
  };
}

// ============ SHOT 7: Machine milking - pulsating vacuum ============
function shot7({ makeStage }) {
  const scene = makeStage({ shadowSize: 2.5 });
  const machine = makeMilkingMachine(); machine.group.position.set(-0.3, 0, 0); scene.add(machine.group);
  const c = makeCow(); c.group.position.set(0.4, 0, 0); scene.add(c.group);
  const ud = makeUdder(); ud.group.position.copy(c.udderPos); scene.add(ud.group);
  const camObj = cam(36);
  return {
    scene, camera: camObj,
    update(t) {
      machine.update(t);
      c.update(t);
      ud.update(t);
      ud.group.position.copy(c.udderPos);
      // Pulsating effect
      const pulse = (Math.sin(t * 2 * Math.PI) + 1) / 2; // 1 Hz for demo
      machine.setVacuum(pulse);
      ud.setSuction(pulse);
      const k = easeInOut(range(t, 0, 3.5));
      place(camObj, [lerp(-0.5, -0.3, k), lerp(1.0, 0.9, k), lerp(2.0, 1.7, k)], [0.1, 1.0, 0.1]);
      return { dof: { focus: camObj.position.distanceTo(V(0.1, 1.0, 0.1)), aperture: 0.003, maxblur: 0.006 }, bloom: 0.2 };
    },
  };
}

// ============ SHOT 8: Calf nursing - natural rhythm ============
function shot8({ makeStage }) {
  const scene = makeStage({ shadowSize: 3, sunDir: [1, 8, 3] });
  const cow = makeCow(); cow.group.position.set(-0.2, 0, 0); scene.add(cow.group);
  const calfModel = makeCalf(); calfModel.group.position.set(-0.8, 0, 0.3); calfModel.group.rotation.y = 0.4; scene.add(calfModel.group);
  const camObj = cam(34);
  return {
    scene, camera: camObj,
    update(t) {
      cow.update(t);
      calfModel.update(t);
      const k = easeInOut(range(t, 0, 3));
      place(camObj, [lerp(-0.8, -0.6, k), lerp(0.8, 0.75, k), lerp(2.2, 1.8, k)], [-0.4, 0.7, 0.2]);
      return { dof: { focus: camObj.position.distanceTo(V(-0.4, 0.7, 0.2)), aperture: 0.0025, maxblur: 0.005 }, bloom: 0.15 };
    },
  };
}

// ============ SHOT 9: Payoff - split screen rhythm vs force ============
function shot9({ makeStage }) {
  const scene = makeStage({ shadowSize: 3 });
  const hand = makeHand(); hand.group.position.set(-0.3, 0.4, 0.2); scene.add(hand.group);
  const te = makeTeat({ transparent: true }); te.group.position.set(-0.3, 0.35, 0); scene.add(te.group);
  const machine = makeMilkingMachine({ simple: true }); machine.group.position.set(0.3, 0, 0); scene.add(machine.group);
  const cow = makeCow(); cow.group.position.set(0.8, 0, 0); scene.add(cow.group);
  const ud = makeUdder(); ud.group.position.copy(cow.udderPos); scene.add(ud.group);
  const camObj = cam(38);
  return {
    scene, camera: camObj,
    update(t) {
      // Hand trap-and-push
      const trap = easeInOut(range(t, 0.1, 1.0));
      const push = easeInOut(range(t, 1.0, 2.2));
      hand.update(t % 2.5, trap, push);
      te.update(t % 2.5, trap, push);
      // Machine pulse
      const pulse = (Math.sin(t * 2.5 * Math.PI) + 1) / 2;
      machine.setVacuum(pulse);
      ud.setSuction(pulse);
      cow.update(t);
      ud.root.position.copy(cow.udderPos);
      ud.update(t);
      const k = easeInOut(range(t, 0, 3.5));
      place(camObj, [lerp(-0.1, 0.05, k), lerp(0.9, 0.85, k), lerp(2.0, 1.7, k)], [0.2, 0.8, 0.05]);
      return { dof: { focus: camObj.position.distanceTo(V(0.2, 0.8, 0.05)), aperture: 0.002, maxblur: 0.004 }, bloom: 0.1 };
    },
  };
}

export const SHOTS = [
  { start: 0.00, end: 2.88, build: shot1 },      // "If you think... you're wrong"
  { start: 2.88, end: 7.20, build: shot2 },      // "Most people picture... tooth" + fade
  { start: 7.20, end: 10.16, build: shot3 },     // "But that's not... Inside each teat"
  { start: 10.16, end: 15.04, build: shot4 },    // "a sphincter... gland" - trap & push
  { start: 15.04, end: 20.08, build: shot5 },    // "Then rolling... not a pull"
  { start: 20.08, end: 27.04, build: shot6 },    // "The cow's body... sphincter opens"
  { start: 27.04, end: 33.76, build: shot7 },    // "Machines copy... suckle"
  { start: 33.76, end: 38.72, build: shot8 },    // "Sixty pulses... sixty percent rest"
  { start: 38.72, end: 41.46, build: shot9 },    // "That's the secret: rhythm, not force"
];

// ======== Prop factories (defined here for this project) ========

function makeCow({ xray = false } = {}) {
  const group = new THREE.Group();
  const root = { group, udderPos: new THREE.Vector3(-0.15, 0.45, -0.25) };
  const M = materials();
  // Body
  const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.2, 8, 16);
  const bodyMat = M.cowBody(xray);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  group.add(body);
  // Legs
  for (const [x, z] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), bodyMat);
    leg.position.set(x, 0.3, z);
    group.add(leg);
  }
  // Head
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 6, 8), bodyMat);
  head.position.set(-0.55, 1.3, 0);
  head.rotation.x = -0.2;
  group.add(head);
  // Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 6), bodyMat);
    ear.position.set(-0.55 + s * 0.15, 1.4, 0);
    ear.rotation.z = s * 0.3;
    group.add(ear);
  }
  // Tail
  const tail = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 3, 4), bodyMat);
    seg.position.y = -0.08 * i;
    seg.rotation.x = -0.3;
    tail.add(seg);
  }
  tail.position.set(0, 1.0, 0.5);
  group.add(tail);

  root.update = (t, showXray = false) => {
    // Breathing
    body.scale.y = 1 + Math.sin(t * 1.5) * 0.01;
    // Tail sway
    tail.rotation.z = Math.sin(t * 2) * 0.2;
    // Head bob
    head.position.y = 1.3 + Math.sin(t * 1.2) * 0.02;
    if (showXray) {
      bodyMat.opacity = 0.3;
      bodyMat.transparent = true;
    }
  };
  return root;
}

function makeUdder({ transparent = false } = {}) {
  const group = new THREE.Group();
  const root = { group, teats: [] };
  const M = materials();
  // Udder base
  const udderGeo = new THREE.SphereGeometry(0.35, 16, 12);
  const udderMat = M.udder(transparent);
  const udderMesh = new THREE.Mesh(udderGeo, udderMat);
  udderMesh.scale.set(1, 0.7, 0.9);
  udderMesh.position.y = 0.3;
  group.add(udderMesh);

  root.group = group; // for compatibility
  root.root = group; // alias

  // Four teats
  const teatPositions = [
    [-0.12, -0.1, -0.15],
    [0.12, -0.1, -0.15],
    [-0.12, -0.1, 0.15],
    [0.12, -0.1, 0.15],
  ];
  for (const [x, y, z] of teatPositions) {
    const t = makeTeat({ transparent });
    t.group.position.set(x, y + 0.3, z);
    group.add(t.group);
    root.teats.push(t.group);
  }

  let suctionAmount = 0;
  root.update = (t) => {
    udderMesh.scale.y = 0.7 + Math.sin(t * 1.2) * 0.02 + suctionAmount * 0.05;
  };
  root.setSuction = (amt) => { suctionAmount = amt; };
  return root;
}

function makeTeat({ transparent = false } = {}) {
  const group = new THREE.Group();
  const M = materials();
  const geo = new THREE.CapsuleGeometry(0.025, 0.08, 8, 12);
  const mat = M.teat(transparent);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  group.add(mesh);

  // Sphincter ring (visible when transparent)
  let sphincter = null;
  if (transparent) {
    const ringGeo = new THREE.TorusGeometry(0.028, 0.006, 8, 16);
    const ringMat = M.sphincter();
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    group.add(ring);
    sphincter = ring;
  }

  const root = {
    group,
    update: (t, trap, push) => {
      if (trap > 0) {
        // Squeeze at base
        mesh.scale.y = 1 - trap * 0.3;
        mesh.scale.x = mesh.scale.z = 1 + trap * 0.2;
      }
      if (push > 0) {
        // Roll down - move mesh down slightly
        mesh.position.y = -push * 0.04;
        // Milk drops
      }
      if (transparent && sphincter) {
        sphincter.scale.setScalar(1 - trap * 0.5);
      }
    }
  };
  return root;
}

function makeSphincter() {
  const group = new THREE.Group();
  const root = { group };
  root.root = group; // alias
  const M = materials();
  // Muscle fibers ring
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const fiber = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.004, 0.03, 3, 6),
      M.muscleFiber()
    );
    fiber.position.set(Math.cos(angle) * 0.03, 0, Math.sin(angle) * 0.03);
    fiber.rotation.z = angle;
    fiber.rotation.x = Math.PI / 2;
    group.add(fiber);
    root[`fiber${i}`] = fiber;
  }
  // Center opening
  const opening = new THREE.Mesh(
    new THREE.RingGeometry(0.008, 0.025, 16),
    M.sphincterOpening()
  );
  opening.rotation.x = -Math.PI / 2;
  group.add(opening);
  root.opening = opening;

  root.update = (t) => {
    const pulse = (Math.sin(t * 3) + 1) / 2;
    for (let i = 0; i < 16; i++) {
      const f = root[`fiber${i}`];
      f.scale.y = 0.5 + pulse * 0.5;
    }
    opening.scale.setScalar(0.3 + pulse * 0.7);
  };
  return root;
}

function makeHand() {
  const M = materials();
  const group = new THREE.Group();
  const root = { group };
  root.root = group; // alias
  // Palm
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.1), M.skin);
  palm.position.y = 0.04;
  group.add(palm);
  // Fingers
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    const proximal = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 4, 6), M.skin);
    proximal.position.y = -0.02;
    f.add(proximal);
    const distal = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.03, 4, 6), M.skin);
    distal.position.y = -0.06;
    f.add(distal);
    f.position.set((i - 1.5) * 0.02, 0.04, 0.03);
    group.add(f);
    fingers.push({ proximal, distal, group: f });
  }
  // Thumb
  const thumb = new THREE.Group();
  const tProx = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 4, 6), M.skin);
  tProx.position.set(-0.05, 0.02, 0);
  tProx.rotation.z = -0.5;
  thumb.add(tProx);
  const tDist = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.025, 4, 6), M.skin);
  tDist.position.set(-0.08, 0.01, -0.01);
  tDist.rotation.z = -0.8;
  thumb.add(tDist);
  thumb.position.set(0.04, 0.04, 0.05);
  group.add(thumb);
  root.thumb = thumb;

  root.update = (t, trap, push) => {
    // Trap: thumb and fingers squeeze at base
    for (const f of fingers) {
      f.proximal.rotation.x = -trap * 1.2;
      f.distal.rotation.x = -trap * 0.8;
    }
    thumb.rotation.z = -0.5 + trap * 0.3;
    // Push: roll fingers down
    if (push > 0) {
      for (const f of fingers) {
        f.group.rotation.x = push * 0.8;
        f.group.position.y = -push * 0.02;
      }
      thumb.rotation.x = push * 0.5;
    }
  };
  return root;
}

function makeOxytocinFlow() {
  const group = new THREE.Group();
  const root = { group };
  root.root = group; // alias (shot6 does scene.add(oxy.root))
  const M = materials();
  // Brain area
  const brain = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 12),
    M.brain()
  );
  brain.position.set(-0.5, 1.5, 0);
  group.add(brain);
  // Particles flowing down
  const particles = new THREE.Points(
    new THREE.BufferGeometry(),
    M.particle()
  );
  const count = 200;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -0.5 + (Math.random() - 0.5) * 0.1;
    positions[i * 3 + 1] = 1.5 - Math.random() * 1.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    velocities[i] = 0.5 + Math.random() * 0.5;
  }
  particles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
  group.add(particles);
  root.particles = particles;
  root.positions = positions;

  // Udder target
  const udderTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    M.udderGlow()
  );
  udderTarget.position.set(0, 0.5, 0);
  group.add(udderTarget);
  root.udderTarget = udderTarget;

  root.update = (t) => {
    brain.material.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.3;
    udderTarget.material.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.4;
    // Animate particles
    const pos = root.positions;
    const vel = particles.geometry.attributes.velocity.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= vel[i] * 0.01;
      if (pos[i * 3 + 1] < 0.6) {
        pos[i * 3 + 1] = 1.5;
        pos[i * 3] = -0.5 + (Math.random() - 0.5) * 0.1;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;
  };
  return root;
}

function makeMilkingMachine({ simple = false } = {}) {
  const group = new THREE.Group();
  const root = { group };
  root.root = group; // alias
  const M = materials();
  if (!simple) {
    // Main unit
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), M.metal());
    unit.position.set(0, 0.4, 0);
    group.add(unit);
    // Vacuum gauge
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16), M.glass());
    gauge.position.set(0.15, 0.45, 0);
    group.add(gauge);
    // Tubes to teats
    for (let i = 0; i < 4; i++) {
      const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.5, 4, 8), M.tube());
      tube.position.set(-0.15 + i * 0.1, 0.2, 0.2);
      tube.rotation.x = -0.5;
      group.add(tube);
    }
  } else {
    // Simple pulsator
    const pulsator = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16), M.metal());
    pulsator.position.set(0, 0.3, 0);
    group.add(pulsator);
    root.pulsator = pulsator;
  }
  let vacuumLevel = 0;
  root.update = (t) => {
    if (root.pulsator) {
      root.pulsator.scale.y = 1 + vacuumLevel * 0.2;
    }
  };
  root.setVacuum = (level) => { vacuumLevel = level; };
  return root;
}

function makeCalf() {
  const group = new THREE.Group();
  const root = { group };
  root.root = group; // alias
  const M = materials();
  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 8, 12), M.calfBody());
  body.position.y = 0.45;
  group.add(body);
  // Legs
  for (const [x, z] of [[-0.1, -0.15], [0.1, -0.15], [-0.1, 0.15], [0.1, 0.15]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 6), M.calfBody());
    leg.position.set(x, 0.15, z);
    group.add(leg);
  }
  // Head
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.15, 6, 8), M.calfBody());
  head.position.set(-0.22, 0.6, 0);
  head.rotation.x = -0.3;
  group.add(head);
  // Mouth area for suckling
  const mouth = new THREE.Group();
  mouth.position.set(-0.3, 0.55, 0);
  group.add(mouth);
  root.mouth = mouth;

  root.update = (t) => {
    // Suckling motion
    const suckle = (Math.sin(t * 4 * Math.PI) + 1) / 2;
    mouth.position.y = 0.55 + suckle * 0.03;
    mouth.position.z = -suckle * 0.02;
    head.rotation.x = -0.3 + suckle * 0.1;
  };
  return root;
}

function makeStage({ shadowSize = 3, skyColor = 0x87ceeb, sunDir = [1, 5, 3] }) {
  const scene = new THREE.Scene();
  // Sky
  const skyGeo = new THREE.SphereGeometry(50, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Ground
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Lighting
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
  // Fill light
  const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
  fill.position.set(-sunDir[0], sunDir[1], -sunDir[2]);
  scene.add(fill);
  return scene;
}
