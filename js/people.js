// 乗っている人（あなた・CPU）。車を降りると人として走れる。人は無力: 攻撃できず、車に当たると吹っ飛んですぐやられる
// 負け: 人がやられる（車が爆発した時に乗っていた・はねられた・円の外・海）
import * as THREE from 'three'
import { L as tr, EN } from './i18n.js?v=mwuc41ax'
import { moveBody } from './collide.js?v=mwuc41ax'
import { Char, LOOKS } from './chars.js?v=mwuc41ax'

export const FOOT = { hp: 60, run: 4.4, dash: 6.2, cpuRun: 5.4, reach: 3.4 } // 歩き 4.4・Shift で 6.2（FUSE ISLE と同じ）
const LK = ['player', 'fisher', 'hoodie', 'work', 'elder', 'jersey']

export class Person {
  constructor(game, idx, name, isPlayer) {
    this.g = game; this.idx = idx; this.name = name; this.isPlayer = isPlayer
    this.char = new Char(game.scene, LOOKS[LK[idx % LK.length]]); this.char.root.visible = false
    this.alive = true; this.car = null; this.hp = FOOT.hp; this.stun = 0; this.kills = 0; this.yaw = 0; this.stepAcc = 0
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.75, onGround: true, airT: 0, crouch: false }
    this.input = { mx: 0, mz: 0 }
    this.air = null; this.plan = null; this.chute = null; this.aimYaw = 0; this.nid = idx
  }
  get x() { return this.car ? this.car.x : this.body.x }
  get z() { return this.car ? this.car.z : this.body.z }
  get y() { return this.car ? this.car.y : this.body.y }
  get vx() { return this.car ? this.car.vx : this.body.vx }
  get vz() { return this.car ? this.car.vz : this.body.vz }
  remove() { this.char.remove(this.g.scene); if (this.chute) this.g.scene.remove(this.chute) }
}

