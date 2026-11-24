// 人: Quaternius の7頭身の素体＋同じ骨のアニメ（UAL）。服は素体の上に塗る（T ポーズの高さで分ける）
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from '../vendor/jsm/libs/meshopt_decoder.module.js'
import * as SkeletonUtils from '../vendor/jsm/utils/SkeletonUtils.js'
import { raycast } from './collide.js?v=mwuc41ax'

const D = './assets/chars/'
const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder) // 公開版は動きの素材を meshopt で縮めている
let BASE = null, CLIPS = {}, HAIR = {}, HAT = null
const KNOCK = { fall: 0.7, lie: 0.55, up: 1.25 } // 倒れる・寝ている・起き上がる速さ
// 50人で動かすための見え方の共有（game が毎コマ setCharView で入れる）。画面の外と遠くの人は骨の計算を間引く
export const CHAR_VIEW = { cam: null, world: null, frustum: new THREE.Frustum(), m: new THREE.Matrix4() }
export function setCharView(cam, world) { CHAR_VIEW.cam = cam; if (world) CHAR_VIEW.world = world; CHAR_VIEW.frustum.setFromProjectionMatrix(CHAR_VIEW.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)) }
const UP = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _sph = new THREE.Sphere(), _cv = new THREE.Vector3()
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// 骨を「世界の軸」まわりに回す（骨ごとの向きの違いを気にしなくてよい）。アニメが毎コマ上書きするので積み重ならない
function rotWq(b, q) { b.parent.getWorldQuaternion(_pq); b.quaternion.premultiply(_pq.clone().invert().multiply(q).multiply(_pq)) }
// 足の真下の地面（箱の上面か地面）。見つからなければ null
function groundY(world, x, y, z) { const h = raycast(world, [x, y + 0.6, z], [x, y - 0.9, z]); return h ? y + 0.6 - h.t * 1.5 : null }
const _H = new THREE.Vector3(), _K = new THREE.Vector3(), _F = new THREE.Vector3(), _T = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion()
// 2本の骨（もも・すね）で、足先を raise だけ上げる。膝は legYaw の前へ曲げる
function twoBone(thigh, calf, foot, raise, legYaw) {
  thigh.getWorldPosition(_H); calf.getWorldPosition(_K); foot.getWorldPosition(_F)
  _T.copy(_F); _T.y += raise
  const a = _H.distanceTo(_K), b = _K.distanceTo(_F), d = Math.min(a + b - 0.002, Math.max(0.05, _H.distanceTo(_T)))
  _a.subVectors(_H, _K).normalize(); _b.subVectors(_F, _K).normalize()
  const cur = Math.acos(clamp(_a.dot(_b), -1, 1)), want = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1))
  // 曲げる軸: 今の膝の曲がりから。まっすぐなら体の左右の軸（膝が前へ出る向き）
  const side = _n.set(Math.cos(legYaw), 0, -Math.sin(legYaw)), ax = new THREE.Vector3().crossVectors(_b, _a)
  if (ax.lengthSq() < 1e-6) ax.copy(side); else { ax.normalize(); if (ax.dot(side) < 0) ax.negate() }
  rotWq(calf, _q.setFromAxisAngle(ax, cur - want)); thigh.updateMatrixWorld(true)
  // ももを回して、足先を目標へ向ける
  foot.getWorldPosition(_F); _a.subVectors(_F, _H).normalize(); _b.subVectors(_T, _H).normalize()
  rotWq(thigh, _q.setFromUnitVectors(_a, _b)); thigh.updateMatrixWorld(true)
}
function rotW(b, axis, a) { if (!b || !a) return; b.parent.getWorldQuaternion(_pq); _rq.setFromAxisAngle(axis, a); b.quaternion.premultiply(_pq.clone().invert().multiply(_rq).multiply(_pq)) }

