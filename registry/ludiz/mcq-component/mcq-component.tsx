"use client";

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

  // Use controlled or uncontrolled pattern
  const currentSelected =
    selectedChoice !== undefined ? selectedChoice : internalSelected;

  const handleChoiceSelect = (choiceId: string) => {
    if (disabled) return;

    if (selectedChoice === undefined) {
      setInternalSelected(choiceId);
    }
    onChoiceSelect?.(choiceId);
  };

  const getChoiceStyle = (choice: MCQChoice) => {
    const baseStyle =
      "p-4 border rounded-lg cursor-pointer transition-all duration-200 text-left";

    if (disabled) {
      if (showFeedback) {
        if (choice.isCorrect) {
          return `${baseStyle} border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 cursor-default`;
        } else if (currentSelected === choice.id && !choice.isCorrect) {
          return `${baseStyle} border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 cursor-default`;
        }
      }
      return `${baseStyle} border-gray-200 dark:border-gray-700 opacity-60 cursor-default`;
    }

    return `${baseStyle} ${
      currentSelected === choice.id
        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
    }`;
  };

  return (
    <div className="space-y-3">
      {choices.map((choice, index) => (
        <div
          key={choice.id}
          className={getChoiceStyle(choice)}
          onClick={() => handleChoiceSelect(choice.id)}
        >
          <div className="flex items-start space-x-3">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                currentSelected === choice.id
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {String.fromCharCode(65 + index)}
            </div>
            <div className="flex-1">{choice.text}</div>
            {showFeedback && disabled && choice.isCorrect && (
              <div className="text-green-600 dark:text-green-400">✓</div>
            )}
            {showFeedback &&
              disabled &&
              currentSelected === choice.id &&
              !choice.isCorrect && (
                <div className="text-red-600 dark:text-red-400">✗</div>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
