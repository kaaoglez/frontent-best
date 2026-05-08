'use client';

import React from 'react';
import { Edit, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface FileActionsMenuProps {
  item: { path: string; name: string };
  onRename: (item: { path: string; name: string }) => void;
  onDelete: (item: { path: string; name: string }) => void;
  children?: React.ReactNode;
  extraItems?: React.ReactNode;
  onEdit?: (item: { path: string; name: string }) => void;
}

export default function FileActionsMenu({
  item,
  onRename,
  onDelete,
  children,
  extraItems,
  onEdit,
}: FileActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        {!onEdit && (
          <DropdownMenuItem onClick={() => onRename(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Renombrar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(item)} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
        {extraItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
