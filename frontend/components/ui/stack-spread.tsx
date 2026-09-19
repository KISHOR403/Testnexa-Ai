// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import { ChevronDown } from "lucide-react";
import "./stack-spread.css";

const IMG = {
  plane: "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=800&q=80",
  painting: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
  breaker: "https://images.unsplash.com/photo-1535525153412-5a42439a210d?auto=format&fit=crop&w=800&q=80",
  dog: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
  footballer: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80",
  jacket: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80",
  meadow: "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=800&q=80",
  stripes: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
} as const;

// per-image rest scale, keyed by img index (1-8). default 1, drop below to shrink.
const SCALE: Partial<Record<number, number>> = {
  1: 0.9,
  2: 0.8,
  3: 0.9,
  4: 0.8,
  5: 0.8,
  6: 0.9,
  7: 0.9,
  8: 0.7,
};
const s = (i: number) => SCALE[i] ?? 1;

// array order = stack order, back (z 2) -> front (z 9)
export const DEFAULT_CARDS: StackSpreadCard[] = [
  // top-left stripes (img08) — sm row 1 left
  {
    item: { src: IMG.stripes, alt: "Colour stripes" },
    stackOffset: { x: -8, y: -10 },
    stackRotate: -18,
    target: { x: -20, y: -34, rotate: 0, scale: s(8), w: 17, h: 22 },
    targetSm: { x: -22, y: -40 },
    z: 2,
  },
  // top-right meadow (img07) — sm row 1 right
  {
    item: { src: IMG.meadow, alt: "Wildflower meadow" },
    stackOffset: { x: 14, y: -10 },
    stackRotate: 20,
    target: { x: 32, y: -30, rotate: 0, scale: s(7), w: 18, h: 32 },
    targetSm: { x: 22, y: -40 },
    z: 3,
  },
  // mid-left jacket (img06) — sm row 2 left
  {
    item: { src: IMG.jacket, alt: "Figure in a leather jacket" },
    stackOffset: { x: -16, y: 0 },
    stackRotate: -4,
    target: { x: -36, y: -2, rotate: 0, scale: s(6), w: 15, h: 32 },
    targetSm: { x: -22, y: -19 },
    z: 4,
  },
  // top-centre footballer (img05) — sm row 2 right
  {
    item: { src: IMG.footballer, alt: "Footballer mid-kick" },
    stackOffset: { x: 1, y: -10 },
    stackRotate: -2,
    target: { x: 6, y: -32, rotate: 0, scale: s(5), w: 25, h: 30 },
    targetSm: { x: 22, y: -19 },
    z: 5,
  },
  // mid-right dog (img04) — sm row 3 left
  {
    item: { src: IMG.dog, alt: "Terrier in profile" },
    stackOffset: { x: 18, y: 1 },
    stackRotate: 6,
    target: { x: 37, y: 6, rotate: 0, scale: s(4), w: 18, h: 32 },
    targetSm: { x: -22, y: 20 },
    z: 6,
  },
  // bottom-left breaker (img03) — sm row 3 right
  {
    item: { src: IMG.breaker, alt: "Breakdancer holding a pose" },
    stackOffset: { x: -6, y: 10 },
    stackRotate: 6,
    target: { x: -24, y: 34, rotate: 0, scale: s(3), w: 22, h: 25 },
    targetSm: { x: 22, y: 20 },
    z: 7,
  },
  // bottom-centre painting (img02) — sm row 4 left
  {
    item: { src: IMG.painting, alt: "Renaissance fresco detail" },
    stackOffset: { x: 8, y: 7 },
    stackRotate: 3,
    target: { x: 2, y: 36, rotate: 0, scale: s(2), w: 20, h: 26 },
    targetSm: { x: -22, y: 40 },
    z: 8,
  },
  // bottom-right plane (img01) — sm row 4 right
  {
    item: { src: IMG.plane, alt: "Vintage fighter plane" },
    stackOffset: { x: 20, y: 12 },
    stackRotate: -7,
    target: { x: 30, y: 34, rotate: 0, scale: s(1), w: 16, h: 20 },
    targetSm: { x: 22, y: 40 },
    z: 9,
  },
];

