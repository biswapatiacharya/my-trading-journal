"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeImage } from "@/types";

interface TradeScreenshotsProps {
  images: TradeImage[];
}

export function TradeScreenshots({ images: initialImages }: TradeScreenshotsProps) {
  const supabase = createClient();
  const [images, setImages] = useState(initialImages);

  async function deleteImage(img: TradeImage) {
    try {
      await supabase.storage.from("trade-images").remove([img.storage_path]);
      const { error } = await supabase.from("trade_images").delete().eq("id", img.id);
      if (error) throw error;
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      toast.success("Screenshot deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete screenshot");
    }
  }

  if (images.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Screenshots</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="space-y-1">
              <p className="text-xs text-muted-foreground capitalize">{img.image_type} Chart</p>
              <div className="relative rounded-lg overflow-hidden border aspect-video bg-muted group">
                <Image
                  src={img.public_url}
                  alt={`${img.image_type} chart`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  onClick={() => deleteImage(img)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete screenshot"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
