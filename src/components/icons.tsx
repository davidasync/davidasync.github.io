import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GitHubIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.71h.05c.53-.95 1.83-1.96 3.76-1.96 4.02 0 4.76 2.5 4.76 5.77V21h-4v-5.6c0-1.34-.03-3.07-1.95-3.07-1.96 0-2.26 1.46-2.26 2.97V21h-4V9Z" />
    </svg>
  );
}

export function MediumIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden {...props}>
      <path d="M4.37 7.05a1.2 1.2 0 0 0-.39-1.02L1.11 2.58v-.52h8.9l6.88 15.09 6.05-15.09h8.49v.52l-2.45 2.35a.8.8 0 0 0-.27.69v17.26a.8.8 0 0 0 .27.69l2.39 2.35v.52H19.35v-.52l2.48-2.41c.24-.24.24-.31.24-.69V8.93L15.2 26.39h-.94L6.26 8.93v11.65c-.07.5.09 1 .45 1.36l3.22 3.9v.52H.8v-.52l3.22-3.9c.35-.36.51-.86.42-1.36V7.05h-.07Z" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.53 3H21l-7.19 8.21L22.5 21h-6.6l-5.17-6.36L4.8 21H1.32l7.7-8.79L1.5 3h6.77l4.67 5.82L17.53 3Zm-1.22 16h1.93L7.79 4.94H5.72L16.31 19Z" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2.5" />
      <path d="m3.5 7.5 7.35 5.15a2 2 0 0 0 2.3 0L20.5 7.5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M4.5 12h15m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M12 4.5v15m0 0 6-6m-6 6-6-6" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M14 4.5h5.5V10M19 5l-8 8" />
      <path d="M18.5 14.5v4a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M12 3.5v11m0 0 4.5-4.5M12 14.5 7.5 10" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...strokeProps} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export const socialIcons = {
  github: GitHubIcon,
  linkedin: LinkedInIcon,
  medium: MediumIcon,
  x: XIcon,
  mail: MailIcon,
};
