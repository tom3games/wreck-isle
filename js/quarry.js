// 東の採石場: 段の掘り跡（地形は area.js）、砕石の工場とベルトコンベア、積み出し桟橋と運搬船、
// 重機（ショベル・ダンプ）、現場事務所、仮設トイレ、火薬庫（中の火薬の箱は連鎖して爆発する）
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwur1e4h'
import { colFromMesh } from './colmesh.js?v=mwur1e4h'
import { mat } from './level.js?v=mwur1e4h'
import { terrainH, QUARRY } from './area.js?v=mwur1e4h'

const yellow = () => new THREE.MeshStandardMaterial({ color: 0xd8a21c, roughness: 0.5, metalness: 0.2 })
const steelM = () => new THREE.MeshStandardMaterial({ color: 0x6f7478, roughness: 0.55, metalness: 0.75 })
const darkM = () => new THREE.MeshStandardMaterial({ color: 0x1d1e1f, roughness: 0.75 })
function box(scene, w, h, d, m, x, y, z, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; scene.add(o); return o }
function col(world, x0, y0, z0, x1, y1, z1, kind = 'solid') { return world.add({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], kind }) }

export function buildQuarry(level, scene, world) {
  const B = level.B.bind(level)
  // 道を東へ（門まで）
  B(30, -3.2, 8, 56, 0, 14, 'road')
  for (let x = 32; x < 56; x += 4) B(x, 0, 10.95, x + 2.2, 0.006, 11.05, 'paint', { nocol: true })
  B(30, 0, 8.25, 56, 0.006, 8.37, 'paint', { nocol: true }); B(30, 0, 13.63, 56, 0.006, 13.75, 'paint', { nocol: true })
  // 町の岸壁の端と海の間をふさぐ
  B(30, -3.2, -20.4, 30.4, 0.2, -14, 'seawall')
  // 東の海岸（消波の岩）と人だけ止める柵
  col(world, 30, 0, -14.6, 62, 1.05, -14.1, 'edge'); col(world, 74, 0, -14.6, 100, 1.05, -14.1, 'edge')
  col(world, 30, -3, -30, 31.5, 40, -20.4) // 東の端の見えない壁（x=100）は外した。崖には見える柵（mainland.js）
  rocks(scene)
  // 積み出し桟橋と運搬船
  B(62, -3.2, -28, 74, 0, -14, 'quay'); B(61.6, -3.2, -28.4, 74.4, -0.02, -28, 'seawall')
  B(61.6, -3.2, -28, 62, -0.02, -14, 'seawall'); B(74, -3.2, -28, 74.4, -0.02, -14, 'seawall')
  col(world, 61.5, 0, -28.6, 74.5, 1.05, -28.1, 'edge'); col(world, 61.5, 0, -28.6, 62, 1.05, -14.5, 'edge'); col(world, 74, 0, -28.6, 74.5, 1.05, -14.5, 'edge')
  for (const z of [-26, -21, -16]) { const g = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 14); g.translate(73.7, 0.27, z); level.push('bollard', g); B(73.45, 0, z - 0.25, 73.95, 0.6, z + 0.25, null, { vis: false }) }
  barge(scene, 80.5, -22)
  // 砕石の工場とベルトコンベア
  crusher(level, scene, world, 76, 21)
  conveyor(scene, world, [76, 9.4, 18.5], [68, 6.2, -24], 1.0)  // 工場 → 桟橋
  conveyor(scene, world, [79.5, 8.5, 22], [86, 3.4, -5], 0.8)   // 工場 → 砂利の山
  // 重機
  excavator(scene, world, 72, terrainH(72, 49), 49, -0.4)
  dumpTruck(scene, world, 50, 25, 0.5)
  dumpTruck(scene, world, 66, 36, -1.2)
  // 現場事務所（2階建てのプレハブ）
  office(level, scene, world, 34, 17)
  // 仮設トイレ・三角コーン・看板・照明塔
  for (const [x, z] of [[46, 17.5], [47.3, 17.5]]) { box(scene, 1.1, 2.3, 1.1, new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.5 }), x, 1.15, z); col(world, x - 0.55, 0, z - 0.55, x + 0.55, 2.3, z + 0.55) }
  for (const [x, z] of [[54, 9], [54, 13], [58, 16], [60, 16], [62, 16]]) cone(scene, x, z)
  board(scene, 55.5, 2.2, 15.2, Math.PI, tr('発破作業中　立入禁止', 'BLASTING — KEEP OUT'), 2.6, 0.9, '#c9301e')
  board(scene, 89, 2.2, 21.2, Math.PI, tr('火薬庫　火気厳禁', 'EXPLOSIVES — NO FIRE'), 2.2, 0.8, '#c9301e')
  lightTower(scene, world, 64, 30); lightTower(scene, world, 96, 45)
  // 門と金網（人は止める・爆弾は通る）
  fence(scene, world, [[56, 14.2], [56, 30]]); fence(scene, world, [[56, 7.8], [56, -12]])
  B(55.8, 0, 14, 56.2, 2.4, 14.4, 'rustMetal'); B(55.8, 0, 7.6, 56.2, 2.4, 8.0, 'rustMetal')
  // 崖の上の柵（落ちないように）
  fence(scene, world, [[54, 30], [54, 74]], true); fence(scene, world, [[54, 74], [99, 74]], true)
  // 火薬庫
  magazine(level, scene, world, 88, 23)
  // 大きな岩（掘り跡の隠れ場所）
  for (const [x, z, s] of [[62, 38, 2.4], [78, 40, 3], [86, 50, 2.6], [64, 57, 2.2], [80, 60, 2.8], [44, 28, 2]]) boulder(scene, world, x, terrainH(x, z), z, s)
  // ドラム缶と木箱
  for (const [x, z] of [[58, 24], [58.7, 24.6], [70, 40], [44, 4]]) level.drum(x, z)
  level.crate(38, 26, 1.1); level.crate(39.2, 26, 1.1); level.crate(52, 30, 1.0)
  level.spawnsExtra2 = [[40, 0, 0], [92, 0, 8], [76, terrainH(76, 60), 60], [62, 0, 24]]
}

