// 降下（2026-11-23 本人「pubgみたいに開始のばしょを選ぶ感じが欲しい」）。
// 全員が輸送機に乗って島の上を一直線に横切る。好きな所で飛び降り（veh キー）→ 自由落下 → 地面から 60m で傘が開く → 着地して普通の操作へ。
// 主（ホスト）が全員の降下を計算し、参加者は air の状態（0 地上・1 機内・2 落下・3 傘）を受け取って描くだけ。
// WRECK ISLE 用に fuse-isle の drop.js を写した物。降り先は車の置き場（this は Game）
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwuqry6n'
import { moveBody } from './collide.js?v=mwuqry6n'
import { DROP, planeAt, makePlane, makeChute } from './plane.js?v=mwuqry6n'

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const AIR_CODE = { plane: 1, fall: 2, chute: 3 }
export const AIR_MODE = [null, 'plane', 'fall', 'chute']

export const dropMethods = {
  // 試合の始まり: 全員が輸送機に乗る。CPU は降りる所と時刻を決める
  boardPlane(f) {
    const p = planeAt(this.path, 0), B = f.body
    f.air = { mode: 'plane', t: 0 }
    B.x = p.x; B.z = p.z; B.y = p.y - 2; B.vx = B.vy = B.vz = 0; B.onGround = false
    f.char.root.visible = false
  },
  // CPU の降り先: 進路から届く範囲（横 240m まで）の見どころ（上陸地点の一覧）から、先に決めた人と近すぎない所を優先して選ぶ。人気の所は少し固まってよい
  planDrops() {
    const P = this.path, bots = this.ps.filter(f => f.ai)
    const cand = []
    for (const c of this.cars) {
      if (!c.alive || c.driver) continue
      const dx = c.x - P.x0, dz = c.z - P.z0, st = dx * P.dx + dz * P.dz, L = Math.abs(-dx * P.dz + dz * P.dx)
      if (L > 240 || st < -120 || st > P.len + 120) continue
      cand.push({ x: c.x, z: c.z, st, L, n: 0 })
    }
    if (!cand.length) cand.push({ x: DROP.center[0], z: DROP.center[1], st: P.len / 2, L: 0, n: 0 })
    for (const f of bots) {
      let best = null, bs = 1e9
      for (const c of cand) { const sc = c.n * 2.5 + this.rng() * 3.2; if (sc < bs) { bs = sc; best = c } }
      for (const c of cand) if (Math.hypot(c.x - best.x, c.z - best.z) < 30) c.n++
      const D = Math.min(275, Math.max(45, best.L + 25 + this.rng() * 70)), sj = best.st - Math.sqrt(Math.max(0, D * D - best.L * best.L))
      // 車のすぐ横（4〜7m）の走れる所に降りる（水際の車で海に降りていた）
      let px = best.x, pz = best.z
      for (let k = 0; k < 16; k++) { const a = this.rng() * 6.28, r = 4 + this.rng() * 3, x = best.x + Math.cos(a) * r, z = best.z + Math.sin(a) * r; if (this.grid.free(x, z) && this.grid.free(x + 3, z) && this.grid.free(x - 3, z) && this.grid.free(x, z + 3) && this.grid.free(x, z - 3)) { px = x; pz = z; break } }
      f.plan = { x: px, z: pz, jumpAt: clamp(sj, 1, P.len - 1) / P.speed + this.rng() * 0.4 }
    }
  },
  // 好きな時に降りる: 機内なら飛び降りる・落下中なら傘を早く開く
  airAct(f) {
    const A = f.air; if (!A || !f.alive) return
    if (A.mode === 'plane') this.jumpOut(f)
    else if (A.mode === 'fall' && A.t > 0.3) A.open = true
  },
  jumpOut(f) {
    const A = f.air, P = this.path, B = f.body
    if (!A || A.mode !== 'plane') return
    A.mode = 'fall'; A.t = 0; A.open = false
    const p = planeAt(P, this.t)
    B.x = p.x; B.z = p.z; B.y = p.y - 3; B.vx = P.dx * P.speed * 0.9; B.vz = P.dz * P.speed * 0.9; B.vy = 0
    f.yaw = f.aimYaw || 0; f.char.root.visible = true; f.char.prevG = false
    f.jumpAt = { t: this.t, x: B.x, z: B.z }
    if (f === this.me) this.bigMap = false
  },
  openChute(f) {
    const A = f.air; if (!A || A.mode !== 'fall') return
    A.mode = 'chute'; A.t = 0
    this.sound('chute', f.body, 0.8)
  },
  // 空の上の人の動き（plane・fall・chute）。着地したら air を外して、いつもの動きへ
  updateAir(f, dt) {
    const A = f.air, B = f.body, P = this.path
    if (A.mode === 'plane') {
      const p = planeAt(P, this.t)
      B.x = p.x; B.z = p.z; B.y = p.y - 2; B.vx = P.dx * P.speed; B.vz = P.dz * P.speed; B.vy = 0; B.onGround = false; B.airT = 0
      if (f.plan && this.t >= f.plan.jumpAt) this.jumpOut(f)
      if (this.t >= DROP.T) this.jumpOut(f) // 進路の終わりまで降りなければ自動で降ろす
      return
    }
    if (f.ai) this.botAir(f)
    const inp = f.input || {}, ml = clamp(Math.hypot(inp.mx || 0, inp.mz || 0), 0, 1), mx = ml > 0.02 ? inp.mx / Math.hypot(inp.mx, inp.mz) : 0, mz = ml > 0.02 ? inp.mz / Math.hypot(inp.mx, inp.mz) : 0
    const ay = f.aimYaw || 0, fx = Math.sin(ay), fz = Math.cos(ay), fdot = ml > 0.02 ? mx * fx + mz * fz : 0
    const alt = B.y - Math.max(0, this.world.H(B.x, B.z))
    A.t += dt
    if (A.mode === 'fall') {
      // 体を前に傾けて（前へ）速く落ちる・流れる。傾けなければ体を広げてゆっくり。輸送機の勢いは少しずつ消える
      const dive = ml > 0.02 && fdot > 0.6, term = dive ? 40 : 26
      B.vy = Math.max(B.vy - 24 * dt, -term); if (B.vy < -term) B.vy += (-term - B.vy) * Math.min(1, dt * 4)
      const sp = dive ? 24 : 9 * ml, k = Math.min(1, dt * 1.6)
      B.vx += (mx * sp - B.vx) * k; B.vz += (mz * sp - B.vz) * k
      A.dive = dive
      if (A.open || alt < DROP.openAlt) this.openChute(f)
    } else {
      // 傘: 前で速く進んで速く降りる・後ろでゆっくり・何も押さなければ少し前へ流れながら降りる（60m から約 15秒）
      let base, sink
      if (ml > 0.02) { base = (fdot >= 0 ? 11 + 9 * fdot : 11 + 6 * fdot) * ml; sink = fdot >= 0 ? 3.4 + 2.8 * fdot : 3.4 + 1.2 * fdot }
      else { base = 3; sink = 3.3 }
      const tx = ml > 0.02 ? mx * base : fx * base, tz = ml > 0.02 ? mz * base : fz * base, k = Math.min(1, dt * 1.8)
      B.vx += (tx - B.vx) * k; B.vz += (tz - B.vz) * k
      B.vy += (-sink - B.vy) * Math.min(1, dt * 2)
    }
    B.h = 1.75; B.hitWall = 0
    f.yaw += wrap(ay - f.yaw) * Math.min(1, dt * 6)
    moveBody(this.world, B, dt)
    B.airT = (B.airT || 0) + dt
    if (B.onGround && A.t > 0.2) this.landFromAir(f)
    else if (B.y < -1.3) this.landFromAir(f) // 海へ降りた（海に落ちた扱いは、このあと通常の動きの側で）
  },
  landFromAir(f) {
    const B = f.body
    f.air = null; f.landAt = { t: this.t, x: B.x, z: B.z }
    B.vx *= 0.3; B.vz *= 0.3; B.vy = 0; B.airT = 1
    this.clearAir(f)
    this.sound('thud', B, 0.5)
  },
  // 空の見た目を片づける（着地・やられた・試合のやり直し）
  clearAir(f) {
    if (f.chute) { this.scene.remove(f.chute); f.chute = null }
    const c = f.char; c.air = null; c.airPitch = 0
  },
  // 見た目（主も参加者も同じ）: 体の向き・傘の開き・傘のゆれ
  syncAir(f, dt) {
    const A = f.air, c = f.char, B = f.body
    c.air = A.mode
    const want = A.mode === 'fall' ? (A.dive ? 1.95 : 1.3) : 0
    c.airPitch += (want - c.airPitch) * Math.min(1, dt * 5)
    if (A.mode === 'chute') {
      if (!f.chute) { f.chute = makeChute(f.nid || 0); f.chuteT = 0; f.chute.userData.cano.scale.setScalar(0.05); this.scene.add(f.chute) }
      f.chuteT += dt
      const k = clamp(f.chuteT / 0.55, 0, 1), e = 1 - Math.pow(1 - k, 3), ov = k < 1 ? Math.sin(k * Math.PI) * 0.12 : 0
      const ch = f.chute, cano = ch.userData.cano
      cano.scale.set(0.2 + 0.8 * e + ov, 0.1 + 0.9 * e - ov * 0.5, 0.2 + 0.8 * e + ov)
      ch.visible = true
      ch.position.set(B.x, B.y, B.z)
      const t = performance.now() / 1000 + (f.nid || 0) * 1.7
      ch.rotation.set(Math.sin(t * 0.9) * 0.04 - clamp(Math.hypot(B.vx, B.vz) / 70, 0, 0.2), f.yaw, Math.sin(t * 0.7) * 0.05)
      ch.userData.lines.visible = e > 0.5
    } else if (f.chute) { this.scene.remove(f.chute); f.chute = null }
  },
  // CPU の降下の操縦: 降りる先の上へ。遠ければ体を前に倒して速く、近づいたら小さく押して止まる
  botAir(f) {
    const p = f.plan, B = f.body; if (!p) return
    const dx = p.x - B.x, dz = p.z - B.z, d = Math.hypot(dx, dz) || 1
    f.aimYaw = Math.atan2(dx, dz)
    const m = f.air && f.air.mode === 'fall' ? (d > 60 ? 1 : 0.5) : d > 45 ? 1 : clamp(d / 45, 0.15, 1)
    f.input = { mx: dx / d * m, mz: dz / d * m }
  },
  // 輸送機の模型（毎コマ）
  syncPlane(dt) {
    const m = this.planeMesh; if (!m || !this.path) return
    const t = this.t, on = this.dropOn && t < DROP.T + 9
    m.visible = on
    if (!on) return
    const P = this.path, k = P.speed * t
    m.position.set(P.x0 + P.dx * k, P.alt + Math.sin(t * 0.9) * 0.4, P.z0 + P.dz * k)
    m.rotation.set(Math.sin(t * 0.7) * 0.012, Math.atan2(P.dx, P.dz), Math.sin(t * 0.55) * 0.035)
    const pr = m.userData.prop; if (pr) pr.rotation.z += dt * 55
  },
  // 音: 輸送機のエンジン（距離で小さく）・落下中の風
  airAudio() {
    const S = window.Snd; if (!S || !S.ctx || !this.audioOn) return
    const lp = S.loops, now = S.ctx.currentTime, set = (n, v) => { const l = lp[n]; if (l && l.g) l.g.gain.setTargetAtTime(v, now, 0.12) }
    const wantPlane = this.dropOn && this.mode === 'play' && !this.over && this.t < DROP.T + 7
    if (wantPlane && !lp.plane) S.loop('plane', 'snd/plane.mp3', 0.0001, 0.3)
    if (!wantPlane && lp.plane) S.loop('plane', null, 0, 0.5)
    if (lp.plane && this.planeMesh) { const d = this.camera.position.distanceTo(this.planeMesh.position); set('plane', 0.75 / (1 + d / 55)) }
    const m = this.me && this.me.air && this.me.alive ? this.me.air.mode : null
    if ((m === 'fall' || m === 'chute') && !lp.fall) S.loop('fall', 'snd/fall.mp3', 0.0001, 0.3)
    if (!m && lp.fall) S.loop('fall', null, 0, 0.5)
    if (lp.fall) { const sp = Math.hypot(this.me.body.vx, this.me.body.vy, this.me.body.vz); set('fall', m === 'fall' ? 0.12 + 0.55 * clamp(sp / 40, 0, 1) : 0.1) }
  },
  // 画面の下の文字
  dropHud() {
    const el = document.getElementById('dropx'); if (!el) return
    const f = this.me, A = f.air
    if (!A || !f.alive || (this.bigMap && A.mode === 'plane')) { el.classList.remove('on'); return }
    let h = ''
    const key = 'F'
    if (A.mode === 'plane') h = tr(`<kbd>${key}</kbd>降りる<i>進路の終わりまで あと ${Math.max(0, Math.ceil(DROP.T - this.t))}秒</i>`, `<kbd>${key}</kbd>Jump<i>${Math.max(0, Math.ceil(DROP.T - this.t))}s until the end of the route</i>`)
    else if (A.mode === 'fall') h = tr(`<kbd>${key}</kbd>傘を開く<i>高さ ${Math.max(0, Math.round(f.body.y - Math.max(0, this.world.H(f.body.x, f.body.z))))}m・${DROP.openAlt}m で自動</i>`, `<kbd>${key}</kbd>Open chute<i>${Math.max(0, Math.round(f.body.y - Math.max(0, this.world.H(f.body.x, f.body.z))))}m · auto at ${DROP.openAlt}m</i>`)
    else h = `<i>${tr('高さ ', '')}${Math.max(0, Math.round(f.body.y - Math.max(0, this.world.H(f.body.x, f.body.z))))}m</i>`
    if (el._h !== h) { el.innerHTML = h; el._h = h }
    el.classList.add('on')
  },
  // 試合の始まりに呼ぶ: 輸送機の模型・カメラ
  resetDropVisual() {
    for (const f of this.ps) this.clearAir(f)
    if (!this.planeMesh) { this.planeMesh = makePlane(); this.planeMesh.visible = false; this.scene.add(this.planeMesh) }
    this.bigMap = !!this.dropOn
  },
}
