// 海峡の向こうの新しい陸（50人用・2026-11-23）: 橋3本・道・西の漁村・西の丘の小屋・南の町・農家・南東の倉庫街・東の発電所・山頂の電波塔・林と草
// 地形は bigmap.js。建物の部品（house2・apartment・shop・汚れ）は今の島と同じ物を使う
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { mat } from './level.js?v=mwuc41ax'
import { cedarGeo, broadGeo, leafTex, fishingBoat } from './props.js?v=mwuc41ax'
import { house2, apartment, grime, grimeAtlas, makeGrass } from './south.js?v=mwuc41ax'
import { shop } from './area.js?v=mwuc41ax'
import { PADS, ROADS2, TRAIL, BRIDGES2, SUMMIT, LAKE, landH, roadD2, landCoastD, lakeD, inPad } from './bigmap.js?v=mwuc41ax'

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

export function buildMainland(level, scene, world) {
  const rnd = mulberry(20261123), B = level.B.bind(level), H = (x, z) => world.H(x, z)
  const pick = a => a[Math.floor(rnd() * a.length)]
  level.extraProps = level.extraProps || []
  const prop = (...a) => level.extraProps.push(a)
  const foot = []   // 建物の敷地 [x0,z0,x1,z1]（木・草・拾う物の重なりを避ける）
  const items = level.landItems = []  // [x, z, kind?, y?]
  const spawns = []
  const grass = []
  const grimeGeos = []
  const used = (x0, z0, x1, z1, m = 0) => foot.some(f => x1 > f[0] - m && x0 < f[2] + m && z1 > f[1] - m && z0 < f[3] + m)
  const free = (x, z, m = 0) => !foot.some(f => x > f[0] - m && x < f[2] + m && z > f[1] - m && z < f[3] + m)
  // 窓の中は暗く・カーテンは濃い色（今の島の南と同じ）
  const curts = [0x3b342c, 0x4a3d35, 0x2f3a3f, 0x453a46].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }))
  const curt0 = level.curtM, glass0 = level.glassMat, fk0 = level.frameKey
  level.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2a30, roughness: 0.5, transparent: true, opacity: 0.6, envMapIntensity: 0.3, depthWrite: false })
  level.frameKey = 'frameSouth'
  let ci = 0
  const nextCurt = () => { level.curtM = curts[ci++ % curts.length] }

  bridges(level, scene, B)
  roads(scene)
  coreEdges(level, B)

  // ---------- 家を並べる: 区画の中に、道から離して行ごとに詰める ----------
  const WALLS = ['stuccoCream', 'stuccoSage', 'stuccoBlue', 'stuccoPink', 'sidingGrey', 'sidingGreen', 'tinBlue', 'tinCream', 'cedar', 'plaster']
  const ROOFS = ['roofRed', 'roofGreen', 'roofBlack', 'kawara']
  const clearOfRoads = (x0, z0, x1, z1, m) => { for (const fx of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) if (roadD2(x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz) < m) return false; return true }
  const houseAt = (x, z, w, d, o = {}) => {
    nextCurt()
    const floors = o.floors || (rnd() < 0.7 ? 2 : 1)
    const info = house2(level, x, z, w, d, o.wall || pick(WALLS), o.roof || pick(ROOFS), 1.2 + rnd() * 0.8, { floors, ridge: rnd() < 0.5 ? 'x' : 'z', band: floors === 2 ? pick(['none', 'awning', 'thin', 'switch']) : 'none' })
    grime(grimeGeos, rnd, x, z, w, d, info.top, info.wins, info.doors, Math.floor(rnd() * 4))
    foot.push([x - 1, z - 1, x + w + 1, z + d + 1])
    // 拾う物: 1階の真ん中あたり（机を避けて北寄り）と、2階
    items.push([x + w * 0.3, z + d - 2.4, null, 0.38])
    if (floors === 2) items.push([x + w - 2.2, z + 2.0, null, info.f2 + 0.02])
    // 庭先に室外機かプロパン
    if (rnd() < 0.6) prop(rnd() < 0.5 ? 'exterior_aircon_unit' : 'propane_tank', x + w + 0.35, rnd() < 0.5 ? 0.35 : 0, z + 1.5 + rnd() * (d - 3), Math.PI / 2, ['y', rnd() < 0.5 ? 0.62 : 1.1], true)
    // 道に近い側に塀か生け垣（戸口の前は開ける）。今の島の通りに合わせる（2026-11-23）
    if (!o.noFence) {
      const nTo = roadD2(x + w / 2, z - 3), sTo = roadD2(x + w / 2, z + d + 3), north = nTo < sTo, fy = north ? z - 2.2 : z + d + 2.2
      if (Math.min(nTo, sTo) > 4.2 && roadD2(x + w / 2, fy) > 4.2) {
        const gate = north ? x + 1.4 : x + w - 3.3, hedge = rnd() < 0.45, hh = hedge ? 0.9 : 1.1
        level.wallX(x - 1, x + w + 1, fy, 0, hh, hedge ? 0.6 : 0.18, hedge ? 'hedge' : 'blockGrey', [{ a: gate, b: gate + 1.7, y0: 0, y1: 1.4 }])
        if (!hedge) for (const px of [gate - 0.1, gate + 1.8]) B(px - 0.14, 0, fy - 0.14, px + 0.14, 1.3, fy + 0.14, 'kerb')
        for (let i = 0; i < 3; i++) B(gate + 0.35, 0.02, Math.min(north ? z : z + d, fy) + 0.3 + i * 0.6, gate + 1.35, 0.05, Math.min(north ? z : z + d, fy) + 0.6 + i * 0.6, 'stoneStep', { nocol: true })
        foot.push([x - 1.2, Math.min(fy, z) - 0.5, x + w + 1.2, Math.max(fy, z + d) + 0.5])
      }
    }
    spawns.push([x + 2.2, 0, z - 2.2])
    return info
  }
  const fillBlock = (x0, z0, x1, z1, o = {}) => {
    let z = z0
    while (z + 9 <= z1) {
      const d = 9 + rnd() * 1.6
      let x = x0
      while (x + 11 <= x1) {
        const w = 11 + rnd() * 3
        if (x + w > x1) break
        if (clearOfRoads(x - 1, z - 1, x + w + 1, z + d + 1, o.road || 6.5) && !used(x, z, x + w, z + d, 2.5) && landCoastD(x + w / 2, z + d / 2) > 14) { houseAt(x, z, w, d); x += w + 3 + rnd() * 4 }
        else x += 3
      }
      z += d + (o.gapZ || 9) + rnd() * 3
    }
  }

  // ---------- 西の漁村（北の海に面する） ----------
  {
    const [x0, z0, x1, z1] = PADS.westPort
    fillBlock(x0 + 6, -24, x1 - 4, -8, { gapZ: 30 })
    fillBlock(x0 + 6, 9, x1 - 4, z1 - 1, { gapZ: 30 })
    // 番屋（網小屋）と桟橋・舟
    banya(level, B, -250, -40, rnd)
    banya(level, B, -205, -40, rnd)
    foot.push([-252, -42, -236, -30], [-207, -42, -191, -30])
    const px = -228
    B(px, -0.28, -46, px + 3.2, 0.05, -86, 'planks')
    for (let z = -48; z > -86; z -= 3) for (const x of [px + 0.2, px + 3]) { const g = new THREE.CylinderGeometry(0.16, 0.18, 3.4, 10); g.translate(x, -1.7, z); level.push('darkWood', g) }
    fishingBoat(scene, px - 5, -74, 0.1, 0x8a2a1c); fishingBoat(scene, px + 9, -80, -0.3)
    for (const [x, z] of [[-260, -36], [-214, -36], [-232, -44]]) for (let i = 0; i < 3; i++) prop('plastic_crate_01', x + (i % 2) * 0.7, Math.floor(i / 2) * 0.3, z, 0, ['x', 0.62], i === 0)
    level.drum(-244, -34); level.drum(-198, -33)
    items.push([-243, -35], [-200, -36], [-228, -50])
    spawns.push([-230, 0, -20], [-180, 0, -10], [-270, 0, 15])
  }
  // ---------- 西の丘のふもとの小屋（キャンプ場） ----------
  {
    const [x0, z0] = PADS.camp
    const cab = [[x0 + 4, z0 + 4], [x0 + 22, z0 + 6], [x0 + 6, z0 + 30], [x0 + 26, z0 + 32]]
    for (const [x, z] of cab) houseAt(x, z, 9.5, 8, { floors: 1, wall: 'cedar', roof: 'roofGreen' })
    // 炊事場（屋根だけ）と焚き火の石
    const kx = x0 + 18, kz = z0 + 20
    for (const [ax, az] of [[0, 0], [5, 0], [0, 4], [5, 4]]) B(kx + ax - 0.12, 0, kz + az - 0.12, kx + ax + 0.12, 2.6, kz + az + 0.12, 'darkWood')
    level.slab(kx + 2.5, 2.7, kz + 2, 6.4, 0.1, 5.4, 0, 0.08, 'ironRust')
    B(kx + 0.6, 0, kz + 1.4, kx + 4.4, 0.9, kz + 2.6, 'wood')
    spawns.push([kx, 0, kz + 8])
  }
  // ---------- 南の町（真ん中に南北の道、東西の道が交わる） ----------
  {
    const [x0, z0, x1, z1] = PADS.southTown
    // 角の商店2軒と団地
    shop(level, scene, 8, 395); foot.push([7, 394, 18, 402]); items.push([12, 398], [14, 399])
    shop(level, scene, -18, 412); foot.push([-19, 411, -8, 419]); items.push([-13, 415])
    nextCurt(); apartment(level, 30, 368, 18, 6.4, 'stuccoBlue'); foot.push([29, 366, 49, 376]); items.push([34, 371, null, 0.3], [44, 371, null, 3.3])
    nextCurt(); apartment(level, -60, 430, 18, 6.4, 'tinCream'); foot.push([-61, 428, -41, 438]); items.push([-55, 433, null, 0.3], [-46, 433, null, 3.3])
    nextCurt(); apartment(level, 50, 440, 15, 6.2, 'stuccoPink'); foot.push([49, 438, 66, 448]); items.push([56, 443, null, 0.3])
    // 学校（2階建ての長い校舎と校庭）
    school(level, B, -64, 356, rnd); foot.push([-66, 354, -18, 380]); items.push([-55, 362, null, 0.4], [-35, 362, null, 0.4], [-45, 362, null, 3.6])
    fillBlock(x0 + 4, z0 + 4, x1 - 4, z1 - 4)
    for (const [x, z] of [[-6, 380], [6, 432], [60, 400], [-40, 400], [80, 420]]) items.push([x, z])
    spawns.push([0, 0, 380], [-30, 0, 410], [40, 0, 405], [10, 0, 450], [80, 0, 395])
    level.drum(22, 402); level.drum(-24, 422)
  }
  // ---------- 農家（3つ）: 家・納屋・畑 ----------
  for (const k of ['farmA', 'farmB', 'farmC']) {
    const [x0, z0, x1, z1] = PADS[k]
    houseAt(x0 + 4, z0 + 4, 12, 9.5, { floors: 2, roof: 'kawara' })
    barn(level, B, x1 - 20, z0 + 6, rnd); foot.push([x1 - 21, z0 + 5, x1 - 5, z0 + 19]); items.push([x1 - 13, z0 + 12], [x1 - 9, z0 + 15])
    // 畑（低い作物の列）
    const fx0 = x0 + 4, fz0 = z0 + 24, fw = x1 - x0 - 8, fd = Math.min(18, z1 - z0 - 28)
    for (let x = fx0 + 0.3; x < fx0 + fw; x += 0.6) for (let r = 0; r < Math.floor(fd / 1.4); r++) grass.push({ x: x + rnd() * 0.2, z: fz0 + 0.8 + r * 1.4 + (rnd() - 0.5) * 0.2, s: 0.35 + rnd() * 0.2, k: 'crop', y: 0.02 })
    const fld = [fx0, fz0, fx0 + fw, fz0 + fd]; fld.field = true; foot.push(fld)
    level.drum(x1 - 24, z0 + 8)
    spawns.push([x0 + 4, 0, z0 + 2], [x1 - 6, 0, z1 - 4])
  }
  // ---------- 南東の倉庫街 ----------
  {
    const [x0, z0, x1, z1] = PADS.depot
    const ws = [[x0 + 6, z0 + 4, 26, 14, 'ironBlue'], [x0 + 42, z0 + 4, 24, 14, 'ironOlive'], [x0 + 82, z0 + 4, 28, 15, 'ironRed'], [x0 + 10, z0 + 56, 30, 16, 'iron'], [x0 + 60, z0 + 58, 26, 14, 'ironBlue'], [x0 + 104, z0 + 60, 26, 15, 'ironOlive']]
    for (const [x, z, w, d, m] of ws) { if (!clearOfRoads(x, z, x + w, z + d, 6)) continue; warehouse(level, B, x, z, w, d, m, rnd); foot.push([x - 1, z - 1, x + w + 1, z + d + 1]); items.push([x + w * 0.3, z + d / 2 - 3], [x + w * 0.7, z + d / 2 + 3], [x + w - 4, z + d - 2.6, null, 3.2]); spawns.push([x + w / 2, 0, z - 3]) }
    // コンテナの山（隠れる所）
    for (let i = 0; i < 14; i++) {
      const x = x0 + 8 + rnd() * (x1 - x0 - 24), z = z0 + 26 + rnd() * 24, along = rnd() < 0.5
      const w = along ? 6.1 : 2.45, d = along ? 2.45 : 6.1
      if (!clearOfRoads(x, z, x + w, z + d, 5) || used(x, z, x + w, z + d, 1.5)) continue
      const n = rnd() < 0.4 ? 2 : 1
      for (let k = 0; k < n; k++) B(x, k * 2.6, z, x + w, k * 2.6 + 2.59, z + d, pick(['contO', 'contB', 'contG']))
      foot.push([x, z, x + w, z + d])
      if (rnd() < 0.5) items.push([x + w / 2, z + d + 1.2])
    }
    for (const [x, z] of [[x0 + 36, z0 + 30], [x0 + 74, z0 + 50], [x0 + 120, z0 + 32]]) level.drum(x, z)
    spawns.push([x0 + 20, 0, z0 + 40], [x1 - 15, 0, z1 - 6])
  }
  // ---------- 東の発電所（北の海に面する） ----------
  {
    const [x0, z0, x1, z1] = PADS.power
    power(level, scene, B, x0 + 14, z0 + 10, rnd)
    foot.push([x0 + 12, z0 + 8, x0 + 62, z0 + 34])
    // 変電所の機械（隠れる所）
    for (let i = 0; i < 6; i++) { const x = x0 + 70 + (i % 3) * 9, z = z0 + 12 + Math.floor(i / 3) * 10; B(x, 0, z, x + 3.2, 2.4, z + 2.4, 'paint'); B(x + 0.4, 2.4, z + 0.4, x + 2.8, 3.1, z + 2.0, 'black'); foot.push([x - 1, z - 1, x + 4, z + 3.4]) }
    items.push([x0 + 30, z0 + 22], [x0 + 46, z0 + 22], [x0 + 80, z0 + 30], [x0 + 92, z0 + 8])
    level.drum(x0 + 66, z0 + 40); level.drum(x0 + 68, z0 + 41)
    spawns.push([x0 + 40, 0, z1 + 4], [x1 - 6, 0, z0 + 50])
  }
  // ---------- 山頂の電波塔と小屋 ----------
  summit(level, scene, B, world)
  items.push([SUMMIT.x + 5, SUMMIT.z + 4, 'armor', H(SUMMIT.x + 5, SUMMIT.z + 4) + 0.2])

  // ---------- 町の道ぞいの街灯（30m おき・道の左右に交互） ----------
  for (const r of Object.values(ROADS2)) {
    let acc = 0, side = 1
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L
      for (let t = (30 - acc % 30) % 30; t < L; t += 30) {
        const px = ax + ux * t - uz * side * (r.w / 2 + 1.4), pz = az + uz * t + ux * side * (r.w / 2 + 1.4)
        if (inPad(px, pz, 6) && free(px, pz, 0.8)) prop('street_lamp_01', px, Math.max(0, H(px, pz)), pz, Math.atan2(ux, uz) + (side > 0 ? 0 : Math.PI), ['y', 4.4], true)
        side = -side
      }
      acc += L
    }
  }
  // ---------- 橋の上の隠れる物: 止まった車とコンクリの車止め（隠れ場所の無い 50〜72m を一方的に投げられていた 2026-11-23） ----------
  for (const br of BRIDGES2) {
    const [ax, az] = br.a, [bx, bz] = br.b, alongX = Math.abs(bx - ax) > Math.abs(bz - az), L = Math.hypot(bx - ax, bz - az)
    const ya = Math.max(0.15, H(ax, az) + 0.02), yb = Math.max(0.15, H(bx, bz) + 0.02)
    const at = (t, s) => [ax + (bx - ax) * t + (alongX ? 0 : s), az + (bz - az) * t + (alongX ? s : 0), ya + (yb - ya) * t]
    let k = 0
    for (let t = 15 / L; t < 1 - 8 / L; t += 15 / L, k++) {
      const s = (k % 2 ? 1 : -1) * 1.6
      if (k % 3 === 1) { // コンクリの車止めを2つ
        for (const ds of [-0.9, 0.9]) { const [px, pz, py] = at(t + ds / L, s); prop('concrete_road_barrier', px, py, pz, alongX ? Math.PI / 2 : 0, ['x', 1.9], true) }
      } else { // 止まった車（くすんだ色の車体と窓）
        const [px, pz, py] = at(t, s), lx = alongX ? 2.0 : 0.85, lz = alongX ? 0.85 : 2.0, col = ['contB', 'contO', 'canopy', 'contG'][k % 4]
        B(px - lx, py, pz - lz, px + lx, py + 0.95, pz + lz, col)
        B(px - lx * 0.55, py + 0.95, pz - lz * 0.9, px + lx * 0.45, py + 1.5, pz + lz * 0.9, 'tv')
        for (const [wx, wz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const g = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12); if (alongX) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2); g.translate(px + wx * lx * 0.7, py + 0.3, pz + wz * lz * (alongX ? 1.02 : 0.7)); level.push('tire', g) }
        items.push(alongX ? [px, pz - s * 1.1, null, py + 0.02] : [px - s * 1.1, pz, null, py + 0.02]) // 車の陰に拾う物
      }
    }
  }
  // ---------- 木: 西の丘・東の山・湖のまわり・南の浜の手前 ----------
  trees(level, scene, world, rnd, foot, grass)

  // 散らばった拾う物（道ばた・林）
  for (let i = 0, n = 0; i < 4000 && n < 90; i++) {
    const x = -315 + rnd() * 630, z = -60 + rnd() * 640, h = H(x, z)
    if (h < 0.1 || h > 30 || !free(x, z, 1.5) || lakeD(x, z) < 1.25 || landCoastD(x, z) < 15) continue
    items.push([x, z]); n++
  }
  // 上陸地点（建物の外の開けた所も足す）
  for (let i = 0, n = 0; i < 4000 && n < 40; i++) {
    const x = -310 + rnd() * 620, z = -55 + rnd() * 630, h = H(x, z)
    if (h < 0.1 || h > 20 || !free(x, z, 3) || lakeD(x, z) < 1.3 || landCoastD(x, z) < 16) continue
    spawns.push([x, h, z]); n++
  }
  level.spawnsLand = spawns.filter(s => { const h = H(s[0], s[2]); return h > -0.5 && h < 40 }).map(s => [s[0], Math.max(0, H(s[0], s[2])), s[2]])
  // 新しい陸の軽トラ6台（道の上に置く）。[x, z, 向き]（前 = (sin, cos)）
  level.trucks2 = [[-250, 2, Math.PI / 2], [-166, 236, 0], [40, 407, Math.PI / 2], [-232, 372, Math.PI / 2], [232, 440, -Math.PI / 2], [252, 0, -Math.PI / 2]]
  level.zoneSpotsLand = [[-220, -10], [-160, 200], [10, 405], [-240, 370], [-135, 530], [205, 465], [220, -15], [200, 250], [-60, 300], [120, 330], [-250, 230]]

  // 汚れ（今の島と同じ絵を使う）
  if (grimeGeos.length) {
    const m = new THREE.MeshStandardMaterial({ color: 0x2a2219, alphaMap: grimeAtlas(rnd), transparent: true, opacity: 1, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    const mesh = new THREE.Mesh(mergeGeometries(grimeGeos.map(g => g.index ? g.toNonIndexed() : g)), m); mesh.renderOrder = 2; mesh.receiveShadow = true; scene.add(mesh)
  }
  // 床・道の中に生える草は外す
  for (let i = grass.length - 1; i >= 0; i--) {
    const g = grass[i], gy = g.y != null ? g.y : H(g.x, g.z)
    if (world.near(g.x - 0.05, g.z - 0.05, g.x + 0.05, g.z + 0.05).some(b => b.kind !== 'nocol' && g.x > b.min[0] && g.x < b.max[0] && g.z > b.min[2] && g.z < b.max[2] && b.max[1] > gy + 0.03 && b.min[1] < gy + 0.5)) grass.splice(i, 1)
  }
  level.grass2 = makeGrass(scene, grass, rnd, H)
  for (const m of level.grass2.meshes || []) m.userData.noRay = true
  level.mapRects = foot.filter(f => !f.field).map(f => [f[0] + 1, f[1] + 1, f[2] - f[0] - 2, f[3] - f[1] - 2]) // 小さな地図に塗る建物
  level.curtM = curt0; level.glassMat = glass0; level.frameKey = fk0
}

// ---------- 橋（長い鉄の橋。路面は端の地面の高さを結ぶ。人と車が渡れる・手すりで落ちない） ----------
function bridges(level, scene, B) {
  const H = (x, z) => level.world.H(x, z)
  for (const br of BRIDGES2) {
    const [ax, az] = br.a, [bx, bz] = br.b, alongX = Math.abs(bx - ax) > Math.abs(bz - az)
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 4), hw = 3.6
    const ya = Math.max(0.15, H(ax, az) + 0.02), yb = Math.max(0.15, H(bx, bz) + 0.02)
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, y = ya + (yb - ya) * (t0 + t1) / 2
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1
      if (alongX) {
        B(Math.min(x0, x1), y - 0.9, az - hw, Math.max(x0, x1), y, az + hw, 'road')
        for (const s of [-1, 1]) B(Math.min(x0, x1), y, az + s * hw - (s > 0 ? 0.12 : 0), Math.max(x0, x1), y + 1.05, az + s * hw + (s < 0 ? 0.12 : 0), 'steelGreen', { vis: false })
      } else {
        B(ax - hw, y - 0.9, Math.min(z0, z1), ax + hw, y, Math.max(z0, z1), 'road')
        for (const s of [-1, 1]) B(ax + s * hw - (s > 0 ? 0.12 : 0), y, Math.min(z0, z1), ax + s * hw + (s < 0 ? 0.12 : 0), y + 1.05, Math.max(z0, z1), 'steelGreen', { vis: false })
      }
    }
    // 見た目: 手すり（上の管と柱）・橋桁・橋脚
    const yAt = t => ya + (yb - ya) * t
    for (const s of [-1, 1]) {
      for (let k = 0; k <= Math.floor(L / 2.5); k++) {
        const t = k * 2.5 / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = yAt(t)
        const px = alongX ? x : ax + s * (hw - 0.06), pz = alongX ? az + s * (hw - 0.06) : z
        const g = new THREE.BoxGeometry(0.1, 1.05, 0.1); g.translate(px, y + 0.52, pz); level.push('steelGreen', g)
      }
      for (const yy of [1.02, 0.55]) {
        const g = new THREE.BoxGeometry(alongX ? L : 0.08, 0.08, alongX ? 0.08 : L), cx = (ax + bx) / 2, cz = (az + bz) / 2
        g.translate(alongX ? cx : ax + s * (hw - 0.06), (ya + yb) / 2 + yy, alongX ? az + s * (hw - 0.06) : cz)
        if (Math.abs(yb - ya) > 0.05) { const ang = Math.atan2(yb - ya, (alongX ? bx - ax : bz - az)); g.translate(-(alongX ? cx : ax + s * (hw - 0.06)), -((ya + yb) / 2 + yy), -(alongX ? az + s * (hw - 0.06) : cz)); if (alongX) g.rotateZ(ang); else g.rotateX(-ang); g.translate(alongX ? cx : ax + s * (hw - 0.06), (ya + yb) / 2 + yy, alongX ? az + s * (hw - 0.06) : cz) }
        level.push('steelGreen', g)
      }
    }
    for (let k = 1; k < Math.floor(L / 12); k++) {
      const t = k * 12 / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t
      for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.55, 0.65, 5.5, 14); g.translate(alongX ? x : ax + s * 2.2, yAt(t) - 0.9 - 2.75, alongX ? az + s * 2.2 : z); level.push('seawall', g) }
    }
    level.bridgeNames = (level.bridgeNames || []).concat([br.name])
  }
}

