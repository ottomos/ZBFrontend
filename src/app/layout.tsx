"use client";

import type { Metadata } from "next";
import "./globals.css";
import { ConfigProvider } from "./context/ConfigContext";
import { EntityProvider } from "./context/EntityContext";
import { AppTopNavigation } from "./components/AppTopNavigation";
import { isDealer } from "./types/user";
import { SALES_HOME_PATH, isSalesPath } from "./lib/salesNav";
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Client-side auth guard: redirect to /login if session invalid
  // Keeps public routes (like /login) accessible.
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (!pathname) return;
    const publicPaths = ['/login', '/api', '/_next', '/public'];
    if (publicPaths.some(p => pathname.startsWith(p))) return;

    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/users/me');
        const data = await res.json();
        if (!mounted) return;
        if (!data?.success) {
          try { localStorage.removeItem('user'); } catch {}
          router.push('/login');
          return;
        }
        // Dealers only have access to the Sales screens (plus their account page).
        if (isDealer(data.user) && !isSalesPath(pathname) && !pathname.startsWith('/account')) {
          router.replace(SALES_HOME_PATH);
        }
      } catch (err) {
        try { localStorage.removeItem('user'); } catch {}
        router.push('/login');
      }
    })();

    return () => { mounted = false; };
  }, [pathname, router]);

  return (
    <html lang="en">
      <body className="antialiased">
        <ConfigProvider>
          <EntityProvider>
            {/* Persistent navigation layer: stays mounted while the page
                content below changes on client-side navigation. */}
            <div className="app-shell flex h-screen flex-col overflow-hidden">
              <AppTopNavigation />
              <div className="min-h-0 flex-1">
                {children}
              </div>
            </div>
          </EntityProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
