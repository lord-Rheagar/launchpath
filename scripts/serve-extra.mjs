import { getConfig } from '../lib/config.mjs';
import { createApp } from '../server.mjs';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Pass a valid local port.');
process.env.PORT = String(port);
const config = getConfig();
const { server } = await createApp(config);
server.listen(config.port, config.host, () => console.log(`Launchpath: http://${config.host}:${config.port}`));