// ---------- 今の島の、海へ落ちる岸の手すり（見えない壁の代わり）。人は止め、爆弾と爆風は越える ----------
function fence(level, B, pts, step = 2) {
  const H = (x, z) => level.world.H(x, z)
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step))
    for (let k = 0; k < n; k++) {
      const x0 = ax + (bx - ax) * k / n, z0 = az + (bz - az) * k / n, x1 = ax + (bx - ax) * (k + 1) / n, z1 = az + (bz - az) * (k + 1) / n
      const y0 = Math.max(0, H(x0, z0)), y1 = Math.max(0, H(x1, z1)), ym = (y0 + y1) / 2
      B(Math.min(x0, x1) - 0.06, ym, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, ym + 1.1, Math.max(z0, z1) + 0.06, null, { kind: 'edge', vis: false, tag: 'fenced' })
      const post = new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6); post.translate(x0, y0 + 0.52, z0); level.push('alu', post)
      for (const yy of [1.02, 0.55]) {
        const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), g = new THREE.CylinderGeometry(0.03, 0.03, len, 6)
        g.rotateZ(Math.PI / 2); const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir)); g.translate((x0 + x1) / 2, (y0 + y1) / 2 + yy, (z0 + z1) / 2); level.push('alu', g)
      }
    }
  }
}
function coreEdges(level, B) {
  // 西の岸壁（集落の西の端）。西の大橋の口（z 7.4〜14.6）は開ける
  fence(level, B, [[-96.05, -20], [-96.05, 7.4]]); fence(level, B, [[-96.05, 14.6], [-96.05, 32]])
  // 採石場の東の崖（海峡へ落ちる）
  fence(level, B, [[99.6, -14], [99.6, 30], [99.6, 60], [99.6, 94]], 2.5)
}

