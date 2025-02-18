import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SharePage, SharePageTemplate, changePasswordSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, Variants } from "framer-motion";
import {  ExternalLink,
  Copy,
  Trash2,
  Palette,
  Loader2,
  Plus,
  LogOut,
  Eye,
  MessageCircle,
  Calendar,
  Save,
  FileText,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ChangePasswordData } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DropboxLinkInput } from "@/components/ui/dropbox-link-input";
import { PageThumbnail } from "@/components/ui/page-thumbnail";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";


// Dummy files for testing
const DUMMY_FILES = [
  {
    name: "sample-image.jpg",
    preview_url: "https://picsum.photos/800/600",
    url: "https://picsum.photos/800/600",
    isFullWidth: true,
  },
  {
    name: "sample-pdf.pdf",
    preview_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    isFullWidth: true,
  },
  {
    name: "sample-video.mp4",
    preview_url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    isFullWidth: true,
  }
];

{/* Stats Card Component */}
function StatsCard({ stats }: { stats: any }) {
  if (!stats) return null;

  const today = new Date().toISOString().split('T')[0];
  const dailyViews = (stats.dailyViews as Record<string, number>)[today] || 0;
  const hourlyViews = stats.hourlyViews as Record<string, number>;
  const locationViews = stats.locationViews as Record<string, { views: number, lastView: string }>;

  // Get current hour's views
  const currentHour = new Date().getHours();
  const currentHourViews = hourlyViews[currentHour] || 0;

  // Get top locations with timestamps
  const topLocations = Object.entries(locationViews || {})
    .sort(([, a], [, b]) => (b.views) - (a.views))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Views</p>
                <p className="text-2xl font-bold">{dailyViews}</p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Hour</p>
                <p className="text-2xl font-bold">{currentHourViews}</p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Comments</p>
                <p className="text-2xl font-bold">{stats.totalComments}</p>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Always show the locations card, even if empty */}
      <Card>
        <CardHeader>
          <CardTitle>Top Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {topLocations.length > 0 ? (
            <div className="space-y-2">
              {topLocations.map(([location, data]) => (
                <div key={location} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{location}</span>
                    <span className="text-sm">{data.views} views</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last viewed: {new Date(data.lastView).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No location data available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const res = await apiRequest("POST", "/api/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Wrap Card component with motion
const AnimatedCard = motion(Card);

// Define proper animation variants
const fadeInVariant: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 }
};

const slideInVariant: Variants = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 }
};

const staggerContainerVariant: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function SharePageCard({
  page,
  onDelete,
  onCopyLink,
}: {
  page: SharePage & { stats: any };
  onDelete: (id: number) => void;
  onCopyLink: (slug: string) => void;
}) {
  const [, setLocation] = useLocation();

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    setLocation(`/customize/${page.id}`);
  };

  return (
    <motion.div
      variants={fadeInVariant}
      initial="initial"
      animate="animate"
    >
      <AnimatedCard
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="grid lg:grid-cols-[200px_1fr] gap-4">
          <div className="p-4">
            <PageThumbnail
              title={page.title}
              description={page.description}
              files={page.files as FileObject[]}
              backgroundColor={page.backgroundColor || "#ffffff"}
              backgroundColorSecondary={page.backgroundColorSecondary}
              textColor={page.textColor || "#000000"}
              titleFont={page.titleFont || "Inter"}
              descriptionFont={page.descriptionFont || "Inter"}
              titleFontSize={page.titleFontSize || 24}
              descriptionFontSize={page.descriptionFontSize || 16}
              footerText={page.footerText}
              footerTextColor={page.footerTextColor}
            />
          </div>
          <div>
            <CardHeader>
              <CardTitle>{page.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatsCard stats={page.stats} />
              <p className="text-sm text-muted-foreground mb-4">
                {page.description || "No description"}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/customize/${page.id}`);
                  }}
                >
                  <Palette className="mr-2 h-4 w-4" />
                  Customize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/p/${page.slug}`, "_blank");
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyLink(page.slug);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(page.id);
                  }}
                  disabled={false}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </div>
        </div>
      </AnimatedCard>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: pages = [], isLoading: pagesLoading } = useQuery<(SharePage & { stats: any })[]>({
    queryKey: ["/api/pages"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<SharePageTemplate[]>({
    queryKey: ["/api/templates"],
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

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template deleted",
        description: "Your template has been deleted successfully.",
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/templates/${id}/duplicate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template duplicated",
        description: "Your template has been duplicated successfully.",
      });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/templates/${id}/create-page`);
      return response.json();
    },
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Share page created",
        description: "A new share page has been created from the template.",
      });
      if (newPage?.id) {
        setLocation(`/customize/${newPage.id}`);
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pages", {
        title: "My Test Share Page",
        description: "A sample share page with different types of files",
        files: DUMMY_FILES,
      });
      return await response.json();
    },
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Page created",
        description: "Your share page has been created successfully.",
      });
      if (newPage?.id) {
        setLocation(`/customize/${newPage.id}`);
      }
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/templates", {
        title: "New Template",
        description: "A blank template for share pages",
        files: [],
        backgroundColor: "#ffffff",
        textColor: "#000000",
        titleFont: "Inter",
        descriptionFont: "Inter"
      });
      return await response.json();
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template created",
        description: "Your template has been created successfully.",
      });
      if (newTemplate?.id) {
        setLocation(`/customize-template/${newTemplate.id}`);
      }
    },
  });

  const copyToClipboard = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      toast({
        title: "Link copied",
        description: "Share page link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (pagesLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <motion.div
      className="container max-w-4xl mx-auto p-4"
      variants={fadeInVariant}
      initial="initial"
      animate="animate"
    >
      <motion.div
        className="flex items-center justify-between mb-8"
        variants={slideInVariant}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Welcome, {user?.username}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Logout
          </Button>
          <ThemeSwitcher />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => createTemplateMutation.mutate()}
            disabled={createTemplateMutation.isPending}
            variant="outline"
          >
            {createTemplateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Create Template
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Test Share Page
          </Button>
        </div>
      </motion.div>


      {/* Templates Section */}
      <motion.div
        className="mb-8"
        variants={fadeInVariant}
        initial="initial"
        animate="animate"
      >
        <h2 className="text-2xl font-bold mb-4">Templates</h2>
        <motion.div
          className="grid gap-4"
          variants={staggerContainerVariant}
          initial="initial"
          animate="animate"
        >
          {templates.map((template) => (
            <motion.div
              key={template.id}
              variants={fadeInVariant}
              initial="initial"
              animate="animate"
            >
              <AnimatedCard
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid lg:grid-cols-[200px_1fr] gap-4">
                  <div className="p-4">
                    <PageThumbnail
                      title={template.title}
                      description={template.description}
                      files={template.files as FileObject[]}
                      backgroundColor={template.backgroundColor || "#ffffff"}
                      textColor={template.textColor || "#000000"}
                      titleFont={template.titleFont || "Inter"}
                      descriptionFont={template.descriptionFont || "Inter"}
                    />
                  </div>
                  <div>
                    <CardHeader>
                      <CardTitle>{template.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {template.description || "No description"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/customize-template/${template.id}`)}
                        >
                          <Palette className="mr-2 h-4 w-4" />
                          Edit Template
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateTemplateMutation.mutate(template.id)}
                          disabled={duplicateTemplateMutation.isPending}
                        >
                          {duplicateTemplateMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => createFromTemplateMutation.mutate(template.id)}
                          disabled={createFromTemplateMutation.isPending}
                        >
                          {createFromTemplateMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Create Page
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                          disabled={deleteTemplateMutation.isPending}
                        >
                          {deleteTemplateMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          ))}

          {templates.length === 0 && (
            <motion.div variants={fadeInVariant} initial="initial" animate="animate">
              <AnimatedCard>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>You haven't created any templates yet.</p>
                  <p className="text-sm mt-1">
                    Click "Create Template" to create your first template.
                  </p>
                </CardContent>
              </AnimatedCard>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Share Pages Section */}
      <motion.div
        className="mb-8"
        variants={fadeInVariant}
        initial="initial"
        animate="animate"
      >
        <h2 className="text-2xl font-bold mb-4">Share Pages</h2>
        <motion.div
          className="grid gap-4"
          variants={staggerContainerVariant}
          initial="initial"
          animate="animate"
        >
          {pages.map((page) => (
            <SharePageCard
              key={page.id}
              page={page}
              onDelete={(id) => deleteMutation.mutate(id)}
              onCopyLink={(slug) => copyToClipboard(slug)}
            />
          ))}

          {pages.length === 0 && (
            <motion.div variants={fadeInVariant} initial="initial" animate="animate">
              <AnimatedCard>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>You haven't created any share pages yet.</p>
                  <p className="text-sm mt-1">
                    Click "Create Test Share Page" or use a template to create your first page.
                  </p>
                </CardContent>
              </AnimatedCard>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="mt-8"
        variants={fadeInVariant}
        initial="initial"
        animate="animate"
      >
        <AnimatedCard
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <ChangePasswordCard />
        </AnimatedCard>
      </motion.div>
    </motion.div>
  );
}

// Type definition -  You'll need to adapt this to your actual FileObject type.
type FileObject = {
  name: string;
  preview_url?: string;
  url: string;
  isFullWidth: boolean;
  title?: string;
  description?: string;
};