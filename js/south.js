// 南の低地: 住宅地・川と橋・林と草・島をひと回りする道・給油所・畑・南の海岸（2026-11-22）
// 地形の形は southmap.js（area.js の terrainH と同じ数字）。当たりは見た目と同じ箱データ（level.B）か、見た目の形から作る（colFromMesh）
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwu9lb26'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { mat } from './level.js?v=mwu9lb26'
import { cedarGeo, broadGeo, leafTex, fishingBoat } from './props.js?v=mwu9lb26'
import { colFromMesh } from './colmesh.js?v=mwu9lb26'
import { RING, STREET_Z, ROADS, BRIDGES, WOODS, riverC, riverW, riverEdge, coastD, roadDist, PASS_X } from './southmap.js?v=mwu9lb26'

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const col = (world, x0, y0, z0, x1, y1, z1, kind = 'solid') => world.add({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], kind })

export function buildSouth(level, scene, world) {
  const rnd = mulberry(20261122), B = level.B.bind(level), H = (x, z) => world.H(x, z)
  level.extraProps = level.extraProps || []
  const prop = (...a) => level.extraProps.push(a)
  const grass = [] // 草の置き場所 {x,z,s,k}
  const chop = []  // 家・畑の敷地（木や草を置かない）[x0,z0,x1,z1]
  const free = (x, z, m = 0) => !chop.some(c => x > c[0] - m && x < c[2] + m && z > c[1] - m && z < c[3] + m)

  roads(scene, level)
  bridges(level, scene, world, B, prop)
  riverBank(scene, world, rnd, grass)
  town(level, scene, world, B, prop, rnd, chop, grass)
  farm(level, scene, world, B, prop, rnd, chop, grass)
  gasStation(level, scene, world, B, prop, chop)
  beach(level, scene, world, B, prop, rnd, chop)
  finishGrime(level, scene, rnd)
  for (const [sx, , sz] of [[-72, 0, 158], [58, 0, 190], [-45, 0, 200], [-72, 0, 160]]) chop.push([sx - 2, sz - 2, sx + 2, sz + 2]) // 上陸地点に木を立てない
  woods(level, scene, world, rnd, chop, free, grass)
  for (const [x, z] of [[34.4, 118], [34.7, 118.7], [24.6, 88], [24.9, 88.4], [-50, 154.6], [-50.6, 155.3], [52, 215.5], [-52, 215.5], [-52.6, 214.8], [58.5, 190]]) level.drum(x, z)
  for (let i = 0; i < 34; i++) { const x = -90 + rnd() * 184, z = 136 + rnd() * 100; if (!free(x, z, 1) || roadDist(x, z) < 4 || riverEdge(x, z) < 3 || coastD(x, z) < 10 || H(x, z) < 0.05 || Math.abs(x - PASS_X) < 9) continue; prop('shrub_01', x, H(x, z), z, rnd() * 6, ['y', 0.9 + rnd() * 0.9]) }
  // 床・道・塀などの箱の中に生える草は外す（家の1階の床から草が突き出ていた）
  for (let i = grass.length - 1; i >= 0; i--) {
    const g = grass[i], gy = g.y != null ? g.y : H(g.x, g.z)
    if (world.near(g.x - 0.05, g.z - 0.05, g.x + 0.05, g.z + 0.05).some(b => b.kind !== 'nocol' && g.x > b.min[0] && g.x < b.max[0] && g.z > b.min[2] && g.z < b.max[2] && b.max[1] > gy + 0.03 && b.min[1] < gy + 0.5)) grass.splice(i, 1)
  }
  level.grass = makeGrass(scene, grass, rnd, H)
  // 拾う物・上陸地点・円の中心の候補
  level.spawnsExtra4 = [[-30, 0, 200], [30, 0, 200], [-30, 0, 162], [26, 0, 160], [-8, 0, 228], [48, 0, 228], [-45, 0, 200], [-72, H(-72, 158), 158], [58, 0, 190]]
  level.zoneSpots = [[0, 11], [-60, 8], [-20, -6], [26, -32], [66, 38], [29.5, 70], [-52, 22], [0, 176.5], [0, 200], [-30, 162], [52, 200], [29.5, 120], [-58, 200], [58, 200]]
}

// ---------- 道 ----------
export function ribbon(scene, pts, width, material, y, tile, po) {
  const pos = [], uv = [], idx = []
  let along = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    const nx = -dz / l, nz = dx / l
    if (i) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    for (const s of [-1, 1]) { pos.push(pts[i][0] + nx * s * width / 2, y, pts[i][1] + nz * s * width / 2); uv.push((s + 1) / 2 * width / tile, along / tile) }
    if (i) { const o = i * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
  const m = material.clone(); m.polygonOffset = true; m.polygonOffsetFactor = po; m.polygonOffsetUnits = po
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh)
}
export function dashes(scene, pts, gap = 4.6, len = 2.4) {
  const pos = [], idx = []
  let carry = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (!L) continue
    const ux = dx / L, uz = dz / L, nx = -uz * 0.07, nz = ux * 0.07
    for (let s = carry; s < L; s += gap) {
      const e = Math.min(L, s + len), o = pos.length / 3
      for (const [t, k] of [[s, -1], [s, 1], [e, -1], [e, 1]]) pos.push(ax + ux * t + nx * k, 0.05, az + uz * t + nz * k)
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
    }
    carry = ((carry - L) % gap + gap) % gap
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  const m = new THREE.MeshStandardMaterial({ color: 0xe6e1d2, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })
  scene.add(new THREE.Mesh(g, m))
}
function roads(scene, level) {
  const road = mat('road'), gravel = mat('gravel')
  const list = [['ring', ROADS.ring], ['spoke', ROADS.spoke], ['street', ROADS.street], ['pass', ROADS.pass], ['toEast', ROADS.toEast], ['toSouth', ROADS.toSouth]]
  for (const [k, pts] of list) {
    const w = k === 'ring' ? RING.w : 6
    ribbon(scene, pts, w + 2.2, gravel, 0.012, 3, -2)
    ribbon(scene, pts, w, road, 0.02, 5, -3)
    dashes(scene, pts)
  }
}

// ---------- 橋（真ん中の鉄の橋と、輪の両端の小さな橋）。車も渡れる。路面は y=0 で地面と同じ高さ ----------
function bridges(level, scene, world, B, prop) {
  for (const br of BRIDGES) {
    const x = br.x, main = br.kind === 'main', hw = main ? 4.4 : 3.6
    const zs = [riverC(x - hw), riverC(x + hw), riverC(x)], w = Math.max(riverW(x - hw), riverW(x), riverW(x + hw))
    const z0 = Math.min(...zs) - w - 3.2, z1 = Math.max(...zs) + w + 3.2, zc = riverC(x)
    B(x - hw, -0.5, z0, x + hw, 0, z1, 'road')
    B(x - hw, -1.1, z0 + 0.4, x + hw, -0.5, z1 - 0.4, 'seawall', { nocol: true })
    for (const px of [-hw * 0.55, hw * 0.55]) { const g = new THREE.CylinderGeometry(0.55, 0.7, 2.6, 14); g.translate(x + px, -1.4, zc); level.push('seawall', g) }
    if (!main) {
      for (const sx of [-1, 1]) B(sx < 0 ? x - hw : x + hw - 0.35, 0, z0, sx < 0 ? x - hw + 0.35 : x + hw, 1.0, z1, 'block')
      for (const [px, pz] of [[x - hw + 0.18, z0 + 0.5], [x + hw - 0.18, z1 - 0.5]]) prop('street_lamp_01', px, 0, pz, 0, ['y', 4.4])
    } else {
      // 鉄のトラス: 低い手すりは当たり、柱と上の梁も当たり、斜めの材は見た目
      const n = Math.round((z1 - z0) / 3.4), dz = (z1 - z0) / n
      for (const sx of [-1, 1]) {
        const cx = x + sx * (hw - 0.17)
        B(cx - 0.17, 0, z0, cx + 0.17, 1.05, z1, 'steelGreen')
        B(cx - 0.17, 4.2, z0, cx + 0.17, 4.5, z1, 'steelGreen')
        for (let i = 0; i <= n; i++) {
          const pz = z0 + i * dz
          B(cx - 0.15, 0, pz - 0.15, cx + 0.15, 4.5, pz + 0.15, 'steelGreen')
          if (i < n) {
            const a = (i % 2 ? [4.2, 1.05] : [1.05, 4.2]), len = Math.hypot(dz, 3.15), g = new THREE.BoxGeometry(0.12, len, 0.12)
            g.rotateX(Math.atan2(dz, a[1] - a[0])); g.translate(cx, (a[0] + a[1]) / 2, pz + dz / 2); level.push('steelGreen', g)
          }
        }
      }
      for (const [zz, rot] of [[z0 + 0.25, Math.PI], [z1 - 0.25, 0]]) { B(x - hw, 4.2, zz - 0.15, x + hw, 4.5, zz + 0.15, 'steelGreen'); level.sign(x, 3.7, zz + (rot ? 0.17 : -0.17), rot ? 0 : Math.PI, tr('中ノ橋', 'NAKANO BRIDGE'), 3.4, 0.7) }
      for (const [px, pz] of [[x - hw - 0.7, z0 - 1], [x + hw + 0.7, z1 + 1]]) prop('street_lamp_01', px, 0, pz, 0, ['y', 4.6])
    }
    // 橋のたもと: 車止めと標識の代わりの石
    for (const zz of [z0 - 0.8, z1 + 0.8]) for (const sx of [-1, 1]) { const g = new THREE.CylinderGeometry(0.13, 0.15, 0.7, 10); g.translate(x + sx * (hw + 0.5), 0.35, zz); level.push('bollard', g); B(x + sx * (hw + 0.5) - 0.15, 0, zz - 0.15, x + sx * (hw + 0.5) + 0.15, 0.7, zz + 0.15, null, { vis: false }) }
    // 橋のたもとの燃料のドラム缶（橋の取り合いで連鎖が起きる）
    for (const [dx, dz] of main ? [[hw + 1.6, -1.4], [hw + 2.3, -1.0], [-hw - 1.7, 1.5], [-hw - 2.4, 1.2]] : [[hw + 1.4, -1.3], [-hw - 1.5, 1.4]]) level.drum(x + dx, dz < 0 ? z0 + dz : z1 + dz)
    br.z0 = z0; br.z1 = z1; br.zc = zc
  }
}