// ---------- 道（地面に沿わせた帯・路肩の砂利・中央の破線）と山道 ----------
function resample(pts, step) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step))
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n])
  }
  out.push(pts[pts.length - 1]); return out
}
function drape(scene, pts, width, material, yOff, tile, po) {
  const P = resample(pts, 2), pos = [], uv = [], idx = []
  let along = 0
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    const nx = -dz / l, nz = dx / l
    if (i) along += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
    // 路面は中心線の高さで左右そろえる（地形も道の所は中心線の高さにしてある）
    const y = Math.max(-0.02, landH(P[i][0], P[i][1])) + yOff
    for (const s of [-1, 1]) { pos.push(P[i][0] + nx * s * width / 2, y, P[i][1] + nz * s * width / 2); uv.push((s + 1) / 2 * width / tile, along / tile) }
    if (i) { const o = i * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
  const m = material.clone(); m.polygonOffset = true; m.polygonOffsetFactor = po; m.polygonOffsetUnits = po
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh)
}
function drapeDashes(scene, pts) {
  const P = resample(pts, 2), pos = [], idx = []
  let acc = 0
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (!L) continue
    acc += L; if (acc % 7 > 3) continue
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * 0.07, nz = ux * 0.07, ya = landH(ax, az) + 0.05, yb = landH(bx, bz) + 0.05, o = pos.length / 3
    pos.push(ax - nx, ya, az - nz, ax + nx, ya, az + nz, bx - nx, yb, bz - nz, bx + nx, yb, bz + nz)
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe6e1d2, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })))
}
function roads(scene) {
  const road = mat('road'), gravel = mat('gravel')
  for (const r of Object.values(ROADS2)) {
    drape(scene, r.pts, r.w + 2.2, gravel, 0.03, 3, -2)
    drape(scene, r.pts, r.w, road, 0.05, 5, -3)
    drapeDashes(scene, r.pts)
  }
  drape(scene, TRAIL, 2.6, gravel, 0.04, 3, -2)
}

