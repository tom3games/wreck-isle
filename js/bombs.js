// 爆弾の種類と見た目。数字は全部ここ（試作で直す）
import * as THREE from 'three'

export const GRAV = 18
export const BOMB = {
  frag: { name: '手投げ', fuse: 3.2, dmg: 105, R: 6.8, push: 15, size: 1, r: 0.085, bounce: 0.34 },
  sticky: { name: '粘着', fuse: 6.0, dmg: 125, R: 4.6, push: 13, size: 0.85, r: 0.09, bounce: 0 },
  smoke: { name: '煙', fuse: 1.4, dmg: 0, R: 0, push: 0, size: 0, r: 0.09, bounce: 0.25 },
  // 火炎瓶: 当たると割れて、半径 R が life 秒燃える。中にいると 1秒に dps 減る（導火線は無い。握ったまま 20秒たつと足元で割れる）
  molotov: { name: '火炎瓶', fuse: 20, dmg: 0, R: 3.2, dps: 17, life: 7, push: 0, size: 0, r: 0.09, bounce: 0 },
  // 地雷: 置いて arm 秒で作動。作動後に rad m 以内へ誰か（置いた人も・車も）が入ると「カチッ」→ trig 秒後に爆発（ぎりぎりの回避の見せ場）
  mine: { name: '地雷', fuse: 1e9, dmg: 110, R: 5.5, push: 15, size: 0.85, r: 0.1, bounce: 0, arm: 1.5, trig: 0.7, rad: 0.6, max: 3, see: 8 },
  drum: { name: 'ドラム缶', dmg: 115, R: 7.2, push: 18, size: 1.7 },
  tnt: { name: '火薬', dmg: 150, R: 9.5, push: 24, size: 2.6 },
}
export const TYPES = ['frag', 'smoke', 'sticky', 'molotov', 'mine'] // 番号がずれないよう新しい種類は最後に足す
export const BOMB_VIS = 1.3