// ---------- 川の岸（小石と葦） ----------
function riverBank(scene, world, rnd, grass) {
  const g = new THREE.DodecahedronGeometry(1, 1), m = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95, map: mat('seawall').map, normalMap: mat('seawall').normalMap })
  const N = 420, im = new THREE.InstancedMesh(g, m, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color()
  let n = 0
  for (let x = -92; x < 96 && n < N; x += 0.9 + rnd() * 1.4) for (const side of [-1, 1]) {
    if (rnd() < 0.35) continue
    const w = riverW(x), z = riverC(x) + side * (w + 0.7 + rnd() * 1.4)
    if (coastD(x, z) < 3 || roadDist(x, z) < 3.4) continue
    const s = 0.14 + rnd() * rnd() * 0.5, y = world.H(x, z)
    m4.compose(v.set(x, y + s * 0.2, z), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 6, rnd() * 3)), sc.set(s * (1 + rnd() * 0.8), s * 0.7, s * (1 + rnd() * 0.6)))
    im.setMatrixAt(n, m4); im.setColorAt(n, c.setHSL(0.09, 0.05 + rnd() * 0.05, 0.38 + rnd() * 0.2)); n++
  }
  im.count = n; im.castShadow = im.receiveShadow = true; scene.add(im)
  // 葦（背の高い草）
  for (let x = -91; x < 96; x += 0.55) for (const side of [-1, 1]) {
    if (rnd() < 0.3) continue
    const w = riverW(x), d = w + 2.0 + rnd() * 2.6, z = riverC(x) + side * d
    if (coastD(x, z) < 5 || roadDist(x, z) < 4.5) continue
    grass.push({ x, z, s: 1.1 + rnd() * 0.9, k: 'reed' })
  }
}

// ---------- 住宅地 ----------
function town(level, scene, world, B, prop, rnd, chop, grass) {
  const pick = a => a[Math.floor(rnd() * a.length)]
  // [x, z, 幅, 奥行き, 壁, 屋根, 屋根の高さ, 庭の型]。壁と屋根と勾配をばらつかせる（2026-11-22）
  // 2026-11-23: 家を大きくした（間口 12m・奥行き 9.5m 前後）ので並べ直した。北の列 6軒・南の列 5軒＋アパート2棟
  const houses = [
    [-56, 184, 12.5, 9.5, 'stuccoCream', 'roofRed', 1.8, 'porch', 2, 'z', 'none'], [-41, 184.2, 12, 9.4, 'sidingGrey', 'roofBlack', 1.4, 'bike', 1, 'x'], [-26, 184, 12, 9.6, 'stuccoSage', 'roofGreen', 1.6, 'laundry', 2, 'z'],
    [-13.2, 184.4, 8.6, 9.2, 'tinBlue', 'roofRed', 1.5, 'plants', 1, 'x'], [4.5, 184, 12, 9.5, 'sidingGreen', 'roofRed', 1.9, 'porch', 2, 'x', 'switch'], [19.5, 184.2, 12, 9.3, 'stuccoPink', 'roofBlack', 1.7, 'bike', 2, 'z'],
    [-56, 204.5, 12, 9.5, 'cedar', 'roofGreen', 1.6, 'plants', 2, 'x', 'awning'], [-20.5, 204.8, 12.5, 9.4, 'stuccoBlue', 'kawara', 1.3, 'bike', 2, 'z', 'thin'],
    [4.5, 204.6, 12, 9.4, 'tinCream', 'roofRed', 1.7, 'plants', 2, 'z', 'thin'], [19.5, 204.5, 12, 9.6, 'stuccoCream', 'roofBlack', 2.0, 'plants', 1, 'z'], [34, 204.8, 12, 9.4, 'sidingGrey', 'roofRed', 1.6, 'bike', 2, 'x', 'awning'],
  ]
  const grimeGeos = level.grimeGeos = level.grimeGeos || [], tryGrime = (x, z, w, d, top, wins, doors, lv) => grime(grimeGeos, rnd, x, z, w, d, top, wins, doors, lv)
  // 窓は中が暗く見えるように（白いカーテンとガラスの反射で白く飛んでいた）。南の家を作る間だけ差し替える
  const curt0 = level.curtM, glass0 = level.glassMat
  const curts = [0x3b342c, 0x4a3d35, 0x2f3a3f, 0x453a46].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }))
  level.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2a30, roughness: 0.5, transparent: true, opacity: 0.6, envMapIntensity: 0.3, depthWrite: false }) // 粗く・反射を弱く: 太陽の白い点が光らないように
  level.frameKey = 'frameSouth' // 窓枠は艶を落とす（太陽の白い光を出さない）
  let hi = 0
  const nextCurt = () => { level.curtM = curts[hi++ % curts.length] }
  nextCurt(); apartment(level, 33, 188, 12, 6, 'stuccoBlue'); tryGrime(33, 188, 12, 6, 5.95, {}, {}, 1)
  nextCurt(); apartment(level, -39, 206, 12, 6.2, 'tinCream'); tryGrime(-39, 206, 12, 6.2, 5.95, {}, {}, 2)
  chop.push([31, 186, 47, 196], [-41, 203, -21, 214])
  for (const [x, z, w, d, m, rf, rh, kind, floors, ridge, band] of houses) {
    nextCurt()
    let info
    const dN = { a: x + 1.5, b: x + 3.0 }, dS = { a: x + w - 3.2, b: x + w - 1.7 }
    if (ridge === 'old') { level.house(x, z, w, d, m, rf, rh); info = { top: 3.1, wins: { N: [{ a: x + w - 4, b: x + w - 1.5, y0: 1.25 }], S: [{ a: x + 1.5, b: x + 3.5, y0: 1.25 }], W: [{ a: z + 2.5, b: z + 4.5, y0: 1.25 }], E: [{ a: z + 3, b: z + 5, y0: 1.25 }] } } }
    else info = house2(level, x, z, w, d, m, rf, rh, { floors, ridge, band })
    tryGrime(x, z, w, d, info.top, info.wins, info.doors || { N: [dN], S: [dS] }, [3, 2, 0, 3, 1, 2, 3, 0, 2, 1, 3][houses.findIndex(h => h[0] === x && h[1] === z)])
    if (floors === 2) for (const [ix, iz] of [[x + w - 2.2, z + 2.0], [x + w - 3.8, z + d - 2.2]]) (level.upItems || (level.upItems = [])).push([ix, iz, info.f2 + 0.02])
    // 角の見切り材と、妻側（東西の壁）の腰壁。のっぺりした面に線を入れる
    const trim = m.startsWith('siding') || m === 'cedar' ? 'darkWood' : 'sidingGrey'
    for (const cx2 of [x - 0.04, x + w + 0.04]) for (const cz2 of [z - 0.04, z + d + 0.04]) B(cx2 - 0.09, 0.35, cz2 - 0.09, cx2 + 0.09, info.top - 0.05, cz2 + 0.09, trim, { nocol: true })
    if (!m.startsWith('siding') && m !== 'cedar') for (const xx of [x - 0.02, x + w + 0.02]) B(xx - 0.05, 0.35, z, xx + 0.05, 1.25, z + d, 'blockGrey', { nocol: true })
    chop.push([x - 2, z - 2, x + w + 2, z + d + 2])
    const north = z < STREET_Z, fz = north ? z + d : z // 通りに面した側
    const sgn = north ? 1 : -1, fy = fz + sgn * 2.2
    // 通りとの間: ブロック塀（笠木つき・門柱）か生け垣。玄関の前に口を開け、玄関まで飛び石の道
    const doorX = north ? x + w - 3.2 : x + 1.5, gate = doorX - 0.05, gw = 1.7
    const kind2 = !north && (kind === 'porch' || kind === 'laundry') ? 'plants' : kind // 南の列は裏がすぐ輪の道
    const hedge = rnd() < 0.4, hh = hedge ? 0.85 : 1.05 + rnd() * 0.2, th = hedge ? 0.6 : 0.18
    level.wallX(x - 1, x + w + 1, fy, 0, hh, th, hedge ? 'hedge' : 'blockGrey', [{ a: gate, b: gate + gw, y0: 0, y1: 1.4 }])
    if (hedge) for (const [a, b] of [[x - 1, gate], [gate + gw, x + w + 1]]) {
      const cg = new THREE.CylinderGeometry(0.3, 0.3, b - a, 10, 1, false, 0, Math.PI); cg.rotateZ(Math.PI / 2); cg.rotateX(-Math.PI / 2); cg.translate((a + b) / 2, hh, fy); level.push('hedge', cg)
      B(a, hh, fy - 0.3, b, hh + 0.3, fy + 0.3, null, { vis: false })
    }
    if (!hedge) { for (const [a, b] of [[x - 1.05, gate], [gate + gw, x + w + 1.05]]) B(a, hh, fy - 0.13, b, hh + 0.07, fy + 0.13, 'kerb', { nocol: true }); for (const px of [gate - 0.1, gate + gw + 0.1]) B(px - 0.14, 0, fy - 0.14, px + 0.14, hh + 0.35, fy + 0.14, 'blockGrey') }
    B(gate + 0.2, 0, Math.min(fz, fy), gate + gw - 0.2, 0.03, Math.max(fz, fy), 'gravel', { nocol: true })
    for (let i = 0; i < 4; i++) B(gate + 0.35, 0.03, Math.min(fz, fy) + 0.3 + i * 0.5, gate + gw - 0.35, 0.05, Math.min(fz, fy) + 0.6 + i * 0.5, 'stoneStep', { nocol: true })
    // 玄関の庇（下屋）: 玄関の上に斜めの小さな屋根と2本の柱
    const pz = fz + sgn * 0.05, py = 2.55
    for (const px of [gate + 0.1, gate + gw - 0.1]) B(px - 0.05, 0.35, pz + sgn * 1.15 - 0.05, px + 0.05, py, pz + sgn * 1.15 + 0.05, 'alu')
    level.slab(gate + gw / 2, py + 0.12, pz + sgn * 0.6, gw + 0.8, 0.07, 1.6, -sgn * 0.12, 0, 'roofBlack')
    // 家ごとの暮らしの物（見た目は merge される箱と円筒。当たりは箱だけ）
    const sx = north ? 1 : -1, yz = fz + sgn * 1.0
    if (kind2 === 'bike') { // 自転車: 輪2つと車体
      const bx = x + 1.2, bz = north ? z - 0.55 : z + d + 0.55
      for (const dx of [-0.42, 0.42]) { const g = new THREE.TorusGeometry(0.33, 0.025, 6, 16); g.rotateY(Math.PI / 2); g.translate(bx + 0, 0.35, bz + dx); level.push('black', g) }
      B(bx - 0.02, 0.4, bz - 0.4, bx + 0.02, 0.46, bz + 0.4, 'alu', { nocol: true }); B(bx - 0.02, 0.45, bz + 0.3, bx + 0.02, 0.95, bz + 0.34, 'alu', { nocol: true })
      B(bx - 0.25, 0.92, bz + 0.3, bx + 0.25, 0.96, bz + 0.34, 'black', { nocol: true }); B(bx - 0.04, 0.35, bz - 0.5, bx + 0.04, 0.85, bz + 0.5, null, { vis: false })
    } else if (kind2 === 'laundry') { // 物干し竿と洗濯物
      const zz = north ? z - 1.4 : z + d + 1.4
      for (const px of [x + 1.2, x + w - 1.2]) B(px - 0.04, 0, zz - 0.04, px + 0.04, 1.9, zz + 0.04, 'darkWood')
      B(x + 1.2, 1.86, zz - 0.03, x + w - 1.2, 1.92, zz + 0.03, 'alu', { nocol: true })
      const cols = ['paint', 'paintY', 'contB', 'canopy', 'pumpRed']
      for (let i = 0; i < 5; i++) { const g = new THREE.PlaneGeometry(0.5 + rnd() * 0.3, 0.7 + rnd() * 0.3); g.rotateY(Math.PI / 2 + (rnd() - 0.5) * 0.3); g.translate(x + 2 + i * 1.05, 1.45, zz); level.push(cols[i % 5], g) }
    } else if (kind2 === 'plants') { // 鉢植え（玄関の脇）と郵便受け
      for (let i = 0; i < 4; i++) { const px = gate - 0.5 - i * 0.45, g = new THREE.CylinderGeometry(0.18, 0.13, 0.3, 10); g.translate(px, 0.15, pz + sgn * 0.45); level.push('contO', g); const l = new THREE.SphereGeometry(0.22, 8, 6); l.translate(px, 0.45, pz + sgn * 0.45); level.push('hedge', l) }
      B(gate + gw + 0.5, 0, fy - 0.1, gate + gw + 0.58, 1.15, fy - 0.02, 'darkWood'); B(gate + gw + 0.38, 1.1, fy - 0.16, gate + gw + 0.72, 1.3, fy + 0.04, 'pumpRed', { nocol: true })
    } else if (kind2 === 'carport') { // 車庫（トタン屋根の下に軽トラ大の黒い影と工具箱）
      const cx = x + w + 0.2, cz = north ? z : z + d - 3.6
      for (const [px, pz2] of [[cx, cz], [cx + 3, cz], [cx, cz + 3.6], [cx + 3, cz + 3.6]]) B(px - 0.07, 0, pz2 - 0.07, px + 0.07, 2.4, pz2 + 0.07, 'alu')
      B(cx - 0.2, 2.4, cz - 0.2, cx + 3.2, 2.5, cz + 3.8, 'iron')
      B(cx + 0.2, 0, cz + 0.4, cx + 2.8, 0.02, cz + 3.2, 'black', { nocol: true }); level.crate(cx + 2.4, cz + 0.4, 0.6)
      chop.push([cx - 1, cz - 1, cx + 4, cz + 5])
    } else if (kind2 === 'porch') { // 玄関脇の物置（トタン）と室外機の台
      const bx = x + w - 3 - (north ? 0 : w - 6), bz = north ? z - 2.2 : z + d + 0.6
      B(bx, 0, bz, bx + 2.2, 1.9, bz + 1.5, rnd() < 0.5 ? 'iron' : 'tinCream'); level.slab(bx + 1.1, 2.02, bz + 0.75, 2.6, 0.06, 1.9, 0, 0.07, 'ironRust')
      prop('propane_tank', x + 1.2, 0, north ? z + d + 0.5 : z - 0.5, 0, ['y', 1.1], true)
    }
    if (rnd() < 0.55) prop('exterior_aircon_unit', x + w + 0.35, 0.35, z + 1 + rnd() * (d - 2), Math.PI / 2, ['y', 0.62], true)
    if (rnd() < 0.4) prop('metal_trash_can', x - 0.5, 0, north ? z + d + 0.5 : z - 0.5, 0, ['y', 0.8], true)
  }
  level.curtM = curt0; level.glassMat = glass0; level.frameKey = null
  // カーテンは窓ごとの小さな板で描画呼び出しが増えるので、色ごとに1つへまとめる
  for (const cm of curts) {
    const list = []; scene.traverse(o => { if (o.isMesh && o.material === cm) list.push(o) })
    if (!list.length) continue
    const gs = list.map(o => { o.updateMatrixWorld(true); const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g.index ? g.toNonIndexed() : g })
    for (const o of list) o.parent.remove(o)
    scene.add(new THREE.Mesh(mergeGeometries(gs), cm))
  }
  // 通りの電柱代わりの街灯
  for (let x = -54; x <= 54; x += 18) { if (Math.abs(x) < 4) continue; prop('street_lamp_01', x, 0, STREET_Z - 3.4, 0, ['y', 4.4]) }
}

