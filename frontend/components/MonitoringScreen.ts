// Canvas dimensions — 1280×720 (matches 24×13 screen geometry ratio closely)
export function createMonitoringCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width  = 1280
  canvas.height = 720
  return canvas
}

// ─── Palette ────────────────────────────────────────────────────────────────
const FONT  = "'JetBrains Mono', 'Courier New', monospace"
const BG    = "#060d1a"
const CARD  = "#091525"
const BDR   = "#0f2a48"
const CYAN  = "#00e5ff"
const GREEN = "#00ff88"
const AMBER = "#ff8c00"
const TEXT  = "#c0d8f0"
const MUTED = "#3a5878"

// ─── Helpers ────────────────────────────────────────────────────────────────

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r = 6
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h)
  ctx.fillStyle = CARD
  ctx.fill()
  ctx.strokeStyle = BDR
  ctx.lineWidth = 1
  ctx.stroke()
}

function cardTitle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, title: string
) {
  ctx.font = `bold 13px ${FONT}`
  ctx.fillStyle = CYAN
  ctx.textAlign = "left"
  ctx.fillText(title, x, y)
  ctx.strokeStyle = BDR
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x, y + 6)
  ctx.lineTo(x + w, y + 6)
  ctx.stroke()
}

// ─── Background ─────────────────────────────────────────────────────────────

function clear(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, 1280, 720)

  ctx.strokeStyle = "rgba(15,42,72,0.35)"
  ctx.lineWidth = 0.5
  for (let x = 0; x <= 1280; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke()
  }
  for (let y = 0; y <= 720; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke()
  }
}

// ─── Zone 1 — Header bar ────────────────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, elapsed: number) {
  ctx.fillStyle = "#030a15"
  ctx.fillRect(0, 0, 1280, 46)
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, 46); ctx.lineTo(1280, 46); ctx.stroke()

  ctx.font = `bold 14px ${FONT}`
  ctx.fillStyle = GREEN
  ctx.textAlign = "left"
  ctx.fillText("⬡  PIPELINEPULSE  OBSERVABILITY  v2.4", 16, 29)

  const now = new Date()
  const ts  = now.toLocaleTimeString("en-US", { hour12: false })
  ctx.font = `bold 18px ${FONT}`
  ctx.fillStyle = CYAN
  ctx.textAlign = "center"
  ctx.fillText(ts, 640, 30)

  const blink = Math.sin(elapsed * 3) > 0
  ctx.fillStyle = blink ? "#ff3355" : GREEN
  ctx.beginPath(); ctx.arc(1222, 23, 5, 0, Math.PI * 2); ctx.fill()
  ctx.font = `bold 12px ${FONT}`
  ctx.fillStyle = blink ? "#ff3355" : GREEN
  ctx.textAlign = "right"
  ctx.fillText("● LIVE", 1268, 30)
}

// ─── Zone 2 — Pipeline Health ────────────────────────────────────────────────

