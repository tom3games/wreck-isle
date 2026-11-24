// 50人用の大きな陸（2026-11-23）。今の島（北の港町）を幅 40m ほどの海峡を挟んでコの字に囲み、橋 3本でつなぐ。
// 全体はおよそ x -322〜322・z -72〜592（約 640m × 660m）。北が -z、東が +x。
// 地形の高さは「今の島が陸ならその高さ、海なら新しい陸の高さ」（area.js の terrainH が呼ぶ）
import { cS } from './southmap.js?v=mwu9lb26'

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const lerp = (a, b, k) => a + (b - a) * k

// ---- 外の海岸（角は丸める）
const R_CORNER = 70
const oW = z => -322 + 6 * Math.sin(z * 0.021) + 3 * Math.sin(z * 0.067 + 1)
const oE = z => 322 + 6 * Math.sin(z * 0.019 + 2) + 3 * Math.sin(z * 0.061)
const oS = x => 592 + 7 * Math.sin(x * 0.018) + 3 * Math.sin(x * 0.071 + 0.5)
const oN = x => -72 + 6 * Math.sin(x * 0.027) + 3 * Math.sin(x * 0.09)
export function outerCoastD(x, z) {
  const lx = Math.min(x - oW(z), oE(z) - x), lz = Math.min(z - oN(x), oS(x) - z)
  if (lx < R_CORNER && lz < R_CORNER) return R_CORNER - Math.hypot(R_CORNER - lx, R_CORNER - lz)
  return Math.min(lx, lz)
}
// ---- 今の島からの距離（北の港の海は除く）。40m までが海峡
export const CORE = { x0: -96, x1: 100.5 }
export const STRAIT = 40
export function coreGap(x, z) {
  const dx = Math.max(CORE.x0 - x, x - CORE.x1, 0)
  const dz = Math.max(z - cS(x), 0)
  if (z < -20 && dx === 0) return 0
  return Math.hypot(dx, dz)
}
const wob = (x, z) => 3 * Math.sin(x * 0.05 + z * 0.03) + 2 * Math.sin(x * 0.13 - z * 0.11)
// 海岸までの距離（負なら海）。外の海と海峡の近い方
export function landCoastD(x, z) { return Math.min(outerCoastD(x, z), coreGap(x, z) - STRAIT - wob(x, z)) }

// ---- 町の敷地（高さ 0 で平ら。建物の部品は地面 0 前提のため）[x0,z0,x1,z1,まわりのなだらかな幅]
export const PADS = {
  westPort: [-292, -46, -168, 22, 16],      // 西の漁村（北の海に面する）
  camp: [-185, 180, -140, 230, 14],         // 西の丘のふもとの小屋
  southTown: [-72, 352, 104, 462, 18],      // 南の町
  farmA: [-275, 345, -215, 395, 14],        // 農家
  farmB: [-160, 505, -110, 555, 14],
  farmC: [-300, 500, -250, 548, 12],
  depot: [128, 405, 285, 528, 18],          // 南東の倉庫街
  power: [168, -46, 272, 16, 16],           // 東の発電所（北の海に面する）
}
function padW(p, x, z) {
  const [x0, z0, x1, z1, m] = p, dx = Math.max(x0 - x, x - x1, 0), dz = Math.max(z0 - z, z - z1, 0)
  return 1 - ss(0, m, Math.hypot(dx, dz))
}
export function inPad(x, z, m = 0) { for (const k in PADS) { const [x0, z0, x1, z1] = PADS[k]; if (x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) return k } return null }

// ---- 湖（南西。落ちると川と同じ）
export const LAKE = { x: -190, z: 452, rx: 52, rz: 38 }
export const lakeD = (x, z) => { const a = Math.atan2(z - LAKE.z, x - LAKE.x); return Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) * (1 + 0.07 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2.3) + 0.03 * Math.sin(9 * a)) } // 岸を揺らす

// ---- 道（新しい陸の分）。橋の上は bridges が作る。w は道幅
export const BRIDGES2 = [
  { name: '西の大橋', a: [-96, 11], b: [-146, 11] },
  { name: '南の大橋', a: [0, 232], b: [0, 300] },
  { name: '東の大橋', a: [82, 199], b: [154, 199] },
]
export const ROADS2 = {
  west: { w: 6, pts: [[-146, 11], [-178, 11], [-205, 2], [-262, 2]] },
  spineW: { w: 6, pts: [[-178, 11], [-182, 60], [-178, 120], [-168, 175], [-162, 240], [-160, 300], [-170, 350], [-215, 372], [-245, 372]] },
  farmLink: { w: 5, pts: [[-170, 350], [-150, 400], [-120, 420], [-72, 420]] },
  south: { w: 6, pts: [[0, 300], [0, 352], [0, 462], [0, 520], [-40, 550], [-135, 530], [-250, 524], [-275, 524]] },
  townE: { w: 6, pts: [[-72, 407], [104, 407], [140, 420], [200, 440], [285, 440]] },
  east: { w: 6, pts: [[154, 199], [178, 199], [182, 140], [186, 80], [196, 30], [214, 0], [268, 0]] },
  eastS: { w: 6, pts: [[178, 199], [184, 260], [190, 330], [196, 405]] },
  coastS: { w: 5, pts: [[0, 520], [80, 545], [160, 535], [205, 528]] },
}
export const TRAIL = [[184, 150], [200, 158], [214, 151], [205, 141], [221, 135], [211, 125], [230, 121], [240, 115], [248, 112]] // 山頂の電波塔への山道（土）。折り返しを増やしてまっすぐ壁を登らない
export const SUMMIT = { x: 250, z: 110 }