// 2階建てのアパート（外階段・廊下・どの部屋にも入れる）。z 側（北）が廊下
export function apartment(level, x, z, w, d, m) {
  const B = level.B.bind(level), t = 0.18, y1 = 3.05, h2 = 5.95, n = Math.floor(w / 3.0), u = w / n
  B(x, 0, z, x + w, 0.2, z + d, 'slab')
  for (const [y0, y2] of [[0.2, y1], [y1 + 0.2, h2]]) {
    const doors = [], winsN = [], winsS = []
    for (let i = 0; i < n; i++) {
      doors.push({ a: x + i * u + 0.5, b: x + i * u + 1.5, y0, y1: y0 + 2.0 })
      winsN.push({ a: x + i * u + 1.9, b: x + i * u + 2.7, y0: y0 + 0.9, y1: y0 + 1.95 }); winsS.push({ a: x + i * u + 0.6, b: x + i * u + 2.4, y0: y0 + 0.9, y1: y0 + 2.0 })
    }
    level.wallX(x, x + w, z, y0, y2, t, m, [...doors, ...winsN]); level.wallX(x, x + w, z + d, y0, y2, t, m, winsS)
    level.wallZ(z, z + d, x, y0, y2, t, m, [{ a: z + 2, b: z + 3.4, y0: y0 + 0.9, y1: y0 + 2.0 }]); level.wallZ(z, z + d, x + w, y0, y2, t, m)
    for (const o of winsN) level.windowX(o, z); for (const o of winsS) level.windowX(o, z + d); for (const o of doors) level.doorFrameX(o, z)
    for (const o of [{ a: z + 2, b: z + 3.4, y0: y0 + 0.9, y1: y0 + 2.0 }]) level.windowZ(o, x)
  }
  B(x - 0.15, y1, z - 0.15, x + w + 0.15, y1 + 0.2, z + d + 0.15, 'slab') // 2階の床
  B(x - 0.3, h2, z - 0.3, x + w + 0.3, h2 + 0.22, z + d + 0.3, 'ironRust') // 屋上（平らな屋根）
  B(x - 0.3, h2 + 0.22, z - 0.3, x + w + 0.3, h2 + 0.6, z - 0.2, 'ironRust', { nocol: true }); B(x - 0.3, h2 + 0.22, z + d + 0.2, x + w + 0.3, h2 + 0.6, z + d + 0.3, 'ironRust', { nocol: true })
  // 2階の廊下（北側）と手すり、東の外階段
  B(x - 0.15, y1, z - 1.5, x + w + 0.15, y1 + 0.2, z, 'slab')
  B(x - 0.15, y1 + 0.2, z - 1.55, x + w + 0.15, y1 + 1.1, z - 1.45, 'steelGreen')
  B(x - 0.15, y1 + 0.2, z - 1.55, x - 0.05, y1 + 1.1, z, 'steelGreen')
  level.stairs(x + w + 4.8, x + w + 0.05, z - 1.3, z - 0.1, 3.2, 'steelGreen')
  B(x + w + 0.1, y1 + 0.2, z - 1.55, x + w + 4.9, y1 + 0.28, z - 1.45, null, { vis: false, kind: 'solid' })
  for (let i = 0; i < n; i++) level.crate(x + i * u + 2, z + d - 0.7, 0.8, 0.2)
  level.crate(x + 1, z + d - 0.7, 0.8, y1 + 0.2)
  level.styroStack(x + 4, z + d - 0.7, 1)
  ;(level.houses || (level.houses = [])).push({ x, z, w, d })
}


