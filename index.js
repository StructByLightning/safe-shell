import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {exec, spawn} from "child_process";
import {promisify} from "util";

const execAsync = promisify(exec);

const ALLOWED_COMMANDS = [
	"git branch --show-current; git diff main...HEAD --stat; git diff main...HEAD",
	"git diff --stat main...HEAD",
	"git diff -U99999 main...HEAD -- . ':!tsconfig*'",
	"npm run build",
	"npm run test",
	"npm run lint",
	"npm run start",
];

/**
 * Runs a shell command and returns the full output (stdout + stderr).
 * Does not throw on non-zero exit codes - returns output regardless.
 */
async function runCommand(command, waitForCompletion = true) {
	if (!waitForCompletion) {
		const child = spawn(command, {
			detached: true,
			shell: true,
			stdio: "ignore",
		});
		child.unref();
		return `Command started in background with PID ${child.pid}`;
	}

	try {
		const {stdout, stderr} = await execAsync(command, {
			maxBuffer: 50 * 1024 * 1024, //50MB buffer for large diffs
		});
		return stderr ? `${stdout}\n${stderr}` : stdout;
	} catch (error) {
		//exec throws on non-zero exit, but we still want the output
		return error.stdout + (error.stderr ? `\n${error.stderr}` : "");
	}
}

const SHELL_DESCRIPTION = "Run a terminal command in the current directory. The shell is not stateful and will not remember any previous commands. When a command is run in the background ALWAYS suggest using shell commands to stop it; NEVER suggest using Ctrl+C. When suggesting subsequent shell commands ALWAYS format them in shell command blocks. Do NOT perform actions requiring special/admin privileges. IMPORTANT: To edit files, use Edit/MultiEdit tools instead of bash commands (sed, awk, etc). Choose terminal commands and scripts optimized for linux and x64 and shell /bin/bash.";

const SCHEMA = {
	$schema: "http://json-schema.org/draft-07/schema#",
	additionalProperties: false,
	properties: {
		command: {
			description: "The command to run. This will be passed directly into the IDE shell.",
			type: "string",
		},
		waitForCompletion: {
			description: "Whether to wait for the command to complete before returning. Default is true. Set to false to run the command in the background. Set to true to run the command in the foreground and wait to collect the output.",
			type: "boolean",
		},
	},
	required: ["command"],
	type: "object",
};

const server = new McpServer({
	instructions: "IMPORTANT: Always use the shell tool first. Only use shell_slow if shell returns an error saying the command is not whitelisted.",
	name: "safe-shell",
	version: "1.0.0",
});

server.tool(
	"shell",
	`${SHELL_DESCRIPTION} Always use this first. Only runs whitelisted commands - if the command is not allowed, returns an error with the list of allowed commands and instructions to use shell_slow instead.`,
	{inputSchema: SCHEMA},
	async ({command, waitForCompletion = true}) => {
		if (!ALLOWED_COMMANDS.includes(command)) {
			const allowedList = ALLOWED_COMMANDS.map((c) => `  - ${c}`).join("\n");
			return {
				content: [{
					text: `Command not in whitelist: ${command}\n\nAllowed commands:\n${allowedList}\n\nUse shell_slow for other commands (requires user approval).`,
					type: "text",
				}],
				isError: true,
			};
		}

		const output = await runCommand(command, waitForCompletion);
		return {
			content: [{text: output, type: "text"}],
		};
	}
);

server.tool(
	"shell_slow",
	`${SHELL_DESCRIPTION} Runs any command but requires user approval. Never use this before trying shell first.`,
	{inputSchema: SCHEMA},
	async ({command, waitForCompletion = true}) => {
		const output = await runCommand(command, waitForCompletion);
		return {
			content: [{text: output, type: "text"}],
		};
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
