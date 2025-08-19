"use client";

import { CompassIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarLoader } from "react-spinners";

interface Props {
  className?: string;
  disabled?: boolean;
  url?: string;
}

export function Preview({ className, disabled, url }: Props) {
  const [currentUrl, setCurrentUrl] = useState(url || "");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCurrentUrl(url || "");
  }, [url]);

  const refreshIframe = () => {
    if (currentUrl) {
      setIsLoading(true);
      setError(null);
      // Force refresh by adding timestamp parameter
      const newUrl = new URL(currentUrl);
      newUrl.searchParams.set("t", Date.now().toString());
      setCurrentUrl(newUrl.toString());
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const handleUrlChange = (newUrl: string) => {
    setCurrentUrl(newUrl);
    setIsLoading(true);
    setError(null);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError("Failed to load the page");
  };

  if (!currentUrl || disabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No preview available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <WebPreview
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-0 shadow-sm flex-1 overflow-hidden",
        className
      )}
      defaultUrl={currentUrl}
      onUrlChange={handleUrlChange}
    >
      <WebPreviewNavigation>
        <WebPreviewNavigationButton
          onClick={() => window.open(currentUrl, "_blank")}
          tooltip="Open in new tab"
        >
          <CompassIcon className="w-4 h-4" />
        </WebPreviewNavigationButton>

        <WebPreviewNavigationButton
          onClick={refreshIframe}
          tooltip="Refresh"
          className={cn({
            "animate-spin": isLoading,
          })}
        >
          <RefreshCwIcon className="w-4 h-4" />
        </WebPreviewNavigationButton>

        <WebPreviewUrl />
      </WebPreviewNavigation>

      <div className="flex-1 relative">
        <WebPreviewBody
          src={currentUrl}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />

        {isLoading && !error && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center flex-col gap-2">
            <BarLoader color="#666" />
            <span className="text-gray-500 text-xs">Loading...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center flex-col gap-2">
            <span className="text-red-500">Failed to load page</span>
            <button
              className="text-blue-500 hover:underline text-sm"
              onClick={refreshIframe}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </WebPreview>
  );
}