// ---------- 建物 ----------
function banya(level, B, x, z, rnd) { // 網小屋: 板張り・前が広く開く
  const w = 14, d = 8, h = 3.6
  B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
  level.wallX(x, x + w, z, 0, h, 0.16, 'cedar', [{ a: x + 3, b: x + 11, y0: 0, y1: 2.9 }])
  level.wallX(x, x + w, z + d, 0, h, 0.16, 'cedar', [{ a: x + 2, b: x + 3.6, y0: 0, y1: 2.1 }, { a: x + 8, b: x + 10, y0: 1, y1: 2 }])
  level.wallZ(z, z + d, x, 0, h, 0.16, 'cedar'); level.wallZ(z, z + d, x + w, 0, h, 0.16, 'cedar', [{ a: z + 3, b: z + 5, y0: 1, y1: 2 }])
  level.slab(x + w / 2, h + 0.35, z + d / 2, w + 1, 0.1, d + 1, 0, 0.06, 'ironRust'); B(x, h, z, x + w, h + 0.2, z + d, null, { vis: false })
  for (let i = 0; i < 3; i++) level.crate(x + 2 + i * 1.3, z + d - 1.5, 1.0)
}
function school(level, B, x, z, rnd) { // 2階建ての校舎（廊下は北・教室は南）と体育倉庫
  const w = 44, d = 9, h1 = 3.4, h2 = 6.8, t = 0.2
  B(x, 0, z, x + w, 0.3, z + d, 'slab')
  for (const [yb, yt] of [[0.3, h1], [h1 + 0.25, h2]]) {
    const winN = [], winS = [], doorsN = []
    for (let i = 0; i < 8; i++) { const cx = x + 3 + i * 5.3; winN.push({ a: cx, b: cx + 2.6, y0: yb + 1, y1: yb + 2.3 }); winS.push({ a: cx - 0.5, b: cx + 3.6, y0: yb + 0.9, y1: yb + 2.5 }) }
    if (yb < 1) doorsN.push({ a: x + 20, b: x + 23, y0: yb, y1: yb + 2.3 }, { a: x + 2, b: x + 3.6, y0: yb, y1: yb + 2.1 })
    level.wallX(x, x + w, z, yb, yt, t, 'office', [...doorsN, ...winN.filter(q => !doorsN.some(d => q.a < d.b && q.b > d.a))])
    level.wallX(x, x + w, z + d, yb, yt, t, 'office', yb < 1 ? [...winS.slice(0, 7), { a: x + w - 4, b: x + w - 2.4, y0: yb, y1: yb + 2.1 }] : winS)
    level.wallZ(z, z + d, x, yb, yt, t, 'office', [{ a: z + 3, b: z + 5, y0: yb + 1, y1: yb + 2.3 }]); level.wallZ(z, z + d, x + w, yb, yt, t, 'office')
    for (const q of winN) if (!doorsN.some(d => q.a < d.b && q.b > d.a)) level.windowX(q, z)
    for (const q of winS) level.windowX(q, z + d)
    // 教室の仕切り（扉の口つき）
    if (yb < 1 || true) for (let i = 1; i < 4; i++) level.wallZ(z + 2.6, z + d, x + i * 11, yb, yt, 0.14, 'plaster', [{ a: z + 2.8, b: z + 4.2, y0: yb, y1: yb + 2.1 }])
  }
  // 2階の床（階段の穴を西の端に）と階段
  B(x + 4.4, h1, z, x + w, h1 + 0.25, z + d, 'slab'); B(x, h1, z + 2.2, x + 4.4, h1 + 0.25, z + d, 'slab')
  level.stairs(x + 0.4, x + 4.4, z + 0.2, z + 2.1, h1 + 0.25, 'slab')
  B(x - 0.4, h2, z - 0.4, x + w + 0.4, h2 + 0.3, z + d + 0.4, 'slab')
  // 校庭の端に体育倉庫
  B(x + 50 - 6, 0, z + 2, x + 50, 2.6, z + 6, 'ironBlue', { tag: '' })
}
function barn(level, B, x, z, rnd) { // 納屋: トタンで前が大きく開く・中に干し草の束
  const w = 15, d = 12, h = 5
  level.wallX(x, x + w, z, 0, h, 0.14, 'ironRed', [{ a: x + 4, b: x + 11, y0: 0, y1: 4 }])
  level.wallX(x, x + w, z + d, 0, h, 0.14, 'ironRed', [{ a: x + 6, b: x + 9, y0: 0, y1: 3 }])
  level.wallZ(z, z + d, x, 0, h, 0.14, 'ironRed'); level.wallZ(z, z + d, x + w, 0, h, 0.14, 'ironRed', [{ a: z + 4, b: z + 7, y0: 1.2, y1: 2.4 }])
  level.slab(x + w / 2, h + 0.7, z + d / 4, w + 1, 0.1, d / 2 + 0.8, -0.22, 0, 'ironRust'); level.slab(x + w / 2, h + 0.7, z + d * 3 / 4, w + 1, 0.1, d / 2 + 0.8, 0.22, 0, 'ironRust')
  B(x, h, z, x + w, h + 0.3, z + d, null, { vis: false })
  for (let i = 0; i < 6; i++) { const bx = x + 1 + (i % 3) * 1.4, bz = z + d - 2.4 - Math.floor(i / 3) * 1.6; B(bx, 0, bz, bx + 1.3, 1.0, bz + 1.4, 'litter') }
}
// 円筒（見た目だけ）。軸は 'x' | 'y' | 'z'
function pipe(level, m, ax, x0, y0, z0, len, r) {
  const g = new THREE.CylinderGeometry(r, r, len, 10)
  if (ax === 'x') g.rotateZ(Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2)
  g.translate(x0 + (ax === 'x' ? len / 2 : 0), y0 + (ax === 'y' ? len / 2 : 0), z0 + (ax === 'z' ? len / 2 : 0)); level.push(m, g)
}
// 吊り下げ照明（光る板と吊り線）
function hangLamp(level, x, y, z, w = 1.2) {
  const d = (x0, y0, z0, x1, y1, z1, m) => level.B(x0, y0, z0, x1, y1, z1, m, { nocol: true })
  d(x - w / 2, y - 0.1, z - 0.15, x + w / 2, y, z + 0.15, 'black'); d(x - w / 2 + 0.05, y - 0.12, z - 0.1, x + w / 2 - 0.05, y - 0.1, z + 0.1, 'lamp')
  for (const sx of [-1, 1]) d(x + sx * w * 0.4 - 0.01, y, z - 0.01, x + sx * w * 0.4 + 0.01, y + 1.2, z + 0.01, 'black')
}
// パレット棚（青い支柱・橙の梁・3段・段ボールの山）。当たりは棚全体で1つ（間はすり抜けない）
function rack(level, rnd, x0, z0, x1, z1, h = 5.4) {
  const d = (a, b, c, e, f, g, m) => level.B(a, b, c, e, f, g, m, { nocol: true }), alongX = x1 - x0 > z1 - z0
  const L = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(L / 2.7)), u = L / n
  for (let i = 0; i <= n; i++) for (const side of [0, 1]) {
    const p = (alongX ? x0 : z0) + i * u, q = side ? (alongX ? z1 : x1) - 0.08 : (alongX ? z0 : x0)
    if (alongX) d(p - 0.05, 0.15, q, p + 0.05, h, q + 0.08, 'rackBlue'); else d(q, 0.15, p - 0.05, q + 0.08, h, p + 0.05, 'rackBlue')
  }
  for (const yy of [1.6, 3.2, 4.8]) for (const side of [0, 1]) {
    if (alongX) { const zz = side ? z1 - 0.1 : z0; d(x0, yy - 0.12, zz, x1, yy, zz + 0.1, 'rackOrange') } else { const xx = side ? x1 - 0.1 : x0; d(xx, yy - 0.12, z0, xx + 0.1, yy, z1, 'rackOrange') }
  }
  // 段ごとにパレットと荷（空きの区画も作る）
  for (const yy of [0.15, 1.6, 3.2, 4.8]) for (let i = 0; i < n; i++) {
    if (rnd() < 0.22 || (yy > 4 && rnd() < 0.4)) continue
    const a = (alongX ? x0 : z0) + i * u + 0.15, b = a + u - 0.3, c0 = (alongX ? z0 : x0) + 0.1, c1 = (alongX ? z1 : x1) - 0.1
    const bh = 0.6 + rnd() * 0.75, m = rnd() < 0.7 ? 'carton' : rnd() < 0.5 ? 'cartonDark' : 'wrap'
    if (alongX) { d(a, yy, c0, b, yy + 0.14, c1, 'wood'); d(a + 0.05, yy + 0.14, c0 + 0.05, b - 0.05, yy + 0.14 + bh, c1 - 0.05, m) } else { d(c0, yy, a, c1, yy + 0.14, b, 'wood'); d(c0 + 0.05, yy + 0.14, a + 0.05, c1 - 0.05, yy + 0.14 + bh, b - 0.05, m) }
  }
  level.B(x0, 0.15, z0, x1, h, z1, null, { vis: false })
}
// フォークリフト（黄色い車体・柱と爪・運転席の屋根）
function forklift(level, x, z, rot) {
  const d = (a, b, c, e, f, g, m) => level.B(a, b, c, e, f, g, m, { nocol: true }), fx = rot ? 0 : 1, fz = rot ? 1 : 0
  const P = (a, s) => [x + fx * a - fz * s, z + fz * a + fx * s] // a: 前、s: 横
  const box = (a0, a1, s0, s1, y0, y1, m) => { const [p0x, p0z] = P(a0, s0), [p1x, p1z] = P(a1, s1); d(Math.min(p0x, p1x), y0, Math.min(p0z, p1z), Math.max(p0x, p1x), y1, Math.max(p0z, p1z), m) }
  box(-1.2, 0.6, -0.55, 0.55, 0.25, 1.15, 'paintY'); box(-1.3, -0.8, -0.55, 0.55, 0.25, 1.4, 'black') // 車体と重り
  box(-0.4, 0.4, -0.5, 0.5, 2.1, 2.15, 'black'); for (const [a, sg] of [[-0.35, -1], [-0.35, 1], [0.35, -1], [0.35, 1]]) box(a - 0.03, a + 0.03, sg * 0.48 - 0.03, sg * 0.48 + 0.03, 1.15, 2.1, 'black')
  box(0.6, 0.7, -0.4, 0.4, 0.15, 2.6, 'black'); for (const sg of [-1, 1]) box(0.7, 1.8, sg * 0.25 - 0.05, sg * 0.25 + 0.05, 0.18, 0.23, 'alu')
  for (const [a, sg] of [[0.35, -1], [0.35, 1], [-0.9, -1], [-0.9, 1]]) box(a - 0.25, a + 0.25, sg * 0.55 - (sg < 0 ? 0.1 : 0), sg * 0.55 + (sg > 0 ? 0.1 : 0), 0, 0.5, 'tire')
  const [c0x, c0z] = P(-1.3, -0.6), [c1x, c1z] = P(0.7, 0.6); level.B(Math.min(c0x, c1x), 0, Math.min(c0z, c1z), Math.max(c0x, c1x), 1.4, Math.max(c0z, c1z), null, { vis: false })
}
function warehouse(level, B, x, z, w, d, m, rnd) { // 倉庫: 両端の巻き上げシャッター・鉄骨・パレット棚・フォークリフト・事務所と屋上・天窓と照明
  ;(level.warehouses || (level.warehouses = [])).push({ x, z, w, d })
  const h = 7.5, dw = Math.min(6, w * 0.3), deco = (a, b, c, e, f, g, mm) => B(a, b, c, e, f, g, mm, { nocol: true })
  B(x, 0, z, x + w, 0.15, z + d, 'slab')
  level.wallZ(z, z + d, x, 0.15, h, 0.2, m, [{ a: z + d / 2 - dw / 2, b: z + d / 2 + dw / 2, y0: 0.15, y1: 4.6 }])
  level.wallZ(z, z + d, x + w, 0.15, h, 0.2, m, [{ a: z + d / 2 - dw / 2, b: z + d / 2 + dw / 2, y0: 0.15, y1: 4.6 }])
  const hi = []; for (let k = 0; k < Math.floor(w / 5); k++) hi.push({ a: x + 2 + k * 5, b: x + 4 + k * 5, y0: 5.4, y1: 6.6 })
  level.wallX(x, x + w, z, 0.15, h, 0.2, m, [{ a: x + w * 0.3, b: x + w * 0.3 + 1.4, y0: 0.15, y1: 2.3 }, ...hi.filter(q => !(q.a < x + w * 0.3 + 1.6 && q.b > x + w * 0.3 - 0.2))])
  level.wallX(x, x + w, z + d, 0.15, h, 0.2, m, hi)
  for (const q of hi) { level.windowX(q, z); level.windowX(q, z + d) }
  // 巻き上げシャッター: 口の上に巻いた箱と、半分下りた戸
  for (const xx of [x, x + w]) { const sg = xx === x ? -1 : 1; deco(xx + sg * 0.1 - 0.3, 4.6, z + d / 2 - dw / 2 - 0.2, xx + sg * 0.1 + 0.3, 5.2, z + d / 2 + dw / 2 + 0.2, 'shutter'); deco(xx - 0.06, 3.2, z + d / 2 - dw / 2, xx + 0.06, 4.6, z + d / 2 + dw / 2, 'shutter') }
  // 屋根（天窓の帯つき）と、中に見える鉄骨の梁と柱
  B(x - 0.3, h, z - 0.3, x + w + 0.3, h + 0.25, z + d + 0.3, 'iron')
  for (let k = 0; k * 6 <= w; k++) { const cx = Math.min(x + w - 0.3, x + 0.3 + k * 6)
    for (const zz of [z + 0.12, z + d - 0.52]) deco(cx - 0.2, 0.15, zz, cx + 0.2, h, zz + 0.4, 'steelGreen')
    deco(cx - 0.12, h - 0.75, z + 0.1, cx + 0.12, h - 0.1, z + d - 0.1, 'steelGreen') }
  for (let k = 0; k < Math.floor(w / 6); k++) deco(x + 2.5 + k * 6, h - 0.02, z + d / 2 - 1.2, x + 4.5 + k * 6, h + 0.27, z + d / 2 + 1.2, 'skylight')
  for (let k = 0; k < Math.floor(w / 6); k++) for (const zz of [z + d * 0.28, z + d * 0.72]) hangLamp(level, x + 3.5 + k * 6, h - 1.4, zz)
  // 床の黄色い線（通路）
  for (const zz of [z + 2.2, z + d - 2.2]) deco(x + 0.4, 0.15, zz - 0.06, x + w - 0.4, 0.162, zz + 0.06, 'paintY')
  // 棚: 北と南の壁ぞい、真ん中に背中合わせの島（シャッターの前と事務所は空ける）
  const pdx = x + w * 0.3 // 北の勝手口の前は空ける
  rack(level, rnd, x + 3, z + 0.6, pdx - 0.6, z + 1.7); rack(level, rnd, pdx + 2.2, z + 0.6, x + w - 3, z + 1.7)
  const ox0 = x + w - 7
  rack(level, rnd, x + 3, z + d - 1.7, ox0 - 1.2, z + d - 0.6)
  rack(level, rnd, x + 6, z + d / 2 - 1.1, x + w - 6, z + d / 2 + 1.1, 4.0)
  // 事務所（南東の角・窓と戸・屋上へ鉄の階段・手すり）
  const oz0 = z + d - 4.4, oh = 3.0
  level.wallX(ox0, x + w - 0.2, oz0, 0.15, oh, 0.12, 'office', [{ a: ox0 + 1.2, b: ox0 + 2.2, y0: 0.15, y1: 2.3 }, { a: ox0 + 3, b: ox0 + 5.4, y0: 1.1, y1: 2.2 }])
  level.wallZ(oz0, z + d - 0.2, ox0, 0.15, oh, 0.12, 'office', [{ a: oz0 + 1.2, b: oz0 + 3, y0: 1.1, y1: 2.2 }])
  level.windowX({ a: ox0 + 3, b: ox0 + 5.4, y0: 1.1, y1: 2.2 }, oz0); level.windowZ({ a: oz0 + 1.2, b: oz0 + 3, y0: 1.1, y1: 2.2 }, ox0)
  B(ox0, oh, oz0, x + w - 0.2, oh + 0.15, z + d - 0.2, 'steelGreen')
  B(ox0 + 3.4, 0.15, oz0 + 1.2, ox0 + 5.6, 0.9, oz0 + 1.9, 'darkWood'); deco(ox0 + 3.6, 0.9, oz0 + 1.35, ox0 + 4.1, 1.25, oz0 + 1.45, 'tv')
  for (const xx of [ox0 + 0.05, x + w - 0.3]) deco(xx, oh + 0.15, oz0, xx + 0.05, oh + 1.1, z + d - 0.2, 'alu'); deco(ox0 + 4.0, oh + 1.05, oz0 - 0.03, x + w - 0.2, oh + 1.1, oz0 + 0.03, 'alu')
  B(ox0 + 4.0, oh + 0.15, oz0 - 0.06, x + w - 0.2, oh + 1.1, oz0, null, { kind: 'edge', vis: false, tag: 'fenced' }) // 階段の上がり口（西の 4m）は開ける
  // 屋上への階段（事務所の北の壁ぞいを、西から東へ）
  level.stairs(ox0 - 0.2 - 4.6 * (oh + 0.15) / 3.15, ox0 + 3.8, oz0 - 1.3, oz0 - 0.15, oh + 0.15, 'steelGreen')
  // フォークリフトと、床のパレット・ドラム缶・ラップの荷
  forklift(level, x + w * 0.4, z + d / 2 + 3.4, false)
  for (let i = 0; i < 3; i++) { const px = x + 2 + i * 1.4; B(px, 0.15, z + d / 2 - 2.6, px + 1.2, 0.3, z + d / 2 - 1.6, 'wood'); if (i !== 1) B(px + 0.1, 0.3, z + d / 2 - 2.5, px + 1.1, 1.3, z + d / 2 - 1.7, 'wrap') }
}
function power(level, scene, B, x, z, rnd) { // 発電所: 建屋（高窓）・タービンと発電機・配管・制御盤・天井クレーン・中2階・2本の煙突・タンク
  const w = 34, d = 18, h = 11, deco = (a, b, c, e, f, g, m) => B(a, b, c, e, f, g, m, { nocol: true })
  B(x, 0, z, x + w, 0.2, z + d, 'slab')
  const hiN = [], hiS = []; for (let k = 0; k < 6; k++) { hiN.push({ a: x + 2 + k * 5.4, b: x + 5 + k * 5.4, y0: 7.2, y1: 9.2 }); hiS.push({ a: x + 2 + k * 5.4, b: x + 5 + k * 5.4, y0: 7.2, y1: 9.2 }) }
  level.wallX(x, x + w, z, 0.2, h, 0.25, 'ironBlue', [{ a: x + 6, b: x + 12, y0: 0.2, y1: 5.2 }, { a: x + 20, b: x + 21.6, y0: 0.2, y1: 2.4 }, ...hiN])
  level.wallX(x, x + w, z + d, 0.2, h, 0.25, 'ironBlue', [{ a: x + 24, b: x + 30, y0: 0.2, y1: 5.2 }, ...hiS])
  level.wallZ(z, z + d, x, 0.2, h, 0.25, 'ironBlue', [{ a: z + 7, b: z + 9, y0: 0.2, y1: 2.4 }]); level.wallZ(z, z + d, x + w, 0.2, h, 0.25, 'ironBlue')
  for (const q of hiN) level.windowX(q, z); for (const q of hiS) level.windowX(q, z + d)
  B(x - 0.4, h, z - 0.4, x + w + 0.4, h + 0.4, z + d + 0.4, 'iron')
  // 外: 腰の帯と、大きな口の上の庇
  for (const zz of [z - 0.14, z + d + 0.02]) deco(x, 0.2, zz, x + w, 1.2, zz + 0.12, 'blockGrey')
  // 中: 鉄骨の柱と梁・天井クレーンのレールと桁
  for (let k = 0; k * 5.6 <= w; k++) { const cx = Math.min(x + w - 0.5, x + 0.5 + k * 5.6); for (const zz of [z + 0.15, z + d - 0.65]) deco(cx - 0.25, 0.2, zz, cx + 0.25, h, zz + 0.5, 'steelGreen'); deco(cx - 0.15, h - 0.9, z, cx + 0.15, h - 0.1, z + d, 'steelGreen') }
  for (const zz of [z + 0.7, z + d - 1.2]) deco(x + 0.3, 8.8, zz, x + w - 0.3, 9.3, zz + 0.5, 'rustMetal')
  { const cx = x + 15.5; deco(cx - 0.6, 9.3, z + 0.6, cx + 0.6, 10.1, z + d - 0.6, 'paintY'); deco(cx - 0.7, 8.5, z + d / 2 - 0.7, cx + 0.7, 9.3, z + d / 2 + 0.7, 'black'); pipe(level, 'black', 'y', cx, 4.2, z + d / 2, 4.3, 0.04); deco(cx - 0.25, 3.9, z + d / 2 - 0.25, cx + 0.25, 4.2, z + d / 2 + 0.25, 'paintY') }
  // 中2階の通路（北の壁ぞい・手すり）と階段
  B(x + 0.2, 4.2, z + 0.2, x + w - 0.2, 4.45, z + 3, 'steelGreen'); level.stairs(x + w - 7, x + w - 1.2, z + 3.1, z + 4.6, 4.45, 'steelGreen')
  for (let k = 0; k <= (w - 7.6) / 2; k++) deco(x + 0.4 + k * 2, 4.45, z + 2.94, x + 0.46 + k * 2, 5.5, z + 3, 'alu')
  deco(x + 0.2, 5.45, z + 2.94, x + w - 7.2, 5.5, z + 3, 'alu'); B(x + 0.2, 4.45, z + 2.95, x + w - 7.2, 5.5, z + 3.0, null, { kind: 'edge', vis: false, tag: 'fenced' })
  // タービン（横に長い円筒と台）と発電機の箱（隠れる所）
  for (const cx of [x + 9, x + 23]) {
    pipe(level, 'turbine', 'x', cx - 4, 2.6, z + 11, 8, 2.0); for (const k of [-3, -1, 1, 3]) pipe(level, 'steelGreen', 'x', cx + k - 0.15, 2.6, z + 11, 0.3, 2.15)
    B(cx - 4.2, 0.2, z + 9.4, cx + 4.2, 0.8, z + 12.6, 'kerb'); B(cx - 4, 0.8, z + 9, cx + 4, 4.6, z + 13, null, { vis: false })
    B(cx + 4.4, 0.2, z + 9.4, cx + 7.2, 3.8, z + 12.6, 'turbine'); deco(cx + 4.6, 3.8, z + 10, cx + 7, 4.1, z + 12, 'black')
    pipe(level, 'rustMetal', 'y', cx - 2, 4.6, z + 11, 4.6, 0.5); pipe(level, 'rustMetal', 'z', cx - 2, 9.2, z + 2.8, 8.2, 0.5) // 上へ出る太い管
  }
  // 壁ぞいの配管（南の壁）と頭上の配管の束
  for (let k = 0; k < 4; k++) pipe(level, k % 2 ? 'paint' : 'rustMetal', 'y', x + 3 + k * 6.2, 0.2, z + d - 1.1, 8.4, 0.22) // 南の大きな口（x+24〜30）の前には立てない
  for (const [yy, zz, r, m] of [[7.6, z + d - 1.6, 0.3, 'rustMetal'], [7.0, z + d - 1.6, 0.22, 'paint'], [6.5, z + d - 2.2, 0.18, 'contB']]) pipe(level, m, 'x', x + 0.4, yy, zz, w - 0.8, r)
  // 制御盤（西の壁ぞい・小さな灯り）と机
  for (let k = 0; k < 4; k++) { // 西の戸口（z+7〜9）の前は空ける
    const zz = z + 10 + k * 1.6
    B(x + 0.3, 0.2, zz, x + 1.0, 2.3, zz + 1.5, 'panel')
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) deco(x + 1.0, 1.2 + r * 0.25, zz + 0.2 + c * 0.3, x + 1.02, 1.3 + r * 0.25, zz + 0.3 + c * 0.3, (r + c + k) % 4 === 0 ? 'ledRed' : 'ledGreen')
  }
  B(x + 2.4, 0.2, z + 11, x + 3.4, 0.95, z + 15, 'darkWood'); deco(x + 2.6, 0.95, z + 11.4, x + 2.7, 1.45, z + 12.3, 'tv'); deco(x + 2.6, 0.95, z + 13.2, x + 2.7, 1.45, z + 14.1, 'tv')
  // 床の通路の線と吊り下げ照明
  for (const zz of [z + 5.2, z + 7.6]) deco(x + 1.6, 0.2, zz - 0.06, x + w - 1, 0.212, zz + 0.06, 'paintY')
  for (let k = 0; k < 5; k++) hangLamp(level, x + 4 + k * 6.5, 8.2, z + 7, 1.6)
  // 煙突（はしごと赤白の帯）
  for (const [cx, cz] of [[x + w + 6, z + 4], [x + w + 6, z + 14]]) {
    const g = new THREE.CylinderGeometry(1.3, 1.8, 34, 20); g.translate(cx, 17, cz); level.push('kerb', g)
    for (const yy of [26, 30]) { const r = new THREE.CylinderGeometry(1.36, 1.36, 1.2, 20); r.translate(cx, yy, cz); level.push('contO', r) }
    for (let yy = 1; yy < 32; yy += 0.45) deco(cx - 1.95 + yy * 0.0155, yy, cz - 0.25, cx - 1.9 + yy * 0.0155, yy + 0.04, cz + 0.25, 'alu')
    B(cx - 1.4, 0, cz - 1.4, cx + 1.4, 34, cz + 1.4, null, { vis: false })
    pipe(level, 'rustMetal', 'x', x + w, 6, cz, cx - 1.3 - (x + w), 0.45) // 建屋から煙突へ
  }
  // タンクと管
  for (const [cx, cz] of [[x - 7, z + 4], [x - 7, z + 13]]) { const g = new THREE.CylinderGeometry(3, 3, 7, 24); g.translate(cx, 3.5, cz); level.push('paint', g); for (const yy of [2.2, 4.8]) { const r = new THREE.CylinderGeometry(3.04, 3.04, 0.12, 24); r.translate(cx, yy, cz); level.push('rustMetal', r) } B(cx - 2.6, 0, cz - 2.6, cx + 2.6, 7, cz + 2.6, null, { vis: false }); pipe(level, 'rustMetal', 'x', cx + 2.9, 1.2, cz, x - (cx + 2.9), 0.2) }
}
function summit(level, scene, B, world) { // 山頂: 電波塔（骨組み）とコンクリの小屋
  const H = (x, z) => world.H(x, z), x = SUMMIT.x, z = SUMMIT.z, y = H(x, z)
  const leg = 3.2, top = 30
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const g = new THREE.CylinderGeometry(0.09, 0.14, top, 6); g.rotateZ(sx * 0.045); g.rotateX(-sz * 0.045); g.translate(x + sx * leg * 0.6, y + top / 2 - 0.3, z + sz * leg * 0.6); level.push('steelGreen', g)
  }
  for (let yy = 3; yy < top; yy += 3) {
    const k = 1 - yy / top * 0.55, s = leg * 0.6 * k * 2
    for (const [w, d, ox, oz] of [[s, 0.06, 0, -s / 2], [s, 0.06, 0, s / 2], [0.06, s, -s / 2, 0], [0.06, s, s / 2, 0]]) { const g = new THREE.BoxGeometry(w, 0.06, d); g.translate(x + ox, y + yy, z + oz); level.push('steelGreen', g) }
  }
  B(x - leg * 0.7, y - 0.5, z - leg * 0.7, x + leg * 0.7, y + top, z + leg * 0.7, null, { vis: false })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 3 })); lamp.position.set(x, y + top + 0.2, z); scene.add(lamp)
  // 小屋（地面の高さに合わせて建てる）
  const hx = x + 4, hz = z - 9, hy = Math.max(H(hx, hz), H(hx + 5, hz), H(hx, hz + 4), H(hx + 5, hz + 4)) + 0.1
  B(hx - 0.2, hy - 1.5, hz - 0.2, hx + 5.2, hy + 0.15, hz + 4.2, 'slab')
  level.wallX(hx, hx + 5, hz, hy + 0.15, hy + 2.8, 0.2, 'stoneStep', [{ a: hx + 1.6, b: hx + 2.8, y0: hy + 0.15, y1: hy + 2.1 }])
  level.wallX(hx, hx + 5, hz + 4, hy + 0.15, hy + 2.8, 0.2, 'stoneStep', [{ a: hx + 1.5, b: hx + 3.3, y0: hy + 1.1, y1: hy + 2 }])
  level.wallZ(hz, hz + 4, hx, hy + 0.15, hy + 2.8, 0.2, 'stoneStep'); level.wallZ(hz, hz + 4, hx + 5, hy + 0.15, hy + 2.8, 0.2, 'stoneStep')
  B(hx - 0.3, hy + 2.8, hz - 0.3, hx + 5.3, hy + 3.0, hz + 4.3, 'slab')
}

