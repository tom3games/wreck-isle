// 漁港の一角（約60m四方）。見た目と当たりを同じデータから作る。
// 座標: x が東、z が南（陸）、-z が北（海）。地面の上面 y=0、海面 y=-1.6。
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwur1e4h'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { buildAreas } from './area.js?v=mwur1e4h'
import { buildNorth } from './north.js?v=mwur1e4h'
import { dressNorth, stdInfo } from './dress.js?v=mwur1e4h'

const TEX = './assets/tex/'
const loader = new THREE.TextureLoader()
const texCache = new Map()
function tex(name, kind, srgb) {
  const k = name + kind
  if (texCache.has(k)) return texCache.get(k)
  const t = loader.load(`${TEX}${name}_${kind}.${name === 'forest_leaves_02' || name === 'rock_face' ? 'webp' : 'jpg'}`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  texCache.set(k, t); return t
}
// 質感。tile は1枚が何mか
const MATS = {
  quay: { tex: 'hangar_concrete_floor', tile: 5, rough: 1, color: 0xc4c2bd },
  slab: { tex: 'hangar_concrete_floor', tile: 4 },
  road: { tex: 'asphalt_02', tile: 5 },
  seawall: { tex: 'concrete_wall_004', tile: 3, color: 0xb8b2a8 },
  iron: { tex: 'corrugated_iron_02', tile: 2.2, color: 0xc9cdd0 },
  ironRust: { tex: 'rusty_corrugated_iron', tile: 2.6 },
  plaster: { tex: 'white_stucco', tile: 2.5, color: 0xf3eee4 },
  cedar: { tex: 'japanese_cedar_planks', tile: 2, color: 0x9c8a74 },
  kawara: { tex: 'grey_roof_tiles_02', tile: 1.6, color: 0x8d949c },
  planks: { tex: 'weathered_planks', tile: 2.5 },
  shutter: { tex: 'painted_metal_shutter', tile: 2.5, color: 0xd8dde0 },
  sand: { tex: 'damp_beach_sand', tile: 4 },
  block: { tex: 'concrete_block_wall', tile: 2.0, color: 0xb9b6ae, boost: 2.4 },
  alu: { color: 0xb8bcbf, rough: 0.35, metal: 0.85 },
  paint: { color: 0xd8d5cb, rough: 0.75 },
  paintY: { color: 0xd9a531, rough: 0.75 },
  kerb: { tex: 'painted_concrete', tile: 2, color: 0xd6d2c8 },
  contO: { tex: 'rusty_painted_metal', tile: 2.4, color: 0xd9652a },
  contB: { tex: 'rusty_painted_metal', tile: 2.4, color: 0x3d6f9e },
  contG: { tex: 'rusty_painted_metal', tile: 2.4, color: 0x5d7d52 },
  rustMetal: { tex: 'rusty_painted_metal', tile: 1.5 },
  wood: { tex: 'weathered_planks', tile: 1.2, color: 0xa08868 },
  darkWood: { tex: 'japanese_cedar_planks', tile: 1.2, color: 0x5a4a3c },
  gravel: { tex: 'gravel_floor', tile: 3, color: 0xb8b3a8 },
  stoneWall: { tex: 'mossy_stone_wall', tile: 2 },
  stoneStep: { tex: 'concrete_wall_004', tile: 1.2, color: 0x9a978f },
  office: { tex: 'white_stucco', tile: 2, color: 0xe9ecec },
  gravelPile: { tex: 'gravel_floor', tile: 2, color: 0xa9a49a },
  boulder: { tex: 'rock_face', tile: 3, color: 0xb0aaa0, ext: 'webp' },
  litter: { tex: 'forest_leaves_02', tile: 5, color: 0x8a9a74, ext: 'webp' },
  dirt: { tex: 'damp_beach_sand', tile: 5, color: 0x7d7262 },
  styro: { color: 0xb9bab4, rough: 0.95 },
  carton: { color: 0xa88a5e, rough: 0.95 },
  // 家の中の家具（2026-11-23）
  fabricBlue: { color: 0x3f5068, rough: 1 },
  sheet: { color: 0xdcd7cb, rough: 1 },
  tv: { color: 0x111315, rough: 0.25, metal: 0.3 },
  counter: { color: 0xcfc8b8, rough: 0.6 },
  counterTop: { color: 0x4a4a4c, rough: 0.35, metal: 0.4 },
  whiteGoods: { color: 0xe6e6e1, rough: 0.4 },
  fabricLight: { color: 0x8796a8, rough: 1 },
  rackBlue: { color: 0x2f5a8c, rough: 0.5, metal: 0.4 }, rackOrange: { color: 0xd0702a, rough: 0.5, metal: 0.3 }, wrap: { color: 0xc9cfd3, rough: 0.3 }, skylight: { color: 0xdfe8ea, rough: 0.4, emit: 0xbfcfd6, emitK: 0.35 },
  turbine: { color: 0x6f8f86, rough: 0.45, metal: 0.5 }, panel: { color: 0x8d949a, rough: 0.5, metal: 0.3 }, ledGreen: { color: 0x0a2a10, emit: 0x30ff60, emitK: 1.6 }, ledRed: { color: 0x2a0808, emit: 0xff3020, emitK: 1.6 }, rugRed: { color: 0x7a3b2e, rough: 1 }, rugBeige: { color: 0xa89574, rough: 1 }, rugGreen: { color: 0x4f6450, rough: 1 },
  blanket: { color: 0x5b6f8a, rough: 1 }, blanket2: { color: 0x8a5b5b, rough: 1 }, lamp: { color: 0xfff3dc, rough: 0.6, emit: 0xffe2b0, emitK: 1.2 },
  frameArt: { color: 0x6f8a7a, rough: 0.7 }, frameArt2: { color: 0xb08a55, rough: 0.7 }, stove: { color: 0x1d1e20, rough: 0.3, metal: 0.5 },
  cartonDark: { color: 0x8c7150, rough: 0.95 },
  bollard: { color: 0x2d2f31, rough: 0.55, metal: 0.4 },
  black: { color: 0x1d1f21, rough: 0.6 },
  tire: { color: 0x151516, rough: 0.95 },
  roofRed: { tex: 'clay_roof_tiles_02', tile: 1.6, color: 0xc98863 },
  roofGreen: { tex: 'corrugated_iron_02', tile: 2.2, color: 0x6b9c7f },
  roofBlack: { tex: 'grey_roof_tiles_02', tile: 1.6, color: 0x55585e },
  stuccoCream: { tex: 'white_stucco', tile: 2.5, color: 0xd6c39e },
  stuccoSage: { tex: 'white_stucco', tile: 2.5, color: 0xa2b394 },
  stuccoBlue: { tex: 'white_stucco', tile: 2.5, color: 0x93a8b8 },
  stuccoPink: { tex: 'white_stucco', tile: 2.5, color: 0xcaa090 },
  sidingGrey: { tex: 'weathered_planks', tile: 1.8, color: 0xc4ced2, boost: 1.5 },
  sidingGreen: { tex: 'weathered_planks', tile: 1.8, color: 0x7f9d8a },
  tinBlue: { tex: 'corrugated_iron_02', tile: 2.2, color: 0x6c8aa3 },
  tinCream: { tex: 'corrugated_iron_02', tile: 2.2, color: 0xc9bd98 },
  blockGrey: { tex: 'concrete_block_wall', tile: 2.0, color: 0xb0ada5, boost: 2.4 },
  hedge: { tex: 'forest_leaves_02', tile: 1.6, color: 0x4f6d3a },
  steelGreen: { tex: 'rusty_painted_metal', tile: 2.4, color: 0x56806a },
  canopy: { color: 0xdedbd2, rough: 0.55, metal: 0.2 },
  ironBlue: { tex: 'corrugated_iron_02', tile: 2.2, color: 0x7f97a8 },
  ironOlive: { tex: 'corrugated_iron_02', tile: 2.2, color: 0x8a9677 },
  ironRed: { tex: 'corrugated_iron_02', tile: 2.2, color: 0xa86a56 },
  sidingSalt: { tex: 'weathered_planks', tile: 1.8, color: 0xc9d3d6 },
  sidingTar: { tex: 'weathered_planks', tile: 1.8, color: 0x7f8a92, boost: 1.4 },
  frameSouth: { color: 0xc4c9ca, rough: 0.75, metal: 0.15 },
  lampPanel: { color: 0xfff1c9, rough: 0.3 },
  pumpRed: { color: 0xb4332a, rough: 0.45, metal: 0.3 },
  hay: { tex: 'damp_beach_sand', tile: 1.2, color: 0xc8a85a },
  soil: { tex: 'forest_ground_04', tile: 1.6, color: 0x6a5a48 },
}
const matCache = new Map()
export function mat(key) {
  if (matCache.has(key)) return matCache.get(key)
  const d = MATS[key]
  const m = new THREE.MeshStandardMaterial({ color: d.color ?? 0xffffff, roughness: d.rough ?? 1, metalness: d.metal ?? 0 })
  if (d.tex) {
    m.map = tex(d.tex, 'diff', true)
    m.normalMap = tex(d.tex, 'nor_gl')
    if (d.tex !== 'rock_face') m.roughnessMap = tex(d.tex, 'rough')
    m.normalScale.set(1, 1)
  }
  if (d.emit) { m.emissive.set(d.emit); m.emissiveIntensity = d.emitK || 1.5 }
  if (d.boost) m.color.multiplyScalar(d.boost) // 暗いテクスチャを明るく（色は 1 を超えられる）
  m.userData.tile = d.tile || 2
  matCache.set(key, m); return m
}

// 世界のメートルで UV を張った箱
function boxGeo(w, h, d, tile, off) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv, pos = g.attributes.position
  // 面ごと 4 頂点: +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const v = f * 4 + i
    const x = pos.getX(v) + off[0], y = pos.getY(v) + off[1], z = pos.getZ(v) + off[2]
    let u, vv
    if (f < 2) { u = z; vv = y } else if (f < 4) { u = x; vv = z } else { u = x; vv = y }
    if (f === 1) u = -u; if (f === 4) u = u; if (f === 5) u = -u; if (f === 0) u = -u
    uv.setXY(v, u / tile, vv / tile)
  }
  return g
}

