// 車の種類（2026-11-23 本人「車の種類と特徴増やして」）。見た目は BREAK THE ROUTE の作り方（断面をつないだ曲面の車体・クリア塗装・実車モデル）を流用
// 速さ・重さ・硬さ・ガソリンの数字に加えて、形と大きさとエンジン音（同じ録音の高さを変える）で違いが分かるようにする
import * as THREE from 'three'
import { ProcCar, RealCar, loadCarModel, carModelReady, sharedMats, wheelGeometries } from './btrcar.js?v=mwu9lb26'

// half: 前後と左右の半分の長さ（m）。circles: 当たりの円の前後の位置。r: 円の半径
// mass: 重さ（ぶつかった時の押し合い）。armor: 硬さ（受ける壊れを割る）。ram: 体当たりの強さ
// tank: ガソリンの量（満タン）。burn: 減りやすさ。jump: ジャンプの勢い。rate: エンジン音の高さ
export const VT = {
  kei:    { name: '軽トラ', note: 'ふつう', en: 'Kei Truck', noteEn: 'All-rounder', half: [1.75, 0.72], circles: [1.05, 0, -1.05], r: 0.8, h: 1.9, mass: 1, armor: 1, ram: 1, maxF: 19, accel: 11, steer: 0.62, grip: 7, tank: 100, burn: 1, jump: 11.2, rate: 1 },
  kcar:   { name: '軽自動車', note: '速くて小回り・もろい', en: 'Kei Car', noteEn: 'Quick and nimble · fragile', half: [1.7, 0.74], circles: [0.95, 0, -0.95], r: 0.8, h: 1.75, mass: 0.75, armor: 0.72, ram: 0.8, maxF: 22, accel: 14, steer: 0.78, grip: 8, tank: 80, burn: 0.75, jump: 11.5, rate: 1.25 },
  sports: { name: 'スポーツカー', note: 'いちばん速い・もろい・ガソリンが少ない', en: 'Sports Car', noteEn: 'Fastest · fragile · small tank', half: [2.25, 0.98], circles: [1.35, 0, -1.35], r: 0.95, h: 1.3, mass: 0.9, armor: 0.7, ram: 1, maxF: 29, accel: 19, steer: 0.66, grip: 9, tank: 60, burn: 1.35, jump: 11.2, rate: 1.55 },
  buggy:  { name: 'バギー', note: '高く跳ぶ・軽い', en: 'Buggy', noteEn: 'Jumps high · light', half: [1.6, 0.95], circles: [0.9, 0, -0.9], r: 0.9, h: 1.6, mass: 0.6, armor: 0.65, ram: 0.7, maxF: 22, accel: 16, steer: 0.8, grip: 6, tank: 70, burn: 0.85, jump: 15.5, rate: 1.4 },
  dump:   { name: 'ダンプ', note: '遅い・硬い・体当たりが強い・ガソリンを食う', en: 'Dump Truck', noteEn: 'Slow · tough · hits hard · thirsty', half: [3.1, 1.25], circles: [2.1, 0.7, -0.7, -2.1], r: 1.2, h: 3.0, mass: 2.6, armor: 2.2, ram: 1.9, maxF: 15, accel: 7, steer: 0.45, grip: 9, tank: 120, burn: 1.8, jump: 8.5, rate: 0.68 },
  bus:    { name: 'バス', note: 'とても硬い・遅い・的が大きい', en: 'Bus', noteEn: 'Very tough · slow · big target', half: [3.9, 1.18], circles: [2.95, 1.45, 0, -1.45, -2.95], r: 1.15, h: 2.85, mass: 3.4, armor: 3, ram: 1.6, maxF: 13.5, accel: 5.5, steer: 0.4, grip: 9, tank: 130, burn: 2, jump: 7, rate: 0.58 },
}
// 自転車（2026-11-24 本人「自転車も所々追加して」）: 徒歩より速く車より遅い・ガソリン不要・とてももろい・乗る人がむき出し・ジャンプ低め
VT.bike = { name: '自転車', note: 'ガソリン不要・とてももろい', en: 'Bike', noteEn: 'No fuel · very fragile', half: [0.9, 0.32], circles: [0.45, -0.45], r: 0.38, h: 1.7, mass: 0.25, armor: 0.3, ram: 0.15, maxF: 9.5, accel: 6, steer: 0.95, grip: 9, tank: Infinity, burn: 0, jump: 6, rate: 0, bike: true }
export const VT_KEYS = Object.keys(VT)

