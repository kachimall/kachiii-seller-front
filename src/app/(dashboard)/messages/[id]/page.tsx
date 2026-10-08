import { ConversationThread } from "./conversation-thread";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  return <ConversationThread key={id} id={id} />;
}
