// WRECK ISLE の車（軽トラ）。動き・壁と車どうしの当たり・壊れ方（へこみ・部品が飛ぶ・煙→黒煙→火→爆発）
import * as THREE from 'three'
import { pushOut, roofAt, roofPush } from './collide.js?v=mwur1e4h'
import { mat } from './level.js?v=mwur1e4h'
import { VT, buildVehicle, makeAccessories, CAR_K } from './vehicles.js?v=mwur1e4h'

export const CAR = { half: [1.75, 0.72], top: 1.9, accel: 11, brake: 24, maxF: 19, maxR: 7, wheelbase: 2.2, steer: 0.62, grip: 7 }
// 壊れの段階: 0 きれい / 1 煙 / 2 黒煙 / 3 火 / 爆発
export const STAGE_HP = [70, 45, 25]
export const stageOf = hp => hp >= STAGE_HP[0] ? 0 : hp >= STAGE_HP[1] ? 1 : hp >= STAGE_HP[2] ? 2 : 3
export const REPAIR_TO = [100, 85, 62, 40]

// 車の色（落ち着いた塗装の色）。名前は画面の知らせに使う
export const PAINT = [
  ['あなた', 0xe9ebea], ['赤', 0xa8322a], ['青', 0x2c4f8c], ['黄', 0xd9a92b], ['緑', 0x3f6b45], ['橙', 0xc9692c],
  ['黒', 0x26282a], ['銀', 0x9aa1a6], ['水色', 0x6fa3b8], ['紫', 0x5d4778], ['茶', 0x6b4a33], ['桃', 0xc77d86],
]
// 島に置いてある空き車（持ち主なし。壊れ具合とガソリンはばらばら）
export const SPARE = [['白', 0xd8d6cf], ['灰', 0x6e7175], ['錆', 0x8a5a3a], ['藍', 0x2b3550], ['若草', 0x8fa35a], ['クリーム', 0xd9caa0]]