const UPPER = /^(spine_0[123]|neck_01|Head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/
export const clipOf = n => CLIPS[n] // 検証用: 動きの素材を見る（tools/clips.mjs）
export async function loadChars() {
  const T = performance.now(), tm = n => { if (location.search.includes('timing')) console.log('[timing] chars:' + n, Math.round(performance.now() - T)) }
  const [base, a1, a2, h1, h2, h3, hat] = await Promise.all([
    gl.loadAsync(D + 'Superhero_Male_FullBody.gltf'), gl.loadAsync(D + 'UAL1_Standard.glb'), gl.loadAsync(D + 'UAL2_Standard.glb'),
    gl.loadAsync(D + 'Hair_SimpleParted.gltf'), gl.loadAsync(D + 'Hair_Buzzed.gltf'), gl.loadAsync(D + 'Hair_Beard.gltf'),
    gl.loadAsync('./assets/models/fishermans_hat/fishermans_hat.gltf'),
  ])
  tm('fetch+parse')
  BASE = base.scene; HAIR = { parted: h1.scene, buzzed: h2.scene, beard: h3.scene }; HAT = hat.scene
  // 体の凹凸をならす（服の下の筋肉を目立たせない）。頭と手はそのまま
  BASE.traverse(m => { if (m.isSkinnedMesh && m.material.name === 'MI_Superhero_Male') smoothBody(m.geometry) })
  tm('smooth')
  // 明るい肌に差し替え
  const light = await new THREE.TextureLoader().loadAsync(D + 'T_Superhero_Male_Ligh.png'); light.colorSpace = THREE.SRGBColorSpace; light.flipY = false
  BASE.traverse(m => { if (m.isMesh && m.material.name === 'MI_Superhero_Male') { m.material.map = light } })
  for (const c of [...a1.animations, ...a2.animations]) {
    // 根の骨の移動は消す（その場で回す）。腰の上下は残す
    c.tracks = c.tracks.filter(t => !/^root\.position/.test(t.name))
    CLIPS[c.name] = c
  }
  tm('clips')
  // 上半身だけの投げ（走りながら投げる）
  const up = CLIPS.OverhandThrow.clone(); up.name = 'ThrowUpper'; up.tracks = up.tracks.filter(t => UPPER.test(t.name.split('.')[0])); CLIPS.ThrowUpper = up
  // 上半身だけのパンチ（手ぶらで左クリック）。ジャブとストレートを交互に（2026-11-23）
  for (const [src, nm] of [['Punch_Jab', 'PunchA'], ['Punch_Cross', 'PunchB']]) { const c = CLIPS[src].clone(); c.name = nm; c.tracks = c.tracks.filter(t => UPPER.test(t.name.split('.')[0])); CLIPS[nm] = c }
  const pk = CLIPS.PickUp_Table.clone(); pk.name = 'PickUpper'; pk.tracks = pk.tracks.filter(t => UPPER.test(t.name.split('.')[0])); CLIPS.PickUpper = pk
}

function smoothBody(g) {
  const pos = g.attributes.position, n = pos.count, idx = g.index.array
  // 同じ位置の頂点（UV の継ぎ目）をまとめる
  const key = new Map(), grp = new Int32Array(n)
  for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * 2000) + ',' + Math.round(pos.getY(i) * 2000) + ',' + Math.round(pos.getZ(i) * 2000); if (!key.has(k)) key.set(k, key.size); grp[i] = key.get(k) }
  const G = key.size, P = new Float32Array(G * 3), nb = Array.from({ length: G }, () => new Set())
  for (let i = 0; i < n; i++) { P[grp[i] * 3] = pos.getX(i); P[grp[i] * 3 + 1] = pos.getY(i); P[grp[i] * 3 + 2] = pos.getZ(i) }
  for (let t = 0; t < idx.length; t += 3) { const a = grp[idx[t]], b = grp[idx[t + 1]], c = grp[idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b) }
  // ならす強さ: 胴と腕と脚は強く、首・手首・足首に向けて弱く、頭と手は 0
  const w = new Float32Array(G)
  for (let i = 0; i < G; i++) {
    const x = Math.abs(P[i * 3]), y = P[i * 3 + 1]
    let k = 1
    if (y > 1.5) k = Math.max(0, 1 - (y - 1.5) / 0.05)
    if (x > 0.66) k = Math.min(k, Math.max(0, 1 - (x - 0.66) / 0.06))
    if (y < 0.12) k = Math.min(k, Math.max(0, (y - 0.04) / 0.08))
    w[i] = k * 0.55
  }
  const Q = new Float32Array(G * 3)
  for (let it = 0; it < 9; it++) {
    for (let i = 0; i < G; i++) {
      let sx = 0, sy = 0, sz = 0, c = 0
      for (const j of nb[i]) { sx += P[j * 3]; sy += P[j * 3 + 1]; sz += P[j * 3 + 2]; c++ }
      const k = c ? w[i] : 0
      Q[i * 3] = P[i * 3] + (sx / c - P[i * 3]) * k; Q[i * 3 + 1] = P[i * 3 + 1] + (sy / c - P[i * 3 + 1]) * k; Q[i * 3 + 2] = P[i * 3 + 2] + (sz / c - P[i * 3 + 2]) * k
    }
    P.set(Q)
  }
  for (let i = 0; i < n; i++) pos.setXYZ(i, P[grp[i] * 3], P[grp[i] * 3 + 1], P[grp[i] * 3 + 2])
  pos.needsUpdate = true; g.computeVertexNormals()
}

