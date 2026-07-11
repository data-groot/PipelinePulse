import * as THREE from 'three'

interface StatusLight {
  mesh: THREE.Mesh
  baseColor: number
  blinkOffset: number
  blinkSpeed: number
}

const statusLights: StatusLight[] = []

// Room footprint (diorama platform)
export const ROOM = { minX: -12, maxX: 12, minZ: -10, maxZ: 7 }

// ─── Diorama platform floor ───────────────────────────────────────────────────

function buildFloor(scene: THREE.Scene) {
  const w = ROOM.maxX - ROOM.minX
  const d = ROOM.maxZ - ROOM.minZ
  const cx = (ROOM.minX + ROOM.maxX) / 2
  const cz = (ROOM.minZ + ROOM.maxZ) / 2

  // Thick base slab so the room reads as a floating platform, not a grid
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w + 1.2, 1.4, d + 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0b1424, roughness: 0.9 })
  )
  base.position.set(cx, -0.72, cz)
  scene.add(base)

  // Visible checker tiles, lighter than v1 so the floor actually shows up
  const tileA = new THREE.MeshStandardMaterial({ color: 0x16263f, roughness: 0.55, metalness: 0.25 })
  const tileB = new THREE.MeshStandardMaterial({ color: 0x1d3050, roughness: 0.55, metalness: 0.25 })
  for (let x = ROOM.minX; x < ROOM.maxX; x += 2) {
    for (let z = ROOM.minZ; z < ROOM.maxZ; z += 2) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 1.94), (x / 2 + z / 2) % 2 === 0 ? tileA : tileB)
      tile.position.set(x + 1, 0, z + 1)
      tile.receiveShadow = true
      scene.add(tile)
    }
  }

  // Glowing seam lines between tile rows
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x06263a,
    emissive: 0x0a5f7d,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  })
  for (let x = ROOM.minX; x <= ROOM.maxX; x += 2) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, d), seamMat)
    seam.position.set(x, 0, cz)
    scene.add(seam)
  }
  for (let z = ROOM.minZ; z <= ROOM.maxZ; z += 2) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.065, 0.05), seamMat)
    seam.position.set(cx, 0, z)
    scene.add(seam)
  }

  // Bright LED strip wrapping the platform edge — defines the silhouette
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x022a33,
    emissive: 0x00d5ff,
    emissiveIntensity: 2.4,
  })
  const edgeH = 0.12
  const mkEdge = (bw: number, bd: number, x: number, z: number) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(bw, edgeH, bd), edgeMat)
    e.position.set(x, 0.03, z)
    scene.add(e)
  }
  mkEdge(w + 1.2, 0.12, cx, ROOM.maxZ + 0.56)
  mkEdge(w + 1.2, 0.12, cx, ROOM.minZ - 0.56)
  mkEdge(0.12, d + 1.2, ROOM.minX - 0.56, cz)
  mkEdge(0.12, d + 1.2, ROOM.maxX + 0.56, cz)
}

// ─── Back wall + wing screens (no ceiling — it reads as a floating slab) ─────

function buildWalls(scene: THREE.Scene) {
  const cx = 0

  // Back wall: solid, double-sided so it never gets culled from any angle
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(25, 13, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x0c1930, roughness: 0.85 })
  )
  wall.position.set(cx, 6.2, -10.4)
  wall.receiveShadow = true
  scene.add(wall)

  // Horizontal accent lines across the wall
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x05202e,
    emissive: 0x0891b2,
    emissiveIntensity: 1.1,
  })
  for (const y of [0.6, 12.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(25, 0.1, 0.06), accentMat)
    strip.position.set(cx, y, -10.1)
    scene.add(strip)
  }

  // Low side walls (waist height) — diorama style, they never occlude the action
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x0c1930, roughness: 0.85 })
  const sideCap = new THREE.MeshStandardMaterial({
    color: 0x022a33,
    emissive: 0x00b5d8,
    emissiveIntensity: 1.4,
  })
  for (const sx of [ROOM.minX - 0.3, ROOM.maxX + 0.3]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 16.5), sideMat)
    side.position.set(sx, 0.8, -1.9)
    scene.add(side)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 16.5), sideCap)
    cap.position.set(sx, 1.64, -1.9)
    scene.add(cap)
  }
}

// ─── Wing screens flanking the main wall ─────────────────────────────────────

function makeWingTexture(accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 384
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#03111f'
  ctx.fillRect(0, 0, 256, 384)
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.9
  // Fake line chart
  ctx.beginPath()
  ctx.lineWidth = 3
  for (let x = 0; x <= 256; x += 16) {
    const y = 90 + Math.sin(x * 0.05) * 30 + Math.random() * 18
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  // Data rows
  ctx.globalAlpha = 0.75
  ctx.fillStyle = accent
  for (let row = 0; row < 9; row++) {
    ctx.fillRect(16, 170 + row * 22, 40 + Math.random() * 170, 6)
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function buildWingScreens(scene: THREE.Scene) {
  const defs: { x: number; rotY: number; accent: string }[] = [
    { x: -11.2, rotY: 0.62, accent: '#a78bfa' },
    { x: 11.2, rotY: -0.62, accent: '#ffb454' },
  ]
  for (const { x, rotY, accent } of defs) {
    const g = new THREE.Group()
    g.position.set(x, 4.6, -8.2)
    g.rotation.y = rotY

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 8.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0a1526, roughness: 0.6 })
    )
    g.add(frame)

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.9, 7.7),
      new THREE.MeshBasicMaterial({ map: makeWingTexture(accent) })
    )
    screen.position.z = 0.16
    g.add(screen)

    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x02222e,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 1.6,
    })
    const glow = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 0.32), glowMat)
    glow.position.y = -4.2
    g.add(glow)

    scene.add(g)
  }
}

