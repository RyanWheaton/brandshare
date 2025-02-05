import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Copy,
  Trash2,
  Palette,
  Loader2,
  Plus,
} from "lucide-react";
import { SiDropbox } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState } from 'react';

// Dummy files for testing
const DUMMY_FILES = [
  {
    name: "sample-image.jpg",
    preview_url: "https://picsum.photos/800/600",
    url: "https://picsum.photos/800/600",
  },
  {
    name: "sample-pdf.pdf",
    preview_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  },
  {
    name: "sample-video.mp4",
    preview_url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  }
];

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: pages, isLoading } = useQuery<SharePage[]>({
    queryKey: ["/api/pages"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Share page deleted",
        description: "Your share page has been deleted successfully.",
      });
    },
  });

  const handleCreatePage = async () => {
    try {
      const response = await apiRequest("POST", "/api/pages", {
        title: "My Test Share Page",
        description: "A sample share page with different types of files",
        files: DUMMY_FILES,
      });

      const newPage = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });

      toast({
        title: "Page created",
        description: "Your share page has been created successfully.",
      });

      setLocation(`/customize/${newPage.id}`);
    } catch (error) {
      toast({
        title: "Creation failed",
        description: "Failed to create share page. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (slug: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
    toast({
      title: "Link copied",
      description: "Share page link copied to clipboard.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Welcome, {user?.username}</h1>
        <div className="flex gap-4">
          <Button
            onClick={handleDropboxConnect}
            variant="outline"
            disabled={isConnecting}
          >
            <SiDropbox className="mr-2 h-4 w-4" />
            {isConnecting ? "Connecting..." : "Connect Dropbox"}
          </Button>
          <Button onClick={handleCreatePage}>
            <Plus className="mr-2 h-4 w-4" />
            Create Test Share Page
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {pages?.map((page) => (
          <Card key={page.id}>
            <CardHeader>
              <CardTitle>{page.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {page.description || "No description"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/customize/${page.id}`)}
                >
                  <Palette className="mr-2 h-4 w-4" />
                  Customize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/p/${page.slug}`, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(page.slug)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(page.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {pages?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>You haven't created any share pages yet.</p>
              <p className="text-sm mt-1">
                Click "Create Test Share Page" to create a page with sample files.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}