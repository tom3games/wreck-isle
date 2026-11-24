// 港のまわりのエリア: 南の森と丘（灯台・展望台）、西の集落（商店・番屋・斜路・神社）
// 地面の高さ terrainH は当たり（collide.js）と見た目の両方で使う
import * as THREE from 'three'
import { L as tr } from './i18n.js?v=mwuqry6n'
import { mat } from './level.js?v=mwuqry6n'
import { cedarGeo, broadGeo, leafTex, fishingBoat } from './props.js?v=mwuqry6n'
import { buildQuarry } from './quarry.js?v=mwuqry6n'
import { colFromMesh } from './colmesh.js?v=mwuqry6n'
import { southMod, southTex, Z_END, PASS_X } from './southmap.js?v=mwuqry6n'
import { landH, landTex, sandbarH } from './bigmap.js?v=mwuqry6n'
import { buildSouth, house2 } from './south.js?v=mwuqry6n'
import { buildMainland } from './mainland.js?v=mwuqry6n'
import { stdInfo } from './dress.js?v=mwuqry6n'

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function bump(x, z) { return Math.sin(x * 0.11 + z * 0.07) * 0.5 + Math.sin(x * 0.043 - z * 0.12) * 0.7 + Math.sin(x * 0.21 + z * 0.19) * 0.15 }
export const SHRINE = { x0: -93, x1: -76, z0: 19, z1: 31, h: 2.6 }
export const SLIP = { x0: -62, x1: -52 }
export const PEAK = { x: -15, z: 82 }
// 登り道（集落の裏から灯台まで）
export const PATH = [[-34, 31], [-33, 38], [-27, 46], [-30, 54], [-22, 62], [-17, 70], [-15, 77]]

// 東の採石場
export const QUARRY = { x0: 54, x1: 99, z0: 30, z1: 74, ramp: [90, 97, 40, 58] }
export const PILES = [[40, -6, 5, 3], [48, 1, 6, 4.2], [86, -5, 5.5, 3.6], [62, 2, 4, 2.6], [84, 34, 4.5, 3]]
const fade = z => 1 - ss(94, 140, z) // 尾根は南へ向かって低くなり、低地になる
function hillW(x, z) { const t = ss(32.5, 84, Math.min(z, 86)), amp = 21 * Math.exp(-(((x + 15) / 55) ** 2)) + 4; return (Math.pow(t, 1.25) * amp + bump(x, z) * t * 0.9) * fade(z) }
function hillE(x, z) { const t = ss(30, 82, Math.min(z, 88)), amp = 30 * Math.exp(-(((x - 80) / 28) ** 2)) + 8; return (Math.pow(t, 1.15) * amp + bump(x * 1.3, z) * t * 1.1) * fade(z) }
function eastH(x, z) {
  if (z < -14) return -1e9
  let h = 0
  for (const [px, pz, r, ph] of PILES) { const d = Math.hypot(x - px, z - pz); if (d < r) h = Math.max(h, ph * (1 - d / r) ** 1.2) }
  if (z > 30) {
    const nat = Math.max(hillE(x, z), x < 40 ? hillW(x, z) : 0)
    const Q = QUARRY
    if (x > Q.x0 && x < Q.x1 && z > Q.z0 && z < Q.z1) {
      let lv = z < 44 ? 0 : z < 54 ? 5 : z < 64 ? 10 : 99
      const [rx0, rx1, rz0, rz1] = Q.ramp
      if (x > rx0 && x < rx1 && z > rz0 && z < 64) lv = 10 * Math.min(1, (z - rz0) / (rz1 - rz0))
      h = Math.max(h, Math.min(nat, lv))
    } else h = Math.max(h, nat)
  }
  return h
}

