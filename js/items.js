// アイテム: 島に散らした箱を拾うとくじ。壊れかけほど強い物が出やすい
// 鉄球（前に転がす）／槍（正面で勝つ）／ジェット（加速・体当たり2倍）／地雷（後ろに置く・踏むと真上に跳ねる）／磁石（近くの車を引き寄せる）／修理（1段階戻す）
import * as THREE from 'three'
import { pushOut } from './collide.js?v=mwuqry6n'
import { bombMesh, mineLook } from './bombs.js?v=mwuqry6n'
import { REPAIR_TO } from './car.js?v=mwuqry6n'

export const ITEMS = { ball: '鉄球', spear: '槍', jet: 'ジェット', mine: '地雷', magnet: '磁石', repair: '修理' }
export const ITEMS_EN = { ball: 'Wrecking Ball', spear: 'Spear', jet: 'Jet', mine: 'Mine', magnet: 'Magnet', repair: 'Repair' }
export const KINDS = Object.keys(ITEMS)
// 壊れの段階ごとの出やすさ（0 きれい → 3 火が出ている）
const W = [
  { ball: 20, spear: 10, jet: 15, mine: 30, magnet: 25, repair: 0 },
  { ball: 22, spear: 15, jet: 18, mine: 20, magnet: 15, repair: 10 },
  { ball: 22, spear: 22, jet: 20, mine: 8, magnet: 10, repair: 18 },
  { ball: 20, spear: 26, jet: 22, mine: 2, magnet: 8, repair: 22 },
]
export const SPEAR_T = 5, JET_T = 3, MAG_T = 3.2, ROLL_T = 1.1

// 箱: 工事現場の資材箱（黒と黄の縞の帯）
function boxTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')
  g.fillStyle = '#4a4d45'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,20,18' : '120,118,105'},${Math.random() * 0.15})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3) }
  g.save(); g.beginPath(); g.rect(0, 92, 256, 72); g.clip(); g.fillStyle = '#e0b021'; g.fillRect(0, 92, 256, 72); g.fillStyle = '#1b1b19'
  for (let x = -100; x < 300; x += 44) { g.beginPath(); g.moveTo(x, 92); g.lineTo(x + 22, 92); g.lineTo(x + 22 + 72, 164); g.lineTo(x + 72, 164); g.fill() }
  g.restore()
  g.strokeStyle = '#2b2d28'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
let BOXM = null
function boxMesh() {
  if (!BOXM) BOXM = { m: new THREE.MeshStandardMaterial({ map: boxTex(), roughness: 0.6, metalness: 0.35 }), ring: new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }) }
  const g = new THREE.Group()
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), BOXM.m); b.castShadow = true; b.position.y = 0.95; g.add(b); g.userData.box = b
  const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), BOXM.ring); r.rotation.x = -Math.PI / 2; r.position.y = 0.05; g.add(r)
  return g
}
const IRON = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.35, metalness: 0.9 })