// ---------- 見た目 ----------
// 前（運転台）が模型の -x 側。部品は「前・後ろ・左・右」に分けて持ち、当たった側の部品から飛ばす
export function buildCar(color) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 0.85, clearcoatRoughness: 0.15 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1214, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.7 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.4, metalness: 0.85 })
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfaf3df, emissive: 0x2a2416, roughness: 0.15 })
  const parts = { F: [], B: [], L: [], R: [], bed: [] }
  const add = (geo, m, px, py, pz, zone) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; body.add(o); if (zone) parts[zone].push(o); return o }
  const W = 1.38
  const s = new THREE.Shape()
  s.moveTo(0.06, 0.38); s.lineTo(0.02, 0.98); s.quadraticCurveTo(0.03, 1.06, 0.16, 1.1); s.lineTo(0.42, 1.78); s.quadraticCurveTo(0.47, 1.86, 0.58, 1.86); s.lineTo(1.36, 1.86); s.quadraticCurveTo(1.43, 1.86, 1.44, 1.78); s.lineTo(1.44, 0.38); s.lineTo(0.06, 0.38)
  const cabG = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6, steps: 4 }); cabG.translate(0, 0, -W / 2)
  const cab = add(cabG, paint, 0, 0, 0)
  cabG.userData.p0 = cabG.attributes.position.array.slice()
  // 窓
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.72, W - 0.14), glass); ws.position.set(0.28, 1.45, 0); ws.lookAt(new THREE.Vector3(-1, 0.42, 0).add(ws.position)); body.add(ws); parts.F.push(ws); ws.userData.glass = true
  for (const side of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), glass); sw.position.set(0.92, 1.5, side * (W / 2 + 0.035)); sw.rotation.y = side > 0 ? 0 : Math.PI; body.add(sw); parts[side > 0 ? 'L' : 'R'].push(sw); sw.userData.glass = true }
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, 0.32), glass); rw.position.set(1.475, 1.55, 0); rw.rotation.y = Math.PI / 2; body.add(rw)
  // 前: 灯り・格子・バンパー
  for (const sd of [-0.48, 0.48]) add(new THREE.BoxGeometry(0.05, 0.14, 0.26), lamp, -0.005, 0.88, sd, 'F')
  add(new THREE.BoxGeometry(0.04, 0.12, 0.6), dark, -0.01, 0.7, 0, 'F')
  add(new THREE.BoxGeometry(0.16, 0.18, W + 0.06), dark, -0.04, 0.44, 0, 'F')
  // 横: ドア（塗装の板）・鏡・取っ手
  for (const sd of [-1, 1]) {
    const z = sd * (W / 2 + 0.04), zone = sd > 0 ? 'L' : 'R'
    add(new THREE.BoxGeometry(0.92, 0.8, 0.035), paint, 0.92, 0.86, z, zone)
    add(new THREE.BoxGeometry(0.06, 0.15, 0.1), dark, 0.4, 1.3, sd * (W / 2 + 0.11), zone)
    add(new THREE.BoxGeometry(0.14, 0.03, 0.02), steel, 1.22, 1.08, sd * (W / 2 + 0.065), zone)
  }
  // 荷台
  add(new THREE.BoxGeometry(1.95, 0.1, W), steel, 2.45, 0.6, 0)
  add(new THREE.BoxGeometry(1.95, 0.32, 0.04), paint, 2.45, 0.81, W / 2 - 0.02, 'L'); add(new THREE.BoxGeometry(1.95, 0.32, 0.04), paint, 2.45, 0.81, -W / 2 + 0.02, 'R')
  add(new THREE.BoxGeometry(0.05, 0.32, W), paint, 3.41, 0.81, 0, 'B')
  add(new THREE.BoxGeometry(0.14, 0.14, W + 0.04), dark, 3.47, 0.44, 0, 'B')
  const tailM = new THREE.MeshStandardMaterial({ color: 0x8a1a12, emissive: 0x2a0402, roughness: 0.3 }), tail = []
  for (const sd of [-0.52, 0.52]) tail.push(add(new THREE.BoxGeometry(0.04, 0.1, 0.16), tailM, 3.45, 0.66, sd, 'B'))
  for (const zz of [-0.55, -0.2, 0.2, 0.55]) add(new THREE.BoxGeometry(0.03, 0.62, 0.04), steel, 1.5, 1.07, zz)
  add(new THREE.BoxGeometry(0.04, 0.04, W), steel, 1.5, 1.38, 0)
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.9, 0.28, 0.6), mat('styro'), 2.2 + (i % 2) * 0.62, 0.8 + Math.floor(i / 2) * 0.3, -0.3 + (i % 2) * 0.55, 'bed')
  add(new THREE.BoxGeometry(3.3, 0.12, 1.1), dark, 1.7, 0.36, 0)
  // 車輪（体とは別にして、壊れると体だけ傾く）
  const tg = new THREE.CylinderGeometry(0.29, 0.29, 0.17, 20); tg.rotateX(Math.PI / 2)
  const hg = new THREE.CylinderGeometry(0.17, 0.17, 0.18, 14); hg.rotateX(Math.PI / 2)
  const wheels = []
  for (const [wx, wz] of [[0.62, 0.6], [0.62, -0.6], [2.8, 0.6], [2.8, -0.6]]) {
    const piv = new THREE.Group(); piv.position.set(wx, 0.29, wz); g.add(piv)
    const t = new THREE.Mesh(tg, mat('tire')), h = new THREE.Mesh(hg, steel); t.castShadow = true
    const spin = new THREE.Group(); spin.add(t); spin.add(h); h.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.19), dark)); piv.add(spin)
    wheels.push({ piv, spin, front: wx < 1 })
  }
  // 槍（ふだんは隠す）: 前のバンパーから前へ突き出る鉄の杭
  const spear = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.3, metalness: 0.9 })); shaft.rotation.z = Math.PI / 2; shaft.position.x = -1.6; spear.add(shaft)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xc9ccce, roughness: 0.25, metalness: 0.95 })); tip.rotation.z = Math.PI / 2; tip.position.x = -3.5; spear.add(tip)
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.5), dark); mount.position.x = 0.3; spear.add(mount)
  spear.position.set(0.7, 1.98, 0); spear.rotation.z = 0.12 /* 屋根の上から前へ（後ろのカメラから見える高さ） */; spear.visible = false; spear.scale.set(0.01, 1, 1); g.add(spear)
  // 磁石（屋根の上）: 赤い馬蹄形と銀の先
  const magnet = new THREE.Group()
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 10, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xb0281c, roughness: 0.4, metalness: 0.3 })); magnet.add(arc)
  for (const sx of [-0.32, 0.32]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), new THREE.MeshStandardMaterial({ color: 0xb0281c, roughness: 0.4, metalness: 0.3 })); leg.position.set(sx, -0.14, 0); magnet.add(leg); const tp = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.21), steel); tp.position.set(sx, -0.33, 0); magnet.add(tp) }
  magnet.rotation.y = Math.PI / 2; magnet.position.set(0.9, 2.42, 0); magnet.visible = false; g.add(magnet)
  // ジェット（荷台の後ろの噴き出し口）
  const jet = new THREE.Group()
  for (const sd of [-0.4, 0.4]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide })); n.rotation.z = Math.PI / 2; n.position.set(3.6, 0.95, sd); jet.add(n) }
  jet.visible = false; g.add(jet)
  return { g, body, cab, paint, parts, wheels, spear, magnet, jet, glassMat: glass, tail }
}