// ---------------------------------------------------------------------------
// Mechanism
// ---------------------------------------------------------------------------

// Scroll progress where the cluster starts scattering and where it finishes.
const SCATTER_START = 0.12;
const SCATTER_END = 0.9;

const PARALLAX_X = 2.6;
const PARALLAX_Y = 2.2;
const PARALLAX_SPRING = { stiffness: 90, damping: 22, mass: 0.6 };
const parallaxDepth = (i: number, total: number) =>
  total <= 1 ? 1 : 0.55 + (i / (total - 1)) * 0.75;

const SUB = "Digital products, interfaces, and experiences built around people.";

const RESPONSIVE = {
  desktop: {
    scale: null as number | null,
    small: false,
    colX: null as number | null,
    card: null as { w: number; h: number } | null,
  },
  small: {
    scale: 0.72,
    small: true,
    colX: 22,
    card: { w: 40, h: 20 },
  },
};

function useResponsive() {
  const [r, setR] = useState(RESPONSIVE.desktop);
  useEffect(() => {
    // Touch vs. mouse, not raw width: a narrow but mouse-driven frame (21st
    // preview, split editor) keeps the desktop scatter + pointer parallax;
    // only real touch devices drop to the stacked column layout.
    const mq = window.matchMedia("(pointer: coarse)");
    const read = () => setR(mq.matches ? RESPONSIVE.small : RESPONSIVE.desktop);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return r;
}

function usePointerParallax(active: boolean, enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, PARALLAX_SPRING);
  const y = useSpring(rawY, PARALLAX_SPRING);

  useEffect(() => {
    if (!enabled) return;

    if (!active) {
      rawX.set(0);
      rawY.set(0);
      return;
    }

    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1);
      rawY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      rawX.set(0);
      rawY.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active, enabled, rawX, rawY]);

  return { x, y };
}

export interface StackSpreadItem {
  src?: string;
  alt?: string;
  badge?: string;
  title?: string;
  description?: string;
  tag?: string;
  icon?: React.ReactNode;
  customContent?: React.ReactNode;
}

export interface StackSpreadTarget {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  w: number;
  h: number;
}

export interface StackSpreadCard {
  item: StackSpreadItem;
  target: StackSpreadTarget;
  /** final x/y (vw/vh) for tablet + mobile; falls back to `target` */
  targetSm?: { x: number; y: number };
  /** angle while clustered */
  stackRotate?: number;
  /** offset while clustered (vw/vh) */
  stackOffset?: { x: number; y: number };
  /** paint order, higher on top */
  z?: number;
}

function Card({
  card,
  progress,
  reduce,
  clusterRotation,
  scaleMul,
  isSmall,
  colX,
  fixedCard,
  stackScale,
  cardRadius,
  pointer,
  depth,
}: {
  card: StackSpreadCard;
  progress: MotionValue<number>;
  reduce: boolean | null;
  clusterRotation: boolean;
  /** uniform rest-scale for every card; null = use each card's own scale */
  scaleMul: number | null;
  isSmall: boolean;
  colX: number | null;
  fixedCard: { w: number; h: number } | null;
  /** scale of the cards while clustered, before the scatter */
  stackScale: number;
  /** corner radius on each card, in px (desktop) */
  cardRadius: number;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  depth: number;
}) {
  const { item, target } = card;

  const flat = reduce === true;
  const stackRotate = flat ? 0 : clusterRotation ? card.stackRotate ?? 0 : 0;
  const stackOffset = card.stackOffset ?? { x: 0, y: 0 };
  const restScale = scaleMul ?? target.scale ?? 1;

  // final resting spot: column grid on small screens, scatter on desktop
  const sm = isSmall && card.targetSm ? card.targetSm : null;
  const endX = sm
    ? colX != null
      ? Math.sign(sm.x) * colX
      : sm.x
    : target.x;
  const endY = sm ? sm.y : target.y;
  const endRotate = flat || isSmall ? 0 : target.rotate;

  // -50% keeps card centred on its anchor
  const translate = useTransform(
    [progress, pointer.x, pointer.y],
    ([p, px, py]: number[]) => {
      const tx = stackOffset.x + (endX - stackOffset.x) * p;
      const ty = stackOffset.y + (endY - stackOffset.y) * p;
      const drift = depth * p;
      const dx = tx - px * PARALLAX_X * drift;
      const dy = ty - py * PARALLAX_Y * drift;
      return `calc(-50% + ${dx}vw) calc(-50% + ${dy}vh)`;
    },
  );
  const rotate = useTransform(progress, [0, 1], [stackRotate, endRotate]);
  const scale = useTransform(progress, [0, 1], [stackScale, restScale]);

  const w = fixedCard ? `${fixedCard.w}vw` : `${target.w}vw`;
  const h = fixedCard ? `${fixedCard.h}vh` : `${target.h}vh`;

  return (
    <motion.div
      className="stack-spread-card-anchor absolute top-1/2 left-1/2 pointer-events-none will-change-transform"
      style={{
        width: w,
        height: h,
        translate,
        rotate,
        scale,
        zIndex: card.z ?? 1,
      }}
    >
      <CardFace item={item} cardRadius={cardRadius} />
    </motion.div>
  );
}