function drawPipelineHealth(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [8, 52, 440, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "PIPELINE HEALTH")

  const pipes = [
    { name: "E-Commerce Orders", pct: 98, status: "RUNNING", icon: "✓", col: GREEN },
    { name: "Data Warehouse",    pct: 92, status: "SUCCESS", icon: "✓", col: GREEN },
    { name: "Microservices API", pct: 92, status: "WARNING", icon: "⚠", col: AMBER },
    { name: "User Analytics",    pct: 76, status: "QUEUED",  icon: "○", col: MUTED },
  ]

  pipes.forEach((p, i) => {
    const ry = y + 44 + i * 52

    ctx.font = `bold 13px ${FONT}`
    ctx.fillStyle = p.col
    ctx.textAlign = "left"
    ctx.fillText(p.icon, x + 12, ry + 12)

    ctx.font = `12px ${FONT}`
    ctx.fillStyle = TEXT
    ctx.fillText(p.name, x + 30, ry + 12)

    // Status pill
    const pw = 72, ph = 18, px2 = x + w - 84
    rr(ctx, px2, ry, pw, ph, 4)
    ctx.fillStyle = p.col + "22"; ctx.fill()
    ctx.strokeStyle = p.col + "55"; ctx.lineWidth = 0.5; ctx.stroke()
    ctx.font = `bold 9px ${FONT}`
    ctx.fillStyle = p.col; ctx.textAlign = "center"
    ctx.fillText(p.status, px2 + pw / 2, ry + 12)

    // Progress bar
    const bx = x + 12, by = ry + 20, bw = w - 24, bh = 8
    rr(ctx, bx, by, bw, bh, 3)
    ctx.fillStyle = "#0a1a2e"; ctx.fill()

    const fw = bw * (p.pct / 100)
    const grad = ctx.createLinearGradient(bx, 0, bx + fw, 0)
    grad.addColorStop(0, p.col + "aa")
    grad.addColorStop(1, p.col)
    rr(ctx, bx, by, fw, bh, 3)
    ctx.fillStyle = grad; ctx.fill()

    // Shimmer
    const shimOff = (elapsed * 0.4 + i * 0.35) % 1
    const shimX = bx + shimOff * fw - 20
    const shimG = ctx.createLinearGradient(shimX, 0, shimX + 40, 0)
    shimG.addColorStop(0, "rgba(255,255,255,0)")
    shimG.addColorStop(0.5, "rgba(255,255,255,0.28)")
    shimG.addColorStop(1, "rgba(255,255,255,0)")
    ctx.save()
    rr(ctx, bx, by, fw, bh, 3); ctx.clip()
    ctx.fillStyle = shimG; ctx.fillRect(shimX, by, 40, bh)
    ctx.restore()
  })

  // Warning row
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(elapsed * 1.6))
  ctx.fillStyle = `rgba(255,140,0,${0.15 * pulse})`
  ctx.fillRect(x + 8, y + h - 38, w - 16, 28)
  ctx.strokeStyle = `rgba(255,140,0,${0.4 * pulse})`
  ctx.lineWidth = 0.5
  ctx.strokeRect(x + 8, y + h - 38, w - 16, 28)
  ctx.font = `11px ${FONT}`
  ctx.fillStyle = `rgba(255,185,80,${pulse})`
  ctx.textAlign = "left"
  ctx.fillText("⚠  Warning: Pipeline B scheduled check needed", x + 16, y + h - 18)
}

// ─── Zone 3 — Automation countdown ──────────────────────────────────────────

