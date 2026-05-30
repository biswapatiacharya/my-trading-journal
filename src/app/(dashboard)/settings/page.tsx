"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Tag as TagIcon, GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { Profile, Strategy, Tag } from "@/types";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  timezone: z.string().min(1),
});

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newStrategy, setNewStrategy] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", timezone: "America/New_York" },
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: strats }, { data: t }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("strategies").select("*").eq("user_id", user.id).order("name"),
        supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
      ]);

      if (p) {
        setProfile(p as Profile);
        form.reset({ full_name: p.full_name ?? "", timezone: p.timezone ?? "America/New_York" });
      }
      setStrategies((strats ?? []) as Strategy[]);
      setTags((t ?? []) as Tag[]);
    }
    load();
  }, []);

  async function saveProfile(data: z.infer<typeof profileSchema>) {
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update(data).eq("id", user!.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function addStrategy() {
    if (!newStrategy.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("strategies")
        .insert({ user_id: user!.id, name: newStrategy.trim() })
        .select()
        .single();
      if (error) throw error;
      setStrategies((prev) => [...prev, data as Strategy].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStrategy("");
      toast.success("Strategy added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add strategy");
    }
  }

  async function deleteStrategy(id: string) {
    try {
      const { error } = await supabase.from("strategies").delete().eq("id", id);
      if (error) throw error;
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      toast.success("Strategy deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete strategy");
    }
  }

  async function addTag() {
    if (!newTag.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: user!.id, name: newTag.trim().toLowerCase(), color: newTagColor })
        .select()
        .single();
      if (error) throw error;
      setTags((prev) => [...prev, data as Tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTag("");
      toast.success("Tag added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add tag");
    }
  }

  async function deleteTag(id: string) {
    try {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tag deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tag");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, strategies, and tags</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(saveProfile)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled className="opacity-60" />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input {...form.register("full_name")} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input {...form.register("timezone")} placeholder="America/New_York" />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Strategies */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Strategies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newStrategy}
              onChange={(e) => setNewStrategy(e.target.value)}
              placeholder="Strategy name..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStrategy())}
            />
            <Button onClick={addStrategy} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {strategies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No strategies yet</p>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteStrategy(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TagIcon className="w-4 h-4" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag name..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              className="flex-1"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-10 h-10 rounded-md border cursor-pointer p-1"
              title="Tag color"
            />
            <Button onClick={addTag} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tags yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-1 group">
                  <Badge style={{ backgroundColor: tag.color, color: "white" }}>
                    {tag.name}
                  </Badge>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
