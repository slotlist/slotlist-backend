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

        let user = await User.findOne({ where: { steamId: steamId } });
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

export function refreshJWT(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid = request.auth.credentials.user.uid;

        log.debug({ function: 'refreshJWT', userUid }, 'Refreshing JWT for user');

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.warn({ function: 'refreshJWT', userUid }, 'User not found in database anymore while refreshing JWT, aborting');
            throw Boom.notFound('User not found');
        }

        const token = await user.generateJWT();

        log.debug({ function: 'refreshJWT', userUid }, 'Successfully refreshed JWT for user');

        return { token };
    })());
}

export function getAccountDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.sub;

        log.debug({ function: 'getAccountDetails', userUid }, 'Retrieving account details for user');

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
            log.warn({ function: 'getAccountDetails', userUid }, 'Did not find user profile for logged in user, returning 401 to force re-authentication');
            throw Boom.notFound('Current user not found');
        }

        if (_.isNil(user.missions)) {
            log.debug({ function: 'getAccountDetails', userUid }, 'Loading user missions for account details');
            user.missions = await user.getMissions();
        }
        if (_.isNil(user.permissions)) {
            log.debug({ function: 'getAccountDetails', userUid }, 'Loading user permissions for account details');
            user.permissions = await user.getPermissions();
        }

        log.debug(
            { function: 'getAccountDetails', userUid, communityUid: user.communityUid, missionCount: user.missions.length, permissionCount: user.permissions.length },
            'Successfully retrieved account details for user');

        const publicUser = await user.toDetailedPublicObject();

        return { user: _.defaults(publicUser, { permissions: _.map(user.permissions, 'permission') }) };
    })());
}

export function patchAccountDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.sub;
        const payload = request.payload;

        log.debug({ function: 'patchAccountDetails', userUid, payload }, 'Updating account details for user');

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
            log.warn({ function: 'patchAccountDetails', userUid }, 'Did not find user profile for logged in user, returning 401 to force re-authentication');
            throw Boom.unauthorized('Current user not found');
        }

        if (_.isUndefined(user.community)) {
            log.debug({ function: 'patchAccountDetails', userUid }, 'Loading user community for account details update');
            user.community = await user.getCommunity();
        }
        if (_.isNil(user.missions)) {
            log.debug({ function: 'patchAccountDetails', userUid }, 'Loading user missions for account details update');
            user.missions = await user.getMissions();
        }
        if (_.isNil(user.permissions)) {
            log.debug({ function: 'patchAccountDetails', userUid }, 'Loading user permissions for account details update');
            user.permissions = await user.getPermissions();
        }

        await user.update(payload, { allowed: ['nickname'] });

        const permissions = _.map(user.permissions, 'permission');

        log.debug(
            { function: 'patchAccountDetails', userUid, payload, communityUid: user.communityUid, missionCount: user.missions.length, permissionCount: permissions.length },
            'Successfully updated account details for user');

        const publicUser = await user.toDetailedPublicObject();

        return { user: _.defaults(publicUser, { permissions }) };
    })());
}