// ---------- 木（升目ごとにまとめて、見えない升目は描かない）と林の床の草 ----------
function trees(level, scene, world, rnd, foot, grass) {
  const H = (x, z) => world.H(x, z)
  const cedar = cedarGeo(), broad = broadGeo()
  const cm = new THREE.MeshStandardMaterial({ map: leafTex('cedar'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const bm = new THREE.MeshStandardMaterial({ map: leafTex('broad'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const tm = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 })
  const tiles = new Map(), T = 110
  const free = (x, z, m) => !foot.some(f => x > f[0] - m && x < f[2] + m && z > f[1] - m && z < f[3] + m)
  const near = new Map(), key = (x, z) => Math.floor(x / 3) + ',' + Math.floor(z / 3)
  const clash = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = near.get((Math.floor(x / 3) + i) + ',' + (Math.floor(z / 3) + j)); if (a && a.some(t => Math.hypot(t[0] - x, t[1] - z) < 3.1)) return true } return false }
  // 林の濃さ（0〜1）
  const dens = (x, z, h) => {
    let d = 0
    d = Math.max(d, Math.exp(-(((x + 232) / 60) ** 2)) * (z > 50 && z < 320 ? 1 : 0))            // 西の丘
    d = Math.max(d, (h > 4 ? 0.9 : 0.25) * Math.exp(-(((x - 242) / 70) ** 2)) * (z > 30 && z < 340 ? 1 : 0)) // 東の山
    d = Math.max(d, 0.7 * (1 - Math.min(1, Math.abs(lakeD(x, z) - 1.6) / 0.6)))                 // 湖のまわり
    d = Math.max(d, z > 548 ? 0.45 : 0)                                                         // 南の浜の手前
    d = Math.max(d, 0.08)                                                                       // どこでも少し
    return d
  }
  let n = 0
  for (let i = 0; i < 26000 && n < 2600; i++) {
    const x = -318 + rnd() * 636, z = -66 + rnd() * 654, h = H(x, z)
    if (h < 0.3 || h > 60 || rnd() > dens(x, z, h)) continue
    if (roadD2(x, z) < 6 || landCoastD(x, z) < 9 || lakeD(x, z) < 1.2 || inPad(x, z, 4) || !free(x, z, 2) || clash(x, z)) continue
    if (x > -100 && x < 104 && z > -40 && z < 270) continue // 今の島（と海峡）
    const kind = h > 10 || rnd() < 0.5 ? 0 : 1, k = 0.95 + rnd() * 0.8
    const tk = Math.floor(x / T) + ',' + Math.floor(z / T)
    if (!tiles.has(tk)) tiles.set(tk, [[], []])
    tiles.get(tk)[kind].push([x, h, z, k, rnd() * 6, 0.9 + rnd() * 0.35, rnd()])
    ;(near.get(key(x, z)) || near.set(key(x, z), []).get(key(x, z))).push([x, z])
    world.add({ min: [x - 0.13 * k, h - 1, z - 0.13 * k], max: [x + 0.13 * k, h + 3.2 * k, z + 0.13 * k], kind: 'solid', tag: 'tree' })
    // 林の床の草
    for (let g = 0; g < 4; g++) { const gx = x + (rnd() - 0.5) * 6, gz = z + (rnd() - 0.5) * 6; if (roadD2(gx, gz) > 4.5 && free(gx, gz, 0.5)) grass.push({ x: gx, z: gz, s: 0.5 + rnd() * 0.8, k: rnd() < 0.3 ? 'tall' : 'grass' }) }
    n++
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  for (const [, lists] of tiles) for (const [kind, list] of lists.entries()) {
    if (!list.length) continue
    const G = kind === 0 ? cedar : broad, M = kind === 0 ? cm : bm
    const il = new THREE.InstancedMesh(G.leaves, M, list.length), it = new THREE.InstancedMesh(G.trunk, tm, list.length)
    list.forEach(([x, h, z, k, r, sy, c], i) => {
      m4.compose(v.set(x, h - 0.15, z), q.setFromEuler(new THREE.Euler(0, r, 0)), sc.set(k, k * sy, k))
      il.setMatrixAt(i, m4); it.setMatrixAt(i, m4)
      il.setColorAt(i, kind === 0 ? col.setHSL(0.27 + c * 0.05, 0.35, 0.4 + c * 0.16) : col.setHSL(0.2 + c * 0.08, 0.35, 0.48 + c * 0.18))
    })
    for (const o of [il, it]) { o.castShadow = true; o.receiveShadow = true; o.computeBoundingSphere(); o.userData.noRay = true; scene.add(o) }
  }
  level.landTrees = n
}
