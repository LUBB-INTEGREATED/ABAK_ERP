'use client';

import { Agentation } from 'agentation';

// Visual-feedback toolbar for AI coding agents. Dev-only.
// Posts annotations to the local agentation-mcp server (port 4747),
// which Claude Code reads via the agentation MCP tools.
export function AgentationToolbar() {
  if (process.env.NODE_ENV === 'production') return null;
  return <Agentation endpoint="http://localhost:4747" />;
}
