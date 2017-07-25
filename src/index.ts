// tslint:disable-next-line:no-import-side-effect
import './polyfills';

import * as _ from 'lodash';
import * as pjson from 'pjson';
import * as Raven from 'raven';

import { API } from './api/API';
import { createAssociations } from './shared/models/associations';
import { User } from './shared/models/User';
import { log } from './shared/util/log';

/**
 * Initialise logger and start new API server
 */
// tslint:disable-next-line:strict-boolean-expressions
if (!module.parent) {
    // Create sequelize associations as the very first step in the application.
    // Required for circular dependencies to work properly
    createAssociations();

    if (_.isString(process.env.SENTRY_DSN) && !_.isEmpty(process.env.SENTRY_DSN)) {
        (<any>Raven).config(process.env.SENTRY_DSN, {
            autoBreadcrumbs: true,
            captureUnhandledRejections: true,
            environment: process.env.NODE_ENV,
            name: 'slotlist-backend',
            parseUser: true,
            release: pjson.version
        }).install();
    }

    const api = new API();
    // tslint:disable-next-line:no-floating-promises
    api.start().then(async () => {
        const adminUid = process.env.DEFAULT_ADMIN_UID || undefined;
        const adminSteamId = process.env.DEFAULT_ADMIN_STEAMID;
        const adminNickname = process.env.DEFAULT_ADMIN_NICKNAME;
        if (_.isString(adminSteamId) && !_.isEmpty(adminSteamId)
            && _.isString(adminNickname) && !_.isEmpty(adminNickname)) {

            log.info({ steamId: adminSteamId, nickname: adminNickname }, 'Creating default admin user with provided details');

            const steamId: string = adminSteamId;
            let user = await User.findOne({
                where: {
                    steamId: steamId
                }
            });
            if (!_.isNil(user)) {
                log.info({ userUid: user.uid, steamId: user.steamId, nickname: user.nickname }, 'Default admin user with provided steamId already exists, skipping user creation');
            } else {
                user = await new User({
                    uid: adminUid,
                    steamId: adminSteamId,
                    nickname: adminNickname
                }).save();

                log.info(
                    { userUid: user.uid, steamId: user.steamId, nickname: user.nickname },
                    'Successfully created default admin user with provided details, adding top wildcard permission');

                const permission = await user.createPermission({ permission: '*' });

                log.info(
                    { userUid: user.uid, steamId: user.steamId, nickname: user.nickname, permissionUid: permission.uid },
                    'Successfully added top wildcard permission to default admin user');
            }
        }

        log.info('Startup completed');
    });

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
