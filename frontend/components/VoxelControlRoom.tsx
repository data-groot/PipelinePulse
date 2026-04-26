'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createCharacter, updateCharacters, CHARACTER_CONFIGS, CharacterData, CharacterConfig } from './VoxelCharacters'
import { createMonitoringCanvas, updateMonitoringCanvas } from './MonitoringScreen'
import { createEnvironment, updateEnvironment } from './ControlRoomEnvironment'

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

const ALL_CONFIGS = [...CHARACTER_CONFIGS, ...EXTRA_CONFIGS]

// ─── Layout: 10 characters in 3 rows, minimum 2.5-unit spacing ───────────────

const CHARACTER_DEFS: { pos: [number, number, number]; rotY: number }[] = [
  // Row 1 — seated at front consoles (arc facing screen)
  { pos: [-8, 0, -5], rotY:  0    },  // 0 seated, far-left console
  { pos: [-4, 0, -6], rotY:  0    },  // 1 seated, left-center console
  { pos: [ 0, 0, -6], rotY:  0    },  // 2 seated, center console
  { pos: [ 4, 0, -5], rotY:  0    },  // 3 standing at right console
  // Row 2 — mid-floor operators
  { pos: [-7, 0, -1], rotY:  0.2  },  // 4 standing, left-mid
  { pos: [-3, 0, -2], rotY:  0    },  // 5 seated, center-left
  { pos: [ 2, 0, -1], rotY:  0.3  },  // 6 pointing toward screen
  // Row 3 — walkers on separate z-lanes
  { pos: [-5, 0,  3], rotY:  1.57 },  // 7 walking, lane z=3
  { pos: [ 5, 0,  1], rotY: -1.57 },  // 8 walking, lane z=1
  { pos: [ 7, 0,  4], rotY: -0.5  },  // 9 pointing, back-right
]

// ─── Collision check ──────────────────────────────────────────────────────────

function checkSpacing(defs: typeof CHARACTER_DEFS): void {
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const [ax, , az] = defs[i].pos
      const [bx, , bz] = defs[j].pos
      const dist = Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2)
      if (dist < 2.5) {
        console.warn(
          `[VoxelControlRoom] Char ${i} and Char ${j} are ${dist.toFixed(2)} units apart — below 2.5 minimum`
        )
      }
    }
  }
  console.log('[VoxelControlRoom] Character positions:')
  defs.forEach((d, i) =>
    console.log(`  Char ${i}: [${d.pos.map((v) => v.toFixed(1)).join(', ')}]`)
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoxelControlRoom() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(800, 600)
    renderer.setClearColor('#040814', 1)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    // ── Scene ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#040814')
    scene.fog = new THREE.Fog('#040814', 35, 95)

    // ── Camera — wide cinematic arc view ──
    const frustumSize = 34
    const aspect = 800 / 600
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    )
    camera.position.set(15, 13, 21)
    camera.lookAt(-0.5, 1.5, -4)

    // Correct size after DOM paint
    const sizeTimeout = setTimeout(() => {
      const w = mount.offsetWidth || 800
      const h = mount.offsetHeight || 600
      renderer.setSize(w, h)
      const a = w / h
      camera.left   = (-frustumSize * a) / 2
      camera.right  =  (frustumSize * a) / 2
      camera.top    =  frustumSize / 2
      camera.bottom = -frustumSize / 2
      camera.updateProjectionMatrix()
    }, 100)

    // ── Environment ──
    createEnvironment(scene)

    // ── Collision check (dev) ──
    checkSpacing(CHARACTER_DEFS)

    // ── Characters — 10 total, scaled to 60% ──
    const characters: CharacterData[] = CHARACTER_DEFS.map((def, i) => {
      const char = createCharacter(scene, def.pos, ALL_CONFIGS[i])
      char.group.scale.set(0.78, 0.78, 0.78)
      char.group.rotation.y = def.rotY
      return char
    })

    // ── Monitoring wall — dominant visual anchor ──
    const monitorCanvas = createMonitoringCanvas()
    const monitorTexture = new THREE.CanvasTexture(monitorCanvas)

    const screenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(24, 13, 0.15),
      new THREE.MeshBasicMaterial({ map: monitorTexture })
    )
    screenMesh.position.set(-0.5, 6.5, -9.8)
    scene.add(screenMesh)

    // Emissive frame — glows cyan around the screen
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(24.8, 13.8, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x003366, emissive: 0x0077cc, emissiveIntensity: 2.5 })
    )
    frameMesh.position.set(-0.5, 6.5, -9.88)
    scene.add(frameMesh)

    // Screen-cast light — strong enough to illuminate the room
    const screenCastLight = new THREE.PointLight(0x00ccff, 18.0, 65)
    screenCastLight.position.set(-0.5, 7, -6.5)
    scene.add(screenCastLight)

    // ── Floating particles ──
    const particleCount = 20
    const particleGeometry = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    const particleVelocities = new Float32Array(particleCount)
    
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 40
      particlePositions[i * 3 + 1] = Math.random() * 20
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 40
      particleVelocities[i] = 0.02 + Math.random() * 0.03
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x00ffaa,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    // ── Resize handler ──
    const handleResize = () => {
      if (!mount) return
      const w = mount.offsetWidth || 800
      const h = mount.offsetHeight || 600
      const a = w / h
      renderer.setSize(w, h)
      camera.left   = (-frustumSize * a) / 2
      camera.right  =  (frustumSize * a) / 2
      camera.top    =  frustumSize / 2
      camera.bottom = -frustumSize / 2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    // ── Animation loop ──
    const startTime = Date.now()
    const initialCamPos = camera.position.clone()
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsed = (Date.now() - startTime) / 1000

      // 1. Camera drift
      camera.position.x = initialCamPos.x + Math.sin(elapsed * 0.1) * 0.01
      camera.position.y = initialCamPos.y + Math.cos(elapsed * 0.15) * 0.01

      updateCharacters(characters, elapsed)

      // Char 7 — left-right patrol on z=3 lane (never touches z=1 lane)
      const c7vel = Math.cos(elapsed * 0.25)
      characters[7].group.position.x = -5 + 3 * Math.sin(elapsed * 0.25)
      characters[7].group.position.z = 3
      characters[7].group.rotation.y = c7vel > 0 ? Math.PI * 0.5 : -Math.PI * 0.5

      // Char 8 — left-right patrol on z=1 lane (different phase so they're out of sync)
      const c8vel = Math.cos(elapsed * 0.2)
      characters[8].group.position.x = 5 + 2.5 * Math.sin(elapsed * 0.2)
      characters[8].group.position.z = 1
      characters[8].group.rotation.y = c8vel > 0 ? Math.PI * 0.5 : -Math.PI * 0.5

      updateEnvironment(elapsed)

      updateMonitoringCanvas(monitorCanvas, elapsed)
      monitorTexture.needsUpdate = true

      // 2. Screen pulse glow
      screenCastLight.intensity = 12 + Math.sin(elapsed * 2) * 2

      // 3. Update particles
      const positions = particleGeometry.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += particleVelocities[i]
        if (positions[i * 3 + 1] > 20) {
          positions[i * 3 + 1] = -5
        }
      }
      particleGeometry.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    // ── Cleanup ──
    return () => {
      clearTimeout(sizeTimeout)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animId)
      monitorTexture.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
}
