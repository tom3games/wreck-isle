// FUSE ISLE 試作1: 漁港の一角。自分＋CPU 3人。手投げ・煙・粘着、投げ返し、誘爆の連鎖、吹き飛ばし
import * as THREE from 'three'
import { World, moveBody, moveBall, raycast } from './collide.js?v=mwur1e4h'
import { lakeD } from './bigmap.js?v=mwur1e4h'
import { Level } from './level.js?v=mwur1e4h'
import { buildProps } from './props.js?v=mwur1e4h'
import { makeRenderer, makeSky, makeSun, makeSea, makePost } from './render.js?v=mwur1e4h'
import { loadChars, Char, LOOKS, setCharView } from './chars.js?v=mwur1e4h'
import { Keys, KeyPanel } from './keys.js?v=mwur1e4h'
import { FX, FXTEX } from './fx.js?v=mwur1e4h'
import { BOMB, TYPES, GRAV, bombMesh, itemMesh, mineLook } from './bombs.js?v=mwur1e4h'
import { Nav, Bot, X0 as NAV_X0, Z0 as NAV_Z0, C as NAV_C } from './bots.js?v=mwur1e4h'
import { riverEdge } from './southmap.js?v=mwur1e4h'
import { Minimap } from './minimap.js?v=mwur1e4h'
import { Vehicle, VEH } from './vehicle.js?v=mwur1e4h'
import { Online } from './online.js?v=mwur1e4h'
import { dropMethods, AIR_MODE } from './drop.js?v=mwur1e4h'
import { DROP, pickPath, loadPlane } from './plane.js?v=mwur1e4h'
import { buildRails } from './rails.js?v=mwur1e4h'

const Q = Object.fromEntries(new URLSearchParams(location.search))
const $ = s => document.querySelector(s)
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const Snd = window.Snd
const DT = 1 / 60
const CHAR_YAW = 0 // 素体の正面の向きの補正（実画面で確かめて決める）

