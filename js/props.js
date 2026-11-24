// 小物: Poly Haven の模型（CC0）と、日本の漁港らしい物を手で組んだ物
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwur1e4h'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from '../vendor/jsm/libs/meshopt_decoder.module.js'
import { mat } from './level.js?v=mwur1e4h'
import { buildPoles } from './poles.js?v=mwur1e4h'

const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map()
async function model(name) {
  if (!cache.has(name)) cache.set(name, gl.loadAsync(`./assets/models/${name}/${name}.gltf`).then(g => g.scene))
  return cache.get(name)
}
function shadows(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material.map) m.material.map.anisotropy = 8 } }) }

// size: 合わせる大きさ [軸, m]（例 ['y', 0.88]）
export async function place(scene, world, name, x, y, z, rotY = 0, size = null, col = false) {
  const src = await model(name)
  const o = src.clone(true)
  o.rotation.y = rotY
  if (size) {
    const b = new THREE.Box3().setFromObject(o), s = new THREE.Vector3(); b.getSize(s)
    const k = size[1] / s[size[0]]; o.scale.setScalar(k)
  }
  o.updateMatrixWorld(true)
  const b = new THREE.Box3().setFromObject(o)
  o.position.set(x - (b.min.x + b.max.x) / 2, y - b.min.y, z - (b.min.z + b.max.z) / 2)
  shadows(o); scene.add(o)
  // 遠い小物は描かない（島が広くなって 1コマの描く回数が増えた 2026-11-23）。大きい物ほど遠くまで見せる
  { const s = new THREE.Vector3(); b.getSize(s); o.userData.cullDist = Math.min(2000, 120 + s.length() * 25) }
  if (col) {
    o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o)
    world.add({ min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z], kind: 'solid' })
  }
  return o
}

export async function buildProps(scene, world, level) {
  const P = (...a) => place(scene, world, ...a)
  const jobs = []
  // ドラム缶（見た目。当たりと誘爆は level.drums）
  for (const d of level.drums) if (!d.mesh) jobs.push(P('Barrel_01', d.x, d.y || 0, d.z, Math.random() * 6, ['y', d.h]).then(o => { d.mesh = o; o.userData.cullDist = 0; tintDrum(o, d) }))
  // 浮き輪（岸壁の柱に掛ける）
  for (const [x, z] of [[3.3, -19.85], [8.8, -19.85], [-20, -19.85]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), mat('darkWood')); post.position.set(x, 0.65, z); post.castShadow = true; scene.add(post)
    jobs.push(P('lifebuoy', x, 0.55, z - 0.08, 0, ['x', 0.68]).then(o => { o.rotation.x = 0; }))
  }
  // 古タイヤの防舷材（岸壁の面）
  for (const x of [-27, -21.5, -12, -6, 13, 18, 25]) jobs.push(P('old_tyre', x, -1.15, -20.55, 0, ['y', 0.95]))
  // 小舟と浮標
  jobs.push(P('ocean_buoy', 20, -1.9, -36, 0, ['y', 2.2]))
  // 街灯・配電箱・室外機・ゴミ箱・ガスボンベ・灯油缶
  jobs.push(P('utility_box_01', -7.6, 0, -1.6, -Math.PI / 2, ['y', 1.5], true))
  jobs.push(P('exterior_aircon_unit', -12.6 + 0.0, 0.35, 26.4, Math.PI, ['y', 0.62], true))
  jobs.push(P('exterior_aircon_unit', 16.6, 0.35, 22, Math.PI / 2, ['y', 0.62], true))
  jobs.push(P('metal_trash_can', 3.3, 0, 15.1, 0, ['y', 0.8], true))
  jobs.push(P('propane_tank', -13.2, 0, 22.5, 0, ['y', 1.1], true))
  jobs.push(P('propane_tank', -13.2, 0, 23.0, 0, ['y', 1.1], true))
  jobs.push(P('metal_jerrycan', -0.4, 0, 11.1, 0.5, ['y', 0.45]))
  jobs.push(P('security_light', -17, 4.6, 0.2, 0, ['y', 0.35]))
  // 青いかご（魚のコンテナ）
  for (const [x, z, n] of [[6, -17, 3], [6.7, -17, 2], [-14, -18.4, 2], [21.6, -10.6, 3]])
    for (let i = 0; i < n; i++) jobs.push(P('plastic_crate_01', x, i * 0.3, z, 0, ['x', 0.62]))
  // かごの実寸（幅0.62）に合わせる。広く取ると見えない壁になる（2026-11-20）
  for (const [x, z, hw, h] of [[6.35, -17, 0.68, 0.9], [-14, -18.4, 0.33, 0.6], [21.6, -10.6, 0.33, 0.9]]) world.add({ min: [x - hw, 0, z - 0.27], max: [x + hw, h, z + 0.27], kind: 'solid' })
  jobs.push(P('cardboard_box_01', -25, 0, -6, 0.3, ['y', 0.5], true))
  jobs.push(P('cardboard_box_01', -25, 0.5, -6, 1.1, ['y', 0.45]))
  // 岩と低木
  jobs.push(P('coast_rocks_01', -27, -2.6, -25, 0.4, ['x', 8]))
  jobs.push(P('coast_rocks_02', 27.5, -2.4, -27, 2.1, ['x', 7]))
  for (const [x, z] of [[-9, 20], [-8.4, 26], [17, 18.6], [24, 30], [-28, 29.5]]) jobs.push(P('shrub_01', x, 0, z, Math.random() * 6, ['y', 1.7]))
  for (const e of level.extraProps || []) jobs.push(P(...e)) // 南の低地などの置き物（south.js が積む）
  await Promise.all(jobs)

  level.truckMesh = keiTruck(scene, level.truck.x, level.truck.z)
  level.truckMeshes2 = (level.trucks2 || []).map(t => keiTruck(scene, t[0], t[1])) // 新しい陸の軽トラ（2026-11-23）
  for (const [i, v] of level.vend.entries()) vending(scene, v.x, v.z, i)
  buildPoles(scene)
  warehouseLights(scene)
  fishingBoat(scene, 11.2, -30, 0.08)
  fishingBoat(scene, -4, -34, -0.5, 0x2a5f8f)
  islands(scene)
  tetrapods(scene)
}

