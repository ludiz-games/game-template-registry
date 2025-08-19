"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TrueFalseComponentProps {
  correctAnswer?: boolean;
  selectedAnswer?: boolean | null;
  onAnswerSelect?: (answer: boolean) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function TrueFalseComponent({
  correctAnswer,
  selectedAnswer,
  onAnswerSelect,
  showFeedback = false,
  disabled = false,
}: TrueFalseComponentProps) {
  const [internalSelected, setInternalSelected] = useState<boolean | null>(
    null
  );

  // Use controlled or uncontrolled pattern
  const currentSelected =
    selectedAnswer !== undefined ? selectedAnswer : internalSelected;

  const handleAnswerSelect = (answer: boolean) => {
    if (disabled) return;

    if (selectedAnswer === undefined) {
      setInternalSelected(answer);
    }
    onAnswerSelect?.(answer);
  };

  const getButtonStyle = (value: boolean) => {
    const baseStyle =
      "flex-1 h-20 text-lg font-medium transition-all duration-200";

    if (disabled && showFeedback && correctAnswer !== undefined) {
      if (value === correctAnswer) {
        return `${baseStyle} bg-green-500 text-white border-2 border-green-500`;
      } else if (currentSelected === value && value !== correctAnswer) {
        return `${baseStyle} bg-red-500 text-white border-2 border-red-500`;
      }
      return `${baseStyle} bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 opacity-60`;
    }

    if (currentSelected === value) {
      return `${baseStyle} bg-blue-500 hover:bg-blue-600 text-white border-2 border-blue-500`;
    }

    return `${baseStyle} bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`;
  };

  return (
    <div className="flex gap-4">
      <Button
        variant="outline"
        className={getButtonStyle(true)}
        onClick={() => handleAnswerSelect(true)}
        disabled={disabled}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="text-2xl">✓</div>
          <div>TRUE</div>
          {showFeedback && disabled && correctAnswer === true && (
            <div className="text-sm opacity-75">Correct!</div>
          )}
          {showFeedback &&
            disabled &&
            currentSelected === true &&
            correctAnswer === false && (
              <div className="text-sm opacity-75">Incorrect</div>
            )}
        </div>
      </Button>

      <Button
        variant="outline"
        className={getButtonStyle(false)}
        onClick={() => handleAnswerSelect(false)}
        disabled={disabled}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="text-2xl">✗</div>
          <div>FALSE</div>
          {showFeedback && disabled && correctAnswer === false && (
            <div className="text-sm opacity-75">Correct!</div>
          )}
          {showFeedback &&
            disabled &&
            currentSelected === false &&
            correctAnswer === true && (
              <div className="text-sm opacity-75">Incorrect</div>
            )}
        </div>
      </Button>
    </div>
  );
}
