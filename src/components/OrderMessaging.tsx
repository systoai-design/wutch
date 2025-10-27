import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface OrderMessagingProps {
  orderId: string;
}

interface Message {
  id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  sender?: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const OrderMessaging = ({ orderId }: OrderMessagingProps) => {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchThread = async () => {
      const { data, error } = await supabase
        .from("direct_message_threads")
        .select("id")
        .eq("order_id", orderId)
        .single();

      if (error) {
        console.error("Error fetching thread:", error);
        return;
      }

      setThreadId(data.id);
    };

    fetchThread();
  }, [orderId]);

  useEffect(() => {
    if (!threadId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select(`
          *,
          sender:profiles!direct_messages_sender_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data as any);
    };

    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const fetchNewMessage = async () => {
            const { data, error } = await supabase
              .from("direct_messages")
              .select(`
                *,
                sender:profiles!direct_messages_sender_id_fkey (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .eq("id", payload.new.id)
              .single();

            if (!error && data) {
              setMessages((prev) => [...prev, data as any]);
            }
          };
          fetchNewMessage();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !threadId || !user) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from("direct_messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        message_text: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (!threadId) {
    return <div className="text-center p-4">Loading messages...</div>;
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Order Messages</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwn = message.sender_id === user?.id;
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={message.sender?.avatar_url} />
                <AvatarFallback>
                  {message.sender?.display_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className={`flex-1 ${isOwn ? "text-right" : ""}`}>
                <div className="text-xs text-muted-foreground mb-1">
                  {message.sender?.display_name} •{" "}
                  {formatDistanceToNow(new Date(message.created_at))} ago
                </div>
                <div
                  className={`inline-block p-3 rounded-lg ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{message.message_text}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !newMessage.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
