/**
 * The dashboard's pictograms and action icons, drawn inline.
 *
 * Inline SVG for the same reason as the flags: about fifteen glyphs do not
 * justify an icon library. Every one is decorative - a caption or a heading
 * always sits beside it - so each is hidden from assistive technology, and
 * each is drawn in `currentColor`, inheriting the contrast its caption is
 * already held to.
 */
import type { ReactNode, SVGProps } from 'react';
import type { ValueIcon as ValueIconCode } from '../api/dashboard';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>;

function Glyph({
  children,
  viewBox = '0 0 24 24',
  size = 16,
  ...props
}: IconProps & { children: ReactNode; viewBox?: string; size?: number }) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Glyph>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14.2c3.2-.4 6 1.4 6 4.8" />
    </Glyph>
  );
}

export function FunnelIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 4.5h17l-6.5 8v6l-4 2v-8z" />
    </Glyph>
  );
}

/** Prepare data. */
export function ClipboardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3h6v1.5M8.5 11h7M8.5 15h5" />
    </Glyph>
  );
}

/** The pulse check. */
export function PulseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 12h4l2.5-6 4 12 2.5-6h6" />
    </Glyph>
  );
}

/** Start a meeting. */
export function PlayIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 4.5v15l12-7.5z" />
    </Glyph>
  );
}

export function ProblemIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </Glyph>
  );
}

export function TaskIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="m8 12.5 3 3 5-6.5" />
    </Glyph>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M5 8.5V20h14V8.5M10 12.5h4" />
    </Glyph>
  );
}

/** The mission. */
export function TargetIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </Glyph>
  );
}

/** The vision. */
export function EyeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Glyph>
  );
}

/** The strategic declaration: a compass, the direction set for years ahead. */
export function CompassIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5 13.2 13.2 8.5 15.5 10.8 10.8z" />
    </Glyph>
  );
}

/** The goals. */
export function FlagIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5" />
    </Glyph>
  );
}

/*
 * The four values, after the legacy board's Start view: an outlined hexagon
 * with the value's sign inside, the same paths redrawn in the theme's ink
 * rather than the legacy gold.
 */
function Hexagon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <Glyph viewBox="0 0 64 72" size={44} strokeWidth={2} {...props}>
      <polygon points="32,3 60,19 60,53 32,69 4,53 4,19" strokeWidth={1.6} />
      {children}
    </Glyph>
  );
}

/** Effectiveness: a check. */
export function EffectivenessIcon(props: IconProps) {
  return (
    <Hexagon {...props}>
      <path d="M22,37 L29,44 L43,28" />
    </Hexagon>
  );
}

/** Passion: a flame. */
export function PassionIcon(props: IconProps) {
  return (
    <Hexagon {...props}>
      <path d="M32,22 C 27,29 25,33 25,38 a7,7 0 0 0 14,0 c0,-3 -1.5,-5.5 -3,-8 -1,2 -2,3 -4,4 0,-4 0,-8 0,-12z" />
    </Hexagon>
  );
}

/** Innovation: a bulb. */
export function InnovationIcon(props: IconProps) {
  return (
    <Hexagon {...props}>
      <circle cx="32" cy="33" r="8" />
      <path d="M28,44 L36,44 M29,48 L35,48 M32,25 L32,22 M41,29 L43,27 M23,29 L21,27" />
    </Hexagon>
  );
}

/** Collaboration: two figures. */
export function CollaborationIcon(props: IconProps) {
  return (
    <Hexagon {...props}>
      <circle cx="24" cy="30" r="4.5" />
      <circle cx="40" cy="30" r="4.5" />
      <path d="M16,48 c0,-6 4,-9 8,-9 4,0 6,2 8,2 2,0 4,-2 8,-2 4,0 8,3 8,9" />
    </Hexagon>
  );
}

const VALUE_ICONS = {
  effectiveness: EffectivenessIcon,
  passion: PassionIcon,
  innovation: InnovationIcon,
  collaboration: CollaborationIcon,
} as const;

/** The pictogram for a value, chosen by the code the API sends with it. */
export function ValueIcon({ icon, ...props }: IconProps & { icon: ValueIconCode }) {
  const Icon = VALUE_ICONS[icon];
  return <Icon data-icon={icon} {...props} />;
}
