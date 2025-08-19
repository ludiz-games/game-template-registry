import { TabContent, TabGroup, TabItem } from "@/components/tabs";
import { Suspense } from "react";
import { Chat } from "./chat";
import { FileExplorer } from "./file-explorer";
import { Header } from "./header";
import { Logs } from "./logs";
import { Preview } from "./preview";

export default async function Page() {
  return (
    <>
      <div className="flex flex-col h-screen max-h-screen p-4 space-x-4 space-y-4">
        <Header className="px-4 py-2 border-b" />
        <Suspense fallback={<div>Loading...</div>}>
          <ul className="flex space-x-5 lg:hidden font-mono text-sm tracking-tight mt-1.5 px-1">
            <TabItem tabId="chat">Chat</TabItem>
            <TabItem tabId="preview">Preview</TabItem>
            <TabItem tabId="file-explorer">File Explorer</TabItem>
            <TabItem tabId="logs">Logs</TabItem>
          </ul>
          <div className="flex-1 flex w-full min-h-0 lg:space-x-4">
            <TabContent
              className="h-full flex-col lg:flex w-full lg:w-1/2 min-h-0"
              tabId="chat"
            >
              <Chat className="flex-1 overflow-hidden" />
            </TabContent>
            <TabGroup tabId="chat">
              <TabContent className="lg:h-1/3" tabId="preview">
                <Preview className="flex-1 overflow-hidden" />
              </TabContent>
              <TabContent className="lg:h-1/3" tabId="file-explorer">
                <FileExplorer className="flex-1 overflow-hidden" />
              </TabContent>
              <TabContent className="lg:h-1/3" tabId="logs">
                <Logs className="flex-1 overflow-hidden" />
              </TabContent>
            </TabGroup>
          </div>
        </Suspense>
      </div>
    </>
  );
}