function rocks(scene) {
  const m = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 0.95, map: mat('seawall').map, normalMap: mat('seawall').normalMap })
  const g = new THREE.DodecahedronGeometry(1, 1)
  const N = 90, im = new THREE.InstancedMesh(g, m, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
  let n = 0
  for (let x = 31; x < 100 && n < N; x += 1.4) { if (x > 61 && x < 75) continue; for (const zz of [-14.8, -16.4]) { if (n >= N) break; const s = 0.9 + Math.random() * 0.9; m4.compose(new THREE.Vector3(x + Math.random(), -0.8 - Math.random() * 0.8 + (zz > -15 ? 0.3 : -0.4), zz + Math.random() * 0.6), q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, 0)), new THREE.Vector3(s * 1.3, s, s)); im.setMatrixAt(n++, m4) } }
  im.count = n; im.castShadow = im.receiveShadow = true; scene.add(im)
}

function barge(scene, x, z) {
  const g = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 14), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6, metalness: 0.4 })); hull.position.y = 0.2; g.add(hull)
  const rim = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 14.2), new THREE.MeshStandardMaterial({ color: 0x9a2a1e, roughness: 0.5 })); rim.position.y = 1.05; g.add(rim)
  const pile = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 20), mat('gravelPile')); pile.scale.set(1, 1, 2.6); pile.position.y = 1.6; g.add(pile)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.4 })); cab.position.set(0, 2.2, 6); g.add(cab)
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true } })
  g.position.set(x, -1.5, z); scene.add(g); (scene.userData.boats || (scene.userData.boats = [])).push(g); g.userData.bob = 2
}

function crusher(level, scene, world, x, z) {
  const s = steelM(), y = yellow()
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { box(scene, 0.4, 7, 0.4, s, x + dx, 3.5, z + dz); col(world, x + dx - 0.25, 0, z + dz - 0.25, x + dx + 0.25, 7, z + dz + 0.25) }
  box(scene, 6.8, 0.25, 6.8, s, x, 7, z); box(scene, 4, 2.2, 4, y, x, 8.2, z)
  // ホッパー（上がひらいた枡）
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(3, 1.2, 2.6, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide })); hop.rotation.y = Math.PI / 4; hop.position.set(x, 10.6, z); hop.castShadow = true; scene.add(hop)
  // 下の砕石の山と、受けの台
  box(scene, 3, 1.2, 3, mat('block'), x, 0.6, z); col(world, x - 1.5, 0, z - 1.5, x + 1.5, 1.2, z + 1.5)
  // 階段の手すりのような梯子
  for (let i = 0; i < 12; i++) box(scene, 0.6, 0.04, 0.05, s, x + 3.4, 0.5 + i * 0.55, z + 3.3)
}

