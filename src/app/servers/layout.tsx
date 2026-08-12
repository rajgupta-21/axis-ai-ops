import { ServerListPanel } from "@/components/ServerListPanel";

export default function ServersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-1px)]">
      <ServerListPanel />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
