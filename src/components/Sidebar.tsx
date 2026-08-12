"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  DocumentIcon,
  HistoryIcon,
  ServerIcon,
  SettingsIcon,
} from "./icons";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/servers", label: "Servers", icon: ServerIcon, exact: false },
  { href: "/history", label: "Analyses", icon: HistoryIcon, exact: false },
  { href: "/reports", label: "Reports", icon: DocumentIcon, exact: false },
  { href: "/settings", label: "Settings", icon: SettingsIcon, exact: false },
];

export function Sidebar({ ansibleProvider }: { ansibleProvider: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link href="/" className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <ServerIcon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold leading-tight text-slate-900">
          Server Impact
          <br />
          Analyzer
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <div className="text-xs">
            <p className="font-medium text-slate-700">Environment</p>
            <p className="capitalize text-slate-500">{ansibleProvider}</p>
          </div>
        </div>
        <p className="px-1 text-[11px] text-slate-400">Prototype · No authentication</p>
      </div>
    </aside>
  );
}
