import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';

import { Community } from '../../../shared/models/Community';
import { Mission } from '../../../shared/models/Mission';
import { Permission } from '../../../shared/models/Permission';
import { User } from '../../../shared/models/User';
import SteamService from '../../../shared/services/SteamService';
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

        let user = await User.findOne({ where: { steamId: steamId }, include: [{ all: true }] });
        if (_.isNil(user)) {
            log.debug({ function: 'verifySteamLogin', steamId }, 'User not found in database, retrieving nickname from Steam API before generating JWT');

            const steamNickname = await SteamService.getSteamNickname(steamId);

            user = await new User({
                steamId: steamId,
                nickname: steamNickname
            }).save();
        } else {
            log.debug({ function: 'verifySteamLogin', steamId, user: user.toPublicObject() }, 'User already exists in database, generating JWT');
        }

        const token = await user.generateJWT();

        return { token };
    })());
}

export function getAccountDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.sub;

        log.debug({ userUid }, 'Retrieving account details for user');

        // Deliberately load all missions (even already ended ones) on account page
        const user = await User.findById(userUid, {
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: Mission,
                    as: 'missions',
                    include: [
                        {
                            model: User,
                            as: 'creator'
                        }
                    ]
                },
                {
                    model: Permission,
                    as: 'permissions'
                }
            ]
        });
        if (_.isNil(user)) {
            log.warn({ userUid }, 'Did not find user profile for logged in user, returning 401 to force re-authentication');
            throw Boom.unauthorized();
        }

        if (_.isNil(user.missions)) {
            log.debug({ userUid }, 'Loading user missions for account details');
            user.missions = await user.getMissions();
        }
        if (_.isNil(user.permissions)) {
            log.debug({ userUid }, 'Loading user permissions for account details');
            user.permissions = await user.getPermissions();
        }

        log.debug(
            { userUid, communityUid: user.communityUid, missionCount: user.missions.length, permissionCount: user.permissions.length },
            'Successfully retrieved account details for user');

        const publicUser = await user.toDetailedPublicObject();

        return { user: _.defaults(publicUser, { permissions: _.map(user.permissions, 'permission') }) };
    })());
}