// ---------- 飛んだ部品（バンパー・ドア・発泡の箱）と細かい破片 ----------
export class Debris {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.list = []
    const cg = new THREE.BoxGeometry(0.1, 0.02, 0.07)
    this.chips = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }), 240)
    this.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.chips.count = 0; this.chips.frustumCulled = false; this.chips.castShadow = false
    this.chips.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(this.chips); this.cs = []
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.c = new THREE.Color()
  }
  // 部品を車から外して飛ばす（見た目の位置はそのまま）
  fling(mesh, vel, spin = 12) {
    if (!mesh.parent) return
    this.scene.attach(mesh)
    this.list.push({ m: mesh, v: vel.clone(), w: new THREE.Vector3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin), t: 0, rest: false })
    if (this.list.length > 70) { const o = this.list.shift(); o.m.visible = false; this.scene.remove(o.m) }
  }
  chip(p, vel, color, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.cs.length >= 240) this.cs.shift()
      const v = vel.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6))
      this.cs.push({ p: p.clone(), v, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: (Math.random() - 0.5) * 30, t: 0, col: color, s: 0.6 + Math.random() * 1.0 })
    }
  }
  ground(x, z) { const h = this.world.H(x, z); return h < -1e8 ? -2 : h }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i]; d.t += dt
      if (d.t > 14) { d.m.visible = false; this.scene.remove(d.m); this.list.splice(i, 1); continue }
      if (d.rest) continue
      d.v.y -= 22 * dt; d.m.position.addScaledVector(d.v, dt)
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt
      const gy = this.ground(d.m.position.x, d.m.position.z) + 0.05
      if (d.m.position.y < gy) {
        d.m.position.y = gy; d.v.y *= -0.3; d.v.x *= 0.55; d.v.z *= 0.55; d.w.multiplyScalar(0.5)
        if (d.v.lengthSq() < 0.5) { d.rest = true; d.m.rotation.x = Math.round(d.m.rotation.x / Math.PI) * Math.PI; d.m.rotation.z = Math.round(d.m.rotation.z / Math.PI) * Math.PI }
      }
    }
    let n = 0
    for (let i = this.cs.length - 1; i >= 0; i--) {
      const d = this.cs[i]; d.t += dt
      if (d.t > 5) { this.cs.splice(i, 1); continue }
      d.v.y -= 22 * dt; d.p.addScaledVector(d.v, dt)
      const gy = this.ground(d.p.x, d.p.z) + 0.02
      if (d.p.y < gy) { d.p.y = gy; d.v.y *= -0.25; d.v.x *= 0.5; d.v.z *= 0.5; d.w *= 0.4 }
      d.r.x += d.w * dt; d.r.y += d.w * 0.6 * dt
    }
    for (const d of this.cs) { this.q.setFromEuler(d.r); this.m4.compose(d.p, this.q, this.v.setScalar(d.s)); this.chips.setMatrixAt(n, this.m4); this.chips.setColorAt(n, this.c.setHex(d.col)); n++ }
    this.chips.count = n; this.chips.instanceMatrix.needsUpdate = true; if (this.chips.instanceColor) this.chips.instanceColor.needsUpdate = true
  }
  clear() { for (const d of this.list) { d.m.visible = false; this.scene.remove(d.m) } this.list = []; this.cs = [] }
}

// 本当の地面（今の高さで絞らない）: 地形と、平たい箱（道・岸壁・橋の床）の上面の高い方。置く時と検査に使う
export function surfaceAt(world, x, z) {
  let h = world.H(x, z); if (h < -1e8) h = -9
  for (const b of world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [])) { if (b.dead || b.kind !== 'solid' || x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2] || b.max[1] - b.min[1] > 4) continue; if (b.max[1] > h && b.max[1] < Math.max(h, -1) + 2.5) h = b.max[1] /* 海の上の桟橋・橋も拾う */ }
  return h
}

