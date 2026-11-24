// CPU。道は 0.5m の格子（当たりの箱から作る）を A* でたどる。投げ・逃げ・投げ返しを自分で決める
import { raycast, STEP } from './collide.js?v=mwuunvpt'
import { GRAV } from './bombs.js?v=mwuunvpt'

// 島を 50人用に広げた（2026-11-23）: x -330〜330・z -90〜600
export const C = 0.5, X0 = -330, Z0 = -90, NX = 1320, NZ = 1380
export class Nav {
  constructor(world) {
    this.ok = new Uint8Array(NX * NZ)
    // 箱の近く（0.4m 以内）の升目に先に印を付ける。印の無い升目（広い陸の大半）は地面の高さだけで決める
    const nearBox = new Uint8Array(NX * NZ)
    for (const b of world.boxes) {
      if (b.dead || b.kind === 'nocol') continue
      const i0 = Math.max(0, Math.floor((b.min[0] - 0.4 - X0) / C)), i1 = Math.min(NX - 1, Math.floor((b.max[0] + 0.4 - X0) / C))
      const j0 = Math.max(0, Math.floor((b.min[2] - 0.4 - Z0) / C)), j1 = Math.min(NZ - 1, Math.floor((b.max[2] + 0.4 - Z0) / C))
      for (let i = i0; i <= i1; i++) nearBox.fill(1, i * NZ + j0, i * NZ + j1 + 1)
    }
    const nbuf = []
    // 地面の高さは升目の真ん中で1回だけ数える（崖の判定は隣の升目と比べる）
    const HT = new Float32Array(NX * NZ)
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) HT[i * NZ + j] = world.H(X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C)
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C
      // 足元の高さ: 上から下へ線を引いて、箱か地面に当たった所
      const Ht = HT[i * NZ + j], sy = Math.max(1.5, (Ht > -1e8 ? Ht : 0) + 1.5)
      // 近くに箱が無い所（広い陸の大半）は線を引かず地面の高さだけで決める（起動を速く）
      const nb = nearBox[i * NZ + j]
      if (!nb && Ht < -1e8) continue // 海
      const hit = nb ? raycast(world, [x, sy, z], [x, -1.4, z]) : (Ht > -1.4 ? { terrain: true, t: (sy - Ht) / (sy + 1.4) } : null)
      const gy = hit ? sy - hit.t * (sy + 1.4) : -9
      let ground = gy > (hit && hit.terrain ? -0.15 : -1.0) // 地面だけの所は水際（川・浜）から少し離れる
      // 橋の鉄の手すりや柱の天辺（幅 0.6m 未満）は道にしない。そこに乗った CPU が孤立して動けなくなっていた（中ノ橋）
      if (ground && hit && hit.box && (hit.box.mat === 'steelGreen' || (hit.box.mat === 'block' && z > 150)) && gy > 0.5 && Math.min(hit.box.max[0] - hit.box.min[0], hit.box.max[2] - hit.box.min[2]) < 0.6) ground = false
      // 崖（段差が大きい所）は通れない
      if (ground && hit.terrain) { const h0 = Ht; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = i + di, q = j + dj; if (p < 0 || q < 0 || p >= NX || q >= NZ) continue; const hn = HT[p * NZ + q]; if (hn > -1e8 && Math.abs(hn - h0) > 0.6) { ground = false; break } } }
      if (!ground) continue
      const r = 0.38
      let free = true
      if (nb) for (const b of world.near(x - r, z - r, x + r, z + r, nbuf)) {
        if (b.kind === 'nocol') continue
        if (b.max[1] <= gy + STEP + 0.36 || b.min[1] >= gy + 1.7) continue // 家の床（0.35）は上がれる
        if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2]) { free = false; break }
      }
      this.ok[i * NZ + j] = free ? 1 : 0
    }
  }
  cell(x, z) { return [Math.floor((x - X0) / C), Math.floor((z - Z0) / C)] }
  // 歩ける所からくじ。円（zone）があればその内側（今の半径の8割・遠すぎない所）から
  randomFree(rng, zone, near) {
    for (let k = 0; k < 80; k++) {
      let x, z
      if (zone) { const a = rng() * 6.283, r = Math.sqrt(rng()) * Math.max(10, zone.r * 0.8); x = zone.x + Math.cos(a) * r; z = zone.z + Math.sin(a) * r } else if (near) { const a = rng() * 6.283, r = 8 + rng() * 22; x = near[0] + Math.cos(a) * r; z = near[1] + Math.sin(a) * r } else { x = X0 + rng() * NX * C; z = Z0 + rng() * NZ * C }
      if (near && Math.hypot(x - near[0], z - near[1]) > 140) continue
      const [i, j] = this.cell(x, z); if (this.free(i, j)) return [X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C]
    }
    return near ? [near[0], near[1]] : [0, 10]
  }
  free(i, j) { return i >= 0 && j >= 0 && i < NX && j < NZ && this.ok[i * NZ + j] === 1 }
  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j]
    for (let r = 1; r < 8; r++) for (let a = -r; a <= r; a++) for (const [p, q] of [[i + a, j - r], [i + a, j + r], [i - r, j + a], [i + r, j + a]]) if (this.free(p, q)) return [p, q]
    return null
  }
  path(ax, az, bx, bz) {
    const s = this.nearestFree(...this.cell(ax, az)), g = this.nearestFree(...this.cell(bx, bz))
    if (!s || !g) return null
    // 探す用の配列は1組だけ持って使い回す（毎回 26万マス×3 を作ると、CPU が多い時に使い捨てのメモリが毎秒10MB を超えていた）
    // 番号（gen）が今回のものでないマスは「まだ見ていない」扱いにして、初期化を省く
    const N = NX * NZ
    if (!this.gs) { this.gs = new Float32Array(N); this.from = new Int32Array(N); this.seen = new Uint32Array(N); this.done = new Uint32Array(N); this.gen = 0; this.hf = []; this.hk = [] }
    const gen = ++this.gen, gs = this.gs, from = this.from, seen = this.seen, done = this.done, hf = this.hf, hk = this.hk
    hf.length = 0; hk.length = 0
    const G = k => seen[k] === gen ? gs[k] : 1e9
    const push = (f, k) => { let i = hf.length; hf.push(f); hk.push(k); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hk[i] = hk[p]; i = p } hf[i] = f; hk[i] = k }
    const pop = () => {
      const top = hk[0], lf = hf.pop(), lk = hk.pop(), n = hf.length
      if (n) { let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mf = lf; if (l < n && hf[l] < mf) { m = l; mf = hf[l] } if (r < n && hf[r] < mf) { m = r; mf = hf[r] } if (m < 0) break; hf[i] = hf[m]; hk[i] = hk[m]; i = m } hf[i] = lf; hk[i] = lk }
      return top
    }
    const sk = s[0] * NZ + s[1], gk = g[0] * NZ + g[1]
    seen[sk] = gen; gs[sk] = 0; from[sk] = -1; push(0, sk)
    let it = 0
    while (hf.length && it++ < 160000) {
      const k = pop(); if (done[k] === gen) continue; done[k] = gen
      if (k === gk) break
      const i = Math.floor(k / NZ), j = k % NZ
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue
        const p = i + di, q = j + dj; if (!this.free(p, q)) continue
        if (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj))) continue
        const nk = p * NZ + q, ng = gs[k] + (di && dj ? 1.414 : 1)
        if (ng < G(nk)) { seen[nk] = gen; gs[nk] = ng; from[nk] = k; push(ng + 1.3 * Math.hypot(p - g[0], q - g[1]), nk) }
      }
    }
    if (seen[gk] !== gen && sk !== gk) return null
    const pts = []; let k = gk
    while (k >= 0 && k !== sk) { pts.push([X0 + (Math.floor(k / NZ) + 0.5) * C, Z0 + (k % NZ + 0.5) * C]); k = from[k] }
    pts.reverse()
    // 間引き: 3つおき
    return pts.filter((p, i) => i % 3 === 2 || i === pts.length - 1)
  }
}

