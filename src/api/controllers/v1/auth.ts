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
            throw Boom.notFound('Current user not found');
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

export function patchAccountDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.sub;
        const payload = request.payload;

        log.debug({ userUid, payload }, 'Updating account details for user');

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
            throw Boom.unauthorized('Current user not found');
        }

        if (_.isUndefined(user.community)) {
            log.debug({ userUid }, 'Loading user community for account details update');
            user.community = await user.getCommunity();
        }
        if (_.isNil(user.missions)) {
            log.debug({ userUid }, 'Loading user missions for account details update');
            user.missions = await user.getMissions();
        }
        if (_.isNil(user.permissions)) {
            log.debug({ userUid }, 'Loading user permissions for account details update');
            user.permissions = await user.getPermissions();
        }

        let destroyOldPermissions = true;
        if (!_.isUndefined(payload.communitySlug) && (_.isNil(user.community) || payload.communitySlug !== user.community.slug)) {
            if (_.isNull(payload.communitySlug)) {
                payload.communityUid = null;
            } else if (_.isString(payload.communitySlug) && !_.isEmpty(payload.communitySlug)) {
                log.debug({ userUid, payload, communitySlug: payload.communitySlug }, 'Trying to retrieve new community during account details update for user');
                const community = await Community.findOne({ where: { slug: payload.communitySlug } });
                if (_.isNil(community)) {
                    log.debug({ userUid, payload, communitySlug: payload.communitySlug }, 'No community with given slug found during account details update for user, ignoring');
                    destroyOldPermissions = false;
                } else {
                    log.debug(
                        { userUid, payload, communitySlug: payload.communitySlug, communityUid: community.uid },
                        'Updating communityUid with new community during accounts details update for user');
                    payload.communityUid = community.uid;
                }
            }

            if (destroyOldPermissions && !_.isNil(user.community)) {
                log.debug(
                    { userUid, payload, communitySlug: payload.communitySlug, communityUid: user.communityUid },
                    'Destroying all permission for old community during account details update for user');

                const destroyed = await Permission.destroy({
                    where: {
                        userUid,
                        permission: {
                            $iLike: `community.${user.community.slug}.%`
                        }
                    }
                });

                log.debug(
                    { userUid, payload, communitySlug: payload.communitySlug, communityUid: user.communityUid, destroyed },
                    'Successfully destroyed all permission for old community during account details update for user');

                user.permissions = await user.getPermissions();
            }

            payload.communitySlug = undefined;
            delete payload.communitySlug;
        }

        await user.update(payload, { allowed: ['nickname', 'communityUid'] });

        const permissions = _.map(user.permissions, 'permission');

        log.debug(
            { userUid, payload, communityUid: user.communityUid, missionCount: user.missions.length, permissionCount: permissions.length },
            'Successfully updated account details for user');

        const publicUser = await user.toDetailedPublicObject();

        return { user: _.defaults(publicUser, { permissions }) };
    })());
}