// ---------- 車 ----------
export class Car {
  constructor(game, idx, x, z, yaw, paint, type = 'kei') {
    this.g = game; this.idx = idx; this.type = type; this.T = VT[type]
    const [name, color] = paint || PAINT[idx % PAINT.length]
    this.name = name; this.paintName = name === 'あなた' ? '白' : name; this.color = color
    this.driver = null; this.fuel = this.T.tank; this.lampT = 0
    this.v3 = buildVehicle(type, color)
    this.pivot = new THREE.Group(); game.scene.add(this.pivot); { const pv = this.pivot, up = THREE.Object3D.prototype.updateMatrixWorld; pv.updateMatrixWorld = function (f) { if (this.matrixWorldAutoUpdate === false && !f) return; up.call(this, f) } } // 眠っている車は中の部品ごと形の計算を飛ばす
    this.pivot.add(this.v3.g); this.v3.g.position.set(this.v3.offsetX, 0, 0)
    if (!this.T.bike) this.pivot.scale.setScalar(CAR_K)
    Object.assign(this.v3, makeAccessories(this.T, this.pivot))
    this.x = x; this.z = z; this.yaw = yaw; this.y = surfaceAt(game.world, x, z)
    this.vx = 0; this.vz = 0; this.vy = 0; this.w = 0; this.steer = 0; this.wheelRot = 0
    this.pitch = 0; this.roll = 0; this.flipX = 0; this.flipZ = 0; this.fwX = 0; this.fwZ = 0; this.air = false
    this.hp = 100; this.alive = true; this.slideT = 0; this.smokeAcc = 0; this.fireAcc = 0
    this.item = null; this.rollT = 0; this.jetT = 0; this.spearT = 0; this.magT = 0
    this.lastHitBy = null; this.lastHitT = -9; this.kills = 0; this.dealt = 0
    this.sag = new THREE.Vector3(); this.input = { throttle: 0, steer: 0 }
    this.outT = 0
    this.sync()
  }
  // ジャンプ: 車1台を飛び越えられる高さ（約2.6m）。地面にいる時だけ・1.6秒に1回
  jump() {
    const g = this.g
    if (this.air || !this.alive || this.fuel <= 0 || g.t - (this.jumpT ?? -9) < 1.6) return false
    this.vy = this.T.jump; this.air = true; this.jumped = true; this.jumpT = g.t
    g.sound('thud', this, 0.45); g.ev.jumps = (g.ev.jumps || 0) + 1
    return true
  }
  get speed() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw) }
  get body() { return { x: this.x, y: this.y, z: this.z } }
  get stage() { return stageOf(this.hp) }
  fwd() { return [Math.sin(this.yaw), Math.cos(this.yaw)] }
  local(x, z) { const [fx, fz] = this.fwd(), dx = x - this.x, dz = z - this.z; return [dx * fx + dz * fz, dx * -fz + dz * fx] }
  world(a, b) { const [fx, fz] = this.fwd(); return [this.x + fx * a - fz * b, this.z + fz * a + fx * b] }
  circles() { const [fx, fz] = this.fwd(); return this.T.circles.map(o => [this.x + fx * o, this.z + fz * o]) }
  get fuelK() { return this.T.tank === Infinity ? 1 : this.fuel / this.T.tank }
  groundAt(x, z) {
    let h = this.g.world.H(x, z); if (h < -1e8) h = -9
    for (const b of this.g.world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [])) {
      if (b.dead || b.kind !== 'solid' || x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2]) continue
      const top = b.max[1]; if (top > this.y + 0.6 || top < this.y - 0.8 || b.max[1] - b.min[1] > 4) continue
      if (top > h) h = top
    }
    const rf = roofAt(this.g.world, x, z); if (rf > h && rf <= this.y + 0.6 && rf >= this.y - 1.2) h = rf
    return h
  }
  settle() {
    const ha = this.T.half[0] - 0.15, hb = this.T.half[1] - 0.02, W = [[ha, hb], [ha, -hb], [-ha, hb], [-ha, -hb]].map(([a, b]) => { const [x, z] = this.world(a, b); return this.groundAt(x, z) })
    // 車の高さ: 4輪の平均だけだと、段差（道の箱・岸壁・橋のたもと）をまたいで落ちた時に高い側の面より 0.6m 以上沈み、
    // groundAt がその面を「上すぎる」と見なくなって、地面に埋まったまま戻らなかった（地雷で跳ねた後の着地 2026-11-23 本人）。
    // 高い方の車輪から 0.35m より下には沈めない。車体が箱の中に入ってしまった時は、その箱の上へ出す
    let gy = Math.max((W[0] + W[1] + W[2] + W[3]) / 4, Math.max(...W) - 0.35)
    const inTop = this.insideTop(); if (inTop > gy) gy = inTop
    // 屋根の棟をまたいだ時: 真ん中の屋根の高さより大きく沈まない（車輪だけで見ると棟の下に入った）
    const rc = roofAt(this.g.world, this.x, this.z); if (rc > -1e8 && rc <= this.y + 0.8 && rc >= this.y - 1.2) gy = Math.max(gy, rc - 0.2)
    this.pitch = Math.atan2((W[0] + W[1]) - (W[2] + W[3]), 4 * ha)
    this.roll = Math.atan2((W[0] + W[2]) - (W[1] + W[3]), 4 * hb)
    return gy
  }
  // 車体の真ん中が平たい箱（道・岸壁・床）の中に入っていたら、その上面（入っていなければ -1e9）
  insideTop() {
    let t = -1e9
    for (const b of this.g.world.near(this.x - 0.1, this.z - 0.1, this.x + 0.1, this.z + 0.1, [])) {
      if (b.dead || b.kind !== 'solid' || this.x < b.min[0] || this.x > b.max[0] || this.z < b.min[2] || this.z > b.max[2] || b.max[1] - b.min[1] > 4 || b.max[0] - b.min[0] < 1.2 || b.max[2] - b.min[2] < 1.2) continue // 薄い壁は横へ押し出す側で扱う
      if (b.min[1] < this.y + 0.3 && b.max[1] > this.y + 0.25 && b.max[1] < this.y + 2.5 && b.max[1] > t) t = b.max[1]
    }
    // 屋根の中（天井の当たりの上・屋根の板の下）に入っていたら屋根の上へ
    const rf = roofAt(this.g.world, this.x, this.z); if (rf > -1e8 && this.y > rf - 0.8 && this.y < rf - 0.05 && rf > t) t = rf // 少しだけ入った時だけ上へ（深く入る前に横へ押し出している）
    return t
  }
  sync() {
    this.pivot.matrixWorldAutoUpdate = this.pivot.visible; this._mDirty = 2 // 眠っている車は形の計算（行列）を毎コマしない。動かしたら 2コマは計算する
    this.pivot.rotation.set(-this.roll + this.flipZ, this.yaw + Math.PI / 2, this.pitch + this.flipX, 'YZX')
    this.pivot.position.set(this.x, this.y, this.z)
  }
  // 世界の点を車の模型の座標に（前・後ろ・左・右のどこに当たったか）
  zoneAt(px, pz) {
    const [a, b] = this.local(px, pz), na = a / this.T.half[0], nb = b / this.T.half[1]
    if (Math.abs(na) > Math.abs(nb) * 0.9) return a > 0 ? 'F' : 'B'
    return b > 0 ? 'R' : 'L'
  }
  update(dt) {
    const g = this.g
    // 止まっている空き車は眠らせる（車を増やしても重くならないように）。押されたり乗られたりしたら起きる
    if (!this.driver && !this.air && this.vy === 0 && Math.abs(this.vx) + Math.abs(this.vz) + Math.abs(this.w) < 0.02 && (this.stage < 3 || !this.alive) && !this.jetT && !this.magT) { this.sleepT = (this.sleepT || 0) + dt; if (this.sleepT > 1) { this.vx = this.vz = this.w = 0; if (this.stage >= 1) this.effects(dt); if (this._mDirty > 0) this._mDirty--; else this.pivot.matrixWorldAutoUpdate = false; return } } else this.sleepT = 0
    let inp = this.alive && this.driver ? this.input : { throttle: 0, steer: 0 }
    // ガソリン: 走るほど減る（ジェット中は多く減る）。0 で止まる
    if (this.fuel <= 0) { inp = { throttle: 0, steer: inp.steer || 0 }; if (this.jetT > 0) this.jetT = 0.001 }
    // 火が出ている車は燃え続けて、やがて爆発する（降りるなら今）
    if (this.alive && this.stage === 3) { this.hp -= dt * 0.8; if (this.hp <= 0) { g.explodeCar(this, null, 'burn'); return } }
    const [fx, fz] = this.fwd(), rx = -fz, rz = fx
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * rx + this.vz * rz
    const TT = this.T, jet = this.jetT > 0, maxF = jet ? Math.max(31, TT.maxF + 8) : TT.maxF * (this.stage === 3 ? 0.88 : 1), acc = jet ? 34 : TT.accel
    if (!this.air) {
      const t = inp.throttle || 0
      if (jet) vf += acc * dt
      else if (t > 0) { if (vf < 0) vf += CAR.brake * t * dt; else if (vf < maxF) vf += acc * t * dt * (1 - Math.max(0, vf) / (maxF * 1.15)) }
      else if (t < 0) { if (vf > 0.3) vf -= CAR.brake * -t * dt; else vf -= TT.accel * 0.7 * -t * dt }
      if (vf > maxF && !jet) vf -= (vf - maxF) * Math.min(1, dt * 3)
      if (jet && vf > maxF) vf = maxF
      if (vf < -CAR.maxR) vf = -CAR.maxR
      vf *= Math.exp(-dt * (t === 0 && !jet ? 0.9 : 0.12))
      // 横すべり: ふだんは強く止まる。ぶつかった直後は滑る（弾かれた感じ）
      const grip = this.slideT > 0 ? 1.2 : TT.grip
      vl *= Math.exp(-dt * grip)
      // ハンドル。速いほど切れ角を小さく
      const maxSteer = TT.steer / (1 + vf * vf / 220)
      this.steer += ((inp.steer || 0) * maxSteer - this.steer) * Math.min(1, dt * 7)
      const wT = vf / (TT.half[0] * 1.25) * Math.tan(this.steer)
      this.w += (wT - this.w) * Math.min(1, dt * (this.slideT > 0 ? 2 : 9))
      this.vx = fx * vf + rx * vl; this.vz = fz * vf + rz * vl
    } else { this.w *= Math.exp(-dt * 0.5); this.steer *= Math.exp(-dt * 3) }
    this.slideT -= dt
    if (this.driver && this.alive && this.fuel > 0) { const sp0 = Math.hypot(this.vx, this.vz); this.fuel = Math.max(0, this.fuel - (sp0 * 0.05 + (Math.abs(inp.throttle || 0) > 0 ? 0.12 : 0) + (this.jetT > 0 ? 4 : 0)) * dt * g.fuelK * this.T.burn) }
    this.yaw += this.w * dt
    // 動かして世界の壁から押し出す
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt, wallHit = 0
    const [gx, gz] = this.fwd()
    const sp = Math.hypot(this.vx, this.vz)
    // 水: 真ん中の地面が水の深さ（-0.4 より下）で、今より深くなる向きには進めない。浅瀬に押し出された車は陸へ戻れる
    // （四隅で見ると、岸に沿って少しずつ深みへ入って沈んだ・浅瀬で全部の向きが塞がって止まった 2026-11-23）
    if (g.world.terrain) { const gc = this.groundAt(nx, nz), g0c = this.groundAt(this.x, this.z); if (gc < -0.4 && gc < g0c - 0.001) { wallHit = Math.max(wallHit, sp * 0.3); nx = this.x; nz = this.z; this.vx *= -0.3; this.vz *= -0.3 } }
    const pa = this.T.half[0] + 0.05, pb = this.T.half[1] + 0.03
    if (g.world.terrain) for (const o of [pa, -pa, 0]) for (const sb of [-pb, pb]) {
      if (wallHit) break
      const px = nx + gx * o - gz * sb, pz = nz + gz * o + gx * sb, gh = this.groundAt(px, pz)
      const [qx, qz] = this.world(o, sb), g0 = this.groundAt(qx, qz)
      if ((gh - g0 > 0.45 && g0 >= -0.4) || (!this.air && o !== 0 && (gh - this.y) * Math.sign(o) * Math.sign(vf || 1) > Math.abs(o) * 0.75)) {
        wallHit = sp; nx = this.x; nz = this.z
        // 壁の向き: 前後どちらで当たったかで、その向きの速さを跳ね返す
        const vfx = this.vx * gx + this.vz * gz, vlx = this.vx * -gz + this.vz * gx
        const nvf = -vfx * 0.3, nvl = vlx * 0.6
        this.vx = gx * nvf - gz * nvl; this.vz = gz * nvf + gx * nvl
      }
    }
    // 前・真ん中・後ろの3つの円（2つだと、跳ねて薄い壁（窓の下の壁・柵）をまたいで着地した時に、壁が円の間に挟まったまま抜けなかった）
    const cs = this.T.circles.map(o => ({ x: nx + gx * o, z: nz + gz * o, y: this.y + 0.1, h: 1.6, r: this.T.r, vx: this.vx, vz: this.vz }))
    for (const c of cs) {
      const x0 = c.x, z0 = c.z; pushOut(g.world, c)
      const dx = c.x - x0, dz = c.z - z0, d = Math.hypot(dx, dz)
      if (d > 0.002) { const nnx = dx / d, nnz = dz / d, vn = this.vx * nnx + this.vz * nnz; if (vn < 0) { wallHit = Math.max(wallHit, -vn); this.vx -= nnx * vn * 1.35; this.vz -= nnz * vn * 1.35; this.w += (Math.random() - 0.5) * 0.6 } }
    }
    // 屋根（三角の柱）: 横や下から屋根の中へ入らない。軒の下に背の高い車体が入らない。乗れる高さ（0.6m）なら屋根に上がる
    if (g.world.roofs) for (const c of cs) {
      const cc = { x: c.x, z: c.z, y: this.y, h: this.T.h, r: this.T.r, vx: this.vx, vz: this.vz }
      if (roofPush(g.world, cc, 0.6)) { const dx = cc.x - c.x, dz = cc.z - c.z, d = Math.hypot(dx, dz); c.x = cc.x; c.z = cc.z; if (d > 0.002) { const nnx = dx / d, nnz = dz / d, vn = this.vx * nnx + this.vz * nnz; if (vn < 0) { wallHit = Math.max(wallHit, -vn); this.vx -= nnx * vn * 1.35; this.vz -= nnz * vn * 1.35 } } }
    }
    this.x = cs.reduce((s, c) => s + c.x, 0) / cs.length; this.z = cs.reduce((s, c) => s + c.z, 0) / cs.length
    const cl = cs[cs.length - 1], ny = Math.atan2(cs[0].x - cl.x, cs[0].z - cl.z); this.yaw += Math.atan2(Math.sin(ny - this.yaw), Math.cos(ny - this.yaw)) * 0.5
    if (wallHit > 5) g.wallHit(this, wallHit)
    // 海に押し出された: 沈む
    if (g.sinkLog) { (this._hist || (this._hist = [])).push([+this.x.toFixed(1), +this.z.toFixed(1), +this.y.toFixed(2), this.air ? 1 : 0, +Math.hypot(this.vx, this.vz).toFixed(1), +this.groundAt(this.x, this.z).toFixed(2), this.driver ? 1 : 0]); if (this._hist.length > 8) this._hist.shift() }
    if (!this.air && this.alive && this.y < -0.6 && this.groundAt(this.x, this.z) < -0.9) { /* 車輪が岸に乗っていれば沈まない */ if (g.sinkLog) g.sinkLog.push(this._hist.slice()); g.sinkCar(this); return }
    // 高さ: 地面に沿う。跳ね上げられた時は放物線で飛ぶ
    const gy = this.settle()
    if (this.air || this.vy > 0) {
      this.vy -= 24 * dt; this.y += this.vy * dt
      this.flipX += this.fwX * dt; this.flipZ += this.fwZ * dt
      if (this.y <= gy && this.vy <= 0) {
        const hard = -this.vy
        this.y = gy; this.vy = hard > 6 ? hard * 0.22 : 0; this.air = this.vy > 0
        this.fwX *= 0.3; this.fwZ *= 0.3
        if (hard > 4 || this.jumped) g.landHit(this, hard, this.jumped); this.jumped = false
      } else this.air = true
    } else this.y = gy
    if (!this.air) { this.flipX *= Math.exp(-dt * 6); this.flipZ *= Math.exp(-dt * 6); const r = x => Math.atan2(Math.sin(x), Math.cos(x)); this.flipX = r(this.flipX); this.flipZ = r(this.flipZ) }
    // 見た目: 車輪
    this.wheelRot += vf * dt / 0.29
    for (const w of this.v3.wheels) { w.spin.rotation[w.axis] = w.sgn * this.wheelRot * (w.axis === 'x' ? 0.29 / 0.4 : 1); w.piv.rotation.y = w.front ? (w.axis === 'x' ? this.steer : -this.steer) : 0 }
    this.sync()
    // 自転車: 乗っている人を席に置き、ペダルを回す（人は前かがみでこぐ動き）
    if (this.T.bike) {
      if (this.v3.pedal) this.v3.pedal.rotation.x -= vf * dt / 0.33 * 0.5
      const p = this.driver
      if (p && p.alive) { const [sx, sz] = this.world(-0.12, 0); p.body.x = sx; p.body.z = sz; p.body.y = this.y + 0.3; p.body.vx = this.vx * 0.35; p.body.vz = this.vz * 0.35; p.body.onGround = true; p.body.crouch = true; p.yaw = this.yaw; p.char.yaw = this.yaw; p.char.root.visible = true; p.char.update(dt, p.body) }
    }
    this.effects(dt)
  }
  // 壊れ具合の見た目: 煙→黒煙→火。ジェットの炎
  effects(dt) {
    const g = this.g, T = window.__fxT; if (!T) return
    const st = this.stage, hood = new THREE.Vector3(0.6, 1.9, 0)
    if (this.alive && st >= 1) {
      this.smokeAcc += dt * (st === 1 ? 9 : st === 2 ? 15 : 18)
      while (this.smokeAcc > 1) {
        this.smokeAcc--
        const p = this.pt(this.T.half[0] * 0.55 - Math.random() * 0.4, this.T.h + 0.05, (Math.random() - 0.5) * 0.7)
        const dark = st >= 2, gr = dark ? 0.1 + Math.random() * 0.05 : 0.42 + Math.random() * 0.1
        g.fx.sprite({ map: T.smoke[Math.floor(Math.random() * 4)], pos: p, vel: new THREE.Vector3(-this.vx * 0.15, 1.8 + Math.random(), -this.vz * 0.15), size: dark ? 0.8 : 0.6, grow: dark ? 3.4 : 2.4, life: dark ? 3.4 : 2.2, color: new THREE.Color(gr, gr * 0.97, gr * 0.94).getHex(), color2: dark ? 0x2e2a26 : 0x8a8680, drag: 0.7, alpha: dark ? 0.88 : 0.62, fadeIn: 0.08 })
      }
    }
    if (this.alive && st === 3) {
      this.fireAcc += dt * 45
      while (this.fireAcc > 1) {
        this.fireAcc--
        const H0 = this.T.half[0], p = this.pt((Math.random() * 2 - 1) * H0 * 0.8, this.T.h * (0.55 + Math.random() * 0.45), (Math.random() - 0.5) * this.T.half[1] * 1.5)
        const core = Math.random() < 0.2, sz = 0.6 + Math.random() * 0.5
        g.fx.sprite({ map: T.flame, add: core, upright: true, pos: p, vel: new THREE.Vector3(-this.vx * 0.3, 1.0 + Math.random() * 1.0, -this.vz * 0.3), size: core ? sz * 0.8 : sz * 1.25, grow: 0.3, life: 0.4 + Math.random() * 0.3, ...(core ? { hdr: [1.3, 0.75, 0.3], color2: 0xff5a10 } : { color: 0xffb070, color2: 0x8a2006 }), alpha: 0.95, drag: 0.6, fadeIn: 0.03, spin: 0.001 })
      }
      if (Math.random() < dt * 6) g.fx.flash(new THREE.Vector3(this.x, this.y + 1.4, this.z), 18, 0.15)
    }
    // ガソリンが少ない: 後ろから黒い煙をぽすぽす。空: 尾灯が点滅
    if (this.alive && this.driver && this.fuel > 0 && this.fuel < 15 && Math.random() < dt * 3) { const p = this.pt(-this.T.half[0] - 0.1, 0.4, 0.4); g.fx.sprite({ map: T.smoke[0], pos: p, vel: new THREE.Vector3(0, 0.8, 0), size: 0.25, grow: 0.9, life: 0.9, color: 0x1e1c1a, color2: 0x55504a, drag: 1, alpha: 0.7, fadeIn: 0.02 }) }
    if (this.alive) { const blink = this.fuel <= 0 && (performance.now() % 700) < 350; if (blink !== this._blink) { this._blink = blink; for (const m of this.v3.tail) m.material.emissive.setHex(blink ? 0xff3010 : 0x7a0a0a) } }
    if (this.jetT > 0) for (const sd of [-0.4, 0.4]) for (let k = 0; k < 2; k++) {
      const p = this.pt(-this.T.half[0] - 0.4, 0.9, sd), [fx, fz] = this.fwd()
      g.fx.sprite({ map: T.soft, add: true, pos: p, vel: new THREE.Vector3(-fx * 14 + this.vx * 0.6, 0.3, -fz * 14 + this.vz * 0.6), size: 0.38, grow: 0.9, life: 0.14, hdr: [2.4, 1.5, 0.6], color2: 0xff5010, drag: 3, fadeIn: 0 })
    }
  }
  // へこみ: 当たった所のまわりの運転台の点を内側へ押す（1回きりの軽い計算）
  dent(worldP, strength) {
    for (const m of this.v3.dentList) {
      const geo = m.geometry, pos = geo.attributes.position, a = pos.array
      if (!geo.boundingBox) geo.computeBoundingBox()
      const p = m.worldToLocal(worldP.clone()), c = geo.boundingBox.getCenter(new THREE.Vector3())
      const sc = m.getWorldScale(new THREE.Vector3()).x || 1, R = (0.75 + strength * 0.5) / sc, push = Math.min(0.3, 0.05 + strength * 0.22) / sc
      let moved = 0
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - p.x, dy = a[i + 1] - p.y, dz = a[i + 2] - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > R) continue
        const k = (1 - d / R) ** 2 * push, ix = c.x - a[i], iy = c.y - a[i + 1], iz = c.z - a[i + 2], il = Math.hypot(ix, iy, iz) || 1
        a[i] += ix / il * k; a[i + 1] += iy / il * k * 0.6; a[i + 2] += iz / il * k; moved++
      }
      if (moved) { pos.needsUpdate = true; geo.computeVertexNormals() }
    }
  }
  // 車の座標（前 a・上 y・右 b）の点を世界へ
  pt(a, y, b) { const [x, z] = this.world(a, b); return new THREE.Vector3(x, this.y + y, z) }
  // 当たった側の部品をいくつか外して飛ばす
  breakParts(zone, n, vel) {
    const list = this.v3.parts[zone]; let out = 0
    for (let k = 0; k < n && list.length; k++) {
      const i = Math.floor(Math.random() * list.length), m = list.splice(i, 1)[0]
      if (m.userData.glass) { this.g.glassBurst(m, this); continue }
      this.g.debris.fling(m, vel.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 4, (Math.random() - 0.5) * 4)))
      out++
    }
    // 荷台の発泡の箱はどこに当たっても飛び出しやすい
    if (this.v3.parts.bed.length && Math.random() < 0.5) this.g.debris.fling(this.v3.parts.bed.pop(), vel.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 5 + Math.random() * 3, 0)), 8)
    return out
  }
  // 壊れるほど体が傾いて沈む・塗装がくすむ
  wear() {
    const k = 1 - Math.max(0, this.hp) / 100, b = this.v3.body
    if (!this.sagDir) this.sagDir = [Math.random() < 0.5 ? -1 : 1, Math.random() < 0.5 ? -1 : 1]
    b.rotation.x = this.sagDir[0] * k * 0.07; b.rotation.z = this.sagDir[1] * k * 0.045; b.position.y = -k * 0.08
    for (const pm of this.v3.paints) { pm.color.setHex(this.color).lerp(new THREE.Color(0x2a2622), k * 0.45); pm.roughness = 0.32 + k * 0.5; if (pm.clearcoat != null) pm.clearcoat = 0.85 * (1 - k) }
  }
  burnt() {
    const m = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.95, metalness: 0.2 })
    this.pivot.traverse(o => { if (o.isMesh) o.material = m })
    this.v3.spear.visible = this.v3.magnet.visible = this.v3.jet.visible = false
  }
  remove() { this.g.scene.remove(this.pivot) }
}
