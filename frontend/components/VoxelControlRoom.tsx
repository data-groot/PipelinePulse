'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createCharacter, updateCharacters, CHARACTER_CONFIGS, CharacterData, CharacterConfig } from './VoxelCharacters'
import { createMonitoringCanvas, updateMonitoringCanvas } from './MonitoringScreen'
import { createEnvironment, updateEnvironment, CONSOLE_POSITIONS } from './ControlRoomEnvironment'

// ─── Extra character configs beyond the 8 presets ─────────────────────────────

const EXTRA_CONFIGS: CharacterConfig[] = [
  {
    shirtColor: 0x33DDAA, pantsColor: 0x1a2a4a, hairColor: 0x1a0a00,
    shoeColor: 0x0a0a0a, hasLabCoat: false, pose: 'walking', name: 'lab_tech',
  },
  {
    shirtColor: 0xFF6633, pantsColor: 0x1a2a4a, hairColor: 0x0a0a0a,
    shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'pointing', name: 'rocket_lead',
  },
]

// Poses reordered so the six console seats get seated characters
const SEATED = { pose: 'seated' as const }
const CONFIGS: CharacterConfig[] = [
  { ...CHARACTER_CONFIGS[0] },                     // seated
  { ...CHARACTER_CONFIGS[3] },                     // seated
  { ...CHARACTER_CONFIGS[7] },                     // seated
  { ...CHARACTER_CONFIGS[1], ...SEATED },          // seated (was standing)
  { ...CHARACTER_CONFIGS[5], ...SEATED },          // seated (was standing)
  { ...CHARACTER_CONFIGS[2], ...SEATED },          // seated (was walking)
  { ...CHARACTER_CONFIGS[4] },                     // pointing — ops lead
  { ...CHARACTER_CONFIGS[6] },                     // walking
  { ...EXTRA_CONFIGS[0] },                         // walking
  { ...EXTRA_CONFIGS[1], pose: 'standing' },       // standing supervisor
]

const CHAR_SCALE = 0.78
// Seated characters sit on the console stools (stool top ≈ y 0.69,
// seated hip pivot at 0.85 * scale ≈ 0.66 → group y ≈ 0.1 puts them on it)
const SEAT_Y = 0.12
const SEAT_Z_OFFSET = 1.05

