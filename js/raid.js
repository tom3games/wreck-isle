// 爆撃（本人「たまに一部分レッドゾーンでて pubg みたいに爆撃始まるとか欲しい」2026-11-23）
// 60〜90秒に1回、円の中のどこかに赤い円。6秒の予告（サイレン・空が赤みがかる・地面の赤い輪・地図の赤い円）→ 15秒ほど爆弾が降る
// 当たると車は大きく壊れて吹っ飛び、歩いている人はほぼやられる。円の外は安全
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwuqry6n'
import { DROP } from './plane.js?v=mwuqry6n'

export const RAID = { warn: 6, bomb: 15, rate: 2.2, R: [32, 48], every: [60, 90], blast: 8 }

export const raidMethods = {
  resetRaid() {
    this.raid = null; this.raidN = 0
    this.nextRaidT = DROP.T + 50 + this.rng() * 30
    if (!this.raidMesh) {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'uniform float uT, uA; varying vec2 vUv; void main(){ float s = 0.5+0.5*sin(uT*7.0); gl_FragColor = vec4(1.0, 0.12, 0.08, uA * (0.22 + 0.18*s) * smoothstep(1.0, 0.0, vUv.y)); }' })
      this.raidMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 18, 96, 1, true), m); this.raidMesh.position.y = 8; this.raidMesh.renderOrder = 4; this.raidMesh.visible = false; this.scene.add(this.raidMesh)
      const g = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0xff2a14, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }))
      g.rotation.x = -Math.PI / 2; this.raidRing = g; g.visible = false; this.scene.add(g)
    }
    this.raidMesh.visible = this.raidRing.visible = false
  },
  // 置き場はくじ。人の多い所に寄りすぎないよう、候補のうち中にいる人が少ない方から選ぶ
  pickRaid() {
    const z = this.zone, R = Math.max(18, Math.min(RAID.R[0] + this.rng() * (RAID.R[1] - RAID.R[0]), z.r * 0.55))
    const cand = []
    for (let k = 0; k < 40 && cand.length < 6; k++) {
      const a = this.rng() * 6.283, r = Math.sqrt(this.rng()) * Math.max(0, z.r - R * 0.5), x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r
      if (!this.grid.free(x, zz) && this.rng() < 0.7) continue
      cand.push({ x, z: zz, r: R, n: this.ps.filter(p => p.alive && !p.air && Math.hypot(p.x - x, p.z - zz) < R).length })
    }
    if (!cand.length) return null
    cand.sort((a, b) => a.n - b.n)
    return cand[Math.floor(this.rng() * Math.min(3, cand.length))]
  },
  updateRaid(dt) {
    const z = this.zone
    if (!this.raid && this.t >= this.nextRaidT && this.t < z.t2) {
      const c = this.pickRaid()
      this.nextRaidT = this.t + RAID.every[0] + this.rng() * (RAID.every[1] - RAID.every[0])
      if (c) {
        this.raid = { ...c, t: 0, phase: 'warn', acc: 0 }; this.raidN++; this.ev.raids = (this.ev.raids || 0) + 1
        this.sound('siren', { x: this.camera.position.x, y: 0, z: this.camera.position.z }, 0.7)
        const me = this.me, d = me.alive ? Math.hypot(me.x - c.x, me.z - c.z) : 1e9
        this.toast(d < c.r + 4 ? tr('爆撃が来る　赤い円から出ろ', 'Air raid incoming — get out of the red circle') : tr('赤い円に爆撃が来る', 'Air raid incoming on the red circle'))
      }
    }
    const R = this.raid; if (!R) return
    R.t += dt
    if (R.phase === 'warn' && R.t >= RAID.warn) { R.phase = 'bomb'; R.t = 0 }
    if (R.phase === 'bomb') {
      R.acc += dt * RAID.rate
      while (R.acc >= 1) { R.acc--; this.dropBomb(R) }
      if (R.t >= RAID.bomb) { this.raid = null }
    }
  },
  dropBomb(R) {
    const a = this.rng() * 6.283, r = Math.sqrt(this.rng()) * R.r, x = R.x + Math.cos(a) * r, z = R.z + Math.sin(a) * r
    let gy = this.world.H(x, z); if (gy < -1e8) gy = -1.4
    for (const b of this.world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [])) if (!b.dead && b.kind === 'solid' && x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2] && b.max[1] > gy && b.max[1] < gy + 12) gy = b.max[1]
    const p = new THREE.Vector3(x, Math.max(gy, -1.2) + 0.3, z)
    if (gy < -0.6) this.fx.splash(new THREE.Vector3(x, -1.3, z))
    this.fx.explosion(p, 1.35, { groundY: Math.max(gy, -1.2) })
    this.sound('boom', p, 1, { far: true })
    const cd = this.camera.position.distanceTo(p)
    if (cd < 60) this.fx.shake = Math.min(1.6, this.fx.shake + 9 / (cd + 8))
    this.ev.bombs = (this.ev.bombs || 0) + 1
    const B = RAID.blast
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z); if (d > B) continue
      const k = 1 - d / B, nx = (c.x - x) / (d || 1), nz = (c.z - z) / (d || 1)
      c.vx += nx * 13 * k; c.vz += nz * 13 * k; c.vy = Math.max(c.vy, 4 + 8 * k); c.air = true; c.slideT = 1
      c.fwX += (this.rng() - 0.5) * 6 * k; c.fwZ += (this.rng() - 0.5) * 6 * k; c.w += (this.rng() - 0.5) * 5 * k
      if (c.alive) { this.damage(c, 30 + 110 * k, null, new THREE.Vector3(c.x - nx, c.y + 0.6, c.z - nz), c.zoneAt(x, z), 'raid'); this.ev.raidHits = (this.ev.raidHits || 0) + 1 }
    }
    this.blastPeople(x, gy, z, B + 1, 140, null)
  },
  // 見た目: 地面の赤い輪と壁・空の赤み（予告と爆撃の間）
  raidVisual(dt) {
    const R = this.raid, on = !!R
    this.raidMesh.visible = this.raidRing.visible = on
    const el = document.getElementById('raidtint')
    if (on) {
      const gy = Math.max(0, this.world.H(R.x, R.z))
      this.raidMesh.scale.set(R.r, 1, R.r); this.raidMesh.position.set(R.x, gy + 8, R.z)
      this.raidRing.scale.setScalar(R.r); this.raidRing.position.set(R.x, gy + 0.3, R.z)
      const u = this.raidMesh.material.uniforms; u.uT.value = performance.now() / 1000; u.uA.value = R.phase === 'warn' ? Math.min(1, R.t / 0.8) : 1
    }
    // 空が赤みがかる: 自分が近いほど強く
    const me = this.me, near = on && me ? Math.max(0, 1 - Math.max(0, Math.hypot(me.x - R.x, me.z - R.z) - R.r) / 120) : 0
    this.raidK = (this.raidK || 0) + ((on ? 0.35 + 0.65 * near : 0) - (this.raidK || 0)) * Math.min(1, dt * 2)
    if (el) el.style.opacity = (this.raidK * 0.55).toFixed(3)
  },
  inRaid(x, z, pad = 0) { const R = this.raid; return !!R && Math.hypot(x - R.x, z - R.z) < R.r + pad },
}
