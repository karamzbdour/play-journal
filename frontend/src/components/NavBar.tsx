"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken, isAuthenticated } from "@/lib/auth";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Do not render NavBar on the login or play pages
  if (pathname === "/login" || pathname === "/play") return null;

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };


  const navItems = [
    { name: "Home", path: "/" },
    { name: "Chronicles", path: "/journal" },
    { name: "Account", path: "/account" },
  ];

  return (
    <nav 
      className="w-full py-4 px-6 border-b z-50 sticky top-0 backdrop-blur-md flex items-center justify-between transition-all"
      style={{
        background: "rgba(10, 6, 4, 0.85)",
        borderColor: "rgba(138, 117, 80, 0.25)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
      }}
    >
      {/* Brand Logo with Glowing Fire Hover Effect */}
      <Link href="/" className="relative group flex items-center justify-center cursor-pointer p-2">
        {/* 1. Fire / Glow Aura Layer (Behind Logo) */}
        <div 
          className="absolute -inset-2 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500 rounded-full pointer-events-none blur-md z-0"
          style={{
            background: "radial-gradient(circle, rgba(239,68,68,0.7) 0%, rgba(251,191,36,0.5) 50%, transparent 100%)",
            animation: "torch-flicker 1.5s ease-in-out infinite alternate"
          }}
        />

        {/* 2. Foreground Logo Image */}
        <img 
          src="/logo.webp" 
          alt="Play-Journal Logo" 
          className="relative z-10 w-12 h-12 object-contain transition-all duration-300 group-hover:scale-110 group-hover:rotate-12"
        />
      </Link>

      {/* Nav Links */}
      <div className="flex items-center gap-8">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className="group relative py-1 text-sm font-medium tracking-wide uppercase transition-all duration-300 cursor-pointer"
              style={{
                color: isActive ? "var(--torch)" : "#a18262",
                textShadow: isActive ? "0 0 8px rgba(251, 191, 36, 0.4)" : "none"
              }}
            >
              {item.name}
              
              {/* Sliding glowing underline hover/active animation */}
              <span 
                className={`absolute bottom-0 left-0 w-full h-[2px] bg-amber-400 transition-all duration-300 origin-left group-hover:scale-x-100 ${
                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0 group-hover:opacity-100"
                }`}
                style={{
                  boxShadow: "0 0 8px #fbbf24, 0 0 2px #fbbf24",
                  background: "linear-gradient(to right, #b45309, #fbbf24, #b45309)"
                }}
              />
            </Link>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        {mounted && isAuthenticated() ? (
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer border hover:bg-amber-950/20"
            style={{
              borderColor: "rgba(138, 117, 80, 0.4)",
              color: "#a18262"
            }}
          >
            Log out
          </button>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer"
            style={{
              background: "var(--torch)",
              color: "#1a1005"
            }}
          >
            Enter Tome
          </Link>
        )}
      </div>
    </nav>
  );
}
