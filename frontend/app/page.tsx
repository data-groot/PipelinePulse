'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  Github,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Magnetic,
  Marquee,
  Reveal,
  RiseIn,
  StaggerGroup,
  StaggerItem,
  WordReveal,
} from '@/components/landing-motion';
import Starfield from '@/components/Starfield';

const GITHUB_URL = 'https://github.com/data-groot/PipelinePulse';

const STACK_ITEMS = [
  'FastAPI',
  'Next.js 16',
  'PostgreSQL',
  'Cloud Run',
  'Cloud Scheduler',
  'SQLAlchemy',
  'TanStack Query',
  'Three.js',
  'Tailwind v4',
  'Python 3.12',
  'TypeScript',
  'Docker',
];

const VoxelControlRoom = dynamic(() => import('@/components/VoxelControlRoom'), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0, background: '#040814' }} />,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
});


const heroHighlights = [
  { label: 'Control-Room Interface', detail: 'Live 3D operator scene' },
  { label: 'Observability Wall', detail: 'Real-time dashboard feed' },
  { label: 'Bronze → Silver → Gold', detail: 'Medallion data flow' },
  { label: 'Monitoring + Automation', detail: 'Quality scores & cloud scheduling' },
];

const capabilityCards = [
  {
    icon: Eye,
    title: 'Mission-control surface',
    description: 'Health, freshness, and pipeline status rendered as a live cinematic dashboard — designed for operators who think in systems.',
  },
  {
    icon: Bot,
    title: 'Cloud-native scheduling',
    description: 'Pipelines run on schedule via Cloud Scheduler and Cloud Run — serverless, scale-to-zero. Bronze-to-gold movement happens automatically, no manual triggers needed.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality layer',
    description: 'Automated checks score every run — row counts, null payloads, duplicates, and freshness caught before they propagate downstream.',
  },
];

const signalCards = [
  {
    icon: Database,
    title: 'Ingestion layer',
    body: 'Row counts, freshness windows, and dependency health tracked from the moment data lands in the bronze schema.',
    accent: 'teal',
  },
  {
    icon: Activity,
    title: 'Run telemetry',
    body: 'Execution timelines and active-run state rendered as a live signal feed — designed for fast scanning, not screenshots.',
    accent: 'cyan',
  },
  {
    icon: Waves,
    title: 'Quality signal',
    body: 'Scorecards, anomaly flags, and contract checks surface the moment a transformation completes in the pipeline.',
    accent: 'amber',
  },
] as const;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function BrandMark() {
  return (
    <div className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M1 9h3l1.3-4 2.1 8 1.7-6 1.4 2H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="brand-text">PipelinePulse</span>
    </div>
  );
}

function CapabilityCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Eye;
  title: string;
  description: string;
}) {
  return (
    <article className="capability-card">
      <div className="capability-icon">
        <Icon size={18} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function SignalCard({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof Eye;
  title: string;
  body: string;
  accent: 'teal' | 'cyan' | 'amber';
}) {
  return (
    <article className={`signal-card signal-${accent}`}>
      <div className="signal-header">
        <div className="signal-icon">
          <Icon size={18} />
        </div>
        <span className="signal-chip">{accent}</span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function DashboardPanel() {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-topbar">
        <div className="dashboard-brand">
          <BrandMark />
          <span>control center</span>
        </div>
        <button type="button" className="panel-button">Dashboard</button>
      </div>

      <div className="dashboard-grid">
        <section className="panel-box panel-health">
          <div className="panel-label">Pipeline health</div>
          <div className="progress-list">
            {[
              ['Ingest / Heartbeat', '92%'],
              ['Freshness', '88%'],
              ['SLA', '100%'],
            ].map(([label, value], index) => (
              <div key={label} className="progress-row">
                <div className="progress-copy">
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${92 - index * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-box panel-runs">
          <div className="panel-label">Active runs</div>
          <div className="panel-stat">14</div>
          <div className="panel-substat">3 queued, 11 executing</div>
          <div className="panel-runlist">
            <span>Run feed</span>
            <span>Bronze extract</span>
            <span>Gold rollup</span>
          </div>
        </section>

        <section className="panel-box panel-timer">
          <div className="panel-label">Automation timer</div>
          <div className="panel-timer-readout">00:00:203</div>
          <div className="panel-substat">Next run in 23m</div>
        </section>

        <section className="alert-strip">
          <span className="alert-copy">Alert: pipeline 8 scheduled check needed</span>
          <span className="alert-copy">Next run in 20min</span>
        </section>

        <section className="panel-box panel-flow">
          <div className="panel-label">Pipeline flow</div>
          <div className="flow-track">
            <span className="flow-node bronze">Bronze</span>
            <span className="flow-arrow" />
            <span className="flow-node silver">Silver</span>
            <span className="flow-arrow" />
            <span className="flow-node gold">Gold</span>
          </div>
        </section>

        <section className="panel-box panel-score">
          <div className="panel-label">Quality score</div>
          <div className="gauge-grid">
            <div className="gauge">
              <div className="gauge-ring">
                <span>98</span>
              </div>
              <label>Quality score</label>
            </div>
            <div className="gauge">
              <div className="gauge-ring secondary">
                <span>97</span>
              </div>
              <label>Reliability</label>
            </div>
          </div>
        </section>

        <section className="panel-box panel-bars">
          <div className="panel-label">System telemetry</div>
          <div className="bar-chart">
            {[72, 90, 58, 84, 67, 96, 78].map((height, index) => (
              <div key={height + index} className="bar-column">
                <div className="bar" style={{ height: `${height}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} landing-shell`}>
      <div className="landing-background" aria-hidden="true">
        <div className="landing-orb orb-left" />
        <div className="landing-orb orb-right" />
        <div className="landing-orb orb-bottom" />
      </div>

      <Starfield />

      <nav className={`landing-nav fixed top-0 left-0 right-0 z-50 ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h4l3-9 4 18 3-9h4"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-white text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                PipelinePulse
              </div>
              <div className="text-xs text-emerald-400 font-mono tracking-wider">
                CONTROL CENTER
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'Overview',     id: 'platform' },
              { label: 'Control Room', id: '' },
              { label: 'Architecture', id: 'how-it-works' },
              { label: 'UI Preview',   id: 'solutions' },
            ].map(({ label, id }) => (
              <button
                key={label}
                type="button"
                onClick={() => id ? scrollTo(id) : window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-sm text-gray-400 hover:text-violet-300 transition-colors font-mono uppercase tracking-wider bg-transparent border-0 cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-violet-300 transition-colors font-mono uppercase tracking-wider"
            >
              <Github size={16} />
              GitHub
            </a>
            <Link
              href="/login"
              className="text-sm text-gray-300 hover:text-violet-300 transition-colors font-mono uppercase tracking-wider"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-mono uppercase tracking-wider px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-400/40 text-violet-200 hover:bg-violet-500/25 transition-colors"
            >
              Try the demo
            </Link>
          </div>

        </div>
      </nav>

      {/* ── HERO — full-viewport 3D background ── */}
      <section className="relative w-full h-screen overflow-hidden">

        {/* Right-side 3D scene — clearly contained, not a background bleed */}
        <div className="absolute right-0 top-0 bottom-0 z-0" style={{ width: '60%' }}>
          <VoxelControlRoom />
          {/* Inner left-edge fade so scene blends into left panel */}
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none" style={{ width: '22%', background: 'linear-gradient(to right, #040814 0%, transparent 100%)' }} />
        </div>

        {/* Text — left column */}
        <div className="absolute z-20 top-[15%] left-[5%] space-y-6" style={{ maxWidth: '42%' }}>

          <Reveal delay={0.05} y={16} className="inline-block">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              OPEN SOURCE · DATA ENGINEERING
            </span>
          </Reveal>

          <h1
            style={{
              marginTop: '1rem',
              fontFamily: 'var(--font-space-grotesk), sans-serif',
              fontSize: 'clamp(2.4rem, 4.8vw, 4.2rem)',
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              color: '#f7fbff',
              textTransform: 'uppercase',
            }}
          >
            <WordReveal text="A cinematic control room for" delay={0.15} />{' '}
            <RiseIn
              delay={0.62}
              className="gradient-shimmer"
              style={{
                background: 'linear-gradient(90deg, #a78bfa 0%, #7cc8ff 35%, #4ff0c8 65%, #a78bfa 100%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              pipeline observability.
            </RiseIn>
          </h1>

          <Reveal delay={0.8} y={22}>
            <p style={{ marginTop: '1rem', color: 'rgba(214, 224, 240, 0.76)', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '30rem' }}>
              An open-source ETL platform you can run yourself. Connect a data source, pick a
              schedule, and watch your data move bronze → silver → gold with quality scores and
              live run telemetry. No Airflow, no YAML.
            </p>
          </Reveal>

          <Reveal delay={0.95} y={22}>
            <div className="hero-actions" style={{ marginTop: '1.5rem' }}>
              <Magnetic>
                <Link href="/signup" className="primary-cta">
                  Try the live demo
                  <ChevronRight size={16} />
                </Link>
              </Magnetic>
              <Magnetic>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="secondary-cta">
                  <Github size={16} />
                  View on GitHub
                </a>
              </Magnetic>
            </div>
          </Reveal>

        </div>

        {/* Bottom fade — bridges hero into the page background */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
          style={{ height: '12rem', background: 'linear-gradient(to bottom, transparent 0%, rgba(4,8,20,0.72) 55%, #040815 100%)' }}
        />

        {/* Project highlight strip */}
        <div className="absolute z-30 bottom-0 left-0 right-0 hero-highlight-strip">
          {heroHighlights.map((item) => (
            <div key={item.label} className="hero-highlight">
              <span className="highlight-label">{item.label}</span>
              <span className="highlight-detail">{item.detail}</span>
            </div>
          ))}
        </div>

      </section>

      {/* ── Stack ticker ── */}
      <Marquee items={STACK_ITEMS} />

      <section id="platform" className="capability-section">
        <Reveal className="section-heading">
          <div className="section-kicker">Interface Design</div>
          <h2>Designed as a mission-control surface for modern data workflows.</h2>
          <p>
            Each panel is intentionally designed — not auto-generated — to surface the signals a pipeline operator actually needs. Information hierarchy over decoration.
          </p>
        </Reveal>

        <StaggerGroup className="capability-grid">
          {capabilityCards.map((card) => (
            <StaggerItem key={card.title}>
              <CapabilityCard {...card} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section id="solutions" className="preview-section">
        <Reveal className="preview-copy">
          <div className="section-kicker">UI Preview</div>
          <h2>The control center interface, built panel by panel.</h2>
          <p>
            Each panel is a deliberate design decision — what to surface, where, and at what visual weight. The dashboard is the interface, not a report.
          </p>

          <div className="bullet-list">
            <div><CheckCircle2 size={16} /> Pipeline health in three labeled progress bars</div>
            <div><Clock3 size={16} /> Countdown timer to the next scheduled run</div>
            <div><Sparkles size={16} /> Quality gauges rendered front and center</div>
          </div>
        </Reveal>

        <Reveal delay={0.18} y={48}>
          <DashboardPanel />
        </Reveal>
      </section>

      <section id="signals" className="signals-section">
        <Reveal className="section-heading compact">
          <div className="section-kicker">Signal Design</div>
          <h2>Three signal layers, each surfacing a different dimension of pipeline state.</h2>
        </Reveal>

        <StaggerGroup className="signals-grid">
          {signalCards.map((card) => (
            <StaggerItem key={card.title}>
              <SignalCard {...card} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ── Architecture ── */}
      <section id="how-it-works" className="how-section">
        <Reveal className="section-heading">
          <div className="section-kicker">Data Architecture</div>
          <h2>Medallion architecture — bronze to gold in three layers.</h2>
          <p>The system implements a classic medallion pattern: raw ingestion, cleaning and typing, and quality-gated daily aggregates. PipelinePulse surfaces the full lifecycle.</p>
        </Reveal>
        <StaggerGroup className="how-steps">
          <StaggerItem className="how-step-item">
            <div className="how-step">
              <div className="step-number">01 — Bronze</div>
              <div className="step-icon"><Database size={20} /></div>
              <h3>Raw ingestion</h3>
              <p>Source data lands unchanged in the bronze layer — REST APIs, PostgreSQL tables, or CSV uploads. Every run records row counts and freshness.</p>
            </div>
          </StaggerItem>
          <div className="step-connector"><ArrowRight size={22} /></div>
          <StaggerItem className="how-step-item">
            <div className="how-step">
              <div className="step-number">02 — Silver</div>
              <div className="step-icon"><Activity size={20} /></div>
              <h3>Silver transformation</h3>
              <p>Bronze data is cleaned, deduplicated, and typed into the silver layer. Automated quality checks flag null payloads, duplicates, and stale data before they propagate downstream.</p>
            </div>
          </StaggerItem>
          <div className="step-connector"><ArrowRight size={22} /></div>
          <StaggerItem className="how-step-item">
            <div className="how-step">
              <div className="step-number">03 — Gold</div>
              <div className="step-icon"><Sparkles size={20} /></div>
              <h3>Business-ready output</h3>
              <p>Gold-layer datasets are scored, timestamped, and surfaced in the observability wall. Every run leaves an audit trail visible in the control room.</p>
            </div>
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* ── Try it / run it ── */}
      <section className="cta-section">
        <Reveal className="cta-card" y={48}>
          <div className="section-kicker">Free & Open Source</div>
          <h2>Try it in the browser, or clone it and make it yours.</h2>
          <p>
            The hosted demo runs the exact code in the repo — sign up, load the sample pipeline, and
            poke around. Want your own instance? The deployment guide walks you from git clone to a
            live Cloud Run service in about 30 minutes.
          </p>
          <div className="hero-actions cta-actions" style={{ marginTop: '2rem' }}>
            <Magnetic>
              <Link href="/signup" className="primary-cta">
                Try the live demo
                <ChevronRight size={16} />
              </Link>
            </Magnetic>
            <Magnetic>
              <a
                href={`${GITHUB_URL}/blob/main/DEPLOYMENT.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-cta"
              >
                Read the deployment guide
                <ArrowRight size={16} />
              </a>
            </Magnetic>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer>
        <Reveal className="footer-wrapper" y={24}>
          <div className="footer-inner">
            <div className="footer-brand">
              <BrandMark />
              <p>An open-source pipeline observability project — a cinematic mission-control interface over a real ETL engine. Built with FastAPI, Next.js, PostgreSQL, and Google Cloud Run.</p>
            </div>
            <div className="footer-col">
              <h4>Project</h4>
              <ul>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Source code</a></li>
                <li><a href={`${GITHUB_URL}/blob/main/DEPLOYMENT.md`} target="_blank" rel="noopener noreferrer">Deployment guide</a></li>
                <li><a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer">Issues & ideas</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Stack</h4>
              <ul>
                <li>FastAPI + Python</li>
                <li>PostgreSQL</li>
                <li>Google Cloud Run</li>
                <li>Next.js</li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Connect</h4>
              <ul>
                <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="https://krishnamihir.dev" target="_blank" rel="noopener noreferrer">Portfolio</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>PipelinePulse — an open-source pipeline observability project. Fork it, run it, improve it.</span>
          </div>
        </Reveal>
      </footer>

      <style jsx global>{`
        .landing-shell {
          position: relative;
          min-height: 100vh;
          overflow: clip;
          background:
            radial-gradient(circle at 70% 20%, rgba(110, 84, 255, 0.10), transparent 34%),
            radial-gradient(circle at 18% 70%, rgba(38, 118, 255, 0.08), transparent 30%),
            linear-gradient(180deg, #030409 0%, #05060f 35%, #060714 65%, #070816 100%);
          color: #f5f7fb;
        }
        .landing-shell > *:not(.landing-background) {
          position: relative;
          z-index: 1;
        }

        .landing-background {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .landing-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(90px);
          opacity: 0.7;
        }

        /* Nebula glows floating behind the starfield */
        .orb-left {
          top: 10rem;
          left: -6rem;
          width: 26rem;
          height: 26rem;
          background: rgba(124, 92, 255, 0.16);
        }

        .orb-right {
          top: 2rem;
          right: -4rem;
          width: 30rem;
          height: 30rem;
          background: rgba(46, 134, 255, 0.13);
        }

        .orb-bottom {
          bottom: -10rem;
          left: 35%;
          width: 34rem;
          height: 24rem;
          background: rgba(79, 240, 200, 0.07);
        }

        .site-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: rgba(3, 7, 18, 0.88);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
        }

        .site-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0.6rem 2rem;
        }

        .brand-lockup {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-space-grotesk), sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          color: #5aadee;
        }

        .brand-text {
          font-size: 0.88rem;
          color: rgba(190, 215, 245, 0.7);
          letter-spacing: -0.01em;
        }

        .site-nav {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .nav-link {
          appearance: none;
          border: 0;
          background: transparent;
          color: rgba(160, 195, 235, 0.45);
          font-size: 0.76rem;
          font-family: var(--font-jetbrains), monospace;
          letter-spacing: 0.03em;
          padding: 0.38rem 0.72rem;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: color 140ms ease, background-color 140ms ease;
        }

        .nav-link:hover {
          color: rgba(215, 235, 255, 0.88);
          background: rgba(255, 255, 255, 0.03);
        }

        .header-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.32rem 0.8rem;
          border-radius: 4px;
          border: 1px solid rgba(100, 150, 210, 0.16);
          color: rgba(160, 200, 245, 0.58);
          font-size: 0.74rem;
          font-family: var(--font-jetbrains), monospace;
          letter-spacing: 0.03em;
          text-decoration: none;
          background: transparent;
          transition: border-color 140ms ease, color 140ms ease;
        }

        .header-cta:hover {
          border-color: rgba(55, 185, 155, 0.35);
          color: rgba(200, 230, 255, 0.9);
        }

        #platform,
        #solutions,
        #how-it-works {
          scroll-margin-top: 60px;
        }

        .hero-section,
        .capability-section,
        .how-section,
        .preview-section,
        .signals-section,
        .cta-section {
          position: relative;
          z-index: 1;
          max-width: 1240px;
          margin: 0 auto;
          padding-left: 1.5rem;
          padding-right: 1.5rem;
        }

        .hero-section {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          align-items: center;
          gap: 2rem;
          min-height: calc(100vh - 7rem);
          padding-top: 3.5rem;
          padding-bottom: 4rem;
        }

        .hero-copy {
          max-width: 34rem;
          position: relative;
          z-index: 3;
        }

        .eyebrow,
        .section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.45rem 0.85rem;
          border-radius: 999px;
          border: 1px solid rgba(147, 122, 255, 0.3);
          background: rgba(20, 16, 44, 0.5);
          color: #b8a4ff;
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.78rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .eyebrow-dot {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 999px;
          background: #47f2bd;
          box-shadow: 0 0 18px rgba(71, 242, 189, 0.8);
        }

        .hero-copy h1 {
          margin-top: 1.7rem;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(3.4rem, 7vw, 5.6rem);
          line-height: 0.94;
          letter-spacing: -0.075em;
          color: #f7fbff;
          text-wrap: balance;
        }

        .hero-copy h1 span {
          background: linear-gradient(90deg, #36e2b8 0%, #0eb5c8 55%, #7fd8ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-copy p,
        .section-heading p,
        .preview-copy p,
        .cta-card p,
        .capability-card p,
        .signal-card p {
          color: rgba(214, 224, 240, 0.76);
          font-size: 1.05rem;
          line-height: 1.8;
        }

        .hero-copy p {
          margin-top: 1.55rem;
          max-width: 32rem;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 2rem;
        }

        .primary-cta,
        .secondary-cta,
        .panel-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          min-height: 3.5rem;
          border-radius: 1rem;
          text-decoration: none;
          font-weight: 600;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
        }

        .primary-cta {
          position: relative;
          overflow: hidden;
          padding: 0.95rem 1.4rem;
          color: #06040f;
          background: linear-gradient(135deg, #a78bfa 0%, #6ea8ff 48%, #34e3c0 100%);
          box-shadow: 0 18px 50px rgba(124, 92, 255, 0.3);
        }

        .primary-cta::after {
          content: '';
          position: absolute;
          top: 0;
          left: -80%;
          width: 55%;
          height: 100%;
          background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.45), transparent);
          transform: skewX(-20deg);
          transition: left 480ms ease;
        }

        .primary-cta:hover::after {
          left: 130%;
        }

        .primary-cta:hover {
          box-shadow: 0 20px 60px rgba(124, 92, 255, 0.5), 0 0 30px rgba(79, 240, 200, 0.2);
        }

        .primary-cta:hover,
        .secondary-cta:hover,
        .panel-button:hover {
          transform: translateY(-2px);
        }

        .secondary-cta,
        .panel-button {
          appearance: none;
          border: 1px solid rgba(136, 158, 193, 0.2);
          cursor: pointer;
          padding: 0.95rem 1.25rem;
          background: rgba(15, 22, 39, 0.85);
          color: #eef5ff;
          text-decoration: none;
        }

        .secondary-cta:hover,
        .panel-button:hover {
          border-color: rgba(80, 219, 183, 0.35);
          box-shadow: 0 0 30px rgba(22, 186, 170, 0.12);
        }

        .hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 2.1rem;
        }

        .metric-card {
          padding: 1rem 1rem 1.1rem;
          border-radius: 1.1rem;
          border: 1px solid rgba(122, 145, 182, 0.14);
          background: linear-gradient(180deg, rgba(10, 17, 32, 0.9), rgba(8, 14, 26, 0.72));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .metric-value {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.45rem;
          font-weight: 700;
          letter-spacing: -0.05em;
          color: #eff8ff;
        }

        .metric-label {
          margin-top: 0.25rem;
          color: rgba(186, 200, 222, 0.7);
          font-size: 0.92rem;
        }

        .hero-scene {
          position: relative;
          min-height: 44rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scene-glow {
          position: absolute;
          inset: 14% 8% 10% 16%;
          background: radial-gradient(circle at 62% 24%, rgba(49, 230, 191, 0.24), transparent 32%),
            radial-gradient(circle at 54% 48%, rgba(31, 129, 255, 0.18), transparent 38%);
          filter: blur(24px);
        }

        .scene-frame {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 2rem;
          mask-image: radial-gradient(circle at 45% 46%, rgba(0, 0, 0, 1) 52%, rgba(0, 0, 0, 0.74) 74%, rgba(0, 0, 0, 0) 100%);
        }

        .scene-frame::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 80% 8%, rgba(76, 255, 223, 0.22), transparent 18%),
            linear-gradient(180deg, rgba(4, 8, 18, 0.12), rgba(4, 8, 18, 0.56) 68%, rgba(4, 8, 18, 0.92));
          pointer-events: none;
        }

        .scene-rail {
          position: absolute;
          top: 36%;
          left: 18%;
          width: 54%;
          height: 1.2rem;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(9, 11, 18, 0.96), rgba(2, 3, 9, 0.96));
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          transform: rotate(9deg);
          opacity: 0.9;
        }

        .section-heading {
          max-width: 48rem;
          margin: 0 auto;
          text-align: center;
        }

        .section-heading.compact {
          margin-bottom: 2.4rem;
        }

        .section-heading h2,
        .preview-copy h2,
        .cta-card h2 {
          margin-top: 1.3rem;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(2.2rem, 4vw, 3.5rem);
          line-height: 1.02;
          letter-spacing: -0.05em;
          color: #f6faff;
        }

        .section-heading p,
        .preview-copy p,
        .cta-card p {
          margin-top: 1rem;
        }

        .capability-section {
          padding-top: 6rem;
          padding-bottom: 2rem;
        }

        .signals-section {
          padding-top: 5rem;
          padding-bottom: 2rem;
        }

        .capability-grid,
        .signals-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.25rem;
          margin-top: 3rem;
        }

        .capability-card,
        .signal-card {
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
          border-radius: 1.5rem;
          border: 1px solid rgba(125, 147, 182, 0.14);
          background:
            linear-gradient(180deg, rgba(12, 20, 38, 0.95), rgba(7, 12, 23, 0.84)),
            radial-gradient(circle at top right, rgba(69, 195, 255, 0.08), transparent 34%);
          box-shadow: 0 26px 60px rgba(0, 0, 0, 0.18);
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 260ms ease, box-shadow 260ms ease;
        }

        .capability-card::before,
        .signal-card::before,
        .how-step::before {
          content: '';
          position: absolute;
          top: 0;
          left: 12%;
          right: 12%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.6), rgba(79, 240, 200, 0.4), transparent);
          opacity: 0;
          transition: opacity 260ms ease;
        }

        .capability-card:hover,
        .signal-card:hover {
          transform: translateY(-6px);
          border-color: rgba(147, 122, 255, 0.4);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.3), 0 0 44px rgba(124, 92, 255, 0.13);
        }

        .capability-card:hover::before,
        .signal-card:hover::before,
        .how-step:hover::before {
          opacity: 1;
        }

        .capability-card:hover .capability-icon,
        .signal-card:hover .signal-icon {
          transform: scale(1.08);
          box-shadow: 0 0 24px rgba(54, 226, 184, 0.25);
        }

        .capability-icon,
        .signal-icon {
          width: 2.9rem;
          height: 2.9rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.95rem;
          color: #65f0c5;
          background: linear-gradient(180deg, rgba(36, 223, 177, 0.16), rgba(14, 40, 44, 0.6));
          border: 1px solid rgba(64, 218, 176, 0.22);
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease;
        }

        .capability-card h3,
        .signal-card h3 {
          margin-top: 1.2rem;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.35rem;
          letter-spacing: -0.03em;
          color: #eef6ff;
        }

        .preview-section {
          display: grid;
          grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
          gap: 1.5rem;
          align-items: center;
          padding-top: 4.5rem;
          padding-bottom: 4.5rem;
        }

        .preview-copy {
          max-width: 32rem;
        }

        .bullet-list {
          display: grid;
          gap: 0.9rem;
          margin-top: 1.6rem;
        }

        .bullet-list div {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          color: #dce7f5;
          font-size: 0.98rem;
        }

        .bullet-list svg {
          color: #49efbb;
          flex: 0 0 auto;
        }

        .dashboard-panel {
          padding: 1.1rem;
          border-radius: 1.8rem;
          border: 1px solid rgba(93, 119, 160, 0.2);
          background:
            radial-gradient(circle at top center, rgba(55, 218, 187, 0.08), transparent 22%),
            linear-gradient(180deg, rgba(11, 19, 36, 0.98), rgba(8, 14, 27, 0.95));
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 42px 120px rgba(0, 0, 0, 0.38),
            0 0 60px rgba(44, 203, 194, 0.12);
        }

        .dashboard-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.9rem;
          padding: 0.65rem 0.75rem;
          border-radius: 1.1rem;
          background: rgba(9, 15, 28, 0.76);
          border: 1px solid rgba(118, 142, 181, 0.12);
        }

        .dashboard-brand {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          color: rgba(186, 201, 224, 0.8);
          font-size: 0.92rem;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.78fr 0.74fr;
          gap: 0.9rem;
        }

        .panel-box,
        .alert-strip {
          border-radius: 1.15rem;
          border: 1px solid rgba(111, 136, 173, 0.14);
          background: rgba(13, 21, 37, 0.88);
          padding: 1rem;
        }

        .panel-label {
          color: #8ed9ff;
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .panel-health,
        .panel-flow {
          grid-column: span 1;
        }

        .panel-runs,
        .panel-score,
        .panel-bars,
        .panel-timer {
          min-height: 0;
        }

        .progress-list {
          display: grid;
          gap: 0.9rem;
          margin-top: 1rem;
        }

        .progress-copy {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          color: #dbe6f7;
          font-size: 0.88rem;
          margin-bottom: 0.45rem;
        }

        .progress-track {
          height: 0.45rem;
          border-radius: 999px;
          background: rgba(35, 53, 83, 0.78);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #36e2b8, #8bd7ff);
          box-shadow: 0 0 12px rgba(54, 226, 184, 0.34);
        }

        .panel-stat {
          margin-top: 0.8rem;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 4.2rem;
          line-height: 0.9;
          letter-spacing: -0.08em;
          color: #4cf0be;
        }

        .panel-substat {
          margin-top: 0.35rem;
          color: rgba(186, 200, 223, 0.72);
          font-size: 0.92rem;
        }

        .panel-runlist {
          display: grid;
          gap: 0.45rem;
          margin-top: 1rem;
          color: #dce6f5;
          font-size: 0.9rem;
        }

        .panel-timer-readout {
          margin-top: 1.1rem;
          font-family: var(--font-jetbrains), monospace;
          font-size: clamp(1.6rem, 2vw, 2.2rem);
          color: #f7fafc;
        }

        .alert-strip {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: linear-gradient(90deg, rgba(102, 65, 17, 0.88), rgba(56, 40, 18, 0.88));
          border-color: rgba(242, 178, 72, 0.2);
        }

        .alert-copy {
          color: #ffd586;
          font-size: 0.9rem;
        }

        .flow-track {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.7rem;
          margin-top: 1.45rem;
        }

        .flow-node {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 5.8rem;
          padding: 0.85rem 1rem;
          border-radius: 999px;
          font-size: 0.86rem;
          font-weight: 600;
          color: #f8fafc;
        }

        .bronze {
          background: linear-gradient(180deg, rgba(171, 106, 44, 0.9), rgba(112, 67, 19, 0.9));
        }

        .silver {
          background: linear-gradient(180deg, rgba(151, 164, 184, 0.94), rgba(110, 122, 140, 0.92));
        }

        .gold {
          background: linear-gradient(180deg, rgba(231, 191, 58, 0.95), rgba(186, 132, 20, 0.92));
        }

        .flow-arrow {
          position: relative;
          flex: 1;
          height: 2px;
          background: linear-gradient(90deg, rgba(68, 115, 171, 0.2), rgba(94, 214, 191, 0.7), rgba(68, 115, 171, 0.2));
        }

        .flow-arrow::after {
          content: '';
          position: absolute;
          right: -1px;
          top: 50%;
          width: 0.55rem;
          height: 0.55rem;
          border-top: 2px solid rgba(94, 214, 191, 0.9);
          border-right: 2px solid rgba(94, 214, 191, 0.9);
          transform: translateY(-50%) rotate(45deg);
        }

        .gauge-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
          margin-top: 1rem;
        }

        .gauge {
          text-align: center;
        }

        .gauge-ring {
          width: 5.5rem;
          height: 5.5rem;
          margin: 0 auto 0.65rem;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at center, rgba(8, 15, 28, 0.98) 57%, transparent 58%),
            conic-gradient(#4cf0be 0deg 315deg, rgba(55, 77, 110, 0.45) 315deg 360deg);
          color: #54efc3;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .gauge-ring.secondary {
          background:
            radial-gradient(circle at center, rgba(8, 15, 28, 0.98) 57%, transparent 58%),
            conic-gradient(#ffd576 0deg 300deg, rgba(55, 77, 110, 0.45) 300deg 360deg);
          color: #ffd576;
        }

        .gauge label {
          color: rgba(185, 199, 222, 0.72);
          font-size: 0.88rem;
        }

        .bar-chart {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          align-items: end;
          gap: 0.55rem;
          margin-top: 1.2rem;
          min-height: 8.8rem;
        }

        .bar-column {
          height: 8.8rem;
          display: flex;
          align-items: end;
        }

        .bar {
          width: 100%;
          border-radius: 0.65rem 0.65rem 0.25rem 0.25rem;
          background: linear-gradient(180deg, #75e8c9 0%, #32add8 100%);
          box-shadow: 0 0 18px rgba(58, 215, 189, 0.18);
        }

        .signal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .signal-chip {
          color: rgba(196, 210, 228, 0.72);
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .signal-teal .signal-icon {
          color: #54efc3;
        }

        .signal-cyan .signal-icon {
          color: #8fd2ff;
          background: linear-gradient(180deg, rgba(46, 160, 255, 0.18), rgba(14, 30, 56, 0.6));
          border-color: rgba(108, 178, 255, 0.24);
        }

        .signal-amber .signal-icon {
          color: #ffd17d;
          background: linear-gradient(180deg, rgba(255, 184, 67, 0.16), rgba(49, 32, 14, 0.58));
          border-color: rgba(255, 191, 82, 0.24);
        }

        .cta-section {
          padding-top: 4rem;
          padding-bottom: 6rem;
        }

        .cta-card {
          max-width: 56rem;
          margin: 0 auto;
          padding: 3rem;
          border-radius: 2rem;
          text-align: center;
          border: 1px solid rgba(121, 145, 182, 0.16);
          background:
            radial-gradient(circle at top center, rgba(47, 228, 191, 0.12), transparent 28%),
            linear-gradient(180deg, rgba(11, 19, 34, 0.96), rgba(7, 13, 24, 0.92));
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.28);
        }

        .cta-actions {
          justify-content: center;
        }

        /* ── Hero highlight strip ── */
        .hero-highlight-strip {
          display: flex;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(3,7,18,0.92);
          backdrop-filter: blur(16px);
        }
        .hero-highlight {
          flex: 1;
          padding: 1.1rem 1.5rem;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .hero-highlight:last-child {
          border-right: none;
        }
        .highlight-label {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.86rem;
          font-weight: 600;
          color: #dce6f5;
          letter-spacing: -0.01em;
        }
        .highlight-detail {
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.68rem;
          color: rgba(71, 242, 189, 0.62);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ── Scroll-reveal with staggered children ── */
        .section-fade-in {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .section-fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .section-fade-in .capability-card,
        .section-fade-in .signal-card,
        .section-fade-in .how-step {
          opacity: 0;
          transform: translateY(26px);
          transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.7s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 260ms ease, box-shadow 260ms ease;
        }
        .section-fade-in.visible .capability-card,
        .section-fade-in.visible .signal-card,
        .section-fade-in.visible .how-step {
          opacity: 1;
          transform: translateY(0);
        }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):nth-child(1) { transition-delay: 0.1s; }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):nth-child(2) { transition-delay: 0.22s; }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):nth-child(3) { transition-delay: 0.34s; }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):nth-child(4) { transition-delay: 0.46s; }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):nth-child(5) { transition-delay: 0.58s; }
        .section-fade-in.visible :is(.capability-card, .signal-card, .how-step):hover {
          transform: translateY(-6px);
          transition-delay: 0s;
        }

        /* ── Nav scroll state ── */
        .landing-nav {
          background: linear-gradient(to bottom, rgba(3, 7, 18, 0.85) 0%, rgba(3, 7, 18, 0.4) 70%, transparent 100%);
          border-bottom: 1px solid transparent;
          transition: background 320ms ease, border-color 320ms ease, backdrop-filter 320ms ease;
        }
        .landing-nav.nav-scrolled {
          background: rgba(4, 5, 14, 0.72);
          backdrop-filter: blur(14px);
          border-bottom-color: rgba(147, 122, 255, 0.16);
        }

        /* ── Headline gradient shimmer ── */
        .gradient-shimmer {
          animation: gradient-pan 7s linear infinite;
        }
        @keyframes gradient-pan {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        /* ── Stack marquee ── */
        .marquee {
          overflow: hidden;
          padding: 1.15rem 0;
          border-top: 1px solid rgba(125, 147, 182, 0.12);
          border-bottom: 1px solid rgba(125, 147, 182, 0.12);
          background: rgba(8, 14, 28, 0.45);
          mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 36s linear infinite;
        }
        .marquee:hover .marquee-track {
          animation-play-state: paused;
        }
        .marquee-item {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(160, 186, 214, 0.6);
        }
        .marquee-dot {
          margin: 0 1.6rem;
          font-size: 0.45rem;
          color: rgba(167, 139, 250, 0.6);
        }
        @keyframes marquee-scroll {
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }

        /* ── Motion wrappers ── */
        .how-step-item {
          flex: 1;
          display: flex;
        }
        .how-step-item .how-step {
          flex: 1;
        }

        /* ── Footer links ── */
        .footer-col a {
          color: inherit;
          text-decoration: none;
          transition: color 180ms ease;
        }
        .footer-col a:hover {
          color: #47f2bd;
        }

        @media (prefers-reduced-motion: reduce) {
          .section-fade-in,
          .section-fade-in .capability-card,
          .section-fade-in .signal-card,
          .section-fade-in .how-step {
            opacity: 1;
            transform: none;
            transition: none;
          }
          .gradient-shimmer { animation: none; }
        }

        /* ── How it works ── */
        .how-section {
          padding-top: 5rem;
          padding-bottom: 5rem;
        }
        .how-steps {
          display: flex;
          align-items: stretch;
          margin-top: 3.5rem;
        }
        .how-step {
          flex: 1;
          position: relative;
          overflow: hidden;
          padding: 2rem 1.75rem;
          border-radius: 1.5rem;
          border: 1px solid rgba(125, 147, 182, 0.14);
          background:
            linear-gradient(180deg, rgba(12, 20, 38, 0.95), rgba(7, 12, 23, 0.84)),
            radial-gradient(circle at top right, rgba(69, 195, 255, 0.06), transparent 34%);
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 260ms ease, box-shadow 260ms ease;
        }

        .how-step:hover {
          transform: translateY(-6px);
          border-color: rgba(147, 122, 255, 0.4);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.3), 0 0 44px rgba(124, 92, 255, 0.13);
        }
        .step-number {
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          color: #47f2bd;
          text-transform: uppercase;
        }
        .step-icon {
          width: 2.8rem;
          height: 2.8rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.9rem;
          color: #65f0c5;
          background: linear-gradient(180deg, rgba(36, 223, 177, 0.16), rgba(14, 40, 44, 0.6));
          border: 1px solid rgba(64, 218, 176, 0.22);
        }
        .how-step h3 {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.2rem;
          letter-spacing: -0.03em;
          color: #eef6ff;
          margin: 0;
        }
        .how-step p {
          color: rgba(214, 224, 240, 0.72);
          font-size: 0.98rem;
          line-height: 1.75;
          margin: 0;
        }
        .step-connector {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1.25rem;
          color: rgba(94, 214, 191, 0.35);
          flex-shrink: 0;
        }

        /* ── Footer ── */
        .footer-wrapper {
          border-top: 1px solid rgba(125, 147, 182, 0.1);
          max-width: 1240px;
          margin: 0 auto;
          padding: 3.5rem 1.5rem 2.5rem;
        }
        .footer-inner {
          display: grid;
          grid-template-columns: 1.6fr repeat(3, 1fr);
          gap: 2rem;
          margin-bottom: 2.5rem;
        }
        .footer-brand p {
          color: rgba(186, 200, 222, 0.55);
          font-size: 0.9rem;
          line-height: 1.7;
          margin-top: 0.9rem;
          max-width: 18rem;
        }
        .footer-col h4 {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.92rem;
          font-weight: 600;
          color: #dce6f5;
          margin-bottom: 0.85rem;
        }
        .footer-col ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 0.55rem;
        }
        .footer-col li {
          color: rgba(186, 200, 222, 0.48);
          font-size: 0.9rem;
          cursor: pointer;
          transition: color 160ms;
        }
        .footer-col li:hover {
          color: #dce6f5;
        }
        .footer-bottom {
          border-top: 1px solid rgba(125, 147, 182, 0.08);
          padding-top: 1.5rem;
          color: rgba(186, 200, 222, 0.32);
          font-size: 0.86rem;
        }

        @media (max-width: 1100px) {
          .hero-section,
          .preview-section {
            grid-template-columns: 1fr;
          }

          .hero-copy,
          .preview-copy {
            max-width: none;
          }

          .hero-scene {
            min-height: 34rem;
            order: -1;
          }
        }

        @media (max-width: 900px) {
          .site-nav {
            display: none;
          }

          .capability-grid,
          .signals-grid,
          .hero-metrics {
            grid-template-columns: 1fr;
          }

          .how-steps {
            flex-direction: column;
          }
          .step-connector {
            padding: 0.75rem 0;
            transform: rotate(90deg);
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .footer-inner {
            grid-template-columns: 1fr 1fr;
          }

          .alert-strip {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 640px) {
          .site-header-inner {
            padding: 0.5rem 1rem;
          }

          .site-header-inner ~ .cta-card,
          .cta-card {
            padding: 1rem;
          }

          .hero-section,
          .capability-section,
          .how-section,
          .preview-section,
          .signals-section,
          .cta-section {
            padding-left: 1rem;
            padding-right: 1rem;
          }

          .footer-inner {
            grid-template-columns: 1fr;
          }

          .footer-wrapper {
            padding: 2.5rem 1rem 2rem;
          }

          .hero-section {
            padding-top: 2rem;
            padding-bottom: 3rem;
          }

          .hero-scene {
            min-height: 24rem;
          }

          .scene-rail {
            top: 40%;
            left: 14%;
            width: 62%;
          }

          .flow-track {
            flex-direction: column;
          }

          .flow-arrow {
            width: 2px;
            height: 1.4rem;
          }

          .flow-arrow::after {
            top: auto;
            bottom: -1px;
            left: 50%;
            right: auto;
            transform: translateX(-50%) rotate(135deg);
          }
        }
      `}</style>
    </main>
  );
}
