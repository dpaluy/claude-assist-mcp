import { z } from 'zod';

// Tool schemas using Zod for validation
export const AskToolSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  conversationId: z.string().optional(),
  timeout: z.number().int().min(1).max(300).optional().describe('Timeout in seconds'),
  pollingInterval: z.number().min(0.5).max(10).optional().describe('Polling interval in seconds'),
});

export const GetConversationsSchema = z.object({});

// Type exports
export type AskToolArgs = z.infer<typeof AskToolSchema>;
export type GetConversationsArgs = z.infer<typeof GetConversationsSchema>;

// Convert Zod schema to JSON Schema format for MCP
function zodToJsonSchema(schema: z.ZodType<any>): any {
  // Simple conversion - in production, use zod-to-json-schema library
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType<any>;
      const isOptional = fieldSchema.isOptional();

      if (!isOptional) {
        required.push(key);
      }

      properties[key] = getFieldSchema(fieldSchema);
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  return { type: 'object' };
}

function getFieldSchema(schema: z.ZodType<any>): any {
  // Handle optional schemas
  if (schema instanceof z.ZodOptional) {
    return getFieldSchema(schema._def.innerType);
  }

  // Handle string schemas
  if (schema instanceof z.ZodString) {
    const result: any = { type: 'string' };

    // Add description if available
    if (schema.description) {
      result.description = schema.description;
    }

    return result;
  }

  // Handle number schemas
  if (schema instanceof z.ZodNumber) {
    const result: any = { type: 'number' };

    // Add description if available
    if (schema.description) {
      result.description = schema.description;
    }

    return result;
  }

  // Default case
  return { type: 'string' };
}

// Tool definitions
export const TOOLS = {
  ASK: {
    name: 'ask',
    description: 'Send a prompt to Claude Desktop and get a response',
    inputSchema: zodToJsonSchema(AskToolSchema),
    zodSchema: AskToolSchema,
  },
  GET_CONVERSATIONS: {
    name: 'get_conversations',
    description: 'Get a list of available conversations in Claude Desktop',
    inputSchema: zodToJsonSchema(GetConversationsSchema),
    zodSchema: GetConversationsSchema,
  },
} as const;

// Tool names type
export type ToolName = keyof typeof TOOLS;

// Get all tools for MCP
export function getAllTools() {
  return Object.values(TOOLS).map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

// Get tool by name
export function getToolByName(name: string) {
  const tool = Object.values(TOOLS).find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool;
}