export const peopleMethods = {
  enterCar(p, c) {
    if (!p.alive || !c.alive || c.driver || p.car) return false
    c.driver = p; p.car = c; p.char.root.visible = !!c.T.bike; if (p.dive) this.endDive(p); if (this.t > 0) this.ev.enters++
    if (c.item == null && p.heldItem) { c.item = p.heldItem } p.heldItem = null
    this.sound('latch', c, 0.6)
    if (p.isPlayer) this.toast(EN ? `${c.T.en} — ${c.T.noteEn}` : `${c.T.name}　${c.T.note}`)
    if (c.T.bike) this.sound('bell', c, 0.5)
    return true
  },
  // 降りる。eject: 走っている車から飛び降りる（転がって少し痛い）
  exitCar(p) {
    const c = p.car; if (!c) return
    const sp = Math.hypot(c.vx, c.vz)
    c.driver = null; p.car = null; c.input = { throttle: 0, steer: 0 }; c.exDriver = p; c.exT = this.t; this.ev.exits++
    let x, z, y = c.y
    for (const [a, s] of [[0.3, -1.5], [0.3, 1.5], [-2.7, 0], [2.7, 0]]) {
      ;[x, z] = c.world(a, s); y = c.groundAt(x, z)
      const inBox = this.world.near(x - 0.35, z - 0.35, x + 0.35, z + 0.35).some(b => !b.dead && (b.kind === 'solid' || b.kind === 'edge') && b.min[1] < y + 1.6 && b.max[1] > y + 0.45 && x + 0.33 > b.min[0] && x - 0.33 < b.max[0] && z + 0.33 > b.min[2] && z - 0.33 < b.max[2])
      if (y > -0.4 && !inBox) break
    }
    const B = p.body; B.x = x; B.z = z; B.y = Math.max(y, -0.3); B.vx = c.vx * 0.6; B.vz = c.vz * 0.6; B.vy = 0; B.onGround = true
    p.yaw = c.yaw; p.char.root.visible = true; p.char.yaw = p.yaw
    p.char.root.position.set(B.x, B.y, B.z)
    if (sp > 7) { B.vy = 3; B.onGround = false; p.stun = 0.9; p.char.knock(); this.hurtPerson(p, (sp - 7) * 1.2, null, 'jump'); this.sound('thud', B, 0.8) }
    else this.sound('latch', B, 0.5)
    p.exitT = this.t
  },
  nearEmptyCar(p, R = FOOT.reach) {
    let best = null, bd = R
    for (const c of this.cars) { if (!c.alive || c.driver) continue; const d = Math.hypot(c.x - p.body.x, c.z - p.body.z); if (d < bd) { bd = d; best = c } }
    return best
  },
  updatePerson(p, dt) {
    if (p.car) return
    const B = p.body
    if (p.air && p.alive) { this.updateAir(p, dt); if (p.air) { if (p.air.mode !== 'plane') { this.syncAir(p, dt); p.char.update(dt, B) } return } p.yaw = p.aimYaw || p.yaw }
    if (!p.alive) { p.deadT2 = (p.deadT2 || 0) + dt; if (p.deadT2 > 3 && B.onGround) return; B.vx *= 0.9; B.vz *= 0.9; B.vy -= 20 * dt; moveBody(this.world, B, dt); p.char.update(dt, B); return }
    p.stun = Math.max(0, p.stun - dt)
    const inp = p.input || {}, maxS = p.isPlayer ? (inp.run ? FOOT.dash : FOOT.run) : FOOT.cpuRun
    // 飛び込み（FUSE ISLE と同じ: 0.25秒で 3.5m 飛ぶ → 0.5秒伏せる → 0.5秒で起きる。終わってから 1.2秒は次を飛べない）
    if (p.wantDive) { p.wantDive = false; this.startDive(p, inp.mx || 0, inp.mz || 0) }
    if (p.dive) {
      const dv = p.dive; dv.t += dt; const T = dv.t
      if (T < 0.25) { B.vx = dv.dx * 14; B.vz = dv.dz * 14 } else if (T < 0.75) { const kk = Math.exp(-dt * 20); B.vx *= kk; B.vz *= kk } else { B.vx = B.vz = 0 }
      B.vy -= 20 * dt; B.hitWall = 0; B.h = 0.8
      moveBody(this.world, B, dt); p.yaw = Math.atan2(dv.dx, dv.dz); p.char.yaw = p.yaw; p.char.update(dt, B)
      if (T >= 1.25 || p.stun > 0) this.endDive(p)
      return
    }
    const tx = (inp.mx || 0) * maxS, tz = (inp.mz || 0) * maxS
    const ctl = p.stun > 0 ? 0.04 : B.onGround ? 1 : 0.12, k = Math.min(1, dt * 12 * ctl)
    if (B.onGround && p.stun <= 0) { B.vx += (tx - B.vx) * k; B.vz += (tz - B.vz) * k }
    else if (B.onGround) { const fr = p.char.down ? 9 : 6; B.vx *= 1 - dt * fr; B.vz *= 1 - dt * fr }
    if ((p.wantJump || inp.jump) && B.onGround && p.stun <= 0) { B.vy = 5.4; B.onGround = false } // FUSE ISLE と同じ跳び
    p.wantJump = false
    B.vy -= 20 * dt; B.hitWall = 0; B.h = 1.75
    moveBody(this.world, B, dt)
    const sp = Math.hypot(B.vx, B.vz)
    if (sp > 0.6 && p.stun <= 0) { let dy = Math.atan2(B.vx, B.vz) - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 10) }
    p.char.yaw = p.yaw; p.char.lookYaw = null
    p.char.update(dt, B)
    if (B.onGround && sp > 1) { p.stepAcc += dt * sp * 0.5; if (p.stepAcc > 1) { p.stepAcc = 0; this.sound('step', B, p.isPlayer ? 0.25 : 0.3) } }
    if (B.y < -1.2) { this.fx.splash(new THREE.Vector3(B.x, -1.4, B.z)); this.killPerson(p, null, 'sea') }
  },
  startDive(p, dx, dz) {
    const B = p.body
    if (!p.alive || p.dive || p.car || p.air || p.stun > 0 || !B.onGround || this.t < (p.diveReady || 0)) return false
    let l = Math.hypot(dx, dz); if (l < 0.01) { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); l = 1 }
    p.dive = { t: 0, dx: dx / l, dz: dz / l }; p.diveReady = 1e9
    B.vy = 2.4; B.onGround = false; p.char.dive(); this.sound('thud', B, 0.35)
    return true
  },
  endDive(p) { if (!p.dive) return; p.dive = null; p.diveReady = this.t + 1.2; p.body.h = 1.75; p.char.endDive() },
  // ぎりぎりの回避（FUSE ISLE と同じ演出: 青い「回避」と、全体の音を少しこもらせる）
  nearMiss(p) { if (this.t - (p.avoidAt || -9) < 1.2) return; p.avoidAt = this.t; this.ev.avoids = (this.ev.avoids || 0) + 1; if (p === this.me) { this.toast(tr('回避', 'DODGE'), 'avoid'); if (window.Snd && window.Snd.muffle) window.Snd.muffle(1.2) } },
  // 車が人に当たる: 速ければ吹っ飛ばしてすぐやられる
  personHits() {
    for (const p of this.ps) {
      if (p.car || p.air || !p.alive && p.char.dead) continue
      const B = p.body
      for (const c of this.cars) {
        if (c.driver === p) continue
        const [a, b] = c.local(B.x, B.z)
        const HA = c.T.half[0], HB = c.T.half[1]
        // ぎりぎりでよけた: 速い車が 2.5m 以内を通ったのに当たらなかった（飛び込みの最中か直後）
        const spc = Math.hypot(c.vx, c.vz)
        if (spc > 8 && (p.dive || this.t - (p.diveReady || -9) < 0.3) && Math.abs(a) < HA + 2.5 && Math.abs(b) < HB + 2.5 && (Math.abs(a) > HA + B.r || Math.abs(b) > HB + B.r)) this.nearMiss(p)
        if (Math.abs(a) > HA + B.r || Math.abs(b) > HB + B.r || B.y > c.y + c.T.h || B.y < c.y - 1) continue
        const sp = Math.hypot(c.vx, c.vz)
        if (sp > 2.5 && this.t - (p.ramT || -9) > 0.6) {
          p.ramT = this.t
          const by = c.driver && c.driver !== p ? c.driver : null
          B.vx = c.vx * 1.05; B.vz = c.vz * 1.05; B.vy = 3.5 + sp * 0.35; B.onGround = false; p.stun = 1.2
          if (!p.char.dead) p.char.knock()
          this.sound('thud', B, 1); this.sound('hitl', B, 0.7)
          if (c.driver === this.me || p === this.me) { this.stopT = Math.max(this.stopT, 0.08); this.fx.shake = Math.min(1.4, this.fx.shake + 0.5) }
          this.hurtPerson(p, (sp - 3) * 5.5 * Math.sqrt(c.T.mass), by, 'ram')
        }
        // 押し出す
        const pa = HA + B.r - Math.abs(a), pb = HB + B.r - Math.abs(b)
        const [wx, wz] = pa < pb ? c.world(Math.sign(a) * (HA + B.r), b) : c.world(a, Math.sign(b) * (HB + B.r))
        B.x = wx; B.z = wz
      }
    }
  },
  hurtPerson(p, d, by, how) {
    if (!p.alive || p.car) return
    p.hp -= d; if (by) { p.lastBy = by; p.lastByT = this.t }
    if (p === this.me) this.hurtK = Math.min(1, (this.hurtK || 0) + d / 30)
    if (p.hp <= 0) this.killPerson(p, by || (p.lastBy && this.t - p.lastByT < 6 ? p.lastBy : null), how)
  },
  killPerson(p, by, how) {
    if (!p.alive) return
    p.alive = false; p.hp = 0; p.deadT = this.t; p.killedBy = by; p.how = how
    p.deathAt = [Math.round(p.x), Math.round(p.z), p.car ? 'car' : p.air ? 'air' : 'foot', Math.round(this.t)]
    p.place = this.ps.filter(x => x.alive).length + 1
    if (by && by !== p) by.kills++
    if (p.car) { const c = p.car; Object.assign(p.body, { x: c.x, y: c.y, z: c.z, vx: 0, vy: 0, vz: 0 }); c.driver = null; p.car = null }
    else { p.char.root.visible = true; p.char.die() }
    const who = p === this.me ? tr('あなた', 'You') : p.name
    const whom = p === this.me ? 'you' : who // 英語: 目的語は小文字
    const txt = EN ? (how === 'boom' ? (by && by !== p ? `${by.name} blew up ${whom}` : `${who} blew up`) : how === 'ram' ? (by ? `${by.name} ran over ${whom}` : `${who} got run over`) : how === 'zone' ? `${who} gave out outside the circle` : how === 'sea' ? `${who} fell into the sea` : how === 'raid' || (how === 'boom' && !by && !p.car) ? `${who} got hit by the air raid` : by ? `${by.name} took out ${whom}` : `${who} is out`) : how === 'boom' ? (by && by !== p ? `${by.name} が ${who} を車ごと爆破` : `${who} が車ごと爆発`) : how === 'ram' ? (by ? `${by.name} が ${who} をはねた` : `${who} がはねられた`) : how === 'zone' ? `${who} が円の外で力尽きた` : how === 'sea' ? `${who} が海に落ちた` : how === 'raid' || (how === 'boom' && !by && !p.car) ? `${who} が爆撃にやられた` : by ? `${by.name} が ${who} を倒した` : `${who} がやられた`
    this.feed.unshift({ t: this.t, txt })
    if (p === this.me) { this.slowT = 1.1; this.sound('lose', p, 0.6, { delay: 0.6 }) }
    else if (by === this.me) this.toast(how === 'ram' ? tr('はねた', 'RUN OVER') : tr('爆破', 'BLOWN UP'))
    const alive = this.ps.filter(x => x.alive)
    if (alive.length <= 1 && !this.over) { this.over = true; this.winner = alive[0] || null; this.overT = 0; this.decidedAt = this.t; if (this.winner === this.me) this.sound('win', this.winner, 0.7, { delay: 0.8 }) }
  },
}