function tintDrum(o, d) {
  // 青と赤さびのドラム缶を混ぜる
  const c = [0x2f4e7a, 0x8a3b2a, 0x3d5b3a][Math.floor(Math.abs(d.x * 7 + d.z * 3)) % 3]
  o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(new THREE.Color(c), 0.55) } })
}

function keiTruck(scene, x, z) {
  // 前（運転台）が -x 側。横の形を押し出して作る
  const g = new THREE.Group()
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe6e8e7, roughness: 0.3, metalness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.12 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1214, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.7 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.4, metalness: 0.85 })
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o }
  const W = 1.38
  const s = new THREE.Shape()
  s.moveTo(0.06, 0.38); s.lineTo(0.02, 0.98); s.quadraticCurveTo(0.03, 1.06, 0.16, 1.1); s.lineTo(0.42, 1.78); s.quadraticCurveTo(0.47, 1.86, 0.58, 1.86); s.lineTo(1.36, 1.86); s.quadraticCurveTo(1.43, 1.86, 1.44, 1.78); s.lineTo(1.44, 0.38); s.lineTo(0.06, 0.38)
  const cab = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 10 }); cab.translate(0, 0, -W / 2)
  add(cab, white, 0, 0, 0)
  // 前の窓（傾き）・横の窓・後ろの窓
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.72, W - 0.14), glass); ws.position.set(0.28, 1.45, 0); ws.rotation.set(0, -Math.PI / 2, 0); ws.rotateX(-0.39 * 0); ws.rotation.z = 0; g.add(ws)
  ws.rotation.set(0, -Math.PI / 2, 0); ws.rotateOnAxis(new THREE.Vector3(1, 0, 0), 0); ws.lookAt(new THREE.Vector3(-1, 0.42, 0).add(ws.position))
  for (const side of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), glass); sw.position.set(0.92, 1.5, side * (W / 2 + 0.035)); sw.rotation.y = side > 0 ? 0 : Math.PI; g.add(sw) }
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, 0.32), glass); rw.position.set(1.475, 1.55, 0); rw.rotation.y = Math.PI / 2; g.add(rw)
  // 灯り・格子・バンパー・鏡
  for (const sd of [-0.48, 0.48]) add(new THREE.BoxGeometry(0.04, 0.14, 0.26), new THREE.MeshStandardMaterial({ color: 0xfaf3df, emissive: 0x2a2416, roughness: 0.15 }), 0.0, 0.88, sd)
  add(new THREE.BoxGeometry(0.03, 0.12, 0.6), dark, -0.005, 0.7, 0)
  add(new THREE.BoxGeometry(0.12, 0.16, W + 0.04), dark, -0.02, 0.44, 0)
  for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.13, 0.08), dark, 0.4, 1.3, sd * (W / 2 + 0.1))
  // 荷台
  add(new THREE.BoxGeometry(1.95, 0.1, W), steel, 2.45, 0.6, 0)
  add(new THREE.BoxGeometry(1.95, 0.32, 0.04), white, 2.45, 0.81, W / 2 - 0.02); add(new THREE.BoxGeometry(1.95, 0.32, 0.04), white, 2.45, 0.81, -W / 2 + 0.02)
  add(new THREE.BoxGeometry(0.04, 0.32, W), white, 3.41, 0.81, 0)
  for (const zz of [-0.55, -0.2, 0.2, 0.55]) add(new THREE.BoxGeometry(0.03, 0.62, 0.04), steel, 1.5, 1.07, zz)
  add(new THREE.BoxGeometry(0.04, 0.04, W), steel, 1.5, 1.38, 0)
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.9, 0.28, 0.6), mat('styro'), 2.2 + (i % 2) * 0.62, 0.8 + Math.floor(i / 2) * 0.3, -0.3 + (i % 2) * 0.55)
  // 車輪（ゴム＋鉄のホイール）
  const tg = new THREE.CylinderGeometry(0.29, 0.29, 0.17, 28); tg.rotateX(Math.PI / 2)
  const hg = new THREE.CylinderGeometry(0.17, 0.17, 0.18, 20); hg.rotateX(Math.PI / 2)
  g.userData.wheels = []
  for (const [wx, wz] of [[0.62, 0.6], [0.62, -0.6], [2.8, 0.6], [2.8, -0.6]]) { const piv = new THREE.Group(); piv.position.set(wx, 0.29, wz); g.add(piv); const t = new THREE.Mesh(tg, mat('tire')), h = new THREE.Mesh(hg, steel); t.castShadow = h.castShadow = true; const spin = new THREE.Group(); spin.add(t); spin.add(h); h.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.19), dark)); piv.add(spin); g.userData.wheels.push({ piv, spin, front: wx < 1 }) }
  add(new THREE.BoxGeometry(3.3, 0.12, 1.1), dark, 1.7, 0.36, 0)
  // ドアの継ぎ目・取っ手・タイヤの覆い・ナンバー
  for (const sd of [-1, 1]) {
    add(new THREE.BoxGeometry(0.012, 1.0, 0.01), dark, 1.36, 1.0, sd * (W / 2 + 0.031)); add(new THREE.BoxGeometry(0.012, 0.9, 0.01), dark, 0.38, 0.85, sd * (W / 2 + 0.031))
    add(new THREE.BoxGeometry(0.14, 0.03, 0.02), steel, 1.15, 1.08, sd * (W / 2 + 0.04))
    const arch = new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI); arch.translate(0, 0, 0)
    for (const wx of [0.62, 2.8]) { const a = add(arch, dark, wx, 0.29, sd * (W / 2 + 0.02)) }
  }
  const plate = document.createElement('canvas'); plate.width = 256; plate.height = 128
  const pg = plate.getContext('2d'); pg.fillStyle = '#f2d23a'; pg.fillRect(0, 0, 256, 128); pg.strokeStyle = '#222'; pg.lineWidth = 6; pg.strokeRect(4, 4, 248, 120)
  pg.fillStyle = '#1f3a1f'; pg.font = '700 30px "Zen Kaku Gothic New", sans-serif'; pg.textAlign = 'center'; pg.fillText(tr('西浦 480', 'NISHIURA'), 128, 44); pg.font = '700 52px sans-serif'; pg.fillText(tr('あ 12-34', '12-34'), 128, 106)
  const pt = new THREE.CanvasTexture(plate); pt.colorSpace = THREE.SRGBColorSpace
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.165), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.4 })); pm.position.set(3.44, 0.62, 0); pm.rotation.y = Math.PI / 2; g.add(pm)
  g.position.set(x, 0, z + 0.72)
  scene.add(g)
  return g
}

