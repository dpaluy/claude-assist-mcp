#!/usr/bin/env node

/**
 * Test script for Claude Desktop MCP
 * This script tests the MCP server directly without Claude Desktop
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('🧪 Testing Claude Desktop MCP Server...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, LOG_LEVEL: '3' } // Debug level
});

const rl = createInterface({
  input: server.stdout,
  output: process.stdout,
  terminal: false
});

// Helper to send JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  };
  
  const message = JSON.stringify(request);
  console.log(`📤 Sending: ${method}`);
  server.stdin.write(message + '\n');
}

// Helper to delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Handle server output
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('📥 Response:', JSON.stringify(response, null, 2));
  } catch (e) {
    // Not JSON, probably a log message
    console.log('📝 Log:', line);
  }
});

// Handle server errors
server.stderr.on('data', (data) => {
  console.error('❌ Error:', data.toString());
});

// Run tests
async function runTests() {
  console.log('\n1️⃣ Testing server initialization...');
  await delay(2000); // Wait for server to start
  
  console.log('\n2️⃣ Testing tools/list...');
  sendRequest('tools/list');
  await delay(1000);
  
  console.log('\n3️⃣ Testing claude_desktop get_conversations...');
  sendRequest('tools/call', {
    name: 'claude_desktop',
    arguments: {
      operation: 'get_conversations'
    }
  });
  await delay(2000);
  
  console.log('\n4️⃣ Testing claude_desktop ask (simple prompt)...');
  sendRequest('tools/call', {
    name: 'claude_desktop',
    arguments: {
      operation: 'ask',
      prompt: 'What is 2 + 2?',
      pollingOptions: {
        timeout: 10000,
        interval: 1000
      }
    }
  });
  await delay(12000);
  
  console.log('\n✅ Tests completed. Shutting down server...');
  server.kill();
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted. Cleaning up...');
  server.kill();
  process.exit(0);
});

// Start tests
runTests().catch(console.error);