// ---------- 戸建て（1〜2階・棟の向きを選べる）。2階へは家の中の階段。level.house に無い形をここで作る ----------
// o: { floors: 1|2, ridge: 'x'|'z' }。棟 x は通りと平行、z は通りと直角。戻り値: 窓の一覧（汚れの筋に使う）
export const HOUSE = { y0: 0.35, h1: 3.1, slab: 0.3, h2: 3.0, doorW: 1.5, doorH: 2.3 }
export function house2(level, x, z, w, d, wallMat, roof, rh, o) {
  // 体（1.75m）に対して広く（2026-11-23 本人「体のサイズに対して家が小さい」）: 天井 1階 3.1m・2階 3.0m、戸口 1.5×2.3m（前は 2.75m・1.4×2.0m）
  const B = level.B.bind(level), t = 0.18, H = HOUSE, y0 = H.y0, F = o.floors
  const f2 = y0 + H.h1 + H.slab                // 2階の床の上面
  const top = F === 1 ? y0 + H.h1 : f2 + H.h2  // 天井
  const base = i => i === 0 ? y0 : f2
  B(x, 0, z, x + w, y0, z + d, 'darkWood') // 1階の床
  const dN = { a: x + 1.5, b: x + 1.5 + H.doorW, y0, y1: y0 + H.doorH }, dS = { a: x + w - 3.2, b: x + w - 3.2 + H.doorW, y0, y1: y0 + H.doorH }
  const sL = Math.min(5.6, w * 0.44), sx1 = x + 0.35 + sL // 階段: 南の壁ぞいを西から東へ上がる
  const px = x + Math.round(w * 0.52 * 10) / 10 // 1階の仕切り（西が居間、東が台所）
  const wins = { N: [], S: [], W: [], E: [] }
  const at = (list, a, b) => list.map(q => ({ ...q, y0: a, y1: b }))
  for (let f = 0; f < F; f++) {
    const yb = base(f), yt = f === 0 ? (F === 2 ? f2 : top) : top, a = yb + 0.95, b = yb + 2.35
    let wN, wS, wW, wE
    if (f === 0) {
      wN = [{ a: dN.b + 0.6, b: Math.min(dN.b + 2.4, px - 0.45) }, { a: x + w - 3.8, b: x + w - 1.9 }].filter(q => q.b - q.a > 0.9 && q.b < x + w - 0.5 && !(q.a < px + 0.3 && q.b > px - 0.3))
      wS = (F === 1 ? [{ a: x + 1.3, b: x + 3.1 }] : []).concat(x + w - 6.2 > sx1 + 0.5 || F === 1 ? [{ a: x + w - 6.2, b: x + w - 4.4 }] : []).filter(q => q.b < dS.a - 0.4 && !(q.a < px + 0.3 && q.b > px - 0.3))
      wW = [{ a: z + 1.4, b: z + 3.2 }]; wE = d > 8 ? [{ a: z + d - 3.6, b: z + d - 2.0 }] : []
    } else {
      wN = [{ a: x + 1.4, b: x + 3.2 }, { a: x + w - 3.6, b: x + w - 1.8 }]; wS = [{ a: x + w - 3.6, b: x + w - 1.8 }].concat(w > 10.5 ? [{ a: x + 1.4, b: x + 3.0 }] : [])
      wW = [{ a: z + 1.4, b: z + 3.2 }].concat(d > 8 ? [{ a: z + d - 3.2, b: z + d - 1.8 }] : []); wE = [{ a: z + 1.4, b: z + 3.2 }]
    }
    wN = at(wN, a, b); wS = at(wS, a, b); wW = at(wW, a, b); wE = at(wE, a, b)
    const wm = f === 1 && o.band === 'switch' ? 'stuccoCream' : wallMat // 2階だけ素材を替える家
    level.wallX(x, x + w, z, yb, yt, t, wm, f === 0 ? [dN, ...wN] : wN)
    level.wallX(x, x + w, z + d, yb, yt, t, wm, f === 0 ? [dS, ...wS] : wS)
    level.wallZ(z, z + d, x, yb, yt, t, wm, wW); level.wallZ(z, z + d, x + w, yb, yt, t, wm, wE)
    // 内装の壁（外壁の材質が室内に出て、黒いトタンの家は中まで黒かった 2026-11-23）: 窓と戸口の穴は同じ
    const ins = { nocol: true }, ym = yt - (f === 0 && F === 2 ? H.slab : 0)
    level.wallX(x + 0.1, x + w - 0.1, z + 0.1, yb, ym, 0.02, 'plaster', f === 0 ? [dN, ...wN] : wN, ins); level.wallX(x + 0.1, x + w - 0.1, z + d - 0.1, yb, ym, 0.02, 'plaster', f === 0 ? [dS, ...wS] : wS, ins)
    level.wallZ(z + 0.1, z + d - 0.1, x + 0.1, yb, ym, 0.02, 'plaster', wW, ins); level.wallZ(z + 0.1, z + d - 0.1, x + w - 0.1, yb, ym, 0.02, 'plaster', wE, ins)
    for (const q of wN) { level.windowX(q, z); level.curtainX(q, z + 0.12) }
    for (const q of wS) { level.windowX(q, z + d); level.curtainX(q, z + d - 0.12) }
    for (const q of wW) { level.windowZ(q, x); level.curtainZ(q, x + 0.12) }
    for (const q of wE) { level.windowZ(q, x + w); level.curtainZ(q, x + w - 0.12) }
    wins.N.push(...wN); wins.S.push(...wS); wins.W.push(...wW); wins.E.push(...wE)
  }
  level.doorFrameX(dN, z); level.doorFrameX(dS, z + d)
  for (const [q, zz, sg] of [[dN, z, 1], [dS, z + d, -1]]) { // 半分開いた引き戸
    const half = (q.b - q.a) / 2
    B(q.a + 0.07, q.y0, zz + sg * 0.02, q.a + 0.07 + half, q.y1 - 0.08, zz + sg * 0.06, 'alu', { nocol: true })
    B(q.a + 0.12, q.y0 + 0.2, zz + sg * 0.065, q.a + 0.02 + half, q.y1 - 0.16, zz + sg * 0.07, null, { nocol: true })
    level.glass2(q.a + 0.12, q.y0 + 0.25, zz + sg * 0.07, half - 0.12, q.y1 - q.y0 - 0.45)
  }
  // ---- 1階の中: 仕切り（真ん中に口）、居間（ソファ・低い机・テレビ台）、台所（流し台・冷蔵庫・食卓）
  const yIn = F === 2 ? f2 - H.slab : top
  level.wallZ(z, z + d - 2.0, px, y0, yIn, 0.12, 'plaster', [{ a: z + d / 2 - 1.6, b: z + d / 2 - 0.3, y0, y1: y0 + H.doorH }])
  const box = (x0, y0b, z0, x1, y1, z1, m, col = true) => B(x0, y0b, z0, x1, y1, z1, m, col ? {} : { nocol: true })
  // 居間
  box(x + 0.2, y0, z + 1.1, x + 1.05, y0 + 0.45, z + 3.5, 'fabricBlue'); box(x + 0.2, y0 + 0.45, z + 1.1, x + 0.45, y0 + 0.9, z + 3.5, 'fabricBlue', false) // ソファ（背もたれは見た目だけ）
  box(x + 1.7, y0, z + 1.7, x + 2.6, y0 + 0.42, z + 2.9, 'darkWood') // 低い机
  box(px - 0.55, y0, z + 1.2, px - 0.1, y0 + 0.55, z + 3.4, 'darkWood'); box(px - 0.3, y0 + 0.55, z + 1.5, px - 0.2, y0 + 1.25, z + 3.1, 'tv', false) // テレビ台とテレビ
  if (F === 1) { box(x + 0.2, y0, z + d - 2.2, x + 0.7, y0 + 1.9, z + d - 0.4, 'darkWood') } // たんす
  // 台所
  const kx1 = x + w - 0.15
  box(kx1 - 0.65, y0, z + 0.3, kx1, y0 + 0.9, z + 3.4, 'counter'); box(kx1 - 0.65, y0 + 0.9, z + 0.3, kx1, y0 + 0.94, z + 3.4, 'counterTop', false)
  box(kx1 - 0.75, y0, z + 3.5, kx1, y0 + 1.8, z + 4.2, 'whiteGoods') // 冷蔵庫
  { const cx = (px + kx1) / 2 - 0.4, cz = z + Math.min(d / 2, 3.4)
    box(cx - 0.7, y0, cz - 0.45, cx + 0.7, y0 + 0.75, cz + 0.45, null)
    box(cx - 0.7, y0 + 0.7, cz - 0.45, cx + 0.7, y0 + 0.75, cz + 0.45, 'darkWood', false)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + sx * 0.62 - 0.03, y0, cz + sz * 0.38 - 0.03, cx + sx * 0.62 + 0.03, y0 + 0.7, cz + sz * 0.38 + 0.03, 'darkWood', false)
    for (const sz of [-1, 1]) for (const sx of [-0.35, 0.35]) { box(cx + sx - 0.2, y0 + 0.42, cz + sz * 0.75 - 0.2, cx + sx + 0.2, y0 + 0.46, cz + sz * 0.75 + 0.2, 'darkWood', false); box(cx + sx - 0.2, y0, cz + sz * 0.75 - 0.2, cx + sx - 0.16, y0 + 0.42, cz + sz * 0.75 - 0.16, 'darkWood', false) } }
  // 細かい物（見た目だけ・束ねて描く）: じゅうたん・ソファのひじ掛けとクッション・本棚・吊り戸棚・流し・コンロ・天井の明かり・額・幅木
  const deco = (x0, y0b, z0, x1, y1, z1, m) => B(x0, y0b, z0, x1, y1, z1, m, { nocol: true })
  const rugs = ['rugRed', 'rugBeige', 'rugGreen'], rug = rugs[Math.abs(Math.round(x * 7 + z * 3)) % 3]
  deco(x + 1.3, y0, z + 1.0, px - 0.8, y0 + 0.012, z + 3.6, rug)
  deco(x + 0.2, y0 + 0.45, z + 0.95, x + 1.05, y0 + 0.7, z + 1.15, 'fabricBlue'); deco(x + 0.2, y0 + 0.45, z + 3.45, x + 1.05, y0 + 0.7, z + 3.65, 'fabricBlue')
  for (const cz of [z + 1.7, z + 2.9]) deco(x + 0.45, y0 + 0.45, cz - 0.45, x + 0.65, y0 + 0.85, cz + 0.45, 'fabricLight')
  if (d > 8.5) { const bz0 = z + 3.9, bz1 = Math.min(z + 5.5, z + d - 2.2); if (bz1 - bz0 > 1) { deco(x + 0.15, y0, bz0, x + 0.5, y0 + 1.8, bz1, 'darkWood'); for (const yy of [0.55, 1.15]) for (let k = 0; k < 4; k++) deco(x + 0.18, y0 + yy, bz0 + 0.1 + k * (bz1 - bz0 - 0.2) / 4, x + 0.45, y0 + yy + 0.3 + (k % 2) * 0.05, bz0 + 0.1 + (k + 0.8) * (bz1 - bz0 - 0.2) / 4, k % 2 ? 'frameArt' : 'frameArt2'); B(x + 0.15, y0, bz0, x + 0.5, y0 + 1.8, bz1, null, { vis: false }) } }
  deco(kx1 - 0.4, y0 + 1.55, z + 0.3, kx1, y0 + 2.25, z + 3.4, 'counter') // 吊り戸棚
  deco(kx1 - 0.55, y0 + 0.9, z + 0.7, kx1 - 0.15, y0 + 0.95, z + 1.5, 'stove'); deco(kx1 - 0.55, y0 + 0.9, z + 2.2, kx1 - 0.15, y0 + 0.95, z + 3.0, 'alu') // コンロと流し
  for (const [cx, cz] of [[(x + px) / 2, z + d / 2 - 0.5], [(px + kx1) / 2, z + d / 2 - 0.5]]) deco(cx - 0.25, (F === 2 ? f2 - H.slab : top) - 0.06, cz - 0.25, cx + 0.25, (F === 2 ? f2 - H.slab : top) - 0.01, cz + 0.25, 'lamp')
  deco(px - 0.07, y0 + 1.5, z + 0.5, px - 0.06, y0 + 2.1, z + 1.3, 'frameArt') // 額（居間側）
  for (const sd of [-1, 1]) { deco(px + sd * 0.06 - (sd < 0 ? 0.02 : 0), y0, z, px + sd * 0.06 + (sd > 0 ? 0.02 : 0), y0 + 0.08, z + d / 2 - 1.6, 'darkWood'); deco(px + sd * 0.06 - (sd < 0 ? 0.02 : 0), y0, z + d / 2 - 0.3, px + sd * 0.06 + (sd > 0 ? 0.02 : 0), y0 + 0.08, z + d - 2.0, 'darkWood') }
  if (F === 2) {
    // 2階の床（階段の上だけ穴）と階段・手すり
    const e = o.band === 'thin' ? 0.05 : 0, sm = o.band === 'thin' ? 'kerb' : 'planks'
    B(x - e, f2 - H.slab, z - e, x + w + e, f2, z + d - 1.6, sm)
    B(sx1, f2 - H.slab, z + d - 1.6, x + w + e, f2, z + d + e, sm)
    B(x - e, f2 - H.slab, z + d - 1.6, x + 0.35, f2, z + d + e, sm)
    if (o.band === 'awning') for (const [zz, sg] of [[z, -1], [z + d, 1]]) { level.slab(x + w / 2, f2 - 0.2, zz + sg * 0.4, w + 0.4, 0.07, 0.95, sg * 0.14, 0, 'roofBlack'); B(x + 0.1, f2 - 0.4, zz + sg * 0.78 - 0.04, x + w - 0.1, f2 - 0.2, zz + sg * 0.78 + 0.04, null, { vis: false }) }
    level.stairs(x + 0.35, sx1, z + d - 1.55, z + d - 0.25, f2, 'planks')
    B(x + 0.35, f2, z + d - 1.65, sx1, f2 + 0.95, z + d - 1.6, 'darkWood', { nocol: true }); B(x + 0.35, f2, z + d - 1.65, sx1, f2 + 1.0, z + d - 1.6, null, { kind: 'edge', vis: false, tag: 'fenced' }) // 階段の穴の手すり（人は止める・爆弾は越える）
    // 2階: 寝室2つ（真ん中で仕切る。南の廊下側は開けて、階段から入れる）
    const mx = x + Math.round(w * 0.5 * 10) / 10
    level.wallZ(z, z + d - 2.0, mx, f2, top, 0.12, 'plaster')
    const bed = (bx0, bz0, bx1, bz1, hz) => { box(bx0, f2, bz0, bx1, f2 + 0.5, bz1, 'sheet'); box(bx0, f2 + 0.5, hz - 0.04, bx1, f2 + 1.05, hz + 0.04, 'darkWood', false); box(bx0 + 0.1, f2 + 0.5, hz + (hz < bz1 ? 0.1 : -0.5), bx1 - 0.1, f2 + 0.62, hz + (hz < bz1 ? 0.5 : -0.1), 'whiteGoods', false) }
    bed(x + 0.2, z + 0.3, x + 1.3, z + 2.4, z + 0.34) // 西の寝室
    box(mx - 0.75, f2, z + 0.3, mx - 0.12, f2 + 1.9, z + 1.6, 'darkWood') // たんす
    bed(x + w - 1.3, z + 0.3, x + w - 0.2, z + 2.4, z + 0.34) // 東の寝室
    box(mx + 0.15, f2, z + 0.3, mx + 1.4, f2 + 0.75, z + 0.9, 'darkWood') // 机
    // 掛け布団・ベッド脇の小机とスタンド・じゅうたん・額・天井の明かり
    deco(x + 0.25, f2 + 0.5, z + 0.95, x + 1.25, f2 + 0.6, z + 2.35, 'blanket'); deco(x + w - 1.25, f2 + 0.5, z + 0.95, x + w - 0.25, f2 + 0.6, z + 2.35, 'blanket2')
    for (const [nx0, nx1] of [[x + 1.4, x + 1.9], [x + w - 1.9, x + w - 1.4]]) { box(nx0, f2, z + 0.3, nx1, f2 + 0.55, z + 0.8, 'darkWood'); deco((nx0 + nx1) / 2 - 0.08, f2 + 0.55, z + 0.47, (nx0 + nx1) / 2 + 0.08, f2 + 0.85, z + 0.63, 'lamp') }
    deco(x + 1.6, f2, z + 2.8, mx - 0.6, f2 + 0.012, z + Math.min(d - 2.6, 5.2), rugs[(rugs.indexOf(rug) + 1) % 3]); deco(mx + 0.6, f2, z + 2.8, x + w - 1.6, f2 + 0.012, z + Math.min(d - 2.6, 5.2), rugs[(rugs.indexOf(rug) + 2) % 3])
    deco(mx - 0.07, f2 + 1.4, z + 2.6, mx - 0.06, f2 + 2.0, z + 3.5, 'frameArt2'); deco(mx + 0.06, f2 + 1.4, z + 3.2, mx + 0.07, f2 + 1.9, z + 3.9, 'frameArt')
    for (const cx of [(x + mx) / 2, (mx + x + w) / 2]) deco(cx - 0.25, top - 0.06, z + d / 2 - 1.5, cx + 0.25, top - 0.01, z + d / 2 - 1.0, 'lamp')
  }
  B(x - 0.6, top, z - 0.6, x + w + 0.6, top + 0.2, z + d + 0.6, 'darkWood', { vis: false }) // 天井（屋根の当たり）
  B(x + 0.1, top - 0.06, z + 0.1, x + w - 0.1, top, z + d - 0.1, 'cedar', { nocol: true }) // 見える天井板
  // 瓦屋根（切妻）
  const along = o.ridge, half = (along === 'x' ? d : w) / 2 + 0.7, ang = Math.atan2(rh, half), len = Math.hypot(rh, half), cy = top + rh / 2 + 0.05
  ;(level.world.roofs || (level.world.roofs = [])).push({ x0: x - 0.7, x1: x + w + 0.7, z0: z - 0.7, z1: z + d + 0.7, base: top, rh, ridge: along, c: along === 'x' ? z + d / 2 : x + w / 2, half }) // 屋根の当たり（WRECK ISLE）
  if (along === 'x') {
    level.slab(x + w / 2, cy, z + d / 2 - half / 2, w + 1.4, 0.12, len, -ang, 0, roof); level.slab(x + w / 2, cy, z + d / 2 + half / 2, w + 1.4, 0.12, len, ang, 0, roof)
    B(x - 0.7, top + rh - 0.02, z + d / 2 - 0.16, x + w + 0.7, top + rh + 0.18, z + d / 2 + 0.16, roof, { nocol: true })
    for (const xx of [x, x + w]) { const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.1, 0); sh.lineTo(d / 2 + 0.1, 0); sh.lineTo(0, rh); const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(xx - t / 2, top, z + d / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5); level.push(o.band === 'switch' ? 'stuccoCream' : wallMat, g) }
  } else {
    level.slab(x + w / 2 - half / 2, cy, z + d / 2, len, 0.12, d + 1.4, 0, ang, roof); level.slab(x + w / 2 + half / 2, cy, z + d / 2, len, 0.12, d + 1.4, 0, -ang, roof)
    B(x + w / 2 - 0.16, top + rh - 0.02, z - 0.7, x + w / 2 + 0.16, top + rh + 0.18, z + d + 0.7, roof, { nocol: true })
    for (const zz of [z, z + d]) { const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.1, 0); sh.lineTo(w / 2 + 0.1, 0); sh.lineTo(0, rh); const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(x + w / 2, top, zz - t / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5); level.push(wallMat, g) }
  }
  // 基礎の帯と雨どい
  B(x - 0.02, 0, z - 0.02, x + w + 0.02, 0.36, z, 'kerb', { nocol: true }); B(x - 0.02, 0, z + d, x + w + 0.02, 0.36, z + d + 0.02, 'kerb', { nocol: true }); B(x - 0.02, 0, z, x, 0.36, z + d, 'kerb', { nocol: true }); B(x + w, 0, z, x + w + 0.02, 0.36, z + d, 'kerb', { nocol: true })
  const eave = top + 0.05 - 0.7 * (rh / half) * 0.98
  for (const sg of [-1, 1]) {
    // 雨どいは軒先、縦樋は壁ぞいの角に降ろし、横の管でつなぐ
    const ex = eave - 0.2
    if (along === 'x') {
      const zz = sg < 0 ? z - 0.77 : z + d + 0.77, wz = sg < 0 ? z - 0.12 : z + d + 0.12, wx = sg < 0 ? x - 0.12 : x + w + 0.12
      const gt = new THREE.CylinderGeometry(0.06, 0.06, w + 1.4, 10); gt.rotateZ(Math.PI / 2); gt.translate(x + w / 2, ex, zz); level.push('alu', gt)
      const cn = new THREE.CylinderGeometry(0.04, 0.04, Math.abs(zz - wz), 8); cn.rotateX(Math.PI / 2); cn.translate(wx, ex - 0.05, (zz + wz) / 2); level.push('alu', cn)
      const dp = new THREE.CylinderGeometry(0.04, 0.04, ex - 0.05, 8); dp.translate(wx, (ex - 0.05) / 2, wz); level.push('alu', dp)
    } else {
      const xx = sg < 0 ? x - 0.77 : x + w + 0.77, wx = sg < 0 ? x - 0.12 : x + w + 0.12, wz = sg < 0 ? z - 0.12 : z + d + 0.12
      const gt = new THREE.CylinderGeometry(0.06, 0.06, d + 1.4, 10); gt.rotateX(Math.PI / 2); gt.translate(xx, ex, z + d / 2); level.push('alu', gt)
      const cn = new THREE.CylinderGeometry(0.04, 0.04, Math.abs(xx - wx), 8); cn.rotateZ(Math.PI / 2); cn.translate((xx + wx) / 2, ex - 0.05, wz); level.push('alu', cn)
      const dp = new THREE.CylinderGeometry(0.04, 0.04, ex - 0.05, 8); dp.translate(wx, (ex - 0.05) / 2, wz); level.push('alu', dp)
    }
  }
  ;(level.houses || (level.houses = [])).push({ x, z, w, d, floors: F })
  return { wins, top, f2, doors: { N: [dN], S: [dS] } }
}