function vending(scene, x, z, i) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024
  const g = c.getContext('2d')
  const body = i === 0 ? '#c8232c' : '#f2f2ee'
  g.fillStyle = body; g.fillRect(0, 0, 512, 1024)
  g.fillStyle = '#e9eef0'; g.fillRect(28, 40, 456, 560)
  const cols = ['#1f5fa8', '#e4a11b', '#2a8a4a', '#d8d8d8', '#8a2b2b', '#2c2c2c', '#f0f0f0', '#6a3d1f']
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
    const bx = 46 + k * 72, by = 60 + r * 136
    g.fillStyle = cols[(r * 3 + k * 5 + i) % cols.length]; g.fillRect(bx + 14, by + 10, 36, 86)
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx + 18, by + 14, 6, 76)
    g.fillStyle = '#111'; g.fillRect(bx + 8, by + 104, 48, 18)
    g.fillStyle = r === 0 ? '#ff3a2a' : '#3ad2ff'; g.font = '700 14px sans-serif'; g.textAlign = 'center'; g.fillText(r === 0 ? '160' : '130', bx + 32, by + 118)
  }
  g.fillStyle = r0(i); g.font = '700 46px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center'
  g.fillText(i === 0 ? tr('つめた〜い', 'COLD') : tr('あったか〜い', 'HOT'), 256, 660)
  g.fillStyle = '#222'; g.fillRect(150, 860, 212, 90)
  g.fillStyle = '#555'; g.fillRect(390, 700, 60, 100)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  const front = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.25 })
  const side = new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.35, clearcoat: 0.6 })
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.83, 0.8), [side, side, side, side, side, front])
  // 正面は道（北）を向く
  m.rotation.y = Math.PI
  m.position.set(x, 0.915, z); m.castShadow = m.receiveShadow = true
  scene.add(m)
  // 上の光る帯・下の黒い台・取り出し口のふち
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.82), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: i === 0 ? 0xff3a2a : 0x3a7aff, emissiveIntensity: 0.6, roughness: 0.3 })); top.position.set(x, 1.86, z); scene.add(top)
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.82), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })); base.position.set(x, 0.05, z); scene.add(base)
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.5 })); lip.position.set(x, 0.42, z - 0.42); scene.add(lip)
}
function r0(i) { return i === 0 ? '#1a5bb0' : '#c8232c' }