export function terrainH(x, z) {
  const h = baseH(x, z)
  const c = h < -1e8 ? h : (z > 26 ? southMod(x, z, h) : h)
  return sandbarH(x, z, c > -1e8 ? c : landH(x, z)) // 今の島が海の所は、海峡の向こうの新しい陸（bigmap.js）。西の海峡には砂州
}
function baseH(x, z) {
  if (x > 30 && x < 100.5 && z <= Z_END) return eastH(x, z)
  if (x < -96 || x > 31 || z > Z_END) return -1e9
  if (z < -20) {
    if (x > SLIP.x0 && x < SLIP.x1 && z > -26) return -2.4 * ss(-8, -26, z)
    return -1e9
  }
  // 斜路（海へ下る）
  if (x > SLIP.x0 && x < SLIP.x1 && z < -8) return -2.4 * ss(-8, -26, z)
  let h = 0
  if (z > 32) {
    const t = ss(32.5, 84, Math.min(z, 86)), amp = 21 * Math.exp(-(((x + 15) / 55) ** 2)) + 4
    h = (Math.pow(t, 1.25) * amp + bump(x, z) * t * 0.9) * fade(z)
    // 道のところは少し削ってなだらかに
    const pd = pathDist(x, z); if (pd < 2.5) h -= (1 - pd / 2.5) * 0.25 * t
  }
  // 神社の高台
  const m = ss(SHRINE.x0 - 1.2, SHRINE.x0, x) * (1 - ss(SHRINE.x1, SHRINE.x1 + 1.2, x)) * ss(SHRINE.z0 - 1.2, SHRINE.z0, z) * (1 - ss(93, 100, z)) // 南の低地まで続かないように
  h = Math.max(h, SHRINE.h * m)
  return h
}
export function pathDist(x, z) {
  let best = 1e9
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], dx = bx - ax, dz = bz - az
    let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = Math.max(0, Math.min(1, t))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