function conveyor(scene, world, a, b, w) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length()
  const g = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, L), steelM()); g.add(frame)
  const belt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, L), darkM()); belt.position.y = 0.2; g.add(belt)
  const load = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.12, L * 0.98), mat('gravelPile')); load.position.y = 0.28; g.add(load)
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, L), steelM()); rail.position.set(s * (w / 2 + 0.35), 0.5, 0); g.add(rail) }
  g.position.copy(A).add(Bv).multiplyScalar(0.5)
  g.lookAt(Bv); g.traverse(o => { if (o.isMesh) o.castShadow = true }); scene.add(g)
  // 脚（当たりあり）
  const n = Math.max(2, Math.floor(L / 7))
  for (let i = 1; i < n; i++) {
    const p = A.clone().addScaledVector(d, i / n), gy = Math.max(0, terrainH(p.x, p.z))
    if (p.y - gy < 1) continue
    for (const s of [-1, 1]) { const side = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(s * (w / 2 + 0.2)); const leg = box(scene, 0.22, p.y - gy, 0.22, steelM(), p.x + side.x, gy + (p.y - gy) / 2, p.z + side.z); col(world, leg.position.x - 0.15, gy, leg.position.z - 0.15, leg.position.x + 0.15, p.y, leg.position.z + 0.15) }
  }
}

function excavator(scene, world, x, y, z, ry) {
  const g = new THREE.Group(), Y = yellow(), D = darkM(), glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2226, roughness: 0.05, envMapIntensity: 1.4 })
  const add = (geo, m, px, py, pz, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.set(rx, 0, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(4.2, 0.9, 0.8), D, 0, 0.45, s * 1.25)
  add(new THREE.BoxGeometry(3.4, 1.2, 2.6), Y, -0.2, 1.6, 0)
  add(new THREE.BoxGeometry(1.4, 1.5, 1.2), Y, 0.8, 2.85, -0.6)
  add(new THREE.BoxGeometry(1.42, 0.9, 1.22), glass, 0.8, 3.0, -0.6)
  add(new THREE.BoxGeometry(1.6, 1.0, 2.4), D, -1.7, 2.1, 0) // 重り
  // ブームとアーム、バケツ
  const boom = add(new THREE.BoxGeometry(4.2, 0.55, 0.5), Y, 2.6, 3.4, 0.4, 0, 0.55)
  const arm = add(new THREE.BoxGeometry(3.0, 0.45, 0.4), Y, 5.1, 3.0, 0.4, 0, -0.9)
  add(new THREE.BoxGeometry(1.0, 0.9, 1.1), D, 5.9, 1.6, 0.4, 0, 0.4)
  g.position.set(x, y, z); g.rotation.y = ry; scene.add(g)
  colFromMesh(world, g)
}

function dumpTruck(scene, world, x, z, ry) {
  const g = new THREE.Group(), Y = yellow(), D = darkM(), glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2226, roughness: 0.05 })
  const add = (geo, m, px, py, pz, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.x = rx; o.castShadow = o.receiveShadow = true; g.add(o); return o }
  add(new THREE.BoxGeometry(2.8, 0.6, 7.6), D, 0, 1.3, 0)
  const bed = add(new THREE.BoxGeometry(3.4, 1.6, 4.8), Y, 0, 2.6, -1.2)
  add(new THREE.BoxGeometry(3.0, 0.5, 4.2), mat('gravelPile'), 0, 3.4, -1.2)
  add(new THREE.BoxGeometry(2.6, 1.8, 2.0), Y, 0, 2.5, 2.6)
  add(new THREE.BoxGeometry(2.62, 0.8, 1.6), glass, 0, 2.9, 2.75)
  const wg = new THREE.CylinderGeometry(0.85, 0.85, 0.7, 24); wg.rotateZ(Math.PI / 2)
  for (const [wx, wz] of [[-1.45, 2.4], [1.45, 2.4], [-1.45, -1.6], [1.45, -1.6], [-1.45, -3.0], [1.45, -3.0]]) add(wg, mat('tire'), wx, 0.85, wz)
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g)
  colFromMesh(world, g)
}

