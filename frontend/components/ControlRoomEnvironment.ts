import * as THREE from 'three'

interface StatusLight {
  mesh: THREE.Mesh
  baseColor: number
  blinkOffset: number
  blinkSpeed: number
}

const statusLights: StatusLight[] = []

// ─── Floor ─────────────────────────────────────────────────────────────────────

function buildFloor(scene: THREE.Scene) {
  const colorA = 0x0d1a2e
  const colorB = 0x111f35

  for (let x = -10; x < 10; x++) {
    for (let z = -10; z < 10; z++) {
      const geo = new THREE.BoxGeometry(1, 0.02, 1)
      const mat = new THREE.MeshLambertMaterial({
        color: (x + z) % 2 === 0 ? colorA : colorB,
      })
      const tile = new THREE.Mesh(geo, mat)
      tile.position.set(x + 0.5, -0.01, z + 0.5)
      scene.add(tile)
    }
  }

  // Grid lines — brighter cyan tint
  const linePoints: THREE.Vector3[] = []
  for (let i = -10; i <= 10; i++) {
    linePoints.push(new THREE.Vector3(i, 0.001, -10))
    linePoints.push(new THREE.Vector3(i, 0.001, 10))
    linePoints.push(new THREE.Vector3(-10, 0.001, i))
    linePoints.push(new THREE.Vector3(10, 0.001, i))
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a4a6c })
  const gridLines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(gridLines)

  // Reflection plane
  const reflGeo = new THREE.PlaneGeometry(20, 20)
  const reflMat = new THREE.MeshPhongMaterial({
    color: 0x000000,
    specular: 0x223344,
    shininess: 120,
    transparent: true,
    opacity: 0.35,
  })
  const refl = new THREE.Mesh(reflGeo, reflMat)
  refl.rotation.x = -Math.PI / 2
  refl.position.y = 0
  scene.add(refl)

  // LED edge strips — glowing cyan strips along floor perimeter
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x003344,
    emissive: 0x00bbdd,
    emissiveIntensity: 1.8,
  })
  const ledH = 0.04

  // Front edge (z = 10)
  const frontLed = new THREE.Mesh(new THREE.BoxGeometry(20, ledH, 0.06), ledMat)
  frontLed.position.set(0, 0, 10)
  scene.add(frontLed)

  // Left edge (x = -10)
  const leftLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, ledH, 20), ledMat)
  leftLed.position.set(-10, 0, 0)
  scene.add(leftLed)

  // Right edge (x = 10)
  const rightLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, ledH, 20), ledMat)
  rightLed.position.set(10, 0, 0)
  scene.add(rightLed)

  // LED floor point lights to cast glow
  const ledGlowF = new THREE.PointLight(0x00ccee, 1.8, 14)
  ledGlowF.position.set(0, 0.2, 10)
  scene.add(ledGlowF)
  const ledGlowL = new THREE.PointLight(0x00ccee, 1.4, 14)
  ledGlowL.position.set(-10, 0.2, 0)
  scene.add(ledGlowL)
  const ledGlowR = new THREE.PointLight(0x00ccee, 1.4, 14)
  ledGlowR.position.set(10, 0.2, 0)
  scene.add(ledGlowR)
}

// ─── Walls ─────────────────────────────────────────────────────────────────────

function buildWalls(scene: THREE.Scene) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a1628 })

  // Back wall
  const backGeo = new THREE.PlaneGeometry(22, 12)
  const backWall = new THREE.Mesh(backGeo, wallMat)
  backWall.position.set(0, 5, -10)
  scene.add(backWall)

  // Wall panels on back wall
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f3c,
    emissive: 0x001133,
    emissiveIntensity: 0.4,
  })
  for (let i = 0; i < 6; i++) {
    const pGeo = new THREE.BoxGeometry(3, 4, 0.1)
    const panel = new THREE.Mesh(pGeo, panelMat)
    panel.position.set(-7.5 + i * 3, 5, -9.9)
    scene.add(panel)
  }

  // Left wall
  const leftGeo = new THREE.PlaneGeometry(22, 12)
  const leftWall = new THREE.Mesh(leftGeo, wallMat)
  leftWall.rotation.y = Math.PI / 2
  leftWall.position.set(-10, 5, 0)
  scene.add(leftWall)

  // Right wall
  const rightGeo = new THREE.PlaneGeometry(22, 12)
  const rightWall = new THREE.Mesh(rightGeo, wallMat)
  rightWall.rotation.y = -Math.PI / 2
  rightWall.position.set(10, 5, 0)
  scene.add(rightWall)
}

