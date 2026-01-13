import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {exec, spawn} from "child_process";
import {promisify} from "util";
import {z} from "zod";

const execAsync = promisify(exec);

const ALLOWED_COMMANDS = [
	"git branch --show-current; git diff main...HEAD --stat; git diff main...HEAD",
	"git diff --stat main...HEAD",
	"git diff -U99999 main...HEAD -- . ':!tsconfig*'",
	"npm run build",
	"npm run test",
	"npm run lint",
	"npm run start",
  "npm install && npm run build"
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

const INPUT_SCHEMA = {
	command: z.string().describe("The command to run. This will be passed directly into the IDE shell."),
	waitForCompletion: z.boolean().optional().describe("Whether to wait for the command to complete before returning. Default is true. Set to false to run the command in the background."),
};

const server = new McpServer({
	name: "safe-shell",
	version: "1.0.0",
});

const allowedCommandsList = ALLOWED_COMMANDS.map((c) => `  - ${c}`).join("\n");

server.registerTool(
	"run_terminal_command_approved",
	{
		description: `${SHELL_DESCRIPTION} Only runs whitelisted commands - if the command is not allowed, returns an error. Allowed commands:\n${allowedCommandsList}`,
		inputSchema: INPUT_SCHEMA,
	},
	async ({command, waitForCompletion}) => {
		const wait = waitForCompletion ?? true;
		if (!ALLOWED_COMMANDS.includes(command)) {
			const allowedList = ALLOWED_COMMANDS.map((c) => `  - ${c}`).join("\n");
			return {
				content: [{
					text: `Command not in whitelist: ${command}\n\nAllowed commands:\n${allowedList}`,
					type: "text",
				}],
				isError: true,
			};
		}

		const output = await runCommand(command, wait);
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
