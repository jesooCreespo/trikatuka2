import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { UserProfile } from '@/lib/spotify/types'
import { cn } from '@/lib/utils'
import { accountName } from './format'

export function AccountChip({
  profile,
  className,
  size = 'md',
}: {
  profile: UserProfile
  className?: string
  size?: 'md' | 'lg'
}) {
  const name = accountName(profile)
  const image = profile.images?.[0]?.url
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar className={size === 'lg' ? 'size-14' : 'size-9'}>
        {image && <AvatarImage src={image} alt="" />}
        <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className={cn('truncate font-medium', size === 'lg' && 'text-lg')}>{name}</p>
        {profile.display_name && (
          <p className="text-muted-foreground truncate text-xs">{profile.id}</p>
        )}
      </div>
    </div>
  )
}