function drawAutomation(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [456, 52, 310, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "AUTOMATION")

  const totalSecs = Math.max(0, 2678 - Math.floor(elapsed))
  const mins = Math.floor(totalSecs / 60).toString().padStart(2, "0")
  const secs = (totalSecs % 60).toString().padStart(2, "0")
  const countStr = `00:${mins}:${secs}`

  const glow = 0.7 + 0.3 * Math.sin(elapsed * 2)
  ctx.shadowColor = GREEN; ctx.shadowBlur = 18 * glow
  ctx.font = `bold 36px ${FONT}`
  ctx.fillStyle = GREEN; ctx.textAlign = "center"
  ctx.fillText(countStr, x + w / 2, y + 108)
  ctx.shadowBlur = 0

  ctx.font = `11px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText("NEXT SCHEDULED RUN", x + w / 2, y + 128)

  ctx.font = `12px ${FONT}`
  ctx.fillStyle = TEXT
  ctx.fillText("3 pipelines scheduled", x + w / 2, y + 154)

  // ARMED button
  const bx = x + w / 2 - 58, by = y + 170, bw = 116, bh = 30
  const pulse = 0.7 + 0.3 * Math.sin(elapsed * 4)
  rr(ctx, bx, by, bw, bh, 5)
  ctx.fillStyle = `rgba(0,255,136,${0.15 * pulse})`; ctx.fill()
  ctx.strokeStyle = `rgba(0,255,136,${0.65 * pulse})`; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = `bold 12px ${FONT}`
  ctx.fillStyle = `rgba(0,255,136,${pulse})`
  ctx.fillText("▶  ARMED", x + w / 2, by + 20)

  ctx.font = `10px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText("Waiting for scheduled execution", x + w / 2, y + 226)

  // Pulse dot top-right
  ctx.fillStyle = GREEN; ctx.globalAlpha = pulse
  ctx.beginPath(); ctx.arc(x + w - 18, y + 20, 4, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

// ─── Zone 4 — Active Runs ───────────────────────────────────────────────────

function drawActiveRuns(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [774, 52, 498, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "ACTIVE RUNS")

  const blink = Math.sin(elapsed * 2.5) > 0
  ctx.font = `bold 11px ${FONT}`
  ctx.fillStyle = blink ? GREEN : MUTED; ctx.textAlign = "right"
  ctx.fillText("● LIVE", x + w - 12, y + 20)

  // Big number
  ctx.shadowColor = GREEN; ctx.shadowBlur = 14
  ctx.font = `bold 54px ${FONT}`
  ctx.fillStyle = GREEN; ctx.textAlign = "left"
  ctx.fillText("14", x + 16, y + 92)
  ctx.shadowBlur = 0
  ctx.font = `11px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText("Total Active Runs", x + 16, y + 108)

  // Divider
  ctx.strokeStyle = BDR; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(x + 110, y + 36); ctx.lineTo(x + 110, y + 118); ctx.stroke()

  // Quick stats
  const stats = [
    { label: "Running", val: "11", col: GREEN },
    { label: "Queued",  val: " 3", col: AMBER },
  ]
  stats.forEach((s, i) => {
    ctx.font = `bold 22px ${FONT}`
    ctx.fillStyle = s.col; ctx.textAlign = "left"
    ctx.fillText(s.val, x + 124 + i * 115, y + 72)
    ctx.font = `10px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(s.label, x + 124 + i * 115, y + 88)
  })

  // Run list
  const runs = [
    { icon: "▶", name: "Airflow Dag: user_logs",    status: "running", col: GREEN, time: "02:14" },
    { icon: "✓", name: "K8s Job: order_db_sync",     status: "success", col: CYAN,  time: "01:08" },
    { icon: "○", name: "DB Update: catalog_refresh", status: "queued",  col: MUTED, time: "—" },
    { icon: "⏵", name: "API Poller: currency_data",  status: "running", col: GREEN, time: "03:42" },
  ]

  runs.forEach((r, i) => {
    const ry = y + 122 + i * 32
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.02)"
      ctx.fillRect(x + 8, ry - 3, w - 16, 28)
    }
    ctx.font = `bold 12px ${FONT}`
    ctx.fillStyle = r.col; ctx.textAlign = "left"
    ctx.fillText(r.icon, x + 16, ry + 14)
    ctx.font = `12px ${FONT}`
    ctx.fillStyle = TEXT
    ctx.fillText(r.name, x + 34, ry + 14)

    // Status pill
    const pw = 64, ph = 18, px2 = x + w - 118
    rr(ctx, px2, ry + 2, pw, ph, 3)
    ctx.fillStyle = r.col + "22"; ctx.fill()
    ctx.font = `bold 9px ${FONT}`
    ctx.fillStyle = r.col; ctx.textAlign = "center"
    ctx.fillText(r.status, px2 + pw / 2, ry + 14)

    ctx.font = `10px ${FONT}`
    ctx.fillStyle = MUTED; ctx.textAlign = "right"
    ctx.fillText(r.time, x + w - 12, ry + 14)
  })

  // Footer
  ctx.fillStyle = "rgba(0,200,170,0.08)"
  ctx.fillRect(x + 8, y + h - 38, w - 16, 28)
  ctx.strokeStyle = "rgba(0,200,170,0.2)"; ctx.lineWidth = 0.5
  ctx.strokeRect(x + 8, y + h - 38, w - 16, 28)
  ctx.font = `11px ${FONT}`
  ctx.fillStyle = "#00ccaa"; ctx.textAlign = "center"
  ctx.fillText("Next Run in 20min  →", x + w / 2, y + h - 18)
}

