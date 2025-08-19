import type { UIMessageStreamWriter, UIMessage } from "ai";
import type { DataPart } from "../messages/data-parts";
import { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import description from "./create-sandbox.md";
import { z } from "zod";

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}

export const createSandbox = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      timeout: z
        .number()
        .optional()
        .describe(
          "Maximum time in milliseconds the Vercel Sandbox will remain active before automatically shutting down. Set this to 2700000ms (45 minutes). The sandbox will terminate all running processes when this timeout is reached."
        ),
      ports: z
        .array(z.number())
        .max(2)
        .optional()
        .describe(
          "Array of network ports to expose and make accessible from outside the Vercel Sandbox. These ports allow web servers, APIs, or other services running inside the Vercel Sandbox to be reached externally. Common ports include 3000 (Next.js), 8000 (Python servers), 5000 (Flask), etc."
        ),
    }),
    execute: async ({ ports }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-create-sandbox",
        data: { status: "loading" },
      });

      const sandbox = await Sandbox.create({
        source: {
          url: "https://github.com/jide/game-app-template.git",
          type: "git",
        },
        timeout: 270000,
        ports,
      });

      writer.write({
        id: toolCallId,
        type: "data-create-sandbox",
        data: { sandboxId: sandbox.sandboxId, status: "done" },
      });

      // Discover files that were cloned from the Git repository
      const lsResult = await sandbox.runCommand({
        cmd: "find",
        args: [".", "-type", "f", "!", "-path", "./.git/*"],
      });

      const stdout = await lsResult.stdout();
      const paths = stdout
        .split("\n")
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^\.\//, ""));

      // Emit the file paths for UI file tree preview - start with uploaded status
      writer.write({
        id: toolCallId,
        type: "data-generating-files",
        data: { paths, status: "uploaded" },
      });

      // Final completion signal for file generation
      writer.write({
        id: toolCallId,
        type: "data-generating-files",
        data: { paths, status: "done" },
      });

      // Fetch pre-processed repository contents from GitDocs
      let repositoryContents = "";
      try {
        const response = await fetch(
          "https://gitdocs1.s3.amazonaws.com/digests/jide-game-app-template.git/81636a59-6a53-45b4-8d1b-ace2a300afcb.txt"
        );
        if (response.ok) {
          repositoryContents = await response.text();
        } else {
          console.warn("Failed to fetch repository contents from GitDocs");
        }
      } catch (error) {
        console.warn("Error fetching repository contents:", error);
      }

      return `Sandbox created with ID: ${
        sandbox.sandboxId
      }. Template files from Git repository have been loaded.

**Repository Structure:**
${paths.map((path) => `- ${path}`).join("\n")}

**Complete Repository Contents:**
${repositoryContents}

You can now run commands and access services on the exposed ports. All template files are available and their contents are shown above.`;
    },
  });
