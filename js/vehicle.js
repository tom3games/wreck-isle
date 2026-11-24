// 軽トラ（乗れる・壊れる・はねる）。当たりは向きのある箱。世界とは前後2つの円でぶつける
import * as THREE from 'three'
import { pushOut } from './collide.js?v=mwu9lb26'

export const VEH = { half: [1.75, 0.72], top: 1.9, accel: 9, brake: 18, maxF: 15, maxR: 5, wheelbase: 2.2, steer: 0.55, hp: 260 }

export class Vehicle {
  constructor(game, mesh, x, z, yaw) {
    this.g = game; this.mesh = mesh; this.x = x; this.z = z; this.yaw = yaw; this.speed = 0; this.steer = 0
    this.hp = VEH.hp; this.alive = true; this.driver = null; this.wheelRot = 0; this.smokeAcc = 0
    this.home = [x, z, yaw]
    this.y = 0; this.pitch = 0; this.roll = 0
    // 坂で傾けるため、車の真ん中を軸にした入れ物に入れる（模型の原点は真ん中から 1.72m ずれている）
    this.pivot = new THREE.Group(); (mesh.parent || game.scene).add(this.pivot); this.pivot.add(mesh)
    mesh.position.set(-1.72, 0, 0); mesh.rotation.set(0, 0, 0)
    mesh.traverse(m => { if (m.isMesh && m.material && !m.userData.keep) { m.userData.mat0 = m.material } })
    this.sync()
  }
  reset() {
    ;[this.x, this.z, this.yaw] = this.home; this.speed = 0; this.hp = VEH.hp; this.alive = true; this.driver = null
    this.mesh.traverse(m => { if (m.isMesh && m.userData.mat0) m.material = m.userData.mat0 })
    this.sync()
  }
  // 車輪の下の高さ: 地面か、今の高さから ±0.6m の平らな箱（橋の床・岸壁・道の箱）の上面の高い方
  groundAt(x, z) {
    let h = this.g.world.H(x, z); if (h < -1e8) h = -9
    for (const b of this.g.world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [])) {
      if (b.dead || b.kind !== 'solid' || x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2]) continue
      const top = b.max[1]; if (top > this.y + 0.6 || top < this.y - 0.8 || b.max[1] - b.min[1] > 4) continue
      if (top > h) h = top
    }
    return h
  }
  // 車輪4つの高さから、車の高さと前後・左右の傾き
  settle() {
    const W = [[1.6, 0.7], [1.6, -0.7], [-1.6, 0.7], [-1.6, -0.7]].map(([a, b]) => { const [x, z] = this.world(a, b); return this.groundAt(x, z) })
    this.y = (W[0] + W[1] + W[2] + W[3]) / 4
    this.pitch = Math.atan2((W[0] + W[1]) - (W[2] + W[3]), 2 * 3.2)
    this.roll = Math.atan2((W[0] + W[2]) - (W[1] + W[3]), 2 * 1.4)
  }
  fwd() { return [Math.sin(this.yaw), Math.cos(this.yaw)] }
  // 世界の点を車の向きの座標に（a: 前、b: 右）
  local(x, z) { const [fx, fz] = this.fwd(), dx = x - this.x, dz = z - this.z; return [dx * fx + dz * fz, dx * -fz + dz * fx] }
  world(a, b) { const [fx, fz] = this.fwd(); return [this.x + fx * a - fz * b, this.z + fz * a + fx * b] }
  inside(x, y, z, pad = 0) { if (y - this.y > VEH.top + pad || y < this.y - 0.6) return false; const [a, b] = this.local(x, z); return Math.abs(a) < VEH.half[0] + pad && Math.abs(b) < VEH.half[1] + pad }
  sync() {
    const th = this.yaw + Math.PI / 2
    this.pivot.rotation.set(-this.roll, th, this.pitch, 'YZX')
    this.pivot.position.set(this.x, this.y, this.z)
  }
  update(dt, inp) {
    if (this.alive && this.driver && inp) {
      const t = inp.throttle
      if (t > 0) this.speed += (this.speed < 0 ? VEH.brake : VEH.accel) * t * dt
      else if (t < 0) this.speed += (this.speed > 0 ? -VEH.brake : -VEH.accel * 0.6) * -t * dt
      // 速いほどハンドルの切れ角を小さく（実車と同じく、速い時に急に曲がらない）。切り始めもゆっくり
      const maxSteer = VEH.steer / (1 + this.speed * this.speed / 45)
      this.steer += ((inp.steer || 0) * maxSteer - this.steer) * Math.min(1, dt * 2.6)
      if (inp.hand) this.speed *= Math.exp(-dt * 3)
    } else this.steer *= Math.exp(-dt * 4)
    this.speed *= Math.exp(-dt * (this.driver && this.alive ? 0.25 : 1.6))
    if (Math.abs(this.speed) < 0.02) this.speed = 0
    this.speed = THREE.MathUtils.clamp(this.speed, -VEH.maxR, VEH.maxF)
    this.yaw -= this.speed / VEH.wheelbase * Math.tan(this.steer) * dt * (this.speed < 0 ? 1 : 1)
    const [fx, fz] = this.fwd()
    let nx = this.x + fx * this.speed * dt, nz = this.z + fz * this.speed * dt
    // 川・海（橋の床が無い所）と、段差（壁・崖）や急すぎる坂には入れない
    let blocked = false
    if (this.g.world.terrain) for (const o of [1.8, -1.8, 0]) for (const sb of [-0.75, 0.75]) {
      if (blocked) break
      const px = nx + fx * o - fz * sb, pz = nz + fz * o + fx * sb, gh = this.groundAt(px, pz)
      const [qx, qz] = this.world(o, sb), g0 = this.groundAt(qx, qz)
      if (gh < -0.4 || gh - g0 > 0.45 || (o !== 0 && (gh - this.y) * Math.sign(o) * Math.sign(this.speed || 1) > Math.abs(o) * 0.75)) { if (Math.abs(this.speed) > 4) this.g.sound('thud', this, Math.min(1, Math.abs(this.speed) / 12)); this.speed *= -0.25; nx = this.x; nz = this.z; blocked = true; break }
    }
    // 前後の円を世界の箱から押し出す
    const cs = [1.05, -1.05].map(o => ({ x: nx + fx * o, z: nz + fz * o, y: this.y + 0.25, h: 1.6, r: 0.78, vx: fx * this.speed, vz: fz * this.speed }))
    let hit = 0
    for (const c of cs) { const x0 = c.x, z0 = c.z; pushOut(this.g.world, c); if (Math.hypot(c.x - x0, c.z - z0) > 0.002) hit++ }
    const mx = (cs[0].x + cs[1].x) / 2, mz = (cs[0].z + cs[1].z) / 2
    if (hit) { const ny = Math.atan2(cs[0].x - cs[1].x, cs[0].z - cs[1].z); this.yaw += Math.atan2(Math.sin(ny - this.yaw), Math.cos(ny - this.yaw)) * 0.5; if (Math.abs(this.speed) > 4) this.g.sound('thud', this, Math.min(1, Math.abs(this.speed) * 0.08)); this.speed *= 0.55 }
    this.x = mx; this.z = mz
    // 見た目: 車輪の回転と前輪の切れ
    this.settle()
    this.wheelRot += this.speed * dt / 0.29
    for (const w of this.mesh.userData.wheels || []) { w.spin.rotation.z = -this.wheelRot; w.piv.rotation.y = w.front ? -this.steer : 0 }
    this.sync()
    // 壊れかけは煙
    if (this.alive && this.hp < VEH.hp * 0.45) { this.smokeAcc += dt * (this.hp < VEH.hp * 0.2 ? 14 : 5); while (this.smokeAcc > 1) { this.smokeAcc--; const [wx, wz] = this.world(1.4, 0); this.g.fx.sprite({ map: this.g.fx.constructor.T || window.__fxT.smoke[0], pos: new THREE.Vector3(wx, 1.3, wz), vel: new THREE.Vector3(0, 1.6, 0), size: 0.5, grow: 1.6, life: 2.2, color: 0x2a2826, color2: 0x6a645c, drag: 0.6, alpha: 0.6 }) } }
  }
  damage(d, by) {
    if (!this.alive) return
    this.hp -= d
    if (this.hp <= 0) this.wreck(by)
  }
  wreck(by) {
    this.alive = false
    const burnt = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9, metalness: 0.2 })
    this.mesh.traverse(m => { if (m.isMesh) m.material = burnt })
    const p = new THREE.Vector3(this.x, this.y + 0.8, this.z)
    this.g.explode(p, { dmg: 120, R: 8, push: 20, size: 2 }, by, 1, null, null)
    this.g.fx.fire(new THREE.Vector3(this.x, this.y + 0.6, this.z), 14)
    if (this.driver) this.g.exitVehicle(this.driver, true)
    this.g.bannerAll('軽トラが吹き飛んだ', 'chain')
  }
}
