// tslint:disable-next-line:no-import-side-effect
import './polyfills';

import { API } from './api/API';

/**
 * Initialise logger and start new API server
 */
if (!module.parent) {
    const api = new API();
    api.start();

    process.on('SIGINT', async () => {
        await api.stop();
        process.exit(0);
    });
    process.on('SIGQUIT', async () => {
        await api.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await api.stop();
        process.exit(0);
    });
}
