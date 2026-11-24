// オンライン対戦: あいことばの部屋に集まり、部屋の主（ホスト）の画面が試合を計算する。
// 主は 20回/秒で状態を配り、参加者は入力と操作（投げる・拾う・乗る）を送る。
// 参加者の自分の動きは先読みで動かし、主の答えとのずれを少しずつ詰める。
import * as THREE from 'three'
import { moveBody } from './collide.js?v=mwur1e4h'
import { bombMesh, mineLook, TYPES } from './bombs.js?v=mwur1e4h'
import { Bot } from './bots.js?v=mwur1e4h'
import { AIR_CODE, AIR_MODE } from './drop.js?v=mwur1e4h'

const $ = s => document.querySelector(s)
const r2 = v => Math.round(v * 100) / 100
const r3 = v => Math.round(v * 1000) / 1000
const lerp = (a, b, k) => a + (b - a) * k
const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k
const SNAP_EVERY = 3        // 60コマ/秒の 3 コマごと = 20回/秒
const INTERP_MS = 110       // 他の人は少し前の姿を、2つの知らせの間でなめらかに見せる
const KINDS = ['frag', 'smoke', 'sticky', 'armor', 'med', 'molotov', 'mine'] // 番号がずれないよう新しい種類は最後に足す
const ERRS = { not_found: 'その部屋は見つかりません', full: '満員です（4人まで）', started: 'もう試合が始まっています。終わるまで待ってください', bad_name: '名前を入れてください', busy: '今は部屋を作れません', no_room: '部屋がありません', not_host: '部屋の主だけができます' }
const store = { get(k) { try { return localStorage.getItem(k) } catch { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch {} } }
const sess = { get(k) { try { return sessionStorage.getItem(k) } catch { return null } }, set(k, v) { try { sessionStorage.setItem(k, v) } catch {} } }

// ---------- つなぐ口（切れたら自動でつなぎ直す） ----------
class Conn {
  constructor(onMsg, onState) { this.onMsg = onMsg; this.onState = onState; this.ws = null; this.want = false; this.tries = 0; this.q = [] }
  url() { const Q = new URLSearchParams(location.search); return Q.get('ws') || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` }
  open() {
    this.want = true
    if (this.ws && this.ws.readyState <= 1) return
    let ws; try { ws = new WebSocket(this.url()) } catch (e) { this.onState('fail'); return }
    this.ws = ws
    ws.onopen = () => { this.tries = 0; ws.send(JSON.stringify({ t: 'hello', id: sess.get('fi_id'), token: sess.get('fi_tok') })); this.onState('open') }
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data) } catch { return }
      if (m.t === 'session') { sess.set('fi_id', m.id); sess.set('fi_tok', m.token); return }
      if (m.t === 'hi') { this.id = m.id; const q = this.q; this.q = []; for (const x of q) this.send(x) }
      this.onMsg(m)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null; this.id = null
      if (!this.want) return
      this.onState('lost')
      if (++this.tries > 15) { this.onState('fail'); return }
      setTimeout(() => this.want && this.open(), Math.min(4000, 500 * this.tries))
    }
  }
  close() { this.want = false; if (this.ws) { const w = this.ws; this.ws = null; w.close() } }
  ready() { return !!(this.ws && this.ws.readyState === 1 && this.id) }
  send(m) { if (this.ready()) this.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); else if (typeof m !== 'string' && m.t !== 'in') this.q.push(m) }
}

export class Online {
  constructor(game) {
    this.g = game
    this.role = null; this.id = null; this.code = null; this.roster = null; this.seed = null; this.players = []
    this.conn = new Conn(m => this.onMsg(m), s => this.onConn(s))
    this.ui()
  }

  // ---------- タイトルとロビーの画面 ----------
  ui() {
    const Q = new URLSearchParams(location.search)
    const nm = $('#oname'), cd = $('#ocode')
    nm.value = store.get('fi_name') || ''
    if (Q.get('room')) { cd.value = Q.get('room').toUpperCase().slice(0, 4); $('#title').classList.add('joining') }
    cd.addEventListener('input', () => { cd.value = cd.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })
    const name = () => { const v = nm.value.trim(); if (!v) { this.err('名前を入れてください'); nm.focus(); return null } store.set('fi_name', v); return v }
    $('#omake').addEventListener('click', () => { const n = name(); if (!n) return; this.err(''); this.pending = 'host'; this.conn.open(); this.conn.send({ t: 'create', name: n }) })
    $('#ojoin').addEventListener('click', () => {
      const n = name(); if (!n) return
      if (cd.value.length !== 4) { this.err('あいことば（4文字）を入れてください'); cd.focus(); return }
      this.err(''); this.pending = 'guest'; this.conn.open(); this.conn.send({ t: 'join', code: cd.value, name: n })
    })
    cd.addEventListener('keydown', e => { if (e.key === 'Enter') $('#ojoin').click() })
    $('#lstart').addEventListener('click', () => { this.conn.send({ t: 'start', seed: Math.floor(Math.random() * 1e9) }) })
    $('#lleave').addEventListener('click', () => this.end(''))
    $('#lcopy').addEventListener('click', () => { const u = this.joinUrl(); try { navigator.clipboard.writeText(u); $('#lcopy').textContent = '写しました' ; setTimeout(() => { $('#lcopy').textContent = 'URL を写す' }, 1400) } catch {} })
  }
  err(t) { $('#oerr').textContent = t }
  joinUrl() { return `${location.origin}${location.pathname}?room=${this.code}` }
  showLobby(on) { $('#lobby').classList.toggle('show', on); if (on) $('#title').classList.add('gone') }
  drawLobby() {
    $('#lcode').textContent = this.code || '----'
    $('#lurl').textContent = this.code ? this.joinUrl() : ''
    const host = this.hostId === this.id
    $('#lplayers').innerHTML = [0, 1, 2, 3].map(s => { const p = this.players.find(p => p.slot === s); return p ? `<li class="${p.online ? '' : 'off'}${p.id === this.id ? ' me' : ''}"><b>${s === 0 ? '主' : s + 1}</b>${esc(p.name)}${p.online ? '' : '<i>回線待ち</i>'}</li>` : `<li class="cpu"><b>${s + 1}</b>空き（CPU が入る）</li>` }).join('')
    $('#lstart').hidden = !host
    $('#lnote').textContent = host ? '人がそろったら「はじめる」。空いた席は CPU が入って 50人になります' : '部屋の主が始めるのを待っています'
  }

  // ---------- 知らせ ----------
  onConn(s) {
    const st = $('#onet')
    if (s === 'open') { st.className = ''; return }
    if (s === 'lost') {
      // 主の回線が切れても、試合はこの画面で続ける。サーバーは 15秒 席を残すので、その間につなぎ直す
      if (this.role === 'host' && this.inMatch) for (const f of this.g.fighters) if (f.remote) { f.input = { mx: 0, mz: 0 }; f.vin = null }
      st.textContent = 'つなぎ直しています'; st.className = 'on'
    }
    if (s === 'fail') { st.className = ''; if (this.role || this.pending) this.end('サーバーにつながりませんでした') ; else this.err('サーバーにつながりませんでした') }
  }
  onMsg(m) {
    const g = this.g
    switch (m.t) {
      case 'hi': this.id = m.id; break
      case 'created': case 'joined':
        if (m.error) { this.err(ERRS[m.error] || m.error); this.pending = null; return }
        this.code = m.code; this.role = this.role || this.pending; this.pending = null; g.online = this
        if (!this.inMatch) this.showLobby(true)
        this.drawLobby()
        break
      case 'roster':
        this.code = m.code; this.hostId = m.hostId; this.players = m.players
        if (!this.role) { this.role = m.hostId === this.id ? 'host' : 'guest'; g.online = this }
        this.drawLobby()
        break
      case 'start': this.begin(m); break
      case 'closed': this.end(m.why === 'host_left' ? '部屋の主が抜けたので、部屋を閉じました' : m.why === 'flood' ? '操作の送りすぎで部屋から外れました' : '部屋が閉じられました'); break
      case 'noroom': if (this.inMatch || this.code) this.end(this.role === 'host' ? '回線が戻るまでに時間がかかり、部屋が閉じました' : '部屋が閉じられました'); break
      case 'hostwait': this.hostWait = performance.now(); this.hostWaitN = (this.hostWaitN || 0) + 1; this.hostWaitMsg = '部屋の主の回線が切れました'; break
      case 'hostback': this.hostWait = 0; break
      case 'error': this.err(ERRS[m.e] || m.e); break
      case 'snap': this.onSnap(m); break
      case 'in': this.hostIn(m); break
      case 'act': this.hostAct(m); break
      case 'gone': this.hostGone(m.id); break
      case 'back': this.hostBack(m.id); break
    }
  }

  // ---------- 試合の始まりと終わり ----------
  begin(m) {
    const g = this.g
    this.role = m.hostId === this.id ? 'host' : 'guest'
    this.roster = [...m.roster].sort((a, b) => a.slot - b.slot)
    this.seed = m.seed
    g.online = this
    this.hostWait = 0
    this.snaps = []; this.ev = []; this.tick = 0; this.seq = 0; this.hist = []; this.corr = { x: 0, y: 0, z: 0 }; this.bmap = new Map(); this.lastSnapAt = performance.now()
    g.over = false
    g.newMatch()
    this.itemBase = g.items.length
    this.inMatch = true
    if (this.role === 'host') this.wrapHost()
    this.showLobby(false)
    $('#title').classList.add('gone'); $('#onet').className = ''
    g.mode = 'play'; g.started = true; g.startAudio(); g.camReady = false
    if (g.player && !g.dropOn) g.camYaw = Math.atan2(-g.player.body.x, -g.player.body.z) + Math.PI
    $('#result').classList.remove('show'); $('#result').classList.toggle('guest', this.role === 'guest')
    g.lock()
  }
  again() { if (this.role === 'host') this.conn.send({ t: 'start', seed: Math.floor(Math.random() * 1e9) }) }
  end(msg) {
    const g = this.g
    this.conn.send({ t: 'leave' }); this.conn.close()
    this.role = null; this.code = null; this.inMatch = false; this.pending = null; this.players = []
    g.online = null
    this.showLobby(false)
    g.over = false; g.newMatch(); g.mode = 'title'; g.started = false
    $('#title').classList.remove('gone'); $('#onet').className = ''
    $('#result').classList.remove('show', 'guest')
    $('#oinfo').textContent = ''; $('#tags').innerHTML = ''
    if (this.driving && window.Snd) { window.Snd.loop('engine', null, 0, 0.3) } this.driving = false
    for (const o of (this.bmap || new Map()).values()) g.scene.remove(o.mesh)
    this.bmap = new Map()
    document.exitPointerLock?.()
    this.err(msg || '')
  }

  // ---------- 主の側 ----------
  wrapHost() {
    const g = this.g, fx = g.fx
    if (!fx.__wrapped) {
      fx.__wrapped = true
      for (const m of ['explosion', 'fire', 'smokeBomb', 'splash', 'groundFire']) {
        const o = fx[m].bind(fx)
        fx[m] = (pos, ...a) => {
          if (g.online && g.online.role === 'host' && g.mode === 'play') {
            const ex = m === 'explosion' ? [a[0], a[1] && a[1].groundY != null ? r2(a[1].groundY) : null] : m === 'fire' ? [a[0]] : m === 'groundFire' ? [a[0], a[1]] : []
            g.online.pushEv({ k: 'fx', m, p: [r2(pos.x), r2(pos.y), r2(pos.z)], a: ex })
          }
          return o(pos, ...a)
        }
      }
    }
    for (const f of g.fighters) for (const m of ['windup', 'throwNow', 'pick', 'punch', 'knock', 'flinch', 'die', 'dive']) {
      const c = f.char, o = c[m].bind(c)
      c[m] = v => { this.pushEv({ k: 'a', f: f.nid, a: m, v: v === undefined ? undefined : !!v }); return o(v) }
    }
    const gl = g.level.glasses || []
    for (let i = 0; i < gl.length; i++) gl[i].i = i
  }
  pushEv(e) { if (this.inMatch && this.ev.length < 400) this.ev.push(e) }
  pushSound(n, at, v, o) { if (this.inMatch) this.pushEv({ k: 's', n, p: [r2(at.x), r2(at.y || 0), r2(at.z)], v: r2(v), far: o && o.far ? 1 : 0 }) }
  fighterBySid(id) { return this.g.fighters.find(f => f.sid === id) }
  hostIn(m) {
    const f = this.fighterBySid(m.from); if (!f || f.offline) return
    const c = (v, l) => Math.max(-l, Math.min(l, +v || 0))
    let mx = c(m.mx, 1), mz = c(m.mz, 1); const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l }
    f.input = f.vehicle ? { mx: 0, mz: 0 } : { mx, mz, run: !!m.run, jump: !!m.jump, crouch: !!m.crouch }
    f.aimYaw = c(m.ay, 1e4); f.aimPitch = c(m.ap, 1.2); f.aimR = !!m.ar
    f.vin = Array.isArray(m.vin) ? { throttle: c(m.vin[0], 1), steer: c(m.vin[1], 1), hand: !!m.vin[2] } : null
    f.ack = Math.max(f.ack || 0, m.s | 0)
  }
  hostAct(m) {
    const g = this.g, f = this.fighterBySid(m.from)
    if (!f || f.offline || g.mode !== 'play' || g.over) return
    switch (m.a) {
      case 'pin': if (TYPES.includes(m.type)) f.sel = m.type; if (!f.vehicle && f.alive) g.pullPin(f); break
      case 'rel': {
        if (!f.cooking || !Array.isArray(m.v)) break
        let v = [0, 1, 2].map(i => Math.max(-22, Math.min(22, +m.v[i] || 0))); const l = Math.hypot(...v); if (l > 20.5) v = v.map(x => x * 20.5 / l)
        g.release(f, v); break
      }
      case 'pick': g.tryPickup(f); break
      case 'veh': if (f.air) g.airAct(f); else if (f.vehicle) g.exitVehicle(f); else g.enterVehicle(f); break
      case 'det': g.detonateSticky(f); break
    }
  }
  hostGone(id) {
    const g = this.g, f = this.fighterBySid(id); if (!f || f.offline) return
    f.offline = true; f.remote = false; f.input = { mx: 0, mz: 0 }
    if (f.cooking) g.release(f, [0, 1, 0])
    if (f.alive) f.bot = new Bot(f, g, g.rng, 1)
    if (f.air && !f.plan) f.plan = { x: f.body.x, z: f.body.z, jumpAt: g.t + 0.5 } // 空の上で回線が切れたら、CPU がすぐ降りてその下へ
    g.feed.unshift({ a: '', b: f.name, tag: '回線切れ・CPU が代わり', t: g.t }); g.hostEv({ k: 'feed', a: '', b: f.name, tag: '回線切れ・CPU が代わり' })
  }
  hostBack(id) {
    const g = this.g, f = this.fighterBySid(id); if (!f || !f.offline) return
    f.offline = false; f.remote = true; f.bot = null; f.input = { mx: 0, mz: 0 }
    g.feed.unshift({ a: '', b: f.name, tag: '戻ってきた', t: g.t }); g.hostEv({ k: 'feed', a: '', b: f.name, tag: '戻ってきた' })
  }
  hostTick() {
    if (!this.inMatch || ++this.tick % SNAP_EVERY) return
    const g = this.g
    const fi = g.fighters.map(f => {
      const B = f.body, ck = f.cooking
      return [r2(B.x), r2(B.y), r2(B.z), r2(B.vx), r2(B.vy), r2(B.vz), r2(f.yaw), Math.round(f.hp * 10) / 10, Math.round(f.armor), f.alive ? 1 : 0, r2(f.stun), B.crouch ? 1 : 0, B.onGround ? 1 : 0, f.vehicle ? g.vehs.indexOf(f.vehicle) + 1 : 0, ck ? TYPES.indexOf(ck.type) : -1, ck ? r2(ck.fuse) : 0, f.inv.frag, f.inv.smoke, f.inv.sticky, f.kills, f.backs, r2(B.airT), B.back ? 1 : 0, f.offline ? 1 : 0, f.inv.molotov || 0, f.inv.mine || 0, f.dive ? 1 : 0, f.air ? AIR_CODE[f.air.mode] : 0, f.air && f.air.mode === 'fall' && f.air.dive ? 1 : 0]
    })
    const bo = g.bombs.filter(b => b.alive).map(b => [b.id, TYPES.indexOf(b.type), r2(b.x), r2(b.y), r2(b.z), r2(b.fuse), b.held ? b.held.nid : -1, b.stuck ? 1 : 0, b.owner ? b.owner.nid : -1, b.type === 'mine' ? (b.trig ? 2 : b.armT > 0 ? 0 : 1) : 0])
    // 軽トラ（台数分）
    const msg = {
      t: 'snap', sd: this.seed, T: r2(g.t), f: fi, b: bo,
      vs: g.vehs.map(V => [r2(V.x), r2(V.z), r3(V.yaw), r2(V.speed), r3(V.steer), Math.round(V.hp), V.alive ? 1 : 0, V.driver ? V.driver.nid : -1]),
      it: g.items.slice(0, this.itemBase).map(it => it.gone > 0 ? 1 : 0).join(''),
      dr: g.items.slice(this.itemBase).map(it => [r2(it.x), r2(it.y), r2(it.z), KINDS.indexOf(it.kind), it.gone > 0 ? 1 : 0]),
      dm: g.level.drums.map(d => d.alive ? 1 : 0).join(''),
      gl: (g.level.glasses || []).map(x => x.alive ? 1 : 0).join(''),
      z: [r2(g.zone.x), r2(g.zone.z), g.zone.r0, g.zone.r1, g.zone.t0, g.zone.t1],
      sm: g.fx.smokes.map(s => [r2(s.x), r2(s.y), r2(s.z), r2(s.t), s.life]),
      ov: g.over ? [g.winner ? g.winner.nid : -1, g.stats.chainMax || 0] : 0,
      ack: Object.fromEntries(g.fighters.filter(f => f.remote).map(f => [f.nid, f.ack || 0])),
      ev: this.ev,
    }
    this.ev = []
    this.conn.send(JSON.stringify(msg))
  }

  // ---------- 参加者の側 ----------
  onSnap(m) {
    if (!this.inMatch || this.role !== 'guest') return
    if (m.sd !== this.seed) return // 前の試合の知らせが遅れて届いた
    const now = performance.now()
    m.at = now; this.lastSnapAt = now
    this.snaps.push(m); if (this.snaps.length > 40) this.snaps.shift()
    // 自分の先読みと主の答えを比べる（主が受け取った入力の番号の時点で）
    const me = this.g.player, s = m.f[me.nid], ack = m.ack && m.ack[me.nid]
    if (s && ack) {
      const h = this.hist.find(h => h.s === ack)
      if (h) {
        const ex = s[0] - h.x, ey = s[1] - h.y, ez = s[2] - h.z
        if (Math.hypot(ex, ez) > 3 || Math.abs(ey) > 2.5) { this.snapTo = s } else { this.corr = { x: ex, y: Math.abs(ey) > 0.4 ? ey : 0, z: ez } }
        this.hist = this.hist.filter(x => x.s > ack)
      }
    }
  }
  sendInput() {
    const g = this.g, f = g.player, i = f.input || {}
    this.seq++
    this.conn.send({ t: 'in', s: this.seq, mx: r3(i.mx || 0), mz: r3(i.mz || 0), run: i.run ? 1 : 0, jump: i.jump ? 1 : 0, crouch: i.crouch ? 1 : 0, ay: r3(f.aimYaw), ap: r3(g.camPitch), ar: g.mouse.r ? 1 : 0, vin: f.vin ? [f.vin.throttle, f.vin.steer, f.vin.hand ? 1 : 0] : null })
  }
  act(m) { this.conn.send({ t: 'act', ...m }) }

  guestStep(dt) {
    const g = this.g
    if (g.mode !== 'play' || !this.inMatch) return
    if (!this.snaps.length) return
    const me = g.player
    if (me.alive) g.playerInput(); else me.input = { mx: 0, mz: 0 }
    if (++this.tick % 2 === 0) this.sendInput()
    // いつの姿を見せるか
    const rt = performance.now() - INTERP_MS
    let a = this.snaps[0], b = a
    for (let i = 0; i < this.snaps.length; i++) { if (this.snaps[i].at <= rt) a = this.snaps[i]; else { b = this.snaps[i]; break } b = this.snaps[i] }
    const k = b === a ? 1 : Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at)))
    // 時刻の来た知らせの出来事を出す
    for (const s of this.snaps) if (!s.done && s.at <= rt) { s.done = true; for (const e of s.ev || []) this.applyEv(e) }
    const L = this.snaps[this.snaps.length - 1]
    g.t = lerp(a.T, b.T, k)
    // 人
    for (const f of g.fighters) {
      const A = a.f[f.nid], Bn = b.f[f.nid], S = L.f[f.nid]; if (!A || !Bn) continue
      const B = f.body
      const hp0 = f.hp
      f.hp = S[7]; f.armor = S[8]; f.inv.frag = S[16]; f.inv.smoke = S[17]; f.inv.sticky = S[18]; f.kills = S[19]; f.backs = S[20]; f.offline = !!S[23]; f.inv.molotov = S[24] || 0; f.inv.mine = S[25] || 0; f.dive = S[26] ? { t: 0 } : null
      if (f === me && f.hp < hp0 - 0.5) g.hurtK = Math.min(1, (g.hurtK || 0) + (hp0 - f.hp) / 60)
      const wasAlive = f.alive; f.alive = !!S[9]
      if (wasAlive && !f.alive) f.char.die()
      const inVeh = !!S[13], ac = S[27] | 0 // 降下: 0 地上・1 輸送機・2 落下・3 傘
      f.vehicle = inVeh ? g.vehs[S[13] - 1] || null : null; f.char.root.visible = !inVeh && ac !== 1
      if (ac) { if (!f.air || f.air.mode !== AIR_MODE[ac]) f.air = { mode: AIR_MODE[ac], t: 0 }; f.air.dive = !!S[28] } else if (f.air || f.chute || f.char.air) { f.air = null; g.clearAir(f) }
      f.stun = S[10]
      const predict = f === me && f.alive && !inVeh && !ac && S[10] < 0.05 && !this.snapTo && !S[26] // 飛び込みの間は主の動きをそのまま見る
      if (predict) this.predictMe(dt)
      else {
        if (f === me) { this.hist = []; this.corr = { x: 0, y: 0, z: 0 }; this.snapTo = null }
        B.x = lerp(A[0], Bn[0], k); B.y = lerp(A[1], Bn[1], k); B.z = lerp(A[2], Bn[2], k)
        B.vx = lerp(A[3], Bn[3], k); B.vy = lerp(A[4], Bn[4], k); B.vz = lerp(A[5], Bn[5], k)
        B.crouch = !!Bn[11]; B.onGround = !!Bn[12]; B.airT = Bn[21]; B.back = !!Bn[22]
        f.yaw = lerpA(A[6], Bn[6], k)
      }
      f.char.yaw = f.yaw
      if (ac > 1) g.syncAir(f, dt)
      f.char.lookYaw = f === me ? f.aimYaw : null; f.char.lookPitch = f === me ? g.camPitch : 0
      f.char.aimPitch = f === me && f.cooking ? g.camPitch : 0
      if (ac !== 1) f.char.update(dt, B)
      // 握っている爆弾
      // 導火線の残りは最後の知らせから経った分を引いて数える
      f.cooking = S[14] >= 0 ? { type: TYPES[S[14]], fuse: Math.max(0, S[15] - (performance.now() - L.at) / 1000) } : null
    }
    if (me.cooking) g.pinSent = false
    // 爆弾
    const seen = new Set(), tmp = new THREE.Vector3()
    const aB = new Map(a.b.map(x => [x[0], x]))
    for (const x of b.b) {
      seen.add(x[0])
      let o = this.bmap.get(x[0])
      if (!o) { o = { id: x[0], type: TYPES[x[1]], alive: true, mesh: bombMesh(TYPES[x[1]]) }; g.scene.add(o.mesh); this.bmap.set(x[0], o) }
      const p = aB.get(x[0]) || x
      o.x = lerp(p[2], x[2], k); o.y = lerp(p[3], x[3], k); o.z = lerp(p[4], x[4], k); o.fuse = x[5]
      o.held = x[6] >= 0 ? g.fighters[x[6]] : null; o.stuck = !!x[7]; o.owner = x[8] >= 0 ? g.fighters[x[8]] : null
      if (o.held && o.held.alive) { g.handPoint(o.held, tmp); o.x = tmp.x; o.y = tmp.y; o.z = tmp.z }
      o.mesh.position.set(o.x, o.y, o.z)
      if ((o.type === 'frag' || o.type === 'molotov') && Math.random() < dt * 30) g.fx.fuseSpark(new THREE.Vector3(o.x, o.y + (o.type === 'molotov' ? 0.2 : 0.12), o.z))
      if (o.type === 'mine') {
        o.trig = x[9] === 2; o.mesh.position.y -= 0.015
        const dm = Math.hypot(me.body.x - o.x, me.body.z - o.z)
        mineLook(o.mesh, x[9] | 0, o.owner === me, dm, g.t); o.mesh.visible = dm < 70
      }
      if (o.mesh.userData.led && o.type !== 'mine') o.mesh.userData.led.material.emissiveIntensity = (Math.sin(g.t * (o.fuse < 2 ? 30 : 12)) > 0) ? 7 : 0.3
    }
    for (const [id, o] of this.bmap) if (!seen.has(id)) { g.scene.remove(o.mesh); this.bmap.delete(id) }
    g.bombs = [...this.bmap.values()]
    // 軽トラ
    let drive = false
    if (b.vs && a.vs) for (const [i, V] of g.vehs.entries()) {
      if (!b.vs[i] || !a.vs[i]) continue
      const [x0, z0, y0] = a.vs[i], [x1, z1, y1, sp, st, hp, al, dn] = b.vs[i]
      V.x = lerp(x0, x1, k); V.z = lerp(z0, z1, k); V.yaw = lerpA(y0, y1, k); V.speed = sp; V.steer = st; V.hp = hp
      V.driver = dn >= 0 ? g.fighters[dn] : null
      if (V.alive && !al) { const burnt = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9, metalness: 0.2 }); V.mesh.traverse(m => { if (m.isMesh) m.material = burnt }) }
      V.alive = !!al
      V.wheelRot += V.speed * dt / 0.29
      for (const w of V.mesh.userData.wheels || []) { w.spin.rotation.z = -V.wheelRot; w.piv.rotation.y = w.front ? -V.steer : 0 }
      V.settle(); V.sync()
      if (V.driver === me) drive = true
    }
    if (drive !== this.driving) { this.driving = drive; if (window.Snd && g.audioOn) window.Snd.loop('engine', drive ? 'snd/engine.mp3' : null, drive ? 0.22 : 0, 0.3) }
    // 拾う物・ドラム缶・窓・円
    for (let i = 0; i < this.itemBase && i < L.it.length; i++) { const it = g.items[i], gone = L.it[i] === '1'; if (gone !== it.gone > 0) { it.gone = gone ? 1e9 : 0; it.mesh.visible = !gone } }
    L.dr.forEach((d, j) => {
      let it = g.items[this.itemBase + j]
      if (!it) { g.addItem(d[0], d[1], d[2], KINDS[d[3]]); it = g.items[g.items.length - 1]; it.drop = true; if (Math.hypot(d[0] - me.body.x, d[2] - me.body.z) < 40) g.toast('補給が落ちた') }
      const gone = !!d[4]; if (gone !== it.gone > 0) { it.gone = gone ? 1e9 : 0; it.mesh.visible = !gone }
    })
    g.level.drums.forEach((d, i) => { const al = L.dm[i] !== '0'; if (d.alive && !al) { d.alive = false; d.box.dead = true; if (d.mesh) d.mesh.visible = false } })
    ;(g.level.glasses || []).forEach((x, i) => { if (x.alive && L.gl[i] === '0') { g._quiet = true; g.breakGlass(x); g._quiet = false } })
    // 出ている煙: 途中で戻った人は煙の出来事を受け取っていないので、状態から足す（出たばかりの煙は出来事の方で出るので 0.5秒 待つ）
    if (L.sm) for (const [x, y, z, t, life] of L.sm) {
      if (t < 0.5) continue
      const tt = t + (performance.now() - L.at) / 1000
      if (!g.fx.smokes.some(s => Math.abs(s.x - x) < 0.6 && Math.abs(s.z - z) < 0.6)) g.fx.smokes.push({ x, y, z, r: Math.min(5.2, 0.5 + tt * 2.2), t: tt, life, emit: 0 })
    }
    if (L.z) { const z = g.zone; z.x = L.z[0]; z.z = L.z[1]; z.r0 = L.z[2]; z.r1 = L.z[3]; z.t0 = L.z[4]; z.t1 = L.z[5] }
    g.fx.update(dt)
    g.updateZone(dt)
    for (const it of g.items) if (it.gone > 0 && it.gone < 1e8) { it.gone -= dt; if (it.gone <= 0) it.mesh.visible = true }
    // 決着
    if (L.ov && !g.over) { g.over = true; g.overT = 0; g.winner = L.ov[0] >= 0 ? g.fighters[L.ov[0]] : null; g.stats.chainMax = L.ov[1] }
    if (g.over) { g.overT += dt; if (g.overT > 2.2 && !g.resultShown) g.showResult() }
    // 主から届かない
    const quiet = performance.now() - this.lastSnapAt > 2500
    $('#onet').className = quiet || this.hostWait ? 'on' : ''
    if (this.hostWait) $('#onet').textContent = `部屋の主の回線が切れました。戻るのを待っています（あと ${Math.max(0, Math.ceil(15 - (performance.now() - this.hostWait) / 1000))}秒）`
    else if (quiet) $('#onet').textContent = '部屋の主からの知らせが止まっています'
  }
  // 自分だけは手元で先に動かす（主の答えは後から少しずつ合わせる）
  predictMe(dt) {
    const g = this.g, f = g.player, B = f.body, inp = f.input || {}
    if (this.snapTo) { const s = this.snapTo; B.x = s[0]; B.y = s[1]; B.z = s[2]; B.vx = s[3]; B.vy = s[4]; B.vz = s[5]; this.snapTo = null; this.hist = [] }
    B.crouch = !!inp.crouch && B.onGround
    const holding = !!f.cooking
    const backIn = Math.sin(f.yaw) * (inp.mx || 0) + Math.cos(f.yaw) * (inp.mz || 0) < -0.3 * Math.hypot(inp.mx || 0, inp.mz || 0) // 主と同じ式（後ろ向きは 0.75倍）
    const maxS = (B.crouch ? 1.7 : holding ? 3.0 : inp.run ? 6.2 : 4.4) * (backIn ? 0.75 : 1)
    const tx = (inp.mx || 0) * maxS, tz = (inp.mz || 0) * maxS
    const ctl = B.onGround ? 1 : 0.12, kk = Math.min(1, dt * 12 * ctl)
    if (B.onGround) { B.vx += (tx - B.vx) * kk; B.vz += (tz - B.vz) * kk } else { B.vx += (tx - B.vx) * kk * 0.5; B.vz += (tz - B.vz) * kk * 0.5 }
    if (inp.jump && B.onGround) { B.vy = 5.4; B.onGround = false }
    B.vy -= 20 * dt
    B.h = B.crouch ? 1.25 : 1.75
    moveBody(g.world, B, dt)
    B.airT = B.onGround ? 0 : (B.airT || 0) + dt
    // 主とのずれを少しずつ詰める
    const c = this.corr, q = 0.12
    B.x += c.x * q; B.y += c.y * q; B.z += c.z * q
    for (const h of this.hist) { h.x += c.x * q; h.y += c.y * q; h.z += c.z * q }
    c.x *= 1 - q; c.y *= 1 - q; c.z *= 1 - q
    this.hist.push({ s: this.seq, x: B.x, y: B.y, z: B.z }); if (this.hist.length > 240) this.hist.shift()
    // 向き
    const sp = Math.hypot(B.vx, B.vz)
    let want = f.yaw
    if (holding || g.mouse.r) want = f.aimYaw
    else if (sp > 0.6) want = Math.atan2(B.vx, B.vz)
    f.yaw = lerpA(f.yaw, want, Math.min(1, dt * (holding ? 16 : 10)))
    B.back = sp > 0.5 && (Math.sin(f.yaw) * B.vx + Math.cos(f.yaw) * B.vz) < -0.3 * sp
    // 足音
    if (B.onGround && sp > 1) { f.stepAcc += dt * sp * (B.crouch ? 0 : 0.55); if (f.stepAcc > 1) { f.stepAcc = 0; g.sound(B.groundY > 0.1 || B.z < -20 ? 'wstep' : 'step', B, 0.18) } }
  }
  applyEv(e) {
    const g = this.g, me = g.player
    switch (e.k) {
      case 's': if (e.n === 'step' || e.n === 'wstep') { const f = g.fighters.find(f => f !== me && Math.abs(f.body.x - e.p[0]) < 1.5 && Math.abs(f.body.z - e.p[2]) < 1.5); if (!f) return } g.sound(e.n, { x: e.p[0], y: e.p[1], z: e.p[2] }, e.v, { far: !!e.far }); break
      case 'fx': {
        const p = new THREE.Vector3(e.p[0], e.p[1], e.p[2])
        if (e.m === 'explosion') {
          g.fx.explosion(p, e.a[0], { groundY: e.a[1] })
          const cd = g.camera.position.distanceTo(p)
          g.fx.shake = Math.min(1.2, g.fx.shake + e.a[0] * 9 / (cd + 3))
          g.flashK = Math.max(g.flashK || 0, Math.min(0.12, 2 / (cd * cd + 8)))
        } else if (e.m === 'fire') g.fx.fire(p, e.a[0]); else if (e.m === 'groundFire') g.fx.groundFire(p, e.a[0], e.a[1]); else g.fx[e.m](p)
        break
      }
      case 'a': { const f = g.fighters[e.f]; if (f && f.char[e.a]) f.char[e.a](e.v); break }
      case 'cue': if (e.to === me.nid) g.cueLocal(e.c, e.a); break
      case 'feed': g.feed.unshift({ a: e.a, b: e.b, tag: e.tag, t: g.t }); if (g.feed.length > 5) g.feed.pop(); break
      case 'ban': g.banner(e.a[0], e.a[1]); break
    }
  }

  // ---------- 画面の上 ----------
  hud() {
    const g = this.g
    $('#oinfo').textContent = this.code ? `部屋 ${this.code}` : ''
    const tags = []
    if (g.mode === 'play') for (const f of g.fighters) {
      if (!f.human || f === g.player || !f.alive || f.vehicle) continue
      const p = new THREE.Vector3(f.body.x, f.body.y + 2.15, f.body.z).project(g.camera)
      if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) continue
      const d = g.camera.position.distanceTo(new THREE.Vector3(f.body.x, f.body.y, f.body.z)); if (d > 60) continue
      if (g.fx.blocked(g.camera.position, { x: f.body.x, y: f.body.y + 1.2, z: f.body.z }) || g.fx.inSmoke(f.body)) continue // 煙の向こう・中の人は名前も隠す
      tags.push(`<b class="${f.offline ? 'off' : ''}" style="left:${(p.x * 0.5 + 0.5) * innerWidth}px;top:${(-p.y * 0.5 + 0.5) * innerHeight}px">${esc(f.name)}</b>`)
    }
    $('#tags').innerHTML = tags.join('')
  }
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) }
