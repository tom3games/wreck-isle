// 北の海側: 西の L 字の防波堤（赤灯台）、東の防波堤（白灯台）、フェリー乗り場と乗れるフェリー、浮き桟橋、魚市場
// 防波堤は細い。内側の縁は人だけ止める見えない柵（爆風で浮けば海へ落ちる）
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwu9lb26'
import { mat } from './level.js?v=mwu9lb26'
import { fishingBoat } from './props.js?v=mwu9lb26'

function col(world, x0, y0, z0, x1, y1, z1, kind = 'solid') { return world.add({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], kind }) }

export function buildNorth(level, scene, world) {
  const B = level.B.bind(level)
  // 岸壁の見えない柵に、防波堤とフェリー乗り場の口を開ける（level.js の柵は作り直す）
  for (const b of world.boxes) if (b.kind === 'edge' && b.max[2] <= -20 && b.min[2] >= -20.7 && b.max[0] - b.min[0] > 6) b.dead = true
  const gaps = [[-46, -40], [4, 8], [22, 30]]
  let x = -96
  for (const [a, b] of gaps) { if (a > x) col(world, x, 0, -20.6, a, 1.05, -20.05, 'edge'); x = b }
  col(world, x, 0, -20.6, 30, 1.05, -20.05, 'edge')

  // ---- 西の L 字防波堤 ----
  breakwater(level, scene, world, [[-43, -20], [-43, -66]], 'w')
  breakwater(level, scene, world, [[-45.5, -66], [-4, -66]], 'n')
  redLight(level, scene, world, -6.5, -66)
  // ---- 東の防波堤（採石場の海岸から） ----
  for (const b of world.boxes) if (b.kind === 'edge' && b.min[0] === 30 && b.max[0] === 62 && b.min[2] < -14) b.dead = true
  col(world, 30, 0, -14.6, 44, 1.05, -14.1, 'edge'); col(world, 49, 0, -14.6, 62, 1.05, -14.1, 'edge')
  breakwater(level, scene, world, [[46.5, -14], [46.5, -58]], 'e')
  whiteLight(level, scene, world, 46.5, -55.5)
  // ---- フェリー乗り場 ----
  B(22, -3.2, -50, 30, 0, -20, 'quay'); B(21.6, -3.2, -50.4, 30.4, -0.02, -50, 'seawall'); B(21.6, -3.2, -50, 22, -0.02, -20, 'seawall')
  col(world, 21.5, 0, -50.6, 30.2, 1.05, -50.1, 'edge'); col(world, 21.5, 0, -50.6, 22, 1.05, -20.6, 'edge')
  for (const z of [-24, -34, -44]) { const g = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 14); g.translate(29.6, 0.27, z); level.push('bollard', g); B(29.35, 0, z - 0.25, 29.85, 0.6, z + 0.25, null, { vis: false }) }
  for (let zz = -48; zz < -22; zz += 6) B(22.2, 0, zz, 22.5, 0.006, zz + 3, 'paintY', { nocol: true })
  terminal(level, scene, world, 23, -28)
  ferry(level, scene, world, 30.4, -76, -26)
  // ---- 浮き桟橋（古い桟橋の先） ----
  B(-1, -1.1, -46, 13, -0.85, -43.5, 'planks')
  B(-1, -1.1, -46, 1.5, -0.85, -40.6, 'planks')
  for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12); g.rotateZ(Math.PI / 2); g.translate(i * 2.4, -1.25, -44.8); level.push('styro', g) }
  for (const [x0, x1, z0, z1] of [[-1.4, 13.4, -46.4, -46], [13, 13.4, -46.4, -43.1]]) col(world, x0, -0.9, z0, x1, 0.2, z1, 'edge')
  // 桟橋から浮き桟橋へ下る段
  for (let i = 0; i < 4; i++) B(4.2, -1.1, -43.5 + i * 0.8, 7.8, -0.85 + (i + 1) * 0.2125, -43.5 + (i + 1) * 0.8, 'planks')
  const sb = fishingBoat(scene, 3, -49.5, 0.02, 0x2a5f8f); sb.scale.setScalar(0.6)
  const sb2 = fishingBoat(scene, 10, -49.2, -0.05, 0x8a2a1c); sb2.scale.setScalar(0.55)
  // ---- 魚市場（屋根だけの建物・集落の岸壁） ----
  market(level, scene, world, -40, -18.5)
  level.spawnsExtra3 = [[-43, 0.8, -60], [-20, 0.8, -66], [46.5, 0.8, -40], [26, 0, -40], [34.3, 0.3, -60]]
}

