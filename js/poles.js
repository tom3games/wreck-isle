// 電柱（北の通り）: 灰色のコンクリート柱（上ほど細い・継ぎ目・泥と雨だれの色むら）、足掛け金具、腕木と碍子、柱上変圧器、
// 地上近くの黄黒の防護カバーと番号札、街灯の腕。柱ごとに腕木の形・変圧器の有無・傾きを変える。部品は材質ごとに1つへまとめて描く（2026-11-22）
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64
  const g = c.getContext('2d'); g.fillStyle = '#d9b320'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1d1c1a'
  for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 16, 64); g.lineTo(i * 16 + 8, 64); g.lineTo(i * 16 + 40, 0); g.lineTo(i * 16 + 32, 0); g.fill() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 1); return t
}

export function buildPoles(scene) {
  const rnd = mulberry(8128)
  const xs = [-94, -77, -60, -43, -26, -9, 8, 25].map(x => x + (rnd() - 0.5) * 2.4), z = 14.7, H = 9.2
  const G = { conc: [], dark: [], white: [], metal: [], trans: [], stripe: [], plate: [], lamp: [] }
  const place = (g, x, y, z0, tilt, key) => { g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z0)); if (tilt) { const m = new THREE.Matrix4().makeTranslation(-tilt.px, 0, -tilt.pz); g.applyMatrix4(m); g.applyMatrix4(new THREE.Matrix4().makeRotationZ(tilt.rz)); g.applyMatrix4(new THREE.Matrix4().makeTranslation(tilt.px, 0, tilt.pz)) } G[key].push(g) }
  const tops = []
  xs.forEach((x, i) => {
    const tilt = { px: x, pz: z, rz: (rnd() - 0.5) * 0.03 }
    // 柱本体: 継ぎ目の帯つきの先細り。頂点の色で泥・雨だれ・むらを出す
    const body = new THREE.CylinderGeometry(0.1, 0.19, H, 16, 18); body.translate(0, H / 2, 0)
    const col = new Float32Array(body.attributes.position.count * 3), pos = body.attributes.position
    const ph = rnd() * 6
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k), a = Math.atan2(pos.getZ(k), pos.getX(k))
      let v = 0.62 + 0.06 * Math.sin(a * 3 + ph) + 0.05 * Math.sin(y * 0.9 + ph * 2)
      if (y < 1.4) v *= 0.62 + 0.38 * (y / 1.4) // 泥はね
      const streak = Math.max(0, Math.sin(a * 7 + ph * 3) * 0.5 + 0.5 - 0.55) * (y > 5 ? 1 : 0.4); v *= 1 - streak * 0.5 // 雨だれ
      if (y > H - 1.6) v *= 0.88
      col[k * 3] = v; col[k * 3 + 1] = v * 0.995; col[k * 3 + 2] = v * 0.97
    }
    body.setAttribute('color', new THREE.BufferAttribute(col, 3)); place(body, x, 0, z, tilt, 'conc')
    for (const y of [2.3, 4.6, 6.9]) { const j = new THREE.CylinderGeometry(0.15 - y * 0.006 + 0.02, 0.15 - y * 0.006 + 0.02, 0.08, 16); j.translate(0, y, 0); const c2 = new Float32Array(j.attributes.position.count * 3).fill(0.46); j.setAttribute('color', new THREE.BufferAttribute(c2, 3)); place(j, x, 0, z, tilt, 'conc') } // 継ぎ目
    // 足掛け金具（交互に左右へ）
    for (let k = 0; k < 11; k++) { const y = 2.6 + k * 0.4, s = k % 2 ? 1 : -1, r = 0.19 - (y / H) * 0.09; const b = new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6); b.rotateZ(Math.PI / 2); b.translate(s * (r + 0.1), y, 0); place(b, x, 0, z, tilt, 'metal') }
    // 腕木と碍子: 3種（二段／二段＋筋交い／上だけ長く）
    const type = i % 3 === 1 ? 1 : (rnd() < 0.3 ? 2 : 0)
    const bars = type === 2 ? [[H - 0.28, 2.0]] : [[H - 0.28, 1.8], [H - 1.08, 1.4]]
    for (const [y, w] of bars) {
      const a = new THREE.BoxGeometry(0.1, 0.1, w); a.translate(0, y, 0); place(a, x, 0, z, tilt, 'dark')
      for (const s of [-w / 2 + 0.1, 0, w / 2 - 0.1]) { const ins = new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8); ins.translate(0, y + 0.12, s); place(ins, x, 0, z, tilt, 'white') }
    }
    if (type === 1) for (const s of [-1, 1]) { const br = new THREE.BoxGeometry(0.06, 0.06, 0.95); br.rotateX(s * 0.55); br.translate(0, H - 0.72, s * 0.42); place(br, x, 0, z, tilt, 'dark') }
    if (type === 2) { const cap = new THREE.ConeGeometry(0.12, 0.2, 10); cap.translate(0, H + 0.1, 0); place(cap, x, 0, z, tilt, 'dark') }
    // 柱上変圧器（3本に1本ほど）
    if (i === 1 || i === 5 || i === 7 || (i === 3 && rnd() < 0.5)) {
      const t = new THREE.CylinderGeometry(0.26, 0.26, 0.72, 14); t.translate(0.42, H - 2.0, 0); place(t, x, 0, z, tilt, 'trans')
      const lid = new THREE.CylinderGeometry(0.2, 0.26, 0.1, 14); lid.translate(0.42, H - 1.59, 0); place(lid, x, 0, z, tilt, 'trans')
      const br = new THREE.BoxGeometry(0.46, 0.08, 0.12); br.translate(0.22, H - 2.0, 0); place(br, x, 0, z, tilt, 'dark')
      for (const dz of [-0.12, 0, 0.12]) { const bu = new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6); bu.translate(0.42, H - 1.55, dz); place(bu, x, 0, z, tilt, 'white') }
    }
    // 地ぎわの黄黒の防護カバーと番号札
    const cover = new THREE.CylinderGeometry(0.2, 0.225, 1.9, 16, 1, true); cover.translate(0, 1.0, 0); place(cover, x, 0, z, tilt, 'stripe')
    const plate = new THREE.BoxGeometry(0.02, 0.2, 0.14); plate.translate(0.165, 2.6, 0); place(plate, x, 0, z, tilt, 'plate')
    // 防犯灯の腕: 柱の傾きに合わせて道側へ（腕は細く、灯りは笠つき）
    const arm = new THREE.CylinderGeometry(0.025, 0.03, 1.2, 6); arm.rotateX(-(Math.PI / 2 - 0.25)); arm.translate(0, 5.35, -0.55); place(arm, x, 0, z, tilt, 'dark')
    const head = new THREE.BoxGeometry(0.2, 0.07, 0.46); head.translate(0, 5.5, -1.15); place(head, x, 0, z, tilt, 'lamp')
    tops.push([x, z, tilt.rz])
  })
  const mk = (list, m, cast = true) => { if (!list.length) return; const mesh = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), m); mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh) }
  mk(G.conc, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8d8b86, roughness: 0.95 }))
  mk(G.dark, new THREE.MeshStandardMaterial({ color: 0x2b2c2d, roughness: 0.6 }))
  mk(G.white, new THREE.MeshStandardMaterial({ color: 0xd9d5cc, roughness: 0.3 }), false)
  mk(G.metal, new THREE.MeshStandardMaterial({ color: 0x70767a, roughness: 0.5, metalness: 0.6 }), false)
  mk(G.trans, new THREE.MeshStandardMaterial({ color: 0x7f8a83, roughness: 0.55, metalness: 0.45 }))
  mk(G.stripe, new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.8, side: THREE.DoubleSide }), false)
  mk(G.plate, new THREE.MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.6 }), false)
  mk(G.lamp, new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.4, emissive: 0xfff2dc, emissiveIntensity: 0.12 }), false)
  // 電線（たるみ。柱の傾きぶん端がずれる）。全部1つにまとめる
  const wires = [], sagOf = L => 0.3 + L * 0.012
  for (let i = 0; i < tops.length - 1; i++) for (const [y, s] of [[H - 0.28, -0.8], [H - 0.28, 0], [H - 0.28, 0.8], [H - 1.08, -0.6], [H - 1.08, 0.6]]) {
    const A = tops[i], Bp = tops[i + 1]
    const a = new THREE.Vector3(A[0] - Math.sin(A[2]) * y * 0 + A[2] * y, y, z + s), b = new THREE.Vector3(Bp[0] + Bp[2] * y, y, z + s), L = a.distanceTo(b)
    const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sagOf(L); pts.push(p) }
    wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.012, 4))
  }
  const wm = new THREE.Mesh(mergeGeometries(wires.map(g => g.index ? g.toNonIndexed() : g)), new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.5 })); scene.add(wm)
}
