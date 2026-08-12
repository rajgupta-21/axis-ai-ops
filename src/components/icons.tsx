type IconProps = { className?: string };

const base = "h-4 w-4";

export function ServerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <circle cx="7" cy="7" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DashboardIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="12" width="8" height="9" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function HistoryIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CpuIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <path d="M9 3v2.2M12 3v2.2M15 3v2.2M9 18.8V21M12 18.8V21M15 18.8V21M3 9h2.2M3 12h2.2M3 15h2.2M18.8 9H21M18.8 12H21M18.8 15H21" strokeLinecap="round" />
    </svg>
  );
}

export function MemoryIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="4" y="7" width="16" height="10" rx="1.5" />
      <path d="M8 7V4.5M12 7V4.5M16 7V4.5M8 17v2.5M12 17v2.5M16 17v2.5" strokeLinecap="round" />
    </svg>
  );
}

export function DiskIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" />
      <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
    </svg>
  );
}

export function ShieldIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 3l7 3v5.5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12.2l2 2 4-4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PuzzleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        d="M9 4.5h3.2a1.4 1.4 0 0 1 1.3 1.9 1.4 1.4 0 0 0 1.9 1.9H19.5V11.6a1.4 1.4 0 0 1-1.9 1.3 1.4 1.4 0 0 0 0 2.6 1.4 1.4 0 0 1 1.9 1.3V19.5H15.6a1.4 1.4 0 0 1-1.3-1.9 1.4 1.4 0 0 0-2.6 0 1.4 1.4 0 0 1-1.3 1.9H6.5V15.6a1.4 1.4 0 0 0 1.9-1.3 1.4 1.4 0 0 0-1.9-1.3H4.5V9h2a1.4 1.4 0 0 0 1.3-1.9A1.4 1.4 0 0 1 9 4.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GaugeIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l3.5-4.5" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5l3 1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChecklistIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 6.5h9M11 12.5h9M11 18.5h9" strokeLinecap="round" />
    </svg>
  );
}

export function RollbackIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M7 7L3.5 10.5 7 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 10.5H14a6 6 0 1 1 0 12H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SummaryIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

export function VersionIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 12h13M13 6l4 6-4 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConfigIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <circle cx="12" cy="12" r="2.75" />
      <path
        d="M12 3.5v2.1M12 18.4v2.1M4.9 6.9l1.5 1.5M17.6 15.6l1.5 1.5M3.5 12h2.1M18.4 12h2.1M4.9 17.1l1.5-1.5M17.6 8.4l1.5-1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ServicesIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" strokeLinejoin="round" />
      <path d="M4 7l8 3 8-3M12 10v10" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 4l9 15.5H3L12 4z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RefreshIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 4.5v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6 14a8 8 0 1 0 1.8-8.4L4 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 3.5v11M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v2.5A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FlagIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M6 3.5v17" strokeLinecap="round" />
      <path d="M6 4.5h11l-2.5 3.5L17 11.5H6" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M7 3.5h7l3.5 3.5V20a0.5 0.5 0 0 1-0.5 0.5H7a0.5 0.5 0 0 1-0.5-0.5V4a0.5 0.5 0 0 1 0.5-0.5z" strokeLinejoin="round" />
      <path d="M14 3.5V7h3.5" strokeLinejoin="round" />
      <path d="M9 12h6M9 15.5h6M9 8.5h2" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.56V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.56 1H19.5a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InboxIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4 12h4l1.5 3h5L16 12h4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="6" width="16" height="13" rx="1.5" />
    </svg>
  );
}
