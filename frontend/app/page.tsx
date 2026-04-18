'use client';

import { ArrowRight, Zap, Shield, Layers, AlertCircle, BarChart3, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const EKGLine = () => {
  return (
    <svg width="32" height="16" viewBox="0 0 100 30" className="heartbeat">
      <polyline
        points="0,15 10,15 15,5 20,25 25,15 35,15 40,10 45,20 50,15 100,15"
        fill="none"
        stroke="#00ff41"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const TerminalDemo = () => {
  const [displayText, setDisplayText] = useState('');
  const fullText = `[SYSTEM] Pipeline "Sales Data" triggered
[EXTRACT] Fetching 1,247 rows from REST API...
[TRANSFORM] Running data quality checks...
[QUALITY] Score: 97.3% ✓
[COMPLETE] Pipeline finished in 4.2s`;

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 20);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="terminal-border bg-black/50 p-6 font-mono text-primary text-sm leading-relaxed crt-screen">
      <div className="space-y-1">
        {displayText.split('\n').map((line, i) => (
          <div key={i} className="text-glow">
            {line}
            {i === displayText.split('\n').length - 1 && displayText.length < fullText.length && (
              <span className="animate-pulse">_</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navbar */}
      <nav className="border-b border-primary/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <EKGLine />
            </div>
            <span className="font-mono font-bold text-lg text-primary text-glow">PIPELINEPULSE</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-mono text-primary/70 hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-mono text-primary/70 hover:text-primary transition-colors">
              How it works
            </a>
            <a href="#docs" className="text-sm font-mono text-primary/70 hover:text-primary transition-colors">
              Docs
            </a>
          </div>
          <button className="glow-button">GET ACCESS</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        {/* Background scanlines */}
        <div className="absolute inset-0 scanline opacity-30 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8">
            <div className="space-y-2">
              <div className="font-mono text-primary/60 text-sm tracking-wider">// ETL OBSERVABILITY PLATFORM</div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
                Your data pipelines,<br />on autopilot.
              </h1>
            </div>

            <p className="text-lg text-primary/80 max-w-2xl mx-auto leading-relaxed font-mono">
              Connect any source. Monitor quality automatically. Get alerted before anyone notices something broke.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="glow-button">START FOR FREE →</button>
              <button className="glow-button-outline">VIEW DEMO</button>
            </div>

            <p className="text-sm text-primary/50 font-mono">No credit card required</p>
          </div>

          {/* Hero Visual - Terminal Window */}
          <div className="mt-16 max-w-2xl mx-auto">
            <TerminalDemo />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-primary/20 py-12 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary text-glow">500+</div>
              <div className="text-sm text-primary/60 font-mono mt-2">Pipelines Running</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-secondary">99.9%</div>
              <div className="text-sm text-primary/60 font-mono mt-2">Uptime Guarantee</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary text-glow">3+</div>
              <div className="text-sm text-primary/60 font-mono mt-2">Source Types</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16 text-glow">HOW IT WORKS</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="terminal-border p-4 bg-black/30 aspect-square flex items-center justify-center">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-mono text-primary">CONNECT</h3>
              <p className="text-primary/70 font-mono text-sm">
                Plug in REST API, CSV, or database sources. Set up in minutes, not weeks.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="terminal-border p-4 bg-black/30 aspect-square flex items-center justify-center">
                <Layers className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-lg font-bold font-mono text-secondary">AUTOMATE</h3>
              <p className="text-primary/70 font-mono text-sm">
                Pipeline runs on your schedule. Transforms data with built-in quality checks.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="terminal-border p-4 bg-black/30 aspect-square flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-mono text-primary">MONITOR</h3>
              <p className="text-primary/70 font-mono text-sm">
                Quality scores and instant alerts. Know about issues before your users do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 sm:py-32 bg-black/40 border-y border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16 text-glow">FEATURES</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="font-bold font-mono text-primary">No-Code Pipeline Creation</h3>
              <p className="text-sm text-primary/70 font-mono">
                Build powerful data pipelines without writing a single line of code.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <BarChart3 className="w-6 h-6 text-secondary" />
              <h3 className="font-bold font-mono text-secondary">Quality Scoring (0-100%)</h3>
              <p className="text-sm text-primary/70 font-mono">
                Automated data quality metrics with historical tracking and trends.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <Lock className="w-6 h-6 text-primary" />
              <h3 className="font-bold font-mono text-primary">Multi-Tenant Isolation</h3>
              <p className="text-sm text-primary/70 font-mono">
                Enterprise-grade data isolation with row-level security controls.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <Zap className="w-6 h-6 text-primary" />
              <h3 className="font-bold font-mono text-primary">Real-Time Monitoring</h3>
              <p className="text-sm text-primary/70 font-mono">
                Live pipeline status, logs, and performance metrics at your fingertips.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <Layers className="w-6 h-6 text-secondary" />
              <h3 className="font-bold font-mono text-secondary">3-Layer Data Cleaning</h3>
              <p className="text-sm text-primary/70 font-mono">
                Raw → Clean → Analytics. Automated validation at every stage.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="terminal-border p-6 bg-black/50 space-y-4">
              <AlertCircle className="w-6 h-6 text-primary" />
              <h3 className="font-bold font-mono text-primary">Instant Alerts</h3>
              <p className="text-sm text-primary/70 font-mono">
                Get notified the moment data quality drops. Customizable thresholds per pipeline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-glow">
            READY TO AUTOMATE<br />YOUR DATA?
          </h2>
          <button className="glow-button text-lg">START FOR FREE →</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-8 bg-black/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <EKGLine />
              <span className="font-mono text-sm text-primary">PIPELINEPULSE</span>
            </div>
            <p className="text-sm text-primary/50 font-mono">© 2024 PipelinePulse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
