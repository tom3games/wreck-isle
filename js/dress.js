// 北の港町と西の集落の「着せ替え」: 壁の汚れ（泥はね・雨だれ・角の黒ずみ・錆の筋）と、港町の暮らしの小物（2026-11-22）
// 建物は level.dress に {x,z,w,d,top,wins,doors,lv,off,rust} を積んでおく。汚れの板は南と同じ絵（south.js の grimeAtlas）
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { grime, grimeAtlas } from './south.js?v=mwuc41ax'

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }

// level.house（平屋）の窓と戸口の位置
export function stdInfo(x, z, w, d, lv) {
  return { std: true, x, z, w, d, top: 3.1, lv, off: 0.105, wins: { N: [{ a: x + w - 4, b: x + w - 1.5, y0: 1.25 }], S: [{ a: x + 1.5, b: x + 3.5, y0: 1.25 }], W: [{ a: z + 2.5, b: z + 4.5, y0: 1.25 }], E: [{ a: z + 3, b: z + 5, y0: 1.25 }] }, doors: { N: [{ a: x + 2, b: x + 3.4 }], S: [{ a: x + w - 3.2, b: x + w - 1.6 }] } }
}

export function dressNorth(level, scene, world) {
  const rnd = mulberry(5150), B = level.B.bind(level)
  // 倉庫（波板トタン）: 錆の筋は屋根の縁と窓の下、海側ほど濃い
  level.dress.push({ x: -26, z: -14, w: 18, d: 14, top: 8.4, off: 0.14, lv: 3, rust: true,
    wins: { N: [{ a: -24.5, b: -22.5, y0: 5.2 }, { a: -12.5, b: -10, y0: 5.2 }], S: [{ a: -23.5, b: -21.5, y0: 5.2 }], E: [{ a: -11.5, b: -9.5, y0: 1.2 }], W: [{ a: -10, b: -7.8, y0: 5.2 }, { a: -4.5, b: -2.5, y0: 5.2 }] },
    doors: { N: [{ a: -21, b: -15.5 }], E: [{ a: -6.2, b: -4.8 }], S: [{ a: -11.8, b: -10.4 }] } })
  const geos = [], rust = []
  for (const d of level.dress) grime(d.rust ? rust : geos, rnd, d.x, d.z, d.w, d.d, d.top, d.wins || {}, d.doors || {}, d.lv, d.off)
  const atlas = grimeAtlas(rnd)
  for (const [arr, color, op] of [[geos, 0x2a2219, 1], [rust, 0x55301a, 0.62]]) {
    if (!arr.length) continue
    const m = new THREE.MeshStandardMaterial({ color, alphaMap: atlas, transparent: true, opacity: op, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    const mesh = new THREE.Mesh(mergeGeometries(arr.map(g => g.index ? g.toNonIndexed() : g)), m); mesh.renderOrder = 2; mesh.receiveShadow = true; scene.add(mesh)
  }
  // 倉庫の壁: 胴縁の線2本と、下のコンクリートの腰壁（戸口と窓をよける）。波板の大きな面に切れ目を入れる
  {
    const W = { x0: -26, x1: -8, z0: -14, z1: 0 }, e = 0.2
    const spans = (a, b, holes) => { const out = []; let u = a; for (const [h0, h1] of [...holes].sort((p, q) => p[0] - q[0])) { if (h0 > u) out.push([u, h0]); u = Math.max(u, h1) } if (u < b) out.push([u, b]); return out }
    const faces = [
      { n: 'N', a: W.x0, b: W.x1, at: W.z0 - 0.125 - 0.04, X: true, sg: -1, door: [[-21, -15.5]] },
      { n: 'S', a: W.x0, b: W.x1, at: W.z1 + 0.125 + 0.04, X: true, sg: 1, door: [[-11.8, -10.4]] },
      { n: 'E', a: W.z0, b: W.z1, at: W.x1 + 0.125 + 0.04, X: false, sg: 1, door: [[-6.2, -4.8]] },
      { n: 'W', a: W.z0, b: W.z1, at: W.x0 - 0.125 - 0.04, X: false, sg: -1, door: [] },
    ]
    for (const f of faces) {
      for (const [y0, y1, m] of [[0, 0.9, 'blockGrey'], [2.55, 2.65, 'rustMetal'], [4.65, 4.75, 'rustMetal']]) {
        const holes = y0 === 2.55 ? f.door : y0 === 0 ? f.door : []
        for (const [u0, u1] of spans(f.a, f.b, holes)) { if (f.X) B(u0, y0, f.at - 0.04, u1, y1, f.at + 0.04, m, { nocol: true }); else B(f.at - 0.04, y0, u0, f.at + 0.04, y1, u1, m, { nocol: true }) }
      }
    }
  }
  // 通りぞいの家: 角の見切り材・妻側の腰壁・玄関の庇・室外機とプロパンガス。長い壁を家ごとの面に分ける
  level.extraProps = level.extraProps || []
  const prop = (...a) => level.extraProps.push(a)
  let hi = 0
  for (const h of level.dress) {
    if (!h.std) continue
    const { x, z, w, d } = h, n = hi++
    const trim = n % 2 ? 'sidingTar' : 'sidingGrey'
    for (const cx of [x - 0.04, x + w + 0.04]) for (const cz of [z - 0.04, z + d + 0.04]) B(cx - 0.09, 0.35, cz - 0.09, cx + 0.09, 3.1, cz + 0.09, trim, { nocol: true })
    for (const xx of [x - 0.02, x + w + 0.02]) B(xx - 0.05, 0.35, z, xx + 0.05, 1.2, z + d, 'blockGrey', { nocol: true })
    // 玄関の庇（北側の戸口の上。柱は戸口の両わき）
    const dN = h.doors.N[0], gx = dN.a - 0.1, gw = dN.b - dN.a + 0.2, pz = z - 0.05
    for (const px of [gx + 0.05, gx + gw - 0.05]) B(px - 0.05, 0.35, pz - 1.15 - 0.05, px + 0.05, 2.55, pz - 1.15 + 0.05, 'alu', { nocol: true })
    level.slab(gx + gw / 2, 2.67, pz - 0.6, gw + 0.8, 0.07, 1.6, 0.12, 0, n % 3 === 0 ? 'roofRed' : 'roofBlack')
    prop('exterior_aircon_unit', x + w + 0.35, 0.35, z + 1.2 + (n % 3) * 1.1, Math.PI / 2, ['y', 0.62], false)
    if (n % 2 === 0) prop('propane_tank', x + 0.5, 0, z + d + 0.5, 0, ['y', 1.1], false)
  }
  // 暮らしの小物（壁ぎわの見た目だけの物。通り道はふさがない）
  const sph = (x, y, z, r, m) => { const g = new THREE.SphereGeometry(r, 10, 8); g.translate(x, y, z); level.push(m, g) }
  const cyl = (x, y, z, r, h, m) => { const g = new THREE.CylinderGeometry(r, r * 0.88, h, 12); g.translate(x, y + h / 2, z); level.push(m, g) }
  const torus = (x, y, z, r, m) => { const g = new THREE.TorusGeometry(r, 0.05, 6, 14); g.rotateX(Math.PI / 2); g.translate(x, y, z); level.push(m, g) }
  // 浮き玉と縄: 番屋と倉庫の壁ぎわ
  for (const [bx, bz] of [[-84.6, -3.4], [-83.6, -3.1], [-84.2, -2.2], [-44.4, -2.5], [-43.5, -2.9], [-24.8, 1.2], [-23.8, 1.5]]) sph(bx, 0.22, bz, 0.22, rnd() < 0.5 ? 'contO' : 'contB')
  for (const [bx, bz] of [[-85.5, -2.2], [-45.2, -3.2], [-8.8, -2.4]]) { torus(bx, 0.05, bz, 0.32, 'wood'); torus(bx, 0.12, bz, 0.26, 'wood') }
  // バケツと発泡スチロールの蓋
  for (const [bx, bz] of [[-87.4, -3.3], [-47.3, -2.6], [-26.9, 2.4], [-7.0, -13.1]]) { cyl(bx, 0, bz, 0.22, 0.34, 'contB'); cyl(bx + 0.5, 0, bz + 0.1, 0.22, 0.34, 'pumpRed') }
  // 自転車（家の壁ぎわ）
  const bike = (bx, bz, along) => {
    for (const dz of [-0.42, 0.42]) { const g = new THREE.TorusGeometry(0.33, 0.025, 6, 16); if (along === 'z') g.rotateY(Math.PI / 2); g.translate(bx + (along === 'x' ? dz : 0), 0.35, bz + (along === 'z' ? dz : 0)); level.push('black', g) }
    if (along === 'z') { B(bx - 0.02, 0.4, bz - 0.4, bx + 0.02, 0.46, bz + 0.4, 'alu', { nocol: true }); B(bx - 0.25, 0.92, bz + 0.3, bx + 0.25, 0.96, bz + 0.34, 'black', { nocol: true }) }
    else { B(bx - 0.4, 0.4, bz - 0.02, bx + 0.4, 0.46, bz + 0.02, 'alu', { nocol: true }); B(bx + 0.3, 0.92, bz - 0.25, bx + 0.34, 0.96, bz + 0.25, 'black', { nocol: true }) }
  }
  bike(-61.0, 23.9, 'z'); bike(-22.5, 26.4, 'x'); bike(-41, 31.2, 'x'); bike(-47.2, 21.6, 'z')
  // 洗濯物（家の裏の竿）と鉢植え
  const laundry = (x0, x1, zz) => {
    for (const px of [x0, x1]) B(px - 0.04, 0, zz - 0.04, px + 0.04, 1.9, zz + 0.04, 'darkWood')
    B(x0, 1.86, zz - 0.03, x1, 1.92, zz + 0.03, 'alu', { nocol: true })
    const cols = ['paint', 'paintY', 'contB', 'canopy', 'pumpRed']
    for (let i = 0; x0 + 1 + i * 1.05 < x1 - 0.5; i++) { const g = new THREE.PlaneGeometry(0.5 + rnd() * 0.3, 0.7 + rnd() * 0.3); g.rotateY(Math.PI / 2 + (rnd() - 0.5) * 0.3); g.translate(x0 + 1 + i * 1.05, 1.45, zz); level.push(cols[i % 5], g) }
  }
  laundry(-22.5, -14, 27.4); laundry(8, 14.5, 27.2)
  for (const [px, pz] of [[-22.2, 26.8], [-21.7, 26.9], [7.7, 26.8], [-58.8, 24.2], [-42.6, 31.4], [-41.9, 31.5]]) { cyl(px, 0, pz, 0.17, 0.3, 'contO'); sph(px, 0.5, pz, 0.21, 'hedge') }
}
