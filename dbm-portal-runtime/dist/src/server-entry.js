import { createPortalRuntimeLocalProofServer } from './local-proof-server';
function parseArgs(argv) {
    const args = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current.startsWith('--')) {
            continue;
        }
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            throw new Error(`Missing value for argument '${current}'.`);
        }
        args.set(current.slice(2), next);
        index += 1;
    }
    const portValue = args.get('port');
    return {
        repoRoot: args.get('repo-root'),
        host: args.get('host'),
        port: portValue ? Number.parseInt(portValue, 10) : undefined
    };
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const handle = await createPortalRuntimeLocalProofServer({
        repoRoot: args.repoRoot,
        host: args.host,
        port: args.port
    });
    process.stdout.write(`DBM local proof host listening at ${handle.baseUrl}\n`);
    process.stdout.write(`Entry route: ${handle.baseUrl}/approval-request\n`);
    process.stdout.write(`Status route: ${handle.baseUrl}/approval-request/status\n`);
    const shutdown = async () => {
        await handle.close();
        process.exit(0);
    };
    process.on('SIGINT', () => {
        void shutdown();
    });
    process.on('SIGTERM', () => {
        void shutdown();
    });
}
main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
});
