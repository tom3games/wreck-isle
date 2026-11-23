// WRECK ISLE: 軽トラでぶつかり合って壊し合う。爆発したら負け、最後の1台が勝ち（FUSE ISLE の島と爆発を流用）
import * as THREE from 'three'
import { World, raycast } from './collide.js'
import { Level } from './level.js'
import { buildProps } from './props.js'
import { makeRenderer, makeSky, makeSun, makeSea, makePost } from './render.js'
import { FX } from './fx.js'
import { buildRails } from './rails.js'
import { Car, Debris, stageOf, CAR, PAINT, SPARE } from './car.js'
import { preloadVehicles, VT } from './vehicles.js'
import { Person, peopleMethods, FOOT } from './people.js'
import { loadChars, setCharView } from './chars.js'
import { dropMethods } from './wdrop.js'
import { raidMethods } from './raid.js'
import { DROP, pickPath, loadPlane } from './plane.js'
import { Minimap } from './minimap.js'
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js'
import { DriveGrid } from './drive.js'
import { Driver } from './cpu.js'
import { Nav } from './bots.js'
import { itemMethods, ITEMS, ICON, ROLL_T, KINDS } from './items.js'

const Q = Object.fromEntries(new URLSearchParams(location.search))
const $ = s => document.querySelector(s)
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const Snd = window.Snd
const DT = 1 / 60
const PHONE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 500
// 島に置く車の種類の混ぜ方（16台で 軽トラ4・軽自動車3・バギー3・スポーツ2・ダンプ2・バス2）
const TYPE_MIX = ['kei', 'kcar', 'buggy', 'sports', 'kei', 'dump', 'kcar', 'bus', 'buggy', 'kei', 'sports', 'kcar', 'dump', 'buggy', 'kei', 'bus']
const N_CARS = Math.max(2, Math.min(12, +(Q.n || 11)))

// ガソリン缶（赤い携行缶）と給油所（計量機）
const CANM = new THREE.MeshStandardMaterial({ color: 0xb02a1c, roughness: 0.45, metalness: 0.35 })
function canMesh() {
  const g = new THREE.Group(), c = new THREE.Group(); g.add(c); g.userData.can = c
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.3), CANM); b.position.y = 0.75; b.castShadow = true; c.add(b)
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12, Math.PI), CANM); h.position.set(-0.08, 1.16, 0); c.add(h)
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xd8c26a, roughness: 0.4, metalness: 0.8 })); sp.position.set(0.22, 1.2, 0); sp.rotation.z = -0.5; c.add(sp)
  const r = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 28), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })); r.rotation.x = -Math.PI / 2; r.position.y = 0.05; g.add(r)
  return g
}
function pumpMesh() {
  const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0xa8261a, roughness: 0.5 }), white = new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x1e1f20, roughness: 0.7 })
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o }
  add(new THREE.BoxGeometry(2.6, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.9 }), 0, 0.1, 0)
  add(new THREE.BoxGeometry(0.8, 1.7, 0.55), red, 0, 1.05, 0); add(new THREE.BoxGeometry(0.82, 0.3, 0.57), white, 0, 1.75, 0)
  add(new THREE.BoxGeometry(0.5, 0.32, 0.02), dark, 0, 1.25, 0.285)
  const lamp = add(new THREE.BoxGeometry(0.6, 0.14, 0.59), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa630, emissiveIntensity: 1.6 }), 0, 2.0, 0)
  for (const sx of [-0.43, 0.43]) { add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), dark, sx, 0.9, 0.2) }
  for (const sx of [-1.4, 1.4]) add(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), white, sx, 1.8, -0.5)
  add(new THREE.BoxGeometry(3.6, 0.22, 2.2), white, 0, 3.65, -0.3)
  add(new THREE.BoxGeometry(3.62, 0.08, 2.22), red, 0, 3.52, -0.3)
  return g
}

// 組み立て時に計算した升目（公開版だけにある）。形: [nav の数 u32][grid nx u16][grid nz u16] nav の ok（1bit）・grid の ok（1byte）・grid の高さ（int16・cm）
async function loadBake() {
  try {
    if (!document.querySelector('meta[name=wi-pub]')) return null // 開発版には無い
    const r = await fetch('bake.bin.gz'); if (!r.ok) return null
    const { gunzipSync } = await import('../vendor/jsm/libs/fflate.module.js')
    const u = gunzipSync(new Uint8Array(await r.arrayBuffer())), dv = new DataView(u.buffer, u.byteOffset)
    const nn = dv.getUint32(0, true), gnx = dv.getUint16(4, true), gnz = dv.getUint16(6, true), gn = gnx * gnz
    let o = 8
    const nok = new Uint8Array(nn); for (let i = 0; i < nn; i++) nok[i] = (u[o + (i >> 3)] >> (i & 7)) & 1
    o += Math.ceil(nn / 8)
    const gok = u.slice(o, o + gn); o += gn
    const gh = new Float32Array(gn); for (let i = 0; i < gn; i++) gh[i] = dv.getInt16(o + i * 2, true) / 100
    return { nok, gnx, gnz, gok, gh }
  } catch (e) { return null }
}

