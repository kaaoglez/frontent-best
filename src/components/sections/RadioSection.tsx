'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Edit, Eye, GripVertical, Heart, MoreVertical, Play, Pause,
  Plus, Radio, Trash2, Volume2, VolumeX, Headphones,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

// ─── Radio Stations Data ──────────────────────────────────────

const RADIO_STATIONS = [
  { id: '1', name: 'Jazz FM', genre: 'Jazz', url: 'https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3', country: '🇨🇭 Suiza' },
  { id: '2', name: 'Groove Salad', genre: 'Ambient', url: 'https://ice4.somafm.com/groovesalad-256-mp3', country: '🇺🇸 USA' },
  { id: '3', name: 'DEF CON Radio', genre: 'Electronic', url: 'https://ice4.somafm.com/defcon-256-mp3', country: '🇺🇸 USA' },
  { id: '4', name: 'FIP Radio', genre: 'Eclectic', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', country: '🇫🇷 Francia' },
  { id: '5', name: 'KEXP 90.3', genre: 'Indie/Alternative', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', country: '🇺🇸 Seattle' },
  { id: '7', name: 'Radio Paradise', genre: 'Eclectic', url: 'https://stream.radioparadise.com/mp3-192', country: '🇺🇸 USA' },
  { id: '8', name: 'SomaFM Drone Zone', genre: 'Drone/Ambient', url: 'https://ice4.somafm.com/dronezone-256-mp3', country: '🇺🇸 USA' },
  { id: '10', name: 'Lofi Girl', genre: 'Lo-Fi', url: 'https://play.streamafrica.net/lofiradio', country: '🌐 Internet' },
  // ── Vancouver 🇨🇦 ──
  { id: '11', name: 'CBC Radio One Vancouver', genre: 'News/Talk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBH_CBC.mp3', country: '🇨🇦 Vancouver' },
  { id: '12', name: 'CBC Music Vancouver', genre: 'Classical/ECM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBXAM_CBC.mp3', country: '🇨🇦 Vancouver' },
  { id: '20', name: 'The Beat 94.5 FM', genre: 'Hip Hop/R&B', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CFBTFM.mp3', country: '🇨🇦 Vancouver' },
  // ── La Habana 🇨🇺 ──
  { id: '15', name: 'Radio Progreso', genre: 'Informativa', url: 'https://icecast.teveo.cu/XjfW7qWN', country: '🇨🇺 La Habana' },
  { id: '16', name: 'Radio Rebelde', genre: 'Noticias/Música', url: 'https://icecast.teveo.cu/zrXXWK9F', country: '🇨🇺 La Habana' },
  { id: '17', name: 'Radio Reloj', genre: 'Noticias/Hora', url: 'https://icecast.teveo.cu/b3jbfThq', country: '🇨🇺 La Habana' },
  { id: '18', name: 'Radio Enciclopedia', genre: 'Cultural', url: 'https://icecast.teveo.cu/9Rnrbjzq', country: '🇨🇺 La Habana' },
  { id: '19', name: 'Radio Taíno', genre: 'Variada', url: 'https://icecast.teveo.cu/3MCwWg3V', country: '🇨🇺 La Habana' },
  { id: '21', name: 'Radio 26', genre: 'Cultural', url: 'https://www.radio26.cu/wp-content/uploads/2024/03/IDENTIFICACION-RADIO-26.mp3', country: '🇨🇺 La Habana' },
  { id: '22', name: 'Radio Ciudad de La Habana', genre: 'Variada', url: 'https://icecast.teveo.cu/g73XCjCH', country: '🇨🇺 La Habana' },
];

// ─── localStorage helpers for preset stations (order + hidden only; favorites use DB) ──

function getPresetOrder(): string[] | null {
  try { const o = JSON.parse(localStorage.getItem('radioPresetOrder') || ''); return Array.isArray(o) ? o : null; } catch { return null; }
}
function setPresetOrder(order: string[]) {
  localStorage.setItem('radioPresetOrder', JSON.stringify(order));
}
function getPresetHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('radioPresetHidden') || '[]')); } catch { return new Set(); }
}
function setPresetHidden(hidden: Set<string>) {
  localStorage.setItem('radioPresetHidden', JSON.stringify([...hidden]));
}