export class Level {
  constructor(scene, world) {
    this.scene = scene; this.world = world
    // 窓は暗いガラスと艶の無い枠、濃い色のカーテン（白く光らない）。北の建物にも南と同じ質を（2026-11-22）
    this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2a30, roughness: 0.5, transparent: true, opacity: 0.6, envMapIntensity: 0.3, depthWrite: false })
    this.frameKey = 'frameSouth'
    this.curtM = new THREE.MeshStandardMaterial({ color: 0x3f372f, roughness: 0.95, side: THREE.DoubleSide })
    this.dress = [] // 汚れを貼る建物 {x,z,w,d,top,wins,doors,lv,off,rust}
    this.batches = new Map() // mat -> [geo]
    this.spawns = [[-21, 0, -17.5], [24, 0, -16], [-24, 0, 27], [24, 0, 27.5]]
    this.drums = [] // 誘爆するドラム缶 {x,y,z, box, mesh, alive}
    this.items = [] // 拾える物の置き場
    this.props = []
    this.build()
  }
  // 見た目＋当たりの箱。o.vis=false で当たりだけ、o.nocol で見た目だけ
  B(x0, y0, z0, x1, y1, z1, m, o = {}) {
    const min = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)]
    let box = null
    if (!o.nocol) box = this.world.add({ min, max, kind: o.kind || 'solid', mat: m, tag: o.tag })
    if (o.vis !== false && m) {
      const w = max[0] - min[0], h = max[1] - min[1], d = max[2] - min[2]
      const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
      const g = boxGeo(w, h, d, mat(m).userData.tile, c)
      g.translate(c[0], c[1], c[2])
      this.push(m, g)
    }
    return box
  }
  // 同じ質感の箱を1つにまとめる。南の低地は北とは別の塊にして、見えない所を描かないようにする（2026-11-22）
  // 材質の物（文字の名前でなく）で同じ升目にまとめる: カーテン・すりガラスなど（家ごとに別々に描くと 1コマ数百回増えた 2026-11-23）
  pushMat(material, g) {
    this.matObjs = this.matObjs || {}; this.matObjs[material.uuid] = material
    this.push('M#' + material.uuid, g)
  }
  push(m, g) {
    g.computeBoundingBox(); const zc = (g.boundingBox.min.z + g.boundingBox.max.z) / 2
    // 島が広くなったので（2026-11-23）、x と z の 120m 升目ごとにまとめ、見えない升目は描かない
    const xc = (g.boundingBox.min.x + g.boundingBox.max.x) / 2, key = m + '|' + Math.floor(xc / 120) + ',' + Math.floor(zc / 120)
    if (!this.batches.has(key)) this.batches.set(key, []); this.batches.get(key).push(g)
  }
  // x 方向に伸びる壁（z=一定）。穴 holes:[{a,b,y0,y1}]（a,b は x）
  wallX(x0, x1, z, y0, y1, t, m, holes = [], o = {}) {
    this.wall(x0, x1, y0, y1, holes, (a, b, c, d) => { this.B(a, c, z - t / 2, b, d, z + t / 2, m, o); if (m === 'block' && d === y1 && y1 - y0 < 1.8) this.B(a - 0.03, y1, z - t / 2 - 0.05, b + 0.03, y1 + 0.07, z + t / 2 + 0.05, 'kerb', { nocol: true }) }) // 笠木
  }
  wallZ(z0, z1, x, y0, y1, t, m, holes = [], o = {}) {
    this.wall(z0, z1, y0, y1, holes, (a, b, c, d) => { this.B(x - t / 2, c, a, x + t / 2, d, b, m, o); if (m === 'block' && d === y1 && y1 - y0 < 1.8) this.B(x - t / 2 - 0.05, y1, a - 0.03, x + t / 2 + 0.05, y1 + 0.07, b + 0.03, 'kerb', { nocol: true }) })
  }
  wall(s0, s1, y0, y1, holes, put) {
    holes = [...holes].sort((p, q) => p.a - q.a)
    let s = s0
    for (const hl of holes) {
      if (hl.a > s) put(s, hl.a, y0, y1)
      if (hl.y0 > y0) put(hl.a, hl.b, y0, hl.y0)
      if (hl.y1 < y1) put(hl.a, hl.b, hl.y1, y1)
      s = hl.b
    }
    if (s < s1) put(s, s1, y0, y1)
  }
  stairs(xBottom, xTop, z0, z1, yTop, m) { // x 方向へ上がる階段
    const n = Math.round(yTop / 0.2), dir = Math.sign(xTop - xBottom), run = Math.abs(xTop - xBottom) / n
    for (let i = 0; i < n; i++) {
      const xa = xBottom + dir * i * run, xb = xBottom + dir * (i + 1) * run
      this.B(Math.min(xa, xb), 0, z0, Math.max(xa, xb), (i + 1) * 0.2, z1, m)
    }
  }
  // 見た目だけの傾いた板（屋根）
  slab(cx, cy, cz, w, t, d, rotX, rotZ, m) {
    const g = boxGeo(w, t, d, mat(m).userData.tile, [0, 0, 0])
    const e = new THREE.Euler(rotX, 0, rotZ)
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e))
    g.translate(cx, cy, cz)
    this.push(m, g)
  }

  build() {
    const B = this.B.bind(this)
    // ---- 地面 ----
    B(-30, -3.2, -20, 30, 0, 8, 'quay')
    B(-30, -3.2, 8, 30, 0, 14, 'road')
    B(-30, -3.2, 14, 30, 0, 31, 'quay')
    B(-30.5, -3.2, -20.4, 30.5, -0.02, -20, 'seawall') // 岸壁の面
    B(-30, 0, -20.3, 30, 0.18, -19.75, 'kerb', { nocol: false }) // 縁石（段差で上がれる）
    // 岸の見えない柵（人だけ止める。爆風で浮けば越える）
    B(-30, 0, -20.6, 4, 1.05, -20.05, null, { kind: 'edge', vis: false })
    B(-96, 0, -20.6, -62, 1.05, -20.05, null, { kind: 'edge', vis: false }); B(-52, 0, -20.6, -30, 1.05, -20.05, null, { kind: 'edge', vis: false })
    B(8, 0, -20.6, 30, 1.05, -20.05, null, { kind: 'edge', vis: false })
    // 外周の見えない壁は 2026-11-23 に外した（海峡の向こうに新しい陸ができ、橋で渡るため）。落ちると危ない岸には見える手すり（mainland.js）
    // ボラード
    for (const x of [-25, -15, -3, 12, 22, 28]) {
      const g = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 16); g.translate(x, 0.27 + 0.18, -19.95); this.push('bollard', g)
      const cap = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16); cap.translate(x, 0.75, -19.95); this.push('bollard', cap)
      B(x - 0.25, 0.18, -20.2, x + 0.25, 0.8, -19.7, null, { vis: false })
    }

    // ---- 桟橋（北へ伸びる木の桟橋） ----
    B(4, -0.28, -40, 8, 0, -20, 'planks')
    for (let z = -39; z <= -21; z += 3) for (const x of [4.2, 7.8]) {
      const g = new THREE.CylinderGeometry(0.16, 0.18, 3.4, 10); g.translate(x, -1.7, z); this.push('darkWood', g)
    }
    B(3.6, 0, -40.5, 4, 1.05, -20, null, { kind: 'edge', vis: false }); B(8, 0, -40.5, 8.4, 1.05, -20, null, { kind: 'edge', vis: false })
    B(3.6, 0, -40.6, 8.4, 1.05, -40, null, { kind: 'edge', vis: false })
    for (const z of [-24, -30, -36]) for (const x of [4.15, 7.85]) { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10); g.translate(x, 0.35, z); this.push('darkWood', g) }

    // ---- 倉庫（2階・中に入れる） x[-26,-8] z[-14,0] ----
    const W = { x0: -26, x1: -8, z0: -14, z1: 0, h: 8.4, t: 0.25 }
    B(W.x0, -0.02, W.z0, W.x1, 0.02, W.z1, 'slab', { nocol: true })
    // 北（海側）: シャッターの口と2階の窓
    this.wallX(W.x0, W.x1, W.z0, 0, W.h, W.t, 'ironBlue', [{ a: -21, b: -15.5, y0: 0, y1: 4.3 }, { a: -24.5, b: -22.5, y0: 5.2, y1: 6.6 }, { a: -12.5, b: -10, y0: 5.2, y1: 6.6 }])
    // 東: 勝手口と窓
    this.wallZ(W.z0, W.z1, W.x1, 0, W.h, W.t, 'ironBlue', [{ a: -6.2, b: -4.8, y0: 0, y1: 2.25 }, { a: -11.5, b: -9.5, y0: 1.2, y1: 2.4 }])
    // 南（道側）: 戸口
    this.wallX(W.x0, W.x1, W.z1, 0, W.h, W.t, 'ironBlue', [{ a: -11.8, b: -10.4, y0: 0, y1: 2.25 }, { a: -23.5, b: -21.5, y0: 5.2, y1: 6.6 }])
    // 西: 2階の窓
    this.wallZ(W.z0, W.z1, W.x0, 0, W.h, W.t, 'ironBlue', [{ a: -10, b: -7.8, y0: 5.2, y1: 6.6 }, { a: -4.5, b: -2.5, y0: 5.2, y1: 6.6 }])
    // 屋根（少し勾配。見た目は板、当たりは箱）
    B(W.x0 - 0.3, W.h, W.z0 - 0.3, W.x1 + 0.3, W.h + 0.25, W.z1 + 0.3, null, { vis: false })
    this.slab((W.x0 + W.x1) / 2, W.h + 0.45, W.z0 + 3.4, W.x1 - W.x0 + 0.8, 0.08, 7.4, -0.08, 0, 'ironRust')
    this.slab((W.x0 + W.x1) / 2, W.h + 0.45, W.z1 - 3.4, W.x1 - W.x0 + 0.8, 0.08, 7.4, 0.08, 0, 'ironRust')
    // 2階の床（中2階） x[-26,-17]
    B(-26, 3.8, -14, -17, 4.0, 0, 'planks')
    // 階段（南の壁に沿って東から西へ上がる）
    this.stairs(-11.6, -17, -2.1, -0.15, 4.0, 'planks')
    // 2階の手すり（階段の上だけ空ける）
    B(-17.08, 4.0, -14, -16.92, 5.0, -2.2, 'rustMetal')
    // 柱
    for (const x of [-17]) for (const z of [-13.6, -7, -2.4]) B(x - 0.15, 0, z - 0.15, x + 0.15, 3.8, z + 0.15, 'rustMetal')
    // 倉庫の看板（南と北の壁）
    this.sign(-17, 6.0, W.z1 + 0.14, 0, tr('西浦漁業協同組合　第二倉庫', 'NISHIURA FISHERIES CO-OP  WAREHOUSE 2'), 9, 1.1)
    this.sign(-17, 7.3, W.z0 - 0.14, Math.PI, tr('西浦漁協', 'NISHIURA CO-OP'), 4.6, 0.9)
    // シャッター（半分上がった板。上の方は当たりあり）
    B(-21, 3.0, W.z0 - 0.05, -15.5, 4.3, W.z0 + 0.05, 'shutter')
    // 中の物: 発泡スチロールの箱・木箱・網
    this.styroStack(-24.5, -12.5, 4); this.styroStack(-23.4, -12.5, 3); this.styroStack(-24.5, -11.4, 2)
    this.crate(-14, -11, 1.2); this.crate(-12.8, -11, 1.2); this.crate(-13.4, -11, 1.2, 1.2)
    this.crate(-22, -6, 1.0); this.crate(-22, -4.9, 1.0)
    this.crate(-24, -2.2, 0.9, 4.0) // 2階の木箱
    this.crate(-20.5, -10, 1.0, 4.0); this.crate(-20.5, -8.9, 1.0, 4.0)
    this.net(-19, -3.8)

    // ---- コンテナ ----
    this.container(10, -12.4, 6.1, 2.44, 0, 'contO')
    this.container(10.6, -12.6, 6.1, 2.44, 2.6, 'contB')
    this.container(18, -7, 2.44, 6.1, 0, 'contG')
    // ---- ドラム缶（誘爆する） ----
    for (const [x, z] of [[0.6, -7.4], [1.3, -6.7], [0.2, -6.5], [-6.3, -9.6], [-6.4, -10.5], [20.4, -15.8], [-3.5, 15.6], [16, 3]]) this.drum(x, z)
    // 発泡スチロールの山（岸壁）
    this.styroStack(-3.2, -17.2, 4); this.styroStack(-2.1, -17.2, 5); this.styroStack(-3.2, -16.1, 3); this.styroStack(-1, -17.2, 2)
    this.styroStack(24, -12, 3); this.styroStack(25.1, -12, 4)
    // 木箱とパレット
    this.crate(2.6, -3, 1.2); this.crate(3.8, -3, 1.2); this.crate(3.2, -3, 1.2, 1.2)
    this.crate(23, -3, 1.0); this.crate(-28, 4, 1.1)
    this.pallet(6.5, 3.5); this.pallet(6.5, 4.8); this.pallet(-4, 2)
    // コンクリートの車止め
    for (const x of [-2, 2.5, 26]) B(x - 1, 0, 6.6, x + 1, 0.8, 7.3, 'block')

    // ---- 道ぞい: 軽トラ・自販機・電柱 ----
    this.keiTruck(-3.6, 10.8)
    this.vending(1.2, 15.0); this.vending(2.15, 15.0)
    // ブロック塀（家の前）
    this.wallX(-29, -10, 16, 0, 1.3, 0.16, 'block', [{ a: -18.8, b: -17, y0: 0, y1: 1.3 }])
    this.wallX(4, 28, 16, 0, 1.3, 0.16, 'block', [{ a: 9.2, b: 11, y0: 0, y1: 1.3 }, { a: 19, b: 20.6, y0: 0, y1: 1.3 }])
    // ---- 民家 2軒（平屋・瓦屋根） ----
    this.house(-24, 18.5, 11, 7.5, 'stuccoCream', 'roofGreen', 1.2)
    this.house(6, 18.5, 10, 7, 'sidingGrey', 'roofRed', 1.7)
    this.dress.push(stdInfo(-24, 18.5, 11, 7.5, 3), stdInfo(6, 18.5, 10, 7, 2))
    // 物置
    B(22, 0, 21, 25, 2.2, 23.5, 'ironOlive')
    this.slab(23.5, 2.32, 22.25, 3.4, 0.06, 2.9, 0, 0.06, 'ironRust')
    this.crate(23.4, 26, 1.1); this.crate(-12, 27, 1.0)
    // 植え込み代わりの低い石垣
    B(-8, 0, 24, -2, 0.6, 25, 'block'); B(14, 0, 27, 20, 0.6, 28, 'block')

    this.marks()
    buildAreas(this, this.scene, this.world)
    buildNorth(this, this.scene, this.world)
    dressNorth(this, this.scene, this.world)
    this.spawns.push(...(this.spawnsExtra || []), ...(this.spawnsExtra2 || []), ...(this.spawnsExtra3 || []), ...(this.spawnsExtra4 || []), [-70, 0, -4], [-88, 0, 10], [-44, 0, 2], ...(this.spawnsLand || []))
    this.zoneSpots = [...(this.zoneSpots || []), ...(this.zoneSpotsLand || [])]
    this.finish()
  }

  glassMatrix(m, on) { const M = new THREE.Matrix4(); if (on) M.compose(m.position, new THREE.Quaternion(), new THREE.Vector3(...m.size)); else M.makeScale(0, 0, 0); m.im.setMatrixAt(m.idx, M) }
  finish() {
    // 割れる窓: 材質と 120m 升目ごとに束ねる
    const gb = new Map()
    for (const g of this.glasses || []) { const k = g.mesh.mat.uuid + '|' + Math.floor(g.mesh.position.x / 120) + ',' + Math.floor(g.mesh.position.z / 120); if (!gb.has(k)) gb.set(k, []); gb.get(k).push(g.mesh) }
    for (const list of gb.values()) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), list[0].mat, list.length)
      list.forEach((m, i) => { m.im = im; m.idx = i; this.glassMatrix(m, true) })
      im.computeBoundingSphere(); im.renderOrder = 1; this.scene.add(im)
    }
    for (const [m, list] of this.batches) {
      const g = mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x))
      g.computeBoundingSphere()
      const mk = m.split('|')[0], mesh = new THREE.Mesh(g, mk.startsWith('M#') ? this.matObjs[mk.slice(2)] : mat(mk))
      mesh.castShadow = true; mesh.receiveShadow = true
      this.scene.add(mesh)
    }
    this.batches.clear()
  }

  // ---- 小物 ----
  crate(x, z, s = 1.1, y = 0) {
    this.B(x - s / 2, y, z - s / 2, x + s / 2, y + s * 0.85, z + s / 2, 'wood')
  }
  pallet(x, z) {
    this.B(x - 0.6, 0, z - 0.5, x + 0.6, 0.14, z + 0.5, 'wood')
  }
  styroStack(x, z, n) { // 発泡スチロールの魚箱
    for (let i = 0; i < n; i++) {
      const y = i * 0.3
      this.B(x - 0.45, y, z - 0.3, x + 0.45, y + 0.29, z + 0.3, 'styro', { nocol: true })
      const g = new THREE.BoxGeometry(0.92, 0.035, 0.62); g.translate(x, y + 0.3, z); this.push('styro', g)
    }
    this.world.add({ min: [x - 0.46, 0, z - 0.31], max: [x + 0.46, n * 0.3 + 0.03, z + 0.31], kind: 'solid' })
  }
  container(x, z, w, d, y, m) {
    this.B(x, y, z, x + w, y + 2.59, z + d, m)
  }
  drum(x, z, y = 0) {
    const r = 0.29, h = 0.88
    const box = this.world.add({ min: [x - r, y, z - r], max: [x + r, y + h, z + r], kind: 'solid', tag: 'drum' })
    this.drums.push({ x, y, z, box, alive: true, r, h })
  }
  net(x, z) { // 網の山（見た目だけ）
    const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.1, 0.45, 0.8); g.translate(x, 0, z)
    this.push('tire', g)
  }
  keiTruck(x, z) { // 軽トラ（白）。荷台は低い
    const m = 'kerb'
    this.truck = { x, z }
  }
  vending(x, z) { this.B(x - 0.45, 0, z - 0.4, x + 0.45, 1.83, z + 0.4, null, { vis: false }); (this.vend || (this.vend = [])).push({ x, z }) }
  house(x, z, w, d, wallMat, roof = 'kawara', rh = 1.5) {
    const t = 0.18, h = 2.75
    this.B(x, 0, z, x + w, 0.35, z + d, 'darkWood') // 床（縁側の高さ。段差で上がれる）
    const y0 = 0.35
    const wN = { a: x + w - 4, b: x + w - 1.5, y0: y0 + 0.9, y1: y0 + 2.0 }, wS = { a: x + 1.5, b: x + 3.5, y0: y0 + 0.9, y1: y0 + 2.0 }, wW = { a: z + 2.5, b: z + 4.5, y0: y0 + 0.9, y1: y0 + 2.0 }, wE = { a: z + 3, b: z + 5, y0: y0 + 0.9, y1: y0 + 2.0 }
    const dN = { a: x + 2, b: x + 3.4, y0: y0, y1: y0 + 2.0 }, dS = { a: x + w - 3.2, b: x + w - 1.6, y0: y0, y1: y0 + 2.0 }
    this.wallX(x, x + w, z, y0, y0 + h, t, wallMat, [dN, wN])
    this.wallX(x, x + w, z + d, y0, y0 + h, t, wallMat, [wS, dS])
    this.wallZ(z, z + d, x, y0, y0 + h, t, wallMat, [wW])
    this.wallZ(z, z + d, x + w, y0, y0 + h, t, wallMat, [wE])
    this.windowX(wN, z); this.windowX(wS, z + d); this.windowZ(wW, x); this.windowZ(wE, x + w)
    this.doorFrameX(dN, z); this.doorFrameX(dS, z + d)
    // 天井（屋根の当たり）
    this.B(x - 0.6, y0 + h, z - 0.6, x + w + 0.6, y0 + h + 0.2, z + d + 0.6, 'darkWood', { vis: false })
    // 瓦屋根（切妻。棟は x 方向）
    const cx = x + w / 2, half = d / 2 + 0.7, ang = Math.atan2(rh, half), len = Math.hypot(rh, half)
    ;(this.world.roofs || (this.world.roofs = [])).push({ x0: x - 0.7, x1: x + w + 0.7, z0: z - 0.7, z1: z + d + 0.7, base: y0 + h, rh, ridge: 'x', c: z + d / 2, half }) // 屋根の当たり（WRECK ISLE: 車が屋根にめり込まない）
    this.slab(cx, y0 + h + rh / 2 + 0.05, z + d / 2 - half / 2, w + 1.4, 0.12, len, -ang, 0, roof)
    this.slab(cx, y0 + h + rh / 2 + 0.05, z + d / 2 + half / 2, w + 1.4, 0.12, len, ang, 0, roof)
    // 妻の三角（見た目）
    for (const xx of [x, x + w]) {
      const s = new THREE.Shape(); s.moveTo(-d / 2 - 0.1, 0); s.lineTo(d / 2 + 0.1, 0); s.lineTo(0, rh); s.lineTo(-d / 2 - 0.1, 0)
      const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false })
      g.rotateY(Math.PI / 2); g.translate(xx - t / 2, y0 + h, z + d / 2)
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5)
      this.push(wallMat, g)
    }
    // 棟瓦
    this.B(x - 0.7, y0 + h + rh - 0.02, z + d / 2 - 0.16, x + w + 0.7, y0 + h + rh + 0.18, z + d / 2 + 0.16, roof, { nocol: true })
    // 縁側の柱と軒の影になる板
    // 基礎のコンクリートの帯・鼻隠し・雨どい・たて樋
    this.B(x - 0.02, 0, z - 0.02, x + w + 0.02, 0.36, z, 'kerb', { nocol: true }); this.B(x - 0.02, 0, z + d, x + w + 0.02, 0.36, z + d + 0.02, 'kerb', { nocol: true })
    this.B(x - 0.02, 0, z, x, 0.36, z + d, 'kerb', { nocol: true }); this.B(x + w, 0, z, x + w + 0.02, 0.36, z + d, 'kerb', { nocol: true })
    const eave = y0 + h + 0.05 - 0.7 * (rh / half) * 0.98
    for (const [zz, s] of [[z - 0.7, -1], [z + d + 0.7, 1]]) {
      this.B(x - 0.7, eave - 0.18, zz - 0.03, x + w + 0.7, eave + 0.02, zz + 0.03, 'darkWood', { nocol: true })
      const gt = new THREE.CylinderGeometry(0.06, 0.06, w + 1.4, 10); gt.rotateZ(Math.PI / 2); gt.translate(x + w / 2, eave - 0.2, zz + s * 0.07); this.push('alu', gt)
      const dp = new THREE.CylinderGeometry(0.04, 0.04, eave - 0.2, 8); dp.translate(x - 0.55, (eave - 0.2) / 2, zz + s * 0.07); this.push('alu', dp)
    }
    // 窓の内側のカーテンと、玄関の半分開いた引き戸
    for (const [o, zz, sgn] of [[wN, z, 1], [wS, z + d, -1]]) this.curtainX(o, zz + sgn * 0.12)
    this.curtainZ(wW, x + 0.12); this.curtainZ(wE, x + w - 0.12)
    for (const [o, zz, sgn] of [[dN, z, 1], [dS, z + d, -1]]) {
      const half = (o.b - o.a) / 2
      this.B(o.a + 0.07, o.y0, zz + sgn * 0.02, o.a + 0.07 + half, o.y1 - 0.08, zz + sgn * 0.06, 'alu', { nocol: true })
      this.B(o.a + 0.12, o.y0 + 0.2, zz + sgn * 0.065, o.a + 0.02 + half, o.y1 - 0.16, zz + sgn * 0.07, null, { nocol: true })
      this.glass2(o.a + 0.12, o.y0 + 0.25, zz + sgn * 0.07, half - 0.12, o.y1 - o.y0 - 0.45)
    }
    ;(this.houses || (this.houses = [])).push({ x, z, w, d })
  }
  // アルミの窓枠＋割れるガラス
  windowX(o, z) {
    const f = 0.05
    this.B(o.a, o.y0, z - 0.06, o.b, o.y0 + f, z + 0.06, (this.frameKey || 'alu'), { nocol: true }); this.B(o.a, o.y1 - f, z - 0.06, o.b, o.y1, z + 0.06, (this.frameKey || 'alu'), { nocol: true })
    this.B(o.a, o.y0, z - 0.06, o.a + f, o.y1, z + 0.06, (this.frameKey || 'alu'), { nocol: true }); this.B(o.b - f, o.y0, z - 0.06, o.b, o.y1, z + 0.06, (this.frameKey || 'alu'), { nocol: true })
    const m = (o.a + o.b) / 2; this.B(m - 0.025, o.y0, z - 0.05, m + 0.025, o.y1, z + 0.05, (this.frameKey || 'alu'), { nocol: true })
    this.glass([o.a + f, o.y0 + f, z - 0.01], [o.b - f, o.y1 - f, z + 0.01])
  }
  windowZ(o, x) {
    const f = 0.05
    this.B(x - 0.06, o.y0, o.a, x + 0.06, o.y0 + f, o.b, (this.frameKey || 'alu'), { nocol: true }); this.B(x - 0.06, o.y1 - f, o.a, x + 0.06, o.y1, o.b, (this.frameKey || 'alu'), { nocol: true })
    this.B(x - 0.06, o.y0, o.a, x + 0.06, o.y1, o.a + f, (this.frameKey || 'alu'), { nocol: true }); this.B(x - 0.06, o.y0, o.b - f, x + 0.06, o.y1, o.b, (this.frameKey || 'alu'), { nocol: true })
    const m = (o.a + o.b) / 2; this.B(x - 0.05, o.y0, m - 0.025, x + 0.05, o.y1, m + 0.025, (this.frameKey || 'alu'), { nocol: true })
    this.glass([x - 0.01, o.y0 + f, o.a + f], [x + 0.01, o.y1 - f, o.b - f])
  }
  curtainX(o, z) {
    if (!this.curtM) this.curtM = new THREE.MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.95, side: THREE.DoubleSide })
    const w = (o.b - o.a) * 0.42, g = new THREE.PlaneGeometry(w, o.y1 - o.y0 - 0.05, 12, 1), p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.025)
    g.computeVertexNormals()
    for (const sx of [o.a + w / 2 + 0.05, o.b - w / 2 - 0.05]) { const gg = g.clone(); gg.translate(sx, (o.y0 + o.y1) / 2, z); this.pushMat(this.curtM, gg) }
  }
  curtainZ(o, x) {
    if (!this.curtM) this.curtainX({ a: 0, b: 0.001, y0: 0, y1: 0.06 }, -999)
    const w = (o.b - o.a) * 0.42, g = new THREE.PlaneGeometry(w, o.y1 - o.y0 - 0.05, 12, 1), p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.025)
    g.computeVertexNormals()
    for (const sz of [o.a + w / 2 + 0.05, o.b - w / 2 - 0.05]) { const gg = g.clone(); gg.rotateY(Math.PI / 2); gg.translate(x, (o.y0 + o.y1) / 2, sz); this.pushMat(this.curtM, gg) }
  }
  glass2(x, y, z, w, h) { // 見た目だけのすりガラス
    if (!this.frost) this.frost = new THREE.MeshPhysicalMaterial({ color: 0xcfd6d4, roughness: 0.35, transparent: true, opacity: 0.75 })
    const g = new THREE.PlaneGeometry(w, h); g.translate(x + w / 2, y + h / 2, z); this.pushMat(this.frost, g)
  }
  doorFrameX(o, z) {
    this.B(o.a, o.y0, z - 0.1, o.a + 0.07, o.y1, z + 0.1, 'darkWood', { nocol: true }); this.B(o.b - 0.07, o.y0, z - 0.1, o.b, o.y1, z + 0.1, 'darkWood', { nocol: true })
    this.B(o.a, o.y1 - 0.08, z - 0.1, o.b, o.y1, z + 0.1, 'darkWood', { nocol: true })
  }
  glass(min, max) {
    if (!this.glassMat) this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb2b8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.6, depthWrite: false })
    // 割れる窓は1枚ずつ消すので、材質ごとに束ねた InstancedMesh の1つとして持つ（finish で作る）。mesh は位置と見える/消えるだけの代わり
    const lv = this, mesh = { position: new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2), size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], mat: this.glassMat, _v: true,
      get visible() { return this._v }, set visible(v) { this._v = v; if (this.im) { lv.glassMatrix(this, v); this.im.instanceMatrix.needsUpdate = true } } }
    const box = this.world.add({ min, max, kind: 'glass' })
    ;(this.glasses || (this.glasses = [])).push({ box, mesh, alive: true })
    box.glass = this.glasses[this.glasses.length - 1]
  }
  // 地面の白線・マンホール
  marks() {
    const P = (x0, z0, x1, z1, m) => this.B(x0, 0, z0, x1, 0.006, z1, m, { nocol: true })
    for (let x = 4; x <= 26; x += 3) P(x, -2, x + 0.12, 4, 'paint')
    P(4, 4, 26.12, 4.12, 'paint')
    for (let x = -28; x < 28; x += 4) P(x, 10.95, x + 2.2, 11.05, 'paint')
    P(-30, 8.25, 30, 8.37, 'paint'); P(-30, 13.63, 30, 13.75, 'paint')
    P(-6, -19.4, 30, -19.25, 'paintY')
    for (const x of [-14, 6, 20]) { const g = new THREE.CylinderGeometry(0.32, 0.32, 0.012, 24); g.translate(x, 0.006, 11); this.push('black', g) }
  }
  sign(x, y, z, rotY, text, w, h) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * h / w)
    const g = c.getContext('2d')
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#1d3b68'; g.font = `700 ${Math.round(c.height * 0.62)}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height * 0.54, c.width * 0.94)
    // 雨だれと色あせ
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,80,60,${Math.random() * 0.06})`; g.fillRect(Math.random() * c.width, 0, 2 + Math.random() * 6, c.height * Math.random()) }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }))
    m.position.set(x, y, z); m.rotation.y = rotY; m.receiveShadow = true
    this.scene.add(m)
  }
}
