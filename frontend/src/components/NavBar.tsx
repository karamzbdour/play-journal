"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken, isAuthenticated } from "@/lib/auth";

import { motion } from "framer-motion";

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

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
    window.dispatchEvent(new CustomEvent("close-book"));
  };


  const navItems = [
    { name: "Home", path: "/" },
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
      {/* Logo in top-left corner */}
      <div className="flex items-center w-16 h-10 relative">
        <a href="/" onClick={handleLogoClick} className="absolute -top-3 left-0 z-50">
          <motion.img
            src="/logo.webp"
            alt="Play Journal Logo"
            className="h-16 w-16 cursor-pointer object-contain"
            whileHover={{ 
              scale: 1.15, 
              rotate: 5, 
              filter: "drop-shadow(0 0 12px rgba(251, 191, 36, 0.7))" 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          />
        </a>
      </div>
      {/* Nav Links, pinned to the true center of the bar */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8">
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
      <div className="ml-auto flex items-center gap-4">
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