function texSet(name, rep) {
  const L = new THREE.TextureLoader()
  const o = ['diff', 'nor_gl', 'rough'].map(k => { const t = L.load(`./assets/tex/${name}_${k}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t })
  o[0].colorSpace = THREE.SRGBColorSpace
  return o
}

export function buildAreas(level, scene, world) {
  world.terrain = terrainH
  terrainMesh(scene)
  landMesh(scene)
  pathRibbon(scene)
  forest(level, scene, world)
  lighthouse(level, scene, world)
  village(level, scene, world)
  shrine(level, scene, world)
  buildQuarry(level, scene, world)
  buildSouth(level, scene, world)
  buildMainland(level, scene, world)
}

// ---------- 地面（森の地面と草をまぜる） ----------
function terrainMesh(scene) {
  const W = 200, D = 294, g = new THREE.PlaneGeometry(W, D, W, D)
  g.rotateX(-Math.PI / 2); g.translate(-98 + W / 2, 0, -30 + D / 2)
  const p = g.attributes.position, mix = new Float32Array(p.count), gq = new Float32Array(p.count), sd = new Float32Array(p.count)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z)
    const town = x <= 30.5 && z < 32.2
    p.setY(i, h < -1e8 ? -3.2 : (town ? -0.06 : h < 0.05 && !(z > 120 && h < -0.05) ? -0.05 : h))
    gq[i] = x > 31 && z < 75 ? 1 : 0
    if (z > 120 && h > -1e8) { const t = southTex(x, z, h); gq[i] = Math.max(gq[i], t.gravel); sd[i] = t.sand }
    mix[i] = THREE.MathUtils.clamp(0.55 + 0.45 * Math.sin(x * 0.09) * Math.cos(z * 0.13) - (z > 40 ? 0.35 : 0), 0, 1)
    if (z > 120) mix[i] = THREE.MathUtils.lerp(mix[i], THREE.MathUtils.clamp(0.78 + 0.3 * Math.sin(x * 0.07 + 1) * Math.cos(z * 0.11) + 0.12 * Math.sin(x * 0.31 + z * 0.23), 0, 1), THREE.MathUtils.smoothstep(z, 120, 135))
  }
  g.setAttribute('mixw', new THREE.BufferAttribute(mix, 1)); g.setAttribute('gq', new THREE.BufferAttribute(gq, 1)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1))
  g.computeVertexNormals()
  const m = terrainMat()
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = false
  scene.add(mesh)
}
let _tmat = null
function terrainMat() {
  if (_tmat) return _tmat
  const [fd, fn, fr] = texSet('forest_ground_04'), [gd, gn] = texSet('leafy_grass'), [vd, vn] = texSet('gravel_floor'), [sdd, sdn] = texSet('damp_beach_sand')
  const TL = new THREE.TextureLoader(), rd = TL.load('./assets/tex/rock_face_diff.webp'), rn = TL.load('./assets/tex/rock_face_nor_gl.webp')
  for (const t of [rd, rn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 } rd.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ map: fd, normalMap: fn, roughnessMap: fr, roughness: 1, color: 0xd8d8d0 })
  m.onBeforeCompile = sh => {
    sh.uniforms.gMap = { value: gd }; sh.uniforms.gNor = { value: gn }; sh.uniforms.vMap = { value: vd }; sh.uniforms.vNor = { value: vn }; sh.uniforms.rMap = { value: rd }; sh.uniforms.rNor = { value: rn }; sh.uniforms.sMap = { value: sdd }; sh.uniforms.sNor = { value: sdn }
    sh.vertexShader = 'attribute float mixw; attribute float gq; attribute float sd; varying float vSd; varying float vMix; varying float vGq; varying vec2 vWuv; varying vec3 vWp; varying float vUp;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMix = mixw; vGq = gq; vSd = sd; vec4 wp4 = modelMatrix * vec4(position,1.); vWuv = wp4.xz; vWp = wp4.xyz; vUp = normal.y;')
    sh.fragmentShader = 'uniform sampler2D gMap, gNor, vMap, vNor, rMap, rNor, sMap, sNor; varying float vSd; varying float vMix; varying float vGq; varying vec2 vWuv; varying vec3 vWp; varying float vUp;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `vec2 tuv = vWuv / 4.0; vec4 c1 = texture2D(map, tuv); vec4 c2 = texture2D(gMap, vWuv / 3.0);
        float w = smoothstep(0.35, 0.65, vMix + (c1.g - 0.4) * 0.6); vec4 base = mix(c1, c2 * vec4(0.82, 0.95, 0.72, 1.0), w);
        base = mix(base, texture2D(vMap, vWuv / 3.0) * vec4(0.95, 0.93, 0.9, 1.0), vGq);
        base = mix(base, texture2D(sMap, vWuv / 4.0) * vec4(2.1, 1.95, 1.6, 1.0), vSd);
        float rk = 1.0 - smoothstep(0.55, 0.8, vUp); vec2 ruv = (abs(vWp.x) > 0.0 ? vec2(vWp.x + vWp.z, vWp.y) : vWuv) / 5.0;
        base = mix(base, texture2D(rMap, ruv) * vec4(0.85, 0.82, 0.78, 1.0), rk); diffuseColor *= base;`)
      .replace('#include <normal_fragment_maps>', `vec3 mapN = mix(mix(texture2D(normalMap, vWuv / 4.0).xyz, texture2D(gNor, vWuv / 3.0).xyz, w), texture2D(vNor, vWuv / 3.0).xyz, vGq); mapN = mix(mapN, texture2D(sNor, vWuv / 4.0).xyz, vSd); mapN = mix(mapN, texture2D(rNor, ruv).xyz, rk) * 2.0 - 1.0; mapN.xy *= normalScale; normal = normalize(tbn * mapN);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;')
  }
  _tmat = m
  return m
}
// 海峡の向こうの新しい陸の地面（2m の網）。今の島の網（x -98〜102・z -30〜264）と重なる所の三角は外す
function landMesh(scene) {
  const X0 = -340, Z0 = -96, W = 680, D = 704, S = 2, nx = W / S, nz = D / S
  const g = new THREE.PlaneGeometry(W, D, nx, nz)
  g.rotateX(-Math.PI / 2); g.translate(X0 + W / 2, 0, Z0 + D / 2)
  const p = g.attributes.position, mix = new Float32Array(p.count), gq = new Float32Array(p.count), sd = new Float32Array(p.count)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z)
    p.setY(i, h < -1e8 ? -3.2 : h < 0.05 && h > -0.05 ? -0.05 : h)
    if (h > -1e8) { const t = landTex(x, z, h); gq[i] = t.gravel; sd[i] = t.sand }
    mix[i] = THREE.MathUtils.clamp(0.78 + 0.3 * Math.sin(x * 0.07 + 1) * Math.cos(z * 0.11) + 0.12 * Math.sin(x * 0.31 + z * 0.23) - (h > 8 ? 0.4 : 0), 0, 1)
  }
  // 今の島の網の内側の三角を外す
  const idx = g.index.array, keep = []
  const inCore = k => { const x = p.getX(k), z = p.getZ(k); return x > -98.01 && x < 102.01 && z > -30.01 && z < 264.01 }
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (inCore(a) && inCore(b) && inCore(c)) continue; keep.push(a, b, c) }
  g.setIndex(keep)
  g.setAttribute('mixw', new THREE.BufferAttribute(mix, 1)); g.setAttribute('gq', new THREE.BufferAttribute(gq, 1)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1))
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, terrainMat()); mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.noRay = true
  scene.add(mesh)
}


