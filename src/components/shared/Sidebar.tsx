'use client';

import React from 'react';
import {
  LayoutDashboard, HardDrive, Printer, Library as LibraryIcon,
  Menu, X, ChevronRight, ChevronLeft, Clock,
  Server as ServerIcon, Shield,
  Music, Radio, Film, Monitor, Image as ImageIcon,
} from 'lucide-react';
import { useAppStore, type Section } from '@/lib/store';
import { formatUptime } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Navigation Items ──────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'disks', label: 'Discos', icon: <HardDrive className="h-5 w-5" /> },
  { id: 'library', label: 'Biblioteca', icon: <LibraryIcon className="h-5 w-5" /> },
  { id: 'music', label: 'Música', icon: <Music className="h-5 w-5" /> },
  { id: 'radio', label: 'Radio', icon: <Radio className="h-5 w-5" /> },
  { id: 'movies', label: 'Películas', icon: <Film className="h-5 w-5" /> },
  { id: 'tvshows', label: 'TV Shows', icon: <Monitor className="h-5 w-5" /> },
  { id: 'images', label: 'Imágenes', icon: <ImageIcon className="h-5 w-5" /> },
  { id: 'printers', label: 'Impresora', icon: <Printer className="h-5 w-5" /> },
];

// ─── Sidebar Component ─────────────────────────────────────────

export default function Sidebar() {
  const { currentSection, setCurrentSection, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, serverStats } = useAppStore();

  return (
    <>
      {/* Mobile overlay - closes sidebar on tap */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col ${
        // Mobile: off-screen unless open
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        // Desktop: always visible, width changes based on collapsed state
      } md:translate-x-0 ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'}`}>
        {/* Header */}
        <div className={`border-b border-border flex items-center justify-between ${sidebarCollapsed ? 'md:p-2 md:justify-center' : 'p-4'} p-4`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3'}`}>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
              <ServerIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden md:opacity-0' : ''}`}>
              <h1 className="font-bold text-sm">Mi Servidor</h1>
              <p className="text-xs text-muted-foreground">Panel de Control</p>
            </div>
          </div>
          {/* Close button - mobile only */}
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
          {/* Collapse button - desktop only */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden md:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Server Info */}
        {serverStats && (
          <div className={`border-b border-border ${sidebarCollapsed ? 'md:px-2 md:py-3' : 'px-4 py-3'} px-4 py-3`}>
            <div className={`flex items-center gap-2 text-xs text-muted-foreground ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className={`truncate transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>{serverStats.hostname}</span>
            </div>
            <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-1 ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>Arriba {formatUptime(serverStats.uptime)}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 md:p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const btn = (
              <Button
                key={item.id}
                variant={currentSection === item.id ? 'secondary' : 'ghost'}
                className={`w-full ${
                  sidebarCollapsed ? 'md:justify-center md:px-0 md:h-10' : 'justify-start gap-3 h-10 px-3'
                } ${
                  currentSection === item.id
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setCurrentSection(item.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
              </Button>
            );

            // When collapsed on desktop, wrap in tooltip
            if (sidebarCollapsed) {
              return (
                <div key={item.id} className="hidden md:block">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      {btn}
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            return <div key={item.id}>{btn}</div>;
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-border ${sidebarCollapsed ? 'md:p-2' : 'p-3'} p-3`}>
          <div className={`flex items-center gap-2 text-xs text-muted-foreground ${sidebarCollapsed ? 'md:justify-center md:px-0' : 'px-3'} px-3 py-2`}>
            <Shield className="h-3.5 w-3.5 flex-shrink-0" />
            <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>Red Local</span>
          </div>
        </div>
      </aside>
    </>
  );
}