const M = {}
function mats() {
  if (M.iron) return M
  M.iron = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.62, metalness: 0.55 })
  M.steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.9 })
  M.can = new THREE.MeshStandardMaterial({ color: 0x6d726f, roughness: 0.5, metalness: 0.6 })
  M.band = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 })
  M.putty = new THREE.MeshStandardMaterial({ color: 0x5a5245, roughness: 0.95 })
  M.box = new THREE.MeshStandardMaterial({ color: 0x2d2b28, roughness: 0.5, metalness: 0.3 })
  M.led = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 0.2 })
  M.bottle = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 })
  M.mine = new THREE.MeshStandardMaterial({ color: 0x4d4a3e, roughness: 0.95, metalness: 0.2 })
  M.mineTop = new THREE.MeshStandardMaterial({ color: 0x3a3a32, roughness: 0.8, metalness: 0.4 })
  M.rag = new THREE.MeshStandardMaterial({ color: 0xc9b99a, roughness: 1 })
  return M
}
export function bombMesh(type) {
  const m = mats(), g = new THREE.Group()
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o }
  if (type === 'frag') {
    // 鋳物の卵形（溝つき）＋上の金具とレバー
    const body = new THREE.SphereGeometry(0.06, 20, 14); body.scale(1, 1.25, 1)
    const p = body.attributes.position
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); const k = 1 - 0.06 * (Math.abs(Math.sin(a * 4)) > 0.85 ? 1 : 0) - 0.05 * (Math.abs(Math.sin(y * 70)) > 0.9 ? 1 : 0); p.setXYZ(i, x * k, y, z * k) }
    body.computeVertexNormals()
    add(body, m.iron)
    add(new THREE.CylinderGeometry(0.022, 0.026, 0.035, 12), m.steel, 0, 0.085, 0)
    add(new THREE.BoxGeometry(0.014, 0.1, 0.022), m.steel, 0.03, 0.06, 0).rotation.z = -0.35
    add(new THREE.TorusGeometry(0.015, 0.003, 6, 12), m.steel, -0.03, 0.095, 0)
  } else if (type === 'smoke') {
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 16), m.can)
    add(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 16), m.band, 0, 0.02, 0)
    add(new THREE.CylinderGeometry(0.02, 0.024, 0.03, 10), m.steel, 0, 0.09, 0)
  } else if (type === 'molotov') {
    // 茶色い瓶と、口に詰めた布
    add(new THREE.CylinderGeometry(0.042, 0.045, 0.13, 14), m.bottle)
    add(new THREE.CylinderGeometry(0.016, 0.03, 0.05, 12), m.bottle, 0, 0.09, 0)
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.05, 8), m.rag, 0, 0.13, 0).rotation.z = 0.3
    g.userData.wick = true
  } else if (type === 'mine') {
    // 半分埋まった平たい円盤（地面に近い色）。明かりは作動の状態で色と強さを変える（mineLook）
    const mk = (geo, mat, y = 0) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; g.add(o); return o }
    mk(new THREE.CylinderGeometry(0.15, 0.17, 0.045, 24), m.mine, 0.012)
    mk(new THREE.CylinderGeometry(0.085, 0.1, 0.02, 20), m.mineTop, 0.036)
    const led = mk(new THREE.SphereGeometry(0.014, 8, 6), m.led.clone(), 0.05); led.material.emissive.setHex(0xffa020); led.material.color.setHex(0x402000)
    g.userData.led = led
    // 踏まれた後だけ出る赤い光の輪（地面に広がる）
    const glow = mk(new THREE.CircleGeometry(0.36, 28), new THREE.MeshBasicMaterial({ color: 0xff2008, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), 0.055)
    glow.rotation.x = -Math.PI / 2; glow.visible = false; g.userData.glow = glow
    // 置いた本人にだけ見える輪（作動前から場所がはっきり分かる）
    const ring = mk(new THREE.RingGeometry(0.24, 0.27, 28), new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), 0.02)
    ring.rotation.x = -Math.PI / 2; ring.visible = false; g.userData.ring = ring
    g.userData.mine = true
    return g
  } else {
    add(new THREE.BoxGeometry(0.15, 0.05, 0.1), m.box)
    const putty = new THREE.SphereGeometry(0.075, 12, 8); putty.scale(1.1, 0.35, 0.8); add(putty, m.putty, 0, -0.03, 0)
    g.userData.led = add(new THREE.SphereGeometry(0.016, 8, 6), m.led.clone(), 0.045, 0.03, 0.02)
  }
  g.scale.setScalar(BOMB_VIS) // 背景に埋もれないよう見た目を 1.3倍（当たりの r も同じだけ大きくしてある）
  return g
}
// 拾える物の見た目（小さめの木箱＋中身の色の帯）
export function itemMesh(kind) {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a6a4f, roughness: 0.85 })
  const col = { frag: 0x55663d, smoke: 0x9aa0a0, sticky: 0x8a2a1c, molotov: 0xc4701e, mine: 0xb8a418, armor: 0x2f4f7a, med: 0xd9d6cc }[kind]
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.32), wood); c.position.y = 0.12; c.castShadow = c.receiveShadow = true; g.add(c)
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.33), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); band.position.y = 0.17; g.add(band)
  if (kind === 'med') { const x = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.04), new THREE.MeshBasicMaterial({ color: 0xc81e1e })); x.position.set(0, 0.245, 0); g.add(x); const y = x.clone(); y.rotation.y = Math.PI / 2; g.add(y) }
  return g
}

// 地雷の明かり。state: 0 作動待ち 1 作動中 2 踏まれた（赤）。mine: 持ち主か（本人にははっきり見える）、dist: 見ている人からの距離
// 他の人には、遠くからはほぼ見えず、約 8m 以内で鈍く光る。踏まれた後の赤は遠くからも分かる
export function mineLook(mesh, state, mine, dist, t) {
  const led = mesh.userData.led; if (!led) return
  const see = BOMB.mine.see
  let k = mine ? 1 : Math.max(0, Math.min(1, (see - dist) / 3))
  let v
  if (state === 2) { led.material.emissive.setHex(0xff1000); v = 9 * Math.max(k, Math.max(0, Math.min(1, (40 - dist) / 25))) }
  else {
    led.material.emissive.setHex(state === 0 ? 0xffb030 : 0xffa020)
    const ph = (t * (state === 0 ? 0.9 : 0.6)) % 1 // ゆっくり点滅（作動中は短い光を間をあけて）
    v = (state === 0 ? (ph < 0.5 ? 1 : 0.1) : (ph < 0.14 ? 1 : 0.05)) * 5 * k
  }
  led.material.emissiveIntensity = v
  led.scale.setScalar(state === 2 ? 2.6 : 1)
  const gl = mesh.userData.glow; gl.visible = state === 2 && dist < 45; if (gl.visible) gl.material.opacity = (0.45 + 0.25 * Math.sin(t * 40)) * Math.max(0.35, Math.min(1, (45 - dist) / 30))
  mesh.userData.ring.visible = !!mine
}
