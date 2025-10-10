import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModerator } from '@/hooks/useModerator';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Report {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter?: {
    username: string;
    display_name: string;
  } | null;
}

export default function AdminReports() {
  const navigate = useNavigate();
  const { isModerator, isLoading } = useModerator();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionType, setActionType] = useState<'resolve' | 'dismiss' | null>(null);

  useEffect(() => {
    if (!isLoading && !isModerator) {
      navigate('/');
      return;
    }

    if (isModerator) {
      fetchReports();
    }
  }, [isModerator, isLoading, navigate]);

  const fetchReports = async () => {
    try {
      // Get all reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Get unique reporter IDs
      const reporterIds = [...new Set(reportsData?.map(r => r.reporter_id).filter(Boolean))];

      // Fetch reporter profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', reporterIds);

      if (profilesError) throw profilesError;

      // Map profiles to reporters
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

      // Combine reports with reporter info
      const reportsWithReporter = reportsData?.map(report => ({
        ...report,
        reporter: profilesMap.get(report.reporter_id || '') || null
      }));

      setReports(reportsWithReporter || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async (status: 'resolved' | 'dismissed') => {
    if (!selectedReport) return;

    try {
      const { error } = await supabase.rpc('resolve_content_report', {
        p_report_id: selectedReport.id,
        p_status: status,
        p_resolution_notes: resolutionNotes || null,
      });

      if (error) throw error;

      toast.success(`Report ${status}`);
      setSelectedReport(null);
      setResolutionNotes('');
      setActionType(null);
      fetchReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error('Failed to resolve report');
    }
  };

  const handleDeleteContent = async (report: Report) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this content? This action cannot be undone.'
    );

    if (!confirmDelete) return;

    try {
      const table =
        report.content_type === 'livestream'
          ? 'livestreams'
          : report.content_type === 'short_video'
          ? 'short_videos'
          : report.content_type === 'wutch_video'
          ? 'wutch_videos'
          : 'comments';

      const { error } = await supabase.from(table).delete().eq('id', report.content_id);

      if (error) throw error;

      // Log the action
      await supabase.rpc('log_moderation_action', {
        p_action_type: 'delete_content',
        p_content_type: report.content_type,
        p_content_id: report.content_id,
        p_report_id: report.id,
        p_reason: report.reason,
        p_notes: 'Content deleted via reports dashboard',
      });

      toast.success('Content deleted successfully');
      fetchReports();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'resolved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case 'dismissed':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: string) => {
    return reason.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filterReports = (status: string) => {
    return reports.filter((r) => r.status === status);
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading reports...</div>
      </div>
    );
  }

  if (!isModerator) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Reports</h1>
        <p className="text-muted-foreground">
          Review and moderate reported content
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({filterReports('pending').length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({filterReports('resolved').length})
          </TabsTrigger>
          <TabsTrigger value="dismissed">
            Dismissed ({filterReports('dismissed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {filterReports('pending').length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending reports
              </CardContent>
            </Card>
          ) : (
            filterReports('pending').map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {getReasonLabel(report.reason)} - {report.content_type}
                      </CardTitle>
                      <CardDescription>
                        Reported by @{report.reporter?.username || 'Unknown'} •{' '}
                        {new Date(report.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {report.description && (
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to content
                        const path =
                          report.content_type === 'livestream'
                            ? `/streams/${report.content_id}`
                            : report.content_type === 'wutch_video'
                            ? `/wutch-videos/${report.content_id}`
                            : `/shorts`;
                        navigate(path);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Content
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteContent(report)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Content
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setActionType('resolve');
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setActionType('dismiss');
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {filterReports('resolved').map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {getReasonLabel(report.reason)} - {report.content_type}
                    </CardTitle>
                    <CardDescription>
                      Reported by @{report.reporter?.username || 'Unknown'} •{' '}
                      {new Date(report.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="dismissed" className="space-y-4">
          {filterReports('dismissed').map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {getReasonLabel(report.reason)} - {report.content_type}
                    </CardTitle>
                    <CardDescription>
                      Reported by @{report.reporter?.username || 'Unknown'} •{' '}
                      {new Date(report.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'resolve' ? 'Resolve' : 'Dismiss'} Report
            </DialogTitle>
            <DialogDescription>
              Add notes about your decision (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Resolution Notes</Label>
              <Textarea
                id="notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleResolveReport(actionType === 'resolve' ? 'resolved' : 'dismissed')}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