// ---------- 登り道（土の帯） ----------
function pathRibbon(scene) {
  const pts = []
  for (let i = 0; i < PATH.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; pts.push([PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * t, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * t]) }
  pts.push(PATH[PATH.length - 1])
  const pos = [], uv = [], idx = []
  let along = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    const nx = -dz / l, nz = dx / l
    if (i) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    for (const s of [-1.3, 1.3]) { const x = pts[i][0] + nx * s, z = pts[i][1] + nz * s; pos.push(x, Math.max(terrainH(x, z), 0) + 0.04, z); uv.push((s + 1.3) / 2.6, along / 2.6) }
    if (i) { const o = i * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
  const [d, n, r] = texSet('stony_dirt_path')
  const m = new THREE.MeshStandardMaterial({ map: d, normalMap: n, roughnessMap: r, polygonOffset: true, polygonOffsetFactor: -2, transparent: true, alphaMap: edgeAlpha() })
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh)
}
function edgeAlpha() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4; const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#000'); gr.addColorStop(0.18, '#fff'); gr.addColorStop(0.82, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 4)
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; return t
}

// ---------- 森（当たりのある木・倒木・小屋） ----------
function forest(level, scene, world) {
  const cedar = cedarGeo(), broad = broadGeo()
  const cm = new THREE.MeshStandardMaterial({ map: leafTex('cedar'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const bm = new THREE.MeshStandardMaterial({ map: leafTex('broad'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const tm = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 })
  const N = 360
  const ic = new THREE.InstancedMesh(cedar.leaves, cm, N), ict = new THREE.InstancedMesh(cedar.trunk, tm, N), ib = new THREE.InstancedMesh(broad.leaves, bm, N), ibt = new THREE.InstancedMesh(broad.trunk, tm, N)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  let a = 0, b = 0, tries = 0
  const rnd = mulberry(77)
  level.trees = []
  while ((a < N || b < N) && tries++ < 8000) {
    const x = -94 + rnd() * 192, z = 36 + rnd() * 55
    if (x > 50 && z < 76) continue
    if (Math.abs(x - PASS_X) < 7.5) continue // 切り通しの道
    if (x > 30 && terrainH(x, z) < 1) continue
    if (pathDist(x, z) < 3.2) continue
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < 9) continue
    if (Math.hypot(x + 8, z - 80) < 10) continue
    if (z > 58 && z < 80 && Math.abs(x + 8 - (z - 80) * 0.15) < 7) continue // 展望台から町が見える切り通し
    if (x > -55 && x < -45 && z > 50 && z < 60) continue // 小屋
    if (level.trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 3.3)) continue
    const y = terrainH(x, z), k = 1.05 + rnd() * 0.6
    m4.compose(v.set(x, y - 0.15, z), q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), sc.set(k, k * (0.9 + rnd() * 0.3), k))
    if (rnd() < 0.62 && a < N) { ic.setMatrixAt(a, m4); ict.setMatrixAt(a, m4); ic.setColorAt(a, col.setHSL(0.28 + rnd() * 0.04, 0.35, 0.42 + rnd() * 0.16)); a++ }
    else if (b < N) { ib.setMatrixAt(b, m4); ibt.setMatrixAt(b, m4); ib.setColorAt(b, col.setHSL(0.23 + rnd() * 0.06, 0.35, 0.5 + rnd() * 0.18)); b++ }
    else continue
    level.trees.push([x, z])
    world.add({ min: [x - 0.13 * k, y - 1, z - 0.13 * k], max: [x + 0.13 * k, y + 3.2 * k, z + 0.13 * k], kind: 'solid', tag: 'tree' })
  }
  ic.count = ict.count = a; ib.count = ibt.count = b
  for (const o of [ic, ib, ict, ibt]) { o.castShadow = true; o.receiveShadow = true; scene.add(o) }
  // 倒木（隠れる所）
  const logM = new THREE.MeshStandardMaterial({ color: 0x5a4838, roughness: 1, map: mat('darkWood').map })
  for (const [x, z, r, L] of [[-40, 44, 0.4, 6], [-12, 52, 1.1, 5], [-62, 62, 0.2, 7], [5, 66, 2.2, 5], [-30, 72, 1.6, 4.5], [-78, 48, 0.8, 5]]) {
    const y = terrainH(x, z)
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, L, 10), logM); lg.rotation.z = Math.PI / 2; lg.rotation.y = r; lg.position.set(x, y + 0.3, z); lg.castShadow = lg.receiveShadow = true; scene.add(lg)
    const dx = Math.cos(r) * L / 2, dz = -Math.sin(r) * L / 2
    for (let k = -2; k <= 2; k++) { const px = x + dx * k / 2.5, pz = z + dz * k / 2.5, py = terrainH(px, pz); world.add({ min: [px - 0.42, py - 0.5, pz - 0.42], max: [px + 0.42, py + 0.62, pz + 0.42], kind: 'solid' }) }
  }
  // 森の小屋（道具置き場）
  const hx = -52, hz = 52, hy = terrainH(hx, hz)
  level.B(hx - 0.2, hy - 1, hz - 0.2, hx + 6.2, hy + 0.15, hz + 5.2, 'planks')
  level.wallX(hx, hx + 6, hz, hy + 0.15, hy + 2.6, 0.12, 'darkWood', [{ a: hx + 2.2, b: hx + 3.6, y0: hy + 0.15, y1: hy + 2.1 }])
  level.wallX(hx, hx + 6, hz + 5, hy + 0.15, hy + 2.6, 0.12, 'darkWood', [{ a: hx + 1, b: hx + 2.5, y0: hy + 1.0, y1: hy + 1.8 }])
  level.wallZ(hz, hz + 5, hx, hy + 0.15, hy + 2.6, 0.12, 'darkWood')
  level.wallZ(hz, hz + 5, hx + 6, hy + 0.15, hy + 2.6, 0.12, 'darkWood', [{ a: hz + 1.5, b: hz + 3.5, y0: hy + 1.0, y1: hy + 1.8 }])
  level.B(hx - 0.5, hy + 2.6, hz - 0.5, hx + 6.5, hy + 2.75, hz + 5.5, 'ironRust')
  level.crate(hx + 1, hz + 4, 0.9, hy + 0.15); level.crate(hx + 5, hz + 1, 0.9, hy + 0.15)
  level.spawnsExtra = [[-40, terrainH(-40, 40), 40], [8, terrainH(8, 58), 58], [-70, terrainH(-70, 66), 66]]
}

