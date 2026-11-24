// CPU: 車に乗っている時は近くの相手に体当たり・箱とガソリンを拾う・アイテムを使う・円の外から戻る・詰まったら下がる
// 燃料切れや火が出て爆発しそうになったら降りて、走って次の空き車を探す
const ang = a => Math.atan2(Math.sin(a), Math.cos(a))
export class Driver {
  constructor(person, game, rng) {
    this.p = person; this.g = game; this.rng = rng
    this.think = rng() * 0.5; this.target = null; this.goal = null; this.stuckT = 0; this.backT = 0; this.backSteer = 1
    this.aggr = 0.7 + rng() * 0.5; this.useT = 0; this.hornT = 2 + rng() * 6; this.avoidSide = rng() < 0.5 ? 1 : -1
    this.bailHp = 6 + rng() * 8
    // 好きな車の種類（CPU ごとに違う。重い車好き・速い車好き・跳ぶ車好き）
    const kinds = [{ dump: 14, bus: 12, kei: 4 }, { sports: 14, kcar: 10 }, { buggy: 14, kcar: 6 }, { kei: 8, dump: 6, sports: 6 }]
    this.likes = kinds[Math.floor(rng() * kinds.length)]
  }
  get c() { return this.p.car }
  update(dt) {
    const p = this.p; if (!p.alive) return
    if (this.off) { if (p.car) p.car.input = { throttle: 0, steer: 0 }; else p.input = { mx: 0, mz: 0 }; return }
    if (!p.car) return this.foot(dt)
    const c = p.car, g = this.g
    // 降りる: 燃料切れで止まった・火が出て爆発しそう
    const sp = Math.hypot(c.vx, c.vz)
    if ((c.fuel <= 0 && sp < 2) || (c.stage === 3 && c.hp < this.bailHp) || (c.stage === 3 && this.spareNear(25, 60))) { if (g.t - (p.exitT || -9) > 2) { g.exitCar(p); this.footGoal = null; return } }
    if (this.backT > 0) { this.backT -= dt; c.input = { throttle: -1, steer: this.backSteer }; if (this.backT <= 0) this.escT = 1.6 + this.rng(); return }
    this.escT = (this.escT || 0) - dt
    if (sp < 1.6 && !c.air && c.fuel > 0) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2)
    // 壁や海岸で小刻みに跳ね返り続ける時も詰まりとみなす（1.4秒で 2.5m 進んでいない）
    if (!this.chk || g.t - this.chk.t > 1.4) { if (this.chk && Math.hypot(c.x - this.chk.x, c.z - this.chk.z) < 2.5 && c.fuel > 0 && !(this.goal && this.goal.pump)) this.stuckT = 9; this.chk = { x: c.x, z: c.z, t: g.t } }
    // 25秒たっても 8m も進めていない車は捨てて、歩いて別の車へ
    if (!this.prog || g.t - this.prog.t > 25) { if (this.prog && Math.hypot(c.x - this.prog.x, c.z - this.prog.z) < 8 && !(this.goal && this.goal.pump) && g.t - (p.exitT || -99) > 10) { g.exitCar(p); this.footGoal = null; this.avoidCar = c; this.prog = null; return } this.prog = { x: c.x, z: c.z, t: g.t } }
    if (this.stuckT > 1.1) {
      // 何度も詰まる車は捨てて、歩いて別の車へ（乗り換え）
      this.stuckN = (this.stuckN || []).filter(t => g.t - t < 20); this.stuckN.push(g.t)
      if (this.stuckN.length >= 4 && this.spareNear(80, 20)) { this.stuckN = []; g.exitCar(p); this.footGoal = null; this.avoidCar = c; return }
    }
    if (this.stuckT > 1.1) { this.stuckT = 0; this.backT = 0.9 + this.rng() * 0.6; this.backSteer = this.rng() < 0.5 ? 1 : -1; return }
    this.think -= dt
    if (this.think <= 0) { this.think = 0.35 + this.rng() * 0.25; this.choose(); if (!p.car) return } // 自転車から降りた
    const z = g.zone
    let tx, tz
    const zd = Math.hypot(c.x - z.x, c.z - z.z)
    if (this.escT > 0) { tx = z.x; tz = z.z } // 下がった後は少し円の真ん中へ逃げる（海岸や壁で同じ所に何度も当たらない）
    else if (zd > z.r * 0.85 && (!this.target || Math.hypot(this.target.x - z.x, this.target.z - z.z) > z.r * 0.8)) { tx = z.x; tz = z.z }
    else if (this.goal) { tx = this.goal.x; tz = this.goal.z }
    else if (this.target) {
      const t = this.target, d = Math.hypot(t.x - c.x, t.z - c.z), lead = Math.min(1.2, d / Math.max(8, sp + 4)) * 0.8
      tx = t.x + t.vx * lead; tz = t.z + t.vz * lead
    } else { tx = z.x; tz = z.z }
    // 爆撃の赤い円の中なら外へ逃げる。行き先が円の中なら行かない
    if (g.raid) { const RD = g.raid, dx = c.x - RD.x, dz = c.z - RD.z, d = Math.hypot(dx, dz) || 1; if (d < RD.r + 6) { tx = RD.x + dx / d * (RD.r + 25); tz = RD.z + dz / d * (RD.r + 25) } else if (g.inRaid(tx, tz, 4)) { tx = c.x - dz / d * 20; tz = c.z + dx / d * 20 } }
    ;[tx, tz] = this.via(c.x, c.z, tx, tz)
    const want = Math.atan2(tx - c.x, tz - c.z), dist = Math.hypot(tx - c.x, tz - c.z)
    const best = this.pick(c.x, c.z, want, dist, c.yaw, c)
    const da = ang(best - c.yaw)
    let steer = Math.max(-1, Math.min(1, da * 2.2)), thr = 1
    if (Math.abs(da) > 1.3 && sp > 9) thr = 0.25
    if (this.goal && this.goal.pump && dist < 5) thr = sp > 3 ? -0.6 : 0 // 給油所では止まる
    if (Math.abs(da) > 2.4 && sp < 4 && dist < 14) { thr = -1; steer = -steer }
    c.input = { throttle: thr, steer }
    this.items(dt)
    // ジャンプでよける: 向かってくる鉄球・前の作動中の地雷・爆撃の円の中（たまに）
    if (!c.air && g.t - (c.jumpT ?? -9) > 1.6) {
      let j = false
      for (const b of g.balls) { const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz); if (b.owner !== c && d < 11 && (b.vx * dx + b.vz * dz) / (d || 1) > 6) j = true }
      for (const m of g.mines) if (m.state === 1 && m.owner !== c) { const [a, bb] = c.local(m.x, m.z); if (a > 1 && a < 6 && Math.abs(bb) < 1.2 && sp > 6) j = true }
      if (g.inRaid(c.x, c.z) && this.rng() < dt * 0.5) j = true
      if (j && this.rng() < 0.7) c.jump()
    }
    this.hornT -= dt
    if (this.hornT < 0 && this.target && Math.hypot(this.target.x - c.x, this.target.z - c.z) < 18 && Math.abs(da) < 0.3 && sp > 10) { this.hornT = 6 + this.rng() * 8; g.sound('horn', c, 0.55) }
  }
  // 遠い所・まっすぐ行けない所へは、升目の道さがし（A*）でつないだ点を順にたどる
  via(x, z, tx, tz) {
    const G = this.g.grid, d = Math.hypot(tx - x, tz - z)
    if (d < 45 && G.clear(x, z, tx, tz)) { this.route = null; return [tx, tz] }
    const t = this.g.t
    // 道さがしは重いので、1コマに1回まで（全員で順番）・同じ CPU は 3秒に1回まで（2026-11-24 遊んでいる最中のカクつき）
    if ((!this.route || t - this.routeT > 3 || Math.hypot(this.routeEnd[0] - tx, this.routeEnd[1] - tz) > 12) && this.g.pathTake()) {
      this.routeT = t; this.routeEnd = [tx, tz]; this.route = G.route(x, z, tx, tz)
      if (!this.route) { this.noRoute = true; return [tx, tz] }
    }
    const R = this.route
    if (!R || !R.length) return [tx, tz] // 順番待ちの間はまっすぐ向かう
    while (R.length > 1 && Math.hypot(R[0][0] - x, R[0][1] - z) < 5) R.shift()
    let k = 0
    for (let i = Math.min(R.length - 1, 8); i > 0; i--) if (Math.hypot(R[i][0] - x, R[i][1] - z) < 18 && G.clear(x, z, R[i][0], R[i][1])) { k = i; break }
    return R[k] || [tx, tz]
  }
  // 升目で見て走れる向きを選ぶ
  pick(x, z, want, dist, yaw, self) {
    const g = this.g
    let best = want, bestCost = 1e9
    for (const off of [0, 0.3, -0.3, 0.65, -0.65, 1.05, -1.05, 1.6, -1.6, 2.4, -2.4]) {
      const a = want + off
      let block = 0
      for (const [k, w] of [[4, 4], [8, 2.5], [13, 1.2]]) { if (k > Math.max(dist + 3, 5)) break; if (!g.grid.free(x + Math.sin(a) * k, z + Math.cos(a) * k)) block += w }
      if (g.raid && g.inRaid(x + Math.sin(a) * 8, z + Math.cos(a) * 8, 3) && !g.inRaid(x, z)) block += 6
      if (self) for (const o of g.cars) if (!o.alive && o !== self) { const px = x + Math.sin(a) * 6 - o.x, pz = z + Math.cos(a) * 6 - o.z; if (px * px + pz * pz < 9) block += 2 }
      const cost = Math.abs(off) * 1.2 + block * 3 + Math.abs(ang(a - yaw)) * 0.4 + (Math.sign(off) === this.avoidSide ? -0.05 : 0)
      if (cost < bestCost) { bestCost = cost; best = a }
    }
    return best
  }
  spareNear(R, minHp) { const p = this.p; return this.g.cars.some(o => o.alive && !o.driver && !o.T.bike && o.hp > minHp && o.fuelK > 0.15 && Math.hypot(o.x - p.x, o.z - p.z) < R) }
  choose() {
    const c = this.c, g = this.g, z = g.zone
    let best = null, bs = 1e9
    for (const o of g.ps) {
      if (o === this.p || !o.alive) continue
      const d = Math.hypot(o.x - c.x, o.z - c.z), a = Math.abs(ang(Math.atan2(o.x - c.x, o.z - c.z) - c.yaw))
      const weak = o.car ? o.car.stage * 6 : d < 20 ? 6 : -40 // 歩いている人は近い時だけねらう // 歩いている人はねらいやすい
      const s = d + a * 9 - weak * this.aggr + (o === this.target ? -8 : 0) + (Math.hypot(o.x - z.x, o.z - z.z) > z.r ? 30 : 0)
      if (s < bs) { bs = s; best = o }
    }
    this.target = best
    this.goal = null
    // 自転車に乗っている時は、空いている車を探しに行き、そばで降りて乗り換える
    if (c.T.bike) {
      let bc = null, bd = 1e9
      for (const o of g.cars) { if (!o.alive || o.driver || o.T.bike || o.stage >= 3 || o.groundAt(o.x, o.z) < -0.3) continue; const d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; bc = o } }
      if (bc) { this.goal = bc; if (bd < 7 && g.t - (this.p.exitT || -9) > 2) { g.exitCar(this.p); this.footGoal = bc } return }
    }
    // ガソリンが少ない: 缶か給油所へ
    if (c.fuelK < 0.24) {
      let bb = null, bd = 1e9
      for (const b of [...g.cans.filter(k => k.on), ...g.pumps]) { const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < bd && Math.hypot(b.x - z.x, b.z - z.z) < z.r * 0.95) { bd = d; bb = b } }
      if (bb && (bd < 90 || c.fuelK < 0.1)) { this.goal = bb; return }
    }
    if (!c.item && !c.rollT && (g.t < 14 || true)) {
      const td = best ? Math.hypot(best.x - c.x, best.z - c.z) : 1e9
      let bb = null, bd = 1e9
      for (const b of g.boxes) { if (!b.on) continue; const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < bd && Math.hypot(b.x - z.x, b.z - z.z) < z.r * 0.9) { bd = d; bb = b } }
      if (bb && (g.t < 14 || bd < 22 || bd < td * (c.stage >= 2 ? 1.2 : 0.5))) this.goal = bb // 始めの 14秒は箱を取りに散らばる
    }
  }
  // 歩き: いちばん良い空き車へ走る
  foot(dt) {
    const p = this.p, g = this.g, B = p.body, z = g.zone
    if (this.skip && g.t - (this.skipT || 0) > 20) { this.skip.clear(); this.skipT = g.t } // あきらめた車も 20秒たったら見直す
    this.think -= dt
    if (this.think <= 0 || !this.footGoal || !this.footGoal.alive || this.footGoal.driver) {
      this.think = 0.5
      let best = null, bs = 1e9
      for (const c of g.cars) {
        if (!c.alive || c.driver || c.stage >= 3 || c === this.avoidCar || (this.skip && this.skip.has(c)) || g.inRaid(c.x, c.z, 3) || c.groundAt(c.x, c.z) < -0.3) continue // 水に浸かった車は取りに行かない
        const d = Math.hypot(c.x - B.x, c.z - B.z), s = d + (c.T.bike ? 25 : 0) - c.hp * 0.15 - c.fuelK * 8 - (this.likes[c.type] || 0) + (Math.hypot(c.x - z.x, c.z - z.z) > z.r ? 60 : 0) + (c.fuel <= 0 ? 80 : 0)
        if (s < bs) { bs = s; best = c }
      }
      this.footGoal = best
    }
    // 迫ってくる車を横へ飛んでよける（たまに）
    if (!p.dive && g.t >= (p.diveReady || 0) && B.onGround) for (const c of g.cars) {
      const sp = Math.hypot(c.vx, c.vz); if (!c.alive || sp < 8 || c.driver === p) continue
      const rx = B.x - c.x, rz = B.z - c.z, ux = c.vx / sp, uz = c.vz / sp, along = rx * ux + rz * uz, lat = rx * uz - rz * ux
      if (along > 0 && along < 12 && Math.abs(lat) < 2.2 && this.rng() < 0.08) { const sg = lat >= 0 ? 1 : -1; p.input = { mx: uz * sg, mz: -ux * sg }; p.wantDive = true; return }
    }
    const G = this.footGoal
    if (G && Math.hypot(G.x - B.x, G.z - B.z) < 3.0 && p.stun <= 0) { g.enterCar(p, G); this.stuckT = 0; this.backT = 0; this.prog = null; this.chk = null; return }
    let tx = G ? G.x : z.x, tz = G ? G.z : z.z
    if (g.raid) { const RD = g.raid, dx = B.x - RD.x, dz = B.z - RD.z, d = Math.hypot(dx, dz) || 1; if (d < RD.r + 5) { tx = RD.x + dx / d * (RD.r + 12); tz = RD.z + dz / d * (RD.r + 12) } }
    // 歩きは人の升目（0.5m・戸口も通れる）で道をさがす
    const t = g.t
    const near = Math.hypot(tx - B.x, tz - B.z) < 4 || g.grid.clear(B.x, B.z, tx, tz) // まっすぐ行ける時は道をさがさない
    if (near) { this.fp = [[tx, tz]]; this.fpT = t; this.fpEnd = [tx, tz] }
    else if ((!this.fp || t - this.fpT > 2.5 || Math.hypot(this.fpEnd[0] - tx, this.fpEnd[1] - tz) > 4) && g.pathTake()) {
      this.fpT = t; this.fpEnd = [tx, tz]; this.fp = g.nav.path(B.x, B.z, tx, tz)
      if (this.fp && !this.fp.length) this.fp = [[tx, tz]] // 同じ升の中（道が0点）
      if (!this.fp) { if (G) (this.skip || (this.skip = new Set())).add(G); this.footGoal = null; this.fp = [[tx, tz]]; this.fpT = t + 1 }
    }
    if (!this.fp) { this.fp = [[tx, tz]]; this.fpEnd = [tx, tz]; this.fpT = t - 9 } // 順番待ちの間はまっすぐ（次のコマで道をさがす）
    const P = this.fp
    while (P.length > 1 && Math.hypot(P[0][0] - B.x, P[0][1] - B.z) < 1.2) P.shift()
    const q = P[0], d = Math.hypot(q[0] - B.x, q[1] - B.z) || 1
    p.input = { mx: (q[0] - B.x) / d, mz: (q[1] - B.z) / d }
    // 歩いても進まない（2.5秒で 1m 未満）時は、その車をあきらめる
    if (!this.fchk || t - this.fchk.t > 2.5) { if (this.fchk && Math.hypot(B.x - this.fchk.x, B.z - this.fchk.z) < 1 && G && p.stun <= 0) { (this.skip || (this.skip = new Set())).add(G); this.footGoal = null } this.fchk = { x: B.x, z: B.z, t } }
  }
  items(dt) {
    const c = this.c, g = this.g; if (!c) return; const it = c.item; if (!it || c.rollT > 0) return
    this.useT += dt
    const t = this.target, d = t ? Math.hypot(t.x - c.x, t.z - c.z) : 1e9
    const ahead = t ? Math.abs(ang(Math.atan2(t.x - c.x, t.z - c.z) - c.yaw)) : 9
    let go = false
    if (it === 'repair') go = c.stage >= 2 || (c.stage >= 1 && this.useT > 4)
    else if (it === 'ball') go = d < 42 && ahead < 0.2
    else if (it === 'spear') go = d < 26 && ahead < 0.45
    else if (it === 'jet') go = ((d < 36 && ahead < 0.25) || (c.stage >= 3 && this.useT > 2)) && c.fuelK > 0.12
    else if (it === 'magnet') go = d < 20
    else if (it === 'mine') { const behind = g.ps.some(o => o !== this.p && o.alive && Math.hypot(o.x - c.x, o.z - c.z) < 18 && Math.abs(ang(Math.atan2(o.x - c.x, o.z - c.z) - c.yaw)) > 2.3); go = behind || this.useT > 9 }
    if (!go && this.useT > 16) go = true
    if (go) { this.useT = 0; g.useItem(c) }
  }
}
