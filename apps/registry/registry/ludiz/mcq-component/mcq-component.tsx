"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

interface MCQChoice {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface MCQComponentProps {
  choices: MCQChoice[];
  selectedChoice?: string | null;
  onChoiceSelect?: (choiceId: string) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function MCQComponent({
  choices,
  selectedChoice = null,
  onChoiceSelect,
  showFeedback = false,
  disabled = false,
}: MCQComponentProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const currentSelected =
    selectedChoice !== undefined ? selectedChoice : internalSelected;

  const handleValueChange = (value: string) => {
    if (disabled) return;
    if (selectedChoice === undefined) {
      setInternalSelected(value);
    }
    onChoiceSelect?.(value);
  };

  const getChoiceClassName = (choice: MCQChoice) => {
    const baseStyle =
      "flex items-center space-x-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-accent/50";

    if (disabled && showFeedback) {
      if (choice.isCorrect) {
        return cn(
          baseStyle,
          "border-green-500 bg-green-50 dark:bg-green-900/20 cursor-default"
        );
      } else if (currentSelected === choice.id && !choice.isCorrect) {
        return cn(
          baseStyle,
          "border-destructive bg-destructive/10 cursor-default"
        );
      }
      return cn(baseStyle, "opacity-60 cursor-default hover:bg-transparent");
    }

    if (currentSelected === choice.id) {
      return cn(baseStyle, "border-primary bg-primary/5");
    }

    return cn(baseStyle, "border-gray-200 dark:border-gray-800");
  };

  return (
    <RadioGroup
      value={currentSelected || ""}
      onValueChange={handleValueChange}
      disabled={disabled}
      className="space-y-3"
    >
      {choices.map((choice, index) => (
        <div key={choice.id} className={getChoiceClassName(choice)}>
          <RadioGroupItem
            value={choice.id}
            id={choice.id}
            className="mt-0.5"
            disabled={disabled}
          />
          <Label
            htmlFor={choice.id}
            className="flex-1 cursor-pointer font-medium leading-relaxed"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors",
                    currentSelected === choice.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{choice.text}</span>
              </div>
              {showFeedback && disabled && (
                <div className="flex-shrink-0">
                  {choice.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : currentSelected === choice.id ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : null}
                </div>
              )}
            </div>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