export default function VoxelControlRoom() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    // ── Renderer — filmic tone mapping + soft shadows ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(800, 600)
    renderer.setClearColor('#040814', 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    // ── Scene ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#040814')
    scene.fog = new THREE.Fog('#040814', 45, 110)

    // ── Camera — wide cinematic 3/4 view ──
    const frustumSize = 33.5
    const aspect = 800 / 600
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    )
    camera.position.set(17, 14, 22)
    camera.lookAt(0, 4.0, -3)

    const applySize = () => {
      const w = mount.offsetWidth || 800
      const h = mount.offsetHeight || 600
      renderer.setSize(w, h)
      composer.setSize(w, h)
      const a = w / h
      camera.left = (-frustumSize * a) / 2
      camera.right = (frustumSize * a) / 2
      camera.top = frustumSize / 2
      camera.bottom = -frustumSize / 2
      camera.updateProjectionMatrix()
    }
    const sizeTimeout = setTimeout(applySize, 100)

    // ── Environment ──
    createEnvironment(scene)

    // ── Characters ──
    // First six sit at the consoles; the rest stand/walk on the open floor.
    const defs: { pos: [number, number, number]; rotY: number }[] = [
      // Seated operators face their monitors (-z), backs to the camera —
      // classic mission-control composition.
      ...CONSOLE_POSITIONS.map(([x, z]): { pos: [number, number, number]; rotY: number } => ({
        pos: [x, SEAT_Y, z + SEAT_Z_OFFSET],
        rotY: Math.PI,
      })),
      { pos: [8.6, 0, -3.6], rotY: Math.PI - 0.35 },  // ops lead pointing at the wall
      { pos: [-4, 0, 2.6], rotY: Math.PI * 0.5 },   // walker lane 1
      { pos: [4, 0, 4.6], rotY: -Math.PI * 0.5 },   // walker lane 2
      { pos: [-8.8, 0, -0.4], rotY: 0.9 },  // standing supervisor, angled to camera
    ]

    const characters: CharacterData[] = defs.map((def, i) => {
      const char = createCharacter(scene, def.pos, CONFIGS[i])
      char.group.scale.set(CHAR_SCALE, CHAR_SCALE, CHAR_SCALE)
      char.group.rotation.y = def.rotY
      return char
    })

    // Everything voxel casts and receives shadows
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
        obj.castShadow = true
      }
    })

    // ── Monitoring wall — dominant visual anchor ──
    const monitorCanvas = createMonitoringCanvas()
    const monitorTexture = new THREE.CanvasTexture(monitorCanvas)
    monitorTexture.colorSpace = THREE.SRGBColorSpace

    const screenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(20, 10.5, 0.15),
      new THREE.MeshBasicMaterial({ map: monitorTexture })
    )
    screenMesh.position.set(0, 6.4, -9.9)
    scene.add(screenMesh)

    // Slim glowing bezel instead of the old thick block frame
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(20.7, 11.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x02222e, emissive: 0x00a8d8, emissiveIntensity: 1.6 })
    )
    bezel.position.set(0, 6.4, -9.98)
    scene.add(bezel)

    // ── Floating particles ──
    const particleCount = 26
    const particleGeometry = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    const particleVelocities = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 30
      particlePositions[i * 3 + 1] = Math.random() * 16
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 22
      particleVelocities[i] = 0.015 + Math.random() * 0.025
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x4fe3c1,
        size: 0.09,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      })
    )
    scene.add(particles)

    // ── Post-processing: subtle bloom sells the glow ──
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.55, 0.6, 0.82)
    composer.addPass(bloom)

    window.addEventListener('resize', applySize)

    // ── Mouse parallax — the scene subtly follows the cursor ──
    const pointer = { x: 0, y: 0 }
    const pointerSmooth = { x: 0, y: 0 }
    const handlePointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', handlePointer)

    // ── Animation loop ──
    const startTime = Date.now()
    const initialCamPos = camera.position.clone()
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsed = (Date.now() - startTime) / 1000

      // Ease the pointer target for a weighty, cinematic follow
      pointerSmooth.x += (pointer.x - pointerSmooth.x) * 0.04
      pointerSmooth.y += (pointer.y - pointerSmooth.y) * 0.04

      // Slow drift + mouse parallax
      camera.position.x = initialCamPos.x + Math.sin(elapsed * 0.08) * 0.25 + pointerSmooth.x * 1.6
      camera.position.y = initialCamPos.y + Math.cos(elapsed * 0.11) * 0.15 - pointerSmooth.y * 1.0
      camera.lookAt(0, 4.0, -3)

      updateCharacters(characters, elapsed)

      // Walkers patrol separate z-lanes behind the consoles
      const c7 = characters[7]
      const c7vel = Math.cos(elapsed * 0.22)
      c7.group.position.x = -4 + 3.4 * Math.sin(elapsed * 0.22)
      c7.group.position.z = 2.6
      c7.group.rotation.y = c7vel > 0 ? Math.PI * 0.5 : -Math.PI * 0.5

      const c8 = characters[8]
      const c8vel = Math.cos(elapsed * 0.17)
      c8.group.position.x = 4 + 3 * Math.sin(elapsed * 0.17)
      c8.group.position.z = 4.6
      c8.group.rotation.y = c8vel > 0 ? Math.PI * 0.5 : -Math.PI * 0.5

      updateEnvironment(elapsed)

      updateMonitoringCanvas(monitorCanvas, elapsed)
      monitorTexture.needsUpdate = true

      composer.render()
    }

    animate()

    // ── Cleanup ──
    return () => {
      clearTimeout(sizeTimeout)
      window.removeEventListener('resize', applySize)
      window.removeEventListener('pointermove', handlePointer)
      cancelAnimationFrame(animId)
      monitorTexture.dispose()
      composer.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
}
