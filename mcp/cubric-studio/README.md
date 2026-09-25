# Cubric Studio for Claude Desktop

Lets Claude drive the Cubric Studio desktop app on your computer: list and open your projects,
pick a model, and generate images and video that land in your gallery. Cubric Studio must be
open while you use it.

The extension is a small bridge. Claude Desktop extensions speak stdio, and Cubric Studio serves
MCP over HTTP at `http://127.0.0.1:<port>/mcp` (port 3000 unless you changed it), so
`server/index.js` passes each message from one to the other.

## Privacy Policy

Full policy: https://cubric.studio/privacy/

This extension connects Claude Desktop to the Cubric Studio app on your own computer, and to nothing else. It only talks to the app's local address (`http://127.0.0.1:<port>/mcp`). It sends nothing to Mad Pony Interactive and collects no analytics or telemetry.

What Claude reads through these tools, such as project names, file paths, model lists, prompts and results, becomes part of your Claude conversation, so Anthropic handles it under Anthropic's privacy policy.

A generation sends data off your computer only when you chose that in Cubric Studio: a cloud model sends your prompt and reference images to DeepInfra on your own DeepInfra key, and a remote GPU runs on your own RunPod account. Local generation stays on your computer.
