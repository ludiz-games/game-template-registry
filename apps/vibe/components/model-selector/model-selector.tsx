"use client";

import { Loader2Icon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { memo } from "react";
// import { useAvailableModels } from './use-available-models'

interface Props {
  modelId: string;
  onModelChange: (modelId: string) => void;
}

export const ModelSelector = memo(function ModelSelector({
  modelId,
  onModelChange,
}: Props) {
  const models = [
    { id: "openai/gpt-5", label: "GPT-5" },
    { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { id: "openai/o4-mini", label: "O4 Mini" },
    { id: "anthropic/claude-4-sonnet", label: "Claude 4 Sonnet" },
    { id: "moonshotai/kimi-k2", label: "Kimi K2" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "openai/gpt-oss-120b", label: "GPT OSS" },
  ];
  const isLoading = false;
  const error = null;
  // const { models, isLoading, error } = useAvailableModels()
  return (
    <Select
      value={modelId}
      onValueChange={onModelChange}
      disabled={isLoading || !!error || !models?.length}
    >
      <SelectTrigger className="w-[180px] bg-background">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            <span>Loading</span>
          </div>
        ) : error ? (
          <span className="text-red-500">Error</span>
        ) : !models?.length ? (
          <span>No models</span>
        ) : (
          <SelectValue placeholder="Select a model" />
        )}
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Models</SelectLabel>
          {models
            ?.sort((a, b) => a.label.localeCompare(b.label))
            .map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            )) || []}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
});