// ─── Workstation consoles ─────────────────────────────────────────────────────

let _monitorIndex = 0
function makeMonitorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#03111f'
  ctx.fillRect(0, 0, 256, 160)

  const style = _monitorIndex++ % 4
  const palettes = ['#22b8ff', '#ffb454', '#2ee6c8', '#7fd8ff']
  ctx.fillStyle = palettes[style]
  ctx.globalAlpha = 0.85
  if (style === 1) {
    ctx.fillRect(6, 6, 244, 16)
    for (let row = 0; row < 5; row++) ctx.fillRect(10, 32 + row * 24, 40 + Math.random() * 180, 6)
  } else {
    for (let row = 0; row < 7; row++) ctx.fillRect(10, 12 + row * 20, 50 + Math.random() * 170, 7)
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function buildConsole(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x24354f, roughness: 0.45, metalness: 0.35 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141f31, roughness: 0.6 })

  // Chunky console body (solid pedestal desk — no spindly legs)
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 1.1), bodyMat)
  body.position.set(0, 0.45, -0.15)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Desktop slab with slight overhang
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 1.35), darkMat)
  top.position.set(0, 0.92, -0.1)
  top.castShadow = true
  group.add(top)

  // Glowing front trim on the console
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.06, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x022a33, emissive: 0x00c8f0, emissiveIntensity: 1.8 })
  )
  trim.position.set(0, 0.8, 0.43)
  group.add(trim)

  // Dual angled monitors
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), darkMat)
    arm.position.set(side * 0.62, 1.1, -0.42)
    group.add(arm)

    const mon = new THREE.Group()
    mon.position.set(side * 0.62, 1.55, -0.45)
    mon.rotation.y = side * -0.18
    mon.rotation.x = -0.12

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 0.07), darkMat)
    bezel.castShadow = true
    mon.add(bezel)
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.72),
      new THREE.MeshBasicMaterial({ map: makeMonitorTexture() })
    )
    screen.position.z = 0.045
    mon.add(screen)
    group.add(mon)
  }

  // Keyboard
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.34), new THREE.MeshStandardMaterial({ color: 0x1b2436, roughness: 0.5 }))
  kb.position.set(0, 0.99, 0.22)
  group.add(kb)

  // Status lights on the desk edge
  const deskLightColors = [0x2ee676, 0xffb454, 0xff5a4e]
  for (let i = 0; i < 3; i++) {
    const sl = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: deskLightColors[i] })
    )
    sl.position.set(0.85 + i * 0.18, 0.99, 0.35)
    group.add(sl)
    statusLights.push({
      mesh: sl,
      baseColor: deskLightColors[i],
      blinkOffset: Math.random() * Math.PI * 2,
      blinkSpeed: 0.3 + Math.random() * 1.0,
    })
  }

  // Stool (simple block seat — the character sits on it)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.75), darkMat)
  seat.position.set(0, 0.62, 1.05)
  seat.castShadow = true
  group.add(seat)
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), darkMat)
  post.position.set(0, 0.28, 1.05)
  group.add(post)

  scene.add(group)
}

// Console positions — front arc + second row. Characters are seated to match
// (see CONSOLE_SEATS import in VoxelControlRoom).
export const CONSOLE_POSITIONS: Array<[number, number]> = [
  [-6.4, -6.2],
  [-2.2, -6.8],
  [2.2, -6.8],
  [6.4, -6.2],
  [-4.2, -2.6],
  [4.2, -2.6],
]

function buildConsoles(scene: THREE.Scene) {
  for (const [x, z] of CONSOLE_POSITIONS) buildConsole(scene, x, z)
}

// ─── Lighting ─────────────────────────────────────────────────────────────────

function buildLighting(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0x223a5e, 1.1))

  const hemi = new THREE.HemisphereLight(0x3a5f8a, 0x0a1220, 1.2)
  scene.add(hemi)

  // Key light — casts the shadows that ground everything
  const key = new THREE.DirectionalLight(0xcfe8ff, 2.2)
  key.position.set(14, 20, 14)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -18
  key.shadow.camera.right = 18
  key.shadow.camera.top = 18
  key.shadow.camera.bottom = -18
  key.shadow.camera.near = 1
  key.shadow.camera.far = 60
  key.shadow.bias = -0.0004
  scene.add(key)

  // Cool fill from the screen side
  const fill = new THREE.DirectionalLight(0x2a6fb0, 0.9)
  fill.position.set(-10, 8, -6)
  scene.add(fill)

  // Cyan wash from the big screen onto the floor and characters
  const screenGlow = new THREE.PointLight(0x00c8ff, 60, 40, 1.8)
  screenGlow.position.set(0, 6, -7)
  scene.add(screenGlow)

  // Warm amber accent from the right wing screen
  const amber = new THREE.PointLight(0xff9a3c, 25, 26, 1.9)
  amber.position.set(10, 5, -6)
  scene.add(amber)

  // Violet accent from the left wing screen
  const violet = new THREE.PointLight(0x8b7cff, 24, 26, 1.9)
  violet.position.set(-10, 5, -6)
  scene.add(violet)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createEnvironment(scene: THREE.Scene): void {
  statusLights.length = 0
  buildFloor(scene)
  buildWalls(scene)
  buildWingScreens(scene)
  buildConsoles(scene)
  buildLighting(scene)
}

export function updateEnvironment(elapsed: number): void {
  for (const sl of statusLights) {
    const mat = sl.mesh.material as THREE.MeshBasicMaterial
    const on = Math.sin(elapsed * sl.blinkSpeed + sl.blinkOffset) > 0
    mat.color.setHex(on ? sl.baseColor : 0x223344)
  }
}