function poles(scene) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x9b9890, roughness: 0.9 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2b2c, roughness: 0.6 })
  const xs = [-94, -77, -60, -43, -26, -9, 8, 25], z = 14.7, H = 9.2
  const tops = []
  for (const x of xs) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, H, 14), conc); p.position.set(x, H / 2, z); p.castShadow = true; scene.add(p)
    for (const [y, w] of [[H - 0.4, 1.8], [H - 1.2, 1.4]]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, w), dark); a.position.set(x, y, z); a.castShadow = true; scene.add(a)
      for (const s of [-w / 2 + 0.1, 0, w / 2 - 0.1]) { const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.3 })); ins.position.set(x, y + 0.12, z + s); scene.add(ins) }
    }
    // 変圧器
    if (x === -9) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 14), new THREE.MeshStandardMaterial({ color: 0x8c949a, roughness: 0.5, metalness: 0.5 })); t.position.set(x + 0.4, H - 2.4, z); t.castShadow = true; scene.add(t) }
    // 防犯灯（電柱に付いた細い腕と灯り）
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), dark); arm.rotation.x = Math.PI / 2 - 0.25; arm.position.set(x, 5.35, z - 0.5); scene.add(arm)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.42), new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.4 })); head.position.set(x, 5.5, z - 1.05); head.castShadow = true; scene.add(head)
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.34), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 0.6 })); lens.position.set(x, 5.465, z - 1.05); scene.add(lens)
    tops.push([x, z])
  }
  // 電線（たるみ）
  const wireM = new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.5 })
  for (let i = 0; i < tops.length - 1; i++) for (const [y, s] of [[H - 0.28, -0.8], [H - 0.28, 0], [H - 0.28, 0.8], [H - 1.08, -0.6], [H - 1.08, 0.6]]) {
    const a = new THREE.Vector3(tops[i][0], y, z + s), b = new THREE.Vector3(tops[i + 1][0], y, z + s)
    const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.55; pts.push(p) }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 4), wireM); scene.add(tube)
  }
}

