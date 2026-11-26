import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LibraryItem } from '@/lib/library'
import { cn } from '@/lib/utils'
import { CategoryIcon } from './CategoryIcon'

export function Cover({ item, className }: { item: LibraryItem; className?: string }) {
  const round = item.category === 'artists'
  return item.imageUrl ? (
    <img
      src={item.imageUrl}
      alt=""
      loading="lazy"
      className={cn(
        'bg-muted size-11 shrink-0 object-cover',
        round ? 'rounded-full' : 'rounded-md',
        className,
      )}
    />
  ) : (
    <div
      className={cn(
        'bg-muted text-muted-foreground grid size-11 shrink-0 place-items-center',
        round ? 'rounded-full' : 'rounded-md',
        className,
      )}
    >
      <CategoryIcon category={item.category} />
    </div>
  )
}

interface Props {
  item: LibraryItem
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  action?: 'copy' | 'follow'
}

export function ItemRow({ item, checked, onCheckedChange, action }: Props) {
  const { t } = useTranslation()
  const id = `item-${item.category}-${item.id}`
  const count = item.playlist?.itemCount

  return (
    <li
      className={cn(
        'hover:bg-muted/50 transition-colors',
        checked && 'bg-accent/40 hover:bg-accent/60',
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
        <Cover item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          {(item.subtitle || count != null) && (
            <p className="text-muted-foreground truncate text-sm">
              {[item.subtitle, count != null ? t('select.itemCount', { count }) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        {action && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={action === 'copy' ? 'default' : 'secondary'} className="shrink-0">
                {action === 'copy' ? t('select.badgeCopy') : t('select.badgeFollow')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {action === 'copy' ? t('select.badgeCopyHint') : t('select.badgeFollowHint')}
            </TooltipContent>
          </Tooltip>
        )}
      </label>
    </li>
  )
}
