import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, Users, Clock, MessageCircle } from "lucide-react";

interface AnalyticsProps {
  pageId: number;
  isTemplate: boolean;
  activeTab: string;
}

interface AnalyticsData {
  dailyViews: Record<string, number>;
  hourlyViews: Record<string, number>;
  locationViews: Record<string, { views: number; lastView: string }>;
  totalComments: number;
  fileDownloads: Record<string, number>;
  uniqueVisitors: Record<string, number>;
  totalUniqueVisitors: number;
  averageVisitDuration: number;
  dailyVisitDurations: Record<string, { 
    duration: number; 
    timestamp: string; 
    location?: { 
      city?: string | null; 
      region?: string | null; 
      country?: string | null; 
      key?: string 
    } 
  }[]>;
}

// Helper functions
const formatDuration = (seconds: number) => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return 'Invalid duration';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${remainingSeconds}s`;
};

const formatLocation = (location: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  key?: string;
} | undefined) => {
  if (!location) return "Location not available";
  if (location.key) return location.key;

  const locationParts = [location.city, location.region, location.country]
    .filter((part) => part && part !== "null" && part !== "undefined")
    .join(", ");

  return locationParts.length > 0 ? locationParts : "Unknown Location";
};

export function Analytics({ pageId, isTemplate, activeTab }: AnalyticsProps) {
  const { data: stats, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: [`/api/pages/${pageId}/analytics`],
    enabled: !isNaN(pageId) && !isTemplate && activeTab === "analytics",
    retry: 3,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive space-y-2">
        <p>Error loading analytics data. Please try again.</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        <p>No analytics data available yet</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyViews = stats.dailyViews?.[today] || 0;
  const hourlyViews = stats.hourlyViews || {};
  const currentHour = new Date().getHours();
  const currentHourViews = hourlyViews[currentHour] || 0;
  const locationViews = stats.locationViews || {};

  // Calculate average duration for today's visits
  const todayDurations = stats.dailyVisitDurations[today] || [];
  const validDurations = todayDurations
    .map(visit => visit.duration)
    .filter(duration => typeof duration === 'number' && !isNaN(duration));

  const todayAverageDuration = validDurations.length > 0
    ? Math.round(validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length)
    : 0;

  const topLocations = Object.entries(locationViews)
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
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
                <p className="text-sm font-medium text-muted-foreground">Unique Visitors Today</p>
                <p className="text-2xl font-bold">{stats?.uniqueVisitors[today] || 0}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
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

      <Card>
        <CardHeader>
          <CardTitle>Visit Duration Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Visit Duration</p>
              <p className="text-xl font-bold">{formatDuration(stats.averageVisitDuration)}</p>
              <p className="text-sm text-muted-foreground mt-1">All time average</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Average Duration</p>
              <p className="text-xl font-bold">{formatDuration(todayAverageDuration)}</p>
              <p className="text-sm text-muted-foreground mt-1">Based on {validDurations.length} visits</p>
            </div>
          </div>
          {todayDurations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Today's Visit Durations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayDurations.slice(-5).map((visit, index) => {
                    const timestamp = visit?.timestamp ? new Date(visit.timestamp) : null;
                    const isValidDate = timestamp && !isNaN(timestamp.getTime());
                    const visitNumber = todayDurations.length - (todayDurations.length - 1 - index);

                    return (
                      <div key={index} className="text-sm border rounded-lg p-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Visit {visitNumber}</span>
                          <span className="text-muted-foreground">
                            {typeof visit.duration === 'number' && !isNaN(visit.duration)
                              ? formatDuration(visit.duration)
                              : 'Invalid duration'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isValidDate && (
                            <div>{format(timestamp, 'PPpp')}</div>
                          )}
                          <div>Location: {formatLocation(visit.location)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

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
                    Last viewed: {format(new Date(data.lastView), 'PPpp')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No location data available yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.fileDownloads || {}).length > 0 ? (
              Object.entries(stats.fileDownloads || {}).map(([name, downloads]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-sm text-muted-foreground">{downloads} downloads</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No downloads yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}