// 防波堤: 歩く所（高さ 0.9）と、海側の胸壁（高さ 2.4）、消波ブロック
function breakwater(level, scene, world, [[x0, z0], [x1, z1]], side) {
  const B = level.B.bind(level), W = 4.2, top = 0.4
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1), c = alongX ? z0 : x0
  const put = (u0, u1, v0, v1, y0, y1, m, o) => alongX ? B(u0, y0, v0, u1, y1, v1, m, o) : B(v0, y0, u0, v1, y1, u1, m, o)
  // 胴（海の中から）
  put(a0, a1, c - W / 2, c + W / 2, -3.4, top - 0.04, 'seawall', { nocol: true })
  put(a0, a1, c - W / 2, c + W / 2, -3.4, top, null, { vis: false })
  put(a0, a1, c - W / 2 + 0.03, c + W / 2 - 0.03, top - 0.04, top, 'quay', { nocol: true })
  // 胸壁は海側（外）。w=西防波堤は西側、n=北は北側、e=東は東側
  const outer = side === 'w' ? -1 : side === 'n' ? -1 : 1
  const pv0 = outer < 0 ? c - W / 2 : c + W / 2 - 0.7, pv1 = pv0 + 0.7
  put(a0, a1, pv0, pv1, top, 2.0, 'seawall')
  // 内側の縁は人だけ止める
  const iv = outer < 0 ? c + W / 2 : c - W / 2 - 0.4
  // L 字の角は内側の柵を切って通れるようにする
  const e0 = side === 'w' ? a0 + W + 0.5 : side === 'n' ? a0 + W + 0.5 : a0
  put(e0, a1, iv, iv + 0.4, top, top + 1.0, null, { kind: 'edge', vis: false })
  // 岸壁から上がる坂（根元 2m）
  if (side !== 'n') { const s0 = side === 'e' ? -14 : -20, dir = -1; for (let i = 0; i < 6; i++) { const zz = s0 + dir * i * 0.4; put(zz - 0.4, zz, c - W / 2 + (outer < 0 ? 0.7 : 0), c + W / 2 - (outer < 0 ? 0 : 0.7), -0.2, (i + 1) * 0.15, null, { vis: false }) } }
  // 係船柱
  for (let u = a0 + 4; u < a1 - 2; u += 9) { const g = new THREE.CylinderGeometry(0.18, 0.24, 0.5, 12); const px = alongX ? u : c - outer * (W / 2 - 0.5), pz = alongX ? c - outer * (W / 2 - 0.5) : u; g.translate(px, top + 0.25, pz); level.push('bollard', g) }
  // 消波ブロック（外側）
  tetras(scene, alongX, a0, a1, c + outer * (W / 2 + 1.6))
}

let TETRA = null
function tetras(scene, alongX, a0, a1, v) {
  if (!TETRA) {
    const legs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(q => new THREE.Vector3(...q).normalize()), parts = []
    for (const d of legs) { const c = new THREE.CylinderGeometry(0.22, 0.5, 1.5, 8); c.translate(0, 0.72, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); parts.push(c.toNonIndexed()) }
    let n = 0; for (const p of parts) n += p.attributes.position.count
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0
    for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count }
    TETRA = new THREE.BufferGeometry(); TETRA.setAttribute('position', new THREE.BufferAttribute(pos, 3)); TETRA.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  }
  const N = Math.floor((a1 - a0) / 1.6) * 2, m = new THREE.MeshStandardMaterial({ color: 0xa7a296, roughness: 0.95 })
  const im = new THREE.InstancedMesh(TETRA, m, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
  let i = 0
  for (let u = a0 + 0.8; u < a1 && i < N; u += 1.6) for (const off of [-0.9, 0.9]) {
    if (i >= N) break
    const p = alongX ? new THREE.Vector3(u + Math.random() * 0.5, -1.4 + Math.random() * 0.6 + (off > 0 ? -0.3 : 0.2), v + off) : new THREE.Vector3(v + off, -1.4 + Math.random() * 0.6 + (off > 0 ? -0.3 : 0.2), u + Math.random() * 0.5)
    m4.compose(p, q.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i++, m4)
  }
  im.count = i; im.castShadow = im.receiveShadow = true; scene.add(im)
}