// ─── Decorative Tech Panels ────────────────────────────────────────────────────

function buildTechPanels(scene: THREE.Scene) {
  const panelColors = [0x00ff44, 0xff3300, 0xffaa00]
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f3c,
    emissive: 0x001133,
    emissiveIntensity: 0.5,
  })

  for (let i = 0; i < 10; i++) {
    const pGeo = new THREE.BoxGeometry(0.8, 3, 0.05)
    const panel = new THREE.Mesh(pGeo, panelMat)
    const xPos = -9 + i * 1.9
    panel.position.set(xPos, 4.5, -9.85)
    scene.add(panel)

    // Status light on each panel
    const lightColor = panelColors[Math.floor(Math.random() * panelColors.length)]
    const lightGeo = new THREE.SphereGeometry(0.08, 8, 8)
    const lightMat = new THREE.MeshBasicMaterial({ color: lightColor })
    const light = new THREE.Mesh(lightGeo, lightMat)
    light.position.set(xPos, 6.2, -9.8)
    scene.add(light)

    statusLights.push({
      mesh: light,
      baseColor: lightColor,
      blinkOffset: Math.random() * Math.PI * 2,
      blinkSpeed: 0.5 + Math.random() * 1.5,
    })
  }
}

// ─── Ceiling ───────────────────────────────────────────────────────────────────

function buildCeiling(scene: THREE.Scene) {
  const ceilGeo = new THREE.PlaneGeometry(22, 22)
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x050d1a })
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = 8
  scene.add(ceiling)

  // Ceiling detail panels
  const detailMat = new THREE.MeshLambertMaterial({ color: 0x0a1628 })
  for (let i = 0; i < 8; i++) {
    const dGeo = new THREE.BoxGeometry(4, 0.1, 1)
    const detail = new THREE.Mesh(dGeo, detailMat)
    detail.position.set(-7 + i * 2, 7.95, 0)
    scene.add(detail)
  }

  // Ceiling light fixtures
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0x001133,
    emissive: 0x002255,
    emissiveIntensity: 0.8,
  })

  const fixtureXPositions = [-8, -4, 0, 4, 8]
  for (const xPos of fixtureXPositions) {
    const fGeo = new THREE.BoxGeometry(2, 0.1, 0.5)
    const fixture = new THREE.Mesh(fGeo, fixtureMat)
    fixture.position.set(xPos, 7.8, 0)
    scene.add(fixture)

    const spot = new THREE.SpotLight(0x4488ff, 2, 12, 0.4, 0.3)
    spot.position.set(xPos, 7.8, 0)
    spot.target.position.set(xPos, 0, 0)
    scene.add(spot)
    scene.add(spot.target)
  }
}

// ─── Workstation Consoles ──────────────────────────────────────────────────────

