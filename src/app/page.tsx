'use client';

import { useAppStore, type Section } from '@/lib/store';
import {
  Menu, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Extracted Components ─────────────────────────────────────

import Sidebar from '@/components/shared/Sidebar';
import DashboardSection from '@/components/sections/DashboardSection';
import DiskExplorerSection from '@/components/sections/DiskExplorerSection';
import PrinterSection from '@/components/sections/PrinterSection';
import RadioSection from '@/components/sections/RadioSection';
import SleepTimer from '@/components/sections/SleepTimer';
import LibrarySection from '@/components/sections/LibrarySection';
import MusicSection from '@/components/sections/MusicSection';
import MoviesSection from '@/components/sections/MoviesSection';
import TvShowsSection from '@/components/sections/TvShowsSection';
import ImagesSection from '@/components/sections/ImagesSection';

function AppContent() {
  const { currentSection, sidebarOpen, setSidebarOpen, sidebarCollapsed } = useAppStore();

  const sectionTitles: Record<Section, string> = {
    dashboard: 'Dashboard',
    disks: 'Discos',
    music: 'Música',
    radio: 'Radio',
    movies: 'Películas',
    tvshows: 'TV Shows',
    printers: 'Impresora',
    library: 'Biblioteca',
    images: 'Imágenes',
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Sidebar />

      {/* Main content - no margin on mobile, sidebar offset on md+ */}
      <div className={`flex-1 ml-0 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-3 py-2.5 md:px-4 md:py-3">
          <div className="flex items-center gap-3">
            {/* Hamburger menu - mobile only */}
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h2 className="text-base font-semibold md:text-lg flex-1">{sectionTitles[currentSection]}</h2>
            <SleepTimer />
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 md:p-6 max-w-7xl mx-auto w-full">
          {currentSection === 'dashboard' && <DashboardSection />}
          {currentSection === 'disks' && <DiskExplorerSection />}
          {currentSection === 'library' && <LibrarySection />}
          {currentSection === 'music' && <MusicSection />}
          {currentSection === 'radio' && <RadioSection />}
          {currentSection === 'movies' && <MoviesSection />}
          {currentSection === 'tvshows' && <TvShowsSection />}
          {currentSection === 'images' && <ImagesSection />}
          {currentSection === 'printers' && <PrinterSection />}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return <AppContent />;
}