function lightTower(scene, world, x, z, color) {
  const y = 0.4, g = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 6.5, 24), body); t.position.y = 3.25; g.add(t)
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5 })); ring.position.y = 6.6; g.add(ring)
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color === 0xb8321e ? 0xff4a30 : 0xd8ffd8, emissiveIntensity: 1.6 })); lamp.position.y = 7.1; g.add(lamp)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.6, 16), body); cap.position.y = 7.85; g.add(cap)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a3c3e })); door.position.set(0, 0.8, 1.13); g.add(door)
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true } })
  g.position.set(x, y, z); scene.add(g)
  col(world, x - 1.1, y, z - 1.1, x + 1.1, y + 8, z + 1.1)
}
function redLight(level, scene, world, x, z) { lightTower(scene, world, x, z, 0xb8321e) }
function whiteLight(level, scene, world, x, z) { lightTower(scene, world, x, z, 0xefede6) }

function terminal(level, scene, world, x, z) {
  const B = level.B.bind(level), w = 6.5, d = 7, h = 3
  B(x, 0, z, x + w, 0.1, z + d, 'slab', { nocol: true })
  level.wallX(x, x + w, z, 0, h, 0.15, 'tinBlue', [{ a: x + 0.6, b: x + 3.4, y0: 0.8, y1: 2.4 }, { a: x + 4.2, b: x + 5.8, y0: 0, y1: 2.2 }])
  level.wallX(x, x + w, z + d, 0, h, 0.15, 'tinBlue', [{ a: x + 2.5, b: x + 4, y0: 0, y1: 2.2 }])
  level.wallZ(z, z + d, x, 0, h, 0.15, 'tinBlue', [{ a: z + 1.5, b: z + 5.5, y0: 0.8, y1: 2.4 }])
  level.wallZ(z, z + d, x + w, 0, h, 0.15, 'tinBlue', [{ a: z + 2.5, b: z + 4.5, y0: 0, y1: 2.2 }])
  B(x - 0.5, h, z - 0.5, x + w + 0.5, h + 0.18, z + d + 0.5, 'contB')
  for (let i = 0; i < 2; i++) B(x + 1, 0, z + 2 + i * 2.2, x + 4.5, 0.45, z + 2.5 + i * 2.2, 'wood') // 待合のベンチ
  level.sign(x + w / 2, h + 0.6, z - 0.02, Math.PI, tr('フェリーのりば', 'FERRY TERMINAL'), 4.4, 0.7)
  level.dress.push({ x, z, w, d, top: h, wins: { N: [{ a: x + 0.6, b: x + 3.4, y0: 0.8 }], W: [{ a: z + 1.5, b: z + 5.5, y0: 0.8 }] }, doors: { N: [{ a: x + 4.2, b: x + 5.8 }], S: [{ a: x + 2.5, b: x + 4 }], E: [{ a: z + 2.5, b: z + 4.5 }] }, lv: 2, off: 0.105, rust: true })
  // 窓のガラス（割れる）
  level.windowX({ a: x + 0.6, b: x + 3.4, y0: 0.8, y1: 2.4 }, z)
  level.windowZ({ a: z + 1.5, b: z + 5.5, y0: 0.8, y1: 2.4 }, x)
}

