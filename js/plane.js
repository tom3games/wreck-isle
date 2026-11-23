// 降下: 輸送機・飛ぶ道すじ・パラシュート。
// 輸送機の模型は OpenGameArt の「An-2 airplane lowpoly」（mokalux・CC0）。羽の骨組みのある複葉機で、物を運ぶ飛行機の定番。
import * as THREE from 'three'
import { FBXLoader } from '../vendor/jsm/loaders/FBXLoader.js'

export const DROP = {
  alt: 300,        // 輸送機の高さ（m）。2026-11-23 本人「300m にして」（150 だと自由落下が約4秒で短い）
  T: 30,           // 島を横切る秒数
  openAlt: 60,     // 地面から何 m で自動でパラシュートが開くか
  // 島の枠（外の海岸＋少し）。x -322〜322・z -72〜592
  box: [-340, -90, 340, 610],
  center: [0, 260],
}

// 進路のくじ: 島の真ん中の近く（横に ±70m）を通る一直線。向きは全方向からくじ
export function pickPath(rng) {
  const a = rng() * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a)
  const off = (rng() - 0.5) * 140
  const cx = DROP.center[0] + -dz * off, cz = DROP.center[1] + dx * off
  // 枠と線の交わる所（入口と出口）
  const [x0, z0, x1, z1] = DROP.box
  let tin = -1e9, tout = 1e9
  for (const [p, d, lo, hi] of [[cx, dx, x0, x1], [cz, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-6) continue
    const t1 = (lo - p) / d, t2 = (hi - p) / d
    tin = Math.max(tin, Math.min(t1, t2)); tout = Math.min(tout, Math.max(t1, t2))
  }
  const len = tout - tin
  return { x0: cx + dx * tin, z0: cz + dz * tin, dx, dz, len, speed: len / DROP.T, T: DROP.T, alt: DROP.alt }
}
// 時刻 t の輸送機の位置（進路の終わりを過ぎてもそのまま飛び去る）
export function planeAt(P, t) {
  const k = Math.max(0, P.speed * t)
  return { x: P.x0 + P.dx * k, z: P.z0 + P.dz * k, y: P.alt }
}

let MODEL = null
export async function loadPlane() {
  try { await loadPlane0() } catch (e) { console.warn('plane model', e) } // 模型が読めなくても試合は始まる（輸送機の絵だけ出ない）
}
async function loadPlane0() {
  const lm = new THREE.LoadingManager(); lm.setURLModifier(u => /\.(png|jpe?g|tga)$/i.test(u) ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : u) // 模型が指す元の絵は使わない（下で絵を貼り直す）
  const [fbx, tex] = await Promise.all([new FBXLoader(lm).loadAsync('./assets/models/an2/an2.fbx'), new THREE.TextureLoader().loadAsync('./assets/models/an2/An2Tex.png')])
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.25, side: THREE.DoubleSide })
  fbx.traverse(m => { if (m.isMesh) { m.material = mat; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false } })
  MODEL = fbx
}
// 輸送機の1機（機首は +z）。プロペラは回る
export function makePlane() {
  const g = new THREE.Group()
  if (!MODEL) return g
  const m = MODEL.clone(true)
  const prop = m.getObjectByName('Prop')
  // 元の模型は機首が -z。長さ 17m ほどに（実機は 12.7m だが、空の上で見分けがつく大きさに）
  const inner = new THREE.Group(); inner.add(m); inner.rotation.y = Math.PI
  const b = new THREE.Box3().setFromObject(m), s = new THREE.Vector3(); b.getSize(s)
  g.userData.prop = prop
  g.userData.len = Math.max(s.x, s.z)
  g.add(inner)
  g.userData.inner = inner
  return g
}

// ---- パラシュート（布の傘＋吊り紐）。色は落ち着いた物から人ごとに
const CANOPY = [0x8a3b2e, 0x2f5d62, 0x6b6a3a, 0x3d4f7a, 0x7a5a3a, 0x5b3d6b, 0x4d6b45, 0x9a7a2e, 0x6a6f78, 0x7a3a4a]
let _canopyGeo = null
function canopyGeo() {
  if (_canopyGeo) return _canopyGeo
  const N = 12, rings = 8
  const g = new THREE.SphereGeometry(1, N * 4, rings, 0, Math.PI * 2, 0, Math.PI * 0.5)
  g.scale(1.65, 0.85, 1.65)
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i)), u = ((a + Math.PI) / (Math.PI * 2)) * N, gore = Math.floor(u) % N, fr = u % 1
    const seam = Math.min(fr, 1 - fr) < 0.06 ? 0.55 : 1 // 布の継ぎ目
    const k = (gore % 2 ? 1 : 0.7) * seam
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
    // 縁は布が垂れて波打つ
    const y = pos.getY(i)
    if (y < 0.1) pos.setY(i, y - 0.05 - Math.abs(Math.sin(u * Math.PI)) * 0.1)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  _canopyGeo = g
  return g
}
const _matCache = {}
// n 番目の人の傘。人の頭上 3.0m に傘の頂点。open: 0〜1 の開き具合は scale で
export function makeChute(n) {
  const col = CANOPY[n % CANOPY.length]
  const mat = _matCache[col] || (_matCache[col] = new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }))
  const g = new THREE.Group()
  const cano = new THREE.Mesh(canopyGeo(), mat); cano.castShadow = true; cano.position.y = 3.2; g.add(cano)
  // 吊り紐: 縁の 12 点から両肩へ
  const pts = []
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rx = Math.cos(a) * 1.62, rz = Math.sin(a) * 1.62; pts.push(rx, 3.2 - 0.1, rz, Math.sign(Math.cos(a) || 1) * 0.16, 1.45, 0.0) }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3630 })); g.add(lines)
  g.userData.cano = cano; g.userData.lines = lines
  return g
}