// ---------- 灯台と展望台 ----------
function lighthouse(level, scene, world) {
  const y = terrainH(PEAK.x, PEAK.z)
  const white = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.6 })
  const t = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.65, 9, 28), white); t.position.set(PEAK.x, y + 4.5, PEAK.z); t.castShadow = t.receiveShadow = true; scene.add(t)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.25, 28), new THREE.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.5 })); band.position.set(PEAK.x, y + 9.1, PEAK.z); scene.add(band)
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.3, 16), new THREE.MeshPhysicalMaterial({ color: 0x8ba1a8, roughness: 0.05, transparent: true, opacity: 0.5 })); lamp.position.set(PEAK.x, y + 9.9, PEAK.z); scene.add(lamp)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 3 })); bulb.position.set(PEAK.x, y + 9.9, PEAK.z); scene.add(bulb)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0x9c2a22, roughness: 0.5 })); cap.position.set(PEAK.x, y + 11, PEAK.z); scene.add(cap)
  world.add({ min: [PEAK.x - 1.55, y - 1, PEAK.z - 1.55], max: [PEAK.x + 1.55, y + 11, PEAK.z + 1.55], kind: 'solid' })
  // 展望台（木の台・階段・手すり）
  const dx = -8, dz = 80, dy = terrainH(dx, dz) + 2.4
  level.B(dx - 2.5, dy - 0.15, dz - 2.5, dx + 2.5, dy, dz + 2.5, 'planks')
  for (const [px, pz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) { const gy = terrainH(dx + px, dz + pz); level.B(dx + px - 0.12, gy - 0.5, dz + pz - 0.12, dx + px + 0.12, dy, dz + pz + 0.12, 'darkWood') }
  for (const [x0, z0, x1, z1] of [[-2.5, -2.55, 2.5, -2.45], [-2.5, 2.45, 2.5, 2.55], [2.45, -2.5, 2.55, 2.5]]) level.B(dx + x0, dy, dz + z0, dx + x1, dy + 1.0, dz + z1, 'darkWood')
  // 階段（西側から上がる）
  const n = 13, gy0 = terrainH(dx - 2.5 - n * 0.32, dz), rise = (dy - gy0) / n
  for (let i = 0; i < n; i++) { const x0 = dx - 2.5 - (n - i) * 0.32; level.B(x0, gy0 - 0.6, dz - 0.8, x0 + 0.32, gy0 + (i + 1) * rise, dz + 0.8, 'planks') }
}

