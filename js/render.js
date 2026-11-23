// 描画の土台: 実写の空（HDRI）・空から求めた太陽の向き・影・海・後処理
import * as THREE from 'three'
import { HDRLoader } from '../vendor/jsm/loaders/HDRLoader.js'
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js'
import { SMAAPass } from '../vendor/jsm/postprocessing/SMAAPass.js'

export function makeRenderer(el, q) {
  const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!q.shot })
  r.setPixelRatio(Math.min(devicePixelRatio, q.pr || 1.5))
  r.setSize(innerWidth, innerHeight)
  r.toneMapping = THREE.AgXToneMapping
  r.toneMappingExposure = 1.0
  r.shadowMap.enabled = true
  r.shadowMap.type = THREE.PCFSoftShadowMap
  el.appendChild(r.domElement)
  return r
}

export async function makeSky(scene, renderer) {
  const ldr = new HDRLoader(); ldr.setDataType(THREE.FloatType)
  const hdr = await ldr.loadAsync('./assets/hdr/industrial_sunset_02_puresky_2k.hdr')
  hdr.mapping = THREE.EquirectangularReflectionMapping
  // 一番明るい点＝太陽の向き
  const { data, width: W, height: H } = hdr.image
  let best = -1, bi = 0
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
    if (l > best) { best = l; bi = y * W + x }
  }
  const px = bi % W, py = Math.floor(bi / W)
  const u = (px + 0.5) / W, v = 1 - (py + 0.5) / H
  const phi = (u - 0.5) * Math.PI * 2, lat = (v - 0.5) * Math.PI
  const sunDir = new THREE.Vector3(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)).normalize()
  // 地平線の平均の色（霧の色）
  const fogC = new THREE.Color(0, 0, 0); let n = 0
  const yH = Math.floor(H / 2) - 3
  for (let x = 0; x < W; x += 4) { const i = (yH * W + x) * 4; fogC.r += data[i]; fogC.g += data[i + 1]; fogC.b += data[i + 2]; n++ }
  fogC.multiplyScalar(1 / n)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(hdr).texture
  scene.environment = env
  scene.environmentIntensity = 0.85
  scene.background = hdr
  scene.backgroundIntensity = 0.95
  scene.backgroundBlurriness = 0.0
  return { sunDir, fogC, hdr, env, sunLum: best }
}

export function makeSun(scene, sunDir, o = {}) {
  const sun = new THREE.DirectionalLight(o.color ?? 0xffd2a6, o.power ?? 3.2)
  // 夕日が低すぎると影が長すぎて画面が暗くなるので、少しだけ持ち上げる
  const d = sunDir.clone(); if (d.y < 0.22) { d.y = 0.22; d.normalize() }
  sun.position.copy(d).multiplyScalar(80)
  sun.target.position.set(0, 0, -5)
  sun.castShadow = true
  sun.shadow.mapSize.set(o.shadow || 4096, o.shadow || 4096)
  const s = sun.shadow.camera; s.left = -48; s.right = 48; s.top = 48; s.bottom = -48; s.near = 1; s.far = 260
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2.2
  sun.position.add(sun.target.position)
  scene.add(sun); scene.add(sun.target)
  const fill = new THREE.HemisphereLight(0x9bb4cf, 0x4a3b2c, o.fill ?? 0.35)
  scene.add(fill)
  return { sun, fill, dir: d }
}

