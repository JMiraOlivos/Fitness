import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { authFetch } from "@/lib/authFetch";

type AiFeedbackProps = {
  generationId: string;
  className?: string;
};

export function AiFeedback({ generationId, className = "" }: AiFeedbackProps) {
  const [feedback, setFeedback] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!generationId) return null;

  async function send(value: "thumbs_up" | "thumbs_down") {
    setFeedback(value);
    setIsSending(true);
    try {
      await authFetch("/api/ai/feedback", { generationId, feedback: value });
    } catch {
      // best-effort, never block the UI
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => send("thumbs_up")}
        disabled={isSending}
        title="Me gustó"
        className={`rounded-full p-1.5 transition-colors ${
          feedback === "thumbs_up" ? "bg-[#CCFF00]/20 text-[#CCFF00]" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => send("thumbs_down")}
        disabled={isSending}
        title="No me gustó"
        className={`rounded-full p-1.5 transition-colors ${
          feedback === "thumbs_down" ? "bg-red-500/20 text-red-400" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
