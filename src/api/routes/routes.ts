import { auth as authV1 } from './v1/auth';

/**
 * Bundles all defined routes into a single routes array
 */
export const routes = (<any[]>[]).concat(
    authV1
);
