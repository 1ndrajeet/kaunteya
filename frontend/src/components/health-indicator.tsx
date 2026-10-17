"use client";

import { useHealth } from "@/hooks/use-health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export function HealthIndicator() {
  const { state, data, error, lastChecked, checkHealth } = useHealth();
  const apiUrl = getApiBaseUrl();

  return (
    <Card className="w-full max-w-lg border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-muted-foreground h-5 w-5" />
            <CardTitle className="text-base font-semibold">Backend Status</CardTitle>
          </div>
          {state === "loading" && (
            <Badge variant="outline" className="text-muted-foreground gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Connecting...
            </Badge>
          )}
          {state === "connected" && (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          )}
          {state === "unavailable" && (
            <Badge
              variant="outline"
              className="gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            >
              <AlertCircle className="h-3 w-3" />
              Unavailable
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Target API: <code className="bg-muted rounded px-1.5 py-0.5 font-mono">{apiUrl}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {state === "connected" && data && (
          <div className="bg-muted/30 space-y-1.5 rounded-md border p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{data.app}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-medium capitalize">{data.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Health</span>
              <span className="font-mono font-semibold text-emerald-600 uppercase dark:text-emerald-400">
                {data.status}
              </span>
            </div>
          </div>
        )}

        {state === "unavailable" && (
          <div className="space-y-1 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-950 dark:bg-rose-950/20 dark:text-rose-300">
            <p className="font-medium">Could not connect to FastAPI server.</p>
            <p className="text-muted-foreground text-[11px]">
              {error ||
                "Verify that the backend is running (`make dev-server`) and CORS allows this origin."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground text-[11px]">
            {lastChecked ? `Updated ${lastChecked.toLocaleTimeString()}` : "Not yet checked"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void checkHealth()}
            disabled={state === "loading"}
            className="h-7 text-xs"
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${state === "loading" ? "animate-spin" : ""}`} />
            Check Health
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