function tetrapods(scene) {
  const m = new THREE.MeshStandardMaterial({ color: 0xa7a296, roughness: 0.95, map: mat('block').map, normalMap: mat('block').normalMap })
  const legs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => new THREE.Vector3(...v).normalize())
  const one = () => {
    const g = new THREE.Group()
    for (const v of legs) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 1.5, 10), m)
      c.position.copy(v.clone().multiplyScalar(0.72)); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v)
      c.castShadow = c.receiveShadow = true; g.add(c)
    }
    return g
  }
  const pts = [[16, -21.6], [18.2, -22], [20.4, -21.5], [22.5, -22.1], [24.6, -21.6], [26.8, -22], [28.8, -21.7], [17.2, -23.6], [19.5, -23.9], [21.8, -23.5], [24, -24], [26.3, -23.6], [28.5, -24.1], [-29, -22], [-27, -21.8], [-25, -22.2]]
  for (const [x, z] of pts) { const t = one(); t.position.set(x, -1.5 + Math.random() * 0.4, z); t.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(t) }
}

// 小さな漁船（白い船体・操舵室・マスト）
export function fishingBoat(scene, x, z, rot, stripe = 0x1d4f8a, landY = null) {
  const g = new THREE.Group()
  const hullM = new THREE.MeshPhysicalMaterial({ color: 0xe8e6df, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 })
  const stripeM = new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.45 })
  const deckM = mat('wood'), dark = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.4, metalness: 0.2 })
  // 上から見た船の形（舳先がとがる）
  const L = 9, W = 2.6
  const s = new THREE.Shape()
  s.moveTo(-L / 2, -W / 2 * 0.9); s.lineTo(L * 0.18, -W / 2); s.quadraticCurveTo(L * 0.42, -W * 0.38, L / 2, 0); s.quadraticCurveTo(L * 0.42, W * 0.38, L * 0.18, W / 2); s.lineTo(-L / 2, W / 2 * 0.9); s.lineTo(-L / 2, -W / 2 * 0.9)
  const hull = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 3, curveSegments: 16 })
  hull.rotateX(-Math.PI / 2); hull.translate(0, -0.9, 0)
  const h = new THREE.Mesh(hull, hullM); h.castShadow = h.receiveShadow = true; g.add(h)
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 16 }), stripeM); st.rotation.x = -Math.PI / 2; st.position.y = 0.45; st.scale.set(1.035, 1.06, 1); g.add(st)
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(s), deckM); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.62; deck.scale.set(0.96, 0.92, 1); deck.receiveShadow = true; g.add(deck)
  // 操舵室
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.9), hullM); cab.position.set(-1.4, 1.42, 0); cab.castShadow = true; g.add(cab)
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.5, 1.92), new THREE.MeshPhysicalMaterial({ color: 0x0f1416, roughness: 0.05, envMapIntensity: 1.5 })); win.position.set(-1.4, 1.72, 0); g.add(win)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2.1), stripeM); roof.position.set(-1.4, 2.27, 0); g.add(roof)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), dark); mast.position.set(-1.0, 3.9, 0); g.add(mast)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.4), dark); bar.position.set(-1.0, 4.9, 0); g.add(bar)
  for (const zz of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff3d8, emissive: 0xffd8a0, emissiveIntensity: 1.5 })); l.position.set(-1.0, 4.95, zz); g.add(l) }
  // 舳先の旗竿・浮き玉
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), dark); pole.position.set(3.8, 1.4, 0); g.add(pole)
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe8a33a : 0x2a8f6a, roughness: 0.35 })); b.position.set(1.2 + i * 0.45, 0.85, -0.9 + (i % 2) * 0.2); g.add(b) }
  g.position.set(x, landY ?? -1.35, z); g.rotation.y = rot + Math.PI / 2
  g.userData.bob = Math.random() * 6
  scene.add(g); if (landY == null) (scene.userData.boats || (scene.userData.boats = [])).push(g)
  return g
}

