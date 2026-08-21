type LumoIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function LumoHubIcon({ size = 30, strokeWidth = 2.1, className }: LumoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 30"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="26" height="18" rx="4" />
      <path d="M6 21h20l-2.3 5H8.3L6 21Z" />
      <path d="M12.5 6.7h7" opacity=".55" />
      <circle cx="16" cy="23.5" r=".85" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LumoBandIcon({ size = 24, strokeWidth = 2, className }: LumoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 5.7 11 2h6l1 3.7M10 26.3 11 30h6l1-3.7" />
      <rect x="7.5" y="5.5" width="13" height="21" rx="5.5" />
      <path d="M11.5 11h5M11.5 21h5" opacity=".62" />
      <circle cx="23" cy="9" r="2.7" fill="#28c99a" stroke="none" />
    </svg>
  );
}