export const itemMethods = {
  placeBoxes(spots) {
    for (const b of this.boxes || []) this.scene.remove(b.mesh)
    this.boxes = spots.map(([x, z]) => { const y = this.grid.h[this.grid.cell(x, z)[1] * this.grid.nx + this.grid.cell(x, z)[0]]; const mesh = boxMesh(); mesh.position.set(x, y, z); this.scene.add(mesh); return { x, z, y, on: true, t: 0, mesh, spin: this.rng() * 6 } })
  },
  updateBoxes(dt) {
    for (const b of this.boxes) {
      if (!b.on) { b.t -= dt; if (b.t <= 0) { b.on = true; b.mesh.visible = true } continue }
      b.spin += dt * 0.9; const m = b.mesh.userData.box; m.rotation.y = b.spin; m.rotation.x = 0.35; m.rotation.z = 0.25; m.position.y = 0.95 + Math.sin(b.spin * 2) * 0.12
      for (const c of this.cars) {
        if (!c.alive || !c.driver || c.T.bike || Math.hypot(c.x - b.x, c.z - b.z) > 2.3) continue
        b.on = false; b.t = 9; b.mesh.visible = false
        this.sound('boxbreak', b, 0.8)
        const p = new THREE.Vector3(b.x, b.y + 1, b.z), v = new THREE.Vector3(c.vx * 0.5, 2, c.vz * 0.5)
        this.debris.chip(p, v, 0xe0b021, 10); this.debris.chip(p, v, 0x3b3d38, 8)
        if (!c.item && !(c.rollT > 0)) this.roll(c)
        break
      }
    }
  },
  pickKind(c) {
    const w = W[c.stage], tot = KINDS.reduce((s, k) => s + w[k], 0); let r = this.rng() * tot
    for (const k of KINDS) { if ((r -= w[k]) < 0) return k } return 'ball'
  },
  roll(c) { c.rollT = ROLL_T; c.rollPick = this.pickKind(c); this.ev.boxes++ },
  updateRoll(c, dt) {
    if (!(c.rollT > 0)) return
    c.rollT -= dt
    if (c === this.player) { this.tickAcc = (this.tickAcc || 0) + dt; if (this.tickAcc > 0.09) { this.tickAcc = 0; this.sound('tick', c, 0.35) } }
    if (c.rollT <= 0) { c.rollT = 0; c.item = c.rollPick; if (c === this.player) this.sound('latch', c, 0.7) }
  },
  useItem(c) {
    if (c.T.bike) { if (this.t - (c.bellT || -9) > 0.6) { c.bellT = this.t; this.sound('bell', c, 0.9) } return } // 自転車はベル
    const k = c.item; if (!k || !c.alive) return
    c.item = null; this.ev.used[k] = (this.ev.used[k] || 0) + 1
    const [fx, fz] = c.fwd()
    if (k === 'ball') {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), IRON); mesh.castShadow = true; this.scene.add(mesh)
      const vf = Math.max(0, c.speed), x = c.x + fx * 3.0, z = c.z + fz * 3.0
      this.balls.push({ x, z, y: c.y + 0.75, vx: fx * (vf + 15), vz: fz * (vf + 15), vy: 0, r: 0.75, owner: c, t: 0, mesh, rollAcc: 0 })
      this.sound('roll', c, 0.9)
    } else if (k === 'spear') { c.spearT = SPEAR_T; c.v3.spear.visible = true; this.sound('spear', c, 0.9) }
    else if (k === 'jet') { c.jetT = JET_T; c.v3.jet.visible = true; this.sound('jet', c, 1) }
    else if (k === 'magnet') { c.magT = MAG_T; c.v3.magnet.visible = true; this.sound('magnet', c, 0.8, { offset: 1 }) }
    else if (k === 'mine') {
      const mesh = bombMesh('mine'); mesh.scale.setScalar(3.2)
      const x = c.x - fx * 3.0, z = c.z - fz * 3.0, y = Math.max(c.groundAt(x, z), -0.2)
      mesh.position.set(x, y, z); this.scene.add(mesh)
      this.mines.push({ x, z, y, owner: c, t: 0, state: 0, trigT: 0, mesh })
      this.sound('latch', c, 0.6)
    } else if (k === 'repair') {
      c.hp = Math.max(c.hp, REPAIR_TO[c.stage]); c.wear(); this.sound('repair', c, 0.9)
      const T = window.__fxT
      for (let i = 0; i < 16; i++) this.fx.sprite({ map: T.soft, add: true, pos: new THREE.Vector3(c.x + (Math.random() - 0.5) * 2, c.y + 0.6 + Math.random() * 1.2, c.z + (Math.random() - 0.5) * 2), vel: new THREE.Vector3(0, 2 + Math.random() * 2, 0), size: 0.12, life: 0.6 + Math.random() * 0.4, hdr: [1.6, 1.9, 1.3], drag: 1, fadeIn: 0.05 })
    }
  },
  updateItems(dt) {
    for (const c of this.cars) {
      this.updateRoll(c, dt)
      if (c.spearT > 0) { c.spearT -= dt; const s = c.v3.spear; s.scale.x = Math.min(1, s.scale.x + dt * 7); if (c.spearT <= 0 || !c.alive) { c.spearT = 0; s.visible = false; s.scale.x = 0.01 } }
      if (c.jetT > 0) { c.jetT -= dt; if (c.jetT <= 0 || !c.alive) { c.jetT = 0; c.v3.jet.visible = false } }
      if (c.magT > 0) {
        c.magT -= dt; c.v3.magnet.rotation.y += dt * 5
        if (c.magT <= 0 || !c.alive) { c.magT = 0; c.v3.magnet.visible = false; continue }
        for (const o of this.cars) {
          if (o === c || !o.alive) continue
          const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz); if (d > 30 || d < 3) continue
          const a = (7 + 17 * (1 - d / 30)) * dt; o.vx += dx / d * a; o.vz += dz / d * a; o.slideT = Math.max(o.slideT, 0.15)
          if (Math.random() < dt * 14) { const k = Math.random(), T = window.__fxT; this.fx.sprite({ map: T.soft, add: true, pos: new THREE.Vector3(o.x + dx * k, 1.4 + Math.sin(k * 3.14) * 1.2 + (c.y + o.y) / 2, o.z + dz * k), vel: new THREE.Vector3(dx / d * 12, 0, dz / d * 12), size: 0.07, life: 0.3, hdr: [1.2, 2.2, 4.5], drag: 0.3, fadeIn: 0 }) }
        }
      }
    }
    // 鉄球
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]; b.t += dt
      const gy = b.owner.groundAt.call({ g: this, y: b.y - b.r }, b.x, b.z)
      if (b.t > 9 || gy < -3) { this.scene.remove(b.mesh); this.balls.splice(i, 1); if (gy < -3) this.fx.splash(new THREE.Vector3(b.x, 0, b.z)); continue }
      b.vx *= Math.exp(-dt * 0.12); b.vz *= Math.exp(-dt * 0.12)
      const c = { x: b.x + b.vx * dt, z: b.z + b.vz * dt, y: b.y - b.r + 0.2, h: 1.3, r: b.r, vx: b.vx, vz: b.vz }
      const x0 = c.x, z0 = c.z; pushOut(this.world, c)
      const dx = c.x - x0, dz = c.z - z0, dd = Math.hypot(dx, dz)
      if (dd > 0.002) { const nx = dx / dd, nz = dz / dd, vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= nx * vn * 1.6; b.vz -= nz * vn * 1.6; if (-vn > 4) this.sound('hitl', b, 0.6) } }
      b.x = c.x; b.z = c.z
      const g2 = this.world.H(b.x, b.z) < -0.4 && gy < -0.4 ? -9 : gy
      if (b.y - b.r > g2 + 0.05) { b.vy -= 22 * dt; b.y += b.vy * dt; if (b.y - b.r < g2) { b.y = g2 + b.r; b.vy = 0 } } else { b.y = g2 + b.r; b.vy = 0 }
      const sp = Math.hypot(b.vx, b.vz)
      if (sp > 0.1) { const ax = new THREE.Vector3(b.vz, 0, -b.vx).normalize(); b.mesh.rotateOnWorldAxis(ax, sp * dt / b.r) }
      b.mesh.position.set(b.x, b.y, b.z)
      b.rollAcc += dt; if (b.rollAcc > 0.5 && sp > 3) { b.rollAcc = 0; this.sound('roll', b, Math.min(0.6, sp / 30)) }
      for (const p of this.ps) if (p.alive && !p.car && Math.hypot(p.body.x - b.x, p.body.z - b.z) < b.r + 0.4 && Math.hypot(b.vx, b.vz) > 2) { const B = p.body; B.vx = b.vx; B.vz = b.vz; B.vy = 5; B.onGround = false; p.stun = 1.2; p.char.knock(); this.sound('thud', B, 1); this.hurtPerson(p, 99, b.owner.driver, 'ball') }
      for (const o of this.cars) {
        if (o === b.owner && b.t < 1.0) continue
        if (b.hitT && b.t - b.hitT < 0.5) continue
        let hit = null
        for (const [cx, cz] of o.circles()) if (Math.hypot(cx - b.x, cz - b.z) < b.r + 0.85) hit = [cx, cz]
        if (!hit) continue
        b.hitT = b.t
        const rv = Math.hypot(b.vx - o.vx, b.vz - o.vz), n = new THREE.Vector3(o.x - b.x, 0, o.z - b.z).normalize()
        if (rv < 3) continue
        const p = new THREE.Vector3((b.x + hit[0]) / 2, b.y + 0.3, (b.z + hit[1]) / 2)
        o.vx += n.x * 9 + b.vx * 0.35; o.vz += n.z * 9 + b.vz * 0.35; o.vy = Math.max(o.vy, 6.5); o.air = true; o.slideT = 1.2
        o.fwX += (Math.random() - 0.5) * 7; o.fwZ += (Math.random() - 0.5) * 9; o.w += (Math.random() - 0.5) * 6
        b.vx *= -0.25; b.vz *= -0.25
        this.ev.ballHits++
        if (o.alive) this.damage(o, 20 + rv * 0.4, b.owner, p, o.zoneAt(p.x, p.z), 'ball')
      }
    }
    // 地雷
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i]; m.t += dt
      if (m.state === 0 && m.t > 0.7) m.state = 1
      const cd = this.camera.position.distanceTo(m.mesh.position)
      mineLook(m.mesh, m.state === 2 ? 2 : m.state === 1 ? 1 : 0, m.owner === this.player, cd / 3.2, this.t)
      if (m.state === 1) for (const o of this.cars) {
        if (!o.alive || (o === m.owner && m.t < 2.5)) continue
        for (const [cx, cz] of o.circles()) if (Math.hypot(cx - m.x, cz - m.z) < 1.5) { m.state = 2; m.trigT = 0.28; this.sound('pin', m, 1); break }
        if (m.state === 2) break
      }
      if (m.state === 1) for (const p of this.ps) if (p.alive && !p.car && Math.hypot(p.body.x - m.x, p.body.z - m.z) < 1.2) { m.state = 2; m.trigT = 0.28; this.sound('pin', m, 1); break }
      if (m.state === 2) {
        m.trigT -= dt
        if (m.trigT <= 0) {
          const p = new THREE.Vector3(m.x, m.y + 0.2, m.z)
          this.fx.explosion(p, 1.1, { groundY: m.y }); this.sound('boom', p, 0.9, { far: true }); this.bigShake(p, 0.9)
          for (const o of this.cars) {
            const d = Math.hypot(o.x - m.x, o.z - m.z); if (d > 6.5) continue
            const k = 1 - d / 6.5
            o.vy = Math.max(o.vy, 6 + 8 * k); o.air = true; o.fwX += (Math.random() - 0.5) * 6 * k; o.fwZ += (Math.random() - 0.5) * 6 * k; o.w += (Math.random() - 0.5) * 4 * k
            const nx = (o.x - m.x) / (d || 1), nz = (o.z - m.z) / (d || 1); o.vx += nx * 4 * k; o.vz += nz * 4 * k
            if (o.alive) this.damage(o, 6 + 16 * k, m.owner, new THREE.Vector3(o.x, o.y + 0.3, o.z), 'B', 'mine')
          }
          this.blastPeople(m.x, m.y, m.z, 6.5, 60, m.owner.driver)
          this.ev.mineHits++
          this.scene.remove(m.mesh); this.mines.splice(i, 1)
        }
      } else if (m.t > 40) { this.scene.remove(m.mesh); this.mines.splice(i, 1) }
    }
  },
  clearItems() {
    for (const b of this.balls || []) this.scene.remove(b.mesh)
    for (const m of this.mines || []) this.scene.remove(m.mesh)
    this.balls = []; this.mines = []
  },
}

