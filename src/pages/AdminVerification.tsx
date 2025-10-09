import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Eye, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface VerificationRequest {
  id: string;
  user_id: string;
  verification_type: string;
  legal_name: string;
  legal_email: string;
  legal_phone?: string | null;
  legal_address?: string | null;
  legal_id_type?: string | null;
  legal_id_document_url?: string | null;
  payment_transaction_signature?: string | null;
  payment_amount?: number | null;
  total_watch_hours?: number | null;
  follower_count_at_request?: number | null;
  meets_eligibility_criteria?: boolean | null;
  status: string;
  submitted_at: string;
  rejection_reason?: string | null;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
}

export default function AdminVerification() {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
      toast.error('Admin access required');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchRequests();
    }
  }, [isAdmin]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data separately
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', request.user_id)
            .single();

          return {
            ...request,
            profiles: profile || undefined,
          } as VerificationRequest;
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching verification requests:', error);
      toast.error('Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setReviewDialogOpen(true);
    setRejectionReason('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-verification', {
        body: {
          requestId: selectedRequest.id,
          action: 'approve',
        },
      });

      if (error) throw error;

      toast.success('Verification approved successfully');
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      console.error('Error approving verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve verification');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('approve-verification', {
        body: {
          requestId: selectedRequest.id,
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        },
      });

      if (error) throw error;

      toast.success('Verification rejected');
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reject verification');
    } finally {
      setProcessing(false);
    }
  };

  const viewDocument = (url?: string) => {
    if (!url) {
      toast.error('No document available');
      return;
    }
    window.open(url, '_blank');
  };

  if (adminLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'under_review');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  const RequestCard = ({ request }: { request: VerificationRequest }) => (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {request.profiles?.avatar_url && (
              <img
                src={request.profiles.avatar_url}
                alt={request.profiles.display_name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <CardTitle className="text-lg">
                {request.profiles?.display_name || 'Unknown User'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                @{request.profiles?.username || 'unknown'}
              </p>
            </div>
          </div>
          <Badge variant={request.verification_type === 'blue' ? 'default' : 'destructive'}>
            {request.verification_type === 'blue' ? 'Blue Badge' : 'Red Badge'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Legal Information</p>
            <p className="text-sm text-muted-foreground">Name: {request.legal_name}</p>
            <p className="text-sm text-muted-foreground">Email: {request.legal_email}</p>
            {request.legal_phone && (
              <p className="text-sm text-muted-foreground">Phone: {request.legal_phone}</p>
            )}
            {request.legal_address && (
              <p className="text-sm text-muted-foreground">Address: {request.legal_address}</p>
            )}
          </div>

          {request.verification_type === 'blue' && request.payment_transaction_signature && (
            <div>
              <p className="text-sm font-medium">Payment</p>
              <p className="text-sm text-muted-foreground">
                Amount: {request.payment_amount} SOL
              </p>
              <p className="text-sm text-muted-foreground truncate">
                Signature: {request.payment_transaction_signature}
              </p>
            </div>
          )}

          {request.verification_type === 'red' && (
            <div>
              <p className="text-sm font-medium">Eligibility</p>
              <p className="text-sm text-muted-foreground">
                Watch Hours: {request.total_watch_hours?.toFixed(1) || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Followers: {request.follower_count_at_request || 0}
              </p>
              <Badge variant={request.meets_eligibility_criteria ? 'default' : 'secondary'}>
                {request.meets_eligibility_criteria ? 'Eligible' : 'Not Eligible'}
              </Badge>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {request.legal_id_document_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => viewDocument(request.legal_id_document_url)}
              >
                <Eye className="w-4 h-4 mr-1" />
                View ID
              </Button>
            )}
            {request.status === 'pending' || request.status === 'under_review' ? (
              <Button size="sm" onClick={() => handleReview(request)}>
                <Shield className="w-4 h-4 mr-1" />
                Review
              </Button>
            ) : null}
          </div>

          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mt-2 p-2 bg-destructive/10 rounded">
              <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
              <p className="text-sm text-muted-foreground">{request.rejection_reason}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Submitted: {new Date(request.submitted_at).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Verification Management</h1>
        <p className="text-muted-foreground">Review and approve verification badge requests</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approved ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-2" />
            Rejected ({rejectedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No pending verification requests
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {approvedRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No approved verification requests
              </CardContent>
            </Card>
          ) : (
            approvedRequests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          {rejectedRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No rejected verification requests
              </CardContent>
            </Card>
          ) : (
            rejectedRequests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Verification Request</DialogTitle>
            <DialogDescription>
              Review the submitted information and approve or reject the verification request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold mb-2">User Information</h3>
                <p className="text-sm">Username: @{selectedRequest.profiles?.username}</p>
                <p className="text-sm">Display Name: {selectedRequest.profiles?.display_name}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Legal Information</h3>
                <p className="text-sm">Name: {selectedRequest.legal_name}</p>
                <p className="text-sm">Email: {selectedRequest.legal_email}</p>
                {selectedRequest.legal_phone && (
                  <p className="text-sm">Phone: {selectedRequest.legal_phone}</p>
                )}
                {selectedRequest.legal_address && (
                  <p className="text-sm">Address: {selectedRequest.legal_address}</p>
                )}
                {selectedRequest.legal_id_type && (
                  <p className="text-sm">ID Type: {selectedRequest.legal_id_type}</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Verification Type</h3>
                <Badge variant={selectedRequest.verification_type === 'blue' ? 'default' : 'destructive'}>
                  {selectedRequest.verification_type === 'blue' ? 'Blue Badge (Paid)' : 'Red Badge (Earned)'}
                </Badge>
              </div>

              <div>
                <label className="text-sm font-medium">Rejection Reason (if rejecting)</label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason if rejecting this request..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