// 服を塗るシェーダ（素体の T ポーズの座標で領域を分ける）
function clothe(material, look) {
  const m = material.clone()
  m.onBeforeCompile = sh => {
    sh.uniforms.cShirt = { value: new THREE.Color(look.shirt) }
    sh.uniforms.cPants = { value: new THREE.Color(look.pants) }
    sh.uniforms.cShoes = { value: new THREE.Color(look.shoes) }
    sh.uniforms.cVest = { value: new THREE.Color(look.vest ?? look.shirt) }
    sh.uniforms.uSleeve = { value: look.sleeve ?? 0.7 }
    sh.uniforms.uVest = { value: look.vest ? 1 : 0 }
    sh.uniforms.uZip = { value: look.zip === false ? 0 : 1 }
    sh.vertexShader = 'varying vec3 vBind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBind = position;
      { float ax = abs(position.x), y = position.y;
        float sh = step(0.985, y) * step(y, 1.53) * step(ax, uSleeveV);
        float pa = step(0.1, y) * step(y, 0.985);
        // 服の厚み（筋肉の凹凸を隠す）
        transformed += objectNormal * (sh * mix(0.022, 0.012, smoothstep(0.2, 0.5, ax)) + pa * 0.012 + step(y, 0.095) * 0.01); }`).replace('void main() {', 'uniform float uSleeveV;\nvoid main() {')
    sh.uniforms.uSleeveV = { value: look.sleeve ?? 0.7 }
    sh.fragmentShader = `varying vec3 vBind; uniform vec3 cShirt, cPants, cShoes, cVest; uniform float uSleeve, uVest, uZip;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float ax = abs(vBind.x), y = vBind.y;
        float shoes = step(y, 0.095);
        float pants = step(0.095, y) * step(y, 0.985);
        float shirt = step(0.985, y) * step(y, 1.535) * step(ax, uSleeve);
        float vest = uVest * shirt * step(ax, 0.2) * step(y, 1.47);
        float n = vn(vBind * 180.0) * 0.5 + vn(vBind * 31.0) * 0.5;
        float front = step(0.0, vBind.z);
        float pocket = smoothstep(0.004, 0.0, abs(y - 0.9)) * step(0.06, ax) * step(ax, 0.17) * front;
        vec3 cloth = cShirt * (0.82 + 0.22 * n);
        cloth = mix(cloth, cVest * (0.85 + 0.2 * n), vest);
        float seam = smoothstep(0.004, 0.0, abs(y - 0.985)) + smoothstep(0.004, 0.0, abs(ax - uSleeve + 0.01)) * shirt;
        vec3 pc = cPants * (0.8 + 0.25 * n) * (1.0 - 0.3 * smoothstep(0.012, 0.0, abs(y - 0.96))) * (1.0 - 0.25 * pocket) * (1.0 - 0.15 * smoothstep(0.006, 0.0, abs(abs(vBind.x) - 0.11)) * step(y, 0.95));
        pc = mix(pc, vec3(0.08, 0.07, 0.06), smoothstep(0.02, 0.012, abs(y - 0.955)) * pants); // ベルト
        // ファスナー（前の真ん中）・襟・袖口・すそ
        float zip = smoothstep(0.005, 0.002, ax) * front * step(1.0, y) * step(y, 1.5) * uZip;
        float collar = smoothstep(1.47, 1.5, y) * step(ax, 0.16);
        float cuff = smoothstep(uSleeve - 0.06, uSleeve - 0.045, ax) * step(1.2, y);
        float hem = smoothstep(1.06, 1.0, y) * step(0.985, y);
        cloth *= 1.0 - 0.18 * (collar + cuff + hem);
        cloth = mix(cloth, cloth * 0.55 + vec3(0.06), zip * 0.8);
        // 胴の左右の縫い目と、ももの横のポケット
        seam += smoothstep(0.006, 0.0, abs(abs(vBind.x) - 0.15)) * shirt * step(abs(vBind.z), 0.03);
        diffuseColor.rgb = mix(diffuseColor.rgb, cloth * (1.0 - seam * 0.25), shirt);
        diffuseColor.rgb = mix(diffuseColor.rgb, pc, pants);
        diffuseColor.rgb = mix(diffuseColor.rgb, cShoes * (0.85 + 0.2 * n), shoes);
        float clothMask = clamp(shirt + pants + shoes, 0.0, 1.0);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.86 + 0.1 * n, clothMask);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, clothMask * 0.85));`)
  }
  m.customProgramCacheKey = () => 'cloth' + JSON.stringify(look)
  return m
}

export const LOOKS = {
  player: { shirt: 0x26354a, pants: 0x4b4a43, shoes: 0x1c1c1c, hair: 'parted', sleeve: 0.72 },
  fisher: { shirt: 0x6f7a72, pants: 0x2d3a2c, shoes: 0x2b2b2b, vest: 0xd8681d, hair: 'buzzed', hat: true, sleeve: 0.62 },
  hoodie: { shirt: 0x8b8e92, pants: 0x30333a, shoes: 0xd7d4cc, hair: 'buzzed', beard: true, sleeve: 0.74 },
  work: { shirt: 0x3e5a7a, pants: 0x3e5a7a, shoes: 0x6b4a2b, hair: 'parted', sleeve: 0.5 },
  elder: { shirt: 0x8a7a62, pants: 0x3a3631, shoes: 0x2a2620, hair: 'buzzed', beard: true, sleeve: 0.7, zip: false },
  jersey: { shirt: 0x7a1f2a, pants: 0x1f2a4a, shoes: 0xe8e6e0, hair: 'parted', sleeve: 0.72 },
}

export class Char {
  constructor(scene, look) {
    this.root = SkeletonUtils.clone(BASE)
    this.root.traverse(m => {
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.isSkinnedMesh) { m.computeBoundingSphere(); m.boundingSphere = m.boundingSphere.clone(); m.boundingSphere.radius *= 1.6 } // 画面の外なら描かない（倒れた姿も入る大きさ）
        if (m.material.name === 'MI_Superhero_Male') m.material = clothe(m.material, look) }
    })
    this.bones = {}; this.root.traverse(o => { if (o.isBone) this.bones[o.name] = o })
    const skinned = []; this.root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o) })
    this.attachHair(HAIR[look.hair], look.hair === 'buzzed' ? 0x1b1712 : 0x241c15)
    if (look.beard) this.attachHair(HAIR.beard, 0x221a12)
    if (look.hat) { const h = HAT.clone(true); h.traverse(m => { if (m.isMesh) m.castShadow = true }); const b = new THREE.Box3().setFromObject(h), s = new THREE.Vector3(); b.getSize(s); h.scale.setScalar(0.27 / Math.max(s.x, s.z)); this.hat = h }
    scene.add(this.root)
    this.mixer = new THREE.AnimationMixer(this.root)
    this.act = {}
    for (const n of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'NinjaJump_Idle_Loop', 'ThrowUpper', 'PickUpper', 'PunchA', 'PunchB', 'Hit_Knockback', 'Death01', 'Hit_Chest', 'Jump_Land', 'LayToIdle', 'Roll']) {
      const a = this.mixer.clipAction(CLIPS[n]); this.act[n] = a
    }
    for (const n of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'NinjaJump_Idle_Loop']) { this.act[n].play(); this.act[n].setEffectiveWeight(0) }
    this.act.Idle_Loop.setEffectiveWeight(1)
    for (const n of ['ThrowUpper', 'PickUpper', 'PunchA', 'PunchB', 'Hit_Knockback', 'Death01', 'Hit_Chest', 'Jump_Land', 'LayToIdle', 'Roll']) { this.act[n].setLoop(THREE.LoopOnce); this.act[n].clampWhenFinished = true }
    this.w = { Idle_Loop: 1 }
    this.diveT = -1; this.throwT = -1; this.pickT = -1; this.punchT = -1; this.hitT = -1; this.dead = false; this.yaw = 0; this.aimPitch = 0
    this.ikDrop = 0; this.legYaw = null; this.turnStep = 0; this.bank = 0; this.pitchL = 0; this.landT = -1; this.prevG = true; this.prevAir = 0; this.acc = 0; this.tick = (Math.random() * 6) | 0; this.lookYaw = null; this.lookPitch = 0
    this.root.rotation.order = 'YXZ'; this.shadowOn = true; this.air = null; this.airPitch = 0 // 降下: air は 'fall'・'chute'、airPitch は体を前へ倒す角度（game の syncAir が決める）
    if (this.hat) { this.bones.Head.add(this.hat); this.hat.position.set(0, 0.17, 0.02) }
    // 肩幅を狭める（上腕の付け根を内へ寄せる）
    this.armBase = ['upperarm_l', 'upperarm_r'].map(n => [this.bones[n], this.bones[n].position.clone()])
  }
  attachHair(src, color) {
    const h = SkeletonUtils.clone(src)
    h.traverse(m => {
      if (m.isSkinnedMesh) {
        const bones = m.skeleton.bones.map(b => this.bones[b.name] || b)
        m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix)
        m.material = m.material.clone(); m.material.color = new THREE.Color(color); m.castShadow = true; m.computeBoundingSphere(); m.boundingSphere = m.boundingSphere.clone(); m.boundingSphere.radius *= 1.6
      }
    })
    const meshes = []; h.traverse(m => { if (m.isSkinnedMesh || m.isMesh) meshes.push(m) })
    for (const m of meshes) this.root.add(m)
  }
  // 投げの構え: 振りかぶった所で止める
  windup(on) {
    const a = this.act.ThrowUpper
    if (on) { if (this.throwT < 0) { a.reset().play(); a.setEffectiveWeight(9); a.time = 0.42; a.timeScale = 0; this.throwT = 0; this.holding = true } }
    else if (this.holding) { this.holding = false; a.timeScale = 1.6; this.throwT = 0.42 }
  }
  throwNow() { const a = this.act.ThrowUpper; a.reset().play(); a.setEffectiveWeight(9); a.time = 0.42; a.timeScale = 1.6; this.throwT = 0.42; this.holding = false }
  punch() { if (this.dead) return; this.punchN = (this.punchN || 0) + 1; const n = this.punchN % 2 ? 'PunchA' : 'PunchB', o = n === 'PunchA' ? 'PunchB' : 'PunchA'; this.act[o].stop(); const a = this.act[n]; a.reset().play(); a.setEffectiveWeight(9); a.timeScale = 1.5; this.punchT = 0; this.punchA = n }
  // 飛び込み（走りながらしゃがむ）: 素材の Roll（飛ぶ→伏せて転がる→起きる）を 0.25秒・0.5秒・0.5秒に割り当てる。時間は自分で数える（主と参加者で同じ 1.25秒）
  dive() { if (this.dead) return; this.diveT = 0; for (const n of ['ThrowUpper', 'PickUpper', 'PunchA', 'PunchB', 'Jump_Land', 'Hit_Chest']) this.act[n].stop(); this.throwT = this.pickT = this.punchT = this.landT = this.hitT2 = -1; this.holding = false; const a = this.act.Roll; a.reset().play(); a.setEffectiveWeight(40); a.timeScale = 0; a.time = 0 }
  endDive() { if (this.diveT < 0) return; this.diveT = -1; this.act.Roll.fadeOut(0.12) }
  pick() { const a = this.act.PickUpper; a.reset().play(); a.setEffectiveWeight(9); a.timeScale = 1.8; this.pickT = 0 }
  // 爆風で仰向けに倒れる → 少し寝る → 起き上がる。合わせて何秒動けないか
  knock() { if (this.dead) return; this.endDive(); const a = this.act.Hit_Knockback; a.reset().play(); a.setEffectiveWeight(12); a.timeScale = 1.2; this.hitT = 0; this.down = true; this.upT = -1; this.act.LayToIdle.stop() }
  downTime() { return KNOCK.fall + KNOCK.lie + this.act.LayToIdle.getClip().duration / KNOCK.up }
  flinch() { if (this.dead || this.diveT >= 0) return; const a = this.act.Hit_Chest; a.reset().play(); a.setEffectiveWeight(4); this.hitT2 = 0 }
  die() { if (this.dead) return; this.dead = true; this.diveT = -1; for (const k in this.act) this.act[k].setEffectiveWeight(0); const a = this.act.Death01; a.reset().play(); a.setEffectiveWeight(1); a.timeScale = 1.1 }
  // body: 体（位置と速さ）。yaw: 上半身の向き。lookYaw/lookPitch: 見ている向き（人だけ）
  update(dt, body) {
    const vx = body.vx, vz = body.vz, sp = Math.hypot(vx, vz)
    // ---- 見え方で間引く: 画面の外は 6コマに1回、遠い人は 2〜3コマに1回だけ骨を動かす（50人用）
    let every = 1, near = true
    const V = CHAR_VIEW
    if (V.cam) {
      const c = V.cam.position, d = Math.hypot(body.x - c.x, body.z - c.z)
      const vis = V.frustum.intersectsSphere(_sph.set(_cv.set(body.x, body.y + 0.9, body.z), 1.6))
      every = !vis ? 6 : d < 30 ? 1 : d < 60 ? 2 : 3
      near = vis && d < 30
      const sh = vis && d < 55
      if (sh !== this.shadowOn) { this.shadowOn = sh; this.root.traverse(m => { if (m.isMesh) m.castShadow = sh }) }
    }
    // ---- 足の向き: 動いている時は進む向き（後ろ歩きは逆向き）、止まっている時は地面に置いたまま
    if (this.legYaw == null) this.legYaw = this.yaw
    if (!this.dead && !this.down && sp > 0.4 && body.onGround !== false) {
      const mv = Math.atan2(vx, vz) + (body.back ? Math.PI : 0)
      this.legYaw += wrap(mv - this.legYaw) * Math.min(1, dt * 12); this.turnStep = 0
    } else if (!this.dead && !this.down) {
      // その場で向きを変える: ひねりが 55° を超えたら足を踏み替えて向き直る
      if (Math.abs(wrap(this.legYaw - this.yaw)) > 0.95) this.turnStep = 0.4
      if (this.turnStep > 0) { this.turnStep -= dt; this.legYaw += wrap(this.yaw - this.legYaw) * Math.min(1, dt * 10) }
    } else this.legYaw = this.yaw
    if (this.diveT >= 0) this.legYaw = this.yaw
    const tw = clamp(wrap(this.legYaw - this.yaw), -1.4, 1.4); this.legYaw = this.yaw + tw
    // ---- 傾き: 曲がる時は内側へ（体ごと）、走り出しは前へ・止まる時は後ろへ（上半身）
    const mvA = Math.atan2(vx, vz)
    const turn = sp > 1.5 && this.lastMv != null ? wrap(mvA - this.lastMv) / Math.max(dt, 1e-3) : 0
    const accel = this.lastSp != null ? (sp - this.lastSp) / Math.max(dt, 1e-3) : 0
    this.lastMv = mvA; this.lastSp = sp
    const gr = body.onGround !== false && !this.dead && !this.down && this.diveT < 0
    this.bank += ((gr ? clamp(-turn * sp * 0.022, -0.16, 0.16) : 0) - this.bank) * Math.min(1, dt * 6)
    this.pitchL += ((gr ? clamp(accel * 0.018, -0.14, 0.12) : 0) - this.pitchL) * Math.min(1, dt * 7)
    // ---- 着地
    if (!this.dead && body.onGround && !this.prevG && this.prevAir > 0.4) { const a = this.act.Jump_Land; a.reset().play(); a.setEffectiveWeight(Math.min(6, 2 + this.prevAir * 4)); a.timeScale = 1.5; this.landT = 0 }
    this.prevG = !!body.onGround; this.prevAir = body.airT || 0
    if (!this.dead && this.diveT >= 0) {
      this.diveT += dt
      const T = this.diveT, a = this.act.Roll
      a.time = T < 0.25 ? T / 0.25 * 0.42 : T < 0.75 ? 0.42 + (T - 0.25) / 0.5 * 0.53 : Math.min(1.46, 0.95 + (T - 0.75) / 0.5 * 0.52) // 飛ぶ 0〜0.42・伏せて転がる 〜0.95・起きる 〜1.47（素材の秒）
      if (T >= 1.25) this.endDive()
    }
    if (!this.dead) {
      let want
      if (this.diveT >= 0) want = null
      else if (this.air === 'fall') want = 'NinjaJump_Idle_Loop'
      else if (!body.onGround && body.airT > 0.25) want = 'Jump_Loop'
      else if (body.crouch) want = sp > 0.4 ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop'
      else if (sp < 0.3) want = this.turnStep > 0 ? 'Walk_Loop' : 'Idle_Loop' // 踏み替えの間は足を動かす
      else if (sp < (body.back ? 3.6 : 2.6)) want = 'Walk_Loop' // 後ろ歩きは歩幅を広げた歩きで（走りの逆再生は逃げているように見えた）
      else if (sp < 5.0) want = 'Jog_Fwd_Loop'
      else want = 'Sprint_Loop'
      const k = Math.min(1, dt * 9)
      for (const n of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'NinjaJump_Idle_Loop']) {
        const t = n === want ? (n === 'Walk_Loop' && sp < 0.3 ? 0.6 : 1) : 0; this.w[n] = (this.w[n] || 0) + (t - (this.w[n] || 0)) * k
        this.act[n].setEffectiveWeight(this.w[n])
      }
      const base = { Walk_Loop: 1.45, Jog_Fwd_Loop: 3.9, Sprint_Loop: 6.0, Crouch_Fwd_Loop: 1.5 }
      for (const n in base) this.act[n].timeScale = THREE.MathUtils.clamp(sp / base[n], 0.6, 1.5)
      if (sp < 0.3 && this.turnStep > 0) this.act.Walk_Loop.timeScale = 1.1
      // 後ろ向きに歩く時は逆再生
      if (body.back) for (const n of ['Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Fwd_Loop']) this.act[n].timeScale *= -1
      if (this.throwT >= 0 && !this.holding) { this.throwT += dt * 1.6; if (this.throwT > 1.3) { this.act.ThrowUpper.fadeOut(0.2); this.throwT = -1 } }
      if (this.punchT >= 0) { this.punchT += dt * 1.5; if (this.punchT > this.act[this.punchA].getClip().duration - 0.1) { this.act[this.punchA].fadeOut(0.15); this.punchT = -1 } }
      if (this.pickT >= 0) { this.pickT += dt * 1.8; if (this.pickT > 1.4) { this.act.PickUpper.fadeOut(0.2); this.pickT = -1 } }
      if (this.landT >= 0) { this.landT += dt; if (this.landT > 0.3) { this.act.Jump_Land.fadeOut(0.2); this.landT = -1 } }
      if (this.hitT >= 0) {
        this.hitT += dt
        if (this.down) {
          // 倒れきって地面に着き、少し寝てから起き上がる
          if (this.upT < 0 && this.hitT > KNOCK.fall + KNOCK.lie && body.onGround) { const u = this.act.LayToIdle; u.reset().play(); u.setEffectiveWeight(14); u.timeScale = KNOCK.up; this.act.Hit_Knockback.fadeOut(0.25); this.upT = 0 }
          if (this.upT >= 0) { this.upT += dt; if (this.upT > this.act.LayToIdle.getClip().duration / KNOCK.up - 0.15) { this.act.LayToIdle.fadeOut(0.3); this.hitT = -1; this.down = false; this.upT = -1 } }
        } else if (this.hitT > 0.9 && body.onGround) { this.act.Hit_Knockback.fadeOut(0.35); this.hitT = -1 }
      }
      if (this.hitT2 >= 0) { this.hitT2 += dt; if (this.hitT2 > 0.4) { this.act.Hit_Chest.fadeOut(0.2); this.hitT2 = -1 } }
    }
    // 向き（体ごとの傾きは曲がりの分だけ。後ろ・横に動いている時は弱める）
    this.root.position.set(body.x, body.y, body.z)
    this.root.rotation.set(this.airPitch, this.yaw, this.bank * Math.cos(tw))
    // 体を前へ倒すのは腰を軸に（足元を軸にすると頭が遠くへ振れる）
    if (this.airPitch > 0.01) { const p = this.airPitch, s = Math.sin(p), c = Math.cos(p); this.root.position.x += -0.9 * s * Math.sin(this.yaw); this.root.position.z += -0.9 * s * Math.cos(this.yaw); this.root.position.y += 0.9 * (1 - c) }
    this.acc += dt
    if (++this.tick % every !== 0 && !this.dead) return
    this.mixer.update(this.acc); this.acc = 0
    for (const [b, p0] of this.armBase) b.position.copy(p0).multiplyScalar(0.82)
    if (this.dead) return
    const B = this.bones
    // 傘を開いた間は両手を上げて紐を握る
    if (this.air === 'chute') { _ax.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); rotW(B.upperarm_l, _ax, 2.5); rotW(B.upperarm_r, _ax, -2.5) }
    // 構えの反り（握っている時は上を狙うと反る）
    if (this.aimPitch) { B.spine_02.rotateX(-this.aimPitch * 0.35); B.spine_03.rotateX(-this.aimPitch * 0.3) }
    if (!near) return
    // 下半身を足の向きへ、上半身は 3つの背骨で戻して狙う向きのまま
    if (Math.abs(tw) > 0.01 && !this.down && this.diveT < 0) { rotW(B.pelvis, UP, tw); rotW(B.spine_01, UP, -tw * 0.4); rotW(B.spine_02, UP, -tw * 0.3); rotW(B.spine_03, UP, -tw * 0.3) }
    // 走り出し・止まりの前後の傾き（進む向きに対して）
    if (Math.abs(this.pitchL) > 0.005 && sp > 0.2) { _ax.set(Math.cos(mvA), 0, -Math.sin(mvA)); rotW(B.spine_01, _ax, this.pitchL) }
    // 足を地面に合わせる（坂・階段・段差）: 低い側の足に合わせて腰を下げ、高い側の足は膝を曲げて上げる。止まっている時と歩きだけ
    if (V.world && body.onGround && !this.down && sp < 3.5 && this.diveT < 0) {
      this.root.updateMatrixWorld(true)
      const legs = [[B.thigh_l, B.calf_l, B.foot_l], [B.thigh_r, B.calf_r, B.foot_r]]
      const off = legs.map(l => { l[2].getWorldPosition(_F); const g = groundY(V.world, _F.x, body.y, _F.z); return g == null ? 0 : clamp(g - body.y, -0.5, 0.5) })
      const drop = clamp(Math.min(off[0], off[1], 0), -0.45, 0)
      this.ikDrop += (drop - this.ikDrop) * Math.min(1, dt * 12)
      if (Math.abs(this.ikDrop) > 0.005 || off[0] > 0.02 || off[1] > 0.02) {
        this.root.position.y = body.y + this.ikDrop; this.root.updateMatrixWorld(true)
        legs.forEach((l, i) => { const r = off[i] - this.ikDrop; if (r > 0.015) twoBone(l[0], l[1], l[2], r, this.legYaw) })
      }
    } else this.ikDrop *= Math.max(0, 1 - dt * 10)
    // 頭: 見ている向きへ（首と頭で半分ずつ、左右 60° まで）
    if (this.lookYaw != null && !this.down && this.diveT < 0) {
      const hy = clamp(wrap(this.lookYaw - this.yaw), -1.05, 1.05)
      rotW(B.neck_01, UP, hy * 0.45); rotW(B.Head, UP, hy * 0.45)
      const lp = clamp(this.lookPitch || 0, -0.6, 0.6) * (this.aimPitch ? 0.3 : 0.6)
      if (lp) { const fy = this.yaw + hy; _ax.set(Math.cos(fy), 0, -Math.sin(fy)); rotW(B.Head, _ax, -lp) }
    }
  }
  handPos(out) { return this.bones.hand_r.getWorldPosition(out) }
  remove(scene) { scene.remove(this.root) }
}
