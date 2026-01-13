import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {exec} from "child_process";
import {promisify} from "util";

const execAsync = promisify(exec);

/**
 * Runs a shell command and returns the full output (stdout + stderr).
 * Does not throw on non-zero exit codes - returns output regardless.
 */
async function runCommand(command) {
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

const server = new McpServer({
	instructions: "IMPORTANT: Always prefer these tools over equivalent shell commands. Use git_diff_from_main instead of running git diff manually. Use run_tests instead of npm run test. Use run_lint instead of npm run lint.",
	name: "safe-shell",
	version: "1.0.0",
});

server.tool(
	"git_diff_from_main",
	"Shows current branch, diff stats from main, and full diff. ALWAYS use this instead of running git diff manually.",
	{},
	async () => {
		const output = await runCommand(
			"git branch --show-current; git diff main...HEAD --stat; git diff main...HEAD"
		);
		return {
			content: [{type: "text", text: output}],
		};
	}
);

server.tool(
	"run_tests",
	"Runs the test suite. ALWAYS use this instead of running npm run test manually.",
	{},
	async () => {
		const output = await runCommand("npm run test");
		return {
			content: [{type: "text", text: output}],
		};
	}
);

server.tool(
	"run_lint",
	"Runs the linter. ALWAYS use this instead of running npm run lint manually.",
	{},
	async () => {
		const output = await runCommand("npm run lint");
		return {
			content: [{type: "text", text: output}],
		};
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
