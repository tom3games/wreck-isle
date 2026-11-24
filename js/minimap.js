// 左上の小さな地図（島の古い案内図のような紙の色）。島・川・道・建物は起動時に1回だけ画像に描き、毎コマは自分の向き（矢印）と円だけを重ねる。
// 北が上で固定。敵の位置は出さない（読み合いが芯のため）。
import { ROADS } from './southmap.js?v=mwuunvpt'
import { L as tr } from './i18n.js?v=mwuunvpt'
import { ROADS2, TRAIL, BRIDGES2 } from './bigmap.js?v=mwuunvpt'
import { planeAt, DROP } from './plane.js?v=mwuunvpt'

// 島全体（50人用に広げた 2026-11-23）は 1m=0.8px で1枚に描いておき、画面には自分のまわり VIEW m だけを切り出して見せる
const X0 = -340, X1 = 340, Z0 = -96, Z1 = 608, KB = 0.8, VIEW = 230
const INK = '#4b3d2c'

export class Minimap {
  constructor(game, host) {
    this.g = game
    this.cv = document.createElement('canvas'); this.cv.id = 'map'; host.appendChild(this.cv)
    this.ctx = this.cv.getContext('2d')
    this.size()
    window.addEventListener('resize', () => this.size())
    this.skip = 0
  }
  // 画面の大きさに合わせる: 高さは画面の 3 割（PC 720 なら約 216px、スマホ横 390 なら約 117px）
  size() {
    const h = Math.round(Math.max(96, Math.min(224, Math.min(innerHeight * 0.31, innerWidth * 0.4))))
    const w = Math.round(h * 0.95), dpr = Math.min(2, window.devicePixelRatio || 1)
    this.h = h; this.w = w; this.k = h / VIEW // 画面の 1m あたりの px
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr)
    this.dpr = dpr
  }
  bake() {
    const g = this.g, W = g.world, k = KB, w = Math.round((X1 - X0) * KB), h = Math.round((Z1 - Z0) * KB)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data
    const put = (i, r, gg, b) => { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255 }
    const tmp = []
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const wx = X0 + (px + 0.5) / k, wz = Z0 + (py + 0.5) / k, i = (py * w + px) * 4
      const th = W.H(wx, wz)
      let kind = 'sea', hh = 0
      if (th > -0.5) { kind = 'land'; hh = th }
      let road = false, bld = false, pave = false
      const near = W.near(wx - 0.1, wz - 0.1, wx + 0.1, wz + 0.1, tmp)
      for (const b of near) {
        if (b.dead || b.kind === 'nocol' || b.kind === 'edge' || b.kind === 'glass') continue
        if (wx < b.min[0] || wx > b.max[0] || wz < b.min[2] || wz > b.max[2]) continue
        if (b.tag === 'tree' || b.tag === 'drum') continue
        if (b.max[1] > 2.4 && b.min[1] < 1.2 && b.max[1] < 14) bld = true
        else if (b.max[1] > -0.4 && b.max[1] < 0.8) { pave = true; if (b.mat === 'road') road = true }
      }
      if (kind === 'sea' && pave) kind = 'land'
      if (kind === 'sea') {
        const v = 0.5 + 0.5 * Math.sin(wx * 0.7 + wz * 0.35) * Math.sin(wz * 0.5 - wx * 0.2)
        put(i, 176 + v * 6, 192 + v * 6, 190 + v * 4); continue
      }
      // 陸: 紙の色。高い所は少し濃い茶（等高線ふうの帯）
      let r = 236, gg = 225, b = 196
      const band = Math.floor(hh / 4)
      if (hh > 1.5) { const t = Math.min(1, hh / 34); r -= 18 + 26 * t; gg -= 22 + 30 * t; b -= 30 + 36 * t; if (band % 2 === 0) { r += 5; gg += 5; b += 4 } }
      if (pave && !road) { r -= 10; gg -= 10; b -= 12 }
      if (road) { r = 168; gg = 150; b = 118 }
      if (bld) { r = 112; gg = 92; b = 70 }
      put(i, r, gg, b)
    }
    x.putImageData(img, 0, 0)
    // 南の道（ribbon で描いているので線で）
    x.lineCap = 'round'; x.lineJoin = 'round'
    for (const pts of [...Object.values(ROADS), ...Object.values(ROADS2).map(r => r.pts), ...BRIDGES2.map(b => [b.a, b.b])]) {
      x.beginPath(); pts.forEach(([wx, wz], j) => { const px = (wx - X0) * k, py = (wz - Z0) * k; j ? x.lineTo(px, py) : x.moveTo(px, py) })
      x.strokeStyle = 'rgb(168,150,118)'; x.lineWidth = Math.max(1.2, 5.5 * k); x.stroke()
    }
    x.beginPath(); TRAIL.forEach(([wx, wz], j) => { const px = (wx - X0) * k, py = (wz - Z0) * k; j ? x.lineTo(px, py) : x.moveTo(px, py) }); x.setLineDash([3, 2]); x.strokeStyle = 'rgb(150,128,96)'; x.lineWidth = 1.4; x.stroke(); x.setLineDash([])
    // 建物の面（壁の細い線だけだと小さな点になるので、分かっている建物は塗りつぶす）
    const rects = [...(g.level.mapRects || []), ...(g.level.houses || []).map(h => [h.x, h.z, h.w, h.d]), ...(g.level.dress || []).map(h => [h.x, h.z, h.w, h.d]),
      [-26, -14, 18, 14], [-46, 15.6, 9, 5.8], [-86, -9, 10, 6], [-46, -8, 8, 6], [23, -28, 6.5, 7], [34, 17, 10.4, 5.2], [12, 207, 12, 9], [24.5, 205.2, 6, 4.4], [-19, 156, 10, 6.5], [-22, 227, 7, 4.6], [10, -12.4, 6.1, 2.4], [18, -7, 2.4, 6.1], [22, 21, 3, 2.5]]
    x.fillStyle = 'rgb(122,100,76)'; x.strokeStyle = 'rgb(78,62,44)'; x.lineWidth = 0.8
    for (const [bx, bz, bw, bd] of rects) { const px = (bx - X0) * k, pz = (bz - Z0) * k, ww = Math.max(1.5, bw * k), hh = Math.max(1.5, bd * k); x.fillRect(px, pz, ww, hh); x.strokeRect(px, pz, ww, hh) }
    // 海岸線: 陸と海の境を細い墨線で（隣り合う画素の差）
    const id = x.getImageData(0, 0, w, h), q = id.data, out = x.createImageData(w, h), o = out.data
    const isSea = (px, py) => { const j = (py * w + px) * 4; return q[j + 2] > q[j] - 2 && q[j] < 190 }
    for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) { const s = isSea(px, py); if (s !== isSea(px + 1, py) || s !== isSea(px, py + 1)) { const j = (py * w + px) * 4; o[j] = 90; o[j + 1] = 76; o[j + 2] = 58; o[j + 3] = 200 } }
    const ol = document.createElement('canvas'); ol.width = w; ol.height = h; ol.getContext('2d').putImageData(out, 0, 0)
    x.drawImage(ol, 0, 0)
    this.base = c
  }
  // 画面の窓の左上（世界の座標）。自分を真ん中に、島の外へははみ出さない
  win() {
    const P = this.g.player, vw = this.w / this.k, vh = VIEW
    const cx = P && P.body ? P.body.x : 0, cz = P && P.body ? P.body.z : 100
    return [Math.max(X0, Math.min(X1 - vw, cx - vw / 2)), Math.max(Z0, Math.min(Z1 - vh, cz - vh / 2)), vw, vh]
  }
  px(wx, wz) { const k = this.k * this.dpr, [ox, oz] = this._w || this.win(); return [(wx - ox) * k, (wz - oz) * k] }
  // 毎コマではなく数コマに1回、重ねる物だけを描き直す
  // 島ぜんぶの地図（M で出し入れ・試合の始まりの輸送機の間は最初から出る）。輸送機の進路・今の位置・円・自分
  bigDraw() {
    const g = this.g, on = !!g.bigMap && g.mode === 'play'
    if (!this.bc) { this.bc = document.createElement('canvas'); this.bc.id = 'bmap'; document.body.appendChild(this.bc) }
    this.bc.classList.toggle('on', on)
    if (!on || !this.base) return
    if ((this.bskip = (this.bskip || 0) - 1) > 0) return; this.bskip = 3 // 数コマに1回だけ描き直す
    const asp = (X1 - X0) / (Z1 - Z0), H = Math.round(Math.min(innerHeight * 0.76, innerWidth * 0.8 / asp)), W = Math.round(H * asp), d = Math.min(2, window.devicePixelRatio || 1)
    const c = this.bc, x = this.bx || (this.bx = c.getContext('2d'))
    if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); c.style.width = W + 'px'; c.style.height = H + 'px' }
    const k = W * d / (X1 - X0), px = (wx, wz) => [(wx - X0) * k, (wz - Z0) * k]
    x.drawImage(this.base, 0, 0, c.width, c.height)
    const z = g.zone
    if (z) {
      const [cx, cz] = px(z.x, z.z), r = z.r * k
      x.save(); x.beginPath(); x.rect(0, 0, c.width, c.height); x.arc(cx, cz, r, 0, Math.PI * 2, true); x.fillStyle = 'rgba(176,64,40,0.2)'; x.fill('evenodd'); x.restore()
      x.beginPath(); x.arc(cx, cz, r, 0, Math.PI * 2); x.strokeStyle = '#a3331f'; x.lineWidth = 2.4 * d; x.stroke()
      if (z.x1 != null) { const [fx, fz] = px(z.x1, z.z1); x.beginPath(); x.arc(fx, fz, Math.max(3 * d, z.r1 * k), 0, Math.PI * 2); x.setLineDash([5 * d, 4 * d]); x.strokeStyle = '#7a2616'; x.lineWidth = 1.6 * d; x.stroke(); x.setLineDash([]) }
    }
    const RD = g.raid // WRECK ISLE の爆撃の赤い円
    if (RD) { const [rx, rz] = px(RD.x, RD.z); x.beginPath(); x.arc(rx, rz, RD.r * k, 0, Math.PI * 2); x.fillStyle = 'rgba(220,30,20,0.38)'; x.fill(); x.strokeStyle = '#c0180c'; x.lineWidth = 2 * d; x.stroke() }
    const P = g.path
    if (g.dropOn && P) {
      const [ax, az] = px(P.x0, P.z0), [bx, bz] = px(P.x0 + P.dx * P.len, P.z0 + P.dz * P.len)
      x.save(); x.lineCap = 'round'
      x.beginPath(); x.moveTo(ax, az); x.lineTo(bx, bz); x.setLineDash([9 * d, 7 * d]); x.strokeStyle = 'rgba(30,22,14,0.9)'; x.lineWidth = 3 * d; x.stroke(); x.setLineDash([])
      // 進む向きの矢（進路の上に等間隔）
      const ang = Math.atan2(bz - az, bx - ax)
      for (let i = 1; i < 6; i++) { const t = i / 6, mx = ax + (bx - ax) * t, mz = az + (bz - az) * t; x.save(); x.translate(mx, mz); x.rotate(ang); x.beginPath(); x.moveTo(7 * d, 0); x.lineTo(-5 * d, -5.5 * d); x.lineTo(-5 * d, 5.5 * d); x.closePath(); x.fillStyle = 'rgba(30,22,14,0.9)'; x.fill(); x.restore() }
      x.restore()
      // 輸送機の今の位置
      const p = planeAt(P, Math.min(g.t, DROP.T + 8)), [qx, qz] = px(p.x, p.z)
      x.save(); x.translate(qx, qz); x.rotate(ang + Math.PI / 2)
      const s = 9 * d
      x.beginPath(); x.moveTo(0, -s * 1.5); x.lineTo(s * 0.35, -s * 0.5); x.lineTo(s * 1.5, s * 0.25); x.lineTo(s * 1.5, s * 0.6); x.lineTo(s * 0.35, s * 0.3); x.lineTo(s * 0.3, s * 1.1); x.lineTo(s * 0.8, s * 1.4); x.lineTo(s * 0.8, s * 1.7); x.lineTo(0, s * 1.45); x.lineTo(-s * 0.8, s * 1.7); x.lineTo(-s * 0.8, s * 1.4); x.lineTo(-s * 0.3, s * 1.1); x.lineTo(-s * 0.35, s * 0.3); x.lineTo(-s * 1.5, s * 0.6); x.lineTo(-s * 1.5, s * 0.25); x.lineTo(-s * 0.35, -s * 0.5); x.closePath()
      x.fillStyle = '#f4ecd8'; x.fill(); x.lineWidth = 1.6 * d; x.strokeStyle = '#1e160e'; x.stroke(); x.restore()
    }
    // 自分（落ちている間は降りた所から今の位置まで）
    const pl = g.player
    if (pl && pl.body) {
      const [mx, mz] = px(pl.body.x, pl.body.z), f = g.camDir()
      x.save(); x.translate(mx, mz); x.rotate(Math.atan2(f.x, -f.z))
      const s = 7 * d
      x.beginPath(); x.moveTo(0, -s * 1.25); x.lineTo(s * 0.8, s * 0.9); x.lineTo(0, s * 0.4); x.lineTo(-s * 0.8, s * 0.9); x.closePath()
      x.fillStyle = '#b3261e'; x.fill(); x.lineWidth = 1.4 * d; x.strokeStyle = '#f4ecd8'; x.stroke(); x.restore()
    }
    x.strokeStyle = INK; x.lineWidth = 3 * d; x.strokeRect(1.5 * d, 1.5 * d, c.width - 3 * d, c.height - 3 * d)
    x.fillStyle = INK; x.font = `700 ${Math.round(15 * d)}px "Zen Kaku Gothic New","Hiragino Sans",sans-serif`; x.textAlign = 'left'
    x.fillText(tr('北', 'N'), 12 * d, 24 * d)
    x.beginPath(); x.moveTo(26 * d, 12 * d); x.lineTo(30 * d, 24 * d); x.lineTo(22 * d, 24 * d); x.closePath(); x.fill()
    if (g.dropOn && pl && pl.air && pl.air.mode === 'plane') { x.textAlign = 'center'; x.font = `700 ${Math.round(17 * d)}px "Zen Kaku Gothic New","Hiragino Sans",sans-serif`; x.fillText(matchMedia('(pointer: coarse)').matches ? tr('右下のボタンで飛び降りる', 'Tap the bottom-right button to jump') : tr(`${g.keymap.label('veh')} で降りる　${g.keymap.label('map')} で地図をしまう`, `${g.keymap.label('veh')} to jump   ${g.keymap.label('map')} to close the map`), c.width / 2, c.height - 14 * d) }
  }
  draw() {
    this.bigDraw()
    if (this.skip-- > 0) return; this.skip = 2
    if (!this.base) this.bake()
    const g = this.g, x = this.ctx, w = this.cv.width, h = this.cv.height, d = this.dpr
    const [ox, oz, vw, vh] = this._w = this.win()
    x.fillStyle = 'rgb(180,196,193)'; x.fillRect(0, 0, w, h)
    x.drawImage(this.base, (ox - X0) * KB, (oz - Z0) * KB, vw * KB, vh * KB, 0, 0, w, h)
    const z = g.zone
    if (z) {
      const [cx, cz] = this.px(z.x, z.z), r = z.r * this.k * d
      x.save(); x.beginPath(); x.rect(3 * d, 3 * d, w - 6 * d, h - 6 * d); x.clip()
      // 円の外側を薄い朱で塗る（危険な側）
      x.beginPath(); x.rect(0, 0, w, h); x.arc(cx, cz, r, 0, Math.PI * 2, true); x.fillStyle = 'rgba(176,64,40,0.22)'; x.fill('evenodd')
      x.beginPath(); x.arc(cx, cz, r, 0, Math.PI * 2); x.strokeStyle = '#a3331f'; x.lineWidth = 1.6 * d; x.stroke()
      // 次の円（最後に残る円）: 点線
      const [fx, fz] = z.x1 != null ? this.px(z.x1, z.z1) : [cx, cz] // 最後の円は今の円の真ん中とは別の所（円は最初が島ぜんぶ 2026-11-24）
      x.beginPath(); x.arc(fx, fz, Math.max(2 * d, z.r1 * this.k * d), 0, Math.PI * 2); x.setLineDash([3 * d, 2 * d]); x.strokeStyle = '#7a2616'; x.lineWidth = 1.2 * d; x.stroke(); x.setLineDash([])
      x.restore()
    }
    if (g.raid) { const RD = g.raid, [rx, rz] = this.px(RD.x, RD.z); x.save(); x.beginPath(); x.rect(3 * d, 3 * d, w - 6 * d, h - 6 * d); x.clip(); x.beginPath(); x.arc(rx, rz, RD.r * this.k * d, 0, Math.PI * 2); x.fillStyle = 'rgba(220,30,20,0.4)'; x.fill(); x.strokeStyle = '#c0180c'; x.lineWidth = 1.6 * d; x.stroke(); x.restore() }
    // 拾う物（動かない物なので全員に見えてよい）: 近くの物は小さな点、補給の箱は大きく
    const Pl = g.player
    if (Pl && Pl.body) for (const it of g.items) {
      if (it.gone > 0) continue
      const dd = Math.hypot(it.x - Pl.body.x, it.z - Pl.body.z); if (!it.drop && dd > 60) continue
      const [ix, iz] = this.px(it.x, it.z), r = (it.drop ? 3 : 1.5) * d
      x.fillStyle = it.drop ? '#c27b17' : 'rgba(74,61,44,0.75)'; x.fillRect(ix - r, iz - r, r * 2, r * 2)
      if (it.drop) { x.strokeStyle = '#f4ecd8'; x.lineWidth = d; x.strokeRect(ix - r, iz - r, r * 2, r * 2) }
    }
    const P = g.player
    if (P && P.body) {
      const [px, pz] = this.px(P.body.x, P.body.z), f = g.camDir(), a = Math.atan2(f.x, f.z) // 画面の上=北(-z)。向き (f.x,f.z) をそのまま地図へ
      x.save(); x.translate(px, pz); x.rotate(Math.atan2(f.x, -f.z))
      const s = 5.5 * d
      x.beginPath(); x.moveTo(0, -s * 1.25); x.lineTo(s * 0.8, s * 0.9); x.lineTo(0, s * 0.4); x.lineTo(-s * 0.8, s * 0.9); x.closePath()
      x.fillStyle = '#b3261e'; x.fill(); x.lineWidth = 1.3 * d; x.strokeStyle = '#f4ecd8'; x.stroke()
      x.restore()
    }
    // 紙の縁取りと「北」の印
    x.strokeStyle = INK; x.lineWidth = Math.max(1, d * 1.4); x.strokeRect(1.5, 1.5, w - 3, h - 3)
    x.lineWidth = Math.max(1, d * 0.6); x.strokeRect(4.5 * d, 4.5 * d, w - 9 * d, h - 9 * d)
    x.fillStyle = INK; x.font = `700 ${Math.round(11 * d)}px "Zen Kaku Gothic New","Hiragino Sans",sans-serif`; x.textAlign = 'center'
    x.fillText(tr('北', 'N'), w - 15 * d, 20 * d)
    x.beginPath(); x.moveTo(w - 15 * d, 22 * d); x.lineTo(w - 12 * d, 30 * d); x.lineTo(w - 18 * d, 30 * d); x.closePath(); x.fill()
  }
}
