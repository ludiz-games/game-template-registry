"use client";

import type { Command, CommandLog } from "./types";
import { CommandLogs } from "./command-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SquareChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  commands: Command[];
  onLog: (data: { sandboxId: string; cmdId: string; log: CommandLog }) => void;
  onCompleted: (data: Command) => void;
}

export function CommandsLogs(props: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.commands]);

  return (
    <Card className={props.className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <SquareChevronRight className="mr-2 w-4" />
          <span>Sandbox Remote Output</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {props.commands.map((command) => (
                <CommandLogs
                  key={command.cmdId}
                  command={command}
                  onLog={props.onLog}
                  onCompleted={props.onCompleted}
                />
              ))}
            </div>
            <div ref={bottomRef} />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
