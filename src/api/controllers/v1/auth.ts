import * as Hapi from 'hapi';
import * as _ from 'lodash';

import SteamService from '../../../shared/services/SteamService';
import { Users } from '../../../shared/services/Storage';
import { log as logger } from '../../../shared/util/log';
const log = logger.child({ route: 'auth', routeVersion: 'v1' });

/**
 * Handlers for V1 of auth endpoints
 */

export function getSteamLoginRedirectURL(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = await SteamService.getLoginRedirectURL();

        return {
            url
        };
    })());
}

export function verifySteamLogin(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = request.payload.url;

        const steamId = await SteamService.verifySteamLogin(url);

        let user = await Users.findOne({ where: { steamId: steamId }, include: [{ all: true }] });
        if (_.isNil(user)) {
            log.debug({ function: 'verifySteamLogin', steamId }, 'User not found in database, retrieving nickname from Steam API before generating JWT');

            const steamNickname = await SteamService.getSteamNickname(steamId);

            user = await Users.create({
                steamId: steamId,
                nickname: steamNickname
            });
        } else {
            log.debug({ function: 'verifySteamLogin', steamId, user: user.toPublicObject() }, 'User already exists in database, generating JWT');
        }

        const token = await user.generateJWT();

        return { token };
    })());
}