function office(level, scene, world, x, z) {
  const w = 10, d = 5, h1 = 2.8, h2 = 5.6, B = level.B.bind(level)
  B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
  level.wallX(x, x + w, z, 0, h1, 0.12, 'office', [{ a: x + 1.3, b: x + 2.7, y0: 0, y1: 2.1 }, { a: x + 4, b: x + 6, y0: 0.9, y1: 2.0 }, { a: x + 7.2, b: x + 9, y0: 0.9, y1: 2.0 }])
  level.wallX(x, x + w, z + d, 0, h1, 0.12, 'office', [{ a: x + 3, b: x + 5, y0: 0.9, y1: 2.0 }])
  level.wallZ(z, z + d, x, 0, h1, 0.12, 'office'); level.wallZ(z, z + d, x + w, 0, h1, 0.12, 'office', [{ a: z + 1.5, b: z + 3.5, y0: 0.9, y1: 2.0 }])
  B(x - 0.2, h1, z - 1.2, x + w + 0.2, h1 + 0.15, z + d + 0.1, 'office') // 2階の床と、前の通路
  level.wallX(x, x + w, z, h1 + 0.15, h2, 0.12, 'office', [{ a: x + 1.5, b: x + 2.5, y0: h1 + 0.15, y1: h1 + 2.2 }, { a: x + 4, b: x + 9, y0: h1 + 1.0, y1: h1 + 2.1 }])
  level.wallX(x, x + w, z + d, h1 + 0.15, h2, 0.12, 'office')
  level.wallZ(z, z + d, x, h1 + 0.15, h2, 0.12, 'office'); level.wallZ(z, z + d, x + w, h1 + 0.15, h2, 0.12, 'office')
  B(x - 0.2, h2, z - 0.2, x + w + 0.2, h2 + 0.15, z + d + 0.2, 'office')
  // 通路の手すり
  B(x - 0.2, h1 + 0.15, z - 1.25, x + w - 2.2, h1 + 1.1, z - 1.15, 'rustMetal')
  // 外の鉄の階段（東の端から通路へ）
  const n = Math.round((h1 + 0.15) / 0.2), run = 0.28
  for (let i = 0; i < n; i++) { const top = (i + 1) * ((h1 + 0.15) / n), za = z - 1.2 - (n - i) * run, zb = z - 1.2 - (n - i - 1) * run
    B(x + w - 2.0, 0, za, x + w - 0.6, top, zb, null, { vis: false }); B(x + w - 2.0, top - 0.05, za, x + w - 0.6, top, zb, 'rustMetal', { nocol: true }) }
  for (const sx of [x + w - 2.05, x + w - 0.55]) { const g = new THREE.BoxGeometry(0.06, 0.18, n * run * 1.25); g.rotateX(Math.atan2(h1 + 0.15, n * run)); g.translate(sx, (h1 + 0.15) / 2, z - 1.2 - n * run / 2); level.push('rustMetal', g) }
  level.sign(x + w / 2, h2 - 0.6, z - 0.08, Math.PI, tr('西浦砕石　現場事務所', 'NISHIURA QUARRY OFFICE'), 5.5, 0.6)
  // 中の机
  B(x + 3.5, 0, z + 2, x + 6.5, 0.75, z + 3.2, 'wood'); B(x + 3.5, h1 + 0.15, z + 2.2, x + 6, h1 + 0.9, z + 3.2, 'wood')
}