// ---------- 西の集落 ----------
function village(level, scene, world) {
  const B = level.B.bind(level)
  // 地面
  B(-96, -3.2, -8, SLIP.x0, 0, 8, 'quay'); B(SLIP.x1, -3.2, -8, -30, 0, 8, 'quay')
  B(-96, -3.2, -20, SLIP.x0, 0, -8, 'quay'); B(SLIP.x1, -3.2, -20, -30, 0, -8, 'quay')
  B(-96.5, -3.2, -20.4, SLIP.x0, -0.02, -20, 'seawall'); B(SLIP.x1, -3.2, -20.4, -30, -0.02, -20, 'seawall')
  B(-96, 0, -20.3, SLIP.x0, 0.18, -19.75, 'kerb'); B(SLIP.x1, 0, -20.3, -30, 0.18, -19.75, 'kerb')
  B(-96, -3.2, 8, -30, 0, 14, 'road')
  B(-96, -3.2, 14, -30, 0, 32, 'gravel')
  // 斜路の両わきの壁と、下の端の柵
  B(SLIP.x0 - 0.3, -3, -26, SLIP.x0, 0.25, -8, 'seawall'); B(SLIP.x1, -3, -26, SLIP.x1 + 0.3, 0.25, -8, 'seawall')
  B(SLIP.x0, -3, -19.2, SLIP.x1, 0.2, -18.9, null, { kind: 'edge', vis: false })
  // 引き上げた漁船と、浜に置いた網
  const boat = fishingBoat(scene, -57, -12.5, Math.PI / 2 + 0.05, 0x8a2a1c, -1.0); boat.rotation.z = 0.12
  colFromMesh(world, boat)
  // 白線
  for (let x = -94; x < -30; x += 4) B(x, 0, 10.95, x + 2.2, 0.006, 11.05, 'paint', { nocol: true })
  B(-96, 0, 8.25, -30, 0.006, 8.37, 'paint', { nocol: true }); B(-96, 0, 13.63, -30, 0.006, 13.75, 'paint', { nocol: true })
  // 番屋（前が開いた作業小屋）2棟
  for (const [x, z, w, d] of [[-86, -9, 10, 6], [-46, -8, 8, 6]]) {
    B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
    const bm = x < -60 ? 'sidingSalt' : 'sidingTar' // 塩で褪せた板と、タールを塗った板
    level.wallX(x, x + w, z + d, 0, 3.0, 0.15, bm)
    level.wallZ(z, z + d, x, 0, 3.0, 0.15, bm, [{ a: z + 2, b: z + 3.5, y0: 1.1, y1: 2.0 }])
    level.wallZ(z, z + d, x + w, 0, 3.0, 0.15, bm)
    level.dress.push({ x, z, w, d, top: 3.0, wins: { W: [{ a: z + 2, b: z + 3.5, y0: 1.1 }] }, doors: {}, lv: 2, off: 0.09, rust: true })
    B(x - 0.4, 3.0, z - 0.6, x + w + 0.4, 3.15, z + d + 0.3, 'ironRust')
    for (const xx of [x + 0.1, x + w - 0.1]) B(xx - 0.08, 0, z - 0.5, xx + 0.08, 3.0, z - 0.34, 'darkWood')
    level.styroStack(x + 1.5, z + d - 1, 4); level.styroStack(x + 2.5, z + d - 1, 3); level.crate(x + w - 1.5, z + d - 1.2, 1.0); level.net(x + w / 2, z + 2.5)
  }
  // 網を干す竿
  for (const z of [-15, -13]) { B(-80, 0, z - 0.04, -80 + 0.08, 1.8, z + 0.04, 'darkWood'); B(-70, 0, z - 0.04, -70 + 0.08, 1.8, z + 0.04, 'darkWood') }
  B(-80, 1.75, -15.04, -70, 1.8, -12.96, 'darkWood', { nocol: true })
  for (const [x, z] of [[-40, -14], [-38.8, -14], [-71, -4], [-35, 4]]) level.drum(x, z)
  // 商店
  shop(level, scene, -46, 15.6)
  // 家（道の南と、奥の路地ぞい）
  level.house(-60, 17, 9, 6.6, 'stuccoSage', 'roofBlack', 1.4)
  { const info = house2(level, -73, 16.6, 8.5, 6.8, 'sidingGreen', 'roofRed', 1.8, { floors: 2, ridge: 'x', band: 'awning' }); level.dress.push({ x: -73, z: 16.6, w: 8.5, d: 6.8, top: info.top, wins: info.wins, doors: info.doors, lv: 2, off: 0.105 }); (level.upItems || (level.upItems = [])).push([-73 + 8.5 - 2.2, 16.6 + 2.0, info.f2]) }
  level.house(-56, 25.2, 9, 5.6, 'tinBlue', 'roofRed', 1.0)
  level.house(-44, 25.4, 9, 5.4, 'stuccoPink', 'roofBlack', 1.6)
  level.dress.push(stdInfo(-60, 17, 9, 6.6, 3), stdInfo(-56, 25.2, 9, 5.6, 1), stdInfo(-44, 25.4, 9, 5.4, 2))
  // ブロック塀と路地の砂利
  level.wallX(-96, -76.5, 16, 0, 1.3, 0.16, 'block', [{ a: -87, b: -82, y0: 0, y1: 1.3 }])
  level.wallX(-75, -61, 15.8, 0, 1.3, 0.16, 'block', [{ a: -70.5, b: -68.5, y0: 0, y1: 1.3 }])
  level.wallX(-34, -30, 16, 0, 1.3, 0.16, 'block')
  for (const [x, z] of [[-66, 29], [-38, 23.5]]) level.crate(x, z, 1.0)
  level.vending(-35.4, 15.2)
}