// 海: 低い粗さの面に、2枚のさざ波の法線を流す
export function makeSea(scene) {
  const size = 512, c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'), img = g.createImageData(size, size)
  // 周期的なノイズから高さを作り、法線にする
  const hgt = new Float32Array(size * size)
  const waves = []
  for (let i = 0; i < 28; i++) waves.push({ kx: (1 + Math.floor(Math.random() * 9)) * (Math.random() < 0.5 ? -1 : 1), ky: (1 + Math.floor(Math.random() * 9)) * (Math.random() < 0.5 ? -1 : 1), a: 1 / (1 + i * 0.35), p: Math.random() * 6.28 })
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let h = 0
    for (const w of waves) h += w.a * Math.sin((w.kx * x + w.ky * y) / size * Math.PI * 2 + w.p)
    hgt[y * size + x] = h
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)]
    const hy = hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x]
    const nx = -hx * 0.9, ny = -hy * 0.9, nz = 1, l = Math.hypot(nx, ny, nz)
    const i = (y * size + x) * 4
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const nrm = new THREE.CanvasTexture(c); nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(128, 128) // 海を 3000m に広げたので、波1枚の大きさを前（23m）に合わせる
  const m = new THREE.MeshPhysicalMaterial({ color: 0x0b2a30, roughness: 0.07, metalness: 0, normalMap: nrm, normalScale: new THREE.Vector2(0.32, 0.32), envMapIntensity: 1.1, clearcoat: 0.4, clearcoatRoughness: 0.12 })
  const n2 = nrm.clone(); n2.repeat.set(49, 49)
  m.onBeforeCompile = sh => {
    sh.uniforms.nrm2 = { value: n2 }
    sh.uniforms.uT = { value: 0 }
    m.userData.sh = sh
    sh.fragmentShader = 'uniform sampler2D nrm2; uniform float uT;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
      vec3 mapN2 = texture2D( nrm2, vNormalMapUv * 0.383 + vec2(uT*0.006, -uT*0.004) ).xyz * 2.0 - 1.0;
      mapN = normalize(vec3(mapN.xy + mapN2.xy, mapN.z * mapN2.z));
      mapN.xy *= normalScale;
      normal = normalize( tbn * mapN );`)
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1), m)
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6; sea.receiveShadow = true
  scene.add(sea)
  return { mesh: sea, tick(t) { nrm.offset.set(t * 0.004, t * 0.0025); if (m.userData.sh) m.userData.sh.uniforms.uT.value = t } }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uWarm: { value: 0.035 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uOut: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uWarm, uFlash, uHurt, uOut, uTime; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVig * 2.2;
    c.rgb *= v;
    c.rgb += vec3(uWarm, uWarm*0.4, -uWarm*0.5) * c.rgb;
    c.rgb = mix(c.rgb, vec3(1.0, 0.92, 0.8), uFlash);
    float e = smoothstep(0.25, 0.75, length(d)); c.rgb = mix(c.rgb, c.rgb * vec3(1.0, 0.25, 0.2), uHurt * e);
    // 円の外: 全体の色を少し抜いて、円の壁と同じだいだい色に寄せる。端ほど濃く、ゆっくり脈打つ（2026-11-23）
    float g = dot(c.rgb, vec3(0.299, 0.587, 0.114)); float pul = 0.85 + 0.15 * sin(uTime * 0.00628 * 1.0);
    vec3 tint = mix(vec3(g), vec3(g) * vec3(1.35, 0.82, 0.55) + vec3(0.06, 0.02, 0.0), 1.0);
    c.rgb = mix(c.rgb, tint, uOut * (0.3 + 0.4 * e) * pul);
    c.rgb += (hash(vUv * 900.0 + uTime) - 0.5) * 0.018;
    gl_FragColor = c;
  }`,
}

export function makePost(renderer, scene, camera, q) {
  const w = innerWidth, h = innerHeight
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 })
  const comp = new EffectComposer(renderer, rt)
  comp.addPass(new RenderPass(scene, camera))
  let gtao = null
  if (!q.noao) {
    gtao = new GTAOPass(scene, camera, w, h)
    // スマホ（指で触る・狭い画面）は 8 サンプルに落とす。強さ 0.85 は面が暗く粒っぽく見えたので 0.6
    const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 500
    gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: phone ? 8 : 12 })
    gtao.blendIntensity = 0.6
    comp.addPass(gtao)
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.26, 0.5, 4.5) // 閾値 0.92→3.0: 日向の白壁と空まで光って、太陽側が白い霞に見えていた（霧ではない）。太陽と強い反射だけ光らせる
  comp.addPass(bloom)
  const grade = new ShaderPass(GradeShader)
  comp.addPass(grade)
  comp.addPass(new OutputPass())
  const smaa = new SMAAPass()
  comp.addPass(smaa)
  return { comp, gtao, bloom, grade, resize(W, H) { comp.setSize(W, H); gtao && gtao.setSize(W, H) } }
}
