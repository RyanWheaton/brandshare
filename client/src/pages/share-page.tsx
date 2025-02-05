import { useQuery } from "@tanstack/react-query";
import { type SharePage } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function SharePageView({ params }: { params: { slug: string } }) {
  const { data: page, isLoading } = useQuery<SharePage>({
    queryKey: [`/api/p/${params.slug}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">
            This share page doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        backgroundColor: page.backgroundColor || "#ffffff",
        color: page.textColor || "#000000",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{page.title}</h1>
        {page.description && (
          <p className="text-lg mb-8 opacity-90">{page.description}</p>
        )}

        <div className="space-y-4">
          {(page.files as any[]).map((file, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-lg p-4"
            >
              {/* TODO: Implement file display based on type */}
              <p>{file.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}