export function shop(level, scene, x, z) {
  const w = 9, d = 5.8, h = 3.2
  level.B(x, 0, z, x + w, 0.12, z + d, 'slab', { nocol: true })
  // 前（道側）は大きく開いたシャッターの口
  level.wallX(x, x + w, z, 0, h, 0.18, 'stuccoCream', [{ a: x + 1, b: x + w - 1, y0: 0, y1: 2.5 }])
  level.wallX(x, x + w, z + d, 0, h, 0.18, 'stuccoCream')
  level.wallZ(z, z + d, x, 0, h, 0.18, 'stuccoCream'); level.wallZ(z, z + d, x + w, 0, h, 0.18, 'stuccoCream', [{ a: z + 2, b: z + 3.4, y0: 0, y1: 2.1 }])
  level.B(x - 0.4, h, z - 1.2, x + w + 0.4, h + 0.2, z + d + 0.3, 'ironRust')
  level.B(x + 1, 2.25, z - 0.12, x + w - 1, 2.5, z - 0.06, 'shutter', { nocol: true })
  // 棚と台
  for (let i = 0; i < 3; i++) level.B(x + 1.2 + i * 2.6, 0, z + d - 0.7, x + 3.0 + i * 2.6, 1.8, z + d - 0.3, 'darkWood')
  level.B(x + 2.5, 0, z + 2.2, x + 6.5, 0.9, z + 3.0, 'wood')
  level.sign(x + w / 2, h + 0.55, z - 0.02, Math.PI, tr('西浦商店', 'NISHIURA STORE'), 5.2, 0.8)
  for (let i = 0; i < 7; i++) level.B(x + 0.9 + i * 1.02, 2.5, z - 0.95, x + 1.9 + i * 1.02 - 0.02, 2.56, z - 0.05, i % 2 ? 'paint' : 'pumpRed', { nocol: true }) // 日よけの縞
  level.dress.push({ x, z, w, d, top: 3.2, wins: {}, doors: { N: [{ a: x + 1, b: x + w - 1 }], E: [{ a: z + 2, b: z + 3.4 }] }, lv: 3, off: 0.115 })
  // 看板は北（道）向き: sign は PlaneGeometry の表が +z なので π 回す
}

