/**
 * The PetWash Circle - Social Network
 * Instagram-style social platform with AI content moderation
 * 2025 Enterprise Build - Zero-tolerance moderation policy
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Heart, MessageCircle, Send, Shield, CheckCircle2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface Post {
  id: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  imageUrls?: string[];
  likesCount: number;
  commentsCount: number;
  moderationStatus: string;
  moderationScore?: number;
  createdAt: string;
}

export default function PetWashCircle() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [newPostContent, setNewPostContent] = useState('');

  // Fetch feed
  const { data: feed = [], isLoading } = useQuery<{ data: Post[] }>({
    queryKey: ['/api/social/feed'],
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('/api/social/posts', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
      setNewPostContent('');
      toast({
        title: '✅ פוסט נשלח',
        description: 'הפוסט שלך עובר בדיקת אבטחה ויפורסם בקרוב',
      });
    },
    onError: (error: any) => {
      toast({
        title: '⚠️ שגיאה',
        description: error.message || 'Failed to create post',
        variant: 'destructive',
      });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return apiRequest(`/api/social/posts/${postId}/like`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    createPostMutation.mutate(newPostContent);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${days} ימים`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-amber-400" />
            The PetWash Circle
          </h1>
          <p className="text-slate-400">
            הקהילה החברתית של PetWash • מוגנת ב-AI
          </p>
          <Badge className="mt-2 bg-gradient-to-r from-green-600 to-emerald-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            מודרציה אוטומטית • Zero-Tolerance Policy
          </Badge>
        </div>

        {/* Create Post Card */}
        {user && (
          <Card className="p-6 mb-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-700/50 backdrop-blur-sm">
            <div className="flex gap-3">
              <Avatar>
                <AvatarFallback className="bg-amber-500 text-white">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="שתף משהו עם הקהילה... (יתנהל בדיקת AI)"
                  className="mb-3 bg-slate-900/50 border-slate-700 text-white resize-none"
                  rows={3}
                  data-testid="textarea-new-post"
                />
                <Button
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim() || createPostMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold"
                  data-testid="button-create-post"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {createPostMutation.isPending ? 'שולח...' : 'פרסם פוסט'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">טוען פיד...</p>
          </div>
        ) : feed.data?.length === 0 ? (
          <Card className="p-12 text-center bg-slate-800/30 border-slate-700/30">
            <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">
              אין פוסטים עדיין
            </p>
            <p className="text-slate-500 text-sm mt-2">
              היה הראשון לשתף משהו עם הקהילה!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {feed.data?.map((post) => (
              <Card
                key={post.id}
                className="p-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-700/50 backdrop-blur-sm"
                data-testid={`post-${post.id}`}
              >
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white">
                      {post.userName[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{post.userName}</p>
                    <p className="text-xs text-slate-400">{formatDate(post.createdAt)}</p>
                  </div>
                  {post.moderationScore && post.moderationScore >= 80 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      מאומת
                    </Badge>
                  )}
                </div>

                {/* Post Content */}
                <div className="mb-4">
                  <p className="text-slate-200 whitespace-pre-wrap">{post.content}</p>
                </div>

                <Separator className="bg-slate-700/50 mb-4" />

                {/* Post Actions */}
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => likePostMutation.mutate(post.id)}
                    className="flex items-center gap-2 text-slate-400 hover:text-pink-400 transition-colors"
                    data-testid={`button-like-${post.id}`}
                  >
                    <Heart className="w-5 h-5" />
                    <span className="text-sm">{post.likesCount || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{post.commentsCount || 0}</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-slate-500 space-y-2">
          <p className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            כל התכנים עוברים מודרציה אוטומטית באמצעות AI מתקדם
          </p>
          <p>מדיניות אפס סובלנות לתכנים פוגעניים, פוליטיים או בלתי הולמים</p>
        </div>
      </div>
    </div>
  );
}
