// 見た目の形から当たりを作る。物を 0.5m 角の柱に刻み、上と下から光線を当てて、物がある高さだけ箱にする。
// 斜めに置いた重機や丸い岩を、囲む四角の箱にすると角が「見えない壁」になるため（2026-11-20）
import * as THREE from 'three'
const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), dn = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3()
export function colFromMesh(world, obj, { cell = 0.5, minH = 0.12, kind = 'solid' } = {}) {
  obj.updateMatrixWorld(true)
  const bb = new THREE.Box3().setFromObject(obj)
  const meshes = []; obj.traverse(m => { if (m.isMesh) meshes.push(m) })
  let n = 0
  for (let x = bb.min.x + cell / 2; x < bb.max.x; x += cell) for (let z = bb.min.z + cell / 2; z < bb.max.z; z += cell) {
    ray.set(o.set(x, bb.max.y + 1, z), dn); ray.far = bb.max.y - bb.min.y + 2
    const top = ray.intersectObjects(meshes, false)[0]; if (!top) continue
    ray.set(o.set(x, bb.min.y - 1, z), up)
    const bot = ray.intersectObjects(meshes, false)[0]
    const y0 = bot ? bot.point.y : bb.min.y, y1 = top.point.y
    if (y1 - y0 < minH) continue
    world.add({ min: [x - cell / 2, y0, z - cell / 2], max: [x + cell / 2, y1, z + cell / 2], kind }); n++
  }
  return n
}