// 葉の絵（透明の上に葉を描く）
export function leafTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')
  if (kind === 'cedar') {
    // スギの葉: 斜めに伸びる細かい枝葉
    for (let i = 0; i < 900; i++) {
      const x = 128 + (Math.random() - 0.5) * 230 * (1 - Math.random() * 0.4), y = 20 + Math.random() * 220
      const w = (1 - Math.abs(x - 128) / 128); if (Math.random() > w * 1.4) continue
      const l = 6 + Math.random() * 14, a = (x < 128 ? -1 : 1) * (0.5 + Math.random() * 0.6) + Math.PI / 2
      const v = 30 + Math.random() * 40
      g.strokeStyle = `rgba(${v * 0.55 | 0},${v + 20 | 0},${v * 0.45 | 0},0.95)`; g.lineWidth = 1.5 + Math.random() * 2
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
    }
  } else {
    for (let i = 0; i < 520; i++) {
      const a = Math.random() * 6.28, r = Math.random() ** 0.6 * 115, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r
      const v = 45 + Math.random() * 55, s = 5 + Math.random() * 8
      g.fillStyle = `rgba(${v * 0.6 | 0},${v + 15 | 0},${v * 0.35 | 0},1)`
      g.beginPath(); g.ellipse(x, y, s, s * 0.55, Math.random() * 3.14, 0, 6.28); g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}
export function cedarGeo() {
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.06, 0.14, 7, 6); trunk.translate(0, 3.5, 0)
  const layers = 9
  for (let k = 0; k < layers; k++) {
    const y = 1.6 + k * 0.62, r = 1.35 * (1 - k / layers) + 0.18
    for (let q = 0; q < 2; q++) { const pl = new THREE.PlaneGeometry(r * 2, 1.25); pl.rotateY(q * Math.PI / 2 + k * 0.7); pl.translate(0, y, 0); parts.push(pl) }
    const top = new THREE.PlaneGeometry(r * 1.9, r * 1.9); top.rotateX(-Math.PI / 2); top.rotateY(k); top.translate(0, y + 0.2, 0); parts.push(top)
  }
  return { leaves: mergeG(parts), trunk }
}
export function broadGeo() {
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.08, 0.16, 3.2, 6); trunk.translate(0, 1.6, 0)
  for (let k = 0; k < 14; k++) {
    const a = Math.random() * 6.28, h = 2.6 + Math.random() * 2.2, rr = Math.random() * 1.3
    const pl = new THREE.PlaneGeometry(1.8 + Math.random(), 1.8 + Math.random()); pl.rotateY(Math.random() * 3.14); pl.rotateX((Math.random() - 0.5) * 1.2); pl.translate(Math.cos(a) * rr, h, Math.sin(a) * rr); parts.push(pl)
  }
  return { leaves: mergeG(parts), trunk }
}
function mergeG(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = []
  let o = 0
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2)
    for (const i of g.index.array) idx.push(i + o)
    o += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(idx)
  // 葉の板の法線を上向きに寄せる（下から見ても明るさが割れない）
  for (let i = 0; i < n; i++) { nor[i * 3 + 1] = Math.abs(nor[i * 3 + 1]) * 0.5 + 0.6; const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l }
  return out
}

