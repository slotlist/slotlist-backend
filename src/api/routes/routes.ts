import { auth as authV1 } from './v1/auth';
import { community as communityV1 } from './v1/community';
import { mission as missionV1 } from './v1/mission';
import { user as userV1 } from './v1/user';

/**
 * Bundles all defined routes into a single routes array
 */
export const routes = (<any[]>[]).concat(
    authV1,
    communityV1,
    missionV1,
    userV1
);