export function finishGrime(level, scene, rnd) {
  const m = new THREE.MeshStandardMaterial({ color: 0x2a2219, alphaMap: grimeAtlas(rnd), transparent: true, opacity: 1, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  const mesh = new THREE.Mesh(mergeGeometries(level.grimeGeos.map(g => g.index ? g.toNonIndexed() : g)), m); mesh.renderOrder = 2; mesh.receiveShadow = true; scene.add(mesh)
}
// ---------- 壁の汚れ（泥はね・軒下と窓下の雨だれ・角の黒ずみ）。1枚の小さな絵に描き、薄い板を壁に貼って1回で描く ----------
let _grimeTex = null
export function grimeAtlas(rnd) {
  if (_grimeTex) return _grimeTex
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W
  const g = c.getContext('2d'), img = g.createImageData(W, W), px = img.data
  const put = (x, y, v) => { const i = (y * W + x) * 4; const o = px[i]; const n = Math.max(o, Math.min(255, v * 255)) | 0; px[i] = px[i + 1] = px[i + 2] = n; px[i + 3] = 255 }
  const noise = (a) => Math.sin(a * 0.11) * 0.5 + Math.sin(a * 0.27 + 1.3) * 0.3 + Math.sin(a * 0.61 + 2.1) * 0.2
  // A: 泥はね（下ほど濃く、縁はゆるく波打つ。縦縞にならないよう低い周波数だけ）y 0..127
  for (let x = 0; x < W; x++) { const hgt = 52 + 30 * noise(x * 0.35) + 12 * Math.sin(x * 0.021 + 2); for (let y = 0; y < 128; y++) { const up = (127 - y); if (up > hgt) continue; const t = 1 - up / hgt; put(x, y, Math.min(1, t * t * 1.2 + (rnd() < 0.03 ? 0.15 : 0)) * (0.85 + 0.15 * rnd())) } }
  // B: 雨だれの筋（上が濃く下へ薄れる）y 128..383
  for (let k = 0; k < 70; k++) { const x0 = Math.floor(rnd() * W), wd = 1 + Math.floor(rnd() * 3), len = 60 + Math.floor(rnd() * 196), a = 0.4 + rnd() * 0.6; for (let y = 0; y < len; y++) { const t = 1 - y / len; for (let dx = 0; dx < wd; dx++) put((x0 + dx) % W, 128 + y, a * t * t * (0.7 + 0.3 * rnd())) } }
  for (let x = 0; x < W; x++) for (let y = 0; y < 40; y++) put(x, 128 + y, (1 - y / 40) * (0.35 + 0.25 * noise(x * 1.3))) // 軒の影の帯
  // C: 角の黒ずみ（左が濃く右へ薄れる。上下にむらを付ける）y 384..511
  for (let y = 0; y < 128; y++) { const m = 0.55 + 0.45 * noise(y * 1.7); for (let x = 0; x < W; x++) { const t = 1 - x / W; put(x, 384 + y, t * t * 1.1 * m * (0.75 + 0.25 * rnd())) } }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4
  return (_grimeTex = tex)
}
// 家1軒ぶんの汚れの板を geos に足す。wins: 窓（面ごと）、doors: 戸口（泥はねを避ける）、top: 壁の上端
export function grime(geos, rnd, x, z, w, d, top, wins, doors, lv = 3, off = 0.105) {
  if (lv <= 0) return
  const mudH = 0.3 + rnd() * 0.25 // 泥はねの高さ（下 30〜55cm）
  const OFF = off
  // 面: [向き, 面の位置, 横の始点, 横の長さ]（横は面に沿った座標）
  const faces = [
    { n: 'S', rot: 0, px: (u) => [x + u, z + d + OFF], len: w, o: x }, { n: 'N', rot: Math.PI, px: (u) => [x + u, z - OFF], len: w, o: x },
    { n: 'E', rot: Math.PI / 2, px: (u) => [x + w + OFF, z + u], len: d, o: z }, { n: 'W', rot: -Math.PI / 2, px: (u) => [x - OFF, z + u], len: d, o: z },
  ]
  const plane = (f, u0, u1, y0, y1, kind) => { // u は面の始点からの距離
    const wd = u1 - u0, hh = y1 - y0; if (wd <= 0.05 || hh <= 0.05) return
    const g = new THREE.PlaneGeometry(wd, hh), [cx, cz] = f.px((u0 + u1) / 2)
    const uv = g.attributes.uv, ua = rnd() * 0.5, uw = Math.min(1, wd / 6)
    let v0, v1
    if (kind === 'mud') { v0 = 0.75; v1 = 0.75 + 0.25 * Math.min(1, hh / 0.85) } else if (kind === 'streak') { v0 = 0.26; v1 = 0.74 } else { v0 = 0.0; v1 = 0.25 }
    for (let i = 0; i < uv.count; i++) { const uu = uv.getX(i), vv = uv.getY(i); uv.setXY(i, kind === 'corner' ? ((f.n === 'S' || f.n === 'W') ? uu : 1 - uu) : ua + uu * uw, v0 + vv * (v1 - v0)) }
    g.rotateY(f.rot); g.translate(cx, (y0 + y1) / 2, cz); geos.push(g)
  }
  for (const f of faces) {
    // 泥はね: 戸口をよける
    const gaps = (doors[f.n] || []).map(q => [q.a - f.o, q.b - f.o]).sort((a, b) => a[0] - b[0])
    let u = 0
    for (const [a, b] of gaps) { plane(f, u, a, 0.36, 0.36 + mudH, 'mud'); u = b }
    plane(f, u, f.len, 0.36, 0.36 + mudH, 'mud')
    if (lv < 2) continue
    // 軒の下: 細い影の帯だけ（面全体は覆わない）
    plane(f, 0.1, f.len - 0.1, top - 0.35, top - 0.02, 'streak')
    // 窓の下の筋: 窓の両端から細く
    for (const q of wins[f.n] || []) { const a = q.a - f.o, b = q.b - f.o; plane(f, a + 0.05, a + 0.5, Math.max(0.5, q.y0 - 0.9), q.y0, 'streak'); plane(f, b - 0.5, b - 0.05, Math.max(0.5, q.y0 - 0.9), q.y0, 'streak') }
    if (lv < 3) continue
    // 角の黒ずみ（面の両端）
    plane(f, 0, 0.5, 0.36, top - 0.1, 'corner'); const g2 = geos.length
    plane(f, f.len - 0.5, f.len, 0.36, top - 0.1, 'corner'); const gg = geos[geos.length - 1]; if (gg) { const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)) }
  }
}

