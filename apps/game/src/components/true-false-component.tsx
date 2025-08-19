"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCircle, X, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

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
    console.log("TrueFalse button clicked:", answer, "disabled:", disabled);
    if (disabled) return;

    if (selectedAnswer === undefined) {
      setInternalSelected(answer);
    }
    console.log("Calling onAnswerSelect with:", answer);
    onAnswerSelect?.(answer);
  };

  const getButtonVariant = (value: boolean) => {
    if (disabled && showFeedback && correctAnswer !== undefined) {
      if (value === correctAnswer) {
        return "default";
      } else if (currentSelected === value && value !== correctAnswer) {
        return "destructive";
      }
      return "secondary";
    }

    if (currentSelected === value) {
      return "default";
    }

    return "outline";
  };

  const getButtonClassName = (value: boolean) => {
    const baseStyle = "h-24 text-lg font-semibold relative overflow-hidden";

    if (disabled && showFeedback && correctAnswer !== undefined) {
      if (value === correctAnswer) {
        return cn(
          baseStyle,
          "bg-green-500 hover:bg-green-600 text-white border-green-500"
        );
      } else if (currentSelected === value && value !== correctAnswer) {
        return cn(baseStyle, "bg-destructive hover:bg-destructive/90");
      }
      return cn(baseStyle, "opacity-60");
    }

    return baseStyle;
  };

  const getFeedbackIcon = (value: boolean) => {
    if (!showFeedback || !disabled || correctAnswer === undefined) return null;

    if (value === correctAnswer) {
      return <CheckCircle className="w-5 h-5 absolute top-2 right-2" />;
    } else if (currentSelected === value && value !== correctAnswer) {
      return <XCircle className="w-5 h-5 absolute top-2 right-2" />;
    }

    return null;
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <Button
        variant={getButtonVariant(true)}
        className={getButtonClassName(true)}
        onClick={() => handleAnswerSelect(true)}
        disabled={disabled}
      >
        {getFeedbackIcon(true)}
        <div className="flex flex-col items-center space-y-3">
          <Check className="w-8 h-8" />
          <div className="font-bold text-xl">TRUE</div>
          {showFeedback && disabled && correctAnswer === true && (
            <div className="text-sm opacity-90 font-medium">Correct!</div>
          )}
          {showFeedback &&
            disabled &&
            currentSelected === true &&
            correctAnswer === false && (
              <div className="text-sm opacity-90 font-medium">Incorrect</div>
            )}
        </div>
      </Button>

      <Button
        variant={getButtonVariant(false)}
        className={getButtonClassName(false)}
        onClick={() => handleAnswerSelect(false)}
        disabled={disabled}
      >
        {getFeedbackIcon(false)}
        <div className="flex flex-col items-center space-y-3">
          <X className="w-8 h-8" />
          <div className="font-bold text-xl">FALSE</div>
          {showFeedback && disabled && correctAnswer === false && (
            <div className="text-sm opacity-90 font-medium">Correct!</div>
          )}
          {showFeedback &&
            disabled &&
            currentSelected === false &&
            correctAnswer === true && (
              <div className="text-sm opacity-90 font-medium">Incorrect</div>
            )}
        </div>
      </Button>
    </div>
  );
}