class Game {
  async init() {
    this.rng = mulberry(+(Q.seed || Date.now() % 1e9))
    const T0 = performance.now(), tm = n => { if (Q.timing) console.log('[timing]', n, Math.round(performance.now() - T0)) }
    if (PHONE && Q.noao == null) Q.noao = '1'
    if (PHONE && Q.pr == null) Q.pr = 1.25
    this.renderer = makeRenderer($('#view'), Q)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200)
    this.world = new World()
    this.setLoad(0.1)
    // 空: BREAK THE ROUTE と同じ晴れた昼の空（実写の HDRI をトーンマップした画像 20〜55KB）。?hdr=1 で FUSE ISLE の夕方の HDR
    if (Q.hdr) { const sky = await makeSky(this.scene, this.renderer); this.sky = sky; this.sunRig = makeSun(this.scene, sky.sunDir); this.scene.fog = new THREE.FogExp2(sky.fogC.clone().multiplyScalar(0.42).convertLinearToSRGB(), 0.0016) }
    else {
      const tex = await new THREE.TextureLoader().loadAsync(PHONE ? 'sky/sky_1k.webp' : 'sky/sky_2k.webp')
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace
      const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromEquirectangular(tex).texture; pm.dispose()
      this.scene.background = tex; this.scene.backgroundIntensity = 1; this.scene.environmentIntensity = 0.9
      const dir = new THREE.Vector3(0.5546, 0.742, 0.3767).normalize() // 元の HDR の太陽の向き（BREAK THE ROUTE と同じ）
      this.sunRig = makeSun(this.scene, dir, { color: 0xfff1dc, power: 3.0, shadow: PHONE ? 1024 : 2048, fill: 0.55 })
      this.scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0012)
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0
    }
    this.sea = makeSea(this.scene)
    this.setLoad(0.3)
    tm('this.setLoad(0.3)')
    this.level = new Level(this.scene, this.world)
    tm('this.level = new Level(t')
    await buildProps(this.scene, this.world, this.level)
    tm('await buildProps(this.sc')
    buildRails(this.scene, this.world)
    // 島に停めてあった軽トラは出さない（車は試合ごとに作る）
    await Promise.all([loadChars(), loadPlane(), preloadVehicles()])
    tm('await Promise.all([loadC')
    for (const m of [this.level.truckMesh, ...(this.level.truckMeshes2 || [])]) if (m) m.visible = false
    this.cullables = this.scene.children.filter(o => o.userData.cullDist > 0)
    this.setLoad(0.7)
    // 走れる升目と歩ける升目は、公開版では組み立てた時に計算しておいた物（bake.bin・約0.1MB）を読む（スマホで起動が数秒速くなる）
    const bake = await loadBake()
    if (bake) { this.grid = Object.assign(Object.create(DriveGrid.prototype), { w: this.world, nx: bake.gnx, nz: bake.gnz, ok: bake.gok, h: bake.gh }); this.nav = Object.assign(Object.create(Nav.prototype), { ok: bake.nok }) }
    else this.grid = new DriveGrid(this.world)
    tm('this.grid = new DriveGri')
    if (!this.nav) this.nav = new Nav(this.world) // 歩く人の道さがし（FUSE ISLE と同じ升目・0.5m）
    tm('this.nav = new Nav(this.')
    this.arenas = this.findArenas()
    tm('this.arenas = this.findA')
    this.setLoad(0.9)
    this.post = makePost(this.renderer, this.scene, this.camera, Q)
    this.fx = new FX(this.scene, this.camera)
    // 速い時だけ画面の外側を放射状にぼかす（BREAK THE ROUTE と同じ考え方）
    this.speedPass = new ShaderPass({ uniforms: { tDiffuse: { value: null }, speed: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float speed; varying vec2 vUv; void main(){ vec2 c = vUv - 0.5; vec4 col = texture2D(tDiffuse, vUv); if (speed > 0.01) { float k = speed * smoothstep(0.15, 0.7, length(c)); vec4 acc = col; for (int i = 1; i <= 5; i++) acc += texture2D(tDiffuse, vUv - c * k * 0.022 * float(i)); col = acc / 6.0; } gl_FragColor = col; }' })
    this.post.comp.insertPass(this.speedPass, Math.max(1, this.post.comp.passes.length - 2))
    // タイヤの跡（濃い灰の帯を地面に置く。古い物から使い回す）
    this.skid = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.55).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 900)
    this.skid.count = 0; this.skid.frustumCulled = false; this.scene.add(this.skid); this.skidN = 0
    this.debris = new Debris(this.scene, this.world)
    this.cars = []; this.ps = []; this.boxes = []; this.balls = []; this.mines = []; this.cans = []; this.pumps = []; this.fuelK = 1
    this.keys = {}; this.touch = { l: false, r: false, rev: false, mx: 0, mz: 0 }
    this.bindInput()
    window.addEventListener('resize', () => this.resize()); this.resize()
    this.defSounds()
    this.makeZoneMesh()
    this.newMatch()
    tm('this.newMatch()')
    this.mode = Q.play ? 'play' : 'title'
    if (Q.play) this.begin()
    this.setLoad(1)
    this.acc = 0; this.last = performance.now(); this.paused = false; this.frames = 0
    window.__fiReady = true
    this.loop()
  }
  setLoad(k) { const b = $('#loadbar'); if (b) b.style.transform = `scaleX(${k})`; if (k >= 1) $('#loading')?.classList.add('done') }
  defSounds() {
    if (!Snd) return
    Snd.def({ boom: ['snd/boom1.mp3', 'snd/boom2.mp3', 'snd/boom3.mp3', 'snd/boom4.mp3'], crash: ['snd/crash1.mp3', 'snd/crash2.mp3', 'snd/crash3.mp3', 'snd/crash4.mp3'], debris: ['snd/debris1.mp3', 'snd/debris2.mp3'], hitl: ['snd/hitl1.mp3', 'snd/hitl2.mp3', 'snd/hitl3.mp3'], thud: 'snd/thud.mp3', glass: ['snd/glass1.mp3', 'snd/glass2.mp3'], boxbreak: 'snd/boxbreak.mp3', roll: ['snd/roll1.mp3', 'snd/roll2.mp3'], spear: 'snd/spear.mp3', latch: 'snd/latch.mp3', repair: ['snd/repair1.mp3', 'snd/repair2.mp3'], tick: 'snd/tick.mp3', jet: 'snd/jet.mp3', magnet: 'snd/magnet.mp3', horn: 'snd/horn.mp3', pin: 'snd/pin.mp3', gull: ['snd/gull1.mp3', 'snd/gull2.mp3'], win: 'snd/win.mp3', lose: 'snd/lose.mp3', siren: 'snd/siren.mp3' })
  }
  startAudio() {
    if (!Snd || this.audioOn) return
    this.audioOn = true; Snd.init()
    Snd.loop('water', 'snd/water.mp3', 0.22); Snd.loop('wind', 'snd/wind.mp3', 0.06); Snd.loop('engine', 'snd/engine.mp3', 0.32)
  }

  // ---------- 円の中心を選ぶ: 走れる所が広くつながっている所 ----------
  findArenas() {
    const G = this.grid, r = mulberry(7), cand = []
    for (let k = 0; k < 900; k++) {
      const x = -320 + r() * 640, z = -80 + r() * 670
      if (!G.free(x, z)) continue
      const o = G.openness(x, z, 50, 5); if (o < 0.55) continue
      cand.push([x, z, o])
    }
    cand.sort((a, b) => b[2] - a[2])
    const top = []
    for (const c of cand.slice(0, 160)) {
      if (top.some(t => Math.hypot(t[0] - c[0], t[1] - c[1]) < 60)) continue
      c[3] = G.reach(c[0], c[1], 70); if (c[3] < 0.55) continue
      top.push(c); if (top.length >= 8) break
    }
    if (Q.arenas) console.log('arenas', JSON.stringify(top.map(t => t.map(v => Math.round(v * 100) / 100))))
    return top.length ? top : [[0, 0, 1, 1]]
  }

  // ---------- 試合 ----------
  newMatch() {
    for (const c of this.cars) c.remove()
    for (const p of this.ps) p.remove()
    this.clearItems(); this.debris.clear()
    this.cars = []; this.ps = []; this.feed = []; this.t = 0; this.over = false; this.winner = null; this.resultShown = false; this.overT = 0
    this.pairT = new Map(); this.stopT = 0; this.slowT = 0
    if (this.skid) { this.skid.count = 0; this.skidN = 0 }
    this.ev = { hits: 0, big: 0, wall: 0, boxes: 0, used: {}, ballHits: 0, mineHits: 0, booms: 0, outKills: 0, kinds: { F: 0, B: 0, L: 0, R: 0 }, exits: 0, enters: 0, cans: 0, pumpFuel: 0, empty: 0, rams: 0, bailSaved: 0, deaths: {} }
    // 円と降下は FUSE ISLE と同じ: 円の中心は島の見どころからくじ、半径 360m。全員が輸送機（300m）から好きな所で降りる
    const G = this.grid, zs = this.level.zoneSpots
    let A = null
    for (let k = 0; k < 40 && !A; k++) { const zp = zs[Math.floor(this.rng() * zs.length)]; for (let t = 0; t < 14; t++) { const x = zp[0] + (this.rng() - 0.5) * 16, z = zp[1] + (this.rng() - 0.5) * 16; if (G.free(x, z)) { A = [x, z]; break } } }
    if (Q.arena != null) A = this.arenas[+Q.arena % this.arenas.length]
    if (!A) A = this.arenas[0]
    const R0 = 360, F = DROP.T
    // 11人なので FUSE ISLE（50人・10分）より早く縮める: 降下 30秒 → 35秒後に縮み始め → 約4分で最後の円 → 少し置いて円が消える
    this.zone = { x: A[0], z: A[1], r: R0, r0: R0, r1: 12, t0: F + 35, t1: F + 250, t2: F + 275, t3: F + 305 }
    this.dropOn = true; this.path = pickPath(this.rng)
    // 置き場の候補: 円の中の走れる所（まわりも広い所）
    const taken = []
    const spot = (rMin, rMax, gap, reach) => {
      for (let k = 0; k < 6000; k++) {
        const a = this.rng() * 6.283, rr = rMin + Math.sqrt(this.rng()) * (rMax - rMin), x = A[0] + Math.cos(a) * rr, z = A[1] + Math.sin(a) * rr
        if (!G.free(x, z) || [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3]].some(([dx, dz]) => !G.free(x + dx, z + dz))) continue
        if (taken.some(p => Math.hypot(p[0] - x, p[1] - z) < gap)) continue
        if (reach && G.reach(x, z, 30) < 0.4) continue
        taken.push([x, z]); return [x, z]
      }
      const p = [A[0] + taken.length * 3, A[1]]; taken.push(p); return p
    }
    // 車は島に置いておく（全員が歩きで着地するので、人数より少し多め）。壊れ具合とガソリンはばらばら
    const NC = N_CARS + (Q.spare != null ? +Q.spare : 5)
    for (let i = 0; i < NC; i++) {
      const [x, z] = spot(0, R0 * 0.8, 34, true), c = new Car(this, i, x, z, this.rng() * 6.28, i < PAINT.length ? PAINT[i] : SPARE[i % SPARE.length], TYPE_MIX[i % TYPE_MIX.length])
      if (i === 0) c.paintName = '白'
      c.hp = 60 + Math.round(this.rng() * 40); c.fuel = c.T.tank * (0.35 + this.rng() * 0.55); c.wear(); this.cars.push(c)
    }
    const NAMES = PAINT.map(p => p[0])
    for (let i = 0; i < N_CARS; i++) {
      const p = new Person(this, i, NAMES[i], i === 0); p.nid = i
      if (i > 0 || Q.auto) p.ai = new Driver(p, this, this.rng)
      this.ps.push(p); this.boardPlane(p)
    }
    this.me = this.ps[0]
    // 箱 80 個・ガソリン缶 36 個・給油所 5 か所（島ぜんぶに散らす）
    const bs = []; for (let k = 0; k < 80; k++) bs.push(spot(0, R0 * 0.85, 14, false))
    this.placeBoxes(bs)
    this.placeFuel(Array.from({ length: 36 }, () => spot(0, R0 * 0.85, 14, false)), Array.from({ length: 5 }, () => spot(0, R0 * 0.7, 60, true)))
    this.planDrops()
    this.resetDropVisual()
    this.resetRaid()
    this.camYaw = Math.atan2(this.path.dx, this.path.dz); this.camReady = false
    this.countT = -1
    $('#result')?.classList.remove('show')
    this.hudCache = {}
  }
  get player() { return this.me ? this.me.car : null }
  begin() {
    this.mode = 'play'; this.started = true
    if (Q.play) $('#title').style.display = 'none'
    $('#title')?.classList.add('gone'); $('#hud')?.classList.add('on')
    this.startAudio()
  }

  // ---------- 当たり ----------
  // 車どうし: 前後2つの円で当てる。当てた側の速さと、当たった所（横・後ろは大きく、正面は痛み分け）で壊れ方を決める
  carHits() {
    const cs = this.cars
    for (const c of cs) { c._px = c.x; c._pz = c.z }
    this._carHits()
    // 押し合いで水の中へ押し込まない（押し合いは位置を直接動かすので、車の動きの水の判定を通らない）
    for (const c of cs) if (c.alive && !c.air && (c.x !== c._px || c.z !== c._pz) && c.groundAt(c.x, c.z) < -0.4 && c.groundAt(c._px, c._pz) >= -0.4) { c.x = c._px; c.z = c._pz; const v = Math.hypot(c.vx, c.vz); if (v > 0) { c.vx *= 0.2; c.vz *= 0.2 } }
  }
  _carHits() {
    const cs = this.cars
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const A = cs[i], B = cs[j]
      if (Math.abs(A.x - B.x) > 5 || Math.abs(A.z - B.z) > 5) continue
      // 踏みつけ: 上から落ちてきた車が下の車の屋根に乗ると、下の車が大きく壊れる
      { const dy = A.y - B.y
        if (Math.abs(dy) > 0.9 && Math.abs(dy) < 2.6) {
          const top = dy > 0 ? A : B, bot = top === A ? B : A
          if (top.vy <= 0 && top.air && top.circles().some(p => bot.circles().some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5))) this.stomp(top, bot)
          continue
        }
        if (Math.abs(dy) > 2.2) continue }
      let best = null
      for (const p of A.circles()) for (const q of B.circles()) {
        const dx = q[0] - p[0], dz = q[1] - p[1], d = Math.hypot(dx, dz), pen = A.T.r + B.T.r + 0.05 - d
        if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: dx / (d || 1), nz: dz / (d || 1), px: (p[0] + q[0]) / 2, pz: (p[1] + q[1]) / 2 }
      }
      if (!best) continue
      const { nx, nz } = best
      const mA = A.T.mass * (A.alive ? 1 : 2.2), mB = B.T.mass * (B.alive ? 1 : 2.2) // 車の重さ。燃えた残骸は重い
      // 重なりをほどく
      const s = best.pen / (mA + mB)
      A.x -= nx * s * mB; A.z -= nz * s * mB; B.x += nx * s * mA; B.z += nz * s * mA
      const vrel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz
      if (vrel >= 0) continue
      const close = -vrel
      // 当てた側の速さ（相手の方へ向かう成分）
      const uA = Math.max(0, A.vx * nx + A.vz * nz), uB = Math.max(0, -(B.vx * nx + B.vz * nz))
      const jA = A.jetT > 0 ? 1.6 : 1, jB = B.jetT > 0 ? 1.6 : 1
      const e = 0.35, J = (1 + e) * close / (1 / mA + 1 / mB)
      const kA = J / mA * (jB / jA > 1 ? 1.3 : jA > jB ? 0.7 : 1), kB = J / mB * (jA / jB > 1 ? 1.3 : jB > jA ? 0.7 : 1)
      A.vx -= nx * kA; A.vz -= nz * kA; B.vx += nx * kB; B.vz += nz * kB
      // 回る: 当たった所が真ん中からずれているほど回る（後ろの角を押すと回される）
      for (const [C, sg, k] of [[A, -1, kA], [B, 1, kB]]) {
        const rx = best.px - C.x, rz = best.pz - C.z, tq = (rx * nz * sg - rz * nx * sg)
        C.w += -tq * k * 0.16; C.slideT = Math.max(C.slideT, close > 6 ? 0.7 : 0.25)
      }
      if (close < 3.5) { if (close > 1.5) this.scrape(best, A, B); continue }
      const key = i * 64 + j, last = this.pairT.get(key) ?? -9
      if (this.t - last < 0.3) continue
      this.pairT.set(key, this.t)
      const zA = A.zoneAt(best.px, best.pz), zB = B.zoneAt(best.px, best.pz)
      const p = new THREE.Vector3(best.px, Math.max(A.y, B.y) + 0.75, best.pz)
      const f = u => Math.max(0, u - 3) * 1.25
      const zm = z => z === 'F' ? 0.6 : z === 'B' ? 1.35 : 1.6
      // 車の種類: 体当たりの強さ（ram）と硬さ（armor）
      let dA = (f(uB) * jB * zm(zA) * B.T.ram + f(close) * 0.08) / A.T.armor, dB = (f(uA) * jA * zm(zB) * A.T.ram + f(close) * 0.08) / B.T.armor
      // 槍: 自分の正面で当たった時は自分は痛まず、相手が大きく壊れる
      if (A.spearT > 0 && zA === 'F') { dB = Math.max(dB, f(close) * 0.9 + 10) * 1.9; dA = 0; this.spearHit(A, p) }
      if (B.spearT > 0 && zB === 'F') { dA = Math.max(dA, f(close) * 0.9 + 10) * 1.9; dB = 0; this.spearHit(B, p) }
      this.ev.hits++
      const big = Math.max(dA, dB)
      if (big > 20) this.ev.big++
      this.impact(p, new THREE.Vector3(nx, 0, nz), big, A, B, close)
      if (A.alive && B.alive) { this.ev.kinds[dA > dB ? zA : zB]++ }
      if (A.alive && dA > 0.5) this.damage(A, dA, B.alive ? B : null, p, zA, 'car', new THREE.Vector3(-nx, 0.2, -nz).multiplyScalar(3 + close * 0.3))
      if (B.alive && dB > 0.5) this.damage(B, dB, A.alive ? A : null, p, zB, 'car', new THREE.Vector3(nx, 0.2, nz).multiplyScalar(3 + close * 0.3))
      // 自分が当てた時だけ当たった所を一言
    }
  }
  stomp(top, bot) {
    const key = 'st' + top.idx + ':' + bot.idx; if (this.t - (this.pairT.get(key) ?? -9) < 0.5) return; this.pairT.set(key, this.t)
    const p = new THREE.Vector3((top.x + bot.x) / 2, bot.y + 1.85, (top.z + bot.z) / 2), hard = -top.vy
    top.y = bot.y + 1.9; top.vy = 5.5; top.air = true; top.jumped = false
    bot.vy = Math.min(bot.vy, -2); bot.slideT = 0.6
    this.ev.stomps = (this.ev.stomps || 0) + 1
    this.impact(p, new THREE.Vector3(0, 1, 0), 30 + hard * 2, top, bot, hard)
    if (bot.alive) this.damage(bot, 40 + hard * 3, top.alive ? top : null, p, ['L', 'R', 'F', 'B'][Math.floor(this.rng() * 4)], 'stomp', new THREE.Vector3(0, 3, 0))
  }
  spearHit(c, p) { this.sound('spear', p, 0.8); for (let i = 0; i < 10; i++) this.fx.sprite({ map: window.__fxT.soft, add: true, pos: p.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 8, (Math.random() - 0.5) * 16), size: 0.08, life: 0.4, hdr: [6, 6, 6], color2: 0xffd090, drag: 1.5, rise: -12, fadeIn: 0 }) }
  scrape(b, A, B) {
    if (Math.random() > 0.35) return
    const p = new THREE.Vector3(b.px, Math.max(A.y, B.y) + 0.6, b.pz)
    for (let i = 0; i < 3; i++) this.fx.sprite({ map: window.__fxT.soft, add: true, pos: p, vel: new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6), size: 0.06, life: 0.3, hdr: [6, 3.4, 1.2], color2: 0xff4010, drag: 1.4, rise: -10, fadeIn: 0 })
  }
  // ぶつかった瞬間の手応え: 火花・破片・閃光・音・ヒットストップ・揺れ
  impact(p, n, dmg, A, B, close) {
    const T = window.__fxT, k = Math.min(1, dmg / 40)
    const nS = Math.round(16 + dmg * 1.6)
    for (let i = 0; i < nS; i++) {
      const t = new THREE.Vector3(-n.z, 0, n.x).multiplyScalar((Math.random() - 0.5) * 2), d = t.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.9, (Math.random() - 0.5) * 0.8)).normalize()
      this.fx.sprite({ map: T.soft, add: true, pos: p.clone(), vel: d.multiplyScalar(6 + Math.random() * 14 * (0.5 + k)), size: 0.06 + Math.random() * 0.07, life: 0.25 + Math.random() * 0.35, hdr: [7, 4, 1.4], color2: 0xff4010, drag: 1.6, rise: -14, fadeIn: 0 })
    }
    this.fx.sprite({ map: T.soft, add: true, pos: p.clone(), size: 0.6 + k * 1.6, grow: 2 + k * 3, life: 0.08, hdr: [3, 2.4, 1.6], fadeIn: 0 })
    for (let i = 0; i < 2 + k * 4; i++) this.fx.sprite({ map: T.smoke[i % 4], pos: p.clone().add(new THREE.Vector3(0, -0.3, 0)), vel: new THREE.Vector3((Math.random() - 0.5) * 3, 0.6 + Math.random(), (Math.random() - 0.5) * 3), size: 0.6, grow: 2.2, life: 1.2 + Math.random(), color: 0x9a9286, color2: 0xb8b0a4, drag: 1.4, alpha: 0.45, fadeIn: 0.04 })
    this.fx.flash(p, 14 + dmg * 1.2, 0.12)
    for (const C of [A, B]) this.debris.chip(p, new THREE.Vector3(C.vx * 0.4, 1, C.vz * 0.4), C.color, Math.round(2 + dmg / 6))
    this.sound('crash', p, Math.min(1, 0.35 + dmg / 35), { far: true })
    if (dmg > 14) this.sound('thud', p, Math.min(1, dmg / 30))
    if (dmg > 22) this.sound('debris', p, Math.min(0.9, dmg / 45), { delay: 0.12 })
    if (dmg < 10) this.sound('hitl', p, 0.6)
    const near = A === this.player || B === this.player, cd = this.camera.position.distanceTo(p)
    if (near || cd < 22) {
      this.stopT = Math.max(this.stopT, Math.min(0.13, 0.035 + dmg * 0.0022) * (near ? 1 : 0.6))
      this.fx.shake = Math.min(1.6, this.fx.shake + (near ? 0.25 + k * 0.9 : 0.4 * k * (1 - cd / 22)))
      if (near) this.hurtK = Math.min(1, (this.hurtK || 0) + (A === this.player || B === this.player ? 0.15 : 0))
    }
  }
  // 壊す: へこみ・部品・壊れの段階・爆発
  damage(c, d, by, p, zone, how, vel) {
    if (!c.alive) return
    const st0 = c.stage
    const raw = how === 'zone' || how === 'burn' ? 0 : d // 見た目（へこみ・部品）は当たりの強さのまま
    if (how !== 'zone' && how !== 'car') d /= c.T.armor // 車の硬さ（ぶつけ合いは carHits で割ってある）
    if (how !== 'zone') d *= 0.34 // 体力の減り方（CPU 戦で約3分になるように合わせた）
    c.hp -= d; c.dealtBy = by
    if (by && by.driver) { c.lastHitBy = by.driver; c.lastHitT = this.t; by.dealt += d }
    if (raw > 4) c.dent(p, Math.min(1.2, raw / 30))
    const n = raw > 34 ? 3 : raw > 18 ? 2 : raw > 8 ? 1 : 0
    if (n) c.breakParts(zone, n, vel || new THREE.Vector3(0, 2, 0))
    c.wear()
    if (c === this.player && c.driver) this.hurtK = Math.min(1, (this.hurtK || 0) + raw / 80)
    if (c.hp <= 0) { this.explodeCar(c, by, how); return }
    if (c.stage > st0 && c === this.player) this.toast(['', '煙が出た', '黒い煙', '火が出た'][c.stage])
  }
  explodeCar(c, by, how) {
    c.alive = false; c.hp = 0; this.ev.booms++
    const killer = (by && by.driver) || (c.lastHitBy && this.t - c.lastHitT < 8 ? c.lastHitBy : null)
    if (how === 'zone') this.ev.outKills++
    const rider = c.driver
    const p = new THREE.Vector3(c.x, c.y + 0.9, c.z)
    this.fx.explosion(p, 2.1, { groundY: c.y })
    this.fx.fire(new THREE.Vector3(c.x, c.y + 1.0, c.z), 18)
    this.sound('boom', p, 1, { far: true }); this.sound('debris', p, 0.8, { delay: 0.25 })
    this.bigShake(p, 1.4)
    c.burnt()
    for (const z of ['F', 'B', 'L', 'R']) c.breakParts(z, 2, new THREE.Vector3(0, 6, 0))
    while (c.v3.parts.bed.length) this.debris.fling(c.v3.parts.bed.pop(), new THREE.Vector3((Math.random() - 0.5) * 8, 8 + Math.random() * 4, (Math.random() - 0.5) * 8), 10)
    c.vy = 8.5; c.air = true; c.fwX += (Math.random() - 0.5) * 6; c.fwZ += (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3); c.w += (Math.random() - 0.5) * 5
    c.spearT = c.jetT = c.magT = 0; c.item = null; c.rollT = 0
    // まわりの車も爆風で押されて壊れる（誘爆あり）。歩いている人は吹き飛ぶ
    for (const o of this.cars) {
      if (o === c) continue
      const d = Math.hypot(o.x - c.x, o.z - c.z); if (d > 8) continue
      const k = 1 - d / 8, nx = (o.x - c.x) / (d || 1), nz = (o.z - c.z) / (d || 1)
      o.vx += nx * 12 * k; o.vz += nz * 12 * k; o.vy = Math.max(o.vy, 3 * k); if (k > 0.3) o.air = true; o.slideT = 0.8
      if (o.alive) this.damage(o, 12 * k, killer && killer.car ? killer.car : null, new THREE.Vector3(o.x - nx, o.y + 0.8, o.z - nz), o.zoneAt(c.x, c.z), 'boom')
    }
    this.blastPeople(c.x, c.y, c.z, 9, 70, killer)
    if (rider) this.killPerson(rider, killer && killer !== rider ? killer : null, 'boom')
    else if (c.exDriver && this.t - c.exT < 6 && c.exDriver.alive) this.ev.bailSaved++
  }
  blastPeople(x, y, z, R, dmg, by) {
    for (const p of this.ps) {
      if (p.car || p.air || !p.alive) continue
      const B = p.body, d = Math.hypot(B.x - x, B.z - z); if (d > R) continue
      const k = 1 - d / R, nx = (B.x - x) / (d || 1), nz = (B.z - z) / (d || 1)
      B.vx += nx * 10 * k; B.vz += nz * 10 * k; B.vy = Math.max(B.vy, 3 + 4 * k); B.onGround = false; p.stun = Math.max(p.stun, 0.8); if (k > 0.3 && !p.char.dead) p.char.knock()
      this.hurtPerson(p, dmg * k, by && by !== p ? by : null, 'boom')
    }
  }
  skidMarks() {
    const cp = this.camera.position, m4 = this._m4 || (this._m4 = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), e = this._e || (this._e = new THREE.Euler())
    for (const c of this.cars) {
      if (!c.alive || c.air || (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 70 * 70) { c._skidP = null; continue }
      const [fx, fz] = c.fwd(), vl = Math.abs(c.vx * -fz + c.vz * fx), sp = Math.hypot(c.vx, c.vz)
      const slide = vl > 2.6 || (c.input && c.input.throttle < 0 && c.speed > 6) || (c.slideT > 0 && sp > 5)
      if (!slide) { c._skidP = null; continue }
      const back = -c.T.half[0] * 0.7
      if (c._skidP && Math.hypot(c.x - c._skidP[0], c.z - c._skidP[1]) < 0.45) continue
      c._skidP = [c.x, c.z]
      e.set(0, Math.atan2(c.vx, c.vz), 0); q.setFromEuler(e)
      for (const sb of [-c.T.half[1] * 0.8, c.T.half[1] * 0.8]) {
        const [x, z] = c.world(back, sb), y = c.groundAt(x, z) + 0.03
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); this.skid.setMatrixAt(this.skidN % 900, m4); this.skidN++
      }
      if (vl > 4 && Math.random() < 0.35) this.fx.sprite({ map: window.__fxT.smoke[0], pos: new THREE.Vector3(...c.world(back, 0).slice(0, 1), c.y + 0.3, c.world(back, 0)[1]), vel: new THREE.Vector3(0, 0.6, 0), size: 0.5, grow: 1.8, life: 1.1, color: 0xbab4aa, color2: 0xd8d4cc, drag: 1.5, alpha: 0.35, fadeIn: 0.05 })
    }
    this.skid.count = Math.min(900, this.skidN); this.skid.instanceMatrix.needsUpdate = true
  }
  sinkCar(c) {
    c.alive = false; c.hp = 0; this.fx.splash(new THREE.Vector3(c.x, -1.2, c.z)); this.sound('thud', c, 0.8)
    if (c.driver) this.killPerson(c.driver, c.lastHitBy && this.t - c.lastHitT < 8 ? c.lastHitBy : null, 'sea')
    c.pivot.visible = false; c.x = c.z = 1e5
  }
  bigShake(p, s) { const cd = this.camera.position.distanceTo(p); this.fx.shake = Math.min(1.8, this.fx.shake + s * 10 / (cd + 6)); this.flashK = Math.max(this.flashK || 0, Math.min(0.12, 2.5 / (cd * cd + 10))) }
  glassBurst(m, c) {
    const p = m.getWorldPosition(new THREE.Vector3()); m.visible = false
    this.debris.chip(p, new THREE.Vector3(c.vx * 0.3, 2, c.vz * 0.3), 0x9fb4bc, 12)
    this.sound('glass', p, 0.6)
  }
  wallHit(c, sp) {
    const tk = (c._wt || -9); if (this.t - tk < 0.4) return; c._wt = this.t
    this.ev.wall++
    const [fx, fz] = c.fwd(), p = new THREE.Vector3(c.x + fx * 1.8, c.y + 0.6, c.z + fz * 1.8)
    this.sound(sp > 11 ? 'crash' : 'hitl', p, Math.min(0.8, sp / 22))
    if (sp > 10) { for (let i = 0; i < 8; i++) this.fx.sprite({ map: window.__fxT.soft, add: true, pos: p, vel: new THREE.Vector3((Math.random() - 0.5) * 8, 1 + Math.random() * 4, (Math.random() - 0.5) * 8), size: 0.06, life: 0.3, hdr: [6, 3.4, 1.2], color2: 0xff4010, drag: 1.4, rise: -12, fadeIn: 0 }) }
    if (sp > 11 && c.alive) this.damage(c, (sp - 11) * 0.9, null, p, 'F', 'wall', new THREE.Vector3(-fx * 3, 2, -fz * 3))
    if (c === this.player) this.fx.shake = Math.min(1.2, this.fx.shake + sp * 0.03)
  }
  landHit(c, hard, jumped) {
    this.sound('thud', c, jumped ? 1 : Math.min(1, hard / 12))
    if (jumped) { this.sound('hitl', c, 0.5); const cd = this.camera.position.distanceTo(new THREE.Vector3(c.x, c.y, c.z)); if (cd < 30) this.fx.shake = Math.min(1.2, this.fx.shake + 0.35 * (1 - cd / 30)) }
    for (let i = 0; i < (jumped ? 12 : 5); i++) this.fx.sprite({ map: window.__fxT.smoke[i % 4], pos: new THREE.Vector3(c.x + (Math.random() - 0.5) * 3, c.y + 0.3, c.z + (Math.random() - 0.5) * 3), vel: new THREE.Vector3((Math.random() - 0.5) * 5, 0.5, (Math.random() - 0.5) * 5), size: 0.8, grow: 2.4, life: 1.6, color: 0x8a7e6e, color2: 0xa89c8a, drag: 2, alpha: 0.5, fadeIn: 0.03 })
    if (hard > (jumped ? 15 : 9) && c.alive) this.damage(c, (hard - 9) * 1.6, c.lastHitBy && this.t - c.lastHitT < 3 ? c.lastHitBy : null, new THREE.Vector3(c.x, c.y + 0.4, c.z), 'B', 'land')
    if (c === this.player) this.fx.shake = Math.min(1.2, this.fx.shake + hard * 0.04)
  }

  // ---------- 円 ----------
  makeZoneMesh() {
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: 'uniform float uT; varying vec2 vUv; varying vec3 vW; void main(){ float s = 0.5+0.5*sin(vW.y*3.0 - uT*2.0 + vUv.x*120.0); float a = (0.10 + 0.06*s) * smoothstep(1.0, 0.0, vUv.y) ; gl_FragColor = vec4(1.0, 0.62, 0.32, a); }' })
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 128, 1, true), m)
    this.zoneMesh.position.y = 26; this.zoneMesh.renderOrder = 4; this.scene.add(this.zoneMesh)
  }
  updateZone(dt) {
    const z = this.zone, t = this.t
    if (t < z.t1) z.r = z.r0 + (z.r1 - z.r0) * THREE.MathUtils.clamp((t - z.t0) / (z.t1 - z.t0), 0, 1)
    else if (t < z.t2) z.r = z.r1
    else z.r = z.r1 * Math.max(0, 1 - (t - z.t2) / (z.t3 - z.t2)) // 最後は円が消えて、全員が少しずつ壊れる
    this.zoneMesh.scale.set(Math.max(0.5, z.r), 1, Math.max(0.5, z.r)); this.zoneMesh.position.x = z.x; this.zoneMesh.position.z = z.z
    this.zoneMesh.material.uniforms.uT.value = t
    for (const c of this.cars) {
      if (!c.alive) continue
      const out = Math.hypot(c.x - z.x, c.z - z.z) > z.r
      if (out) { c.outT += dt; this.damage(c, dt * (t > z.t2 ? 7 : 5) * (c.driver ? 1 : 0.4), null, new THREE.Vector3(c.x, c.y + 1, c.z), 'F', 'zone') } else c.outT = 0
    }
    for (const p of this.ps) if (p.alive && !p.car && !p.air && dt > 0 && Math.hypot(p.body.x - z.x, p.body.z - z.z) > z.r) this.hurtPerson(p, dt * 3, null, 'zone')
  }
  // 空き車の補給: 乗っていない車が少なければ、円の中に空から1台落とす（歩いている人の逃げ道）
  supplyCars(dt) {
    if (this.t < 35) return
    this.supT = (this.supT ?? 18) - dt; if (this.supT > 0) return
    this.supT = 20
    if (this.cars.filter(c => c.alive && !c.driver).length >= 4) return
    const z = this.zone
    for (let k = 0; k < 200; k++) {
      const a = this.rng() * 6.283, r = Math.sqrt(this.rng()) * z.r * 0.7, x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r
      if (!this.grid.free(x, zz) || [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dz]) => !this.grid.free(x + dx, zz + dz))) continue
      if (this.cars.some(c => Math.hypot(c.x - x, c.z - zz) < 8)) continue
      const c = new Car(this, 200 + this.cars.length, x, zz, this.rng() * 6.28, SPARE[this.cars.length % SPARE.length], TYPE_MIX[Math.floor(this.rng() * TYPE_MIX.length)])
      c.hp = 55 + Math.round(this.rng() * 45); c.fuel = 30 + Math.round(this.rng() * 50); c.wear()
      c.y += 14; c.vy = -2; c.air = true; this.cars.push(c); this.ev.supply = (this.ev.supply || 0) + 1
      if (this.me.alive && !this.me.car && Math.hypot(x - this.me.x, zz - this.me.z) < 90) this.toast('空き車が落ちてきた')
      return
    }
  }
  // ---------- ガソリン: 缶（走って取る）と給油所（ゆっくり寄せると満たされる） ----------
  placeFuel(cans, pumps) {
    for (const k of [...this.cans, ...this.pumps]) this.scene.remove(k.mesh)
    const H = (x, z) => this.grid.h[this.grid.cell(x, z)[1] * this.grid.nx + this.grid.cell(x, z)[0]]
    this.cans = cans.map(([x, z]) => { const mesh = canMesh(); mesh.position.set(x, H(x, z), z); this.scene.add(mesh); return { x, z, y: H(x, z), on: true, t: 0, mesh } })
    this.pumps = pumps.map(([x, z]) => { const mesh = pumpMesh(); mesh.position.set(x, H(x, z), z); mesh.rotation.y = this.rng() * 6; this.scene.add(mesh); return { x, z, pump: true, mesh } })
  }
  updateFuel(dt) {
    for (const k of this.cans) {
      if (!k.on) { k.t -= dt; if (k.t <= 0) { k.on = true; k.mesh.visible = true } continue }
      k.mesh.userData.can.rotation.y += dt * 1.2
      for (const c of this.cars) if (c.alive && c.driver && Math.hypot(c.x - k.x, c.z - k.z) < 2.3) {
        k.on = false; k.t = 14; k.mesh.visible = false; c.fuel = Math.min(c.T.tank, c.fuel + c.T.tank * 0.45); this.ev.cans++
        this.sound('latch', k, 0.7); if (c === this.player) this.toast('ガソリン +45'); break
      }
    }
    for (const q of this.pumps) for (const c of this.cars) {
      if (!c.alive || !c.driver || c.fuel >= c.T.tank || Math.hypot(c.x - q.x, c.z - q.z) > 5 || Math.hypot(c.vx, c.vz) > 4) continue
      c.fuel = Math.min(c.T.tank, c.fuel + dt * c.T.tank * 0.3); this.ev.pumpFuel += dt * 30
      if (c === this.player && (this._pumpT = (this._pumpT || 0) + dt) > 0.25) { this._pumpT = 0; this.sound('tick', c, 0.3) }
    }
  }

  // ---------- 1コマ ----------
  step(dt) {
    if (this.mode === 'play') this.t += dt
    if (this.mode === 'play') { const k = Math.ceil(this.countT); this.countT -= dt; if (Math.ceil(this.countT) !== k && this.countT > 0) this.sound('tick', this.me, 0.6) }
    const go = this.mode === 'play' && this.countT <= 0
    setCharView(this.camera, this.world)
    for (const p of this.ps) {
      if (!go || !p.alive) { if (p.car) p.car.input = { throttle: 0, steer: 0 }; p.input = { mx: 0, mz: 0 } }
      else if (p.air) { if (!p.ai) { p.input = this.footInput(); p.aimYaw = this.camYaw } }
      else if (p.ai) p.ai.update(dt)
      else if (p.car) p.car.input = this.playerInput()
      else p.input = this.footInput()
    }
    for (const c of this.cars) c.update(dt)
    this.skidMarks()
    for (const p of this.ps) this.updatePerson(p, dt)
    this.carHits()
    this.personHits()
    this.updateFuel(dt)
    if (go) { this.supplyCars(dt); this.updateRaid(dt) }
    this.updateItems(dt)
    this.updateBoxes(dt)
    this.debris.update(dt)
    this.fx.update(dt)
    if (go) this.updateZone(dt); else this.updateZone(0)
    if (this.over) { this.overT += dt; if (this.overT > 2.6 && !this.resultShown) this.showResult() }
    else if (!this.me.alive && this.t - this.me.deadT > 3 && !this.resultShown) this.showResult()
    this.gullT = (this.gullT ?? 6) - dt; if (this.gullT < 0) { this.gullT = 10 + this.rng() * 14; this.sound('gull', { x: this.zone.x + (this.rng() - 0.5) * 60, y: 12, z: this.zone.z + (this.rng() - 0.5) * 60 }, 0.4) }
  }
  playerInput() {
    const k = this.keys, T = this.touch
    const left = k.KeyA || k.ArrowLeft || T.l, right = k.KeyD || k.ArrowRight || T.r
    const rev = k.KeyS || k.ArrowDown || T.rev
    return { throttle: rev ? -1 : 1, steer: (left ? 1 : 0) - (right ? 1 : 0) }
  }
  // 歩き: キーはカメラの向きに対して、画面は左手のスティック
  footInput() {
    const k = this.keys, T = this.touch
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
    if (T.mx || T.mz) { f = T.mz; r = T.mx }
    const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l }
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw)
    return { mx: fx * f - fz * r, mz: fz * f + fx * r }
  }
  toggleCar() {
    const p = this.me; if (!p.alive || this.mode !== 'play' || this.countT > 0) return
    if (p.car) { if (this.t - (p.enterT || -9) > 0.5) this.exitCar(p) }
    else { const c = this.nearEmptyCar(p); if (c && p.stun <= 0) { this.enterCar(p, c); p.enterT = this.t; this.touch.rev = false; $('#gear').classList.remove('on') } }
  }
  sound(name, at, vol = 1, o = {}) {
    if (!Snd || !this.audioOn || this._quiet) return
    const d = this.camera.position.distanceTo(new THREE.Vector3(at.x, at.y || 0, at.z))
    const v = vol / (1 + d / (o.far ? 30 : 12))
    if (v < 0.02) return
    Snd.play(name, { vol: v, jitter: 0.08, delay: (o.delay || 0) + (o.far ? Math.min(0.12, d / 343) : 0), offset: o.offset })
  }
  // ---------- カメラ ----------
  updateCamera(dt) {
    if (this.freeCam) { const c = this.freeCam; this.camera.position.set(c[0], c[1], c[2]); this.camera.lookAt(c[3], c[4], c[5]); return }
    if (this.mode === 'title') {
      const a = performance.now() * 0.00005, z = this.zone
      this.camera.position.set(z.x + Math.sin(a) * 34, 14 + Math.sin(a * 2) * 2, z.z + Math.cos(a) * 34); this.camera.lookAt(z.x, 1.5, z.z); return
    }
    let P = this.me
    if (!P.alive && this.t - P.deadT > 2.2) P = (P.killedBy && P.killedBy.alive) ? P.killedBy : this.ps.find(c => c.alive) || P
    this.camTgt = P
    if (P.air && P.air.mode === 'plane') { // 輸送機の斜め後ろから島を見下ろす
      // マウス・なぞりで機のまわりを回って島を見る（FUSE ISLE と同じ）
      const pl = this.planeMesh ? this.planeMesh.position : new THREE.Vector3(P.body.x, P.body.y, P.body.z), cp = Math.cos(this.camPitch * 0.6), sp0 = Math.sin(this.camPitch * 0.6)
      const want = new THREE.Vector3(pl.x - Math.sin(this.camYaw - 0.5) * 24 * cp, pl.y + 9 + 24 * sp0, pl.z - Math.cos(this.camYaw - 0.5) * 24 * cp)
      if (!this.camReady) { this.camPos = want.clone(); this.camReady = true }
      this.camPos.lerp(want, 1 - Math.exp(-dt * 6)); this.camera.position.copy(this.camPos); this.camera.lookAt(pl.x + Math.sin(this.camYaw) * 30, pl.y - 30, pl.z + Math.cos(this.camYaw) * 30)
      this.camera.fov += (66 - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix(); return
    }
    const t = P.car || null, B = P.body
    const tx = t ? t.x : B.x, ty = t ? t.y : B.y, tz = t ? t.z : B.z, vx = t ? t.vx : B.vx, vz = t ? t.vz : B.vz
    const sp = Math.hypot(vx, vz)
    // 車: カメラは車の後ろへついていく（followYaw）。マウス・なぞりで横や後ろを見られ（lookOff）、1.5秒さわらなければゆっくり後ろへ戻る
    // 歩き・落下・傘: FUSE ISLE と同じく、カメラの向きはマウス・なぞりだけで決まり、進む向きはカメラの向き
    const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), idle = (performance.now() - (this.lookT || 0)) / 1000 > 1.5
    if (t) {
      if (this.followYaw == null || this.camMode !== 'car') { this.followYaw = this.camYaw - (this.lookOff = 0); this.lookOff = 0 }
      const mv = sp > 3 && t.speed > 0 ? Math.atan2(vx, vz) : t.yaw
      if (!t.air) this.followYaw += wrapA(mv - this.followYaw) * Math.min(1, dt * 3.2)
      if (idle) { this.lookOff *= Math.exp(-dt * 1.8); this.camPitch *= Math.exp(-dt * 1.8) }
      this.camYaw = this.followYaw + this.lookOff
      this.camMode = 'car'
    } else { this.camMode = 'foot'; this.followYaw = null }
    // FUSE ISLE の updateCamera と同じ距離・高さ・注視点: 車 dist 5.0・side 0・頭 2.0、歩き dist 1.7・side 0.52・頭 1.6、落下 4.6・傘 5.8
    const am = P.air && P.air.mode
    const dist = t ? 5.0 : am === 'chute' ? 5.8 : am === 'fall' ? 4.6 : 1.7, side = t ? 0 : am ? 0.2 : 0.52, up = t ? 2.0 : am === 'chute' ? 2.3 : am === 'fall' ? 1.0 : 1.6
    const pitch = -0.12 - this.camPitch, cpch = Math.cos(pitch) // FUSE の初めの見下ろし -0.12 に、マウスの上下を足す
    const fwd = new THREE.Vector3(Math.sin(this.camYaw) * cpch, Math.sin(pitch), Math.cos(this.camYaw) * cpch)
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw)) // 画面の右
    const head = new THREE.Vector3(tx, ty + up, tz)
    const wantP = head.clone().addScaledVector(fwd, -dist).addScaledVector(right, side).add(new THREE.Vector3(0, 0.25, 0))
    const h = raycast(this.world, [head.x, head.y, head.z], [wantP.x, wantP.y, wantP.z])
    if (h) { const len = head.distanceTo(wantP) || 1; wantP.lerpVectors(head, wantP, Math.max(0.1, h.t - 0.3 / len)) } // 壁の手前 30cm まで寄せる
    if (!this.camReady) { this.camPos = wantP.clone(); this.camReady = true }
    this.camPos.lerp(wantP, 1 - Math.exp(-dt * 18))
    this.camera.position.copy(this.camPos)
    const look = this.camPos.clone().addScaledVector(fwd, 10)
    if (this.fx.shake > 0) { const s = this.fx.shake * 0.12; this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)) }
    this.camera.lookAt(look)
    const fov = (t ? 62 : (sp > 5.2 ? 66 : 62)) + (t && t.jetT > 0 ? 8 : 0) + (innerHeight > innerWidth ? 10 : 0)
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix()
  }
  render(dt) {
    this.updateCamera(dt)
    const cp = this.camera.position, recheck = (this._cullN = (this._cullN || 0) + 1) % 6 === 0
    if (recheck) for (const o of this.cullables) o.visible = (o.position.x - cp.x) ** 2 + (o.position.z - cp.z) ** 2 < o.userData.cullDist ** 2
    if (recheck) for (const c of this.cars) c.pivot.visible = (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 < 200 * 200
    this.sea.tick(performance.now() / 1000)
    this.syncPlane(dt); this.airAudio(); this.raidVisual(dt)
    if (this.mode === 'play' && this.minimap) this.minimap.draw()
    const fs = this.cars.map(c => ({ body: c.body, alive: c.alive }))
    if (this.level.grass) this.level.grass.tick(performance.now() / 1000, fs, cp)
    if (this.level.grass2) this.level.grass2.tick(performance.now() / 1000, fs, cp)
    { const S = this.sunRig.sun, s = 96 / 4096 * 2, tx = Math.round(cp.x / s) * s, tz = Math.round(cp.z / s) * s; S.target.position.set(tx, 0, tz); S.position.copy(this.sunRig.dir).multiplyScalar(80).add(S.target.position) }
    const g = this.post.grade.uniforms
    this.hurtK = Math.max(0, (this.hurtK || 0) - dt * 1.2); this.flashK = Math.max(0, (this.flashK || 0) - dt * 2.5)
    { const p = this.me, z = this.zone, out = !!(this.mode === 'play' && p.alive && Math.hypot(p.x - z.x, p.z - z.z) > z.r); this.outK = (this.outK || 0) + ((out ? 1 : 0) - (this.outK || 0)) * Math.min(1, dt * 3); g.uOut.value = this.outK }
    { const p = this.player, sp = p ? Math.hypot(p.vx, p.vz) : 0; this.speedPass.uniforms.speed.value = p && !p.air ? Math.max(0, Math.min(1, (sp - 14) / 16)) * 0.9 + (p.jetT > 0 ? 0.4 : 0) : 0 }
    g.uHurt.value = this.hurtK; g.uFlash.value = this.flashK; g.uTime.value = performance.now() % 1000
    this.post.comp.render(dt)
    this.hud()
    if (Snd && this.audioOn && Snd.loops.engine && Snd.loops.engine.node) { const p = this.player, on = !!(p && p.alive && p.fuel > 0); Snd.loops.engine.node.playbackRate.value = on ? p.T.rate * (0.6 + Math.min(1.4, Math.abs(p.speed) / p.T.maxF * 1.0)) + (p.jetT > 0 ? 0.4 : 0) : 0.4; Snd.loops.engine.g.gain.value = on ? 0.32 : 0.0001 }
  }
  loop() {
    const now = performance.now()
    let el = Math.min(0.1, (now - this.last) / 1000); this.last = now
    if (!this.paused) {
      if (this.stopT > 0) { this.stopT -= el } // ヒットストップ: 当たった瞬間だけ全部止める
      else {
        if (this.slowT > 0) { this.slowT -= el; this.acc += el * 0.3 } else this.acc += el
        while (this.acc >= DT) { this.step(DT); this.acc -= DT }
      }
    }
    this.render(el)
    this.frames++
    requestAnimationFrame(() => this.loop())
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix()
    this.renderer.setSize(innerWidth, innerHeight); if (this.post) this.post.resize(innerWidth, innerHeight)
  }

  // ---------- 操作 ----------
  bindInput() {
    addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (this.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) { this.begin(); return }
      if (e.code === 'Space' && this.mode === 'play' && this.player && this.countT <= 0) { this.useItem(this.player); e.preventDefault() }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && this.mode === 'play' && this.me.car) this.me.car.jump()
      if (e.code === 'Space' && !e.repeat && this.mode === 'play' && this.me.alive && !this.me.car && !this.me.air) { this.me.wantJump = true; e.preventDefault() }
      if ((e.code === 'KeyF' || e.code === 'KeyE') && !e.repeat) { if (this.me.air) this.airAct(this.me); else this.toggleCar() }
      if (e.code === 'KeyM' && !e.repeat && this.mode === 'play') this.bigMap = !this.bigMap
      if (e.code === 'KeyR' && this.resultShown) this.again()
    })
    addEventListener('keyup', e => { this.keys[e.code] = false })
    addEventListener('blur', () => { this.keys = {} })
    // 視点: PC は画面クリックでマウスを固定して回す（Esc で解除）。感度は FUSE ISLE と同じ 0.0022
    const cv = this.renderer.domElement; this.camPitch = 0
    const look = (dx, dy, s) => { const dyaw = -dx * s; if (this.me && this.me.car && this.camMode === 'car') this.lookOff = Math.max(-Math.PI, Math.min(Math.PI, (this.lookOff || 0) + dyaw)); else this.camYaw += dyaw; this.camPitch = Math.max(-0.85, Math.min(1.03, this.camPitch + dy * s)); this.lookT = performance.now() }
    cv.addEventListener('mousedown', e => { if (this.mode === 'play' && document.pointerLockElement !== cv && !matchMedia('(pointer: coarse)').matches) { try { const r = cv.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}) } catch (er) {} } })
    addEventListener('mousemove', e => { if (document.pointerLockElement === cv && this.mode === 'play') look(e.movementX, e.movementY, 0.0022) })
    // スマホ: 画面の空いている所を指でなぞる（ボタン・スティックの上は取り合わない）
    let lid = null, lx = 0, ly = 0
    cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || lid != null || this.mode !== 'play') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY })
    addEventListener('pointermove', e => { if (e.pointerId !== lid) return; look(e.clientX - lx, e.clientY - ly, 0.006); lx = e.clientX; ly = e.clientY })
    const lup = e => { if (e.pointerId === lid) lid = null }
    addEventListener('pointerup', lup); addEventListener('pointercancel', lup)
    $('#start').addEventListener('click', () => this.begin())
    $('#again').addEventListener('click', () => this.again())
    // 画面のボタン: 左右は押している間・ギア（前進/後退）はスイッチ・アイテムは押した時
    const hold = (el, k) => {
      const on = e => { e.preventDefault(); this.touch[k] = true; el.classList.add('on') }, off = e => { e.preventDefault(); this.touch[k] = false; el.classList.remove('on') }
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off)
    }
    hold($('#tl'), 'l'); hold($('#tr'), 'r')
    $('#gear').addEventListener('pointerdown', e => { e.preventDefault(); this.touch.rev = !this.touch.rev; $('#gear').classList.toggle('on', this.touch.rev); this.sound('tick', this.me, 0.4) })
    $('#use').addEventListener('pointerdown', e => { e.preventDefault(); if (this.mode === 'play' && this.player && this.countT <= 0) this.useItem(this.player) })
    $('#door').addEventListener('pointerdown', e => { e.preventDefault(); if (this.me.air) this.airAct(this.me); else this.toggleCar() })
    $('#jumpb').addEventListener('pointerdown', e => { e.preventDefault(); if (this.mode !== 'play' || !this.me.alive) return; if (this.me.car) this.me.car.jump(); else if (!this.me.air) this.me.wantJump = true })
    $('#mapb').addEventListener('pointerdown', e => { e.preventDefault(); if (this.mode === 'play') this.bigMap = !this.bigMap })
    // 歩きの時だけ: 左手のスティック（触った所に出る）
    const st = $('#stick'), knob = st.querySelector('i'); let sid = null, sx = 0, sy = 0
    const zone = $('#foot')
    zone.addEventListener('pointerdown', e => { if (sid != null) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; st.style.left = sx + 'px'; st.style.top = sy + 'px'; st.classList.add('on'); e.preventDefault() })
    addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx *= m / l; dy *= m / l } knob.style.transform = `translate(${dx}px,${dy}px)`; this.touch.mx = dx / m; this.touch.mz = -dy / m })
    const up = e => { if (e.pointerId !== sid) return; sid = null; st.classList.remove('on'); knob.style.transform = ''; this.touch.mx = this.touch.mz = 0 }
    addEventListener('pointerup', up); addEventListener('pointercancel', up)
    // 地図は FUSE ISLE と同じ物（左上の小さな地図・M で島ぜんぶの地図）。地図の側から見た「自分」「拾う物」「キー」だけ差し替えて渡す
    const self = this
    const view = Object.create(this, {
      player: { get: () => ({ body: { x: self.me.x, z: self.me.z }, air: self.me.air, alive: self.me.alive }) },
      items: { get: () => [...self.boxes.filter(b => b.on).map(b => ({ x: b.x, z: b.z, gone: 0 })), ...self.cars.filter(c => c.alive && !c.driver).map(c => ({ x: c.x, z: c.z, gone: 0, drop: true }))] },
      keymap: { value: { label: k => ({ veh: 'F', map: 'M' })[k] || k } },
      camDir: { value: () => ({ x: Math.sin(self.camYaw), z: Math.cos(self.camYaw) }) },
    })
    this.minimap = new Minimap(view, $('#hud')); this.minimap.bake()
  }
  again() { this.newMatch(); this.touch.rev = false; $('#gear').classList.remove('on'); this.begin() }

  // ---------- 画面 ----------
  toast(text) { const t = $('#toast'); if (!t) return; t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 900) }
  set(id, key, val, fn) { if (this.hudCache[key] === val) return; this.hudCache[key] = val; fn($(id), val) }
  hud() {
    if (this.mode !== 'play') return
    const P = this.me, p = P.car
    this.set('#alive', 'alive', this.ps.filter(c => c.alive).length, (el, v) => el.textContent = v)
    const z = this.zone, left = Math.ceil(z.t0 - this.t), outD = Math.ceil(Math.hypot(P.x - z.x, P.z - z.z) - z.r)
    const zt = this.t < DROP.T ? '輸送機が島の上を飛んでいる' : this.countT > 0 ? '' : P.alive && outD > 0 ? `円の外　あと ${outD}m` : left > 0 ? `円が縮むまで ${left}` : this.t < z.t1 ? '円が縮んでいる' : this.t < z.t2 ? '' : '円が消える'
    this.set('#zone', 'zone', zt, (el, v) => { el.textContent = v; el.classList.toggle('warn', v.startsWith('円の外') || v === '円が消える') })
    const cd = this.countT > 0 ? String(Math.ceil(this.countT)) : this.countT > -0.8 ? 'GO' : ''
    this.set('#count', 'count', cd, (el, v) => { el.textContent = v; el.classList.toggle('on', !!v) })
    if (this.dropHud) this.dropHud()
    const foot = P.alive && !p && !P.air
    this.set('#hud', 'foot', foot ? 1 : 0, (el, v) => el.classList.toggle('foot', !!v))
    // 自分の車の壊れ具合（上から見た小さな絵の色）とガソリンの計器
    this.set('#dmg', 'st', p ? p.stage : 4, (el, v) => { el.dataset.st = v })
    const fu = p ? Math.round(p.fuelK * 100) : -1
    this.set('#fuel', 'fuel', fu, (el, v) => { el.style.setProperty('--a', (v < 0 ? -60 : -60 + v * 1.2) + 'deg'); el.classList.toggle('low', v >= 0 && v < 15); el.classList.toggle('none', v < 0) })
    const kmh = p ? Math.round(Math.abs(p.speed) * 3.6) : -1
    this.set('#spd', 'spd', kmh, (el, v) => { el.classList.toggle('on', v >= 0); if (v >= 0) el.querySelector('b').textContent = v })
    this.set('#spd', 'vt', p ? p.type : '', (el, v) => { el.querySelector('i').textContent = v ? VT[v].name : '' })
    // 乗る・降りるのボタン
    const near = foot ? this.nearEmptyCar(P) : null
    const dm = !P.alive ? '' : P.air ? (P.air.mode === 'plane' ? 'jump' : P.air.mode === 'fall' ? 'chute' : '') : p ? 'out' : near ? 'in' : ''
    this.set('#door', 'door', dm, (el, v) => { el.classList.toggle('on', !!v); el.dataset.m = v; el.querySelector('.nm').textContent = { out: '降りる', in: '乗る', jump: '飛び降りる', chute: '傘を開く' }[v] || '' })
    this.set('#hud', 'air', P.air ? 1 : 0, (el, v) => el.classList.toggle('air', !!v))
    if (foot && near && this.t - (this._nearT || -9) > 4 && near !== this._nearC) { this._nearT = this.t; this._nearC = near; this.toast(PHONE ? `${near.paintName}の軽トラに乗れる` : `${near.paintName}の軽トラ　F で乗る`) }
    // アイテム
    const it = !p ? '' : p.rollT > 0 ? 'roll' : p.item || ''
    if (p && p.rollT > 0) { const i = Math.floor((ROLL_T - p.rollT) / 0.09) % KINDS.length; this.set('#use', 'icon', 'r' + i, el => { el.querySelector('.ic').innerHTML = ICON[KINDS[i]] }) }
    else this.set('#use', 'icon', it, (el, v) => { el.querySelector('.ic').innerHTML = v ? ICON[v] : '' })
    this.set('#use', 'state', it, (el, v) => { el.classList.toggle('has', !!v && v !== 'roll'); el.classList.toggle('roll', v === 'roll'); el.querySelector('.nm').textContent = v && v !== 'roll' ? ITEMS[v] : '' })
    const act = p && (p.spearT > 0 ? 'spear' : p.jetT > 0 ? 'jet' : p.magT > 0 ? 'magnet' : '')
    this.set('#use', 'act', act || '', (el, v) => el.classList.toggle('act', !!v))
    const fd = this.feed.filter(e => this.t - e.t < 6).slice(0, 3).map(e => `<li>${e.txt}</li>`).join('')
    this.set('#feed', 'feed', fd, (el, v) => el.innerHTML = v)
    this.set('#spec', 'spec', !P.alive && !this.resultShown ? 1 : 0, (el, v) => el.classList.toggle('on', !!v))
  }
  showResult() {
    this.resultShown = true
    const P = this.me, r = $('#result')
    const rank = P.alive ? 1 : P.place
    const how = { boom: '車ごと爆発', ram: 'はねられた', zone: '円の外で力尽きた', sea: '海に落ちた', jump: '飛び降りて転んだ', burn: '車ごと燃えた' }
    r.querySelector('.rank').textContent = this.winner === P ? '最後のひとり' : `${rank}位`
    r.querySelector('.sub').textContent = this.winner === P ? `${P.kills}人を倒した` : P.killedBy ? `${P.killedBy.name}に${P.how === 'ram' ? 'はねられた' : '車ごと爆破された'}` : (how[P.how] || '')
    r.querySelector('.st').textContent = this.winner === P ? '' : this.winner ? `勝ったのは ${this.winner.name}` : `倒した ${P.kills}人`
    r.classList.add('show')
  }
}
Object.assign(Game.prototype, itemMethods, peopleMethods, dropMethods, raidMethods)