// ---------- 北岸の畑と作業小屋 ----------
function farm(level, scene, world, B, prop, rnd, chop, grass) {
  // 畑の畝（見た目だけ。畝の上を草と作物が覆う）
  for (const [x0, z0, w, d] of [[-50, 156, 16, 9], [-34, 156, 12, 9], [10, 157, 14, 8], [26, 157, 10, 8]]) {
    chop.push([x0 - 1, z0 - 1, x0 + w + 1, z0 + d + 1])
    for (let r = 0; r < Math.floor(d / 1.5); r++) { const zz = z0 + 0.6 + r * 1.5; B(x0, 0, zz, x0 + w, 0.2, zz + 0.7, 'soil', { nocol: true }) }
    for (let x = x0 + 0.3; x < x0 + w; x += 0.5) for (let r = 0; r < Math.floor(d / 1.5); r++) grass.push({ x: x + rnd() * 0.2, z: z0 + 0.95 + r * 1.5 + (rnd() - 0.5) * 0.2, s: 0.35 + rnd() * 0.2, k: 'crop', y: 0.2 })
  }
  // 作業小屋（鉄板の壁・片流れ。中に入れる）。燃料のドラム缶が置いてある
  const x = -19, z = 156, w = 10, d = 6.5, h = 3.2
  chop.push([x - 2, z - 2, x + w + 2, z + d + 2])
  B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
  level.wallX(x, x + w, z, 0, h, 0.15, 'iron', [{ a: x + 2.4, b: x + 5.6, y0: 0, y1: 2.5 }])
  level.wallX(x, x + w, z + d, 0, h, 0.15, 'iron', [{ a: x + 7, b: x + 8.2, y0: 1.0, y1: 1.9 }])
  level.wallZ(z, z + d, x, 0, h, 0.15, 'iron', [{ a: z + 2, b: z + 3.2, y0: 0, y1: 2.1 }])
  level.wallZ(z, z + d, x + w, 0, h, 0.15, 'iron')
  B(x - 0.5, h, z - 0.7, x + w + 0.5, h + 0.18, z + d + 0.5, 'ironRust')
  for (const [dx, dz] of [[1.2, 4.4], [2.2, 4.8], [8.4, 4.8], [8.8, 3.8]]) level.drum(x + dx, z + dz)
  level.crate(x + 4, z + 5.4, 1.0); level.crate(x + 5.1, z + 5.4, 1.0); level.crate(x + 4.5, z + 5.4, 0.9, 0.85)
  // 前に積んだ干し草（丸いかたまり）と軽トラの跡の砂利
  for (const [hx, hz] of [[-23, 165], [-21.4, 166.2], [20, 165]]) { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 18); g.rotateZ(Math.PI / 2); g.translate(hx, 0.75, hz); level.push('hay', g); col(world, hx - 0.6, 0, hz - 0.75, hx + 0.6, 1.5, hz + 0.75) }
}

