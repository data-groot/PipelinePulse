import * as THREE from 'three'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PoseType = 'seated' | 'standing' | 'walking' | 'pointing'

export interface CharacterConfig {
  shirtColor: number
  pantsColor: number
  hairColor: number
  shoeColor: number
  hasLabCoat: boolean
  pose: PoseType
  name: string
}

export interface CharacterData {
  group: THREE.Group
  config: CharacterConfig
  animOffset: number
  leftLegGroup: THREE.Group
  rightLegGroup: THREE.Group
  leftArmGroup: THREE.Group
  rightArmGroup: THREE.Group
  head: THREE.Mesh
  baseY: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const SKIN       = 0xFFCC88
const LAB_WHITE  = 0xEEEEEE
const EYE_DARK   = 0x1a1a1a
const DEG        = Math.PI / 180

// ─── Preset character configs (shirt/hair/pose/labCoat; pants+shoes shared) ──

export const CHARACTER_CONFIGS: CharacterConfig[] = [
  { shirtColor: 0x2255DD, pantsColor: 0x1a2a4a, hairColor: 0x1a0a00, shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'seated',   name: 'quality_scientist' },
  { shirtColor: 0xDD4422, pantsColor: 0x1a2a4a, hairColor: 0x3d1c00, shoeColor: 0x0a0a0a, hasLabCoat: false, pose: 'standing', name: 'pipeline_engineer' },
  { shirtColor: 0x22AA55, pantsColor: 0x1a2a4a, hairColor: 0x0a0a0a, shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'walking',  name: 'data_architect' },
  { shirtColor: 0xAA22DD, pantsColor: 0x1a2a4a, hairColor: 0x2d1a00, shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'seated',   name: 'etl_analyst' },
  { shirtColor: 0xDDAA22, pantsColor: 0x1a2a4a, hairColor: 0x0a0a0a, shoeColor: 0x0a0a0a, hasLabCoat: false, pose: 'pointing', name: 'ops_lead' },
  { shirtColor: 0x22AADD, pantsColor: 0x1a2a4a, hairColor: 0x3d1c00, shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'standing', name: 'dbt_modeler' },
  { shirtColor: 0xDD2255, pantsColor: 0x1a2a4a, hairColor: 0x1a0a00, shoeColor: 0x0a0a0a, hasLabCoat: false, pose: 'walking',  name: 'infra_sre' },
  { shirtColor: 0x55DD22, pantsColor: 0x1a2a4a, hairColor: 0x0a0a0a, shoeColor: 0x0a0a0a, hasLabCoat: true,  pose: 'seated',   name: 'dashboard_dev' },
]

// ─── Internal helpers ─────────────────────────────────────────────────────────

function lambMat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color })
}

function boxMesh(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambMat(color))
}

// Build a limb group with pivot at the given world-space y; mesh offset so
// its geometric center stays at (pivotY - halfH) below.
function limbGroup(
  pivotX: number,
  pivotY: number,
  w: number,
  h: number,
  d: number,
  color: number
): { grp: THREE.Group; mesh: THREE.Mesh } {
  const grp = new THREE.Group()
  grp.position.set(pivotX, pivotY, 0)
  const m = boxMesh(w, h, d, color)
  m.position.set(0, -h / 2, 0)
  grp.add(m)
  return { grp, mesh: m }
}

