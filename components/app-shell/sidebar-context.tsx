"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load initial state from localStorage if needed, or simply initialize
  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem("prism-sidebar-collapsed");
    if (savedState) {
      try {
        setIsCollapsed(JSON.parse(savedState));
      } catch (e) {
        console.error("Failed to parse sidebar state");
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("prism-sidebar-collapsed", JSON.stringify(newState));
      return newState;
    });
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem("prism-sidebar-collapsed", JSON.stringify(collapsed));
  };

  // Prevent hydration mismatch by rendering default on server, then updating
  if (!isMounted) {
    return (
      <SidebarContext.Provider value={{ isCollapsed: false, toggleSidebar, setCollapsed }}>
        {children}
      </SidebarContext.Provider>
    )
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
