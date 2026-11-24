// 当たり判定。世界は向きのそろった箱（AABB）だけ。見た目と同じデータ（level.js）から作る。
// 人は縦の円柱（半径 r・高さ h）。段差 STEP 以下は自動で上がる（階段は段の箱を並べる）。
export const STEP = 0.42

// 切妻屋根の上面の高さ（屋根の外なら -1e9）。屋根は見た目の板だけで当たりの箱が無いので、車はこれで屋根に乗る（WRECK ISLE 2026-11-24）
export function roofAt(world, x, z) {
  let h = -1e9
  for (const r of world.roofs || []) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue
    const off = Math.abs((r.ridge === 'x' ? z : x) - r.c), y = r.base + 0.12 + r.rh * Math.max(0, 1 - off / r.half)
    if (y > h) h = y
  }
  return h
}

// 屋根（切妻）を三角の柱として扱う当たり（2026-11-24 本人「屋根の当たり判定がおかしい」）。
// 見た目の屋根の板と同じ形: 軒（端）の高さ base+0.12 から棟（真ん中）の base+0.12+rh まで。
// 体（円 r・足元 yb・頭 yt）が屋根の中に入っていて、足元から step より高い面なら、一番近い外へ横に押し出す。
// 妻（三角の面）からは棟の向きに、坂からは段差として乗れる所まで下（軒の側）へ出す
export function roofSurf(r, x, z) {
  const off = Math.abs((r.ridge === 'x' ? z : x) - r.c)
  return r.base + 0.12 + r.rh * Math.max(0, 1 - off / r.half)
}
export function roofPush(world, c, step) {
  let hit = 0
  for (const r of world.roofs || []) {
    const R = c.r
    if (c.x < r.x0 - R || c.x > r.x1 + R || c.z < r.z0 - R || c.z > r.z1 + R) continue
    const yt = c.y + c.h; if (yt <= r.base + 0.02) continue // 軒の下を通る
    const along = r.ridge === 'x', a = along ? c.x : c.z, a0 = along ? r.x0 : r.z0, a1 = along ? r.x1 : r.z1
    const q = along ? c.z : c.x, side = q - r.c, off = Math.abs(side)
    // 円のうち一番棟に近い所の屋根の高さ（円が妻の外にはみ出していれば、はみ出しの分だけ角で浅く見る）
    const offIn = Math.max(0, off - R), sTop = r.base + 0.12 + r.rh * Math.max(0, 1 - offIn / r.half)
    if (offIn > r.half) continue
    if (c.y >= sTop - step) continue // 屋根の上（または段差で乗れる高さ）
    // 出口: 妻の外（棟の向き）・坂を下って乗れる高さの所・軒の外
    const need = c.y + step - r.base - 0.12, offNeed = need > 0 ? r.half * (1 - Math.min(1, need / r.rh)) : r.half
    const dA0 = a - (a0 - R), dA1 = (a1 + R) - a, dQ = Math.max(0, offNeed + R - off) + 0.01
    const m = Math.min(dA0, dA1, dQ)
    let nx = 0, nz = 0
    if (m === dQ) { const sg = side >= 0 ? 1 : -1; if (along) { c.z += sg * dQ; nz = sg } else { c.x += sg * dQ; nx = sg } }
    else if (m === dA0) { if (along) { c.x -= dA0; nx = -1 } else { c.z -= dA0; nz = -1 } }
    else { if (along) { c.x += dA1; nx = 1 } else { c.z += dA1; nz = 1 } }
    const vn = (c.vx || 0) * nx + (c.vz || 0) * nz; if (vn < 0) { c.vx -= vn * nx; c.vz -= vn * nz }
    c.hitWall = (c.hitWall || 0) + 1; hit++
  }
  return hit
}

