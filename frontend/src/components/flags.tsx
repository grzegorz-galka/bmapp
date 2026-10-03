/**
 * The two flags the language toggle shows, drawn inline.
 *
 * Not emoji: Windows renders the regional-indicator pairs as the letters "GB"
 * and "PL". Not a flag package either: that ships hundreds of flags to draw
 * two. Both are 3:2 and decorative - the language's name always sits beside
 * the flag, so assistive technology is told nothing here.
 */
import type { ReactNode, SVGProps } from 'react';

type FlagProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>;

function Flag({ children, ...props }: FlagProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 60 40"
      width={18}
      height={12}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The Union Flag, for English: the interface formats as en-GB. */
export function UnionFlag(props: FlagProps) {
  return (
    <Flag {...props}>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="12" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="7" />
    </Flag>
  );
}

/** The Polish flag: white over red. */
export function PolishFlag(props: FlagProps) {
  return (
    <Flag {...props}>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#DC143C" />
    </Flag>
  );
}
