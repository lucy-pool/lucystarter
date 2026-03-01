"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

// ── Demo page — shows the basic patterns for a CRUD feature ─────────
// Replace this with your own pages.

export default function NotesPage() {
  const notes = useQuery(api.notes.list);
  const createNote = useMutation(api.notes.create);
  const deleteNote = useMutation(api.notes.remove);
  const user = useQuery(api.users.getCurrentUser);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await createNote({ title: title.trim(), body: body.trim(), isPublic });
    setTitle("");
    setBody("");
    setIsPublic(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-muted-foreground">
          Demo CRUD page — shows queries, mutations, and real-time updates.
        </p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Write something..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-input"
                />
                Public
              </label>
              <Button type="submit" size="sm" disabled={!title.trim()}>
                Add Note
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notes list */}
      {notes === undefined ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No notes yet. Create one above!
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isOwner = user && note.authorId === user._id;
            return (
              <Card key={note._id} className="animate-fade-in">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{note.title}</h3>
                        {note.isPublic && (
                          <Badge variant="secondary" className="text-xs">
                            public
                          </Badge>
                        )}
                      </div>
                      {note.body && (
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                          {note.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNote({ id: note._id })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