export class World {
  constructor() { this.boxes = []; this.grid = new Map(); this.cell = 4; this.terrain = null }
  H(x, z) { return this.terrain ? this.terrain(x, z) : -1e9 }
  add(b) { // b: {min:[x,y,z], max:[x,y,z], kind:'solid'|'edge', mat, id}
    b.id = this.boxes.length; this.boxes.push(b)
    const c = this.cell
    for (let gx = Math.floor(b.min[0] / c); gx <= Math.floor(b.max[0] / c); gx++)
      for (let gz = Math.floor(b.min[2] / c); gz <= Math.floor(b.max[2] / c); gz++) {
        const k = gx * 1000 + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b)
      }
    return b
  }
  remove(b) { b.dead = true }
  near(x0, z0, x1, z1, out = []) {
    out.length = 0; const c = this.cell, seen = this._seen || (this._seen = new Set()); seen.clear()
    for (let gx = Math.floor(Math.min(x0, x1) / c); gx <= Math.floor(Math.max(x0, x1) / c); gx++)
      for (let gz = Math.floor(Math.min(z0, z1) / c); gz <= Math.floor(Math.max(z0, z1) / c); gz++) {
        const a = this.grid.get(gx * 1000 + gz); if (!a) continue
        for (const b of a) if (!b.dead && !seen.has(b.id)) { seen.add(b.id); out.push(b) }
      }
    return out
  }
}

const tmp = []
// 人を動かす。c: {x,y,z, vx,vy,vz, r, h, onGround}
export function moveBody(world, c, dt) {
  const sp = Math.hypot(c.vx * dt, c.vz * dt, c.vy * dt)
  const n = Math.max(1, Math.ceil(sp / (c.r * 0.45)))
  const h = dt / n
  c.onGround = false
  for (let i = 0; i < n; i++) {
    const px = c.x, pz = c.z
    c.x += c.vx * h; c.z += c.vz * h
    pushOut(world, c)
    if (world.roofs) roofPush(world, c, STEP)
    // 急な地面（崖）は壁として止める
    if (world.terrain) {
      const th = world.H(c.x, c.z)
      if (th > c.y + 0.75 && th > world.H(px, pz) + 0.3) {
        const tx = world.H(c.x, pz), tz = world.H(px, c.z)
        if (tx <= c.y + 0.75) { c.z = pz; c.vz = 0 } else if (tz <= c.y + 0.75) { c.x = px; c.vx = 0 } else { c.x = px; c.z = pz; c.vx = c.vz = 0 }
        c.hitWall = (c.hitWall || 0) + 1
      }
    }
    c.y += c.vy * h
    settleY(world, c)
  }
}

export function pushOut(world, c) {
  const list = world.near(c.x - c.r - 0.1, c.z - c.r - 0.1, c.x + c.r + 0.1, c.z + c.r + 0.1, tmp)
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const b of list) {
      if (b.kind === 'edge' && c.noEdge) continue
      if (b.kind === 'nocol') continue
      // 足元から STEP より低い上面は段差として上がるので壁にしない
      if (b.max[1] <= c.y + STEP || b.min[1] >= c.y + c.h) continue
      const px = Math.max(b.min[0], Math.min(c.x, b.max[0])), pz = Math.max(b.min[2], Math.min(c.z, b.max[2]))
      let dx = c.x - px, dz = c.z - pz, d2 = dx * dx + dz * dz
      if (d2 >= c.r * c.r) continue
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2), k = (c.r - d) / d
        c.x += dx * k; c.z += dz * k
        const nx = dx / d, nz = dz / d, vn = c.vx * nx + c.vz * nz
        if (vn < 0) { c.vx -= vn * nx; c.vz -= vn * nz; c.hitWall = (c.hitWall || 0) + 1 }
      } else { // 中心が箱の中: 一番近い面へ出す
        const o = [c.x - b.min[0] + c.r, b.max[0] - c.x + c.r, c.z - b.min[2] + c.r, b.max[2] - c.z + c.r]
        const m = o.indexOf(Math.min(...o))
        if (m === 0) { c.x = b.min[0] - c.r; c.vx = Math.min(c.vx, 0) } else if (m === 1) { c.x = b.max[0] + c.r; c.vx = Math.max(c.vx, 0) }
        else if (m === 2) { c.z = b.min[2] - c.r; c.vz = Math.min(c.vz, 0) } else { c.z = b.max[2] + c.r; c.vz = Math.max(c.vz, 0) }
      }
      moved = true
    }
    if (!moved) break
  }
}

