'use client';

import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { useDirectoryDownload } from '@/hooks/useDirectoryDownload';
import { cn } from '@/lib/utils';

interface DownloadButtonProps {
  directoryId: number;
  directoryName: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DownloadButton({
  directoryId,
  directoryName,
  className,
  variant = 'outline',
  size = 'sm',
}: DownloadButtonProps) {
  const { downloadDirectory, isDownloading, progress, total, error } = useDirectoryDownload();

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await downloadDirectory(directoryId, directoryName);
  };

  if (isDownloading) {
    const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={cn('relative overflow-hidden', className)}
      >
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span>{percentage > 0 ? `${percentage}%` : 'Chargement...'}</span>
        <span className="ml-1 text-muted-foreground text-xs">
          ({progress}/{total})
        </span>
      </Button>
    );
  }

  if (error) {
    return (
      <Button
        variant="destructive"
        size={size}
        className={cn('text-xs', className)}
        onClick={handleDownload}
      >
        <AlertCircle className="h-4 w-4 mr-1" />
        Réessayer
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      className={cn('transition-all hover:scale-105', className)}
    >
      <Download className="h-4 w-4 mr-2" />
      Télécharger
    </Button>
  );
}