// 家の裏の山（島の内側）。山肌は森を上から見た質感、手前の縁に木を並べる
function backHill(scene) {
  const geo = new THREE.PlaneGeometry(520, 260, 120, 60)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    const d = (130 - y) / 260
    let h = Math.max(0, d) ** 0.8 * 95 * (0.75 + 0.25 * Math.sin(x * 0.013 + 1.3) * Math.cos(x * 0.031)) + 4 * Math.sin(x * 0.11) * Math.cos(y * 0.09)
    if (d < 0.04) h = -3
    p.setZ(i, h)
  }
  geo.computeVertexNormals()
  const tl = new THREE.TextureLoader()
  const fd = tl.load('./assets/tex/forest_leaves_02_diff.webp'), fn = tl.load('./assets/tex/forest_leaves_02_nor_gl.webp')
  for (const t of [fd, fn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 35); t.anisotropy = 8 } fd.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ map: fd, normalMap: fn, normalScale: new THREE.Vector2(1.6, 1.6), color: 0x6f8a5c, roughness: 1 })
  const hill = new THREE.Mesh(geo, m); hill.rotation.x = -Math.PI / 2; hill.position.set(0, -0.5, 100 + 130 + 170) // 南の低地ができたので、背景の山はその先へ（2026-11-22）; hill.receiveShadow = true; scene.add(hill)
  const cedar = cedarGeo(), broad = broadGeo()
  const cm = new THREE.MeshStandardMaterial({ map: leafTex('cedar'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xffffff })
  const bm = new THREE.MeshStandardMaterial({ map: leafTex('broad'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const tm = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 })
  const N = 1400
  const ic = new THREE.InstancedMesh(cedar.leaves, cm, N), ict = new THREE.InstancedMesh(cedar.trunk, tm, N)
  const ib = new THREE.InstancedMesh(broad.leaves, bm, N), ibt = new THREE.InstancedMesh(broad.trunk, tm, N)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  const ray = new THREE.Raycaster(); hill.updateMatrixWorld(true)
  let a = 0, b = 0
  for (let i = 0; i < N * 3 && (a < N || b < N); i++) {
    const x = -230 + Math.random() * 460, z = 266 + Math.random() ** 1.8 * 110
    ray.set(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObject(hill)[0]; if (!hit || hit.point.y < 0.2) continue
    const k = 0.8 + Math.random() * 0.7
    m4.compose(v.set(x, hit.point.y - 0.2, z), q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), sc.set(k, k * (0.85 + Math.random() * 0.35), k))
    if (Math.random() < 0.6 && a < N) { ic.setMatrixAt(a, m4); ict.setMatrixAt(a, m4); ic.setColorAt(a, col.setHSL(0.28 + Math.random() * 0.04, 0.35, 0.42 + Math.random() * 0.18)); a++ }
    else if (b < N) { ib.setMatrixAt(b, m4); ibt.setMatrixAt(b, m4); ib.setColorAt(b, col.setHSL(0.23 + Math.random() * 0.06, 0.35, 0.5 + Math.random() * 0.2)); b++ }
  }
  ic.count = ict.count = a; ib.count = ibt.count = b
  for (const o of [ic, ib, ict, ibt]) { o.castShadow = true; o.receiveShadow = true; scene.add(o) }
}

// 遠くの島（緑の山）。霧で青く沈む
function islands(scene) {
  // 背景の山（backHill）は南の低地ができて島の上に重なるため使わない（2026-11-22）。南の沖にも遠い島を置く
  const m = new THREE.MeshStandardMaterial({ color: 0x1c2a1b, roughness: 1, fog: false, envMapIntensity: 0.4 })
  const haze = new THREE.Color(0x6d7f8e)
  const list = [[-420, -520, 260, 90], [-80, -700, 340, 120], [360, -560, 300, 100], [620, -180, 260, 80], [-650, -150, 240, 70], [150, -380, 120, 42], [-330, 640, 280, 90], [260, 720, 330, 115], [-760, 380, 230, 70], [700, 420, 250, 80]]
  for (const [x, z, r, hgt] of list) {
    // 50人用の陸（x -340〜340・z -100〜610）に重なる遠い島は置かない（2026-11-23）
    if (Math.max(Math.abs(x) - 340, 0) ** 2 + Math.max(-100 - z, z - 610, 0) ** 2 < (r + 40) ** 2) continue
    const geo = new THREE.CircleGeometry(r, 72, 0, Math.PI * 2)
    const sub = new THREE.PlaneGeometry(r * 2, r * 2, 64, 64)
    const p = sub.attributes.position
    const seed = Math.random() * 100
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), d = Math.hypot(px, py) / r
      let h = Math.max(0, 1 - d * d) ** 1.3
      h *= 0.75 + 0.25 * Math.sin(px * 0.021 + seed) * Math.cos(py * 0.017 + seed * 2) + 0.12 * Math.sin(px * 0.07 + py * 0.05 + seed)
      p.setZ(i, h * hgt - 6)
    }
    sub.computeVertexNormals()
    const dist = Math.hypot(x, z), mm = m.clone(); mm.color.lerp(haze, THREE.MathUtils.clamp((dist - 250) / 900, 0.15, 0.5))
    const mesh = new THREE.Mesh(sub, mm); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, -1.6, z)
    scene.add(mesh)
    geo.dispose()
  }
}

// 倉庫の天井の蛍光灯（光源は増やさず、光る板だけ）
function warehouseLights(scene) {
  const tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 1.6 })
  const hous = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.5, metalness: 0.6 })
  for (const x of [-22, -14]) for (const z of [-11, -6, -1.5]) {
    if (x < -17 && false) continue
    const y = x < -17 ? 7.6 : 7.6
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.22), hous); h.position.set(x, y, z); scene.add(h)
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), tube); t.rotation.z = Math.PI / 2; t.position.set(x, y - 0.06, z); scene.add(t)
    for (const s of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 4), hous); w.position.set(x + s, y + 0.4, z); scene.add(w) }
  }
}