function settleY(world, c) {
  const list = world.near(c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r, tmp)
  let ground = -1e9, ceil = 1e9
  const rr = c.r * 0.8
  for (const b of list) {
    if (b.kind === 'edge' || b.kind === 'nocol') continue
    const px = Math.max(b.min[0], Math.min(c.x, b.max[0])), pz = Math.max(b.min[2], Math.min(c.z, b.max[2]))
    if ((c.x - px) ** 2 + (c.z - pz) ** 2 > rr * rr) continue
    if (b.max[1] <= c.y + STEP + 1e-4) ground = Math.max(ground, b.max[1])
    else if (b.min[1] >= c.y + c.h * 0.5) ceil = Math.min(ceil, b.min[1])
  }
  const th = world.H(c.x, c.z); if (th > ground && th <= c.y + 0.9) ground = th
  if (world.roofs) { const rf = roofAt(world, c.x, c.z); if (rf > ground && rf <= c.y + STEP + 1e-4) ground = rf } // 屋根の坂に立つ
  if (c.y + c.h > ceil && c.vy > 0) { c.y = ceil - c.h; c.vy = 0 }
  if (c.y <= ground + 1e-3) {
    if (c.vy <= 0.01 || c.y < ground) {
      // 段差は少しずつ上げる（一瞬で上がるとカメラが跳ねる）
      const up = ground - c.y
      c.y = up > 0.05 ? c.y + Math.min(up, 0.12) : ground
      if (up <= 0.05) c.y = ground
      c.vy = Math.max(c.vy, 0); c.onGround = true; c.groundY = ground
    }
  } else if (c.y - ground < 0.06 && c.vy <= 0) { c.y = ground; c.vy = 0; c.onGround = true; c.groundY = ground }
}

// 線分と箱。返り値 {t, n:[x,y,z], box} か null。ignore(box) が true の箱は見ない
export function raycast(world, a, b, ignore) {
  const list = world.near(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), [])
  let best = null
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  for (const bx of list) {
    if (bx.kind === 'edge' || bx.kind === 'nocol' || bx.kind === 'glass' || (ignore && ignore(bx))) continue
    let t0 = 0, t1 = 1, nAxis = -1, nSign = 0
    let ok = true
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-12) { if (a[k] < bx.min[k] || a[k] > bx.max[k]) { ok = false; break } continue }
      let ta = (bx.min[k] - a[k]) / d[k], tb = (bx.max[k] - a[k]) / d[k], s = -1
      if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1 }
      if (ta > t0) { t0 = ta; nAxis = k; nSign = s }
      if (tb < t1) t1 = tb
      if (t0 > t1) { ok = false; break }
    }
    if (!ok || nAxis < 0) continue
    if (!best || t0 < best.t) { const n = [0, 0, 0]; n[nAxis] = nSign; best = { t: t0, n, box: bx } }
  }
  if (world.terrain) {
    const L = Math.hypot(d[0], d[1], d[2]), n = Math.max(2, Math.ceil(L / 0.6))
    const below = t => { const x = a[0] + d[0] * t; return a[1] + d[1] * t < world.H(x, a[2] + d[2] * t) }
    for (let i = 1; i <= n; i++) {
      const t = i / n; if (best && t > best.t) break
      if (below(t)) {
        let lo = (i - 1) / n, hi = t
        for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (below(m)) hi = m; else lo = m }
        if (!best || hi < best.t) best = { t: hi, n: [0, 1, 0], box: null, terrain: true }
        break
      }
    }
  }
  return best
}