// BREAK THE ROUTE の手続きの車の形（W 半幅・L 半長・H 屋根・hood ボンネット・cabF/cabR 窓の前後・track 車輪の幅・wz 車軸・wr 車輪の半径）
const SH = {
  kcar: { W: 0.74, L: 1.7, H: 1.42, hood: 0.45, cabF: 1.02, cabR: -1.6, track: 0.62, wz: 1.12, wr: 0.3, ww: 0.12, haunch: 1.0, gst: [[0, 0.92], [0.08, 1], [0.62, 1], [1, 0]], top: 0.88, roof: [0.06, 0.64] },
  bus: { W: 1.16, L: 3.9, H: 2.25, hood: 1.05, cabF: 3.75, cabR: -3.8, track: 0.98, wz: 2.6, wz2: -1.6, wr: 0.44, ww: 0.18, haunch: 1.0, gst: [[0, 0.95], [0.03, 1], [0.97, 1], [1, 0.6]], top: 0.95, roof: [0.02, 0.98] },
  dumpCab: { W: 1.22, L: 1.05, H: 2.2, hood: 1.05, cabF: 0.95, cabR: -1.0, track: 1.02, wz: 0.4, wr: 0.55, ww: 0.22, haunch: 1.0, gst: [[0, 1], [0.05, 1], [0.8, 1], [1, 0.5]], top: 0.92, roof: [0.03, 0.85] },
  keiCab: { W: 0.7, L: 0.62, H: 1.55, hood: 0.62, cabF: 0.56, cabR: -0.6, track: 0.6, wz: 0.25, wr: 0.29, ww: 0.13, haunch: 1.0, gst: [[0, 1], [0.05, 1], [0.6, 1], [1, 0.35]], top: 0.9, roof: [0.03, 0.75] },
}

// 運転台の後ろの壁（窓の下半分を塗装で塞ぐ。後ろから見て黒い箱に見えないように）
function rearWall(car, S) {
  const h = (S.H - S.hood) * 0.5, w = new THREE.Mesh(new THREE.BoxGeometry(S.W * 1.84, h, 0.05), car.paintMat)
  w.position.set(0, S.hood + 0.04 + h / 2, S.cabR - 0.01); w.castShadow = true; car.group.add(w)
}

export function preloadVehicles() { return loadCarModel('models/car_lite.glb').catch(() => null) }

// 車の座標（前 a・上 y・右 b）→ 入れ物（pivot。前が -x）の座標
const P = (a, y, b) => new THREE.Vector3(-a, y, -b)

// BREAK THE ROUTE の車（前が +z・原点が車の真ん中）を、WRECK ISLE の入れ物（前が -x・地面が y=0）へ
function wrapBtr(car, groundY) {
  const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2; holder.position.y = -groundY; holder.add(car.group)
  return holder
}

