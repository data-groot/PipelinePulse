'use client';

import { useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

const spring = { type: 'spring' as const, stiffness: 90, damping: 18, mass: 0.9 };

/** Fade-up-with-blur reveal when the element scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 36,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.98, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: spring },
};

/** Container whose children (StaggerItem) cascade in one after another. */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial={reduced ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** Hero headline: each word rises out of its own mask, staggered. */
export function WordReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}
        >
          <motion.span
            style={{ display: 'inline-block' }}
            initial={reduced ? false : { y: '110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring, delay: delay + i * 0.07 }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  );
}

/** A phrase that rises in as one block — used for the gradient headline part. */
export function RiseIn({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}>
      <motion.span
        className={className}
        style={{ display: 'inline-block', ...style }}
        initial={reduced ? false : { y: '110%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Magnetic hover: the element leans toward the cursor, springs back on leave. */
export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setOffset({
      x: (e.clientX - rect.left - rect.width / 2) * 0.25,
      y: (e.clientY - rect.top - rect.height / 2) * 0.35,
    });
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ display: 'inline-block' }}
      onMouseMove={onMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 220, damping: 16, mass: 0.6 }}
    >
      {children}
    </motion.div>
  );
}

/** Infinite horizontal ticker of the project's tech stack. */
export function Marquee({ items }: { items: string[] }) {
  const row = items.map((item, i) => (
    <span key={`${item}-${i}`} className="marquee-item">
      {item}
      <span className="marquee-dot" aria-hidden="true">
        ◆
      </span>
    </span>
  ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