function applyInitialPose(
  pose: PoseType,
  leftLegGroup: THREE.Group,
  rightLegGroup: THREE.Group,
  leftArmGroup: THREE.Group,
  rightArmGroup: THREE.Group
): void {
  switch (pose) {
    case 'seated':
      leftLegGroup.rotation.x  = -45 * DEG
      rightLegGroup.rotation.x = -45 * DEG
      leftArmGroup.rotation.x  =  30 * DEG
      rightArmGroup.rotation.x =  30 * DEG
      break

    case 'walking':
      leftLegGroup.rotation.x  = -30 * DEG
      rightLegGroup.rotation.x =  30 * DEG
      leftArmGroup.rotation.x  =  30 * DEG
      rightArmGroup.rotation.x = -30 * DEG
      break

    case 'pointing':
      rightArmGroup.rotation.x = -90 * DEG
      rightArmGroup.rotation.y =  45 * DEG
      break

    case 'standing':
    default:
      break
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createCharacter(
  scene: THREE.Scene,
  position: [number, number, number],
  config: CharacterConfig
): CharacterData {
  const group = new THREE.Group()
  group.position.set(position[0], position[1], position[2])

  const { shirtColor, pantsColor, hairColor, shoeColor, hasLabCoat } = config

  // Leg pivot sits at top of leg box (y=0.85)
  const LEG_PIVOT_Y = 0.85

  // ── Left leg + shoe ──
  const { grp: leftLegGroup } = limbGroup(-0.2, LEG_PIVOT_Y, 0.35, 0.6, 0.35, pantsColor)
  const leftShoe = boxMesh(0.35, 0.25, 0.4, shoeColor)
  // shoe center in world: y=0.12 → relative to pivot: 0.12 - 0.85 = -0.73
  leftShoe.position.set(0, -0.73, 0.025)
  leftLegGroup.add(leftShoe)
  group.add(leftLegGroup)

  // ── Right leg + shoe ──
  const { grp: rightLegGroup } = limbGroup(0.2, LEG_PIVOT_Y, 0.35, 0.6, 0.35, pantsColor)
  const rightShoe = boxMesh(0.35, 0.25, 0.4, shoeColor)
  rightShoe.position.set(0, -0.73, 0.025)
  rightLegGroup.add(rightShoe)
  group.add(rightLegGroup)

  // ── Body / torso ──
  const body = boxMesh(0.8, 0.7, 0.45, shirtColor)
  body.position.set(0, 1.25, 0)
  body.name = 'body'
  group.add(body)

  // ── Optional lab-coat side panels (thin strips on torso sides) ──
  if (hasLabCoat) {
    const lc = lambMat(LAB_WHITE)
    const leftCoat  = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.42), lc)
    leftCoat.position.set(-0.42, 1.25, 0)
    group.add(leftCoat)
    const rightCoat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.42), lc)
    rightCoat.position.set(0.42, 1.25, 0)
    group.add(rightCoat)
  }

  // Arm pivot sits at top of arm box (shoulder, y=1.575)
  const ARM_PIVOT_Y = 1.575

  // ── Left arm ──
  const { grp: leftArmGroup } = limbGroup(-0.55, ARM_PIVOT_Y, 0.3, 0.65, 0.35, shirtColor)
  group.add(leftArmGroup)

  // ── Right arm ──
  const { grp: rightArmGroup } = limbGroup(0.55, ARM_PIVOT_Y, 0.3, 0.65, 0.35, shirtColor)
  group.add(rightArmGroup)

  // ── Neck ──
  const neck = boxMesh(0.25, 0.15, 0.25, SKIN)
  neck.position.set(0, 1.65, 0)
  group.add(neck)

  // ── Head ──
  const head = boxMesh(0.75, 0.75, 0.75, SKIN)
  head.position.set(0, 2.2, 0)
  group.add(head)

  // ── Hair ──
  const hair = boxMesh(0.8, 0.15, 0.8, hairColor)
  hair.position.set(0, 2.62, 0)
  group.add(hair)

  // ── Eyes (on front face of head, z = 0.375 + slight offset) ──
  const eyeZ = 0.4
  const leftEye  = boxMesh(0.12, 0.1, 0.05, EYE_DARK)
  leftEye.position.set(-0.15, 2.15, eyeZ)
  group.add(leftEye)

  const rightEye = boxMesh(0.12, 0.1, 0.05, EYE_DARK)
  rightEye.position.set(0.15, 2.15, eyeZ)
  group.add(rightEye)

  // ── Apply initial pose rotations ──
  applyInitialPose(config.pose, leftLegGroup, rightLegGroup, leftArmGroup, rightArmGroup)

  scene.add(group)

  return {
    group,
    config,
    animOffset: Math.random() * Math.PI * 2,
    leftLegGroup,
    rightLegGroup,
    leftArmGroup,
    rightArmGroup,
    head,
    baseY: position[1],
  }
}

// ─── Animation driver ─────────────────────────────────────────────────────────
// Call this every frame from the render loop, passing elapsed seconds.

export function updateCharacters(characters: CharacterData[], elapsed: number): void {
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const t = elapsed + char.animOffset

    switch (char.config.pose) {
      case 'seated': {
        // Subtle idle bob — 2 s loop
        char.group.position.y = char.baseY + Math.sin(t * Math.PI) * 0.03
        // Alternating typing arms — 0.4 s period
        char.leftArmGroup.rotation.x  = -0.3 + 0.2 * Math.sin(elapsed * 8)
        char.rightArmGroup.rotation.x = -0.3 + 0.2 * Math.sin(elapsed * 8 + Math.PI)
        break
      }

      case 'standing': {
        // Gentle lateral sway — 3 s loop
        char.group.rotation.y = Math.sin(t * (Math.PI * 2 / 3)) * 0.05
        break
      }

      case 'walking': {
        // Leg + arm oscillation — 1.5 s loop
        const walkFreq  = Math.PI * 2 / 1.5
        const walkAngle = Math.sin(t * walkFreq) * (30 * DEG)
        char.leftLegGroup.rotation.x  = -walkAngle
        char.rightLegGroup.rotation.x =  walkAngle
        char.leftArmGroup.rotation.x  =  walkAngle
        char.rightArmGroup.rotation.x = -walkAngle
        break
      }

      case 'pointing': {
        // Arm raises / lowers dynamically
        char.rightArmGroup.rotation.x = -1.2 + 0.3 * Math.sin(elapsed * 1.5)
        // Head scans left-right
        char.head.rotation.y = 0.3 * Math.sin(elapsed * 0.8)
        break
      }
    }

    // Subtle head nod for all characters
    char.head.rotation.x = 0.05 * Math.sin(elapsed * 2 + i)
  }
}