class Game {
  async init() {
    this.rng = mulberry(+(Q.seed || Date.now() % 1e9))
    const T0 = performance.now(), tm = n => { if (Q.timing) console.log('[timing]', n, Math.round(performance.now() - T0)) } // ?timing=1 で起動の段階ごとの時間
    this.renderer = makeRenderer($('#view'), Q)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 1200)
    this.world = new World()
    this.setLoad(0.1, '空と光')
    const sky = await makeSky(this.scene, this.renderer)
    this.sky = sky
    this.sunRig = makeSun(this.scene, sky.sunDir)
    this.scene.fog = new THREE.FogExp2(sky.fogC.clone().multiplyScalar(0.42).convertLinearToSRGB(), 0.0012)
    this.sea = makeSea(this.scene)
    this.setLoad(0.3, '港')
    this.level = new Level(this.scene, this.world)
    tm('level')
    await buildProps(this.scene, this.world, this.level)
    tm('props')
    this.railCount = buildRails(this.scene, this.world)
    this.cullables = this.scene.children.filter(o => o.userData.cullDist > 0)
    // 軽トラは島全体で7台（今の島1・新しい陸6。広い島を走りで渡ると端から端まで約100秒かかるため 2026-11-23）
    this.vehs = [new Vehicle(this, this.level.truckMesh, this.level.truck.x + 1.72, this.level.truck.z + 0.72, -Math.PI / 2), ...(this.level.trucks2 || []).map((t, i) => new Vehicle(this, this.level.truckMeshes2[i], t[0], t[1], t[2]))]
    this.veh = this.vehs[0]
    this.setLoad(0.6, '人')
    await Promise.all([loadChars(), loadPlane()])
    tm('chars')
    this.setLoad(0.85, '仕上げ')
    this.nav = new Nav(this.world)
    tm('nav')
    this.post = makePost(this.renderer, this.scene, this.camera, Q)
    this.fx = new FX(this.scene, this.camera)
    this.makeArc()
    this.bombs = []; this.items = []; this.fighters = []; this.feed = []
    this.camYaw = Math.PI; this.camPitch = -0.12; this.camPos = new THREE.Vector3(); this.camReady = false
    this.keys = {}; this.mouse = { l: false, r: false }
    this.keymap = new Keys()
    this.keyPanel = new KeyPanel(this.keymap, () => this.keyLabels())
    this.keyLabels()
    this.bindInput()
    window.addEventListener('resize', () => this.resize())
    this.defSounds()
    this.net = new Online(this)
    this.minimap = new Minimap(this, document.getElementById('hud'))
    this.minimap.bake() // 島の絵は読み込み中に描いておく（試合の最初のコマで止まっていた 2026-11-23）
    this.newMatch(); tm('match')
    this.mode = Q.play ? 'play' : 'title'
    if (Q.play) { this.started = true; document.getElementById('title').classList.add('gone') }
    this.setLoad(1, '')
    this.acc = 0; this.last = performance.now(); this.paused = false
    window.__fiReady = true
    this.loop()
  }
  setLoad(k, label) { const b = $('#loadbar'); if (b) b.style.transform = `scaleX(${k})`; if (k >= 1) $('#loading')?.classList.add('done') }
  defSounds() {
    if (!Snd) return
    Snd.def({ boom: ['snd/boom1.mp3', 'snd/boom2.mp3', 'snd/boom3.mp3', 'snd/boom4.mp3'], gull: ['snd/gull1.mp3', 'snd/gull2.mp3'], step: ['snd/step1.mp3', 'snd/step2.mp3'], wstep: ['snd/wstep1.mp3', 'snd/wstep2.mp3'], clink: ['snd/clink1.mp3', 'snd/clink2.mp3', 'snd/clink3.mp3'], pin: 'snd/pin.mp3', thud: 'snd/thud.mp3', engine: 'snd/engine.mp3', glass: ['snd/glass1.mp3', 'snd/glass2.mp3'], punch: ['snd/punch1.mp3', 'snd/punch2.mp3'], chute: 'snd/chute.mp3' })
  }
  startAudio() {
    if (!Snd || this.audioOn) return
    this.audioOn = true; Snd.init()
    Snd.loop('water', 'snd/water.mp3', 0.32); Snd.loop('wind', 'snd/wind.mp3', 0.08)
  }

  // ---------- 試合 ----------
  newMatch() {
    for (const f of this.fighters) { f.char.remove(this.scene); if (f.chute) this.scene.remove(f.chute) }
    for (const b of this.bombs) this.scene.remove(b.mesh)
    for (const it of this.items) this.scene.remove(it.mesh)
    this.fighters = []; this.bombs = []; this.items = []; this.feed = []; this.burns = []
    this.t = 0; this.over = false; this.stats = { back: 0, chainMax: 0, self: 0 }
    this.ev = { throws: 0, backs: 0, chains: 0, kills: {}, sticks: 0, glass: 0 }
    // ドラム缶を戻す
    for (const d of this.level.drums) { if (!d.alive) { d.alive = true; d.box.dead = false; if (d.mesh) d.mesh.visible = true } d.burning = false }
    this.tntBanner = false
    for (const g of this.level.glasses || []) { g.alive = true; g.box.dead = false; g.mesh.visible = true }
    const O = this.online
    if (O && O.seed != null) this.rng = mulberry(O.seed)
    this.bombSeq = 0
    // 円（安全地帯）。50人・約640m の島（2026-11-23）: 半径 360m から縮み、60秒で縮み始めて 600秒（10分）で最後の円
    // 中心は歩ける所の候補（町・集落・橋のたもとなど）からくじ。6人の時は半径 135m・200秒だった（Codex のレビューで絞った分は島を広げて戻した）
    const zs = this.level.zoneSpots, zp = zs[Math.floor(this.rng() * zs.length)]
    let zx = zp[0], zz = zp[1]
    for (let k = 0; k < 14; k++) { const x = zp[0] + (this.rng() - 0.5) * 16, z = zp[1] + (this.rng() - 0.5) * 16, c = this.nav.cell(x, z); if (this.nav.free(c[0], c[1])) { zx = x; zz = z; break } }
    // 降下（2026-11-23）: 円の時計は輸送機が島を横切り終わってから数える。?drop=0 か ?spawn= のときは今まで通り地上から
    this.dropOn = (Q.drop !== '0' || !!this.forceDrop) && Q.spawn == null
    this.path = pickPath(this.rng) // 輸送機の進路のくじ（参加者も同じ乱数で同じ進路になる）
    const F = this.dropOn ? DROP.T : 0
    this.zone = { x: zx, z: zz, r: 360, r0: 360, r1: 8, t0: 60 + F, t1: 600 + F }
    // 上陸は円の内側（半径の8割まで）から。足りなければ中心に近い順に足す
    const all = this.level.spawns, dz = p => Math.hypot(p[0] - zx, p[2] - zz)
    let sp = all.filter(p => dz(p) < this.zone.r0 * 0.8)
    // 拾う物の種類のくじは別の乱数で（CPU を作る時に主だけ乱数を使うので、同じ乱数だと参加者と種類がずれた 2026-11-23）
    const irng = mulberry(Math.floor(this.rng() * 4294967296))
    // 人数（あなた＋CPU）。?n= で変えられる
    const N = Math.max(2, Math.min(60, +(Q.n || 50)))
    if (sp.length < N) sp = [...all].sort((a, b) => dz(a) - dz(b)).slice(0, Math.max(N, 8))
    const NAMES = ['漁師', 'パーカー', '作業着', 'じいさん', 'ジャージ', '釣り人', '大工', '配達員', '郵便屋', '学生', '板前', '庭師', '店主', '農家', '駅員', '船長', '整備士', '番頭', '左官', '鳶職', '料理人', '牛乳屋', '魚屋', '八百屋', '床屋', '電気屋', '工事の人', '警備員', '新聞屋', '植木屋']
    const LK = ['fisher', 'hoodie', 'work', 'elder', 'jersey']
    const names = [['あなた', 'player']]
    for (let i = 1; i < N; i++) { const b = NAMES[(i - 1) % NAMES.length], r = Math.floor((i - 1) / NAMES.length); names.push([r ? b + (r + 1) : b, LK[(i - 1) % LK.length]]) }
    // 出る場所は毎試合くじ（あなたは ?spawn= で決められる）
    const order = this.pickSpawnOrder(sp)
    if (Q.spawn != null && all[+Q.spawn]) { let k = sp.indexOf(all[+Q.spawn]); if (k < 0) { sp.push(all[+Q.spawn]); k = sp.length - 1 } const oi = order.indexOf(k); if (oi >= 0) order.splice(oi, 1); order.unshift(k) } // ?spawn= は島全体の番号
    // オンラインでは人が先（席の順）、残りを CPU が埋める
    const ros = O ? O.roster : null, humans = ros ? ros.length : 1
    for (let i = 0; i < names.length; i++) {
      const [x, , z] = sp[order[i % order.length]]
      const human = i < humans
      const nm = ros && human ? ros[i].name : human ? names[0][0] : names[i - humans + 1][0]
      const f = this.makeFighter(nm, LOOKS[names[i][1]], x, z, human)
      f.nid = i; f.human = human
      if (ros && human) f.sid = ros[i].id
      f.body.y = Math.max(0, this.world.H(x, z))
      if (!human && !this.isGuest()) f.bot = new Bot(f, this, this.rng, Q.skill ? +Q.skill : 0.9 + this.rng() * 0.3)
      f.air = null; f.plan = null; f.chute = null
      if (this.dropOn) this.boardPlane(f)
    }
    if (this.dropOn && !this.isGuest()) this.planDrops()
    const me = ros ? Math.max(0, ros.findIndex(r => r.id === O.id)) : 0
    for (const f of this.fighters) { f.isPlayer = f.nid === me; f.remote = !!(O && O.role === 'host' && f.human && !f.isPlayer) }
    this.player = this.fighters[me]
    this.camYaw = Math.atan2(-this.player.body.x, -this.player.body.z) + Math.PI
    if (this.dropOn) { this.camYaw = Math.atan2(this.path.dx, this.path.dz) - Math.PI + 0.9; this.camPitch = -0.28 } // 進路の斜め後ろから、島を見下ろす
    this.player.yaw = this.camYaw + Math.PI
    this.resetDropVisual()
    // 拾う物
    const spots = [[-43, -40, 'frag', 0.4], [-43, -60, 'sticky', 0.4], [-25, -66, 'frag', 0.4], [-10, -66, 'armor', 0.4], [46.5, -30, 'frag', 0.4], [46.5, -50, 'smoke', 0.4], [26, -30, 'frag'], [26, -45, 'med'], [34.5, -40, 'frag', 0.3], [36, -60, 'sticky', 0.3], [33, -50, 'armor', 3.45], [35, -64, 'frag', 6.45], [6, -45, 'frag', -0.85], [-33, -15, 'frag'], [40, 0, 'frag'], [50, 20, 'sticky'], [38, 19.5, 'armor'], [36, 18.5, 'frag', 2.95], [66, -20, 'frag'], [72, -16, 'smoke'], [76, 21, 'med'], [64, 40, 'frag'], [86, 52, 'sticky'], [70, 60, 'frag'], [92, 26, 'frag'], [96, 8, 'smoke'], [80, 10, 'frag'], [58, 2, 'armor'], [-40, 40, 'frag'], [-25, 60, 'sticky'], [-14, 74, 'armor'], [-8, 80, 'frag', 2.4], [8, 58, 'smoke'], [-62, 62, 'frag'], [-50, 55, 'med'], [-78, 45, 'sticky'], [-84, 26, 'armor', 2.6], [-86, 22, 'frag', 2.6], [-42, 18, 'frag'], [-41, 20, 'smoke'], [-58, 4, 'frag'], [-80, -6, 'sticky'], [-44, -5, 'med'], [-66, 28, 'frag'], [-90, 2, 'frag'], [-12, -8, 'frag'], [-21, -3, 'sticky'], [-22, -10, 'armor'], [-20.5, -12, 'frag', 4.0], [-24.5, -4, 'smoke', 4.0], [5, -10, 'frag'], [14, -5, 'smoke'], [21, -16, 'sticky'], [-6, 4, 'med'], [12, 5, 'frag'], [-16, 20.8, 'frag', 0.35], [9, 21, 'sticky', 0.35], [3, 12, 'armor'], [24, 24, 'frag'], [-26, 12, 'smoke'], [6, -34, 'frag'], [-2, 26, 'med'], [17, -12, 'frag', 5.2],
      // 南の低地（住宅地・橋・林・海岸）
      [-30, 160, 'frag'], [12, 162, 'sticky'], [40, 160, 'armor'], [-8, 203, 'frag'], [-45, 200, 'frag'], [26, 202, 'smoke'], [-25, 203, 'med'], [0, 176.5, 'frag'], [52, 203, 'frag'], [-68, 156, 'sticky'], [-76, 208, 'frag'], [63, 163, 'frag'], [82, 206, 'sticky'], [16, 222, 'armor'], [-12, 224, 'smoke'], [34, 128, 'frag'], [-52, 124, 'med'], [-5, 215, 'frag'], [60, 160, 'med'], [-60, 150, 'frag'], [30, 215, 'sticky']]
    // 手投げの置き場の 5つに1つを火炎瓶に
    { let n = 0; for (const s of spots) if (s[2] === 'frag' && n++ % 5 === 2) s[2] = 'molotov' }
    // 地雷の置き場: 手投げの置き場の 6つに1つ（手投げより少なめ）
    { let n = 0; for (const s of spots) if (s[2] === 'frag' && n++ % 6 === 4) s[2] = 'mine' }
    for (const u of this.level.upItems || []) spots.push([u[0], u[1], spots.length % 3 ? 'frag' : 'sticky', u[2]])
    // 新しい陸の置き場（家の中・倉庫・道ばた）。種類は毎試合くじ
    const kinds = [['frag', 34], ['smoke', 11], ['sticky', 13], ['molotov', 12], ['mine', 9], ['armor', 12], ['med', 18]], tot = kinds.reduce((a, k) => a + k[1], 0)
    const kindPick = () => { let r = irng() * tot; for (const [k, w] of kinds) { if ((r -= w) < 0) return k } return 'frag' }
    for (const it of this.level.landItems || []) spots.push([it[0], it[1], it[2] || kindPick(), it[3]])
    // 箱の中に埋まる置き場（台・機械の中など）は、いちばん近い歩ける所へずらす（拾えずに CPU が集まって止まっていた 2026-11-23）
    const buried = (x, z, y) => this.world.near(x - 0.05, z - 0.05, x + 0.05, z + 0.05).some(b => !b.dead && b.kind === 'solid' && x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2] && b.min[1] < y + 0.3 && b.max[1] > y + 0.3)
    for (let [x, z, kind, y] of spots) {
      y = y != null ? y : Math.max(0, this.world.H(x, z))
      if (buried(x, z, y)) { const c = this.nav.nearestFree(...this.nav.cell(x, z)); if (!c) continue; x = NAV_X0 + (c[0] + 0.5) * NAV_C; z = NAV_Z0 + (c[1] + 0.5) * NAV_C; y = Math.max(0, this.world.H(x, z)) }
      this.addItem(x, y, z, kind)
    }
    this.makeZoneMesh()
    $('#result')?.classList.remove('show'); this.resultShown = false
    for (const V of this.vehs || []) V.reset()
    if (this.vehs && Snd && this.audioOn) Snd.loop('engine', null)
  }
  // 上陸地点のくじ。先に決めた人から 40m 以上離れた所を優先して散らす（足りなければ近くも使う）
  pickSpawnOrder(sp) {
    const pool = sp.map((_, i) => i).sort(() => this.rng() - 0.5), order = []
    while (pool.length) {
      let k = pool.findIndex(i => order.every(j => Math.hypot(sp[i][0] - sp[j][0], sp[i][2] - sp[j][2]) >= 40))
      if (k < 0 || order.length >= 60) k = 0
      order.push(pool.splice(k, 1)[0])
    }
    return order
  }
  makeFighter(name, look, x, z, isPlayer) {
    const char = new Char(this.scene, look)
    const f = { name, isPlayer, char, alive: true, hp: 100, armor: 0, inv: { frag: 2, smoke: 1, sticky: 1, molotov: 0, mine: 0 }, sel: 'frag', kills: 0, backs: 0, yaw: 0, aimYaw: 0, input: { mx: 0, mz: 0 }, stun: 0, cooking: null, held: null, lastHit: null, stepAcc: 0,
      body: { x, y: 0, z, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.75, onGround: true, airT: 0, crouch: false } }
    this.fighters.push(f); return f
  }
  addItem(x, y, z, kind) { const mesh = itemMesh(kind); mesh.position.set(x, y, z); mesh.rotation.y = this.rng() * 6; this.scene.add(mesh); this.items.push({ x, y, z, kind, mesh, gone: 0 }) }
  nearestItem(x, z, kinds, skip) { let b = null, bd = 1e9; for (const it of this.items) { if (it.gone > 0 || it.y > 1 || (kinds && !kinds.includes(it.kind)) || (skip && skip.has(it))) continue; const d = Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; b = it } } return b }

  // ---------- 爆弾 ----------
  pullPin(f, type) {
    if (this.isGuest() && f === this.player) { if (f.alive && !f.cooking) { if ((type || f.sel) !== 'mine') this.pinSent = true; this.online.act({ a: 'pin', type: type || f.sel }) } return null }
    if (f.cooking || !f.alive || f.dive || f.air) return null
    type = type || f.sel
    if (type === 'mine' && f.inv.mine > 0) { this.placeMine(f); return null } // 地雷は握らず、足元に置く
    if (!f.inv[type] || type === 'mine') { const was = type; type = TYPES.find(t => t !== 'mine' && f.inv[t] > 0); if (!type) { this.punch(f); return null } if (f === this.player) { f.sel = type; this.toast(`${BOMB[was].name}がないので ${BOMB[type].name} に持ち替え`) } }
    f.inv[type]--
    const spec = BOMB[type]
    const b = { id: ++this.bombSeq, type, fuse: spec.fuse, x: f.body.x, y: f.body.y + 1.5, z: f.body.z, vx: 0, vy: 0, vz: 0, r: spec.r, held: f, owner: f, thrower: f, alive: true, chain: 0, mesh: bombMesh(type), stuck: null, back: false, bounces: 0 }
    b.onGlass = box => this.breakGlass(box.glass, b)
    this.scene.add(b.mesh); this.bombs.push(b)
    f.cooking = b; f.char.windup(true)
    this.sound('pin', f.body, 0.7)
    return b
  }
  // 地雷を足元に置く（2026-11-23 本人「地雷も欲しいかもな」）。短いしゃがみ（拾う動作）で置き、0.8秒は次を置けない。1.5秒で作動
  placeMine(f) {
    const B = f.body
    if (!f.alive || f.vehicle || f.cooking || f.dive || f.stun > 0 || !f.inv.mine || this.t < (f.placeAt || 0) || !B.onGround || B.y < -0.6) return null
    const S = BOMB.mine
    f.inv.mine--; f.placeAt = this.t + 0.8
    const b = { id: ++this.bombSeq, type: 'mine', fuse: S.fuse, x: B.x, y: B.y, z: B.z, vx: 0, vy: 0, vz: 0, r: S.r, held: null, owner: f, thrower: f, alive: true, chain: 0, mesh: bombMesh('mine'), stuck: { mine: true }, back: false, bounces: 0, armT: S.arm, trig: false }
    this.scene.add(b.mesh); this.bombs.push(b)
    f.char.pick()
    this.sound('thud', B, 0.3)
    return b
  }
  // 飛び込み（走りながらしゃがむ）: 0.25秒で前へ 3.5m・伏せて 0.5秒・起き上がり 0.5秒。終わって 1.2秒たつまで次は飛べない。無敵ではなく、爆風だけ ダメージ×0.5・押す力×0.6（explode）
  startDive(f, dx, dz) {
    const B = f.body
    if (!f.alive || f.dive || f.vehicle || f.cooking || f.stun > 0 || !B.onGround || this.t < (f.diveReady || 0)) return false
    let l = Math.hypot(dx, dz); if (l < 0.01) { dx = Math.sin(f.yaw); dz = Math.cos(f.yaw); l = 1 }
    f.dive = { t: 0, dx: dx / l, dz: dz / l }; f.diveReady = 1e9
    B.vy = 2.4; B.onGround = false; B.crouch = false
    f.yaw = Math.atan2(dx, dz)
    f.char.dive()
    this.sound('thud', B, 0.35)
    return true
  }
  endDive(f) { if (!f.dive) return; f.dive = null; f.diveReady = this.t + 1.2; f.body.h = 1.75; f.char.endDive() }
  // 手ぶらのパンチ（2026-11-23 本人「手ぶらのときクリックしたらパンチ」）。0.45秒に1回・前1.6m・左右60度・壁の向こうは当たらない
  // 当たると 12 減ってよろめき、少し押される。爆弾より弱い（拾うまでのつなぎ）
  punch(f) {
    if (!f.alive || f.vehicle || f.dive || f.air || f.stun > 0 || this.t < (f.punchAt || 0)) return
    f.punchAt = this.t + 0.45; f.punchFace = this.t + 0.35
    const yaw = f.isPlayer || f.remote ? f.aimYaw : f.yaw
    f.yaw = yaw
    const fx = Math.sin(yaw), fz = Math.cos(yaw)
    f.char.punch()
    const B = f.body, chest = [B.x, B.y + 1.3, B.z]
    let best = null, bd = 1.6
    for (const o of this.fighters) {
      if (o === f || !o.alive || o.vehicle) continue
      const dx = o.body.x - B.x, dz = o.body.z - B.z, d = Math.hypot(dx, dz)
      if (d > bd || d < 1e-3 || Math.abs(o.body.y - B.y) > 1.2) continue
      if ((dx * fx + dz * fz) / d < 0.5) continue
      if (raycast(this.world, chest, [o.body.x, o.body.y + 1.3, o.body.z])) continue
      best = o; bd = d
    }
    if (!best) return
    const o = best, dmg = 12, dir = new THREE.Vector3(o.body.x - B.x, 0, o.body.z - B.z).normalize()
    o.hp -= dmg
    o.body.vx += dir.x * 2.2; o.body.vz += dir.z * 2.2
    o.stun = Math.max(o.stun, 0.3); o.char.flinch()
    if (o.cooking && o.hp > 0 && this.rng() < 0.25) { const cb = o.cooking; cb.held = null; o.cooking = null; o.held = null; cb.vx = dir.x * 1.5; cb.vy = 1.5; cb.vz = dir.z * 1.5; cb.flight = 0 } // 4回に1回、握っていた爆弾を落とす
    this.sound('punch', o.body, 0.8)
    this.cue(f, 'hit', o.nid, dmg, o.hp <= 0)
    this.cue(o, 'hurt', Math.round(B.x * 10) / 10, Math.round(B.z * 10) / 10)
    if (o.isPlayer) this.hurtK = Math.min(1, (this.hurtK || 0) + dmg / 50)
    if (o.bot) o.bot.lastSeen = { x: B.x, z: B.z }
    o.lastHit = { by: f, how: 'punch', t: this.t }
    if (o.hp <= 0) this.kill(o, f, 'punch')
  }
  handPoint(f, out) {
    f.char.root.updateMatrixWorld(true)
    f.char.handPos(out)
    return out
  }
  release(f, v) {
    if (this.isGuest() && f === this.player) { this.online.act({ a: 'rel', v: v.map(x => Math.round(x * 100) / 100) }); return }
    const b = f.cooking; if (!b) return
    const hp = new THREE.Vector3(); this.handPoint(f, hp)
    // 手が壁の向こうに出ていたら胸の高さから
    const chest = [f.body.x, f.body.y + 1.4, f.body.z]
    const hit = raycast(this.world, chest, [hp.x, hp.y, hp.z])
    if (hit) { hp.set(chest[0], chest[1], chest[2]) }
    b.x = hp.x; b.y = hp.y; b.z = hp.z; b.vx = v[0]; b.vy = v[1]; b.vz = v[2]
    b.vx += f.body.vx * 0.6; b.vz += f.body.vz * 0.6
    b.held = null; b.thrower = f; b.flight = 0; this.ev.throws++
    f.cooking = null; f.held = null
    f.char.windup(false); if (f.char.throwT < 0) f.char.throwNow()
    this.sound('thud', f.body, 0.25)
  }
  // 乗れる軽トラ（3m 以内で、空いていて、壊れていない一番近い車）
  nearVeh(f) { let best = null, bd = 3.0; for (const V of this.vehs || []) { if (!V.alive || V.driver) continue; const d = Math.hypot(V.x - f.body.x, V.z - f.body.z); if (d < bd) { bd = d; best = V } } return best }
  enterVehicle(f) {
    const V = this.nearVeh(f)
    if (!V || !f.alive || f.cooking || f.dive) return false
    V.driver = f; f.vehicle = V; f.char.root.visible = false
    if (f.isPlayer && Snd && this.audioOn) Snd.loop('engine', 'snd/engine.mp3', 0.22, 0.3)
    this.sound('clink', f.body, 0.5)
    return true
  }
  exitVehicle(f, eject) {
    const V = f.vehicle; if (!V) return
    V.driver = null; f.vehicle = null; f.char.root.visible = true; f.vin = null
    // 降りる所: 左・右・後ろ・前の順に、足元に床か地面があって箱の中でない所（橋の上で左に降りて海へ落ちていた 2026-11-23）
    let x, z, y = V.y
    for (const [a, s] of [[0.4, -1.45], [0.4, 1.45], [-2.6, 0], [2.6, 0], [0.4, -1.45]]) {
      ;[x, z] = V.world(a, s); y = V.groundAt(x, z)
      const inBox = this.world.near(x - 0.35, z - 0.35, x + 0.35, z + 0.35).some(b => !b.dead && (b.kind === 'solid' || b.kind === 'edge') && b.min[1] < y + 1.6 && b.max[1] > y + 0.45 && x + 0.33 > b.min[0] && x - 0.33 < b.max[0] && z + 0.33 > b.min[2] && z - 0.33 < b.max[2])
      if (y > -0.4 && !inBox) break
    }
    const B = f.body; B.x = x; B.z = z; B.y = Math.max(y, -0.3); B.vx = B.vz = B.vy = 0
    if (eject) { const [fx, fz] = V.fwd(); B.vx = fz * 6 + fx * V.speed * 0.5; B.vz = -fx * 6 + fz * V.speed * 0.5; B.vy = 6; B.onGround = false; f.stun = 1; f.char.knock() }
    if (f.isPlayer && Snd && this.audioOn) Snd.loop('engine', null, 0, 0.3)
  }
  tryPickup(f) {
    if (f.cooking || !f.alive || f.dive || f.air) return false
    let best = null, bd = 2.2
    for (const b of this.bombs) {
      if (!b.alive || b.held || b.stuck || b.type === 'smoke' || b.type === 'molotov') continue
      const d = Math.hypot(b.x - f.body.x, b.z - f.body.z) + Math.abs(b.y - (f.body.y + 0.3)) * 0.5
      if (d < bd) { bd = d; best = b }
    }
    if (!best) return false
    best.held = f; best.back = best.thrower !== f; best.prev = best.thrower; best.thrower = f
    f.cooking = best; f.held = best
    f.char.pick(); setTimeout(() => f.cooking === best && f.char.windup(true), 200)
    if (best.back) { this.cue(f, 'banner', '投げ返し！', 'back'); this.stats.back += f.isPlayer ? 1 : 0; f.backs++; this.ev.backs++ }
    return true
  }
  detonateSticky(f) {
    for (const b of this.bombs) if (b.alive && b.type === 'sticky' && b.owner === f && !b.held) b.fuse = Math.min(b.fuse, 0.05)
  }
  updateBombs(dt) {
    const tmp = new THREE.Vector3()
    for (const b of this.bombs) {
      if (!b.alive) continue
      b.fuse -= dt
      if (b.type === 'mine') this.updateMine(b, dt)
      if (b.held) {
        if (!b.held.alive) { b.held.cooking = null; b.held = null; b.vx = 0; b.vy = 1; b.vz = 0 } // 倒れたら落とす
        else { this.handPoint(b.held, tmp); b.x = tmp.x; b.y = tmp.y; b.z = tmp.z }
      } else if (b.stuck) {
        if (b.stuck.f) { const f = b.stuck.f; b.x = f.body.x + b.stuck.o[0]; b.y = f.body.y + b.stuck.o[1]; b.z = f.body.z + b.stuck.o[2] }
        else if (b.stuck.veh) { const [wx, wz] = b.stuck.veh.world(b.stuck.a, b.stuck.s); b.x = wx; b.z = wz; b.y = b.stuck.veh.y + b.stuck.y }
      } else {
        b.vy -= GRAV * dt; b.flight = (b.flight || 0) + dt
        const spec = BOMB[b.type]
        // 粘着は人にも付く
        if (b.type === 'sticky' && b.flight > 0.08) for (const f of this.fighters) {
          if (!f.alive || f === b.thrower && b.flight < 0.4) continue
          const dx = b.x - f.body.x, dz = b.z - f.body.z, dy = b.y - (f.body.y + 1.1)
          if (dx * dx + dz * dz < 0.42 * 0.42 && Math.abs(dy) < 0.75) { b.stuck = { f, o: [dx, b.y - f.body.y, dz] }; this.sound('clink', b, 0.5); this.cue(f, 'banner', '粘着が付いた！', 'warn'); break }
        }
        // 火炎瓶は人に当たっても割れる
        if (b.type === 'molotov' && b.flight > 0.08) for (const f of this.fighters) {
          if (!f.alive || f === b.thrower && b.flight < 0.4) continue
          const dx = b.x - f.body.x, dz = b.z - f.body.z, dy = b.y - (f.body.y + 1.0)
          if (dx * dx + dz * dz < 0.45 * 0.45 && Math.abs(dy) < 0.95) { b.fuse = 0; break }
        }
        for (const V of this.vehs) if (!b.stuck && V.inside(b.x, b.y, b.z, b.r)) {
          if (b.type === 'molotov') b.fuse = 0
          else if (b.type === 'sticky') { const [a, s2] = V.local(b.x, b.z); b.stuck = { veh: V, a, s: s2, y: b.y - V.y }; this.sound('clink', b, 0.5); if (V.driver) this.cue(V.driver, 'banner', '軽トラに粘着が付いた！', 'warn') }
          else { b.x -= b.vx * dt * 1.5; b.z -= b.vz * dt * 1.5; b.vx *= -0.3; b.vz *= -0.3; b.vy = Math.abs(b.vy) * 0.3; this.sound('clink', b, 0.4) }
        }
        if (!b.stuck) {
          const hit = moveBall(this.world, b, dt, spec.bounce, 0.55)
          if (hit) {
            if (b.type === 'sticky') { b.stuck = { box: hit.box }; b.vx = b.vy = b.vz = 0; this.sound('clink', b, 0.5) }
            else if (b.type === 'molotov' && b.flight > 0.05) b.fuse = 0 // 地面や壁に当たると割れる
            else if (hit.speed > 2.5 && b.bounces++ < 12) this.sound('clink', b, Math.min(0.8, hit.speed * 0.08))
          }
          if (Math.hypot(b.vx, b.vz) < 0.05 && Math.abs(b.vy) < 0.3) { b.vx *= 0.9; b.vz *= 0.9 }
          if (b.y < -1.55) { this.fx.splash(new THREE.Vector3(b.x, -1.55, b.z)); b.alive = false; this.scene.remove(b.mesh); continue }
        }
      }
      // 見た目
      b.mesh.position.set(b.x, b.type === 'mine' ? b.y - 0.015 : b.y, b.z) // 地雷は半分埋める
      if (!b.held && !b.stuck) { b.mesh.rotation.x += b.vz * dt * 6; b.mesh.rotation.z -= b.vx * dt * 6 }
      if ((b.type === 'frag' || b.type === 'molotov') && this.rng() < dt * (b.type === 'molotov' ? 45 : 30)) this.fx.fuseSpark(new THREE.Vector3(b.x, b.y + (b.type === 'molotov' ? 0.2 : 0.12), b.z))
      if (b.mesh.userData.led && b.type !== 'mine') b.mesh.userData.led.material.emissiveIntensity = (Math.sin(this.t * (b.fuse < 2 ? 30 : 12)) > 0) ? 7 : 0.3
      if (b.fuse <= 0) this.detonate(b)
    }
    this.bombs = this.bombs.filter(b => b.alive)
    // ドラム缶
    for (const d of this.level.drums) if (d.alive && d.burning) { d.fuse -= dt; if (d.fuse <= 0) this.drumBoom(d) }
  }
  // 地雷: 置いて arm 秒で作動。作動後に rad m 以内へ誰か（置いた本人も・車も）が入ると「カチッ」→ trig 秒後に爆発
  updateMine(b, dt) {
    const S = BOMB.mine
    if (b.armT > 0) { b.armT -= dt; if (b.armT <= 0) this.sound('clink', b, 0.15) }
    else if (!b.trig) {
      let who = null
      for (const f of this.fighters) {
        if (!f.alive || f.ghost) continue
        const dx = f.body.x - b.x, dz = f.body.z - b.z
        if (dx * dx + dz * dz < S.rad * S.rad && Math.abs(f.body.y - b.y) < 0.9) { who = f; break }
      }
      if (!who) for (const V of this.vehs) if (V.alive && V.inside(b.x, b.y + 0.2, b.z, 0.2)) { who = V.driver || true; break }
      if (who) {
        b.trig = true; b.fuse = S.trig
        this.sound('pin', b, 1, { far: true })
        if (who !== true) this.cue(who, 'banner', '地雷を踏んだ', 'warn')
      }
    }
    const P = this.player.body, dist = Math.hypot(P.x - b.x, P.z - b.z)
    mineLook(b.mesh, b.trig ? 2 : b.armT > 0 ? 0 : 1, b.owner === this.player, dist, this.t)
    b.mesh.visible = dist < 70
  }
  detonate(b) {
    b.alive = false; this.scene.remove(b.mesh)
    if (b.held) { b.held.cooking = null; b.held.held = null; b.held.char.windup(false) }
    if (b.type === 'smoke') { this.fx.smokeBomb(new THREE.Vector3(b.x, b.y, b.z)); this.sound('thud', b, 0.6); return }
    if (b.type === 'molotov') { this.burn(b.x, b.y, b.z, b.thrower); return }
    const how = b.back ? 'back' : b.type === 'mine' ? 'mine' : null
    this.explode(new THREE.Vector3(b.x, b.type === 'mine' ? b.y + 0.05 : b.y, b.z), BOMB[b.type], b.thrower, b.chain, how, b)
  }
  drumBoom(d) {
    d.alive = false; d.box.dead = true; if (d.mesh) d.mesh.visible = false
    const p = new THREE.Vector3(d.x, 0.5, d.z)
    const spec = BOMB[d.spec || 'drum']; p.y = (d.y || 0) + 0.5
    this.explode(p, spec, d.by, d.chain, null, null)
    this.fx.fire(new THREE.Vector3(d.x, d.y || 0, d.z), d.spec ? 10 : 7)
    if (d.spec === 'tnt' && !this.tntBanner) { this.tntBanner = true; this.bannerAll('火薬庫が吹き飛んだ', 'chain') }
  }
  explode(pos, spec, by, chain, how, src) {
    const ground = this.groundAt(pos.x, pos.z, pos.y)
    this.fx.explosion(pos, spec.size, { groundY: pos.y - ground < 1.2 ? ground : null })
    const cd = this.camera.position.distanceTo(pos)
    this.fx.shake = Math.min(1.2, this.fx.shake + spec.size * 9 / (cd + 3))
    this.flashK = Math.max(this.flashK || 0, Math.min(0.12, 2 / (cd * cd + 8)))
    this.sound('boom', pos, Math.min(1, 1.6 * spec.size), { far: true })
    if (chain >= 1) this.ev.chains++
    if (by) for (const f of this.fighters) if (f.bot && f !== by && Math.hypot(f.body.x - pos.x, f.body.z - pos.z) < 40) f.bot.lastSeen = { x: by.body.x, z: by.body.z }
    if (chain >= 1) { this.stats.chainMax = Math.max(this.stats.chainMax, chain + 1); for (const h of this.fighters) if (h.human && Math.hypot(h.body.x - pos.x, h.body.z - pos.z) < 40) this.cue(h, 'banner', `連鎖×${chain + 1}`, 'chain') }
    // 軽トラ
    for (const V of this.vehs) if (V.alive) { const d = Math.hypot(V.x - pos.x, V.y + 0.9 - pos.y, V.z - pos.z); if (d < spec.R) V.damage(spec.dmg * 1.5 * (1 - d / spec.R) + (d < 2 ? 40 : 0), by) }
    // ダメージと吹き飛ばし
    for (const f of this.fighters) {
      if (!f.alive) continue
      const low = !!f.dive && f.dive.t < 0.75 // 飛んでいる間と伏せている間だけ体が低い（起き上がりは普通）
      if (f.dive && !low) this.endDive(f)
      const c = new THREE.Vector3(f.body.x, f.body.y + 1.0, f.body.z)
      const d = c.distanceTo(pos)
      if (d > spec.R) continue
      const k = 1 - d / spec.R
      const blocked = !!raycast(this.world, [pos.x, pos.y + 0.15, pos.z], [c.x, c.y, c.z], bx => bx.tag === 'drum')
      let dmg = spec.dmg * (1 - Math.pow(d / spec.R, 1.7)) * (blocked ? 0.22 : 1)
      if (f === by) dmg *= 0.6
      if (f.vehicle) dmg *= 0.5
      if (low) dmg *= 0.5 // 飛んで伏せている間は体が低い（無敵ではない）
      const ab = Math.min(f.armor, dmg * 0.5); f.armor -= ab; dmg -= ab
      f.hp -= dmg
      // ぎりぎりの回避: 半径の 0.9倍以内で、25 未満で生き残った（本人にだけ「回避」と音のこもり。壁の向こうは対象外）
      if (f.hp > 0 && !blocked && !f.vehicle && d < spec.R * 0.9 && dmg < 25 && this.t - (f.avoidAt || -9) > 1.2) { f.avoidAt = this.t; this.cue(f, 'banner', '回避', 'avoid'); this.cue(f, 'muffle', 1.2) }
      if (by && f !== by && dmg > 1) this.cue(by, 'hit', f.nid, Math.round(dmg), f.hp <= 0)
      if (dmg > 1) this.cue(f, 'hurt', Math.round(pos.x * 10) / 10, Math.round(pos.z * 10) / 10)
      const dir = new THREE.Vector3(c.x - pos.x, 0, c.z - pos.z); if (dir.lengthSq() < 1e-4) dir.set(this.rng() - 0.5, 0, this.rng() - 0.5); dir.normalize()
      // 近ければ仰向けに倒れる（1〜2m 押されて少し浮く）。離れていればよろめくだけ
      const down = k > 0.42 && !blocked && !f.vehicle && f.hp > 0 && !low
      const shove = spec.push * k * (down ? 0.3 : 0.13) * (blocked ? 0.5 : 1) * (low ? 0.6 : 1)
      if (!f.vehicle) { f.body.vx += dir.x * shove; f.body.vz += dir.z * shove }
      if (down) {
        f.body.vy = Math.max(f.body.vy, 1 + 2 * k); f.body.onGround = false
        f.yaw = Math.atan2(-dir.x, -dir.z) // 爆発の方を向いたまま後ろへ倒れる
        f.stun = Math.max(f.stun, f.char.downTime())
        if (f.cooking) { const cb = f.cooking; cb.held = null; f.cooking = null; f.held = null; cb.vx = dir.x * 1.5; cb.vy = 1.5; cb.vz = dir.z * 1.5; cb.flight = 0 } // 握っていた爆弾は足元に落とす
        f.char.knock()
      } else if (!low) { f.stun = Math.max(f.stun, 0.2 + k * 0.35); f.char.flinch() }
      if (f.isPlayer) this.hurtK = Math.min(1, (this.hurtK || 0) + dmg / 60)
      const hw = by === f ? 'self' : chain >= 1 ? 'chain' : how === 'back' ? 'back' : how === 'mine' ? 'mine' : null
      f.lastHit = { by, how: hw, t: this.t }
      if (f.hp <= 0) this.kill(f, by, hw)
    }
    // 窓ガラス
    for (const g of this.level.glasses || []) if (g.alive && g.mesh.position.distanceTo(pos) < spec.R * 1.3) this.breakGlass(g)
    // 誘爆: 近くの爆弾とドラム缶
    for (const b of this.bombs) {
      if (!b.alive || b === src || b.held) continue
      if (Math.hypot(b.x - pos.x, b.y - pos.y, b.z - pos.z) < spec.R * 0.8 && b.type !== 'smoke') { b.fuse = Math.min(b.fuse, 0.12 + this.rng() * 0.08); b.chain = Math.max(b.chain, chain + 1); if (b.thrower === b.owner) b.thrower = by || b.thrower }
    }
    for (const d of this.level.drums) {
      if (!d.alive || d.burning) continue
      if (Math.hypot(d.x - pos.x, d.z - pos.z) < spec.R * 0.9) { d.burning = true; d.fuse = 0.14 + this.rng() * 0.12; d.chain = chain + 1; d.by = by }
    }
  }
  breakGlass(g, by) {
    if (!g || !g.alive) return
    g.alive = false; g.box.dead = true; g.mesh.visible = false
    const p = g.mesh.position
    for (let i = 0; i < 26; i++) this.fx.sprite({ map: FXTEX.soft, pos: new THREE.Vector3(p.x + (this.rng() - 0.5) * 1.2, p.y + (this.rng() - 0.5) * 0.8, p.z + (this.rng() - 0.5) * 1.2), vel: new THREE.Vector3((this.rng() - 0.5) * 4, this.rng() * 2, (this.rng() - 0.5) * 4), size: 0.04, life: 0.9, color: 0xdfeef2, drag: 0.5, rise: -12, fadeIn: 0, add: true })
    this.sound('glass', p, 0.9)
  }
  // 火炎瓶の火: 地面に広がって life 秒燃える。中の人は 1秒に dps 減る（鎧は半分まで受ける）。ドラム缶に火が付く
  burn(x, y, z, by) {
    // 高い壁で割れても真下の地面に火が落ちる（下へ 40m まで探す）
    const S = BOMB.molotov, gh = raycast(this.world, [x, y + 0.3, z], [x, y - 40, z]), gy = gh ? y + 0.3 - gh.t * (40.3) : Math.max(-1.6, this.world.H(x, z))
    const c = { x, y: gy, z, r: S.R, t: 0, life: S.life, by }
    this.burns.push(c)
    this.sound('glass', { x, y: gy, z }, 0.9)
    const pos = new THREE.Vector3(x, gy, z)
    this.fx.groundFire(pos, S.R, S.life)
    this.fx.scorch(x, gy, z, S.R * 1.1)
    for (const d of this.level.drums) if (d.alive && !d.burning && Math.hypot(d.x - x, d.z - z) < S.R + 0.6) { d.burning = true; d.fuse = 1.2 + this.rng() * 0.8; d.chain = 1; d.by = by }
  }
  updateBurns(dt) {
    const S = BOMB.molotov
    for (const c of this.burns) {
      c.t += dt
      const k = c.t < 0.4 ? c.t / 0.4 : c.t > c.life - 1 ? Math.max(0, c.life - c.t) : 1 // 広がる・消えかけは弱い
      for (const f of this.fighters) {
        if (!f.alive || f.vehicle || f.ghost) continue
        if (Math.hypot(f.body.x - c.x, f.body.z - c.z) > c.r * (0.6 + 0.4 * k) || Math.abs(f.body.y - c.y) > 1.6) continue
        if (raycast(this.world, [c.x, c.y + 0.4, c.z], [f.body.x, f.body.y + 0.4, f.body.z], bx => bx.kind === 'edge' || bx.tag === 'drum')) continue // 壁の向こうには燃え移らない
        let dmg = S.dps * dt * k
        const ab = Math.min(f.armor, dmg * 0.5); f.armor -= ab; dmg -= ab
        f.hp -= dmg
        f.burnT = (f.burnT || 0) + dt
        if (f.burnT > 0.5) { f.burnT = 0; f.char.flinch(); if (c.by && c.by !== f) this.cue(c.by, 'hit', f.nid, Math.round(S.dps * 0.5), f.hp <= 0); this.cue(f, 'hurt', Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10) }
        if (f.isPlayer) this.hurtK = Math.min(1, (this.hurtK || 0) + dmg / 40)
        f.lastHit = { by: c.by, how: 'fire', t: this.t }
        if (f.hp <= 0) this.kill(f, c.by, c.by === f ? 'self' : 'fire')
      }
    }
    this.burns = this.burns.filter(c => c.t < c.life)
  }
  groundAt(x, z, y) {
    const h = raycast(this.world, [x, y + 0.3, z], [x, y - 6, z])
    return h ? (y + 0.3) - h.t * 6.3 : -1.6
  }
  kill(f, by, how) {
    if (!f.alive) return
    f.alive = false; f.hp = 0; f.dive = null; f.air = null; this.clearAir(f); f.char.die()
    if (f.cooking) { const b = f.cooking; b.held = null; f.cooking = null; b.vx = (this.rng() - 0.5); b.vy = 1; b.vz = (this.rng() - 0.5) }
    if (by && by !== f) by.kills++
    this.ev.kills[how || 'normal'] = (this.ev.kills[how || 'normal'] || 0) + 1
    if (f.vehicle) this.exitVehicle(f)
    const tag = { lake: '湖へ', fire: '火', back: '投げ返し', chain: '連鎖', self: '自爆', sea: '海へ', river: '川へ', zone: '円の外', ram: 'はねた', fall: '転落', punch: 'パンチ', mine: '地雷' }[how] || ''
    this.feed.unshift({ a: by && by !== f ? by.name : (how === 'zone' ? '' : by === f ? f.name : ''), b: f.name, tag, t: this.t })
    this.hostEv({ k: 'feed', a: this.feed[0].a, b: f.name, tag })
    if (this.feed.length > 5) this.feed.pop()
    if (by && f !== by) this.cue(by, 'banner', how === 'back' ? `投げ返しで ${f.name} を倒した` : how === 'chain' ? `連鎖で ${f.name} を倒した` : `${f.name} を倒した`, 'kill')
    if (!this.online && (f.isPlayer || (by && by.isPlayer))) this.slowT = f.isPlayer ? 1.3 : 0.7
    this.cue(f, 'banner', how === 'self' ? '自爆' : how === 'sea' ? '海に落ちた' : how === 'river' ? '川に落ちた' : how === 'lake' ? '湖に落ちた' : by && by !== f ? `${by.name} にやられた` : 'やられた', 'dead'); if (f.isPlayer) this.specT = 0
    const alive = this.fighters.filter(x => x.alive)
    if (alive.length <= 1 && !this.over) { this.over = true; this.overT = 0; this.winner = alive[0] || null; this.slowT = 1.5 }
  }

  // ---------- 人の動き ----------
  updateFighter(f, dt) {
    const B = f.body
    if (f.vehicle && f.alive) {
      const v = f.vehicle, [fx, fz] = v.fwd()
      B.x = v.x; B.z = v.z; B.y = v.y + 0.4; B.vx = fx * v.speed; B.vz = fz * v.speed; B.vy = 0; B.onGround = true
      f.yaw = v.yaw; f.char.root.position.set(B.x, B.y, B.z)
      const z = this.zone
      if (z && this.t > z.t0 && Math.hypot(B.x - z.x, B.z - z.z) > z.r) { f.hp -= dt * (3 + (this.t - z.t0) * 0.04); if (f.hp <= 0) this.kill(f, null, 'zone') }
      return
    }
    // 倒れた人: 倒れる動きが終わって地面に着いたら計算を止める（終盤は倒れた 40人以上が毎コマ動いていた 2026-11-23）
    if (!f.alive) { f.deadT = (f.deadT || 0) + dt; if (f.deadT > 3 && B.onGround) return; B.vx *= 0.9; B.vz *= 0.9; B.vy -= 20 * dt; moveBody(this.world, B, dt); f.char.update(dt, B); return }
    if (f.air) { this.updateAir(f, dt); if (f.air) { if (f.air.mode !== 'plane') { this.syncAir(f, dt); f.char.update(dt, B) } return } }
    const inp = f.input || {}
    f.stun = Math.max(0, f.stun - dt)
    // 飛び込み: 走りながらしゃがむ（押した瞬間）。向きは動かしている方向
    { const cr = !!inp.crouch; if (!f.dive && cr && !f.prevCr && inp.run && Math.hypot(B.vx, B.vz) > 3 && (inp.mx || inp.mz)) this.startDive(f, inp.mx, inp.mz); f.prevCr = cr }
    if (f.dive && f.stun > 0) this.endDive(f) // 殴られた・はねられたら飛び込みは終わり
    const dv = f.dive
    B.crouch = !dv && !!inp.crouch && B.onGround
    const holding = !!f.cooking
    if (dv) {
      dv.t += dt
      const T = dv.t
      if (T < 0.25) { B.vx = dv.dx * 14; B.vz = dv.dz * 14 } // 飛ぶ: 0.25秒で 3.5m
      else if (T < 0.75) { const kk = Math.exp(-dt * 20); B.vx *= kk; B.vz *= kk } // 伏せて 0.7m ほどすべって止まる
      else { B.vx = B.vz = 0 }
      B.vy -= 20 * dt; B.hitWall = 0; B.h = 0.8
      if (T >= 1.25) this.endDive(f)
    } else {
    // 後ろ向き（向いている方と逆）に動く時は 0.75倍。PUBG などと同じく、下がりながらは速く走れない
    const backIn = Math.sin(f.yaw) * (inp.mx || 0) + Math.cos(f.yaw) * (inp.mz || 0) < -0.3 * Math.hypot(inp.mx || 0, inp.mz || 0)
    const maxS = (B.crouch ? 1.7 : holding ? 3.0 : inp.run ? 6.2 : 4.4) * (backIn ? 0.75 : 1)
    let tx = inp.mx * maxS, tz = inp.mz * maxS
    const ctl = f.stun > 0 ? 0.04 : B.onGround ? 1 : 0.12
    const k = Math.min(1, dt * 12 * ctl)
    if (B.onGround && f.stun <= 0) { B.vx += (tx - B.vx) * k; B.vz += (tz - B.vz) * k }
    else { B.vx += (tx - B.vx) * k * 0.5; B.vz += (tz - B.vz) * k * 0.5; if (B.onGround) { const fr = f.char.down ? 9 : 6; B.vx *= 1 - dt * fr; B.vz *= 1 - dt * fr } }
    if (inp.jump && B.onGround && f.stun <= 0) { B.vy = 5.4; B.onGround = false }
    B.vy -= 20 * dt
    B.hitWall = 0
    B.h = B.crouch ? 1.25 : 1.75
    }
    const wasG = B.onGround, vy0 = B.vy
    moveBody(this.world, B, dt)
    if (!wasG && B.onGround && vy0 < -12) { const dmg = (-vy0 - 12) * 7; f.hp -= dmg; f.char.flinch(); this.sound('thud', B, 0.8); if (f.isPlayer) this.hurtK = Math.min(1, (this.hurtK || 0) + dmg / 60); if (f.hp <= 0) { const lh = f.lastHit && this.t - f.lastHit.t < 6 ? f.lastHit : null; this.kill(f, lh ? lh.by : f, lh ? lh.how : 'fall') } }
    B.airT = B.onGround ? 0 : B.airT + dt
    // 軽トラとぶつかる（速ければはねられる）
    for (const V of this.vehs) if (f.alive && V.inside(B.x, B.y + 0.5, B.z, B.r)) {
      f.ramT = Math.max(0, (f.ramT || 0))
      if (Math.abs(V.speed) > 3 && f.ramT <= 0 && V.driver !== f) {
        const [vx, vz] = V.fwd(), s = V.speed, dmg = Math.abs(s) * 5.5
        f.hp -= dmg; B.vx = vx * s * 0.9; B.vz = vz * s * 0.9; B.vy = 3.5 + Math.abs(s) * 0.25; B.onGround = false; f.stun = 0.9; f.char.knock(); f.ramT = 0.8
        f.lastHit = { by: V.driver, how: 'ram', t: this.t }
        this.sound('thud', B, 1); this.fx.shake = Math.max(this.fx.shake, 0.3)
        if (V.driver) this.cue(V.driver, 'hit', f.nid, Math.round(dmg), f.hp <= 0)
        if (f.hp <= 0) this.kill(f, V.driver, 'ram')
      }
      const [a, b] = V.local(B.x, B.z), pa = VEH.half[0] + B.r - Math.abs(a), pb = VEH.half[1] + B.r - Math.abs(b)
      const [wx, wz] = pa < pb ? V.world(Math.sign(a) * (VEH.half[0] + B.r), b) : V.world(a, Math.sign(b) * (VEH.half[1] + B.r))
      B.x = wx; B.z = wz
    }
    f.ramT = (f.ramT || 0) - dt
    if (!wasG && B.onGround && f.stun > 0.1 && !f.char.down) f.stun = Math.min(f.stun, 0.12)
    // 向き
    const sp = Math.hypot(B.vx, B.vz)
    let want = f.yaw
    if (dv) { /* 飛んでいる間は向きを変えない */ } else if (holding || f.isPlayer && this.mouse.r || f.remote && f.aimR || this.t < (f.punchFace || 0)) want = f.isPlayer || f.remote ? f.aimYaw : f.yaw
    else if (sp > 0.6 && f.stun <= 0) want = Math.atan2(B.vx, B.vz)
    let dy = want - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    f.yaw += dy * Math.min(1, dt * (holding ? 16 : 10))
    f.char.yaw = f.yaw + CHAR_YAW
    // 後ろ向きに歩いているか
    B.back = sp > 0.5 && (Math.sin(f.yaw) * B.vx + Math.cos(f.yaw) * B.vz) < -0.3 * sp
    f.char.aimPitch = holding ? (f.isPlayer ? this.camPitch : f.remote ? f.aimPitch || 0 : 0) : 0
    // 人が操作している人は、見ている向きへ頭を向ける
    f.char.lookYaw = f.isPlayer || f.remote ? f.aimYaw + CHAR_YAW : null; f.char.lookPitch = f.isPlayer ? this.camPitch : f.aimPitch || 0
    f.char.update(dt, B)
    // 足音
    if (B.onGround && sp > 1 && !f.dive) { f.stepAcc += dt * sp * (B.crouch ? 0 : 0.55); if (f.stepAcc > 1) { f.stepAcc = 0; const onWood = B.groundY > 0.1 || B.z < -20; this.sound(onWood ? 'wstep' : 'step', B, f.isPlayer ? 0.18 : 0.3 * (inp.run ? 1 : 0.6)) } }
    // 海に落ちた
    if (B.y < -1.2 && f.alive) {
      this.fx.splash(new THREE.Vector3(B.x, -1.55, B.z))
      const lh = f.lastHit && this.t - f.lastHit.t < 6 ? f.lastHit : null
      this.kill(f, lh ? lh.by : null, lakeD(B.x, B.z) < 1.3 ? 'lake' : B.z > 120 && B.z < 262 && Math.abs(B.x) < 100 && riverEdge(B.x, B.z) < 3.5 ? 'river' : 'sea')
    }
    // 拾う物
    for (const it of this.items) {
      if (it.gone > 0) continue
      if (Math.hypot(it.x - B.x, it.z - B.z) < 0.95 && Math.abs(it.y - B.y) < 1.2) {
        const inv = f.inv
        if (it.kind === 'armor') { if (f.armor >= 100) continue; f.armor = Math.min(100, f.armor + 50) }
        else if (it.kind === 'med') { if (f.hp >= 100) continue; f.hp = Math.min(100, f.hp + 50) }
        else if (it.kind === 'mine') { if (inv.mine >= BOMB.mine.max) continue; inv.mine++ } // 地雷は最大3個まで
        else { inv[it.kind] += it.kind === 'frag' ? 2 : 1 } // 所持数に上限は無い（本人 2026-11-22）
        it.gone = it.drop ? 1e9 : 14; it.mesh.visible = false
        this.cue(f, 'toast', { frag: '手投げ +2', smoke: '煙 +1', sticky: '粘着 +1', molotov: '火炎瓶 +1', mine: '地雷 +1', armor: '防具 +50', med: '回復 +50' }[it.kind])
        this.sound('clink', B, 0.4)
      }
    }
    // 円の外
    const z = this.zone
    if (z && this.t > z.t0 && Math.hypot(B.x - z.x, B.z - z.z) > z.r) { f.hp -= dt * (3 + (this.t - z.t0) * 0.04); if (f.hp <= 0) this.kill(f, null, 'zone') }
  }

  // ---------- 入力 ----------
  bindInput() {
    const cv = this.renderer.domElement
    addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (this.mode !== 'play') return
      const K = this.keymap, is = id => K.is(e.code, id) // キーは設定で変えられる（js/keys.js）
      if (is('s1')) this.player.sel = 'frag'
      if (is('s2')) this.player.sel = 'smoke'
      if (is('s3')) this.player.sel = 'sticky'
      if (is('s4')) this.player.sel = 'molotov'
      if (is('s5')) this.player.sel = 'mine'
      if (this.isGuest()) {
        if (is('pick') && !e.repeat) this.online.act({ a: 'pick' })
        if (is('veh') && !e.repeat) this.online.act({ a: 'veh' })
        if (is('det') && !e.repeat) this.online.act({ a: 'det' })
      } else {
        if (is('pick')) this.tryPickup(this.player)
        if (is('veh') && !e.repeat) { if (this.player.air) this.airAct(this.player); else if (this.player.vehicle) this.exitVehicle(this.player); else this.enterVehicle(this.player) }
        if (is('det')) this.detonateSticky(this.player)
      }
      if (is('map') && !e.repeat) this.bigMap = !this.bigMap
      if (is('again') && (this.over || !this.player.alive) && !this.online) this.newMatch() // やられたらすぐ「もう一回」（最後まで観戦を待たない）
      if (this.keymap.byCode.has(e.code) && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab')) e.preventDefault()
    })
    addEventListener('keyup', e => { this.keys[e.code] = false })
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== cv || this.mode !== 'play') return
      const s = 0.0022 * (this.mouse.r ? 0.6 : 1)
      this.camYaw -= e.movementX * s; this.camPitch = THREE.MathUtils.clamp(this.camPitch - e.movementY * s, -1.15, 0.85)
    })
    cv.addEventListener('mousedown', e => {
      if (this.mode !== 'play') return
      if (document.pointerLockElement !== cv) { this.lock(); return }
      if (e.button === 0) { this.mouse.l = true; if (this.player.alive && !this.player.cooking && !this.player.vehicle && !this.player.air) this.pullPin(this.player) }
      if (e.button === 2) this.mouse.r = true
    })
    addEventListener('mouseup', e => {
      if (e.button === 0) { this.mouse.l = false; if ((this.player.cooking || this.pinSent) && this.mode === 'play') { this.pinSent = false; this.release(this.player, this.playerThrowVel()) } }
      if (e.button === 2) this.mouse.r = false
    })
    addEventListener('wheel', e => { if (this.mode !== 'play') return; const i = TYPES.indexOf(this.player.sel); this.player.sel = TYPES[(i + (e.deltaY > 0 ? 1 : TYPES.length - 1)) % TYPES.length] })
    cv.addEventListener('contextmenu', e => e.preventDefault())
    $('#start')?.addEventListener('click', () => { this.mode = 'play'; this.started = true; $('#title').classList.add('gone'); this.startAudio(); this.lock() })
    $('#kset')?.addEventListener('click', () => this.keyPanel.open())
    $('#kbtn')?.addEventListener('click', () => this.keyPanel.open())
    // 試合中にマウスを外したら（Esc）右上に「キー設定」を出す
    document.addEventListener('pointerlockchange', () => $('#kbtn')?.classList.toggle('on', document.pointerLockElement !== cv && this.mode === 'play'))
    $('#again')?.addEventListener('click', () => { if (this.online) { this.online.again(); return } this.newMatch(); this.lock() })
  }
  // 画面のキー表示を設定に合わせる（data-k に動作の名前。data-k="move" は前後左右）
  keyLabels() {
    const K = this.keymap
    document.querySelectorAll('[data-k]').forEach(el => { const id = el.dataset.k; el.textContent = id === 'move' ? ['fwd', 'left', 'back', 'right'].map(a => K.label(a)).join('') : id === 'slots' ? ['s1', 's2', 's3', 's4', 's5'].map(a => K.label(a)).join(' ') : K.label(id) })
  }
  lock() { if (this.keyPanel && this.keyPanel.isOpen) return; try { const r = this.renderer.domElement.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}) } catch (e) {} }
  playerInput() {
    const k = this.keys, f = this.player
    const D = id => this.keymap.down(k, id)
    let fx = (D('fwd') ? 1 : 0) - (D('back') ? 1 : 0)
    let sx = (D('right') ? 1 : 0) - (D('left') ? 1 : 0)
    const fwd = [Math.sin(this.camYaw + Math.PI), Math.cos(this.camYaw + Math.PI)], right = [-fwd[1], fwd[0]]
    let mx = fwd[0] * fx + right[0] * sx, mz = fwd[1] * fx + right[1] * sx
    const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l }
    f.input = { mx, mz, run: D('run'), jump: D('jump'), crouch: D('crouch') } // Ctrl は割り当てられない（Ctrl+W でブラウザのタブが閉じる）
    if (f.vehicle) { f.vin = { throttle: fx, steer: sx, hand: D('jump') }; f.input = { mx: 0, mz: 0 } }
    f.aimYaw = this.camYaw + Math.PI
  }
  camDir() { const cp = Math.cos(this.camPitch); return new THREE.Vector3(Math.sin(this.camYaw + Math.PI) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw + Math.PI) * cp) }
  playerThrowVel() {
    const d = this.camDir()
    if (this.mouse.r) { d.y = Math.min(d.y, 0.1) - 0.05; d.normalize(); return [d.x * 9, d.y * 9 + 1.5, d.z * 9] } // 右を押しながら＝転がし投げ
    d.y += 0.5; d.normalize()
    return [d.x * 19.5, d.y * 19.5, d.z * 19.5] // 18→19.5: 届く距離が約2割伸びる（本人「ちょっと伸ばして」2026-11-23）
  }
  // 着く所の点線
  makeArc() {
    const n = 90
    this.arcGeo = new THREE.BufferGeometry(); this.arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    this.arc = new THREE.Points(this.arcGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }))
    this.arc.frustumCulled = false; this.arc.visible = false; this.arc.renderOrder = 5; this.scene.add(this.arc)
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 40), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }))
    this.mark.rotation.x = -Math.PI / 2; this.mark.visible = false; this.scene.add(this.mark)
  }
  updateArc() {
    const f = this.player
    const show = this.mode === 'play' && f.alive && (f.cooking || this.mouse.r)
    this.arc.visible = this.mark.visible = !!show
    if (!show) return
    this.mark.scale.setScalar(1 + 0.14 * Math.sin(performance.now() / 110)) // 着く所の輪を脈打たせて見つけやすく
    const hp = new THREE.Vector3(); this.handPoint(f, hp)
    const v = this.playerThrowVel(), b = { x: hp.x, y: hp.y, z: hp.z, vx: v[0] + f.body.vx * 0.6, vy: v[1], vz: v[2] + f.body.vz * 0.6, r: 0.065 }
    const pos = this.arcGeo.attributes.position, n = pos.count
    let i = 0, landed = false
    for (let s = 0; s < 180 && i < n; s++) {
      b.vy -= GRAV / 60; const hit = moveBall(this.world, b, 1 / 60, 0.34, 0.55)
      if (s % 2 === 0) pos.setXYZ(i++, b.x, b.y, b.z)
      if (hit || b.y < -1.6) { landed = true; break }
    }
    for (let j = i; j < n; j++) pos.setXYZ(j, b.x, b.y, b.z)
    pos.needsUpdate = true
    this.mark.position.set(b.x, b.y + 0.02 - 0.06, b.z); this.mark.visible = landed
    this.arc.material.color.set(f.cooking ? 0xffe9c7 : 0xbfd6ea)
  }

  // ---------- カメラ ----------
  updateCamera(dt) {
    if (this.freeCam) { const c = this.freeCam; this.camera.position.set(c[0], c[1], c[2]); this.camera.lookAt(c[3], c[4], c[5]); return }
    const f = this.player
    let tgt = f
    if (!f.alive && this.mode === 'play') { tgt = f.lastHit && f.lastHit.by && f.lastHit.by.alive ? f.lastHit.by : this.fighters.find(x => x.alive) || f }
    if (this.mode === 'title') {
      const a = performance.now() * 0.00004
      this.camera.position.set(Math.sin(a) * 30 - 2, 11 + Math.sin(a * 2) * 2, Math.cos(a) * 30 - 4)
      this.camera.lookAt(-6, 1.5, -6)
      return
    }
    const B = tgt.body
    // 輸送機の中: 機のまわりを回って島を見る（マウス）。落下・傘: 少し引いた後ろから
    if (tgt.air && tgt.air.mode === 'plane' && tgt === f) {
      const fwd = this.camDir(), c = new THREE.Vector3(B.x, B.y + 2.4, B.z), want = c.clone().addScaledVector(fwd, -19)
      if (!this.camReady) { this.camPos.copy(want); this.camReady = true }
      this.camPos.lerp(want, 1 - Math.exp(-dt * 14)); this.camera.position.copy(this.camPos); this.camera.lookAt(c)
      this.camera.fov += (66 - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix()
      return
    }
    const aim = !!(f.cooking || this.mouse.r) && tgt === f
    const inCar = !!tgt.vehicle
    const am = tgt.air && tgt.air.mode, dist = inCar ? 5.0 : am === 'chute' ? 5.8 : am === 'fall' ? 4.6 : aim ? 1.3 : 1.7, side = inCar ? 0 : am ? 0.2 : aim ? 0.62 : 0.52, up = inCar ? 2.0 : am === 'chute' ? 2.3 : am === 'fall' ? 1.0 : tgt.dive ? 1.0 : B.crouch ? 1.2 : 1.6
    const fwd = this.camDir()
    const right = new THREE.Vector3(Math.cos(this.camYaw + Math.PI), 0, -Math.sin(this.camYaw + Math.PI))
    const head = new THREE.Vector3(B.x, B.y + up, B.z)
    const want = head.clone().addScaledVector(fwd, -dist).addScaledVector(right, -side).add(new THREE.Vector3(0, 0.25, 0))
    // 壁の手前に寄せる
    const h = raycast(this.world, [head.x, head.y, head.z], [want.x, want.y, want.z])
    if (h) { const len = head.distanceTo(want) || 1; want.lerpVectors(head, want, Math.max(0.1, h.t - 0.3 / len)) } // 壁の手前 30cm まで寄せる（狭い家の中や2階でも壁にめり込まない）
    if (!this.camReady) { this.camPos.copy(want); this.camReady = true }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 18))
    this.camera.position.copy(this.camPos)
    const look = this.camPos.clone().addScaledVector(fwd, 10)
    if (this.fx.shake > 0) { const s = this.fx.shake * 0.12; this.camera.position.add(new THREE.Vector3((this.rng() - 0.5) * s, (this.rng() - 0.5) * s, (this.rng() - 0.5) * s)) }
    this.camera.lookAt(look)
    const spd = Math.hypot(B.vx, B.vz), fov = aim ? 54 : (spd > 5.2 && !inCar ? 66 : 62); // 走ると少し広がって速さが出る
    ; this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix()
  }

  // ---------- 円 ----------
  makeZoneMesh() {
    if (this.zoneMesh) this.scene.remove(this.zoneMesh)
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
      fragmentShader: 'uniform float uT; varying vec2 vUv; varying vec3 vW; void main(){ float s = 0.5+0.5*sin(vW.y*3.0 - uT*2.0 + vUv.x*120.0); float a = (0.10 + 0.06*s) * smoothstep(1.0, 0.0, vUv.y) ; gl_FragColor = vec4(1.0, 0.62, 0.32, a); }' })
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 128, 1, true), m)
    this.zoneMesh.position.y = 26; this.zoneMesh.renderOrder = 4; this.scene.add(this.zoneMesh)
  }
  updateZone(dt) {
    const z = this.zone
    const k = THREE.MathUtils.clamp((this.t - z.t0) / (z.t1 - z.t0), 0, 1)
    z.r = z.r0 + (z.r1 - z.r0) * k
    this.zoneMesh.scale.set(z.r, 1, z.r); this.zoneMesh.position.x = z.x; this.zoneMesh.position.z = z.z
    this.zoneMesh.material.uniforms.uT.value = this.t
    this.zoneMesh.visible = this.t > z.t0 - 10
  }

  // ---------- 音 ----------
  sound(name, at, vol = 1, o = {}) {
    if (this.online && this.online.role === 'host') this.online.pushSound(name, at, vol, o)
    if (!Snd || !this.audioOn || this._quiet) return
    const d = this.camera.position.distanceTo(new THREE.Vector3(at.x, at.y || 0, at.z))
    const v = vol / (1 + d / (o.far ? 25 : 9))
    if (v < 0.02) return
    Snd.play(name, { vol: v, jitter: 0.08, delay: o.far ? Math.min(0.12, d / 343) : 0 })
  }

  // ---------- 1コマ ----------
  step(dt) {
    setCharView(this.camera, this.world) // 画面の外・遠くの人の骨の計算を間引くため・足を地面に合わせるため
    if (this.isGuest()) { this.online.guestStep(dt); return }
    if (this.mode === 'play') this.t += dt
    if (this.mode === 'play' && !this.over) {
      if (this.player.alive) this.playerInput(); else this.player.input = { mx: 0, mz: 0 }
      for (const f of this.fighters) if (f.bot && this.started) { if (f.bot.off) f.input = { mx: 0, mz: 0 }; else if (!f.air) f.bot.update(dt) }
    } else for (const f of this.fighters) if (f.bot) f.input = { mx: 0, mz: 0 }
    for (const f of this.fighters) this.updateFighter(f, dt)
    for (const V of this.vehs) {
      V.update(dt, V.driver ? V.driver.vin : null)
      if (Math.abs(V.speed) > 7) for (const d of this.level.drums) if (d.alive && !d.burning && V.inside(d.x, (d.y || 0) + 0.4, d.z, 0.35)) { d.burning = true; d.fuse = 0.25; d.chain = 0; d.by = V.driver }
    }
    this.updateBombs(dt)
    this.updateBurns(dt)
    for (const it of this.items) if (it.gone > 0) { it.gone -= dt; if (it.gone <= 0) it.mesh.visible = true }
    this.fx.update(dt)
    this.updateZone(dt)
    // 補給: 円が縮み始めたら、円の内側に爆弾の箱を落とす
    const z = this.zone
    if (this.mode === 'play' && this.t > z.t0) {
      this.dropT = (this.dropT ?? 0) - dt
      if (this.dropT <= 0) {
        this.dropT = 20
        for (let k = 0; k < 12; k++) {
          const a = this.rng() * 6.28, r = this.rng() * z.r * 0.6, x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r
          const c = this.nav.cell(x, zz); if (!this.nav.free(c[0], c[1])) continue
          this.addItem(x, Math.max(0, this.world.H(x, zz)), zz, (r => r < 0.55 ? 'frag' : r < 0.8 ? 'sticky' : 'molotov')(this.rng())); this.items[this.items.length - 1].drop = true
          if (Math.hypot(x - this.player.body.x, zz - this.player.body.z) < 40) this.toast('補給が落ちた')
          break
        }
      }
    }
    if (this.over) { this.overT += dt; if (this.overT > 2.2 && !this.resultShown) this.showResult() }
    // カモメ
    this.gullT = (this.gullT ?? 6) - dt; if (this.gullT < 0) { this.gullT = 8 + this.rng() * 14; this.sound('gull', { x: -10 + this.rng() * 30, y: 8, z: -30 }, 0.5) }
    if (this.online && this.online.role === 'host') this.online.hostTick(dt)
  }
  render(dt) {
    this.updateCamera(dt)
    this.updateArc()
    // 拾う物は 110m、置き物はそれぞれの距離より遠ければ描かない（数コマに1回だけ見直す）
    const cp = this.camera.position, recheck = (this._cullN = (this._cullN || 0) + 1) % 6 === 0
    for (const it of this.items) { if (recheck) it.mesh.visible = !(it.gone > 0) && (it.x - cp.x) ** 2 + (it.z - cp.z) ** 2 < 110 * 110; if (it.mesh.visible) it.mesh.rotation.y += dt * 0.6 }
    if (recheck) for (const o of this.cullables || []) o.visible = (o.position.x - cp.x) ** 2 + (o.position.z - cp.z) ** 2 < o.userData.cullDist ** 2
    this.sea.tick(performance.now() / 1000)
    this.syncPlane(dt); this.airAudio()
    if (this.mode === 'play' && this.minimap) this.minimap.draw()
    if (this.level.grass) this.level.grass.tick(performance.now() / 1000, this.fighters, this.camera.position)
    if (this.level.grass2) this.level.grass2.tick(performance.now() / 1000, this.fighters, this.camera.position)
    { const S = this.sunRig.sun, c = this.camera.position, s = 96 / 4096 * 2, tx = Math.round(c.x / s) * s, tz = Math.round(c.z / s) * s
      S.target.position.set(tx, 0, tz); S.position.copy(this.sunRig.dir).multiplyScalar(80).add(S.target.position) }
    for (const bt of this.scene.userData.boats || []) { const t = performance.now() / 1000 + bt.userData.bob; bt.position.y = -1.35 + Math.sin(t * 0.9) * 0.06; bt.rotation.z = Math.sin(t * 0.7) * 0.025; bt.rotation.x = Math.sin(t * 0.55) * 0.015 }
    const g = this.post.grade.uniforms
    this.hurtK = Math.max(0, (this.hurtK || 0) - dt * 0.8); this.flashK = Math.max(0, (this.flashK || 0) - dt * 2.5)
    { const p = this.player, z = this.zone, out = !!(this.mode === 'play' && p && p.alive && z && this.t > z.t0 - 10 && Math.hypot(p.body.x - z.x, p.body.z - z.z) > z.r); this.outK = (this.outK || 0) + ((out ? 1 : 0) - (this.outK || 0)) * Math.min(1, dt * 3); g.uOut.value = this.outK }
    g.uHurt.value = this.hurtK; g.uFlash.value = this.flashK; g.uTime.value = performance.now() % 1000
    this.post.comp.render(dt)
    this.hud()
  }
  loop() {
    const now = performance.now()
    let el = Math.min(0.1, (now - this.last) / 1000); this.last = now
    if (!this.paused) {
      if (this.slowT > 0) { this.slowT -= el; this.acc += el * 0.28 } else this.acc += el
      while (this.acc >= DT) { this.step(DT); this.acc -= DT }
    }
    this.render(el)
    this.frames = (this.frames || 0) + 1
    requestAnimationFrame(() => this.loop())
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix()
    this.renderer.setSize(innerWidth, innerHeight); this.post.resize(innerWidth, innerHeight)
  }

  // ---------- オンライン ----------
  isGuest() { return !!(this.online && this.online.role === 'guest') }
  hostEv(e) { if (this.online && this.online.role === 'host') this.online.pushEv(e) }
  // その人だけに見せる合図（自分なら画面に出す、オンラインの相手なら送る）
  cue(f, c, ...a) {
    if (!f) return
    if (f === this.player) this.cueLocal(c, a)
    else if (f.remote) this.online.pushEv({ k: 'cue', to: f.nid, c, a })
  }
  cueLocal(c, a) {
    if (c === 'banner') this.banner(a[0], a[1])
    else if (c === 'toast') this.toast(a[0])
    else if (c === 'muffle') { if (Snd) Snd.muffle(a[0] || 1.2) }
    else if (c === 'hit') { const t = this.fighters[a[0]]; if (t) this.hitFx(t, a[1], a[2]) }
    else if (c === 'hurt') (this.hurtDirs || (this.hurtDirs = [])).push({ x: a[0], z: a[1], t: this.t })
  }
  bannerAll(text, kind) { this.banner(text, kind); this.hostEv({ k: 'ban', a: [text, kind] }) }

  // ---------- 画面の文字 ----------
  banner(text, kind) { const b = $('#banner'); if (!b) return; b.textContent = text; b.className = 'show ' + kind; clearTimeout(this._bt); this._bt = setTimeout(() => { b.className = '' }, 1600) }
  toast(text) { const t = $('#toast'); if (!t) return; t.textContent = text; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 1100) }
  hitFx(f, dmg, kill) {
    const h = $('#hitx'); h.className = 'on' + (kill ? ' kill' : ''); clearTimeout(this._hx); this._hx = setTimeout(() => { h.className = '' }, 90)
    const el = document.createElement('span'); el.textContent = Math.round(dmg); if (dmg > 60) el.className = 'big'
    const p = new THREE.Vector3(f.body.x, f.body.y + 2.0, f.body.z).project(this.camera)
    el.style.left = (p.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-p.y * 0.5 + 0.5) * innerHeight + 'px'
    $('#nums').appendChild(el); requestAnimationFrame(() => { el.style.opacity = 0; el.style.transform = 'translate(-50%,-140%)' }); setTimeout(() => el.remove(), 700)
    this.sound('clink', this.player.body, 0.15)
  }
  // 画面の上での向き（カメラから見て、点がどちらにあるか。0 が正面、時計回り）
  screenAngle(x, z) {
    const f = this.camDir(), dx = x - this.camera.position.x, dz = z - this.camera.position.z
    const fx = f.x, fz = f.z, l = Math.hypot(fx, fz) || 1
    const F = (dx * fx + dz * fz) / l, R = (-dx * fz + dz * fx) / l
    return Math.atan2(R, F)
  }
  hudAware() {
    const f = this.player
    // 攻撃された向き・足音の向きの赤い弧は出さない（本人の指示 2026-11-20「音鳴ってる場所、方向が赤くなるのやめて」）
    // 近くの爆弾の警告
    const ws = []
    if (f.alive) for (const b of this.bombs) {
      if (!b.alive || b.held === f || b.type === 'smoke' || b.type === 'molotov' || (b.type === 'mine' && !b.trig)) continue
      // 煙の中（爆弾か自分が煙に入っている）では 3m まで近づかないと知らせない。煙を「隠れる・不意を突く」道具にする
      const d = Math.hypot(b.x - f.body.x, b.z - f.body.z); if (d > (this.fx.inSmoke(b) || this.fx.inSmoke(f.body) ? 3 : 9)) continue
      const p = new THREE.Vector3(b.x, b.y + 0.3, b.z).project(this.camera)
      let x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight, edge = false
      if (p.z > 1 || x < 40 || x > innerWidth - 40 || y < 40 || y > innerHeight - 40) {
        const a = this.screenAngle(b.x, b.z), R = Math.min(innerWidth, innerHeight) * 0.36
        x = innerWidth / 2 + Math.sin(a) * R; y = innerHeight / 2 - Math.cos(a) * R; edge = true
      }
      const hot = d < BOMB[b.type].R && b.fuse < 1.6
      ws.push(`<b class="${hot ? 'hot' : ''}${edge ? ' edge' : ''}" style="left:${x}px;top:${y}px">${d.toFixed(0)}m</b>`)
    }
    $('#warns').innerHTML = ws.join('')
  }
  hud() {
    const f = this.player; if (!f) return
    if (this.mode === 'play') { this.hudAware(); this.dropHud() }
    const hud = $('#hud'); hud.classList.toggle('on', this.mode === 'play')
    $('#hpbar').style.transform = `scaleX(${Math.max(0, f.hp) / 100})`
    $('#arbar').style.transform = `scaleX(${f.armor / 100})`
    $('#hpnum').textContent = Math.max(0, Math.ceil(f.hp))
    for (const t of TYPES) { const el = $(`#slot-${t}`); el.classList.toggle('sel', f.sel === t); el.classList.toggle('empty', !f.inv[t]); el.querySelector('b').textContent = f.inv[t] }
    $('#alive').textContent = this.fighters.filter(x => x.alive).length
    const z = this.zone, left = z.t0 - Math.max(this.t, this.dropOn ? DROP.T : 0) // 円の時計は輸送機が飛び終わってから
    // 円の知らせ: 10秒前と縮み始め（毎回1度）、円の外にいる間は「あと何mで中」
    if (this.t < 1) this._zn = 0
    if (this.mode === 'play' && this._zn < 1 && left <= 10 && left > 0) { this._zn = 1; this.toast('10秒後に円が縮み始める') }
    if (this.mode === 'play' && this._zn < 2 && left <= 0) { this._zn = 2; this.toast('円が縮み始めた') }
    const outD = Math.hypot(f.body.x - z.x, f.body.z - z.z) - z.r, zel = $('#zone')
    zel.classList.toggle('warn', f.alive && left <= 0 && outD > 0)
    zel.textContent = f.alive && left <= 0 && outD > 0 ? `円の外 あと ${Math.ceil(outD)}m で中へ` : this.dropOn && this.t < DROP.T ? '輸送機が島の上を飛んでいる' : left > 0 ? `円が縮むまで ${Math.ceil(left)}` : this.t < z.t1 ? '円が縮んでいる' : ''
    // 握っている時間
    const ring = $('#fuse')
    if (f.cooking) { ring.classList.add('on'); const k = Math.max(0, f.cooking.fuse / BOMB[f.cooking.type].fuse); ring.style.setProperty('--k', k); ring.querySelector('span').textContent = f.cooking.fuse.toFixed(1) }
    else ring.classList.remove('on')
    // 投げ返しの案内
    let near = false
    if (f.alive && !f.cooking) for (const b of this.bombs) if (b.alive && !b.held && !b.stuck && b.type !== 'smoke' && b.type !== 'molotov' && Math.hypot(b.x - f.body.x, b.z - f.body.z) < 2.2) near = true
    $('#prompt').classList.toggle('on', near)
    const V = f.vehicle || this.veh, fh = $('#fhint')
    const nearCar = f.alive && !f.vehicle && !!this.nearVeh(f)
    fh.classList.toggle('on', !!(nearCar || f.vehicle) && !near); fh.classList.toggle('drv', !!f.vehicle); fh.querySelector('span').textContent = f.vehicle ? '降りる' : '乗る'
    $('#vhp').classList.toggle('on', !!f.vehicle); if (f.vehicle) $('#vhp i').style.transform = `scaleX(${Math.max(0, V.hp / VEH.hp)})`
    if (f.vehicle && Snd && Snd.loops.engine && Snd.loops.engine.node) Snd.loops.engine.node.playbackRate.value = 0.55 + Math.abs(V.speed) / VEH.maxF * 1.1
    const stickies = this.bombs.some(b => b.alive && b.type === 'sticky' && b.owner === f && !b.held)
    $('#qhint').classList.toggle('on', stickies)
    $('#feed').innerHTML = this.feed.filter(e => this.t - e.t < 8).map(e => `<li>${e.a ? `<span>${e.a}</span>` : ''}<i>${e.tag || '×'}</i><span>${e.b}</span></li>`).join('')
    $('#spec').classList.toggle('on', !f.alive && !this.over); $('#spec').textContent = this.online ? '観戦中' : `観戦中　${this.keymap.label('again')} でもう一回`
    if (this.online) this.online.hud()
  }
  showResult() {
    this.resultShown = true
    const f = this.player, rank = f.alive ? 1 : this.fighters.filter(x => x.alive).length + 1
    const r = $('#result')
    r.querySelector('.rank').textContent = this.winner === f ? '最後のひとり' : `${rank}位`
    r.querySelector('.sub').textContent = this.winner === f ? 'NO GUNS. ONE LEFT.' : (this.winner ? `勝ったのは ${this.winner.name}` : '')
    r.querySelector('.st').innerHTML = `<div><b>${f.kills}</b><span>倒した</span></div><div><b>${f.backs}</b><span>投げ返し</span></div><div><b>${this.stats.chainMax || 0}</b><span>最大の連鎖</span></div>`
    r.classList.add('show')
    document.exitPointerLock?.()
  }
}

