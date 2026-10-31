import { SEOContent } from "@/components/portfolio/SEOContent";
import ChatInterface from "@/components/chat/ChatInterface";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
      <ChatInterface />
      <div className="sr-only">
        <SEOContent />
      </div>
    </div>
  );
}