// ─── Sortable Preset Station Card (Grid) ──────────────────

function SortablePresetCard({ station, isActive, radioPlaying, isFavorite, onPlay, onToggleFavorite, onHide }: {
  station: typeof RADIO_STATIONS[number];
  isActive: boolean;
  radioPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: station.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'z-50 scale-105 shadow-xl' : ''}`}>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 relative ${
          isActive
            ? 'border-2 border-violet-400 bg-violet-50/50 dark:bg-violet-950/10'
            : 'hover:border-violet-200 dark:hover:border-violet-800'
        }`}
        onClick={onPlay}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Icon */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive && radioPlaying ? 'bg-violet-500 text-white' : 'bg-muted'
            }`}>
              {isActive && radioPlaying ? (
                <div className="flex items-end gap-[2px] h-2.5">
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                </div>
              ) : (
                <Headphones className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{station.name}</p>
                {isFavorite && <Heart className="h-3 w-3 text-rose-500 fill-rose-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{station.genre} · {station.country}</p>
            </div>

            {/* Play + 3-dot menu */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onToggleFavorite}>
                    <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
                    {isFavorite ? 'Quitar de Mis Emisoras' : 'Agregar a Mis Emisoras'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onHide} className="text-red-600 focus:text-red-600">
                    <Eye className="h-4 w-4 mr-2" />
                    Ocultar de la lista
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={isActive && radioPlaying ? 'default' : 'outline'}
                size="icon"
                className={`h-7 w-7 flex-shrink-0 ${isActive && radioPlaying ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                onClick={onPlay}
              >
                {isActive && radioPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sortable Custom Station Card (Grid) ──────────────────

function SortableStationCard({ station, isActive, radioPlaying, onPlay, onToggleFavorite, onEdit, onDelete }: {
  station: Record<string, unknown>;
  isActive: boolean;
  radioPlaying: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(station.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'z-50 scale-105 shadow-xl' : ''}`}>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 relative ${
          isActive
            ? 'border-2 border-violet-400 bg-violet-50/50 dark:bg-violet-950/10'
            : 'hover:border-violet-200 dark:hover:border-violet-800'
        }`}
        onClick={onPlay}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Icon */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive && radioPlaying ? 'bg-violet-500 text-white' : 'bg-muted'
            }`}>
              {isActive && radioPlaying ? (
                <div className="flex items-end gap-[2px] h-2.5">
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                </div>
              ) : (
                <Radio className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{String(station.name)}</p>
                {station.isFavorite && <Heart className="h-3 w-3 text-rose-500 fill-rose-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {station.genre ? `${String(station.genre)} · ` : ''}{station.country || ''}
              </p>
            </div>

            {/* Play + 3-dot menu */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onToggleFavorite}>
                    <Heart className={`h-4 w-4 mr-2 ${station.isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
                    {station.isFavorite ? 'Quitar de favoritas' : 'Marcar favorita'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={isActive && radioPlaying ? 'default' : 'outline'}
                size="icon"
                className={`h-7 w-7 flex-shrink-0 ${isActive && radioPlaying ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                onClick={onPlay}
              >
                {isActive && radioPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Radio Section ──────────────────────────────────────────

export default function RadioSection() {
  const radioAudioRef = useRef<HTMLAudioElement>(null);
  const [radioFilter, setRadioFilter] = useState('all');
  const { radioStation, setRadioStation, radioPlaying, setRadioPlaying, radioVolume, setRadioVolume } = useAppStore();
  const [customStations, setCustomStations] = useState<Array<Record<string, unknown>>>([]);
  const [showAddStation, setShowAddStation] = useState(false);
  const [stName, setStName] = useState('');
  const [stUrl, setStUrl] = useState('');
  const [stGenre, setStGenre] = useState('');
  const [stCountry, setStCountry] = useState('');
  const [stDescription, setStDescription] = useState('');
  const [radioTab, setRadioTab] = useState<'preset' | 'custom'>('preset');
  const [editingStation, setEditingStation] = useState<Record<string, unknown> | null>(null);

  // Preset station preferences
  const [presetHidden, setPresetHidden] = useState<Set<string>>(getPresetHidden);
  const [presetStations, setPresetStations] = useState<typeof RADIO_STATIONS>(() => {
    const order = getPresetOrder();
    if (order) {
      const ordered: typeof RADIO_STATIONS = [];
      const remaining = [...RADIO_STATIONS];
      for (const id of order) {
        const s = remaining.find(st => st.id === id);
        if (s) { ordered.push(s); remaining.splice(remaining.indexOf(s), 1); }
      }
      return [...ordered, ...remaining];
    }
    return [...RADIO_STATIONS];
  });

  // Sync preset hidden to localStorage
  useEffect(() => { setPresetHidden(presetHidden); }, [presetHidden]);

  // Radio audio control
  useEffect(() => {
    const audio = radioAudioRef.current;
    if (!audio || !radioStation) return;
    audio.src = radioStation.url;
    audio.volume = radioVolume;
    if (radioPlaying) audio.play().catch(() => { setRadioPlaying(false); toast.error('Error al conectar con la estación'); });
    else audio.pause();
  }, [radioStation, radioPlaying, radioVolume, setRadioPlaying]);

  useEffect(() => {
    if (!radioAudioRef.current) return;
    radioAudioRef.current.volume = radioVolume;
  }, [radioVolume]);

  // ── Custom Stations (loaded always so preset favorites can be derived) ──
  const loadCustomStations = useCallback(async () => {
    try {
      const res = await fetch('/api/radio/stations');
      if (res.ok) { const data = await res.json(); setCustomStations(data.stations || []); }
    } catch { /* ignore */ }
  }, []);

  // Load custom stations on mount and when switching to custom tab
  useEffect(() => { loadCustomStations(); }, [loadCustomStations]);

  const createStation = async () => {
    if (!stName.trim() || !stUrl.trim()) return;
    try {
      const res = await fetch('/api/radio/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stName, url: stUrl, genre: stGenre || null, country: stCountry || null, description: stDescription || null }),
      });
      if (res.ok) { toast.success('Emisora agregada'); setShowAddStation(false); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); loadCustomStations(); }
    } catch { toast.error('Error al guardar'); }
  };

  const deleteStation = async (id: string) => {
    if (!confirm('¿Eliminar esta emisora?')) return;
    try {
      const res = await fetch(`/api/radio/stations/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadCustomStations(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const openEditStationDialog = (station: Record<string, unknown>) => {
    setEditingStation(station);
    setStName(String(station.name));
    setStUrl(String(station.url));
    setStGenre(String(station.genre || ''));
    setStCountry(String(station.country || ''));
    setStDescription(String(station.description || ''));
    setShowAddStation(true);
  };

  const updateStation = async () => {
    if (!editingStation || !stName.trim() || !stUrl.trim()) return;
    try {
      const res = await fetch(`/api/radio/stations/${editingStation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stName, url: stUrl, genre: stGenre || null, country: stCountry || null, description: stDescription || null }),
      });
      if (res.ok) {
        toast.success('Emisora actualizada');
        setShowAddStation(false); setEditingStation(null);
        setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription('');
        loadCustomStations();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar');
      }
    } catch { toast.error('Error de conexión'); }
  };

  const toggleFavorite = async (station: Record<string, unknown>) => {
    const newFav = !station.isFavorite;
    try {
      const res = await fetch(`/api/radio/stations/${station.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFav }),
      });
      if (res.ok) {
        setCustomStations((prev) => prev.map((s) => s.id === station.id ? { ...s, isFavorite: newFav } : s));
        toast.success(newFav ? 'Marcada como favorita' : 'Quitada de favoritas');
      }
    } catch { toast.error('Error al actualizar'); }
  };

  const reorderStation = async (id: string, newOrder: number) => {
    try {
      const res = await fetch(`/api/radio/stations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!res.ok) toast.error('Error al reordenar');
    } catch { /* ignore */ }
  };

  // ── Preset Station Actions ──
  // Derive which presets are favorited (exist in Mis Emisoras) by matching URL
  const customStationUrls = new Set(customStations.map((s) => String(s.url)));
  const isPresetFavorited = (station: typeof RADIO_STATIONS[number]) => customStationUrls.has(station.url);

  // Find custom station ID that matches a preset station by URL
  const findCustomMatch = (station: typeof RADIO_STATIONS[number]) =>
    customStations.find((s) => String(s.url) === station.url);

  const togglePresetFavorite = async (station: typeof RADIO_STATIONS[number]) => {
    const existing = findCustomMatch(station);
    if (existing) {
      // Already in Mis Emisoras → remove it
      try {
        const res = await fetch(`/api/radio/stations/${existing.id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success(`"${station.name}" quitada de Mis Emisoras`);
          loadCustomStations();
        }
      } catch { toast.error('Error al eliminar'); }
    } else {
      // Not in Mis Emisoras → add it as favorite
      try {
        const res = await fetch('/api/radio/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: station.name, url: station.url, genre: station.genre || null, country: station.country || null, isFavorite: true }),
        });
        if (res.ok) {
          toast.success(`"${station.name}" agregada a Mis Emisoras`);
          loadCustomStations();
        }
      } catch { toast.error('Error al agregar'); }
    }
  };

  const hidePresetStation = (stationId: string) => {
    setPresetHidden((prev) => {
      const next = new Set(prev);
      next.add(stationId);
      return next;
    });
    toast.success('Emisora oculta de la lista');
  };

  // ── DnD Sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handlePresetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPresetStations((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      setPresetOrder(moved.map((s) => s.id));
      return moved;
    });
  };

  const handleCustomDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCustomStations((prev) => {
      const oldIndex = prev.findIndex((s) => String(s.id) === active.id);
      const newIndex = prev.findIndex((s) => String(s.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      moved.forEach((s, i) => { reorderStation(String(s.id), i); });
      return moved;
    });
  };

  const toggleRadioStation = (station: { id: string; name: string; genre: string; url: string; country: string }) => {
    if (radioStation?.id === station.id) {
      setRadioPlaying(!radioPlaying);
    } else {
      setRadioStation(station);
      setRadioPlaying(true);
    }
  };

  const radioGenres = ['all', ...Array.from(new Set(RADIO_STATIONS.map(s => s.genre)))];
  const visiblePresetStations = presetStations.filter((s) => !presetHidden.has(s.id));
  const filteredStations = radioFilter === 'all' ? visiblePresetStations : visiblePresetStations.filter(s => s.genre === radioFilter);

  return (
    <div className="space-y-4">
      <audio ref={radioAudioRef} preload="none" />

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={radioTab === 'preset' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setRadioTab('preset')}>
          <Radio className="h-3.5 w-3.5 mr-1" />Emisoras Predefinidas
        </Button>
        <Button variant={radioTab === 'custom' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setRadioTab('custom')}>
          <Plus className="h-3.5 w-3.5 mr-1" />Mis Emisoras
        </Button>
      </div>

      {/* Now Playing Bar */}
      {radioStation && (
        <Card className={`border-2 transition-all ${radioPlaying ? 'border-violet-400 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20' : 'border-border'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${radioPlaying ? 'bg-violet-500 text-white animate-pulse' : 'bg-muted'}`}>
                <Radio className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{radioStation.name}</p>
                <p className="text-sm text-muted-foreground">{radioStation.genre} · {radioStation.country}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRadioVolume(radioVolume === 0 ? 0.8 : 0)}>
                  {radioVolume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input type="range" min="0" max="1" step="0.05" value={radioVolume} onChange={(e) => setRadioVolume(parseFloat(e.target.value))} className="w-16 accent-violet-500 sm:w-20" />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => setRadioPlaying(!radioPlaying)}
                >
                  {radioPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {radioTab === 'preset' && (<>
      {/* Genre Filter */}
      <div className="flex flex-wrap gap-2">
        {radioGenres.map((genre) => (
          <Button
            key={genre}
            variant={radioFilter === genre ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setRadioFilter(genre)}
          >
            {genre === 'all' ? 'Todos' : genre}
          </Button>
        ))}
        {presetHidden.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setPresetHidden(new Set()); toast.success('Emisoras ocultas restauradas'); }}
          >
            <Eye className="h-3 w-3 mr-1" />Mostrar ocultas ({presetHidden.size})
          </Button>
        )}
      </div>

      {/* Preset Station Grid with DnD */}
      {filteredStations.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-medium mb-1">No hay emisoras</p>
            <p className="text-sm text-muted-foreground">
              {radioFilter !== 'all' ? `No hay emisoras del género "${radioFilter}"` : 'Todas las emisoras están ocultas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
          <SortableContext items={filteredStations.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStations.map((station) => {
                const isActive = radioStation?.id === station.id;
                return (
                  <SortablePresetCard
                    key={station.id}
                    station={station}
                    isActive={isActive}
                    radioPlaying={radioPlaying}
                    isFavorite={isPresetFavorited(station)}
                    onPlay={() => toggleRadioStation(station)}
                    onToggleFavorite={() => togglePresetFavorite(station)}
                    onHide={() => hidePresetStation(station.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </>)}

      {radioTab === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{customStations.length} emisora{customStations.length !== 1 ? 's' : ''} personalizada{customStations.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowAddStation(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Agregar Emisora
            </Button>
          </div>
          {customStations.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Radio className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin emisoras personalizadas</p>
                <p className="text-sm text-muted-foreground">Agrega tus emisoras de radio favoritas con su URL de streaming</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCustomDragEnd}>
              <SortableContext items={customStations.map((s) => String(s.id))} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customStations.map((station) => {
                    const isActive = radioStation?.id === station.id;
                    const stationData = { id: String(station.id), name: String(station.name), genre: String(station.genre || ''), url: String(station.url), country: String(station.country || '') };
                    return (
                      <SortableStationCard
                        key={String(station.id)}
                        station={station}
                        isActive={isActive}
                        radioPlaying={radioPlaying}
                        onPlay={() => {
                          if (isActive) setRadioPlaying(!radioPlaying);
                          else { setRadioStation(stationData); setRadioPlaying(true); }
                        }}
                        onToggleFavorite={() => toggleFavorite(station)}
                        onEdit={() => openEditStationDialog(station)}
                        onDelete={() => deleteStation(String(station.id))}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Add/Edit Station Dialog */}
      <Dialog open={showAddStation} onOpenChange={(open) => { setShowAddStation(open); if (!open) { setEditingStation(null); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStation ? 'Editar Emisora' : 'Agregar Emisora'}</DialogTitle>
            <DialogDescription>{editingStation ? 'Modifica los detalles de la emisora' : 'Agrega una emisora de radio con su URL de streaming'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="Nombre de la emisora" />
            </div>
            <div>
              <Label>URL de Streaming *</Label>
              <Input value={stUrl} onChange={(e) => setStUrl(e.target.value)} placeholder="https://stream.example.com/radio.mp3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Género</Label>
                <Input value={stGenre} onChange={(e) => setStGenre(e.target.value)} placeholder="Jazz, Rock..." />
              </div>
              <div>
                <Label>País</Label>
                <Input value={stCountry} onChange={(e) => setStCountry(e.target.value)} placeholder="Cuba, USA..." />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={stDescription} onChange={(e) => setStDescription(e.target.value)} placeholder="Descripción opcional..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddStation(false); setEditingStation(null); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); }}>Cancelar</Button>
            {editingStation ? (
              <Button onClick={updateStation} disabled={!stName.trim() || !stUrl.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createStation} disabled={!stName.trim() || !stUrl.trim()}>Agregar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