const game = new Game()
window.FI = game
game.init().catch(e => { console.error(e); const el = document.getElementById('err'); if (el) { el.textContent = '読み込みに失敗しました: ' + e.message; el.style.display = 'block' } })
// 検証用
game.dbg = {
  // 組み立て用: 升目を書き出す（tools/build-pub.mjs）
  bakeOut() { const n = game.nav.ok, g = game.grid; const nb = new Uint8Array(Math.ceil(n.length / 8)); for (let i = 0; i < n.length; i++) if (n[i]) nb[i >> 3] |= 1 << (i & 7); const gh = new Int16Array(g.h.length); for (let i = 0; i < gh.length; i++) gh[i] = Math.max(-32000, Math.min(32000, Math.round(g.h[i] * 100))); const head = new Uint8Array(8), dv = new DataView(head.buffer); dv.setUint32(0, n.length, true); dv.setUint16(4, g.nx, true); dv.setUint16(6, g.nz, true); const all = new Uint8Array(8 + nb.length + g.ok.length + gh.byteLength); all.set(head, 0); all.set(nb, 8); all.set(g.ok, 8 + nb.length); all.set(new Uint8Array(gh.buffer), 8 + nb.length + g.ok.length); let s = ''; for (let i = 0; i < all.length; i += 8192) s += String.fromCharCode.apply(null, all.subarray(i, i + 8192)); return btoa(s) },
  cam(px, py, pz, tx, ty, tz) { game.freeCam = px == null ? null : [px, py, pz, tx, ty, tz] },
  step(n) { for (let i = 0; i < n; i++) game.step(DT) },
  aiOff() { for (const p of game.ps) if (p.ai) { p.ai.off = true } },
  // 車を置く: 向きと速さ（前向き）
  put(c, x, z, yaw, sp = 0) { c.x = x; c.z = z; c.yaw = yaw; c.vx = Math.sin(yaw) * sp; c.vz = Math.cos(yaw) * sp; c.w = 0; c.vy = 0; c.air = false; c.y = game.dbg.surface(x, z); c.y = c.settle(); c.sync() },
  // 本当の地面（車の y の絞り込みなし）: 地形と、平たい箱（道・岸壁・橋の床）の上面の高い方
  surface(x, z) {
    let h = game.world.H(x, z); if (h < -1e8) h = -9
    for (const b of game.world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [])) { if (b.dead || b.kind !== 'solid' || x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2] || b.max[1] - b.min[1] > 4) continue; if (b.max[1] > h && b.max[1] < Math.max(h, -1) + 2.5) h = b.max[1] /* 海の上の桟橋・橋も拾う */ }
    return h
  },
  // 跳ね上げの検査: kind = mine / ball / drop / boom。場所の種類ごとに n 回。めり込み（車の真下の本当の地面より 0.25m 以上低いまま止まる）を数える
  bounceTest(kind, where, n = 20, seed = 1) {
    const g = game, G = g.grid, rnd = mulberry(seed), out = { kind, where, n: 0, buried: 0, worst: 0, samples: [] }
    const T = g.me.car || g.cars[0]
    for (const c of g.cars) if (c !== T) { c.alive = false; c.driver = null; c.x = c.z = 1e5; c.pivot.visible = false }
    g.mode = 'play'; g.countT = -5; g._quiet = true
    for (const p of g.ps) if (p.ai) p.ai.off = true
    const pick = () => {
      for (let k = 0; k < 20000; k++) {
        const x = -320 + rnd() * 640, z = -80 + rnd() * 670
        if (!G.free(x, z)) continue
        const h0 = this.surface(x, z), hs = [[4, 0], [-4, 0], [0, 4], [0, -4]].map(([a, b]) => this.surface(x + a, z + b))
        const near = R => g.world.near(x - R, z - R, x + R, z + R, []).some(b => !b.dead && b.kind === 'solid' && b.max[1] - b.min[1] > 2.2 && b.tag !== 'tree')
        const road = g.world.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1, []).some(b => b.mat === 'road' && x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2])
        const ok = where === 'flat' ? hs.every(h => Math.abs(h - h0) < 0.15) && !near(8)
          : where === 'slope' ? hs.some(h => Math.abs(h - h0) > 0.7) && hs.every(h => h > -0.3)
          : where === 'road' ? road
          : where === 'house' ? near(5)
          : where === 'water' ? [[7, 0], [-7, 0], [0, 7], [0, -7]].some(([a, b]) => g.world.H(x + a, z + b) < -0.6 && this.surface(x + a, z + b) < -0.5) : false
        if (ok) return [x, z]
      }
      return null
    }
    for (let i = 0; i < n; i++) {
      const at = pick(); if (!at) break
      const [x, z] = at, yaw = rnd() * 6.28, sp = 4 + rnd() * 16
      T.alive = true; T.hp = 1e6; T.fuel = 100; T.flipX = T.flipZ = T.fwX = T.fwZ = 0; T.jetT = T.spearT = T.magT = 0; T.driver = null
      if (kind === 'mine') {
        const me = g.me; T.driver = me; me.car = T; me.alive = true; me.ai = { update() { if (me.car) me.car.input = { throttle: 1, steer: 0 } } }
        this.put(T, x - Math.sin(yaw) * 2.2, z - Math.cos(yaw) * 2.2, yaw, sp)
        g.clearItems(); const mesh = new THREE.Group(); g.scene.add(mesh)
        g.mines.push({ x, z, y: this.surface(x, z), owner: g.cars.find(c => c !== T), t: 5, state: 1, trigT: 0, mesh })
      } else if (kind === 'ball') { this.put(T, x, z, yaw, sp * 0.3); T.vx += Math.sin(yaw + 1.6) * 12; T.vz += Math.cos(yaw + 1.6) * 12; T.vy = 6.5; T.air = true; T.fwX = (rnd() - 0.5) * 7; T.fwZ = (rnd() - 0.5) * 9; T.w = (rnd() - 0.5) * 6 }
      else if (kind === 'jump') { const me = g.me; T.driver = me; me.car = T; me.alive = true; me.ai = { update() { if (me.car) me.car.input = { throttle: 1, steer: 0 } } }; this.put(T, x, z, yaw, sp); T.jumpT = -9; T.jump()
        // 半分は前に別の車を置いて、上に落ちる（踏みつけ）
        if (i % 2 === 0) { const O = g.cars.find(c => c !== T); O.alive = true; O.hp = 1e6; O.pivot.visible = true; this.put(O, x + Math.sin(yaw) * sp * 0.8, z + Math.cos(yaw) * sp * 0.8, yaw + 1.57, 0) } }
      else if (kind === 'drop') { this.put(T, x, z, yaw, 0); T.y += 14; T.vy = -2; T.air = true }
      else if (kind === 'boom') { this.put(T, x, z, yaw, sp * 0.3); T.vx += Math.sin(yaw) * 12; T.vz += Math.cos(yaw) * 12; T.vy = 3 + rnd() * 6; T.air = true; T.fwX = (rnd() - 0.5) * 6; T.fwZ = (rnd() - 0.5) * 6; T.w = (rnd() - 0.5) * 5 }
      if (kind !== 'mine' && kind !== 'jump') T.input = { throttle: 0, steer: 0 }
      let launched = false, landT = null, worst = 0
      for (let k = 0; k < 60 * 7; k++) {
        g.step(DT)
        if (T.air) launched = true
        if (launched && !T.air && landT == null) landT = k
        if (landT != null && k - landT > 20) { const s0 = this.surface(T.x, T.z); worst = Math.min(worst, T.y - s0) }
        if (landT != null && k - landT > 120) break
      }
      // めり込み: 車の底が地形より 0.25m 以上下・または平たい箱（道・床・岸壁）の中に入ったまま
      const H = g.world.H(T.x, T.z), inBox = g.world.near(T.x - 0.1, T.z - 0.1, T.x + 0.1, T.z + 0.1, []).find(b => !b.dead && b.kind === 'solid' && T.x > b.min[0] && T.x < b.max[0] && T.z > b.min[2] && T.z < b.max[2] && b.max[1] - b.min[1] <= 4 && b.min[1] < T.y + 0.2 && b.max[1] > T.y + 0.4) // 車の底（0.3m）より上まで入っている
      out.n++; if (!launched && kind === 'mine') { out.notLaunched = (out.notLaunched || 0) + 1; (out.nl || (out.nl = [])).push([Math.round(x), Math.round(z), T.alive, g.mines.length, g.mines[0] && g.mines[0].state, +T.y.toFixed(2), +this.surface(x, z).toFixed(2), Math.round(T.x), Math.round(T.z)]) }
      if ((T.y < H - 0.25 || inBox) && T.alive && !T.air) { out.buried++; out.samples.push([Math.round(x), Math.round(z), '→', Math.round(T.x), Math.round(T.z), +T.y.toFixed(2), +H.toFixed(2), inBox ? inBox.max[1] : null]) }
      out.worst = Math.min(out.worst, +worst.toFixed(2))
    }
    g._quiet = false
    return out
  },
  // 画面を描かずに秒数ぶん進める。auto=1 ならあなたの車も CPU が運転する
  run(sec, o = {}) {
    const g = game
    g.sinkLog = []
    if (o.auto && !g.me.ai) { g.me.ai = new Driver(g.me, g, g.rng); if (g.me.air && g.me.air.mode === 'plane') g.planDrops() }
    g.mode = 'play'; g._quiet = true
    const n = Math.round(sec * 60), still = g.ps.map(() => ({ t: 0, max: 0, at: null, last: [0, 0] }))
    for (let i = 0; i < n; i++) {
      g.step(1 / 60)
      if (g.over && g.overT > 0.1) break
      if (i % 30 === 0) g.ps.forEach((c, k) => { const s = still[k], d = Math.hypot(c.x - s.last[0], c.z - s.last[1]); s.last = [c.x, c.z]; if (c.alive && d < 0.5 && !(c.car && c.car.fuel <= 0) && g.countT <= 0) { s.t += 0.5; if (s.t > s.max) { s.max = s.t; s.at = [Math.round(c.x), Math.round(c.z), c.car ? 'car' : 'foot', c.ai && c.ai.footGoal ? [Math.round(c.ai.footGoal.x), Math.round(c.ai.footGoal.z)] : null, c.car ? Math.round(c.car.fuel) : null] } } else s.t = 0 })
    }
    g._quiet = false
    return { t: +g.t.toFixed(1), decidedAt: g.decidedAt ? +g.decidedAt.toFixed(1) : null, winner: g.winner && g.winner.name, zone: [Math.round(g.zone.x), Math.round(g.zone.z)], ev: g.ev, cars: g.ps.map((c, k) => ({ at: c.deathAt, n: c.name, alive: c.alive, foot: !c.car, how: c.how, kills: c.kills, place: c.place || 1, deadT: c.deadT ? Math.round(c.deadT) : null, stillMax: still[k].max, stillAt: still[k].at })), fuelOut: g.cars.filter(c => c.alive && c.fuel <= 0).length, sinkLog: g.sinkLog }
  },
}
