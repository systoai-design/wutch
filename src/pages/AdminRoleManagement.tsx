import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, ShieldCheck, User, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserRole {
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function AdminRoleManagement() {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useAdmin();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchUserRoles();
    }
  }, [isAdmin, isLoading, navigate]);

  const fetchUserRoles = async () => {
    try {
      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .order('role', { ascending: true });

      if (rolesError) throw rolesError;

      // Get unique user IDs
      const userIds = [...new Set(rolesData?.map(r => r.user_id))];

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

      // Combine roles with profiles
      const rolesWithProfiles = rolesData?.map(role => ({
        user_id: role.user_id,
        role: role.role,
        profiles: profilesMap.get(role.user_id) || { username: 'Unknown', display_name: null, avatar_url: null }
      }));

      setUserRoles(rolesWithProfiles || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      toast.error('Failed to load user roles');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    }
  };

  const handleRoleChange = async (userId: string, action: 'grant' | 'revoke', role: 'admin' | 'moderator') => {
    try {
      const { error } = await supabase.rpc('manage_user_role', {
        p_user_id: userId,
        p_role: role,
        p_action: action,
      });

      if (error) throw error;

      toast.success(
        action === 'grant' 
          ? `${role} role granted successfully`
          : `${role} role revoked successfully`
      );

      fetchUserRoles();
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Error managing role:', error);
      toast.error('Failed to manage role');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="destructive">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      case 'moderator':
        return (
          <Badge variant="default">
            <Shield className="h-3 w-3 mr-1" />
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <User className="h-3 w-3 mr-1" />
            User
          </Badge>
        );
    }
  };

  const getUserRoles = (userId: string): string[] => {
    return userRoles
      .filter((ur) => ur.user_id === userId)
      .map((ur) => ur.role);
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Group users by their highest role
  const admins = userRoles.filter((ur) => ur.role === 'admin');
  const moderators = userRoles.filter(
    (ur) => ur.role === 'moderator' && !getUserRoles(ur.user_id).includes('admin')
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Role Management</h1>
        <p className="text-muted-foreground">
          Manage admin and moderator roles for your platform
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Grant Roles</CardTitle>
          <CardDescription>Search for users and assign roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                className="pl-9"
              />
            </div>
            <Button onClick={searchUsers}>Search</Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => {
                const currentRoles = getUserRoles(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url && (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="h-10 w-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">{user.display_name || user.username}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(value) => {
                          const [action, role] = value.split(':');
                          handleRoleChange(user.id, action as 'grant' | 'revoke', role);
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select action..." />
                        </SelectTrigger>
                        <SelectContent>
                          {!currentRoles.includes('moderator') && (
                            <SelectItem value="grant:moderator">Grant Moderator</SelectItem>
                          )}
                          {currentRoles.includes('moderator') && (
                            <SelectItem value="revoke:moderator">Revoke Moderator</SelectItem>
                          )}
                          {!currentRoles.includes('admin') && (
                            <SelectItem value="grant:admin">Grant Admin</SelectItem>
                          )}
                          {currentRoles.includes('admin') && (
                            <SelectItem value="revoke:admin">Revoke Admin</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admins ({admins.length})</CardTitle>
            <CardDescription>Users with full administrative access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admins found</p>
            ) : (
              admins.map((userRole) => (
                <div
                  key={userRole.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {userRole.profiles.avatar_url && (
                      <img
                        src={userRole.profiles.avatar_url}
                        alt={userRole.profiles.username}
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {userRole.profiles.display_name || userRole.profiles.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{userRole.profiles.username}
                      </p>
                    </div>
                  </div>
                  {getRoleBadge('admin')}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moderators ({moderators.length})</CardTitle>
            <CardDescription>Users with content moderation access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {moderators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moderators found</p>
            ) : (
              moderators.map((userRole) => (
                <div
                  key={userRole.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {userRole.profiles.avatar_url && (
                      <img
                        src={userRole.profiles.avatar_url}
                        alt={userRole.profiles.username}
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {userRole.profiles.display_name || userRole.profiles.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{userRole.profiles.username}
                      </p>
                    </div>
                  </div>
                  {getRoleBadge('moderator')}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
