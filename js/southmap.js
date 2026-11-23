// 南の低地（住宅地・川・林・海岸）の地形と道の形。area.js（地面の高さ）・south.js（置く物）・bots.js が同じ数字を使う。
// 座標: x が東、z が南。島の南端は z≈246。川は西から東へ横切る。
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export const Z_END = 262          // これより南は海（地面の関数を打ち切る）
export const PASS_X = 29.5          // 尾根を切り通す道の x（東の通り抜け）
export const RING = { x0: -58, x1: 58, z0: 152, z1: 218, r: 12, w: 6.2 }
export const STREET_Z = 199       // 住宅地の通り
export const SPOKE_X = 0          // 真ん中の橋へ通じる道

// 川（西の海から東の海へ）
export const riverC = x => 176 + 4 * Math.sin(x * 0.045 + 1) + 2 * Math.sin(x * 0.11)
export const riverW = x => 4.2 + 1.2 * Math.sin(x * 0.07 + 2)
export const riverEdge = (x, z) => Math.abs(z - riverC(x)) - riverW(x) // 負なら水の上
export const BRIDGES = [{ x: RING.x0, kind: 'side' }, { x: SPOKE_X, kind: 'main' }, { x: RING.x1, kind: 'side' }]

// 海岸線（内側が正）
const cW = z => -91 + 2.5 * Math.sin(z * 0.05 + 0.5)
const cE = z => 97 + 2.0 * Math.sin(z * 0.06)
export const cS = x => 246 + 4 * Math.sin(x * 0.04) + 3 * Math.sin(x * 0.13 + 1)
export const coastD = (x, z) => Math.min(x - cW(z), cE(z) - x, cS(x) - z)

// 林（楕円。重みが 1 に近いほど起伏が出る）
export const WOODS = [{ x: -76, z: 190, rx: 13, rz: 52 }, { x: 77, z: 190, rx: 14, rz: 52 }]
function woodW(x, z) { let w = 0; for (const o of WOODS) w = Math.max(w, 1 - ss(0.55, 1, Math.hypot((x - o.x) / o.rx, (z - o.z) / o.rz))); return w }
function bump2(x, z) { return Math.sin(x * 0.19 + z * 0.13) * 0.5 + Math.sin(x * 0.083 - z * 0.21) * 0.6 + Math.sin(x * 0.31 + z * 0.27) * 0.18 }

// 地面の高さ。h は area.js が出した「尾根のままの高さ」。南へ向かって低くなる尾根のあと、低地・川・海岸を重ねる
export function southMod(x, z, h) {
  // 東の切り通し（尾根を削って道を通す。壁は急なので人は止まる）
  if (z > 26 && z < 152 && x > 16 && x < 44) {
    const c = (1 - ss(5.5, 11, Math.abs(x - PASS_X))) * ss(26, 34, z)
    if (c > 0) h *= 1 - c
  }
  if (z < 112) return h
  const L = ss(112, 134, z)
  let hl = h
  const ww = woodW(x, z)
  hl += (ww * 0.9 * (ww > 0 ? Math.min(1, Math.max(0, (roadDist(x, z) - 3.5) / 4)) : 1) + (1 - ss(134, 150, z)) * 0.5) * bump2(x, z) * 0.7 // 大橋への道は林の起伏をならす
  // 川: 岸はなだらかに水へ下る（水際で足元が -1.2 を割ると落ちる）
  const w = riverW(x), d = Math.abs(z - riverC(x))
  if (d < w + 3) { const s = ss(w - 1, w + 2.6, d); hl = hl * s + -2.6 * (1 - s) }
  // 海岸: 砂浜がなだらかに海へ
  const cd = coastD(x, z)
  if (cd < 0) return -1e9
  if (cd < 11) { const s = ss(0, 11, cd); hl = hl * s + -2.6 * (1 - s) }
  return h * (1 - L) + hl * L
}

// 見た目用: 地面の質（川石・砂）
export function southTex(x, z, h) {
  if (z < 120) return { gravel: 0, sand: 0 }
  const re = riverEdge(x, z), cd = coastD(x, z)
  const sand = Math.max(1 - ss(5, 14, cd), 0) * (h < 0.3 ? 1 : 0.6)
  const gravel = Math.max(1 - ss(0.5, 5.5, re), 0)
  return { gravel: Math.min(1, gravel), sand: Math.min(1, sand) }
}

// 道の中心線（折れ線）。角は丸める
function rounded(x0, z0, x1, z1, r) {
  const pts = [], arc = (cx, cz, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]) } }
  arc(x1 - r, z0 + r, -Math.PI / 2); arc(x1 - r, z1 - r, 0); arc(x0 + r, z1 - r, Math.PI / 2); arc(x0 + r, z0 + r, Math.PI)
  pts.push(pts[0]); return pts
}
export const ROADS = (() => {
  const R = RING
  return {
    ring: rounded(R.x0, R.z0, R.x1, R.z1, R.r),
    spoke: [[SPOKE_X, R.z0], [SPOKE_X, R.z1]],
    street: [[R.x0, STREET_Z], [R.x1, STREET_Z]],
    // 今の道（z 8〜14・東は採石場まで続く）から南へ分かれ、切り通しを通って低地の輪へ
    pass: [[PASS_X, 13], [PASS_X, 60], [PASS_X, 100], [PASS_X, R.z0]],
    // 海峡の大橋へ（2026-11-23）
    toEast: [[R.x1, STREET_Z], [82, STREET_Z]],
    toSouth: [[SPOKE_X, R.z1], [SPOKE_X, 232]],
  }
})()
// 道の近くか（木や草を置かない所を決めるため）。返す値は道の中心線までの距離
export function roadDist(x, z) {
  let best = 1e9
  for (const k of Object.keys(ROADS)) {
    const p = ROADS[k]
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
    }
  }
  return best
}