function magazine(level, scene, world, x, z) {
  const B = level.B.bind(level), w = 6, d = 5, h = 2.8, t = 0.45
  B(x, 0, z, x + w, 0.15, z + d, 'slab', { nocol: true })
  level.wallX(x, x + w, z, 0, h, t, 'block', [{ a: x + 2.2, b: x + 3.8, y0: 0, y1: 2.2 }])
  level.wallX(x, x + w, z + d, 0, h, t, 'block'); level.wallZ(z, z + d, x, 0, h, t, 'block'); level.wallZ(z, z + d, x + w, 0, h, t, 'block')
  B(x - 0.3, h, z - 0.3, x + w + 0.3, h + 0.35, z + d + 0.3, 'block')
  // 開いた鉄の扉
  box(scene, 1.6, 2.2, 0.08, new THREE.MeshStandardMaterial({ color: 0x5d6a5c, roughness: 0.6, metalness: 0.6 }), x + 1.3, 1.1, z - 0.7, 0.9)
  // 中の火薬の箱（誘爆する）
  const lab = labelTex()
  const crateM = [mat('wood'), mat('wood'), mat('wood'), mat('wood'), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.8 })]
  for (const [cx, cz, cy] of [[x + 1.2, z + 3.8, 0.15], [x + 2.2, z + 3.8, 0.15], [x + 1.7, z + 3.8, 0.75], [x + 4.4, z + 3.6, 0.15], [x + 4.4, z + 2.5, 0.15], [x + 4.9, z + 3.0, 0.75]]) {
    const m = box(scene, 0.9, 0.6, 0.6, crateM, cx, cy + 0.3, cz)
    const bx = world.add({ min: [cx - 0.45, cy, cz - 0.3], max: [cx + 0.45, cy + 0.6, cz + 0.3], kind: 'solid', tag: 'drum' })
    level.drums.push({ x: cx, y: cy, z: cz, box: bx, alive: true, r: 0.45, h: 0.6, mesh: m, spec: 'tnt' })
  }
}
function labelTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 170; const g = c.getContext('2d')
  g.fillStyle = '#9a8460'; g.fillRect(0, 0, 256, 170)
  g.fillStyle = '#c9301e'; g.beginPath(); g.moveTo(128, 18); g.lineTo(200, 85); g.lineTo(128, 152); g.lineTo(56, 85); g.closePath(); g.fill()
  g.fillStyle = '#fff'; g.font = '900 54px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tr('火', 'TNT'), 128, 88)
  g.fillStyle = '#2a2017'; g.font = '700 16px sans-serif'; g.fillText(tr('取扱注意', 'HANDLE WITH CARE'), 128, 160)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function cone(scene, x, z) {
  const g = new THREE.Group()
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0xe0471e, roughness: 0.5 })); c.position.y = 0.38; g.add(c)
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 })); b.position.y = 0.42; g.add(b)
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), new THREE.MeshStandardMaterial({ color: 0x1d1e1f })); base.position.y = 0.02; g.add(base)
  g.position.set(x, 0, z); g.traverse(o => { if (o.isMesh) o.castShadow = true }); scene.add(g)
}
function board(scene, x, y, z, ry, text, w, h, colr) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d')
  g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = colr; g.lineWidth = 18; g.strokeRect(9, 9, c.width - 18, c.height - 18)
  g.fillStyle = colr; g.font = `900 ${Math.round(c.height * 0.42)}px "Zen Kaku Gothic New", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2, c.width * 0.92)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m)
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, y + h / 2, 8), steelM()); p.position.set(x + s * w * 0.4 * Math.cos(ry), (y + h / 2) / 2 - 0.0, z - s * w * 0.4 * Math.sin(ry) + 0.03); scene.add(p) }
}
function lightTower(scene, world, x, z) {
  const y = Math.max(0, terrainH(x, z)), s = steelM()
  box(scene, 0.25, 9, 0.25, s, x, y + 4.5, z); col(world, x - 0.2, y, z - 0.2, x + 0.2, y + 9, z + 0.2)
  box(scene, 2.0, 0.6, 0.3, s, x, y + 9.2, z)
  for (const dx of [-0.6, 0, 0.6]) box(scene, 0.5, 0.4, 0.12, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.5 }), x + dx, y + 9.2, z - 0.2)
}
function fence(scene, world, pts, top) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d')
  g.strokeStyle = 'rgba(200,205,205,1)'; g.lineWidth = 3
  for (let i = -128; i < 256; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping
  const fm = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.7 })
  const [a, b] = pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 3)
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n
    const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1
    const y0 = Math.max(0, terrainH(x0, z0)), y1 = Math.max(0, terrainH(x1, z1)), yy = Math.min(y0, y1)
    const seg = Math.hypot(x1 - x0, z1 - z0)
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(seg, 1.8), fm); pl.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.9, (z0 + z1) / 2); pl.rotation.y = -Math.atan2(z1 - z0, x1 - x0); fm.map.repeat.set(seg / 1.2, 1.5); scene.add(pl)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), steelM()); post.position.set(x0, y0 + 0.95, z0); scene.add(post)
    col(world, Math.min(x0, x1) - 0.06, yy - 0.5, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, Math.max(y0, y1) + 1.8, Math.max(z0, z1) + 0.06, 'edge')
  }
}
function boulder(scene, world, x, y, z, s) {
  const g = new THREE.DodecahedronGeometry(s * 0.6, 1), p = g.attributes.position
  for (let i = 0; i < p.count; i++) { const k = 0.8 + Math.random() * 0.35; p.setXYZ(i, p.getX(i) * k * 1.2, p.getY(i) * k * 0.75, p.getZ(i) * k) }
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, mat('boulder')); m.position.set(x, y + s * 0.3, z); m.rotation.y = Math.random() * 6; m.castShadow = m.receiveShadow = true; scene.add(m)
  colFromMesh(world, m)
}