// アイテムの絵（画面のボタン用の SVG。絵文字は使わない）
export const ICON = {
  ball: '<svg viewBox="0 0 48 48"><circle cx="24" cy="25" r="15" fill="#2c2e30" stroke="#e8e4da" stroke-width="2.5"/><path d="M14 18c6 4 14 4 20 0M13 31c7-4 15-4 22 0" fill="none" stroke="#6d7174" stroke-width="2"/><circle cx="18.5" cy="19" r="3.2" fill="#c9ccce"/></svg>',
  spear: '<svg viewBox="0 0 48 48"><path d="M5 30h24" stroke="#c9ccce" stroke-width="4" stroke-linecap="round"/><path d="M28 24l17 6-17 6z" fill="#e8e4da"/><rect x="3" y="24" width="7" height="12" rx="1" fill="#2c2e30" stroke="#e8e4da" stroke-width="1.5"/></svg>',
  jet: '<svg viewBox="0 0 48 48"><path d="M26 17h8v14h-8z" fill="#3a3c3e" stroke="#e8e4da" stroke-width="2"/><path d="M26 19c-6 0-14 2-21 5 7 3 15 5 21 5z" fill="#ff9a3c"/><path d="M26 21.5c-4 0-8 1-12 2.5 4 1.5 8 2.5 12 2.5z" fill="#ffe7b0"/><path d="M34 20h8v8h-8" fill="none" stroke="#e8e4da" stroke-width="2"/></svg>',
  mine: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="30" rx="17" ry="7" fill="#4d4a3e" stroke="#e8e4da" stroke-width="2"/><ellipse cx="24" cy="26" rx="9" ry="4" fill="#3a3a32" stroke="#e8e4da" stroke-width="1.5"/><circle cx="24" cy="24" r="2.6" fill="#ff5020"/></svg>',
  magnet: '<svg viewBox="0 0 48 48"><path d="M12 10v14a12 12 0 0 0 24 0V10h-8v14a4 4 0 0 1-8 0V10z" fill="#b0281c" stroke="#e8e4da" stroke-width="2" stroke-linejoin="round"/><path d="M12 10h8v6h-8zM28 10h8v6h-8z" fill="#c9ccce"/></svg>',
  repair: '<svg viewBox="0 0 48 48"><path d="M30 8a9 9 0 0 0-8 12L9 33a3.5 3.5 0 0 0 5 5l13-13a9 9 0 0 0 12-8l-5 4-5-1-1-5 5-4c-1-2-2-3-3-3z" fill="#c9ccce" stroke="#e8e4da" stroke-width="1.5" stroke-linejoin="round"/></svg>',
}