// ---------- 神社 ----------
function shrine(level, scene, world) {
  const S = SHRINE, B = level.B.bind(level)
  // 高台の石垣（見た目）と、当たり
  B(S.x0 - 0.2, -0.2, S.z0 - 0.25, S.x1 + 0.2, S.h, S.z0, 'stoneWall')
  B(S.x1, -0.2, S.z0, S.x1 + 0.25, S.h, S.z1, 'stoneWall')
  B(S.x0 - 0.25, -0.2, S.z0, S.x0, S.h, S.z1, 'stoneWall')
  // 高台の上の地面（砂利）
  B(S.x0, S.h - 0.3, S.z0, S.x1, S.h, S.z1, 'gravel')
  // 石段（道から上がる）
  const sx0 = -86.5, sx1 = -83.5, n = Math.round(S.h / 0.2)
  for (let i = 0; i < n; i++) { const z1 = S.z0 - (n - 1 - i) * 0.3; B(sx0, 0, z1 - 0.3, sx1, (i + 1) * 0.2, z1, 'stoneStep') }
  // 石段の口だけ石垣を開ける: 当たりの壁は石段の左右だけ
  const base = level.world.boxes.find(b => b.mat === 'stoneWall' && b.min[2] === S.z0 - 0.25); if (base) { base.dead = true; B(S.x0 - 0.2, -0.2, S.z0 - 0.25, sx0, S.h, S.z0, null, { vis: false }); B(sx1, -0.2, S.z0 - 0.25, S.x1 + 0.2, S.h, S.z0, null, { vis: false }) }
  // 鳥居
  const red = new THREE.MeshStandardMaterial({ color: 0xb8321e, roughness: 0.55 }), black = new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.6 })
  const ty = S.h, tz = S.z0 + 1.6, tx = -85
  for (const s of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.8, 16), red); p.position.set(tx + s, ty + 1.9, tz); p.castShadow = true; scene.add(p); world.add({ min: [tx + s - 0.2, ty, tz - 0.2], max: [tx + s + 0.2, ty + 3.8, tz + 0.2], kind: 'solid' }) }
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.2, 0.18), red); nuki.position.set(tx, ty + 3.05, tz); scene.add(nuki)
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.28, 0.36), black); kasagi.position.set(tx, ty + 3.85, tz); kasagi.castShadow = true; scene.add(kasagi)
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 0.3), red); shimaki.position.set(tx, ty + 3.62, tz); scene.add(shimaki)
  // 社（小さなお堂）
  const hx = -89, hz = 25, hw = 6, hd = 4.6
  B(hx, ty, hz, hx + hw, ty + 0.6, hz + hd, 'darkWood')
  level.wallX(hx + 0.3, hx + hw - 0.3, hz + hd - 0.3, ty + 0.6, ty + 3.0, 0.15, 'darkWood')
  level.wallZ(hz + 0.3, hz + hd - 0.3, hx + 0.3, ty + 0.6, ty + 3.0, 0.15, 'darkWood'); level.wallZ(hz + 0.3, hz + hd - 0.3, hx + hw - 0.3, ty + 0.6, ty + 3.0, 0.15, 'darkWood')
  for (const xx of [hx + 0.3, hx + hw - 0.3]) B(xx - 0.12, ty + 0.6, hz + 0.18, xx + 0.12, ty + 3.0, hz + 0.42, 'darkWood')
  const roofM = new THREE.MeshStandardMaterial({ color: 0x4f7c6a, roughness: 0.45, metalness: 0.55 }) // 緑青の銅板
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(hw + 1.6, 0.12, hd / 2 + 1.1), roofM); r.position.set(hx + hw / 2, ty + 3.55, hz + hd / 2 + s * (hd / 4 + 0.35)); r.rotation.x = s * 0.5; r.castShadow = true; scene.add(r) }
  B(hx - 0.6, ty + 3.0, hz - 0.6, hx + hw + 0.6, ty + 3.3, hz + hd + 0.6, null, { vis: false })
  // 賽銭箱と鈴の綱
  B(hx + hw / 2 - 0.5, ty + 0.6, hz - 0.5, hx + hw / 2 + 0.5, ty + 1.2, hz - 0.05, 'darkWood')
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.9 })); rope.position.set(hx + hw / 2, ty + 2.0, hz + 0.25); scene.add(rope)
  // 灯籠（2つ）
  const stone = mat('stoneStep')
  for (const s of [-1, 1]) {
    const lx = tx + s * 2.6, lz = tz + 3
    const parts = [[0.5, 0.25, 0.5, 0.12], [0.18, 0.9, 0.18, 0.7], [0.55, 0.12, 0.55, 1.2], [0.4, 0.38, 0.4, 1.45], [0.75, 0.14, 0.75, 1.72]]
    for (const [w, h, d, y] of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); m.position.set(lx, ty + y, lz); m.castShadow = true; scene.add(m) }
    world.add({ min: [lx - 0.3, ty, lz - 0.3], max: [lx + 0.3, ty + 1.8, lz + 0.3], kind: 'solid' })
  }
  // 御神木（大きなスギとしめ縄）
  const cg = cedarGeo(), big = new THREE.Group()
  const lm = new THREE.MeshStandardMaterial({ map: leafTex('cedar'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xb9c9a8 })
  const lv = new THREE.Mesh(cg.leaves, lm), tr = new THREE.Mesh(cg.trunk, new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 }))
  big.add(lv); big.add(tr); big.scale.set(2.4, 2.6, 2.4); big.position.set(-79.5, ty, 28.5); big.traverse(o => { o.castShadow = true }); scene.add(big)
  const sh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.9 })); sh.rotation.x = Math.PI / 2; sh.position.set(-79.5, ty + 1.4, 28.5); scene.add(sh)
  world.add({ min: [-80, ty, 28], max: [-79, ty + 8, 29], kind: 'solid' })
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
