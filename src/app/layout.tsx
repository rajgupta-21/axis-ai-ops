import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { apiFetch } from "@/lib/apiClient";
import { SystemInfo } from "@/domain/system";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Server Impact Analysis",
  description: "Server Version & Patch Impact Analysis",
};

async function getAnsibleProvider(): Promise<string> {
  try {
    const info = await apiFetch<SystemInfo>("/api/system/info");
    return info.ansibleProvider;
  } catch {
    return "unknown";
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const ansibleProvider = await getAnsibleProvider();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-full">
        <Sidebar ansibleProvider={ansibleProvider} />
        <div className="flex min-h-full flex-1 flex-col overflow-x-hidden">
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