export function buildVehicle(type, color) {
  if (type === 'sports' && !carModelReady()) type = 'kcar' // 実車モデルが読めなかった時
  const M = sharedMats()
  let car, ground
  if (type === 'sports') { car = new RealCar('runner', color); ground = -0.55 }
  else if (type === 'kcar' || type === 'bus') { car = new ProcCar(SH[type], color); ground = car.wheels[0].rest - car.WR }
  else if (type === 'bike') {
    const g = new THREE.Group(), frameM = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.35, clearcoat: 0.8 })
    const tube = (a, b, r = 0.022, m = frameM) => { const v = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 6), m); o.position.copy(a).addScaledVector(v, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); o.castShadow = true; g.add(o); return o }
    const V = (x, y, z) => new THREE.Vector3(x, y, z), wr = 0.33
    // 前が +z。車輪の中心の高さ wr
    const rearC = V(0, wr, -0.52), frontC = V(0, wr, 0.55), crank = V(0, 0.3, -0.02), seat = V(0, 0.92, -0.22), head = V(0, 0.98, 0.42)
    tube(rearC, crank); tube(crank, seat); tube(seat, rearC); tube(seat, head); tube(crank, head); tube(head, frontC, 0.02, M.chrome)
    const bar = tube(V(-0.27, 1.1, 0.4), V(0.27, 1.1, 0.4), 0.018, M.black); tube(head, V(0, 1.1, 0.4), 0.02, M.chrome)
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), M.black); saddle.position.set(0, 0.96, -0.24); g.add(saddle)
    const WG = wheelGeometries(wr, 0.03), wheels = []
    for (const [c, front] of [[frontC, true], [rearC, false]]) {
      const pivot = new THREE.Group(); pivot.position.copy(c); const spin = new THREE.Group()
      const t = new THREE.Mesh(WG.tire, M.tire); t.castShadow = true
      for (let i = 0; i < 12; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, wr * 1.8, 4), M.chrome); sp.rotation.x = i / 12 * Math.PI; spin.add(sp) }
      spin.add(t); pivot.add(spin); g.add(pivot); wheels.push({ pivot, w: spin, front, rest: c.y })
    }
    // ペダル（こぐと回る）
    const ped = new THREE.Group(); ped.position.copy(crank); g.add(ped)
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), M.chrome); arm.position.set(sx * 0.08, sx * 0.08, 0); ped.add(arm); const pd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), M.black); pd.position.set(sx * 0.12, sx * 0.16, 0); ped.add(pd) }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.05), M.head); lamp.position.set(0, 1.0, 0.5); g.add(lamp)
    const tl = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0x7a0a0a, emissiveIntensity: 0.6 }); const rl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), tl); rl.position.set(0, 0.8, -0.62); g.add(rl)
    car = { group: g, wheels, paintMat: frameM, tailMat: tl, parts: {}, extra: { F: [lamp], B: [rl], L: [], R: [bar], bed: [saddle] }, pedal: ped }
    ground = 0
  }
  else if (type === 'kei') {
    // 軽トラ: 丸みのある運転台（BREAK THE ROUTE の断面の作り方）＋ 低いあおりの荷台と発泡の魚箱
    car = new ProcCar(SH.keiCab, color); ground = car.wheels[0].rest - car.WR
    rearWall(car, SH.keiCab)
    const steel = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.4, metalness: 0.85 }), bed = new THREE.Group()
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; bed.add(o); return o }
    const by = -0.02
    add(new THREE.BoxGeometry(1.36, 0.08, 2.15), steel, 0, by, -1.72)
    const sL = add(new THREE.BoxGeometry(0.05, 0.32, 2.15), car.paintMat, 0.68, by + 0.2, -1.72), sR = add(new THREE.BoxGeometry(0.05, 0.32, 2.15), car.paintMat, -0.68, by + 0.2, -1.72)
    const gate = add(new THREE.BoxGeometry(1.36, 0.32, 0.05), car.paintMat, 0, by + 0.2, -2.78)
    for (const sx of [-0.55, -0.2, 0.2, 0.55]) add(new THREE.BoxGeometry(0.04, 0.62, 0.03), steel, sx, by + 0.32, -0.66)
    add(new THREE.BoxGeometry(1.36, 0.04, 0.04), steel, 0, by + 0.63, -0.66)
    const styro = []
    for (let i = 0; i < 3; i++) styro.push(add(new THREE.BoxGeometry(0.6, 0.28, 0.9), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.9 }), -0.3 + (i % 2) * 0.55, by + 0.2 + Math.floor(i / 2) * 0.3, -1.4 - (i % 2) * 0.62))
    const tl = car.tailMat
    for (const sx of [-0.52, 0.52]) add(new THREE.BoxGeometry(0.16, 0.1, 0.04), tl, sx, by + 0.1, -2.81)
    const WG = wheelGeometries(0.29, 0.13)
    for (const sx of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.6, car.wheels[0].rest, -2.2); const spin = new THREE.Group()
      const t = new THREE.Mesh(WG.tire, M.tire); t.castShadow = true; const rim = new THREE.Mesh(WG.rim, M.rim); if (sx < 0) rim.scale.x = -1
      spin.add(t, rim); pivot.add(spin); bed.add(pivot); car.wheels.push({ pivot, w: spin, front: false, rest: pivot.position.y })
    }
    car.group.add(bed)
    const g0 = new THREE.Group(); car.group.position.z = 1.13; g0.add(car.group); car.group = g0
    car.extra = { L: [sL], R: [sR], B: [gate], F: [], bed: styro }
  }
  else if (type === 'dump') {
    car = new ProcCar(SH.dumpCab, color); ground = car.wheels[0].rest - car.WR
    rearWall(car, SH.dumpCab)
    // 運転台を前へ寄せ、後ろに荷台と2本の車軸
    const bedMat = new THREE.MeshStandardMaterial({ color: 0xc9821f, roughness: 0.55, metalness: 0.35 })
    const bed = new THREE.Group()
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; bed.add(o); return o }
    const by = 0.55
    add(new THREE.BoxGeometry(2.5, 0.16, 3.9), bedMat, 0, by, -3.25)
    const sideL = add(new THREE.BoxGeometry(0.1, 1.05, 3.9), bedMat, 1.2, by + 0.6, -3.25), sideR = add(new THREE.BoxGeometry(0.1, 1.05, 3.9), bedMat, -1.2, by + 0.6, -3.25)
    const front = add(new THREE.BoxGeometry(2.5, 1.35, 0.12), bedMat, 0, by + 0.75, -1.3)
    const gate = add(new THREE.BoxGeometry(2.5, 1.05, 0.12), bedMat, 0, by + 0.6, -5.2)
    for (let i = 0; i < 5; i++) for (const sx of [-1.26, 1.26]) add(new THREE.BoxGeometry(0.05, 0.9, 0.08), M.black, sx, by + 0.6, -1.7 - i * 0.85)
    add(new THREE.BoxGeometry(1.0, 0.3, 5.6), M.black, 0, 0.05, -2.6)
    const WG = wheelGeometries(0.55, 0.24)
    for (const z of [-3.0, -4.3]) for (const sx of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * 1.02, car.wheels[0].rest, z); const spin = new THREE.Group()
      const t = new THREE.Mesh(WG.tire, M.tire); t.castShadow = true; const rim = new THREE.Mesh(WG.rim, M.rim); if (sx < 0) rim.scale.x = -1
      spin.add(t, rim); pivot.add(spin); bed.add(pivot); car.wheels.push({ pivot, w: spin, front: false, rest: pivot.position.y })
    }
    car.group.add(bed); car.group.position.z = 0 // 運転台の真ん中が z=0、荷台は後ろ（-z）へ
    const g0 = new THREE.Group(); car.group.position.z = 2.05; g0.add(car.group); car.group = g0
    car.extra = { L: [sideL], R: [sideR], B: [gate], F: [], bed: [front] }
  } else if (type === 'buggy') {
    const g = new THREE.Group(), pipe = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, metalness: 0.8, roughness: 0.35 })
    const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 })
    const tube = (a, b, r = 0.045) => { const v = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), pipe); o.position.copy(a).addScaledVector(v, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); o.castShadow = true; g.add(o); return o }
    const V = (x, y, z) => new THREE.Vector3(x, y, z)
    for (const sx of [-0.62, 0.62]) { tube(V(sx, -0.05, 1.3), V(sx, -0.05, -1.2), 0.055); tube(V(sx, -0.05, -0.65), V(sx * 0.85, 0.95, -0.4)); tube(V(sx, -0.05, 0.55), V(sx * 0.85, 0.95, 0.15)); tube(V(sx * 0.85, 0.95, -0.4), V(sx * 0.85, 0.95, 0.15)) }
    tube(V(-0.53, 0.95, -0.4), V(0.53, 0.95, -0.4)); tube(V(-0.53, 0.95, 0.15), V(0.53, 0.95, 0.15)); tube(V(-0.62, -0.05, 1.3), V(0.62, -0.05, 1.3), 0.055)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.9), paint); nose.position.set(0, 0.12, 1.0); nose.rotation.x = -0.18; nose.castShadow = true; g.add(nose)
    const eng = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.55), M.black); eng.position.set(0, 0.2, -1.0); g.add(eng)
    for (const sx of [-0.3, 0.3]) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.12), new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.8 })); seat.position.set(sx, 0.35, -0.42); seat.rotation.x = -0.25; g.add(seat) }
    const fender = []
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.85), paint); f.position.set(sx * 0.86, 0.38, sz * 1.0); f.castShadow = true; g.add(f); fender.push(f) }
    const WG = wheelGeometries(0.47, 0.25), wheels = []
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.86, -0.08, sz * 1.0); const spin = new THREE.Group()
      const t = new THREE.Mesh(WG.tire, M.tire); t.castShadow = true; const rim = new THREE.Mesh(WG.rim, M.rim); if (sx < 0) rim.scale.x = -1
      spin.add(t, rim); pivot.add(spin); g.add(pivot); wheels.push({ pivot, w: spin, front: sz > 0, rest: -0.08 })
    }
    const tl = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0x7a0a0a, emissiveIntensity: 0.6 })
    for (const sx of [-0.4, 0.4]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.04), tl); l.position.set(sx, 0.25, -1.3); g.add(l) }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.06), M.head); hl.position.set(0, 0.32, 1.46); g.add(hl)
    car = { group: g, wheels, paintMat: paint, tailMat: tl, parts: {}, body: null, extra: { L: [fender[0], fender[2]], R: [fender[1], fender[3]], F: [nose, hl], B: [eng], bed: [] } }
    ground = -0.08 - 0.47
  }
  const holder = wrapBtr(car, ground)
  const body = new THREE.Group(); body.add(holder)
  const g = new THREE.Group(); g.add(body)
  // 部品を前後左右へ分ける（車の座標で、どちら側にあるか）
  const parts = { F: [], B: [], L: [], R: [], bed: [] }
  const T = VT[type]
  g.updateMatrixWorld(true)
  const side = m => { const l = g.worldToLocal(m.getWorldPosition(new THREE.Vector3())); const a = -l.x, b = -l.z; return Math.abs(a) / T.half[0] > Math.abs(b) / T.half[1] ? (a > 0 ? 'F' : 'B') : (b > 0 ? 'R' : 'L') }
  for (const k of Object.keys(car.parts || {})) { const m = car.parts[k]; if (m) parts[side(m)].push(m) }
  if (car.extra) for (const z of Object.keys(car.extra)) parts[z].push(...car.extra[z])
  const wheels = car.wheels.map(w => ({ piv: w.pivot, spin: w.w, front: w.front, axis: 'x', sgn: 1 }))
  const dentList = []
  if (car.dentMeshes) for (const d of car.dentMeshes) dentList.push(d.mesh)
  else if (car.body) dentList.push(car.body)
  for (const m of dentList) if (!m.geometry.userData.p0) m.geometry.userData.p0 = m.geometry.attributes.position.array.slice()
  const paints = car.paintMats || [car.paintMat]
  const tail = []
  if (car.tailMat || car.brakeMat) tail.push({ material: car.tailMat || car.brakeMat })
  return { g, body, paint: paints[0], paints, parts, wheels, dentList, tail, offsetX: 0, btr: car, pedal: car.pedal, seat: type === 'bike' ? new THREE.Vector3(0.22, 0.75, 0) : null }
}

