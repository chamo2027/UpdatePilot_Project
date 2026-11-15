UpdatePilot Windows Agent

Requirements: Windows 10 or 11, WinGet, Node.js 22, and a running local UpdatePilot server.

1. Extract the package to a private folder.
2. Copy agent.env.example to .env.local.
3. Set AGENT_PAIRING_CODE in .env.local to the server's setup code.
4. In PowerShell, change into this folder and run:
   node updatepilot-agent.cjs
5. Once pairing succeeds, remove the pairing code from .env.local. The agent saves
   its device credential in .agent_state.json. Keep that file private.

Use node updatepilot-agent.cjs --once for an inventory-only scan.
Keep the agent running to receive approved jobs and scheduled scans.
