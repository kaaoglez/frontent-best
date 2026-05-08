'use client';

import { useState, useEffect, useRef } from 'react';
import { Moon, Timer, TimerOff } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SLEEP_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hora', minutes: 60 },
  { label: '1.5 horas', minutes: 90 },
  { label: '2 horas', minutes: 120 },
];

export default function SleepTimer() {
  const { stopAllMedia, isPlaying, radioPlaying, currentMovie } = useAppStore();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAnyMediaActive = isPlaying || radioPlaying || !!currentMovie;

  // Countdown logic
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Timer finished — stop everything
          stopAllMedia();
          toast.success('Temporizador de sueño: se detuvo la reproducción');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [secondsLeft, stopAllMedia]);

  const setTimer = (minutes: number) => {
    setSecondsLeft(minutes * 60);
    setOpen(false);
    setCustomMinutes('');
    toast.info(`Temporizador: ${minutes} min`);
  };

  const setCustomTimer = () => {
    const mins = parseInt(customMinutes);
    if (mins > 0 && mins <= 480) {
      setTimer(mins);
    }
  };

  const cancelTimer = () => {
    setSecondsLeft(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    toast.info('Temporizador cancelado');
  };

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPercent = secondsLeft !== null
    ? (() => {
        // We don't track the original total, so just use a pulsing effect
        const cycle = 60;
        return ((secondsLeft % cycle) / cycle) * 100;
      })()
    : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={secondsLeft !== null ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 gap-1.5 ${secondsLeft !== null ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {secondsLeft !== null ? (
            <>
              <Timer className="h-3.5 w-3.5" />
              <span className="text-xs font-mono">{formatCountdown(secondsLeft)}</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Dormir</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Temporizador de sueño</p>
          </div>

          {secondsLeft !== null ? (
            /* Active timer display */
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatCountdown(secondsLeft)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">restante</p>
              </div>
              {!isAnyMediaActive && (
                <p className="text-xs text-center text-muted-foreground">
                  No hay reproducción activa. Se detendrá cuando empiece algo.
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full gap-2 text-red-500 hover:text-red-600" onClick={cancelTimer}>
                <TimerOff className="h-3.5 w-3.5" />
                Cancelar temporizador
              </Button>
            </div>
          ) : (
            /* Preset selection */
            <div className="space-y-2">
              {!isAnyMediaActive && (
                <p className="text-xs text-muted-foreground">
                  Inicia la reproducción primero. El temporizador la detendrá automáticamente.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {SLEEP_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setTimer(preset.minutes)}
                    disabled={!isAnyMediaActive}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Minutos"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setCustomTimer()}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={setCustomTimer}
                  disabled={!isAnyMediaActive || !customMinutes || parseInt(customMinutes) <= 0}
                >
                  OK
                </Button>
              </div>
              {customMinutes && parseInt(customMinutes) > 480 && (
                <p className="text-xs text-amber-500">Máximo 480 minutos (8 horas)</p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
