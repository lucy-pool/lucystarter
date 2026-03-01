"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Bot, User } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// ── Demo page — shows the OpenRouter AI chat pattern ────────────────
// Flow: save user msg → call OpenRouter action → save assistant msg

export default function AiChatPage() {
  const messages = useQuery(api.ai.listMessages);
  const saveMessage = useMutation(api.ai.saveMessage);
  const clearHistory = useMutation(api.ai.clearHistory);
  const chat = useAction(api.aiActions.chat);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    try {
      // 1. Save user message
      await saveMessage({ role: "user", content: text });

      // 2. Build conversation history for context
      const history = [
        ...(messages || []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: text },
      ];

      // 3. Call OpenRouter
      const result = await chat({
        messages: history,
        systemPrompt: "You are a helpful assistant. Be concise.",
      });

      // 4. Save assistant response
      await saveMessage({
        role: "assistant",
        content: result.content,
        model: result.model,
      });
    } catch (err) {
      console.error("Chat error:", err);
      toast({
        variant: "destructive",
        title: "Chat error",
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Chat</h1>
          <p className="text-muted-foreground">
            Demo OpenRouter integration — shows action + message history pattern.
          </p>
        </div>
        {messages && messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearHistory()}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4"
      >
        {messages === undefined ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : messages.length === 0 && !loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Send a message to start chatting.</p>
            <p className="text-xs mt-1">
              Requires OPENROUTER_API_KEY in Convex env.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <Card
              key={msg._id}
              className={
                msg.role === "assistant"
                  ? "bg-muted/50"
                  : "bg-primary/5"
              }
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    {msg.role === "assistant" ? (
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.model && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {msg.model}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {loading && (
          <Card className="bg-muted/50">
            <CardContent className="pt-3 pb-3">
              <div className="flex gap-3 items-center">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <Button type="submit" disabled={!input.trim() || loading} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
