import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-5 p-5">
          <Skeleton className="w-full sm:w-64 aspect-video shrink-0" />
          <div className="flex flex-col gap-3 flex-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full mt-3" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
        <Sparkles size={16} className="text-primary animate-pulse" />
        <span>Analyzing transcript… this usually takes 10–20 seconds.</span>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="h-3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    </div>
  );
}
