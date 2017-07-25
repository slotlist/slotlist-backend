import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Transaction } from 'sequelize';

import { Community } from '../../../shared/models/Community';
import { CommunityApplication } from '../../../shared/models/CommunityApplication';
import { Mission } from '../../../shared/models/Mission';
import { User } from '../../../shared/models/User';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
const log = logger.child({ route: 'community', routeVersion: 'v1' });

/**
 * Handlers for V1 of community endpoints
 */

export function getCommunityList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        const result = await Community.findAndCountAll(queryOptions);

        const communityCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + communityCount) < result.count;
        const communityList = await Promise.map(result.rows, (community: Community) => {
            return community.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: communityCount,
            moreAvailable: moreAvailable,
            communities: communityList
        };
    })());
}

export function isSlugAvailable(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.query.slug;
        if (slug === 'slugAvailable') {
            log.debug({ function: 'isSlugAvailable', slug }, 'Received `slugAvailable` slug, rejecting');

            return { available: false };
        }

        const available = await Community.isSlugAvailable(slug);

        return { available };
    })());
}

export function createCommunity(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const payload = request.payload;
        const user = request.auth.credentials.user;

        if (payload.slug === 'slugAvailable') {
            log.debug({ function: 'createCommunity', payload, user }, 'Received `slugAvailable` slug, rejecting');

            throw Boom.badRequest('Disallowed slug');
        }

        log.debug({ function: 'createCommunity', payload, user }, 'Creating new community');

        return sequelize.transaction(async (t: Transaction) => {
            let community: Community;
            try {
                community = await new Community(payload).save();
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createCommunity', payload, user, err }, 'Received unique constraint error during community creation');

                    throw Boom.conflict('Community slug already exists');
                }

                log.warn({ function: 'createCommunity', payload, user, err }, 'Received error during community creation');
                throw err;
            }

            log.debug({ function: 'createCommunity', payload, user, communityUid: community.uid }, 'Created new community, adding user as founder');

            try {
                await community.addLeader(user.uid, true);
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createCommunity', payload, user, err }, 'Received unique constraint error during founder permission creation');

                    throw Boom.conflict('Community founder permission already exists');
                }

                log.warn({ function: 'createCommunity', payload, user, err }, 'Received error during founder permission creation');
                throw err;
            }

            log.debug({ function: 'createCommunity', payload, user, communityUid: community.uid }, 'Successfully created new community');

            const detailedPublicCommunity = await community.toDetailedPublicObject();

            return {
                community: detailedPublicCommunity
            };
        });
    })());
}

export function getCommunityDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;

        const community = await Community.findOne({
            where: { slug },
            include: [
                {
                    model: User,
                    as: 'members'
                },
                {
                    model: Mission,
                    as: 'missions',
                    where: {
                        endTime: {
                            $gt: moment.utc()
                        }
                    },
                    include: [
                        {
                            model: User,
                            as: 'creator'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityDetails', slug }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const detailedPublicCommunity = await community.toDetailedPublicObject();

        return {
            community: detailedPublicCommunity
        };
    })());
}

export function applyToCommunity(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, include: [{ model: User, as: 'members' }] });
        if (_.isNil(community)) {
            log.debug({ function: 'applyToCommunity', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (await community.hasMember(userUid)) {
            log.debug({ function: 'applyToCommunity', slug, communityUid: community.uid, userUid }, 'User already is member of community, stopping to process application');
            throw Boom.conflict('Already member of community');
        }

        log.debug({ function: 'applyToCommunity', slug, communityUid: community.uid, userUid }, 'Processing user application to community');

        let application: CommunityApplication;
        try {
            application = await community.createApplication({ userUid });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                log.debug(
                    { function: 'applyToCommunity', slug, communityUid: community.uid, userUid, err },
                    'Received unique constraint error during community application creation');

                throw Boom.conflict('Community application already exists');
            }

            log.warn({ function: 'applyToCommunity', slug, communityUid: community.uid, userUid, err }, 'Received error during community application creation');
            throw err;
        }

        log.debug(
            { function: 'applyToCommunity', slug, communityUid: community.uid, userUid, applicationUid: application.uid, applicationStatus: application.status },
            'Successfully finished processing user application to community');

        return {
            status: application.status
        };
    })());
}

export function getCommunityMemberList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        if (request.query.includeEnded === false) {
            queryOptions.where = {
                endTime: {
                    $gt: moment.utc()
                }
            };
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityMemberList', slug, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (_.isNil(queryOptions.where)) {
            queryOptions.where = {
                communityUid: community.uid
            };
        } else {
            queryOptions.where.communityUid = community.uid;
        }

        const result = await User.findAndCountAll(queryOptions);

        const userCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + userCount) < result.count;
        const userList = await Promise.map(result.rows, (user: User) => {
            return user.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: userCount,
            moreAvailable: moreAvailable,
            members: userList
        };
    })());
}

export function getCommunityMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        if (request.query.includeEnded === false) {
            queryOptions.where = {
                endTime: {
                    $gt: moment.utc()
                }
            };
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityMissionList', slug, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (_.isNil(queryOptions.where)) {
            queryOptions.where = {
                communityUid: community.uid
            };
        } else {
            queryOptions.where.communityUid = community.uid;
        }

        const result = await Mission.findAndCountAll(queryOptions);

        const missionCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + missionCount) < result.count;
        const missionList = await Promise.map(result.rows, (mission: Mission) => {
            return mission.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: missionCount,
            moreAvailable: moreAvailable,
            missions: missionList
        };
    })());
}
