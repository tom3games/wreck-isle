// 人だけ止める柵（kind:'edge'）のうち、目に見える物が無い所に鉄パイプの手すりを立てる（2026-11-20 本人「岸の柵も見えるように」）
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'

export function buildRails(scene, world) {
  const solid = []
  // 新しい陸の地面・木・草（noRay）は光線の相手にしない（起動が 12秒延びた 2026-11-23）
  scene.traverse(o => { if (o.userData.noRay) return; if (o.isMesh || o.isInstancedMesh) solid.push(o) })
  const ray = new THREE.Raycaster()
  const posts = [], bars = []
  let n = 0
  for (const b of world.boxes) {
    if (b.dead || b.kind !== 'edge' || b.tag === 'fenced') continue // 見える手すりを自分で付けた柵は飛ばす
    const top = b.max[1], base = Math.max(b.min[1], top - 1.05)
    if (top - base < 0.5) continue
    const lx = b.max[0] - b.min[0], lz = b.max[2] - b.min[2], alongX = lx >= lz
    const L = alongX ? lx : lz, cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2
    // 目に見える物がもう有るか（箱の中を横切る光線を数か所）
    let seen = 0, tries = 0
    for (let t = 0.1; t < 1; t += 0.2) {
      tries++
      const px = alongX ? b.min[0] + lx * t : cx - 0.6, pz = alongX ? cz - 0.6 : b.min[2] + lz * t
      ray.set(new THREE.Vector3(px, base + (top - base) * 0.6, pz), new THREE.Vector3(alongX ? 0 : 1, 0, alongX ? 1 : 0)); ray.far = 1.2
      if (ray.intersectObjects(solid, false).length) seen++
    }
    if (seen >= tries * 0.6) continue
    const h = top - base, k = Math.max(2, Math.ceil(L / 1.8))
    for (let i = 0; i <= k; i++) {
      const s = i / k, x = alongX ? b.min[0] + lx * s : cx, z = alongX ? cz : b.min[2] + lz * s
      const p = new THREE.CylinderGeometry(0.03, 0.03, h, 8); p.translate(x, base + h / 2, z); posts.push(p)
    }
    for (const y of [base + h * 0.5, top - 0.04]) {
      const r = new THREE.CylinderGeometry(0.024, 0.024, L, 8)
      if (alongX) r.rotateZ(Math.PI / 2); else r.rotateX(Math.PI / 2)
      r.translate(cx, y, cz); bars.push(r)
    }
    n++
  }
  if (!n) return 0
  const m = new THREE.MeshStandardMaterial({ color: 0x9aa1a3, roughness: 0.45, metalness: 0.7 })
  const mesh = new THREE.Mesh(mergeGeometries([...posts, ...bars]), m)
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'rails'
  scene.add(mesh)
  return n
}