// ---------- 給油所（燃料のドラム缶と給油機。連鎖の起点） ----------
function gasStation(level, scene, world, B, prop, chop) {
  const rnd2 = () => { let a = 777; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 } }
  const _r = rnd2()
  const cx = 14, cz = 207
  chop.push([cx - 3, cz - 3, cx + 17, cz + 12])
  // 屋根（4本柱）。路面は舗装
  B(cx - 2, 0, cz - 2, cx + 14, 0.06, cz + 10, 'quay', { nocol: true })
  for (const [px, pz] of [[cx, cz], [cx + 9, cz], [cx, cz + 7], [cx + 9, cz + 7]]) { B(px - 0.18, 0, pz - 0.18, px + 0.18, 5.1, pz + 0.18, 'canopy'); B(px - 0.2, 0, pz - 0.2, px + 0.2, 0.9, pz + 0.2, 'blockGrey', { nocol: true }); B(px - 0.19, 1.0, pz - 0.19, px + 0.19, 1.25, pz + 0.19, 'pumpRed', { nocol: true }) }
  B(cx - 1.2, 5.1, cz - 1.2, cx + 10.2, 5.5, cz + 8.2, 'canopy')
  B(cx - 1.25, 5.1, cz - 1.25, cx + 10.25, 5.28, cz - 1.15, 'pumpRed', { nocol: true }); B(cx - 1.25, 5.1, cz + 8.15, cx + 10.25, 5.28, cz + 8.25, 'pumpRed', { nocol: true })
  for (const lx of [cx + 1.5, cx + 4.5, cx + 7.5]) for (const lz of [cz + 1.5, cz + 5.5]) B(lx - 0.6, 5.06, lz - 0.2, lx + 0.6, 5.1, lz + 0.2, 'lampPanel', { nocol: true })
  level.sign(cx + 4.5, 5.85, cz - 1.3, Math.PI, tr('西浦給油所', 'NISHIURA GAS'), 5.4, 0.9)
  // 給油機2つ（島）と、その奥のドラム缶の山
  for (const px of [cx + 2.5, cx + 6.5]) { B(px - 0.5, 0, cz + 2.8, px + 0.5, 0.2, cz + 4.4, 'kerb'); B(px - 0.3, 0.2, cz + 3.2, px + 0.3, 1.7, cz + 4.0, 'pumpRed'); B(px - 0.25, 1.1, cz + 2.98, px + 0.25, 1.5, cz + 3.2, 'black', { nocol: true }) }
  for (const [dx, dz] of [[0.4, 0.6], [1.15, 0.6], [1.9, 0.6], [0.8, 1.35], [1.55, 1.35], [1.2, 2.1]]) level.drum(cx + 11.2 + dx, cz + 4.2 + dz)
  // 店（事務所）
  const bx = cx + 10.5, bz = cz - 1.8, bw = 6, bd = 4.4
  B(bx, 0, bz, bx + bw, 0.12, bz + bd, 'slab', { nocol: true })
  level.wallX(bx, bx + bw, bz, 0, 3.0, 0.16, 'stuccoCream', [{ a: bx + 0.8, b: bx + 2.2, y0: 0, y1: 2.1 }, { a: bx + 3.2, b: bx + 5.2, y0: 0.9, y1: 2.1 }])
  level.wallX(bx, bx + bw, bz + bd, 0, 3.0, 0.16, 'stuccoCream'); level.wallZ(bz, bz + bd, bx, 0, 3.0, 0.16, 'stuccoCream'); level.wallZ(bz, bz + bd, bx + bw, 0, 3.0, 0.16, 'stuccoCream', [{ a: bz + 1.6, b: bz + 2.9, y0: 0, y1: 2.1 }])
  B(bx - 0.3, 3.0, bz - 0.5, bx + bw + 0.3, 3.15, bz + bd + 0.3, 'ironRust')
  level.crate(bx + 1, bz + 3.4, 1.0); level.crate(bx + 4.2, bz + 3.4, 0.9)
  level.vending(bx + 0.9, bz + bd + 0.5)
  grime(level.grimeGeos = level.grimeGeos || [], _r, bx, bz, bw, bd, 3.0, { N: [{ a: bx + 3.2, b: bx + 5.2, y0: 0.9 }] }, { N: [{ a: bx + 0.8, b: bx + 2.2 }], E: [{ a: bz + 1.6, b: bz + 2.9 }] })
  // 地面に給油機のあとの黒い染み
  const g = new THREE.CircleGeometry(1.6, 16); g.rotateX(-Math.PI / 2); g.translate(cx + 4.5, 0.07, cz + 5.4); level.push('black', g)
}

// ---------- 南の海岸（砂浜・桟橋・引き上げた船・海の家・流木・岩） ----------
function beach(level, scene, world, B, prop, rnd, chop) {
  // 桟橋（浜の先から海へ。横から落とせる）
  const px = 22, z0 = 231
  chop.push([px - 3, z0 - 2, px + 6, 262])
  B(px, -0.28, z0, px + 3.2, 0, z0 + 26, 'planks')
  for (let z = z0 + 1; z < z0 + 26; z += 3) for (const x of [px + 0.2, px + 3]) { const g = new THREE.CylinderGeometry(0.16, 0.18, 3.4, 10); g.translate(x, -1.7, z); level.push('darkWood', g) }
  for (const z of [z0 + 6, z0 + 14, z0 + 24]) for (const x of [px + 0.1, px + 3.1]) { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10); g.translate(x, 0.35, z); level.push('darkWood', g) }
  // 海の家（浜の小屋。前が開いている・赤白のひさし）
  const hx = -22, hz = 227, hw = 7, hd = 4.6
  chop.push([hx - 2, hz - 2, hx + hw + 3, hz + hd + 3])
  B(hx - 0.3, -0.05, hz - 0.3, hx + hw + 0.3, 0.14, hz + hd + 0.3, 'planks')
  level.wallX(hx, hx + hw, hz + hd, 0.14, 3.0, 0.14, 'cedar', [{ a: hx + 2, b: hx + 3.4, y0: 0.14, y1: 2.0 }])
  level.wallZ(hz, hz + hd, hx, 0.14, 3.0, 0.14, 'cedar'); level.wallZ(hz, hz + hd, hx + hw, 0.14, 3.0, 0.14, 'cedar', [{ a: hz + 1.2, b: hz + 2.8, y0: 1.0, y1: 1.9 }])
  level.wallX(hx, hx + hw, hz, 0.14, 1.1, 0.14, 'cedar') // 前は帳場の台だけ（上が開く）
  B(hx - 0.5, 3.0, hz - 1.6, hx + hw + 0.5, 3.14, hz + hd + 0.4, 'ironRust')
  for (let i = 0; i < 7; i++) { const g = new THREE.BoxGeometry(1.1, 0.04, 1.7); g.translate(hx - 0.1 + i * 1.12, 2.9, hz - 0.8); level.push(i % 2 ? 'paint' : 'pumpRed', g) }
  for (const [dx, dz] of [[5.4, 3.0], [6.1, 2.9], [5.6, 3.6]]) level.drum(hx + dx, hz + dz)
  level.crate(hx + 1, hz + 3.6, 1.0); level.styroStack(hx + 3.2, hz + 3.8, 3)
  // 引き上げた漁船2隻（船は見た目の形から当たりを作る）
  for (const [bx, bz, rot, col] of [[-52, 238, 0.15, 0x2a5f8f], [58, 236, -0.3, 0x8a2a1c]]) {
    const y = world.H(bx, bz) + 0.7
    const boat = fishingBoat(scene, bx, bz, rot, col, y); boat.rotation.z = 0.1
    colFromMesh(world, boat)
    const bn = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.18, 8, 14), new THREE.MeshStandardMaterial({ color: 0x2c3a2e, roughness: 0.9 })); bn.rotation.x = Math.PI / 2; bn.position.set(bx + 4, 0.2, bz + 2); scene.add(bn)
  }
  // 流木・岩・網
  for (let i = 0; i < 9; i++) {
    const x = -80 + rnd() * 160, z = 228 + rnd() * 12; if (coastD(x, z) < 6 || Math.abs(x - px - 1.6) < 4) continue
    const L = 2 + rnd() * 3, g = new THREE.CylinderGeometry(0.14, 0.2, L, 7); g.rotateZ(Math.PI / 2); g.rotateY(rnd() * 3); g.translate(x, world.H(x, z) + 0.14, z); level.push('darkWood', g)
  }
  // 浜の岩（形は丸い石を寄せた物。当たりは見た目の形から）。Poly Haven の岩の模型は 68万〜126万三角形で重いので使わない
  const rockM = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95, map: mat('seawall').map, normalMap: mat('seawall').normalMap })
  for (const [cx, cz, n] of [[-70, 236, 7], [80, 232, 6], [-4, 241, 4]]) for (let i = 0; i < n; i++) {
    const r = 0.7 + rnd() * 1.1, x = cx + (rnd() - 0.5) * 8, z = cz + (rnd() - 0.5) * 5
    if (coastD(x, z) < 2) continue
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockM); m.scale.set(1.2 + rnd() * 0.5, 0.65 + rnd() * 0.3, 1); m.rotation.set(rnd() * 0.5, rnd() * 6, rnd() * 0.5)
    m.position.set(x, world.H(x, z) + r * 0.25, z); m.castShadow = m.receiveShadow = true; scene.add(m); colFromMesh(world, m, { cell: 0.3 })
  }
  prop('ocean_buoy', px + 6, -1.9, 262, 0, ['y', 2.2])
}

