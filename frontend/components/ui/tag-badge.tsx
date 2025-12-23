'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tag } from '@/lib/tag';

interface TagBadgeProps {
  tag: Tag | string;
  tags?: Tag[]; // Lista de tags para buscar a cor quando tag é string
  variant?: 'default' | 'outline';
  className?: string;
}

export function TagBadge({ tag, tags = [], variant = 'default', className }: TagBadgeProps) {
  const tagName = typeof tag === 'string' ? tag : tag.name;
  const tagColor = typeof tag === 'string'
    ? tags.find((t) => t.name === tag)?.color || '#22C55E'
    : tag.color || '#22C55E';

  return (
    <Badge
      className={cn('text-white border', className)}
      variant={variant}
      style={{
        backgroundColor: tagColor,
        borderColor: tagColor,
      }}
    >
      {tagName}
    </Badge>
  );
}