let _monitorIndex = 0
function makeMonitorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000d18'
  ctx.fillRect(0, 0, 256, 160)

  const style = _monitorIndex++ % 4
  if (style === 0) {
    // Pipeline health — blue bars
    ctx.fillStyle = '#0088ff'
    for (let row = 0; row < 7; row++) {
      const w = 60 + Math.random() * 160
      ctx.fillRect(10, 12 + row * 20, w, 7)
    }
    ctx.fillStyle = '#004488'
    ctx.fillRect(5, 5, 246, 1)
  } else if (style === 1) {
    // Alert station — amber warning header + bars
    ctx.fillStyle = '#ff8800'
    ctx.fillRect(5, 5, 246, 18)
    ctx.fillStyle = '#ffaa44'
    for (let row = 0; row < 5; row++) {
      const w = 40 + Math.random() * 180
      ctx.fillRect(10, 30 + row * 24, w, 6)
    }
  } else if (style === 2) {
    // Quality monitor — teal arcs / scores
    ctx.fillStyle = '#00ddaa'
    for (let row = 0; row < 8; row++) {
      const w = 80 + Math.random() * 140
      ctx.fillRect(10, 10 + row * 18, w, 5)
    }
    ctx.fillStyle = '#00aa88'
    ctx.fillRect(5, 150, 246, 1)
  } else {
    // Telemetry — cyan data feed
    ctx.fillStyle = '#00aaff'
    for (let row = 0; row < 6; row++) {
      const w = 70 + Math.random() * 150
      ctx.fillRect(10, 15 + row * 22, w, 6)
    }
  }

  return new THREE.CanvasTexture(canvas)
}

function buildConsole(scene: THREE.Scene, x: number, z: number, rotY: number) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotY

  // Desk surface
  const deskGeo = new THREE.BoxGeometry(2.5, 0.1, 1.2)
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x1a2535 })
  const desk = new THREE.Mesh(deskGeo, deskMat)
  desk.position.y = 0.84
  group.add(desk)

  // Desk legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x111a25 })
  const legGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08)
  const legOffsets: [number, number][] = [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(lx, 0.4, lz)
    group.add(leg)
  }

  // Monitor stand
  const standGeo = new THREE.BoxGeometry(0.15, 0.3, 0.1)
  const standMat = new THREE.MeshLambertMaterial({ color: 0x0a1020 })
  const stand = new THREE.Mesh(standGeo, standMat)
  stand.position.set(0, 1.03, -0.3)
  group.add(stand)

  // Main monitor
  const monGeo = new THREE.BoxGeometry(1.4, 0.9, 0.08)
  const monMat = new THREE.MeshStandardMaterial({
    color: 0x020d18,
    emissive: 0x0044aa,
    emissiveIntensity: 0.9,
  })
  const monitor = new THREE.Mesh(monGeo, monMat)
  monitor.position.set(0, 1.45, -0.32)
  monitor.rotation.x = -0.175
  group.add(monitor)

  // Monitor screen
  const screenGeo = new THREE.PlaneGeometry(1.1, 0.7)
  const screenMat = new THREE.MeshBasicMaterial({ map: makeMonitorTexture() })
  const screen = new THREE.Mesh(screenGeo, screenMat)
  screen.position.set(0, 1.45, -0.29)
  screen.rotation.x = -0.175
  group.add(screen)

  // Keyboard
  const kbGeo = new THREE.BoxGeometry(0.8, 0.02, 0.35)
  const kbMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2a })
  const kb = new THREE.Mesh(kbGeo, kbMat)
  kb.position.set(0, 0.9, 0.1)
  group.add(kb)

  // Mouse
  const mouseGeo = new THREE.BoxGeometry(0.12, 0.03, 0.18)
  const mouseMat = new THREE.MeshLambertMaterial({ color: 0x222233 })
  const mouse = new THREE.Mesh(mouseGeo, mouseMat)
  mouse.position.set(0.55, 0.9, 0.05)
  group.add(mouse)

  // Status lights row
  const deskLightColors = [0x00ff44, 0xffaa00, 0xff3300]
  for (let i = 0; i < 3; i++) {
    const slGeo = new THREE.SphereGeometry(0.06, 6, 6)
    const slMat = new THREE.MeshBasicMaterial({ color: deskLightColors[i] })
    const sl = new THREE.Mesh(slGeo, slMat)
    sl.position.set(-0.15 + i * 0.15, 0.9, 0.42)
    group.add(sl)

    statusLights.push({
      mesh: sl,
      baseColor: deskLightColors[i],
      blinkOffset: Math.random() * Math.PI * 2,
      blinkSpeed: 0.3 + Math.random() * 1.0,
    })
  }

  // Chair seat
  const seatGeo = new THREE.BoxGeometry(0.7, 0.08, 0.7)
  const chairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2a })
  const seat = new THREE.Mesh(seatGeo, chairMat)
  seat.position.set(0, 0.7, 0.75)
  group.add(seat)

  // Chair back
  const backGeo = new THREE.BoxGeometry(0.7, 0.8, 0.08)
  const back = new THREE.Mesh(backGeo, chairMat)
  back.position.set(0, 1.15, 1.07)
  group.add(back)

  // Chair legs (cylinders approximated as boxes)
  const clegMat = new THREE.MeshLambertMaterial({ color: 0x0d1220 })
  const clegGeo = new THREE.BoxGeometry(0.05, 0.65, 0.05)
  const clegOffsets: [number, number][] = [[-0.28, 0.42], [0.28, 0.42], [-0.28, 1.08], [0.28, 1.08]]
  for (const [cx, cz] of clegOffsets) {
    const cl = new THREE.Mesh(clegGeo, clegMat)
    cl.position.set(cx, 0.35, cz)
    group.add(cl)
  }

  scene.add(group)
}

