import { AdminBadge } from './AdminBadge';
import { ModeratorBadge } from './ModeratorBadge';
import { VerificationBadge } from './VerificationBadge';
import { cn } from '@/lib/utils';

interface UserBadgesProps {
  userId: string;
  verificationType?: 'blue' | 'red' | 'none' | null;
  isAdmin?: boolean;
  isModerator?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function UserBadges({
  userId,
  verificationType,
  isAdmin,
  isModerator,
  size = 'md',
  showTooltip = true,
  className
}: UserBadgesProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Admin badge - highest priority */}
      {isAdmin && (
        <AdminBadge size={size} showTooltip={showTooltip} />
      )}
      
      {/* Moderator badge - only if not admin */}
      {!isAdmin && isModerator && (
        <ModeratorBadge size={size} showTooltip={showTooltip} />
      )}
      
      {/* Verification badge - lowest priority */}
      {verificationType && verificationType !== 'none' && (
        <VerificationBadge 
          verificationType={verificationType} 
          size={size} 
          showTooltip={showTooltip}
        />
      )}
    </div>
  );
}