// 球（爆弾）を動かして跳ね返す。p:{x,y,z,vx,vy,vz,r}。当たった面を返す
export function moveBall(world, p, dt, bounce = 0.32, fric = 0.7) {
  let hit = null
  const sp = Math.hypot(p.vx, p.vy, p.vz) * dt
  const n = Math.max(1, Math.ceil(sp / (p.r * 0.8)))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h
    const list = world.near(p.x - p.r, p.z - p.r, p.x + p.r, p.z + p.r, tmp)
    for (const b of list) {
      if (b.kind === 'edge' || b.kind === 'nocol') continue
      if (b.kind === 'glass') { const cx2 = Math.max(b.min[0], Math.min(p.x, b.max[0])), cy2 = Math.max(b.min[1], Math.min(p.y, b.max[1])), cz2 = Math.max(b.min[2], Math.min(p.z, b.max[2])); if ((p.x - cx2) ** 2 + (p.y - cy2) ** 2 + (p.z - cz2) ** 2 < p.r * p.r) p.onGlass?.(b); continue }
      const cx = Math.max(b.min[0], Math.min(p.x, b.max[0])), cy = Math.max(b.min[1], Math.min(p.y, b.max[1])), cz = Math.max(b.min[2], Math.min(p.z, b.max[2]))
      let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= p.r * p.r) continue
      let nx, ny, nz
      if (d2 < 1e-10) { // 中に入った: 上へ出す
        nx = 0; ny = 1; nz = 0; p.y = b.max[1] + p.r
      } else {
        const dd = Math.sqrt(d2); nx = dx / dd; ny = dy / dd; nz = dz / dd
        p.x = cx + nx * p.r; p.y = cy + ny * p.r; p.z = cz + nz * p.r
      }
      const vn = p.vx * nx + p.vy * ny + p.vz * nz
      if (vn < 0) {
        p.vx -= (1 + bounce) * vn * nx; p.vy -= (1 + bounce) * vn * ny; p.vz -= (1 + bounce) * vn * nz
        // 面に沿う動きを摩擦で減らす
        const tx = p.vx - (p.vx * nx + p.vy * ny + p.vz * nz) * nx, tz = p.vz - (p.vx * nx + p.vy * ny + p.vz * nz) * nz
        const k = ny > 0.7 ? fric : 0.92
        p.vx = p.vx - tx * (1 - k) * Math.min(1, Math.abs(vn) * 0.25 + 0.05); p.vz = p.vz - tz * (1 - k) * Math.min(1, Math.abs(vn) * 0.25 + 0.05)
        hit = { n: [nx, ny, nz], box: b, speed: -vn }
      }
    }
    if (world.terrain) {
      const th = world.H(p.x, p.z)
      if (p.y - p.r < th && th > -1e8) {
        const e = 0.3, nx0 = -(world.H(p.x + e, p.z) - world.H(p.x - e, p.z)) / (2 * e), nz0 = -(world.H(p.x, p.z + e) - world.H(p.x, p.z - e)) / (2 * e)
        const l = Math.hypot(nx0, 1, nz0), nx = nx0 / l, ny = 1 / l, nz = nz0 / l
        p.y = th + p.r
        const vn = p.vx * nx + p.vy * ny + p.vz * nz
        if (vn < 0) {
          p.vx -= (1 + bounce) * vn * nx; p.vy -= (1 + bounce) * vn * ny; p.vz -= (1 + bounce) * vn * nz
          const k = 1 - (1 - fric) * Math.min(1, Math.abs(vn) * 0.25 + 0.05); p.vx *= k; p.vz *= k
          hit = { n: [nx, ny, nz], box: null, speed: -vn, terrain: true }
        }
      }
    }
  }
  return hit
}
