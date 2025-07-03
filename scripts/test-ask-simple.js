#!/usr/bin/env node

/**
 * Simple test for the ask command
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('🧪 Testing Claude Desktop MCP Ask Command...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
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

// Handle server output
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('📥 Response:', JSON.stringify(response, null, 2));

    // Check if we got a response
    if (response.result?.content?.[0]?.text) {
      const text = response.result.content[0].text;
      if (text.includes('4') || text.includes('four')) {
        console.log('\n✅ SUCCESS! Got response containing the answer!');
      } else {
        console.log('\n⚠️  Got response but no answer found');
      }
    }
  } catch (e) {
    // Not JSON, probably a log message
    if (!line.includes('[DEBUG]') && !line.includes('[INFO]')) {
      console.log('📝 Log:', line);
    }
  }
});

// Handle server errors
server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!msg.includes('[DEBUG]') && !msg.includes('[INFO]')) {
    console.error('❌ Error:', msg);
  }
});

// Run test
async function runTest() {
  console.log('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📋 Testing ask command...');
  sendRequest('tools/call', {
    name: 'ask',
    arguments: {
      prompt: 'What is 2 + 2?',
      timeout: 30,  // 30 seconds
      pollingInterval: 2
    }
  });

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 35000));

  console.log('\n✅ Test completed. Shutting down server...');
  server.kill();
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted. Cleaning up...');
  server.kill();
  process.exit(0);
});

// Start test
runTest().catch(console.error);