// 乗れるフェリー（向きは南北。船首が北）。車両甲板 y=0.3、客室の床 y=3.4、屋上 y=6.4
function ferry(level, scene, world, x0, zN, zS) {
  const B = level.B.bind(level), W = 9, x1 = x0 + W
  const hullM = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.45, side: THREE.DoubleSide }), redM = new THREE.MeshStandardMaterial({ color: 0x1f4f8f, roughness: 0.45, side: THREE.DoubleSide })
  // 船体（見た目）: 下は青、上は白。船首はとがらせる
  const L = zS - zN, hull = new THREE.Shape()
  hull.moveTo(0, 0); hull.lineTo(W, 0); hull.lineTo(W, L - 6); hull.quadraticCurveTo(W, L - 1, W / 2, L + 2); hull.quadraticCurveTo(0, L - 1, 0, L - 6); hull.lineTo(0, 0)
  for (const [y0, y1, m] of [[-3.2, -0.6, redM], [-0.6, 2.4, hullM]]) {
    const g = new THREE.ExtrudeGeometry(hull, { depth: y1 - y0, bevelEnabled: false, curveSegments: 12 }); g.rotateX(Math.PI / 2); g.translate(x0, y1, zS); g.scale(1, 1, 1)
    const mm = new THREE.Mesh(g, m); mm.castShadow = mm.receiveShadow = true
    mm.scale.z = -1; mm.position.z = 2 * zS; scene.add(mm)
  }
  // 当たり: 外の壁（海へ落ちない高さ）
  // 左舷（乗り場側）は乗降口を空ける
  B(x0, -3.2, zN - 1, x0 + 0.25, 2.4, zS - 9, null, { vis: false }); B(x0, -3.2, zS - 4, x0 + 0.25, 2.4, zS, null, { vis: false }); B(x0, -3.2, zS - 9, x0 + 0.25, 0.3, zS - 4, null, { vis: false })
  B(x1 - 0.25, -3.2, zN - 1, x1, 2.4, zS, null, { vis: false })
  B(x0, -3.2, zN - 2, x1, 2.4, zN - 0.5, null, { vis: false })
  // 車両甲板（船尾は開いていて、乗り場から歩いて入れる）
  B(x0 + 0.25, -3.2, zN - 0.5, x1 - 0.25, 0.3, zS, 'slab')
  B(x0 - 0.45, 0, zS - 8.6, x0 + 0.3, 0.3, zS - 4.4, 'rustMetal') // 乗降口の渡し板
  // 側面の壁（車両甲板の上。窓の穴あり）
  level.wallZ(zN + 4, zS - 1, x0 + 0.15, 0.3, 3.3, 0.3, 'office', [{ a: zN + 10, b: zN + 14, y0: 1.2, y1: 2.4 }, { a: zN + 22, b: zN + 26, y0: 1.2, y1: 2.4 }, { a: zS - 9, b: zS - 4, y0: 0.3, y1: 2.6 }])
  level.wallZ(zN + 4, zS - 1, x1 - 0.15, 0.3, 3.3, 0.3, 'office', [{ a: zN + 10, b: zN + 14, y0: 1.2, y1: 2.4 }, { a: zN + 22, b: zN + 26, y0: 1.2, y1: 2.4 }])
  // 客室の床（車両甲板の天井）
  // 階段の穴（右舷の船尾側）を空ける
  B(x0, 3.3, zN + 4, x1 - 2.3, 3.45, zS - 6, 'planks'); B(x1 - 2.3, 3.3, zN + 4, x1, 3.45, zS - 12, 'planks')
  // 客室の壁（窓）
  level.wallX(x0 + 0.4, x1 - 0.4, zN + 5, 3.45, 6.3, 0.15, 'office', [{ a: x0 + 3.5, b: x0 + 5.5, y0: 3.45, y1: 5.6 }])
  level.wallX(x0 + 0.4, x1 - 0.4, zS - 7, 3.45, 6.3, 0.15, 'office', [{ a: x0 + 3.5, b: x0 + 5.5, y0: 3.45, y1: 5.6 }])
  level.wallZ(zN + 5, zS - 7, x0 + 0.4, 3.45, 6.3, 0.15, 'office', [{ a: zN + 8, b: zN + 14, y0: 4.2, y1: 5.5 }, { a: zN + 18, b: zN + 25, y0: 4.2, y1: 5.5 }, { a: zN + 29, b: zN + 35, y0: 4.2, y1: 5.5 }])
  level.wallZ(zN + 5, zS - 7, x1 - 0.4, 3.45, 6.3, 0.15, 'office', [{ a: zN + 8, b: zN + 14, y0: 4.2, y1: 5.5 }, { a: zN + 18, b: zN + 25, y0: 4.2, y1: 5.5 }, { a: zN + 29, b: zN + 35, y0: 4.2, y1: 5.5 }])
  for (let i = 0; i < 5; i++) B(x0 + 1.4, 3.45, zN + 9 + i * 5, x0 + 3.0, 3.95, zN + 10.2 + i * 5, 'contB') // 座席
  for (let i = 0; i < 5; i++) B(x1 - 3.0, 3.45, zN + 9 + i * 5, x1 - 1.4, 3.95, zN + 10.2 + i * 5, 'contB')
  // 屋上（客室の屋根）と操舵室
  B(x0 + 2.1, 6.3, zN + 4, x1, 6.45, zS - 6, 'planks'); B(x0, 6.3, zN + 10.6, x0 + 2.1, 6.45, zS - 6, 'planks'); B(x0, 6.3, zN + 4, x0 + 2.1, 6.45, zN + 5.4, 'planks')
  for (const [a, b, c2, d] of [[x0, zN + 4, x0 + 0.1, zS - 6], [x1 - 0.1, zN + 4, x1, zS - 6], [x0, zS - 6.1, x1, zS - 6]]) B(a, 6.45, b, c2, 7.45, d, 'alu')
  B(x0 + 2, 6.45, zN + 4.5, x1 - 2, 8.6, zN + 8.5, 'office')
  const gw = new THREE.Mesh(new THREE.BoxGeometry(W - 4.05, 0.9, 0.05), new THREE.MeshPhysicalMaterial({ color: 0x14191c, roughness: 0.05, envMapIntensity: 1.5 })); gw.position.set(x0 + W / 2, 7.9, zN + 4.48); scene.add(gw)
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 2.6, 18), redM); fun.position.set(x0 + W / 2, 7.7, zS - 10); fun.castShadow = true; scene.add(fun)
  col(world, x0 + W / 2 - 1, 6.45, zS - 11, x0 + W / 2 + 1, 9, zS - 9)
  // 階段: 車両甲板 → 客室（船尾側の中）、客室 → 屋上（船首側の外）
  const stair = (xA, xB, zStart, dz, y0, y1) => { const n = Math.round((y1 - y0) / 0.2); for (let i = 0; i < n; i++) { const za = zStart + dz * i * 0.28, zb = za + dz * 0.28; B(xA, y0 - 0.3, Math.min(za, zb), xB, y0 + (i + 1) * (y1 - y0) / n, Math.max(za, zb), 'rustMetal') } }
  stair(x1 - 2.2, x1 - 0.5, zS - 7.2, -1, 0.3, 3.45)
  stair(x0 + 0.5, x0 + 2.0, zN + 6, 1, 3.45, 6.45)
  // 船名
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g2 = c.getContext('2d')
  g2.fillStyle = '#eeeeea'; g2.fillRect(0, 0, 1024, 128); g2.fillStyle = '#1f4f8f'; g2.font = '900 84px "Zen Kaku Gothic New", sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(tr('フェリー にしうら', 'FERRY NISHIURA'), 512, 66, 1000)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  for (const [xx, ry] of [[x0 - 0.02, -Math.PI / 2], [x1 + 0.02, Math.PI / 2]]) { const nm = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })); nm.position.set(xx, 1.6, zN + 18); nm.rotation.y = ry; scene.add(nm) }
}

function market(level, scene, world, x, z) {
  const B = level.B.bind(level), w = 14, d = 8
  B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
  for (const px of [x, x + w / 2, x + w]) for (const pz of [z, z + d]) B(px - 0.18, 0, pz - 0.18, px + 0.18, 4.2, pz + 0.18, 'rustMetal')
  B(x - 0.6, 4.2, z - 0.6, x + w + 0.6, 4.4, z + d + 0.6, 'ironRust')
  // 競りの台と、並べた発泡スチロールの箱・青いかご
  for (let i = 0; i < 3; i++) B(x + 1.5 + i * 4.2, 0, z + 2.5, x + 4.5 + i * 4.2, 0.8, z + 5.5, 'kerb')
  for (let i = 0; i < 6; i++) B(x + 1.7 + i * 2.1, 0.8, z + 3, x + 2.6 + i * 2.1, 1.08, z + 3.6, 'styro', { nocol: true })
  level.styroStack(x + 1, z + 7, 4); level.styroStack(x + w - 1, z + 7, 3)
  level.sign(x + w / 2, 3.7, z - 0.25, Math.PI, tr('西浦漁協　魚市場', 'NISHIURA FISH MARKET'), 6, 0.7)
}
