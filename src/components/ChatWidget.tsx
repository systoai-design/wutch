import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Minimize2, Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { useSupportChat } from '@/hooks/useSupportChat';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from './ui/drawer';

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, error, sendMessage } = useSupportChat();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${isMobile ? 'bottom-20' : 'bottom-6'} right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center z-50`}
        aria-label="Open Wutch support chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  const chatContent = (
    <>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h4 className="font-semibold mb-2">Welcome to Wutch Support!</h4>
            <p className="text-sm text-muted-foreground">
              Ask me anything about streams, shorts, bounties, or how to use the platform.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="h-[90vh] flex flex-col">
          <DrawerHeader className="flex items-center justify-between border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <DrawerTitle>Wutch Support Chat</DrawerTitle>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          {chatContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-background border border-border rounded-lg shadow-2xl flex flex-col z-50 animate-scale-in">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Wutch Support Chat</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {chatContent}
    </div>
  );
};
