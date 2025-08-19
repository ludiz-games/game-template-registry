"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface QuizTimerProps {
  totalTime: number; // in seconds
  onTimeUp?: () => void;
  onTick?: (timeRemaining: number) => void;
  isActive?: boolean;
  showProgress?: boolean;
  warningThreshold?: number; // seconds when to show warning (default: 10)
  size?: "sm" | "md" | "lg";
}

export function QuizTimer({
  totalTime,
  onTimeUp,
  onTick,
  isActive = true,
  showProgress = true,
  warningThreshold = 10,
  size = "md",
}: QuizTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(totalTime);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    setTimeRemaining(totalTime);
    setIsExpired(false);
  }, [totalTime]);

  useEffect(() => {
    if (!isActive || isExpired || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        onTick?.(newTime);

        if (newTime <= 0) {
          setIsExpired(true);
          onTimeUp?.();
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isExpired, timeRemaining, onTick, onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    return ((totalTime - timeRemaining) / totalTime) * 100;
  };

  const isWarning = timeRemaining <= warningThreshold && timeRemaining > 0;
  const isExpiredState = timeRemaining <= 0;

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return {
          container: "px-2 py-1",
          text: "text-sm",
          progress: "h-1",
        };
      case "lg":
        return {
          container: "px-4 py-3",
          text: "text-xl font-bold",
          progress: "h-3",
        };
      default:
        return {
          container: "px-3 py-2",
          text: "text-base font-medium",
          progress: "h-2",
        };
    }
  };

  const sizeClasses = getSizeClasses();

  const getTimerStyle = () => {
    if (isExpiredState) {
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
    } else if (isWarning) {
      return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
    } else {
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getProgressBarColor = () => {
    if (isExpiredState) {
      return "bg-red-500";
    } else if (isWarning) {
      return "bg-orange-500";
    } else {
      return "bg-blue-500";
    }
  };

  return (
    <Card className={`${getTimerStyle()} transition-colors duration-300`}>
      <CardContent className={`${sizeClasses.container} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className={`font-mono ${sizeClasses.text}`}>
            {formatTime(timeRemaining)}
          </div>
          {isExpiredState && (
            <div className="text-sm font-medium">Time's Up!</div>
          )}
          {isWarning && !isExpiredState && (
            <div className="text-sm font-medium animate-pulse">⚠️ Hurry!</div>
          )}
        </div>

        {showProgress && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`${sizeClasses.progress} ${getProgressBarColor()} transition-all duration-1000 ease-out`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        )}

        {size === "lg" && (
          <div className="text-xs text-center opacity-75">
            {isExpiredState
              ? "Time expired"
              : `${Math.round(getProgressPercentage())}% elapsed`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
