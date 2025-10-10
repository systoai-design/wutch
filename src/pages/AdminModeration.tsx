import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModerationItem {
  id: string;
  content_type: string;
  content_id: string;
  user_id: string;
  status: string;
  moderation_labels: any;
  rejection_reason: string | null;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  content_url: string;
  content_title: string;
}

const AdminModeration = () => {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
      return;
    }
    
    if (isAdmin) {
      fetchQueue();
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_queue')
        .select('*')
        .limit(50);
      
      if (error) throw error;
      setQueue(data || []);
    } catch (error: any) {
      console.error('Error fetching moderation queue:', error);
      toast({
        title: 'Error',
        description: 'Failed to load moderation queue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (item: ModerationItem) => {
    setProcessingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update moderation record
      const { error: moderationError } = await supabase
        .from('content_moderation')
        .update({ 
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (moderationError) throw moderationError;

      // Update content status
      const table = item.content_type === 'wutch_video' ? 'wutch_videos' 
        : item.content_type === 'short_video' ? 'short_videos' 
        : 'livestreams';
        
      const { error: contentError } = await supabase
        .from(table)
        .update({ moderation_status: 'approved', status: 'published' })
        .eq('id', item.content_id);

      if (contentError) throw contentError;

      toast({
        title: 'Content Approved',
        description: 'The content has been approved and is now live',
      });

      // Refresh queue
      fetchQueue();
    } catch (error: any) {
      console.error('Error approving content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve content',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: ModerationItem) => {
    const reason = prompt('Enter rejection reason (will be shown to user):');
    if (!reason) return;

    setProcessingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update moderation record
      const { error: moderationError } = await supabase
        .from('content_moderation')
        .update({ 
          status: 'rejected',
          rejection_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (moderationError) throw moderationError;

      // Update content status
      const table = item.content_type === 'wutch_video' ? 'wutch_videos' 
        : item.content_type === 'short_video' ? 'short_videos' 
        : 'livestreams';
        
      const { error: contentError } = await supabase
        .from(table)
        .update({ moderation_status: 'rejected', status: 'rejected' })
        .eq('id', item.content_id);

      if (contentError) throw contentError;

      // Delete files from storage
      if (item.content_type === 'wutch_video') {
        // Extract file path from URL and delete
        const videoUrlParts = item.content_url.split('/wutch-videos/');
        if (videoUrlParts[1]) {
          await supabase.storage.from('wutch-videos').remove([videoUrlParts[1]]);
        }
      } else if (item.content_type === 'short_video') {
        const videoUrlParts = item.content_url.split('/short-videos/');
        if (videoUrlParts[1]) {
          await supabase.storage.from('short-videos').remove([videoUrlParts[1]]);
        }
      }

      // Create notification for user
      await supabase.rpc('create_notification', {
        p_user_id: item.user_id,
        p_type: 'content_rejected',
        p_title: 'Content Removed',
        p_message: `Your uploaded content violated community guidelines and has been removed. Reason: ${reason}`,
        p_metadata: {
          content_type: item.content_type,
          content_id: item.content_id,
          violation_categories: item.moderation_labels?.violationCategories || [],
        }
      });

      toast({
        title: 'Content Rejected',
        description: 'The content has been rejected and removed',
      });

      // Refresh queue
      fetchQueue();
    } catch (error: any) {
      console.error('Error rejecting content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject content',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (adminLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Content Moderation Queue</h1>
        <p className="text-muted-foreground">
          Review flagged content for community guideline violations
        </p>
      </div>

      {queue.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
          <p className="text-muted-foreground">No content pending moderation</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <Card key={item.id} className="p-6">
              <div className="flex gap-6">
                {/* Content Preview */}
                <div className="flex-shrink-0 w-64">
                  {item.content_type === 'livestream_thumbnail' ? (
                    <img 
                      src={item.content_url} 
                      alt="Content preview" 
                      className="w-full aspect-video object-cover rounded-lg border border-border"
                    />
                  ) : (
                    <video 
                      src={item.content_url} 
                      className="w-full aspect-video object-cover rounded-lg border border-border" 
                      controls
                    />
                  )}
                </div>

                {/* Content Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{item.content_title}</h3>
                        <p className="text-sm text-muted-foreground">
                          by {item.display_name} (@{item.username})
                        </p>
                      </div>
                      <Badge variant="outline">
                        {item.content_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Moderation Flags */}
                    {item.moderation_labels?.violationCategories?.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {item.moderation_labels.violationCategories.map((cat: string) => (
                          <Badge key={cat} variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {item.moderation_labels?.reasoning && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm">
                          <span className="font-semibold">AI Analysis:</span>{' '}
                          {item.moderation_labels.reasoning}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confidence Scores */}
                  {item.moderation_labels?.confidenceScores && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Confidence Scores:</p>
                      <div className="flex gap-3 flex-wrap">
                        {Object.entries(item.moderation_labels.confidenceScores).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key}:</span>{' '}
                            <span className="font-semibold">{Math.round((value as number) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(item)}
                      disabled={processingId === item.id}
                      className="gap-2"
                    >
                      {processingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(item)}
                      disabled={processingId === item.id}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminModeration;