// ─── Zone 5 — Alert Banner ──────────────────────────────────────────────────

function drawAlertBanner(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [y, h] = [328, 36]
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(elapsed * Math.PI / 2.2))
  ctx.fillStyle = `rgba(255,140,0,${0.18 * pulse})`
  ctx.fillRect(8, y, 1264, h)
  ctx.strokeStyle = `rgba(255,140,0,${0.55 * pulse})`
  ctx.lineWidth = 1; ctx.strokeRect(8, y, 1264, h)
  ctx.font = `bold 12px ${FONT}`
  ctx.fillStyle = `rgba(255,190,80,${pulse})`
  ctx.textAlign = "left"
  ctx.fillText("⚠  Alert: Pipeline 8 scheduled check needed — Review recommended before next scheduled run", 20, y + 24)
  ctx.textAlign = "right"
  ctx.fillText("Dismiss  ×", 1262, y + 24)
}

// ─── Zone 6 — Pipeline Flow ─────────────────────────────────────────────────

function drawPipelineFlow(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [8, 372, 490, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "PIPELINE FLOW")

  const nodes = [
    { label: "BRONZE", sub: "Volume Layer", col: "#cd7f32", glow: "rgba(205,127,50,0.35)", nx: x + 82  },
    { label: "SILVER", sub: "Volume Layer", col: "#8ab4c8", glow: "rgba(138,180,200,0.35)", nx: x + 245 },
    { label: "GOLD",   sub: "6th D Layer",  col: "#ffd700", glow: "rgba(255,215,0,0.35)",  nx: x + 408 },
  ]
  const nodeY = y + 152
  const nodeR = 38

  nodes.forEach((node, i) => {
    // Glow halo
    const grd = ctx.createRadialGradient(node.nx, nodeY, 0, node.nx, nodeY, nodeR + 20)
    grd.addColorStop(0, node.glow); grd.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(node.nx, nodeY, nodeR + 20, 0, Math.PI * 2); ctx.fill()

    // Hexagon
    ctx.beginPath()
    for (let j = 0; j < 6; j++) {
      const a = (Math.PI / 3) * j - Math.PI / 6
      const hx = node.nx + nodeR * Math.cos(a)
      const hy = nodeY + nodeR * Math.sin(a)
      j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath()
    ctx.fillStyle = "#050e1c"; ctx.fill()
    ctx.strokeStyle = node.col; ctx.lineWidth = 2; ctx.stroke()

    // Inner ring
    ctx.beginPath()
    for (let j = 0; j < 6; j++) {
      const a = (Math.PI / 3) * j - Math.PI / 6
      const hx = node.nx + (nodeR - 9) * Math.cos(a)
      const hy = nodeY + (nodeR - 9) * Math.sin(a)
      j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath(); ctx.strokeStyle = node.col + "44"; ctx.lineWidth = 1; ctx.stroke()

    ctx.font = `bold 11px ${FONT}`
    ctx.fillStyle = node.col; ctx.textAlign = "center"
    ctx.fillText(node.label, node.nx, nodeY + 4)
    ctx.font = `10px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(node.sub, node.nx, nodeY + nodeR + 20)

    // Arrow
    if (i < 2) {
      const ax1 = node.nx + nodeR + 4, ax2 = nodes[i + 1].nx - nodeR - 4
      ctx.strokeStyle = "#1a3a5a"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5])
      ctx.beginPath(); ctx.moveTo(ax1, nodeY); ctx.lineTo(ax2, nodeY); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = "#2a5a7a"
      ctx.beginPath()
      ctx.moveTo(ax2, nodeY); ctx.lineTo(ax2 - 8, nodeY - 4); ctx.lineTo(ax2 - 8, nodeY + 4)
      ctx.closePath(); ctx.fill()
    }
  })

  // Animated packet
  const pct  = (elapsed * 0.25) % 1
  const path = nodes[2].nx - nodes[0].nx
  const px   = nodes[0].nx + pct * path
  const pa   = 0.7 + 0.3 * Math.sin(elapsed * 8)
  ctx.globalAlpha = pa
  ctx.shadowColor = GREEN; ctx.shadowBlur = 10
  ctx.fillStyle = GREEN
  ctx.beginPath(); ctx.arc(px, nodeY, 5, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0; ctx.globalAlpha = 1

  ctx.font = `10px ${FONT}`
  ctx.fillStyle = MUTED; ctx.textAlign = "center"
  ctx.fillText("All schemas processing within normal parameters", x + w / 2, y + h - 18)
}

// ─── Zone 7 — Quality Score ─────────────────────────────────────────────────

function drawQualityScore(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [506, 372, 278, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "QUALITY SCORE")

  const drawGauge = (
    cx: number, cy: number, r: number,
    value: number, label: string, sub: string
  ) => {
    const startA  = Math.PI * 0.75
    const endA    = Math.PI * 2.25
    const animPct = Math.min(1, elapsed / 2)
    const fillA   = startA + (endA - startA) * (value / 100) * animPct
    const col     = value >= 90 ? GREEN : value >= 70 ? AMBER : "#ff3355"

    // Track
    ctx.beginPath(); ctx.arc(cx, cy, r, startA, endA)
    ctx.strokeStyle = "#0a1e32"; ctx.lineWidth = 10; ctx.stroke()

    // Fill
    ctx.beginPath(); ctx.arc(cx, cy, r, startA, fillA)
    ctx.strokeStyle = col; ctx.lineWidth = 10
    ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0

    // Tip dot
    const dx = cx + r * Math.cos(fillA), dy = cy + r * Math.sin(fillA)
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(dx, dy, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0

    // Value
    ctx.font = `bold 26px ${FONT}`
    ctx.fillStyle = col; ctx.textAlign = "center"
    ctx.fillText(`${value}%`, cx, cy + 9)

    // Labels
    ctx.font = `10px ${FONT}`
    ctx.fillStyle = MUTED; ctx.fillText(label, cx, cy + r + 22)
    ctx.fillStyle = col;   ctx.fillText(sub,   cx, cy + r + 36)
  }

  drawGauge(x + 82,  y + 140, 54, 98, "Availability", "Excellent")
  drawGauge(x + 210, y + 148, 42, 97, "Reliability",  "High")

  ctx.font = `10px ${FONT}`
  ctx.fillStyle = GREEN; ctx.textAlign = "center"
  ctx.fillText("All scores within high tolerance", x + w / 2, y + h - 18)
}

// ─── Zone 8 — System Telemetry (line chart) ──────────────────────────────────

function drawSystemTelemetry(ctx: CanvasRenderingContext2D, elapsed: number) {
  const [x, y, w, h] = [792, 372, 480, 268]
  card(ctx, x, y, w, h)
  cardTitle(ctx, x + 12, y + 20, w - 24, "SYSTEM TELEMETRY")

  ctx.font = `10px ${FONT}`
  ctx.fillStyle = MUTED; ctx.textAlign = "left"
  ctx.fillText("Requests / sec  ·  Throughput", x + 12, y + 38)

  // Legend
  const legends = [{ label: "Throughput", col: GREEN }, { label: "Requests", col: CYAN }]
  legends.forEach((l, i) => {
    const lx = x + w - 148 + i * 78
    ctx.fillStyle = l.col; ctx.fillRect(lx, y + 22, 8, 8)
    ctx.font = `9px ${FONT}`; ctx.fillStyle = MUTED; ctx.textAlign = "left"
    ctx.fillText(l.label, lx + 12, y + 30)
  })

  const chartX = x + 44, chartY = y + 240, chartW = w - 58, chartH = 176

  // Axes
  ctx.strokeStyle = "#0f2a48"; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(chartX, y + 48); ctx.lineTo(chartX, chartY)
  ctx.lineTo(chartX + chartW, chartY)
  ctx.stroke()

  // Grid lines + Y labels
  for (let i = 1; i <= 4; i++) {
    const lineY = chartY - (chartH * i) / 4
    ctx.strokeStyle = "rgba(15,42,72,0.7)"; ctx.lineWidth = 0.5
    ctx.setLineDash([3, 6])
    ctx.beginPath(); ctx.moveTo(chartX, lineY); ctx.lineTo(chartX + chartW, lineY); ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `9px ${FONT}`; ctx.fillStyle = MUTED; ctx.textAlign = "right"
    ctx.fillText(`${i * 25}`, chartX - 6, lineY + 3)
  }

  const days    = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const series1 = [0.85, 0.89, 0.45, 0.78, 0.92]
  const series2 = [0.70, 0.75, 0.60, 0.65, 0.80]

  const drawLine = (data: number[], col: string, fillA: number) => {
    const animScale = Math.min(1, elapsed / 1.5)
    const pts = data.map((v, i) => ({
      px: chartX + (i / (data.length - 1)) * chartW,
      py: chartY - chartH * v * animScale,
    }))

    // Filled area
    ctx.beginPath()
    ctx.moveTo(pts[0].px, chartY)
    pts.forEach((p) => ctx.lineTo(p.px, p.py))
    ctx.lineTo(pts[pts.length - 1].px, chartY)
    ctx.closePath()
    ctx.fillStyle = col + Math.round(fillA * 255).toString(16).padStart(2, "0")
    ctx.fill()

    // Smooth line
    ctx.beginPath(); ctx.moveTo(pts[0].px, pts[0].py)
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].px + pts[i].px) / 2
      ctx.bezierCurveTo(cpx, pts[i - 1].py, cpx, pts[i].py, pts[i].px, pts[i].py)
    }
    ctx.strokeStyle = col; ctx.lineWidth = 2
    ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0

    // Dots + labels
    pts.forEach((p, i) => {
      ctx.fillStyle = col
      ctx.shadowColor = col; ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(p.px, p.py, 3, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.font = `9px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = "center"
      ctx.fillText(`${Math.round(data[i] * 100)}%`, p.px, p.py - 8)
    })
  }

  drawLine(series1, GREEN, 0.08)
  drawLine(series2, CYAN,  0.06)

  // X labels
  days.forEach((d, i) => {
    const lx = chartX + (i / (days.length - 1)) * chartW
    ctx.font = `10px ${FONT}`; ctx.fillStyle = MUTED; ctx.textAlign = "center"
    ctx.fillText(d, lx, chartY + 16)
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function updateMonitoringCanvas(canvas: HTMLCanvasElement, elapsed: number): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  clear(ctx)
  drawHeader(ctx, elapsed)
  drawPipelineHealth(ctx, elapsed)
  drawAutomation(ctx, elapsed)
  drawActiveRuns(ctx, elapsed)
  drawAlertBanner(ctx, elapsed)
  drawPipelineFlow(ctx, elapsed)
  drawQualityScore(ctx, elapsed)
  drawSystemTelemetry(ctx, elapsed)

  // Scanlines
  ctx.fillStyle = "rgba(0,0,0,0.03)"
  for (let sy = 0; sy < 720; sy += 4) ctx.fillRect(0, sy, 1280, 2)

  // Vignette
  const vig = ctx.createRadialGradient(640, 360, 200, 640, 360, 750)
  vig.addColorStop(0, "rgba(0,0,0,0)")
  vig.addColorStop(1, "rgba(0,0,0,0.5)")
  ctx.fillStyle = vig; ctx.fillRect(0, 0, 1280, 720)
}
