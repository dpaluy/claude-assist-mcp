#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const VERSION = packageJson.version;

// Define the tools
const ASK_TOOL = {
  name: 'ask',
  description: 'Send a prompt to Claude Desktop and get a response',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The prompt to send to Claude Desktop',
      },
      conversationId: {
        type: 'string',
        description: 'Optional conversation ID to continue a specific conversation',
      },
      timeout: {
        type: 'number',
        description: 'Response timeout in seconds (default: 30, max: 300)',
      },
      pollingInterval: {
        type: 'number',
        description: 'Polling interval in seconds (default: 1.5, min: 0.5, max: 10)',
      },
    },
    required: ['prompt'],
  },
};

const GET_CONVERSATIONS_TOOL = {
  name: 'get_conversations',
  description: 'Get a list of available conversations in Claude Desktop',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const server = new Server(
  {
    name: 'mcp-claude-desktop',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const PollingOptionsSchema = z.object({
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
  interval: z.number().default(1500).describe('Polling interval in milliseconds'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [ASK_TOOL, GET_CONVERSATIONS_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'ask') {
      const { askClaude } = await import('./tools/claude-desktop.js');
      const validatedArgs = z.object({
        prompt: z.string(),
        conversationId: z.string().optional(),
        timeout: z.number().min(1).max(300).optional(),
        pollingInterval: z.number().min(0.5).max(10).optional(),
      }).parse(args);

      // Convert seconds to milliseconds for internal use
      const pollingOptions = {
        timeout: (validatedArgs.timeout || 30) * 1000,
        interval: (validatedArgs.pollingInterval || 1.5) * 1000,
      };
      
      const result = await askClaude(
        validatedArgs.prompt,
        validatedArgs.conversationId,
        pollingOptions
      );

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    }

    if (name === 'get_conversations') {
      const { getConversations } = await import('./tools/claude-desktop.js');
      const result = await getConversations();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Claude Desktop MCP Server running on stdio');