Object.assign(Game.prototype, dropMethods)
window.__mb = moveBall
const game = new Game()
window.FI = game
game.init().catch(e => { console.error(e); const el = document.getElementById('err'); if (el) { el.textContent = '読み込みに失敗しました: ' + e.message; el.style.display = 'block' } })
// 検証用: 視点と位置を決める
game.dbg = {
  view(yaw, pitch) { game.camYaw = yaw; game.camPitch = pitch; game.camReady = false },
  tp(x, y, z) { const B = game.player.body; if (game.player.air) { game.player.air = null; game.clearAir(game.player); game.player.char.root.visible = true }; B.x = x; B.y = y; B.z = z; B.vx = B.vy = B.vz = 0; game.camReady = false },
  cam(px, py, pz, tx, ty, tz) { game.freeCam = px == null ? null : [px, py, pz, tx, ty, tz] }, // 検証用: 好きな所から撮る
  freeze(on) { for (const f of game.fighters) if (f.bot) f.bot.off = on },
}
// 検証用: 画面を描かずに秒数ぶん進める（CPU だけで戦わせる）
game.dbg.run = (sec, opts = {}) => {
  const g = game
  if (opts.botsOnly) { const p = g.player; p.body.x = 28; p.body.z = 29; p.hp = 1e9; p.ghost = true; p.air = null; g.clearAir(p); p.char.root.visible = true }
  const n = Math.round(sec * 60)
  const track = g.fighters.map(f => ({ name: f.name, moved: 0, last: [f.body.x, f.body.z], still: 0, maxStill: 0 }))
  let firstSee = null, firstThrow = null, decidedAt = null
  const start = g.fighters.filter(f => !f.ghost).map(f => [Math.round(f.body.x), Math.round(f.body.z)])
  for (let i = 0; i < n && !g.over; i++) {
    g.step(1 / 60)
    if (i % 15 === 0) { if (firstSee == null && g.fighters.some(f => f.bot && f.alive && !f.ghost && f.bot.target)) firstSee = +g.t.toFixed(1); if (firstThrow == null && g.ev.throws > 0) firstThrow = +g.t.toFixed(1); if (decidedAt == null && g.fighters.filter(f => f.alive && !f.ghost).length <= 1) decidedAt = +g.t.toFixed(1) }
    if (i % 30 === 0) g.fighters.forEach((f, k) => { const t = track[k]; const d = Math.hypot(f.body.x - t.last[0], f.body.z - t.last[1]); t.moved += d; t.last = [f.body.x, f.body.z]; if (f.alive && d < 0.2 && !f.ghost) { t.still++; if (t.still > t.maxStill) { t.maxStill = t.still; t.where = [Math.round(f.body.x * 10) / 10, Math.round(f.body.y * 10) / 10, Math.round(f.body.z * 10) / 10, f.bot && f.bot.path ? f.bot.path.length : -1, f.bot && f.bot.goal ? f.bot.goal.map(Math.round) : null, f.inv.frag + f.inv.smoke + f.inv.sticky, f.bot && f.bot.target ? f.bot.target.name : null] } } else t.still = 0 })
  }
  const gf = g.fighters.filter(f => !f.ghost), landed = gf.filter(f => f.landAt)
  return { land: landed.map(f => [Math.round(f.landAt.x), Math.round(f.landAt.z), +f.landAt.t.toFixed(1)]), jump: gf.filter(f => f.jumpAt).map(f => [Math.round(f.jumpAt.x), Math.round(f.jumpAt.z), +f.jumpAt.t.toFixed(1)]), inAir: gf.filter(f => f.air).length, dead: gf.filter(f => !f.alive).length, path: g.path, firstSee, firstThrow, decidedAt, start, t: +g.t.toFixed(1), over: g.over, winner: g.winner && g.winner.name, ev: g.ev, fighters: g.fighters.map((f, k) => ({ n: f.name, hp: Math.round(f.hp), alive: f.alive, kills: f.kills, moved: Math.round(track[k].moved), maxStillSec: track[k].maxStill / 2, where: track[k].where, inv: { ...f.inv } })) }
}
