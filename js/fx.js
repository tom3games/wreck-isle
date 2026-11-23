// 爆発・煙・火花・破片・焦げ跡・衝撃の輪。光源は最初に作って使い回す（途中で足すとシェーダが作り直しになり固まる）
import * as THREE from 'three'

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function puff(g, s) {
  // 煙の塊。小さな丸を重ね、左上を明るく右下を暗くして立体に見せる
  const blobs = []
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() ** 0.7 * s * 0.3
    blobs.push([s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, s * (0.05 + Math.random() * 0.13)])
  }
  blobs.sort((p, q) => (q[0] + q[1]) - (p[0] + p[1])) // 右下から描いて左上を手前に
  for (const [x, y, rad] of blobs) {
    const lit = 1 - ((x - s * 0.3) + (y - s * 0.3)) / (s * 1.1)
    const v = Math.round(255 * Math.max(0.38, Math.min(1, 0.55 + lit * 0.45)))
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad)
    gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(0.6, `rgba(${v * 0.8 | 0},${v * 0.8 | 0},${v * 0.8 | 0},0.35)`); gr.addColorStop(1, `rgba(${v * 0.7 | 0},${v * 0.7 | 0},${v * 0.7 | 0},0)`)
    g.fillStyle = gr; g.fillRect(0, 0, s, s)
  }
  // 縁を丸く落とす
  g.globalCompositeOperation = 'destination-in'
  const m = g.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = m; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'source-over'
}
const TX = {}
function texs() {
  if (TX.smoke) return TX
  TX.smoke = [0, 1, 2, 3].map(() => canvasTex(256, (g, s) => puff(g, s)))
  TX.soft = canvasTex(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s) })
  TX.fire = canvasTex(256, (g, s) => {
    for (let i = 0; i < 30; i++) { const x = s / 2 + (Math.random() - 0.5) * s * 0.35, y = s / 2 + (Math.random() - 0.5) * s * 0.35, r = s * (0.1 + Math.random() * 0.2); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,240,200,0.5)'); gr.addColorStop(0.5, 'rgba(255,150,40,0.25)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s) }
  })
  // 炎の舌（上がとがった縦長）。根元は白っぽい黄、先は赤く透ける
  TX.flame = canvasTex(256, (g, s) => {
    for (const [ox, sy, rr] of [[0, 2.4, 0.2], [-0.12, 1.8, 0.14], [0.13, 2.0, 0.13], [0.03, 1.4, 0.16]]) {
      g.save(); g.translate(s * (0.5 + ox), s * 0.7); g.scale(1, sy)
      const r = s * rr, gr = g.createRadialGradient(0, r * 0.35, 0, 0, 0, r)
      gr.addColorStop(0, 'rgba(255,240,190,0.95)'); gr.addColorStop(0.35, 'rgba(255,165,45,0.85)'); gr.addColorStop(0.7, 'rgba(220,70,12,0.45)'); gr.addColorStop(1, 'rgba(140,20,0,0)')
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore()
    }
  })
  TX.scorch = canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(10,8,6,0.92)'); gr.addColorStop(0.45, 'rgba(20,16,12,0.7)'); gr.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s)
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, l = s * (0.25 + Math.random() * 0.25); g.strokeStyle = `rgba(15,12,10,${0.3 + Math.random() * 0.4})`; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); g.stroke() }
  })
  // 2026-11-23 爆発の作り直し（本人「爆発のクオリティあげて」）
  // 火の玉: ムラのある炎の塊。芯は白っぽい黄、外へいくほど橙→暗い赤、縁にすすの暗い斑。加算せず普通に重ねる（空に向かってピンクに光らない）
  TX.fireball = [0, 1, 2].map(() => canvasTex(256, (g, s) => {
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * 6.28, rr = Math.random() ** 0.8 * s * 0.28, x = s / 2 + Math.cos(a) * rr, y = s / 2 + Math.sin(a) * rr * 0.9, r = s * (0.07 + Math.random() * 0.14)
      const hot = 1 - rr / (s * 0.3)
      const c0 = hot > 0.6 ? '255,236,170' : hot > 0.3 ? '255,170,60' : '210,80,22', c1 = hot > 0.6 ? '255,150,40' : hot > 0.3 ? '200,70,15' : '90,30,10'
      const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r); gr.addColorStop(0, `rgba(${c0},0.95)`); gr.addColorStop(0.6, `rgba(${c1},0.75)`); gr.addColorStop(1, `rgba(${c1},0)`)
      g.fillStyle = gr; g.fillRect(0, 0, s, s)
    }
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, rr = s * (0.2 + Math.random() * 0.12), x = s / 2 + Math.cos(a) * rr, y = s / 2 + Math.sin(a) * rr, r = s * (0.04 + Math.random() * 0.07); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,22,14,0.55)'); gr.addColorStop(1, 'rgba(40,22,14,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s) }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'source-over'
  }))
  // 土の吹き上げ: 縦に伸びた土と砂の筋。下が濃く上が散る
  TX.dirt = canvasTex(256, (g, s) => {
    // 下が太く上へすぼまる土の柱。中に土の塊、縁は砂粒で散る
    for (let i = 0; i < 70; i++) {
      const y = s * (0.15 + Math.random() * 0.8), w = s * (0.05 + (y / s) * 0.17), x = s / 2 + (Math.random() - 0.5) * w * 1.6, r = s * (0.03 + Math.random() * 0.05) * (0.5 + y / s)
      const v = 80 + Math.random() * 45, gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(${v | 0},${v * 0.84 | 0},${v * 0.68 | 0},0.9)`); gr.addColorStop(1, `rgba(${v | 0},${v * 0.84 | 0},${v * 0.68 | 0},0)`); g.fillStyle = gr; g.fillRect(0, 0, s, s)
    }
    for (let i = 0; i < 120; i++) { const y = s * (0.05 + Math.random() * 0.9), w = s * (0.08 + (y / s) * 0.25), x = s / 2 + (Math.random() - 0.5) * w * 2, v = 60 + Math.random() * 50; g.fillStyle = `rgba(${v | 0},${v * 0.85 | 0},${v * 0.7 | 0},0.8)`; g.beginPath(); g.arc(x, y, 1 + Math.random() * 2.5, 0, 6.28); g.fill() }
    g.globalCompositeOperation = 'destination-in'; const m = g.createLinearGradient(0, 0, 0, s); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.25, 'rgba(0,0,0,0.85)'); m.addColorStop(0.9, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = m; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'source-over'
  })
  return TX
}

export const FXTEX = TX
window.__fxT = TX
export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera; const T = texs()
    this.parts = []; this.pool = []
    this.lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa04a, 0, 22, 1.6); l.castShadow = false; scene.add(l); return { l, t: 9, power: 0 } })
    this.shake = 0
    this.smokes = [] // 煙玉の範囲 {x,y,z,r,t,life}
    // 破片
    const dg = new THREE.DodecahedronGeometry(0.07, 0); dg.scale(1.5, 0.6, 1.0) // 平たい欠片（丸い粒に見えない）
    this.deb = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x5a4c3e, roughness: 0.95 }), 260)
    this.deb.castShadow = true; this.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.deb.count = 0; this.deb.frustumCulled = false
    scene.add(this.deb); this.debs = []
    this.decals = []
    this.rings = []
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3()
  }
  sprite(opts) {
    // 粒の上限と、遠く（170m 超）の粒は出さない（島が広く 50人が同時に煙と火を使うため 2026-11-23）
    if (this.parts.length >= 700) return null
    const cam = this.camera; if (cam && (opts.pos.x - cam.position.x) ** 2 + (opts.pos.z - cam.position.z) ** 2 > 170 * 170) return null
    let s = this.pool.pop()
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true })); s.frustumCulled = false; this.scene.add(s) }
    const m = s.material
    m.map = opts.map; m.blending = opts.add ? THREE.AdditiveBlending : THREE.NormalBlending; if (opts.hdr) m.color.setRGB(...opts.hdr); else m.color.set(opts.color || 0xffffff); m.opacity = 0; m.rotation = opts.upright ? (Math.random() - 0.5) * 0.3 : Math.random() * 6.28; m.fog = true
    const mk = (opts.map && opts.map.uuid) + (opts.add ? '+' : '-'); if (m.userData.mk !== mk) { m.userData.mk = mk; m.needsUpdate = true } // 材質の作り直しは絵か混ぜ方が変わった時だけ
    s.visible = true; s.position.copy(opts.pos); s.scale.setScalar(opts.size || 1); s.renderOrder = opts.add ? 3 : 2
    const p = { s, t: 0, life: opts.life, vel: opts.vel ? opts.vel.clone() : new THREE.Vector3(), grow: opts.grow || 0, size: opts.size || 1, a0: opts.alpha ?? 1, add: opts.add, col0: opts.hdr ? new THREE.Color(...opts.hdr) : new THREE.Color(opts.color || 0xffffff), col1: opts.color2 != null ? new THREE.Color(opts.color2) : null, drag: opts.drag ?? 1.2, rise: opts.rise || 0, spin: (Math.random() - 0.5) * (opts.spin || 0.6), fadeIn: opts.fadeIn ?? 0.08, onSmoke: opts.onSmoke }
    this.parts.push(p); return p
  }
  flash(pos, power, dur = 0.28) {
    let best = this.lights[0]; for (const L of this.lights) if (L.t > best.t) best = L
    best.l.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0)); best.t = 0; best.power = power; best.dur = dur
  }
  explosion(pos, size = 1, opts = {}) {
    const T = TX, up = new THREE.Vector3(0, 1, 0)
    this.flash(pos, 90 * size, 0.28)
    // 火の玉: 加算の白い芯は一瞬だけ。周りはムラのある炎の塊が膨らんで、すすの色に冷めながら煙へ変わる
    this.sprite({ map: T.soft, add: true, pos: pos.clone().add(up.clone().multiplyScalar(0.45)), size: 1.4 * size, grow: 5 * size, life: 0.09, hdr: [3.2, 2.6, 1.9], fadeIn: 0.0 })
    for (let i = 0; i < 9 * size; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.7 + 0.15, Math.random() - 0.5).normalize()
      this.sprite({ map: T.fireball[i % 3], pos: pos.clone().add(up.clone().multiplyScalar(0.35)).addScaledVector(d, 0.15 + Math.random() * 0.35), vel: d.multiplyScalar(3.5 + Math.random() * 5 * size), size: (0.9 + Math.random() * 0.6) * size, grow: 4.4 * size, life: 0.26 + Math.random() * 0.2, hdr: [1.9, 1.45, 1.05], color2: 0x3a2a22, drag: 6.5, fadeIn: 0.0, spin: 1.2 })
    }
    for (let i = 0; i < 5 * size; i++) { // 加算の熱の光（少しだけ）
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 + 0.2, Math.random() - 0.5).normalize()
      this.sprite({ map: T.fire, add: true, pos: pos.clone().addScaledVector(d, 0.3), vel: d.multiplyScalar(4 + Math.random() * 4), size: 1.0 * size, grow: 3.4 * size, life: 0.16 + Math.random() * 0.1, hdr: [1.6, 0.95, 0.4], color2: 0x401000, drag: 7, fadeIn: 0.0 })
    }
    // 土の吹き上げ（地面で爆ぜた時だけ）: 縦に伸びた土の筋が 4〜6 本、上へ飛んで落ちる
    const onGround = opts.groundY == null || pos.y - opts.groundY < 0.9
    if (onGround) for (let i = 0; i < 5 * size; i++) {
      const a = Math.random() * 6.28, off = 0.3 + Math.random() * 0.6
      this.sprite({ map: T.dirt, upright: true, pos: pos.clone().add(new THREE.Vector3(Math.cos(a) * off, 1.1 * size, Math.sin(a) * off)), vel: new THREE.Vector3(Math.cos(a) * 1.8, 4 + Math.random() * 3, Math.sin(a) * 1.8), size: (2.4 + Math.random() * 1.0) * size, grow: 1.8 * size, life: 0.8 + Math.random() * 0.35, color: 0x9a8670, color2: 0x6e6254, drag: 2.2, rise: -10, alpha: 0.95, fadeIn: 0.02, spin: 0.15 })
    }
    // 煙の柱（火の玉の後に残る）: 濃い灰と茶。ゆっくり昇って広がり、数秒残る
    for (let i = 0; i < 11 * size; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, 0.45 + Math.random() * 1.0, Math.random() - 0.5).normalize()
      const g = 0.16 + Math.random() * 0.1
      this.sprite({ map: T.smoke[i % 4], pos: pos.clone().add(up.clone().multiplyScalar(0.5)).addScaledVector(d, 0.3 + Math.random() * 0.5), vel: d.multiplyScalar(1.6 + Math.random() * 3.2 * size), size: (1.1 + Math.random() * 0.8) * size, grow: 2.0 * size, life: 4.5 + Math.random() * 3.5, color: new THREE.Color(g * 1.9, g * 1.7, g * 1.5).getHex(), color2: 0x7c746a, drag: 2.0, rise: 0.7 + Math.random() * 0.5, alpha: 0.62 + Math.random() * 0.18, fadeIn: 0.14, spin: 0.25 })
    }
    // 土煙（地面を這って広がり、しばらく残る）
    if (onGround) for (let i = 0; i < 10 * size; i++) {
      const a = (i / (10 * size)) * 6.28 + Math.random() * 0.5, d = new THREE.Vector3(Math.cos(a), 0.04, Math.sin(a))
      this.sprite({ map: T.smoke[i % 4], pos: pos.clone().add(new THREE.Vector3(0, 0.35, 0)), vel: d.multiplyScalar(8 + Math.random() * 6), size: 1.0, grow: 2.6, life: 2.6 + Math.random() * 1.6, color: 0x857a6c, color2: 0xa49886, drag: 3.4, rise: 0.15, alpha: 0.55, fadeIn: 0.03 })
    }
    // 火花
    for (let i = 0; i < 26 * size; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize()
      this.sprite({ map: T.soft, add: true, pos: pos.clone(), vel: d.multiplyScalar(10 + Math.random() * 14), size: 0.07, life: 0.4 + Math.random() * 0.5, hdr: [6, 3.5, 1.2], color2: 0xff4010, drag: 1.4, rise: -9, fadeIn: 0 })
    }
    // 破片
    for (let i = 0; i < 14 * size && this.debs.length < 250; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.2 + 0.2, Math.random() - 0.5).normalize()
      this.debs.push({ p: pos.clone().add(new THREE.Vector3(0, 0.2, 0)), v: d.multiplyScalar(3 + Math.random() * 6), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: (Math.random() - 0.5) * 20, t: 0, ground: opts.groundY ?? 0, s: 0.35 + Math.random() * 0.7 })
    }
    // 衝撃の輪
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe6c0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY((opts.groundY ?? pos.y) + 0.06); this.scene.add(ring); this.rings.push({ m: ring, t: 0, size })
    if (opts.groundY != null) this.scorch(pos.x, opts.groundY, pos.z, 1.6 * size + 0.8)
  }
  scorch(x, y, z, r) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshStandardMaterial({ map: TX.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 1, opacity: 0.9 }))
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, y + 0.012, z); m.receiveShadow = true
    this.scene.add(m); this.decals.push(m)
    if (this.decals.length > 24) { const o = this.decals.shift(); this.scene.remove(o); o.geometry.dispose(); o.material.dispose() }
  }
  smokeBomb(pos) {
    const s = { x: pos.x, y: pos.y, z: pos.z, r: 0.5, t: 0, life: 15, emit: 0 }
    this.smokes.push(s)
  }
  splash(pos) {
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Vector3((Math.random() - 0.5) * 0.6, 1, (Math.random() - 0.5) * 0.6).normalize()
      this.sprite({ map: TX.soft, pos: pos.clone(), vel: d.multiplyScalar(3 + Math.random() * 5), size: 0.35, grow: 0.8, life: 0.8 + Math.random() * 0.4, color: 0xe6eef0, drag: 0.6, rise: -9, alpha: 0.8 })
    }
  }
  fuseSpark(pos) { // 導火の火花（燃えている爆弾から）
    this.sprite({ map: TX.soft, add: true, pos: pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2), size: 0.075, life: 0.3, color: 0xffd080, color2: 0xff3010, drag: 1, rise: -6, fadeIn: 0 })
  }
  // 火炎瓶の火: 半径 r の中に小さな炎を次々に出す・地面の照り返し・揺れる明かり・黒い煙
  groundFire(pos, r = 3, life = 7) {
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 32), new THREE.MeshBasicMaterial({ map: TX.soft, color: 0xff6a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.rotation.x = -Math.PI / 2; glow.position.set(pos.x, pos.y + 0.06, pos.z); glow.renderOrder = 2; this.scene.add(glow)
    ;(this.gfires || (this.gfires = [])).push({ p: pos.clone(), r, life, t: 0, acc: 0, glow })
  }
  fire(pos, life = 6) { // ドラム缶の残り火
    this.fires = this.fires || []; this.fires.push({ p: pos.clone(), t: 0, life, acc: 0 })
  }
  update(dt) {
    const T = TX
    for (const L of this.lights) { L.t += dt; const k = L.t < L.dur ? 1 - L.t / L.dur : 0; L.l.intensity = L.power * k * k * (0.8 + Math.random() * 0.4) }
    // 煙玉
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt
      s.r = Math.min(5.2, 0.5 + s.t * 2.2)
      if (s.t < s.life - 3) {
        s.emit += dt * (s.t < 2 ? 34 : 11)
        while (s.emit > 1) {
          s.emit--
          const a = Math.random() * 6.28, rr = Math.random() * s.r * 0.7
          this.sprite({ map: T.smoke[Math.floor(Math.random() * 4)], pos: new THREE.Vector3(s.x + Math.cos(a) * rr * 0.4, s.y + 0.3, s.z + Math.sin(a) * rr * 0.4), vel: new THREE.Vector3(Math.cos(a) * (0.6 + Math.random() * 1.8), 0.8 + Math.random() * 1.8, Math.sin(a) * (0.6 + Math.random() * 1.8)), size: 2.0, grow: 3.0, life: 6 + Math.random() * 3, color: 0xd6d8d4, color2: 0xb3b6b1, drag: 1.1, rise: 0.05, alpha: 0.9, fadeIn: 0.3 })
        }
      }
      if (s.t > s.life) this.smokes.splice(i, 1)
    }
    if (this.gfires) for (let i = this.gfires.length - 1; i >= 0; i--) {
      const f = this.gfires[i]; f.t += dt
      const k = f.t < 0.35 ? f.t / 0.35 : f.t > f.life - 1.5 ? Math.max(0, (f.life - f.t) / 1.5) : 1
      f.acc += dt * 95 * k
      while (f.acc > 1) {
        f.acc--
        const a = Math.random() * 6.28, rr = f.r * Math.sqrt(Math.random()) * (0.55 + 0.45 * Math.min(1, f.t / 0.35)), sz = 0.65 + Math.random() * 0.55
        // 板の下が地面に切られないよう、大きさの半分だけ上に出す
        // 透ける炎（昼でも橙に見える）と、光る芯を交互に
        const core = Math.random() < 0.35
        this.sprite({ map: T.flame, add: core, pos: new THREE.Vector3(f.p.x + Math.cos(a) * rr, f.p.y + sz * 0.32, f.p.z + Math.sin(a) * rr), vel: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.45 + Math.random() * 0.6, (Math.random() - 0.5) * 0.25), size: core ? sz * 0.75 : sz * 1.2, grow: 0.1, life: 0.5 + Math.random() * 0.35, ...(core ? { hdr: [1.6, 0.9, 0.35], color2: 0xff5a10 } : { color: 0xffffff, color2: 0xa02a08 }), alpha: core ? 0.9 : 0.95, drag: 0.6, fadeIn: 0.04, spin: 0.001, upright: true })
        if (Math.random() < 0.12) this.sprite({ map: T.smoke[Math.floor(Math.random() * 4)], pos: new THREE.Vector3(f.p.x + Math.cos(a) * rr * 0.6, f.p.y + 1.3, f.p.z + Math.sin(a) * rr * 0.6), vel: new THREE.Vector3(0.3, 1.8 + Math.random(), 0), size: 0.9, grow: 2.0, life: 2.6, color: 0x24201c, color2: 0x56504a, drag: 0.4, alpha: 0.55 })
      }
      f.glow.material.opacity = 0.5 * k * (0.8 + 0.2 * Math.sin(f.t * 23) * Math.sin(f.t * 7.3))
      if (Math.random() < dt * 9 * k) this.flash(f.p, 70 * k, 0.22)
      if (f.t > f.life) { this.scene.remove(f.glow); f.glow.geometry.dispose(); f.glow.material.dispose(); this.gfires.splice(i, 1) }
    }
    if (this.fires) for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.t += dt; f.acc += dt * 26
      while (f.acc > 1) { f.acc--; this.sprite({ map: T.fire, add: true, pos: f.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)), vel: new THREE.Vector3(0, 2 + Math.random() * 2, 0), size: 0.7, grow: 0.6, life: 0.6, hdr: [2.6, 1.3, 0.4], color2: 0xff3a00, drag: 0.5, fadeIn: 0.05 }); if (Math.random() < 0.3) this.sprite({ map: T.smoke[0], pos: f.p.clone().add(new THREE.Vector3(0, 1.4, 0)), vel: new THREE.Vector3(0.4, 2.4, 0), size: 0.9, grow: 1.6, life: 3, color: 0x1f1c1a, color2: 0x5a544d, drag: 0.3, alpha: 0.7 }) }
      if (Math.random() < dt * 8) this.flash(f.p, 60, 0.15)
      if (f.t > f.life) this.fires.splice(i, 1)
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.t += dt
      const k = p.t / p.life
      if (k >= 1) { p.s.visible = false; this.pool.push(p.s); this.parts.splice(i, 1); continue }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt)); p.vel.y += p.rise * dt
      p.s.position.addScaledVector(p.vel, dt)
      p.s.scale.setScalar(p.size + p.grow * Math.sqrt(k))
      const fin = p.fadeIn > 0 ? Math.min(1, p.t / p.fadeIn) : 1
      p.s.material.opacity = p.a0 * fin * (1 - k) ** (p.add ? 1.5 : 1.1)
      p.s.material.rotation += p.spin * dt
      if (p.col1) p.s.material.color.copy(p.col0).lerp(p.col1, Math.min(1, k * 1.8))
    }
    // 破片
    let n = 0
    for (let i = this.debs.length - 1; i >= 0; i--) {
      const d = this.debs[i]; d.t += dt
      if (d.t > 4) { this.debs.splice(i, 1); continue }
      d.v.y -= 22 * dt; d.p.addScaledVector(d.v, dt)
      if (d.p.y < d.ground + 0.04) { d.p.y = d.ground + 0.04; d.v.y *= -0.25; d.v.x *= 0.6; d.v.z *= 0.6; d.w *= 0.5 }
      d.r.x += d.w * dt; d.r.y += d.w * 0.7 * dt
    }
    for (const d of this.debs) { this.q.setFromEuler(d.r); this.m4.compose(d.p, this.q, this.v.setScalar(d.s)); this.deb.setMatrixAt(n++, this.m4) }
    this.deb.count = n; this.deb.instanceMatrix.needsUpdate = true
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / 0.35
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); continue }
      r.m.scale.setScalar(1 + k * 7 * r.size); r.m.material.opacity = 0.18 * (1 - k) ** 2
    }
    this.shake = Math.max(0, this.shake - dt * 2.4)
  }
  // その点が煙の中か（消えかけの煙は数えない）
  inSmoke(p) {
    for (const s of this.smokes) {
      if (s.t > s.life - 2) continue
      const dx = p.x - s.x, dy = (p.y || 0) + 0.8 - (s.y + 1), dz = p.z - s.z
      if (dx * dx + dy * dy * 0.5 + dz * dz < s.r * s.r) return true
    }
    return false
  }
  // 視線が煙玉を通るか（CPU の目）
  blocked(a, b) {
    for (const s of this.smokes) {
      if (s.t > s.life - 2) continue
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz
      let t = ((s.x - a.x) * dx + (s.y + 1 - a.y) * dy + (s.z - a.z) * dz) / L2; t = Math.max(0, Math.min(1, t))
      const px = a.x + dx * t - s.x, py = a.y + dy * t - (s.y + 1), pz = a.z + dz * t - s.z
      if (px * px + py * py * 0.5 + pz * pz < s.r * s.r) return true
    }
    return false
  }
}
