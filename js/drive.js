// 車で走れる所の升目（2m）。起動時に1回だけ作る。出る場所・箱の置き場・CPU の行き先選び・円の中心選びに使う
export const DX0 = -340, DX1 = 340, DZ0 = -96, DZ1 = 608, DC = 2
export class DriveGrid {
  constructor(world) {
    this.w = world; this.nx = Math.ceil((DX1 - DX0) / DC); this.nz = Math.ceil((DZ1 - DZ0) / DC)
    this.h = new Float32Array(this.nx * this.nz); this.ok = new Uint8Array(this.nx * this.nz)
    const tmp = []
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = DX0 + (i + 0.5) * DC, z = DZ0 + (j + 0.5) * DC, k = j * this.nx + i
      let h = world.H(x, z), pave = -1e9, block = false
      for (const b of world.near(x - 0.9, z - 0.9, x + 0.9, z + 0.9, tmp)) {
        if (b.dead || b.kind === 'nocol' || b.kind === 'glass') continue
        if (x + 0.9 < b.min[0] || x - 0.9 > b.max[0] || z + 0.9 < b.min[2] || z - 0.9 > b.max[2]) continue
        const inC = x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2]
        if (inC && b.max[1] > -0.5 && b.max[1] < 0.9 && b.max[1] - b.min[1] < 4) pave = Math.max(pave, b.max[1])
      }
      if (pave > h) h = pave
      for (const b of world.near(x - 0.9, z - 0.9, x + 0.9, z + 0.9, tmp)) {
        if (b.dead || b.kind === 'nocol' || b.kind === 'glass') continue
        if (x + 0.9 < b.min[0] || x - 0.9 > b.max[0] || z + 0.9 < b.min[2] || z - 0.9 > b.max[2]) continue
        if (b.max[1] > h + 0.45 && b.min[1] < h + 1.6) { block = true; break }
      }
      this.h[k] = h; this.ok[k] = h > -0.4 && !block ? 1 : 0
    }
    // 急な坂（となりと 1.1m 以上ちがう）も走れない
    const ok2 = this.ok.slice()
    for (let j = 1; j < this.nz - 1; j++) for (let i = 1; i < this.nx - 1; i++) {
      const k = j * this.nx + i; if (!this.ok[k]) continue
      for (const d of [1, -1, this.nx, -this.nx]) if (Math.abs(this.h[k] - this.h[k + d]) > 1.1) { ok2[k] = 0; break }
    }
    this.ok = ok2
  }
  cell(x, z) { return [Math.floor((x - DX0) / DC), Math.floor((z - DZ0) / DC)] }
  free(x, z) { const [i, j] = this.cell(x, z); if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return false; return this.ok[j * this.nx + i] === 1 }
  // 半径 r の中の走れる割合（粗く数える）
  openness(x, z, r, step = 6) { let a = 0, n = 0; for (let dz = -r; dz <= r; dz += step) for (let dx = -r; dx <= r; dx += step) { if (dx * dx + dz * dz > r * r) continue; n++; if (this.free(x + dx, z + dz)) a++ } return a / Math.max(1, n) }
  // 走れる所どうしがつながった広さ（中心からの塗りつぶし・半径 r まで）
  reach(x, z, r) {
    const [i0, j0] = this.cell(x, z), seen = new Uint8Array(this.nx * this.nz), q = [[i0, j0]], R = r / DC
    if (!this.free(x, z)) return 0
    seen[j0 * this.nx + i0] = 1; let n = 0
    while (q.length) { const [i, j] = q.pop(); n++; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= this.nx || b >= this.nz) continue; const k = b * this.nx + a; if (seen[k] || !this.ok[k] || (a - i0) ** 2 + (b - j0) ** 2 > R * R) continue; seen[k] = 1; q.push([a, b]) } }
    return n / (Math.PI * R * R)
  }
}

// 道さがし（A*・2m 升目・8方向）。返り値は通る点の列（世界の座標・間引き済み）か null
DriveGrid.prototype.route = function (x0, z0, x1, z1, maxN = 25000) {
  const nx = this.nx, nz = this.nz, ok = this.ok
  let [si, sj] = this.cell(x0, z0), [gi, gj] = this.cell(x1, z1)
  const inb = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz
  if (!inb(si, sj) || !inb(gi, gj)) return null
  // 始まりと終わりが塞がっていたら、近くの走れる升へ
  const near = (i, j) => { if (ok[j * nx + i]) return [i, j]; for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a = i + di, b = j + dj; if (inb(a, b) && ok[b * nx + a]) return [a, b] } return null }
  const s = near(si, sj), g = near(gi, gj); if (!s || !g) return null
  ;[si, sj] = s; [gi, gj] = g
  const N = nx * nz
  if (!this._g || this._g.length !== N) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._mark = new Uint32Array(N); this._gen = 0 }
  const G = this._g, from = this._from, mark = this._mark, gen = ++this._gen
  const h = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz) }
  const heap = [], push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m } } return top }
  const k0 = sj * nx + si, kg = gj * nx + gi
  mark[k0] = gen; G[k0] = 0; from[k0] = -1; push(h(si, sj), k0)
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
  let n = 0, found = false
  while (heap.length && n++ < maxN) {
    const [, k] = pop(); if (k === kg) { found = true; break }
    const i = k % nx, j = (k / nx) | 0
    for (const [di, dj, c] of D) {
      const a = i + di, b = j + dj; if (!inb(a, b)) continue
      const kk = b * nx + a; if (!ok[kk]) continue
      if (di && dj && (!ok[j * nx + a] || !ok[b * nx + i])) continue // 角をかすめない
      // 壁ぎわは少し高く（車の幅のぶん離れて通る）
      const wall = (!ok[kk + 1] || !ok[kk - 1] || !ok[kk + nx] || !ok[kk - nx]) ? 0.8 : 0
      const ng = G[k] + c + wall
      if (mark[kk] === gen && ng >= G[kk]) continue
      mark[kk] = gen; G[kk] = ng; from[kk] = k; push(ng + h(a, b), kk)
    }
  }
  if (!found) return null
  const pts = []
  for (let k = kg; k !== -1; k = from[k]) pts.push([DX0 + (k % nx + 0.5) * DC, DZ0 + (((k / nx) | 0) + 0.5) * DC])
  pts.reverse()
  return pts.filter((p, i) => i % 3 === 0 || i === pts.length - 1)
}
// 2点の間がまっすぐ走れるか（升目で見る）
DriveGrid.prototype.clear = function (x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 1.5)
  for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (!this.free(x, z) || !this.free(x + 1, z) || !this.free(x - 1, z) || !this.free(x, z + 1) || !this.free(x, z - 1)) return false }
  return true
}
