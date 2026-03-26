'use client';

import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  text: string;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * ?アイコン + ホバーでツールチップを表示するヘルプコンポーネント
 */
export function HelpTooltip({
  text,
  className,
  iconClassName,
  side = 'top',
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center cursor-help', className)}>
            <HelpCircle
              className={cn(
                'h-4 w-4 text-muted-foreground hover:text-foreground transition-colors',
                iconClassName
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BadgeWithTooltipProps {
  children: React.ReactNode;
  tooltip: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Badge をホバー時にツールチップで説明表示するラッパーコンポーネント
 */
export function BadgeWithTooltip({
  children,
  tooltip,
  side = 'top',
}: BadgeWithTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
