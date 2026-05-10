'use client';

import { type PlayerOption, type PlayerInfo, PLAYER_OPTIONS } from '@/hooks/usePlayerPreference';
import { Monitor, ExternalLink, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader,
} from '@/components/ui/dialog';

interface PlayerSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (player: PlayerOption) => void;
  currentPreference?: PlayerOption | null;
}

export default function PlayerSelectDialog({ open, onClose, onSelect, currentPreference }: PlayerSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-rose-500" />
            ¿Cómo reproducir?
          </DialogTitle>
          <DialogDescription>
            Elige dónde reproducir el video. Se guardará tu preferencia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {PLAYER_OPTIONS.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={player.id === currentPreference}
              onClick={() => onSelect(player.id)}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Si el reproductor externo no está instalado, se abrirá la tienda de apps.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function PlayerCard({ player, isCurrent, onClick }: { player: PlayerInfo; isCurrent: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all text-left ${
        isCurrent
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
          : 'border-border hover:border-foreground/20 hover:bg-muted/50'
      }`}
    >
      <span className="text-2xl flex-shrink-0 w-8 text-center">{player.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{player.label}</p>
          {player.id === 'browser' && (
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {isCurrent && (
            <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Actual</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{player.description}</p>
      </div>
    </button>
  );
}