// 山なりの投げの角度を解く（速さ s、水平距離 d、高さの差 h）。low/high の2つ
export function solveArc(s, d, h, high) {
  const g = GRAV, s2 = s * s, disc = s2 * s2 - g * (g * d * d + 2 * h * s2)
  if (disc < 0) return null
  const r = Math.sqrt(disc)
  return Math.atan((s2 + (high ? r : -r)) / (g * d))
}

export class Bot {
  constructor(f, game, rng, skill = 1) {
    this.f = f; this.g = game; this.rng = rng; this.skill = skill
    this.path = null; this.pi = 0; this.repath = 0; this.think = 0; this.cool = 1.5 + rng() * 2
    this.mode = 'roam'; this.goal = null; this.target = null; this.lastSeen = null; this.cookT = 0; this.strafe = 1; this.decided = new Map()
    this.roam = null; this.diveDecided = new Map(); this.mineT = 0; this.mineCool = 0; this.noticed = new Map(); this.stuckT = 0; this.lastP = null; this.unstick = 0
  }
  see(o) {
    const a = { x: this.f.body.x, y: this.f.body.y + 1.55, z: this.f.body.z }, b = { x: o.body.x, y: o.body.y + 1.3, z: o.body.z }
    if (this.g.fx.blocked(a, b)) return false
    return !raycast(this.g.world, [a.x, a.y, a.z], [b.x, b.y, b.z])
  }
  update(dt) {
    const f = this.f, g = this.g, B = f.body
    if (!f.alive) return
    this.think -= dt; this.cool -= dt; this.repath -= dt; this.noPathT = (this.noPathT || 0) - dt
    let mx = 0, mz = 0, run = true
    // 1. 足元の爆弾
    let danger = null, dd = 1e9
    for (const b of g.bombs) {
      if (!b.alive || b.held || b.type === 'smoke' || b.type === 'molotov') continue
      const d = Math.hypot(b.x - B.x, b.z - B.z)
      const R = b.type === 'sticky' ? 5.2 : 7.2
      if (d < R && b.fuse < 3.4 && d < dd) {
        // 気づくまでの間（人と同じく少し遅れる）
        if (!this.noticed.has(b)) this.noticed.set(b, this.g.t + 0.25 + this.rng() * 0.45 / this.skill)
        if (this.g.t >= this.noticed.get(b)) { danger = b; dd = d }
      }
    }
    // 燃えている所からは出る
    for (const c of g.burns || []) { const d = Math.hypot(c.x - B.x, c.z - B.z); if (d < c.r + 1.2 && d < dd) { danger = { x: c.x, z: c.z, fuse: 0.5, type: 'fire' }; dd = d } }
    for (const dr of g.level.drums) if (dr.alive && dr.burning) { const d = Math.hypot(dr.x - B.x, dr.z - B.z); if (d < 7.5 && d < dd) { danger = { x: dr.x, z: dr.z, fuse: 0.5, type: 'drum' }; dd = d } }
    // 飛び込み: 足元に爆弾が落ちた・地雷のカチッが鳴った時、近くにいればたまに（3割×腕）飛ぶ。爆弾の向こうへ離れる向きに
    if (danger && (danger.type === 'frag' || danger.type === 'sticky' || danger.type === 'mine') && !f.cooking && !f.held && danger.fuse < 1.4 && dd < (danger.type === 'mine' ? 4.8 : 3.6)) {
      if (!this.diveDecided.has(danger)) this.diveDecided.set(danger, this.rng() < 0.3 * this.skill)
      if (this.diveDecided.get(danger)) g.startDive(f, B.x - danger.x, B.z - danger.z)
    }
    if (f.held) { // 拾った爆弾はすぐ投げ返す
      this.cookT += dt
      const t = this.pickTarget()
      if (this.cookT > 0.32 || f.held.fuse < 0.8) { this.throwAt(t || this.awayPoint(), true); this.cookT = 0 }
    } else if (danger) {
      if (danger.type !== 'drum' && !this.decided.has(danger)) this.decided.set(danger, dd < 2.6 && danger.fuse > 0.9 && !danger.stuck && this.rng() < 0.42 * this.skill)
      if (this.decided.get(danger) && danger.alive && !danger.held && danger.fuse > 0.55) {
        mx = danger.x - B.x; mz = danger.z - B.z
        if (dd < 2.0) { g.tryPickup(f); this.cookT = 0 }
      } else {
        // 遠ざかる（遮る物の裏ならなお良い）
        mx = B.x - danger.x; mz = B.z - danger.z
        const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l
        // 壁にぶつかっていたら横へ
        if (f.body.hitWall > 0) { const t = mx; mx = -mz * this.strafe; mz = t * this.strafe }
      }
    } else {
      // 2. 敵を探して投げる
      if (this.think <= 0) {
        this.think = 0.18 + this.rng() * 0.12
        const t = this.pickTarget()
        this.target = t
        if (t) this.lastSeen = { x: t.body.x, z: t.body.z }
      }
      const t = this.target
      const zone = g.zone
      const outZone = zone && Math.hypot(B.x - zone.x, B.z - zone.z) > zone.r - 2
      const total = f.inv.frag + f.inv.sticky + f.inv.smoke + (f.inv.molotov || 0)
      if (!t && f.inv.mine > 0 && !f.cooking) this.tryMine(dt)
      if (outZone) this.goTo(zone.x, zone.z)
      else if (total === 0) { const it = g.nearestItem(B.x, B.z, ['frag', 'sticky', 'smoke', 'molotov'], this.badItems); if (it) this.itemGoal = it; if (it) this.goTo(it.x, it.z); else if (this.lastSeen) this.goTo(this.lastSeen.x, this.lastSeen.z) }
      else if (t) {
        const d = Math.hypot(t.body.x - B.x, t.body.z - B.z)
        if (d > 17) this.goTo(t.body.x, t.body.z)
        else if (d < 7) { this.goTo(B.x + (B.x - t.body.x) * 0.8, B.z + (B.z - t.body.z) * 0.8) }
        else { // 横に動きながら狙う
          if (this.rng() < dt * 0.6) this.strafe *= -1
          mx = -(t.body.z - B.z) / d * this.strafe; mz = (t.body.x - B.x) / d * this.strafe; run = false
          this.path = null
        }
        if (this.cool <= 0 && d < 24) {
          // 握って時間を詰める（投げ返されにくくする）
          if (!f.cooking) { g.pullPin(f, this.chooseType(t, d)); this.cookT = 0; this.cookFor = 0.2 + this.rng() * (1.3 * this.skill) }
        }
        f.aimYaw = Math.atan2(t.body.x - B.x, t.body.z - B.z)
      } else if (this.lastSeen && Math.hypot(this.lastSeen.x - B.x, this.lastSeen.z - B.z) > 2 && !(this.path && this.pi >= this.path.length)) this.goTo(this.lastSeen.x, this.lastSeen.z)
      else { // 見回り
        // 音のした方（だれかのだいたいの場所）へ向かう。着いたか道が尽きたら選び直す
        const ended = this.path && this.pi >= this.path.length
        if (!this.roam || ended || Math.hypot(this.roam[0] - B.x, this.roam[1] - B.z) < 2.5) {
          const others = g.fighters.filter(o => o !== f && o.alive && !o.ghost)
          const o = others[Math.floor(this.rng() * others.length)]
          this.roam = null
          for (let k = 0; k < 8 && !this.roam; k++) { const p = o ? [o.body.x + (this.rng() - 0.5) * 16, o.body.z + (this.rng() - 0.5) * 16] : this.g.nav.randomFree(this.rng, this.g.zone, [B.x, B.z]); const c = g.nav.cell(p[0], p[1]); if (g.nav.free(c[0], c[1])) this.roam = p }
          if (!this.roam && o) this.roam = [o.body.x, o.body.z]
          this.path = null; this.repath = 0
        }
        this.goTo(this.roam[0], this.roam[1]); run = false
      }
      if (f.cooking) {
        this.cookT += dt
        if (this.cookT > this.cookFor || f.cooking.fuse < 0.9) { this.throwAt(this.target || this.awayPoint(), false); this.cool = 1.6 + this.rng() * 2.4 / this.skill }
      }
    }
    if (!mx && !mz && this.path) {
      const p = this.path[this.pi]
      if (p) {
        mx = p[0] - B.x; mz = p[1] - B.z
        if (Math.hypot(mx, mz) < 0.6) { this.pi++ }
      } else this.path = null
    }
    // 引っかかり: 動きたいのに 1.2 秒進まなければ、横へ逃げて道を引き直す
    const want = Math.hypot(mx, mz) > 0.01
    // 1秒ごとに、進みたかったのに 0.6m も進んでいなければ引っかかり
    this.winT = (this.winT || 0) + dt
    if (!this.winP) this.winP = [B.x, B.z]
    if (want) this.wantT = (this.wantT || 0) + dt
    if (this.winT >= 1) {
      const moved = Math.hypot(B.x - this.winP[0], B.z - this.winP[1])
      if (this.wantT > 0.7 && moved < 0.6) { this.stuckN = (this.stuckN || 0) + 1; this.stuckT = 9 } else this.stuckN = 0
      // 最後の手: 何をしていても 6秒ほとんど動いていなければ（台の上・機械の角など）、近くの歩ける所へ行き先を変えて跳んで出る
      this.stillS = moved < 0.4 && !f.cooking && !danger ? (this.stillS || 0) + 1 : 0
      if (this.stillS >= 6) this.stillK = (this.stillK || 0) + 1; else if (this.stillS === 0) this.stillK = 0
      // 2回続けても動けない（自分の居場所が道の格子で歩けない所: 台のすき間・舟の上など）なら、3m 以内の歩ける所へ少しだけ動かす
      if (this.stillS >= 6 && this.stillK >= 2) { const c = this.g.nav.nearestFree(...this.g.nav.cell(B.x, B.z)); if (c) { const nx = X0 + (c[0] + 0.5) * C, nz = Z0 + (c[1] + 0.5) * C; if (Math.hypot(nx - B.x, nz - B.z) < 3) { B.x = nx; B.z = nz; B.y = Math.max(B.y, this.g.world.H(nx, nz)); B.vx = B.vz = 0 } } this.stillK = 0 }
      if (this.stillS >= 6) { this.stillS = 0; this.roam = this.g.nav.randomFree(this.rng, null, [B.x, B.z]); this.lastSeen = null; this.goal = null; this.path = null; this.repath = 0; this.target = null; this.stuckT = 9 }
      this.winT = 0; this.wantT = 0; this.winP = [B.x, B.z]
    }
    // 何度も抜けられなければ、行き先ごと変える
    if (this.stuckN >= 3) { this.stuckN = 0; this.roam = [B.x + (this.rng() - 0.5) * 30, B.z + (this.rng() - 0.5) * 30]; this.lastSeen = null; this.goal = null; this.path = null; this.repath = 0 }
    // 何もせず3秒立っていたら、だれかのいそうな所へ
    if (!want && !f.cooking && !danger) { this.idleT = (this.idleT || 0) + dt; if (this.idleT > 3) { this.idleT = 0; const others = g.fighters.filter(o => o !== f && o.alive && !o.ghost); const o = others[Math.floor(this.rng() * others.length)]; if (o) { this.roam = [o.body.x, o.body.z]; this.lastSeen = null; this.goTo(o.body.x, o.body.z) } } } else this.idleT = 0
    if (this.stuckT > 1.2) { this.stuckT = 0; this.unstick = 0.7; this.us = [-mz * this.strafe, mx * this.strafe]; this.strafe *= -1; this.path = null; this.repath = 0; this.roam = null }
    if (this.unstick > 0) { this.unstick -= dt; mx = this.us[0]; mz = this.us[1] }
    const l = Math.hypot(mx, mz)
    f.input = { mx: l ? mx / l : 0, mz: l ? mz / l : 0, run, jump: this.unstick > 0.5 }
  }
  // 地雷を持っていたら、戸口・橋・狭い道（まわりの半分ほどが歩けない所）でたまに置く
  tryMine(dt) {
    this.mineT -= dt
    if (this.mineT > 0 || this.g.t < this.mineCool) return
    this.mineT = 0.6
    const B = this.f.body, nav = this.g.nav
    let blocked = 0
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, c = nav.cell(B.x + Math.cos(a) * 2.0, B.z + Math.sin(a) * 2.0); if (!nav.free(c[0], c[1])) blocked++ }
    if (blocked >= 6 && blocked <= 13 && this.rng() < 0.35 && this.g.placeMine(this.f)) this.mineCool = this.g.t + 12
  }
  goTo(x, z) {
    if (this.noPathT > 0) return // 道が無かった直後は探さない（毎コマ 16万マス探して 1コマ 1秒かかっていた 2026-11-23）
    if (this.repath <= 0 || !this.path || !this.goal || Math.hypot(this.goal[0] - x, this.goal[1] - z) > 3) {
      this.goal = [x, z]; this.repath = 0.8 + this.rng() * 0.4
      this.path = this.g.nav.path(this.f.body.x, this.f.body.z, x, z); this.pi = 0
      if (!this.path) { if (this.itemGoal && Math.hypot(this.itemGoal.x - x, this.itemGoal.z - z) < 1) (this.badItems || (this.badItems = new Set())).add(this.itemGoal); this.roam = null; this.lastSeen = null; this.goal = null; this.repath = 0.3; this.noPathT = 1.5 } // 行けない所なら次の見回りで選び直す
    }
  }
  pickTarget() {
    let best = null, bd = 1e9
    for (const o of this.g.fighters) {
      if (o === this.f || !o.alive || o.ghost) continue
      const d = Math.hypot(o.body.x - this.f.body.x, o.body.z - this.f.body.z)
      const score = d - (o.human ? 4 : 0) // 少しだけ人を狙いがち
      if (d < 34 && score < bd && this.see(o)) { bd = score; best = o }
    }
    return best
  }
  awayPoint() { const B = this.f.body; return { body: { x: B.x + Math.sin(this.f.yaw) * 12, y: 0, z: B.z + Math.cos(this.f.yaw) * 12, vx: 0, vz: 0 } } }
  chooseType(t, d) {
    const inv = this.f.inv
    if (inv.smoke && this.f.hp < 45 && this.rng() < 0.6) return 'smoke'
    if (inv.sticky && d < 13 && this.rng() < 0.45) return 'sticky'
    if (inv.molotov && d > 6 && d < 20 && this.rng() < 0.5) return 'molotov'
    if (inv.frag) return 'frag'
    return inv.sticky ? 'sticky' : inv.molotov ? 'molotov' : 'smoke'
  }
  throwAt(t, back) {
    const f = this.f, B = f.body
    // 着くまでの時間で先読み
    const tx0 = t.body.x, tz0 = t.body.z
    let tx = tx0, tz = tz0, ty = (t.body.y || 0) + 0.3
    const sp = 16.8 // 人の投げを 18→19.5 にしたのに合わせて（2026-11-23）
    for (let k = 0; k < 2; k++) {
      const d = Math.hypot(tx - B.x, tz - B.z), fl = d / (sp * 0.8)
      tx = tx0 + (t.body.vx || 0) * fl * 0.8; tz = tz0 + (t.body.vz || 0) * fl * 0.8
    }
    const err = (1.4 - this.skill * 0.6) * (0.4 + this.rng())
    tx += (this.rng() - 0.5) * err * 2; tz += (this.rng() - 0.5) * err * 2
    const dx = tx - B.x, dz = tz - B.z, d = Math.hypot(dx, dz), h = ty - (B.y + 1.6)
    let speed = sp, ang = solveArc(speed, d, h, false)
    if (ang === null) { speed = 21.5; ang = solveArc(speed, d, h, false) ?? Math.PI / 4 }
    // 低い弾道で壁に当たるなら高く
    const yaw = Math.atan2(dx, dz)
    if (raycast(this.g.world, [B.x, B.y + 1.6, B.z], [B.x + dx * 0.5, B.y + 1.6 + Math.tan(ang) * d * 0.5 - GRAV * (d * 0.5 / (speed * Math.cos(ang))) ** 2 / 2, B.z + dz * 0.5])) {
      const a2 = solveArc(speed, d, h, true); if (a2 !== null) ang = a2
    }
    f.yaw = yaw; f.aimYaw = yaw
    const v = [Math.sin(yaw) * Math.cos(ang) * speed, Math.sin(ang) * speed, Math.cos(yaw) * Math.cos(ang) * speed]
    this.g.release(f, v)
  }
}
