'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Cpu, MemoryStick, HardDrive, Activity,
  Library as LibraryIcon, Music2, FilmIcon,
  Image as ImageIcon, Calendar, Newspaper, Wifi,
  Monitor, Server as ServerIcon, Cloud,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatBytes, formatUptime } from '@/lib/helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import NewsWidget from '@/components/shared/NewsWidget';

export default function DashboardSection() {
  const { serverStats, setServerStats } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<{
    city: string;
    country: string;
    current: { temperature: number; feelsLike: number; humidity: number; windSpeed: number; description: string; icon: string };
    forecast: { day: string; high: number; low: number; icon: string; description: string }[];
  } | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'requesting' | 'ready' | 'denied' | 'unavailable'>('loading');
  const [mediaStats, setMediaStats] = useState<{
    library: { totalBooks: number; booksRead: number; totalPages: number; uniqueAuthors: number };
    music: { totalFiles: number; totalFolders: number; totalSize: number };
    movies: { totalFiles: number; totalFolders: number; totalSize: number };
    images: { totalFiles: number; totalFolders: number; totalSize: number };
  } | null>(null);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [serverRes, statsRes] = await Promise.all([
        fetch('/api/server-stats').catch(() => null),
        fetch('/api/dashboard/stats').catch(() => null),
      ]);
      if (serverRes?.ok) setServerStats(await serverRes.json());
      if (statsRes?.ok) setMediaStats(await statsRes.json());
    } catch {
      // silent fail for dashboard widgets
    } finally {
      setLoading(false);
    }

    // Load weather based on user's geolocation (Open-Meteo, no API key needed)
    const loadWeatherForCoords = async (lat: number, lon: number) => {
      try {
        setWeatherStatus('loading');
        let city = 'Tu ubicación';
        let country = '';
        let countryCode = '';

        // Always use Nominatim for reverse geocoding (gives city + country_code)
        try {
          const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`, {
            headers: { 'User-Agent': 'MiServidor/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          const revData = await revRes.json();
          city = revData.address?.city || revData.address?.town || revData.address?.village || revData.address?.county || 'Tu ubicación';
          country = revData.address?.country || '';
          countryCode = (revData.address?.country_code || '').toUpperCase();
        } catch { /* use defaults */ }

        // Always save country code for news widget
        if (countryCode) {
          localStorage.setItem('weather_country_code', countryCode);
        }

        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`);
        const wData = await wRes.json();
        const codeMap: Record<number, { desc: string; icon: string }> = {
          0: { desc: 'Despejado', icon: '☀️' }, 1: { desc: 'Parcialmente nublado', icon: '⛅' },
          2: { desc: 'Parcialmente nublado', icon: '⛅' }, 3: { desc: 'Nublado', icon: '☁️' },
          45: { desc: 'Niebla', icon: '🌫️' }, 48: { desc: 'Niebla', icon: '🌫️' },
          51: { desc: 'Llovizna', icon: '🌦️' }, 53: { desc: 'Llovizna', icon: '🌦️' }, 55: { desc: 'Llovizna', icon: '🌦️' },
          61: { desc: 'Lluvia', icon: '🌧️' }, 63: { desc: 'Lluvia', icon: '🌧️' }, 65: { desc: 'Lluvia', icon: '🌧️' },
          71: { desc: 'Nieve', icon: '🌨️' }, 73: { desc: 'Nieve', icon: '🌨️' }, 75: { desc: 'Nieve', icon: '🌨️' },
          80: { desc: 'Chubascos', icon: '🌧️' }, 81: { desc: 'Chubascos', icon: '🌧️' }, 82: { desc: 'Chubascos', icon: '🌧️' },
          95: { desc: 'Tormenta', icon: '⛈️' }, 96: { desc: 'Tormenta', icon: '⛈️' }, 99: { desc: 'Tormenta', icon: '⛈️' },
        };
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const cur = codeMap[wData.current.weather_code] || { desc: 'Nublado', icon: '☁️' };
        setWeather({
          city,
          country,
          current: { temperature: wData.current.temperature_2m, feelsLike: wData.current.apparent_temperature, humidity: wData.current.relative_humidity_2m, windSpeed: wData.current.wind_speed_10m, description: cur.desc, icon: cur.icon },
          forecast: wData.daily.time.map((d: string, i: number) => {
            const f = codeMap[wData.daily.weather_code[i]] || { desc: 'Nublado', icon: '☁️' };
            return { day: days[new Date(d + 'T00:00:00').getDay()], high: Math.round(wData.daily.temperature_2m_max[i]), low: Math.round(wData.daily.temperature_2m_min[i]), icon: f.icon, description: f.desc };
          }),
        });
        setWeatherStatus('ready');
        // Save coords for next time
        localStorage.setItem('weather_coords', JSON.stringify({ lat, lon }));
      } catch {
        setWeatherStatus('unavailable');
      }
    };

    // Check for saved coords first, otherwise request geolocation
    const savedCoords = localStorage.getItem('weather_coords');
    if (savedCoords) {
      try {
        const { lat, lon } = JSON.parse(savedCoords);
        loadWeatherForCoords(lat, lon);
      } catch {
        requestGeolocation();
      }
    } else {
      requestGeolocation();
    }

    function requestGeolocation() {
      if (!navigator.geolocation) {
        setWeatherStatus('unavailable');
        return;
      }
      setWeatherStatus('requesting');
      navigator.geolocation.getCurrentPosition(
        (pos) => loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude),
        () => setWeatherStatus('denied'),
        { timeout: 10000, enableHighAccuracy: false }
      );
    }
  }, [setServerStats]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 300000); // refresh every 5min
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!serverStats) return null;

  return (
    <div className="space-y-6">
      {/* Top Row: Clock + Weather */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date & Time */}
        <Card className="border-border">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-muted-foreground">{dayNames[now.getDay()]}</p>
            </div>
            <p className="text-4xl font-bold tracking-tight">{now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="text-sm text-muted-foreground mt-2">{now.getDate()} de {monthNames[now.getMonth()]} de {now.getFullYear()}</p>
          </CardContent>
        </Card>

        {/* Weather */}
        <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 md:col-span-2">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-medium text-muted-foreground">Clima</p>
            </div>
            {weather ? (
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-4xl">{weather.current.icon}</span>
                  <div>
                    <p className="text-3xl font-bold">{Math.round(weather.current.temperature)}°C</p>
                    <p className="text-sm text-muted-foreground">{weather.current.description}</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Sensación</p>
                    <p className="text-sm font-medium">{Math.round(weather.current.feelsLike)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Humedad</p>
                    <p className="text-sm font-medium">{weather.current.humidity}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Viento</p>
                    <p className="text-sm font-medium">{Math.round(weather.current.windSpeed)} km/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ciudad</p>
                    <p className="text-sm font-medium">{weather.city}{weather.country ? ` · ${weather.country}` : ''}</p>
                  </div>
                </div>
                {/* 3-day forecast */}
                <div className="flex gap-4 justify-center md:justify-end flex-shrink-0">
                  {weather.forecast.map((day, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-muted-foreground">{day.day}</p>
                      <span className="text-xl mx-auto block my-1">{day.icon}</span>
                      <p className="text-xs font-medium">{day.high}°</p>
                      <p className="text-[10px] text-muted-foreground">{day.low}°</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : weatherStatus === 'requesting' ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <p className="text-sm text-muted-foreground">Solicitando acceso a ubicación...</p>
              </div>
            ) : weatherStatus === 'denied' ? (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <p className="text-sm text-muted-foreground">Permiso de ubicación denegado</p>
                <button
                  onClick={() => {
                    setWeatherStatus('loading');
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const wRes = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`);
                        wRes.then(r => r.json()).then(wData => {
                          const codeMap: Record<number, { desc: string; icon: string }> = {
                            0: { desc: 'Despejado', icon: '☀️' }, 1: { desc: 'Parcialmente nublado', icon: '⛅' },
                            2: { desc: 'Parcialmente nublado', icon: '⛅' }, 3: { desc: 'Nublado', icon: '☁️' },
                            45: { desc: 'Niebla', icon: '🌫️' }, 48: { desc: 'Niebla', icon: '🌫️' },
                            51: { desc: 'Llovizna', icon: '🌦️' }, 53: { desc: 'Llovizna', icon: '🌦️' }, 55: { desc: 'Llovizna', icon: '🌦️' },
                            61: { desc: 'Lluvia', icon: '🌧️' }, 63: { desc: 'Lluvia', icon: '🌧️' }, 65: { desc: 'Lluvia', icon: '🌧️' },
                            71: { desc: 'Nieve', icon: '🌨️' }, 73: { desc: 'Nieve', icon: '🌨️' }, 75: { desc: 'Nieve', icon: '🌨️' },
                            80: { desc: 'Chubascos', icon: '🌧️' }, 81: { desc: 'Chubascos', icon: '🌧️' }, 82: { desc: 'Chubascos', icon: '🌧️' },
                            95: { desc: 'Tormenta', icon: '⛈️' }, 96: { desc: 'Tormenta', icon: '⛈️' }, 99: { desc: 'Tormenta', icon: '⛈️' },
                          };
                          const cur = codeMap[wData.current.weather_code] || { desc: 'Nublado', icon: '☁️' };
                          setWeather({
                            city: 'Tu ubicación', country: '',
                            current: { temperature: wData.current.temperature_2m, feelsLike: wData.current.apparent_temperature, humidity: wData.current.relative_humidity_2m, windSpeed: wData.current.wind_speed_10m, description: cur.desc, icon: cur.icon },
                            forecast: wData.daily.time.map((d: string, i: number) => {
                              const f = codeMap[wData.daily.weather_code[i]] || { desc: 'Nublado', icon: '☁️' };
                              const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                              return { day: days[new Date(d + 'T00:00:00').getDay()], high: Math.round(wData.daily.temperature_2m_max[i]), low: Math.round(wData.daily.temperature_2m_min[i]), icon: f.icon, description: f.desc };
                            }),
                          });
                          setWeatherStatus('ready');
                        });
                      },
                      () => setWeatherStatus('denied'),
                      { timeout: 10000, enableHighAccuracy: false }
                    );
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 underline underline-offset-2"
                >
                  Permitir acceso a ubicación
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm text-muted-foreground">Cargando clima...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">CPU</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-400">{serverStats.cpuCores} núcleos</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate max-w-[120px] md:max-w-[160px]">{serverStats.cpuModel}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Cpu className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">RAM</p>
                <p className="text-xl md:text-2xl font-bold text-sky-700 dark:text-sky-400">{serverStats.memoryUsagePercent}%</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{formatBytes(serverStats.usedMemory)} / {formatBytes(serverStats.totalMemory)}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-sky-100 dark:bg-sky-900/30">
                <MemoryStick className="h-5 w-5 md:h-6 md:w-6 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
            <Progress value={serverStats.memoryUsagePercent} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-amber-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Disco</p>
                <p className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-400">{serverStats.diskUsagePercent}%</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{formatBytes(serverStats.usedDiskSpace)} / {formatBytes(serverStats.totalDiskSpace)}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <HardDrive className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <Progress value={serverStats.diskUsagePercent} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Activo</p>
                <p className="text-xl md:text-2xl font-bold text-violet-700 dark:text-violet-400">{formatUptime(serverStats.uptime)}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{serverStats.platform} / {serverStats.arch}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Media Stats - all 4 sections */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <LibraryIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Biblioteca</p>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{mediaStats?.library.totalBooks ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{mediaStats?.library.booksRead ?? 0} leídos</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <Music2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Música</p>
            </div>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{mediaStats?.music.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.music.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <FilmIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Películas</p>
            </div>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{mediaStats?.movies.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.movies.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Imágenes</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{mediaStats?.images.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.images.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar + News */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar Widget */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              {monthNames[now.getMonth()]} {now.getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
                <div key={d} className="font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {(() => {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                let startDay = firstDay.getDay() - 1;
                if (startDay < 0) startDay = 6;
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const today = now.getDate();
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const isToday = d === today;
                  cells.push(
                    <div
                      key={d}
                      className={`py-1.5 rounded-md text-sm cursor-default transition-colors ${
                        isToday
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {d}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </CardContent>
        </Card>

        {/* News Widget */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-emerald-600" />
              Noticias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NewsWidget />
          </CardContent>
        </Card>
      </div>

      {/* Network, System */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-600" />
              Red
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serverStats.networkInterfaces.length > 0 ? (
              <div className="space-y-3">
                {serverStats.networkInterfaces.map((iface) => (
                  <div key={iface.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{iface.name}</p>
                        <p className="text-xs text-muted-foreground">{iface.family}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">{iface.address}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No se encontraron interfaces</p>
            )}
          </CardContent>
        </Card>

        {/* System */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-emerald-600" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Host', value: serverStats.hostname },
                { label: 'Plataforma', value: serverStats.platform },
                { label: 'Arquitectura', value: serverStats.arch },
                { label: 'Node.js', value: serverStats.nodeVersion },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
