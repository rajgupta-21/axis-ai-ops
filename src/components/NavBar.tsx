"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, HistoryIcon, ServerIcon } from "./icons";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/servers", label: "Servers", icon: ServerIcon, exact: false },
  { href: "/history", label: "Analysis History", icon: HistoryIcon, exact: false },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm font-medium text-slate-600">
      {NAV_LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