function CardFace({
  item,
  cardRadius,
}: {
  item: StackSpreadItem;
  cardRadius: number;
}) {
  return (
    <div
      className="stack-spread-card-face relative w-full h-full overflow-hidden shadow-2xl bg-[#0b101d] border border-white/10 rounded-lg flex flex-col justify-between"
      style={{ borderRadius: cardRadius }}
    >
      {item.customContent ? (
        item.customContent
      ) : item.src ? (
        <>
          <img
            src={item.src}
            alt={item.alt ?? ""}
            className="w-full h-full object-cover select-none pointer-events-none"
            loading="lazy"
            draggable={false}
          />
          {(item.badge || item.title) && (
            <div className="stack-spread-card-content">
              {item.badge && (
                <span className="inline-block self-start text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  {item.badge}
                </span>
              )}
              {item.title && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-0.5">{item.title}</h4>
                  {item.description && (
                    <p className="text-xs text-neutral-300 leading-snug">{item.description}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="stack-spread-card-no-image">
          <div>
            <div className="stack-spread-card-header">
              {item.icon && <div className="stack-spread-card-icon">{item.icon}</div>}
              {item.badge && <span className="stack-spread-card-badge">{item.badge}</span>}
            </div>
            {item.title && <h4 className="stack-spread-card-title">{item.title}</h4>}
            {item.description && <p className="stack-spread-card-desc">{item.description}</p>}
          </div>
          {item.tag && (
            <div className="stack-spread-card-tag">
              <span>{item.tag}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface StackSpreadStageProps {
  cards?: StackSpreadCard[];
  /** scatter scroll distance, in vh */
  scrollLength?: number;
  bgColor?: string;
  /** fan the clustered stack (default) or start flat */
  clusterRotation?: boolean;
  /** scale of the cards while clustered, before the scatter */
  stackScale?: number;
  /** corner radius on each card, in px (desktop only — mobile keeps its responsive radius) */
  cardRadius?: number;
  /** color of the centre headline and subtitle */
  textColor?: string;
  /** scroll progress (0-1) where the centre text starts fading in */
  textFadeStart?: number;
  /** show the "scroll to spread" hint at the bottom until the scatter begins */
  showScrollHint?: boolean;
  headline?: React.ReactNode;
  subtitle?: React.ReactNode;
  kicker?: string;
}

export function StackSpreadStage({
  cards = DEFAULT_CARDS,
  scrollLength = 350,
  bgColor = "#060911",
  clusterRotation = true,
  stackScale = 0.82,
  cardRadius = 12,
  textColor = "#ffffff",
  textFadeStart = 0.3,
  showScrollHint = true,
  headline,
  subtitle,
  kicker,
}: StackSpreadStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scale: scaleMul, small: isSmall, colX, card: fixedCard } =
    useResponsive();

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  // Phase 1 (0 to 0.30): Cards fan out rapidly into full open position
  // Phase 2 (0.30 to 0.70): Cards stay 100% fully open, static, readable & interactive with mouse parallax
  // Phase 3 (0.70 to 0.98): Stage smoothly dissolves/hides so user seamlessly sees the next content at 1.0
  const progress = useTransform(
    scrollYProgress,
    [0, 0.03, 0.30, 0.70, 1],
    [0, 0, 1, 1, 1]
  );

  const stageExitOpacity = useTransform(
    scrollYProgress,
    [0.70, 0.98],
    [1, 0]
  );

  const stageExitY = useTransform(
    scrollYProgress,
    [0.70, 0.98],
    [0, -40]
  );

  // centre text always fades in on scroll; the scale-in is dropped only when
  // reduced motion is confirmed (`true`), not on the null SSR value.
  const [spread, setSpread] = useState(false);
  useMotionValueEvent(progress, "change", (p) => {
    setSpread((was) => (was ? p > 0.985 : p >= 0.999));
  });
  const parallaxEnabled = reduce !== true && !isSmall;
  const pointer = usePointerParallax(spread, parallaxEnabled);

  const noScale = reduce === true;
  // If textFadeStart is 0, text is immediately visible at full opacity; otherwise it fades in as user scrolls
  const copyOpacity = useTransform(
    progress,
    textFadeStart === 0 ? [0, 0.1] : [textFadeStart, Math.min(1, textFadeStart + 0.3)],
    textFadeStart === 0 ? [1, 1] : [0, 1]
  );
  const copyScale = useTransform(
    progress,
    textFadeStart === 0 ? [0, 0.8] : [textFadeStart, 0.9],
    textFadeStart === 0 ? [0.98, 1] : [0.85, 1]
  );

  // scroll hint: visible while clustered, gone by the time the scatter starts
  const hintOpacity = useTransform(progress, [0, 0.15], [1, 0]);

  return (
    <div
      ref={wrapRef}
      className="stack-spread-wrapper relative w-full"
      style={{ height: `${scrollLength}vh`, backgroundColor: bgColor }}
    >
      <div className="stack-spread-sticky sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <motion.div
          className="relative w-full h-full flex items-center justify-center pointer-events-none"
          style={{
            opacity: stageExitOpacity,
            y: stageExitY,
          }}
        >
          {/* centre text */}
          <motion.div
            className="stack-spread-center-text relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-3xl pointer-events-none select-none"
            style={{
              opacity: copyOpacity,
              scale: noScale ? 1 : copyScale,
              color: textColor,
            }}
          >
            {kicker && (
              <span className="stack-spread-kicker">
                {kicker}
              </span>
            )}

            <h2 className="stack-spread-heading text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-4">
              {headline ?? (
                <>
                  Design <span className="italic font-serif">That</span> Responds.
                </>
              )}
            </h2>

            <p className="stack-spread-subtitle text-base sm:text-lg md:text-xl text-neutral-400 font-medium max-w-xl leading-relaxed">
              {subtitle ?? SUB}
            </p>
          </motion.div>

          {/* scattering cards */}
          <div className="stack-spread-cards-container absolute inset-0 pointer-events-none overflow-hidden">
            {cards.map((card, i) => (
              <Card
                key={i}
                card={card}
                progress={progress}
                reduce={reduce}
                clusterRotation={clusterRotation}
                scaleMul={scaleMul}
                isSmall={isSmall}
                colX={colX}
                fixedCard={fixedCard}
                stackScale={stackScale}
                cardRadius={cardRadius}
                pointer={pointer}
                depth={parallaxDepth(i, cards.length)}
              />
            ))}
          </div>

          {/* scroll hint */}
          {showScrollHint && (
            <motion.div
              className="stack-spread-scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs uppercase tracking-widest pointer-events-none"
              style={{ opacity: hintOpacity, color: textColor }}
            >
              <span>Scroll</span>
              <ChevronDown className="stack-spread-bounce w-4 h-4 text-blue-400" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export interface StackSpreadProps extends StackSpreadStageProps {}

export default function StackSpread(props: StackSpreadProps) {
  return <StackSpreadStage {...props} />;
}