// ---------- 林（木・倒木・草。待ち伏せの場所） ----------
function woods(level, scene, world, rnd, chop, free, grass) {
  const cedar = cedarGeo(), broad = broadGeo()
  const cm = new THREE.MeshStandardMaterial({ map: leafTex('cedar'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const bm = new THREE.MeshStandardMaterial({ map: leafTex('broad'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const tm = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 })
  const N = 330
  const ic = new THREE.InstancedMesh(cedar.leaves, cm, N), ict = new THREE.InstancedMesh(cedar.trunk, tm, N), ib = new THREE.InstancedMesh(broad.leaves, bm, N), ibt = new THREE.InstancedMesh(broad.trunk, tm, N)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  let a = 0, b = 0
  const trees = []
  const tryTree = (x, z, kind) => {
    if (!free(x, z, 1) || roadDist(x, z) < 5 || riverEdge(x, z) < 3.5 || coastD(x, z) < 3.5) return false
    if (world.H(x, z) < -0.3) return false
    if (trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 3.1)) return false
    const y = world.H(x, z), k = 0.95 + rnd() * 0.75
    m4.compose(v.set(x, y - 0.15, z), q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), sc.set(k, k * (0.9 + rnd() * 0.35), k))
    if (kind === 0 && a < N) { ic.setMatrixAt(a, m4); ict.setMatrixAt(a, m4); ic.setColorAt(a, col.setHSL(0.27 + rnd() * 0.05, 0.35, 0.4 + rnd() * 0.16)); a++ }
    else if (kind === 1 && b < N) { ib.setMatrixAt(b, m4); ibt.setMatrixAt(b, m4); ib.setColorAt(b, col.setHSL(0.2 + rnd() * 0.08, 0.35, 0.48 + rnd() * 0.18)); b++ }
    else return false
    trees.push([x, z])
    world.add({ min: [x - 0.13 * k, y - 1, z - 0.13 * k], max: [x + 0.13 * k, y + 3.2 * k, z + 0.13 * k], kind: 'solid', tag: 'tree' })
    return true
  }
  // 2つの林（川の両側をまたぐ）。外側は杉、内側は広葉樹が多い
  for (const o of WOODS) {
    let n = 0
    for (let i = 0; i < 2600 && n < 165; i++) {
      const x = o.x + (rnd() * 2 - 1) * o.rx, z = o.z + (rnd() * 2 - 1) * o.rz
      if (Math.hypot((x - o.x) / o.rx, (z - o.z) / o.rz) > 1) continue
      if (tryTree(x, z, rnd() < 0.55 ? 0 : 1)) n++
    }
    // 地面の草（林の床）
    for (let i = 0; i < 2300; i++) {
      const x = o.x + (rnd() * 2 - 1) * o.rx * 1.05, z = o.z + (rnd() * 2 - 1) * o.rz * 1.05
      if (Math.hypot((x - o.x) / o.rx, (z - o.z) / o.rz) > 1.05 || roadDist(x, z) < 3.6 || riverEdge(x, z) < 1.5 || coastD(x, z) < 7 || !free(x, z, 0)) continue
      grass.push({ x, z, s: 0.55 + rnd() * 0.85, k: rnd() < 0.3 ? 'tall' : 'grass' })
    }
    // 倒木（隠れる所）
    const logM = new THREE.MeshStandardMaterial({ color: 0x5a4838, roughness: 1, map: mat('darkWood').map })
    for (let i = 0, n2 = 0; i < 80 && n2 < 5; i++) {
      const x = o.x + (rnd() * 2 - 1) * o.rx * 0.8, z = o.z + (rnd() * 2 - 1) * o.rz * 0.9
      if (roadDist(x, z) < 6 || riverEdge(x, z) < 6 || trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 2.6)) continue
      const r = rnd() * 3.1, L = 4 + rnd() * 3, y = world.H(x, z)
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, L, 10), logM); lg.rotation.z = Math.PI / 2; lg.rotation.y = r; lg.position.set(x, y + 0.3, z); lg.castShadow = lg.receiveShadow = true; scene.add(lg)
      colFromMesh(world, lg, { cell: 0.25 }) // 倒木の当たりは見た目の形から（細かい升目）
      trees.push([x, z]); n2++
    }
  }
  // 尾根の南の斜面と、北岸のふもとの木
  for (let i = 0; i < 9000 && a + b < 2 * N - 20; i++) {
    const x = -90 + rnd() * 186, z = 96 + rnd() * 50
    const hh = world.H(x, z); if (hh < 0.5 && z > 128) { if (rnd() < 0.6) continue }
    if (Math.abs(x - PASS_X) < 12 || x > 88 && z < 120) continue
    tryTree(x, z, rnd() < 0.62 ? 0 : 1)
  }
  ic.count = ict.count = a; ib.count = ibt.count = b
  for (const o of [ic, ib, ict, ibt]) { o.castShadow = true; o.receiveShadow = true; scene.add(o) }
  // 北岸と家のまわりの草むら
  for (let i = 0; i < 2600; i++) {
    const x = -88 + rnd() * 178, z = 134 + rnd() * 96
    if (roadDist(x, z) < 4 || riverEdge(x, z) < 2.5 || coastD(x, z) < 9 || !free(x, z, 0) || world.H(x, z) < 0.05) continue
    if (Math.abs(x - PASS_X) < 10 && z < 152) continue
    if (z > 186 && z < 214 && Math.abs(x) < 60) { if (rnd() < 0.8) continue }
    grass.push({ x, z, s: 0.4 + rnd() * 0.6, k: rnd() < 0.2 ? 'tall' : 'grass' })
  }
  // 切り通しの道ばたと尾根のふもとの草
  for (let i = 0; i < 700; i++) {
    const z = 30 + rnd() * 120, x = PASS_X + (rnd() < 0.5 ? -1 : 1) * (3.8 + rnd() * 2), h = world.H(x, z)
    if (h > 1.5 || h < -0.1) continue
    grass.push({ x, z, s: 0.4 + rnd() * 0.5, k: 'grass' })
  }
}

// ---------- 草: 風で揺れ、近くを人が動くとなびく（待ち伏せの手がかり） ----------
function grassTex(kind) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128
  const g = c.getContext('2d')
  const n = kind === 'crop' ? 6 : kind === 'reed' ? 9 : 17
  for (let i = 0; i < n; i++) {
    const bx = 8 + (i + Math.random() * 0.7) * (112 / n), lean = (Math.random() - 0.5) * (kind === 'reed' ? 14 : 34), top = kind === 'crop' ? 26 + Math.random() * 30 : 8 + Math.random() * (kind === 'tall' ? 12 : 34), wid = kind === 'crop' ? 11 : kind === 'reed' ? 2.8 : 3.6
    const tint = kind === 'reed' ? [96, 118, 62] : kind === 'crop' ? [74, 142, 60] : kind === 'tall' ? [118, 128, 66] : [84, 116, 56]
    const gr = g.createLinearGradient(0, 128, 0, top); gr.addColorStop(0, `rgb(${tint[0] * 0.45 | 0},${tint[1] * 0.5 | 0},${tint[2] * 0.4 | 0})`); gr.addColorStop(1, `rgb(${Math.min(255, tint[0] * 1.45) | 0},${Math.min(255, tint[1] * 1.3) | 0},${Math.min(255, tint[2] * 1.25) | 0})`)
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - wid, 128); g.quadraticCurveTo(bx + lean * 0.2, 128 - (128 - top) * 0.55, bx + lean, top); g.quadraticCurveTo(bx + lean * 0.2 + wid * 0.4, 128 - (128 - top) * 0.5, bx + wid, 128); g.fill()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}
export function makeGrass(scene, spots, rnd, H) {
  const geo = (() => { const parts = []; for (let i = 0; i < 3; i++) { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); p.rotateY(i * Math.PI / 3); parts.push(p) } const n = parts.reduce((s, p) => s + p.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = []; let o = 0; for (const p of parts) { pos.set(p.attributes.position.array, o * 3); uv.set(p.attributes.uv.array, o * 2); for (let k = 0; k < p.attributes.position.count; k++) { nor[(o + k) * 3 + 1] = 1 } for (const j of p.index.array) idx.push(j + o); o += p.attributes.position.count } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g })()
  const uniforms = { uTime: { value: 0 }, uP: { value: Array.from({ length: 8 }, () => new THREE.Vector3(1e5, 1e5, 0)) } }
  const out = { meshes: [], uniforms }
  const kinds = { grass: [0.8, 0.6], tall: [1.05, 0.9], reed: [1.2, 0.6], crop: [0.55, 0.55] }
  const by = {}
  for (const s of spots) (by[s.k] = by[s.k] || []).push(s)
  const chunks = []
  for (const [k, all] of Object.entries(by)) {
    const cells = {}
    for (const s of all) (cells[Math.floor(s.x / 36) + ',' + Math.floor(s.z / 36)] = cells[Math.floor(s.x / 36) + ',' + Math.floor(s.z / 36)] || []).push(s)
    const m = new THREE.MeshStandardMaterial({ map: grassTex(k), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 })
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uP = uniforms.uP
      sh.vertexShader = 'uniform float uTime; uniform vec3 uP[8];\n' + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        #else
        vec3 ip = vec3(0.);
        #endif
        float hh = uv.y * uv.y, ph = ip.x * 0.37 + ip.z * 0.29;
        transformed.x += (sin(uTime * 1.6 + ph) * 0.09 + sin(uTime * 3.1 + ph * 1.7) * 0.03) * hh;
        transformed.z += cos(uTime * 1.3 + ph * 1.1) * 0.06 * hh;
        for (int i = 0; i < 8; i++) { vec2 d = ip.xz - uP[i].xy; float k = smoothstep(2.4, 0.3, length(d)) * uP[i].z; transformed.xz += normalize(d + vec2(1e-4)) * k * 0.7 * hh; transformed.y -= k * 0.3 * hh; }`)
    }
    for (const list of Object.values(cells)) {
      const im = new THREE.InstancedMesh(geo, m, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color()
      let cx = 0, cz = 0
      list.forEach((s, i) => {
        const [sw, sh] = kinds[k], sz = s.s
        m4.compose(new THREE.Vector3(s.x, s.y ?? Math.max(0, H(s.x, s.z)) - 0.02, s.z), q.identity(), new THREE.Vector3(sw * sz * (0.8 + rnd() * 0.5), sh * sz * (0.8 + rnd() * 0.5) * (k === 'reed' ? 1.7 : 1), sw * sz))
        im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(0.2 + rnd() * 0.06, 0.25, 0.7 + rnd() * 0.3)); cx += s.x; cz += s.z
      })
      im.receiveShadow = true; im.userData.c = [cx / list.length, cz / list.length]; scene.add(im); out.meshes.push(im); chunks.push(im)
    }
  }
  // 人の足元の更新（game.js の描画から毎コマ呼ぶ）。f: 戦う人たち
  out.tick = (t, fighters, cam) => {
    uniforms.uTime.value = t
    if (cam) for (const im of chunks) im.visible = Math.hypot(im.userData.c[0] - cam.x, im.userData.c[1] - cam.z) < 120 // 遠い草は描かない
    const P = uniforms.uP.value; let i = 0
    for (const f of fighters) {
      if (i >= 8) break
      const B = f.body; if (!f.alive || B.z < 90) continue
      const sp = Math.hypot(B.vx || 0, B.vz || 0)
      P[i++].set(B.x, B.z, Math.min(1, 0.12 + sp / 5) * (B.crouch ? 0.6 : 1))
    }
    for (; i < 8; i++) P[i].set(1e5, 1e5, 0)
  }
  return out
}
