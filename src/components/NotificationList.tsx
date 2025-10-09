import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCheck, Loader2, Bell } from 'lucide-react';

export function NotificationList() {
  const { 
    notifications, 
    isLoading, 
    markAllAsRead, 
    unreadCount 
  } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification List */}
      <ScrollArea className="h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be notified when someone interacts with your content
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
