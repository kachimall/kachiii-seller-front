import { MessageSquareIcon } from "lucide-react";

/** Shown beside the list on wide screens until a conversation is chosen. */
export default function MessagesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <MessageSquareIcon className="size-8 text-muted-foreground/60" />
      <p className="font-medium">Choose a conversation</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Buyers write to your store from its page and from their orders. Their messages appear here.
      </p>
    </div>
  );
}