// アイテムの見た目（槍・磁石・ジェットの噴き出し口）を車の大きさに合わせて入れ物（pivot）に付ける
export function makeAccessories(T, pivot) {
  const M = sharedMats(), L = T.half[0], top = T.h
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.3, metalness: 0.9 })
  const spear = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 10), steel); shaft.rotation.z = Math.PI / 2; shaft.position.x = -1.6; spear.add(shaft)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xd9dcde, roughness: 0.2, metalness: 0.95 })); tip.rotation.z = Math.PI / 2; tip.position.x = -3.5; spear.add(tip)
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.5), M.black); mount.position.x = 0.3; spear.add(mount)
  spear.position.copy(P(L - 1.0, top + 0.08, 0)); spear.rotation.z = 0.12; spear.visible = false; spear.scale.set(0.01, 1, 1); pivot.add(spear)
  const magnet = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0xb0281c, roughness: 0.4, metalness: 0.3 })
  magnet.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 10, 20, Math.PI), red))
  for (const sx of [-0.32, 0.32]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), red); leg.position.set(sx, -0.14, 0); magnet.add(leg); const tp = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.21), steel); tp.position.set(sx, -0.33, 0); magnet.add(tp) }
  magnet.rotation.y = Math.PI / 2; magnet.position.copy(P(0.2, top + 0.55, 0)); magnet.visible = false; pivot.add(magnet)
  const jet = new THREE.Group()
  for (const sd of [-0.4, 0.4]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide })); n.rotation.z = Math.PI / 2; n.position.copy(P(-L - 0.15, 0.9, sd)); jet.add(n) }
  jet.visible = false; pivot.add(jet)
  return { spear, magnet, jet }
}