function buildConsoles(scene: THREE.Scene) {
  // [x, z, rotY] — matched to CHARACTER_DEFS arc layout
  const positions: Array<[number, number, number]> = [
    [ -8, -6,  0              ],  // front-left console (char 0)
    [ -4, -7,  0              ],  // left-center front  (char 1)
    [  0, -7,  0              ],  // center front       (char 2)
    [  4, -6,  0              ],  // right front        (char 3)
    [ -7, -2,  0.15           ],  // mid-left           (char 4)
    [ -3, -3,  0              ],  // mid center-left    (char 5)
    [  2, -2,  0.2            ],  // mid center-right   (char 6)
    [  5, -3,  Math.PI * 0.15 ],  // right-side console (extra)
  ]
  for (const [x, z, ry] of positions) {
    buildConsole(scene, x, z, ry)
  }
}

// ─── Lighting ──────────────────────────────────────────────────────────────────

function buildLighting(scene: THREE.Scene) {
  // Remove any existing lights
  const toRemove: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) toRemove.push(obj)
  })
  toRemove.forEach((obj) => scene.remove(obj))

  scene.add(new THREE.AmbientLight(0x1a2a40, 3.2))

  const key = new THREE.DirectionalLight(0xffffff, 2.8)
  key.position.set(8, 15, 8)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x4488cc, 1.8)
  fill.position.set(-8, 10, -8)
  scene.add(fill)

  // Main screen bounce — large cyan fill across the whole room floor
  const screenGlow = new THREE.PointLight(0x00ddff, 8.0, 40)
  screenGlow.position.set(-0.5, 5, -6.5)
  scene.add(screenGlow)

  // Secondary floor fill — warm the center
  const centerFill = new THREE.PointLight(0x2255cc, 2.0, 30)
  centerFill.position.set(0, 5, 2)
  scene.add(centerFill)

  // Rim light from right side for depth
  const rimLight = new THREE.DirectionalLight(0x003366, 1.2)
  rimLight.position.set(12, 8, -2)
  scene.add(rimLight)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function createEnvironment(scene: THREE.Scene): void {
  buildFloor(scene)
  buildWalls(scene)
  buildTechPanels(scene)
  buildCeiling(scene)
  buildConsoles(scene)
  buildLighting(scene)
}

export function updateEnvironment(elapsed: number): void {
  for (const sl of statusLights) {
    const mat = sl.mesh.material as THREE.MeshBasicMaterial
    const on = Math.sin(elapsed * sl.blinkSpeed + sl.blinkOffset) > 0
    mat.color.setHex(on ? sl.baseColor : 0x111111)
  }
}