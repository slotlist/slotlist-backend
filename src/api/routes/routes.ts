import { auth as authV1 } from './v1/auth';
import { community as communityV1 } from './v1/community';

/**
 * Bundles all defined routes into a single routes array
 */
export const routes = (<any[]>[]).concat(
    authV1,
    communityV1
);
