// tslint:disable-next-line:no-import-side-effect
import './polyfills';

import * as _ from 'lodash';

import { API } from './api/API';
import Storage from './shared/services/Storage';
import { log } from './shared/util/log';

/**
 * Initialise logger and start new API server
 */
if (!module.parent) {
    const api = new API();
    api.start().then(async () => {
        if (_.isString(process.env.DEFAULT_ADMIN_STEAMID) && !_.isEmpty(process.env.DEFAULT_ADMIN_STEAMID)
            && _.isString(process.env.DEFAULT_ADMIN_NICKNAME) && !_.isEmpty(process.env.DEFAULT_ADMIN_NICKNAME)) {

            log.info({ steamId: process.env.DEFAULT_ADMIN_STEAMID, nickname: process.env.DEFAULT_ADMIN_NICKNAME }, 'Creating default admin user with provided details');

            let user = await Storage.models.User.findOne({
                where: {
                    steamId: process.env.DEFAULT_ADMIN_STEAMID
                }
            });
            if (!_.isNil(user)) {
                log.info({ userUid: user.uid, steamId: user.steamId, nickname: user.nickname }, 'Default admin user with provided steamId already exists, skipping user creation');
            } else {
                user = await Storage.models.User.create({
                    steamId: process.env.DEFAULT_ADMIN_STEAMID,
                    nickname: process.env.DEFAULT_ADMIN_NICKNAME
                });

                log.info(
                    { userUid: user.uid, steamId: user.steamId, nickname: user.nickname },
                    'Successfully created default admin user with provided details, adding top wildcard permission');

                const permission = await user.createPermission({ permission: '*' });

                log.info(
                    { userUid: user.uid, steamId: user.steamId, nickname: user.nickname, permissionUid: (<any>permission).uid },
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
