"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/source";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { Suggestion } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { DEFAULT_MODEL, TEST_PROMPTS, SUPPORTED_MODELS } from "@/ai/constants";
import { GlobeIcon } from "lucide-react";
import { createParser, useQueryState } from "nuqs";
import { toast } from "sonner";
import { mutate } from "swr";
import { useChat } from "@ai-sdk/react";
import { useDataStateMapper } from "./state";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { useState, useEffect } from "react";

interface Props {
  className: string;
  modelId?: string;
}

const models = SUPPORTED_MODELS.map((id) => ({
  name: id.split("/")[1]?.toUpperCase() || id,
  value: id,
}));

export function Chat({ className }: Props) {
  const [modelId, setModelId] = useQueryState("modelId", modelParser);
  const [input, setInput] = useLocalStorageValue("prompt-input");
  const [webSearch, setWebSearch] = useState(false);
  const mapDataToState = useDataStateMapper();

  const { messages, sendMessage, status } = useChat({
    onToolCall: () => mutate("/api/auth/info"),
    onError: (error) => {
      toast.error(`Communication error with the AI: ${error.message}`);
      console.error("Error sending message:", error);
    },
  });

  // Process data parts to update state
  useEffect(() => {
    messages.forEach((message) => {
      message.parts.forEach((part: any) => {
        if (part.type?.startsWith("data-")) {
          mapDataToState(part);
        }
      });
    });
  }, [messages, mapDataToState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
          body: {
            modelId: modelId,
            webSearch: webSearch,
          },
        }
      );
      setInput("");
    }
  };

  const validateAndSubmitMessage = (text: string) => {
    if (text.trim()) {
      sendMessage({ text }, { body: { modelId } });
      setInput("");
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground">
              <p className="flex items-center font-semibold mb-4">
                Click and try one of these prompts:
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {TEST_PROMPTS.map((prompt, idx) => (
                  <Suggestion
                    key={idx}
                    suggestion={prompt}
                    onClick={() => validateAndSubmitMessage(prompt)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              <Conversation className="absolute inset-0 -mx-6">
                <ConversationContent className="px-6">
                  {messages.map((message) => (
                    <div key={message.id}>
                      {message.parts.map((part: any, i: number) => {
                        switch (part.type) {
                          case "text":
                            return (
                              <Message
                                from={message.role}
                                key={`${message.id}-${i}`}
                              >
                                <MessageContent>
                                  <Response>{part.text}</Response>
                                </MessageContent>
                              </Message>
                            );
                          case "reasoning":
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={status === "streaming"}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          case "source-url":
                            return (
                              <Sources key={`${message.id}-${i}`}>
                                <SourcesTrigger count={1} />
                                <SourcesContent>
                                  <Source href={part.url} title={part.url} />
                                </SourcesContent>
                              </Sources>
                            );
                          case "data-create-sandbox":
                          case "data-generating-files":
                          case "data-get-sandbox-url":
                          case "data-run-command":
                          case "data-wait-command":
                            const toolName = part.type.replace("data-", "");
                            const toolState =
                              part.data?.status === "done"
                                ? "output-available"
                                : part.data?.status === "loading"
                                ? "input-available"
                                : "input-streaming";
                            return (
                              <Tool
                                key={`${message.id}-${i}`}
                                defaultOpen={toolState === "output-available"}
                              >
                                <ToolHeader
                                  type={toolName}
                                  state={toolState as any}
                                />
                                <ToolContent>
                                  <ToolInput input={part.data} />
                                  <ToolOutput
                                    output={
                                      part.data?.status === "done"
                                        ? JSON.stringify(part.data, null, 2)
                                        : null
                                    }
                                    errorText={part.data?.error}
                                  />
                                </ToolContent>
                              </Tool>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  ))}
                  {status === "submitted" && <Loader />}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>
          )}

          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="Type your message..."
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputButton
                  variant={webSearch ? "default" : "ghost"}
                  onClick={() => setWebSearch(!webSearch)}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <PromptInputModelSelect
                  onValueChange={(value) => {
                    setModelId(value);
                  }}
                  value={modelId}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {models.map((model) => (
                      <PromptInputModelSelectItem
                        key={model.value}
                        value={model.value}
                      >
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={!input} status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </CardContent>
    </Card>
  );
}

const modelParser = createParser({
  parse: (value) => (SUPPORTED_MODELS.includes(value) ? value : DEFAULT_MODEL),
  serialize: (value) => value,
}).withDefault(DEFAULT_MODEL);