function segP(x, z, a, b) { // 線分への一番近い点と距離
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz
  let t = L2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t))
  const px = a[0] + dx * t, pz = a[1] + dz * t
  return [Math.hypot(x - px, z - pz), px, pz]
}
export function polyD(x, z, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segP(x, z, pts[i], pts[i + 1])[0]); return d }
// 道までの距離と、一番近い中心線の路面の高さは、起動時に 2m の升目で1回だけ数えて、あとは引くだけ
// （地形の高さは毎コマ何度も呼ばれるため）。路面の高さを中心線で決めると、道が横に傾かない
const G = { x0: -330, z0: -90, s: 2, nx: 331, nz: 346 }
let ROADGRID = null, ROADH = null
function buildRoadGrid() {
  ROADGRID = new Float32Array(G.nx * G.nz); ROADH = new Float32Array(G.nx * G.nz)
  const lists = [...Object.values(ROADS2).map(r => r.pts), TRAIL]
  for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.nz; j++) {
    const x = G.x0 + i * G.s, z = G.z0 + j * G.s
    let d = 1e9, px = x, pz = z
    for (const pts of lists) for (let k = 0; k < pts.length - 1; k++) { const r = segP(x, z, pts[k], pts[k + 1]); if (r[0] < d) { d = r[0]; px = r[1]; pz = r[2] } }
    ROADGRID[i * G.nz + j] = d; ROADH[i * G.nz + j] = d < 14 ? broadH(px, pz) : 0
  }
}
function grid(A, x, z, out) {
  const fx = (x - G.x0) / G.s, fz = (z - G.z0) / G.s, i = Math.floor(fx), j = Math.floor(fz)
  if (i < 0 || j < 0 || i >= G.nx - 1 || j >= G.nz - 1) return out
  const a = A[i * G.nz + j], b = A[(i + 1) * G.nz + j], c = A[i * G.nz + j + 1], d = A[(i + 1) * G.nz + j + 1], u = fx - i, v = fz - j
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}
export const roadD2 = (x, z) => { if (!ROADGRID) buildRoadGrid(); return grid(ROADGRID, x, z, 1e9) }
const roadH = (x, z) => { if (!ROADGRID) buildRoadGrid(); return grid(ROADH, x, z, 0) }

// ---- 起伏
const n2 = (x, z) => Math.sin(x * 0.031 + z * 0.017) * 0.6 + Math.sin(x * 0.013 - z * 0.027 + 1.3) * 0.8 + Math.sin(x * 0.071 + z * 0.053) * 0.25
const env = (z, a, b, s) => ss(a, a + s, z) * (1 - ss(b - s, b, z))
// 大きな形だけ（道の路面はこれに沿わせる）
function broadH(x, z) {
  let h = 0.7 + n2(x * 0.6, z * 0.6) * 0.8
  // 東の山並み（北の端は低くして発電所、南へ向かって下る）
  h += 44 * Math.exp(-(((x - 242) / 50) ** 2)) * env(z, 30, 330, 80) * (0.82 + 0.18 * Math.sin(z * 0.045 + x * 0.02))
  h += 14 * Math.exp(-(((x - SUMMIT.x) ** 2 + (z - SUMMIT.z) ** 2) / (34 ** 2)))
  // 西の丘
  h += 11 * Math.exp(-(((x + 232) / 52) ** 2)) * env(z, 60, 300, 60) * (0.75 + 0.25 * Math.sin(z * 0.06 + 1))
  // 南の小高い所（倉庫街の西）
  h += 7 * Math.exp(-(((x - 70) ** 2) / (40 ** 2) + ((z - 510) ** 2) / (26 ** 2)))
  return h
}
// 陸の高さ（海は -1e9）
export function landH(x, z) {
  const cd = landCoastD(x, z)
  if (cd < 0) return -1e9
  let h = broadH(x, z) + n2(x * 1.7, z * 1.7) * 0.35
  // 道: 細かい起伏を消して路面を大きな形に沿わせる
  const rd = roadD2(x, z)
  if (rd < 10) h = lerp(h, roadH(x, z), 1 - ss(4.5, 10, rd))
  // 町の敷地は高さ 0 で平ら
  for (const k in PADS) { const w = padW(PADS[k], x, z); if (w > 0) h = lerp(h, 0, w) }
  // 湖
  const ld = lakeD(x, z)
  if (ld < 1.25) h = lerp(-3, h, ss(0.72, 1.2, ld))
  // 浜: 海へなだらかに下る（足元が -1.2 を割ると落ちる）
  if (cd < 13) h = lerp(-2.6, h, ss(0, 13, cd))
  return h
}
// 西の海峡の砂州（歩いて渡れる4本目の道。橋で待ち伏せされても回り込める）。今の島の西の林（z 150）と西の丘のふもとを結ぶ
export const SANDBAR = { x0: -156, x1: -80, z: 150, w: 3.2 }
export function sandbarH(x, z, h) {
  const S = SANDBAR; if (x < S.x0 || x > S.x1) return h
  const dz = Math.abs(z - S.z - 2 * Math.sin(x * 0.05)); if (dz > S.w + 5) return h
  const k = 1 - ss(S.w, S.w + 5, dz), top = 0.05 + 0.08 * Math.sin(x * 0.31), base = h < -1e8 ? -2.6 : h
  const v = base + (top - base) * k
  return v > h ? v : h
}
// 道の路面の高さ（帯を地面に沿わせる）
export function roadY(x, z) { return landH(x, z) }
// 見た目: 砂（浜）・砂利（道ばた）
export function landTex(x, z, h) {
  const cd = landCoastD(x, z)
  const sand = (1 - ss(4, 15, cd)) * (h < 0.6 ? 1 : 0.5)
  const lk = lakeD(x, z), gravel = Math.max(1 - ss(0.95, 1.12, lk), 0) * 0.8
  return { sand, gravel }
}
