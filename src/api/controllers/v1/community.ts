import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Transaction } from 'sequelize';

import { Community } from '../../../shared/models/Community';
import {
    COMMUNITY_APPLICATION_STATUS_ACCEPTED,
    COMMUNITY_APPLICATION_STATUS_DENIED,
    COMMUNITY_APPLICATION_STATUS_SUBMITTED,
    COMMUNITY_APPLICATION_STATUSES,
    CommunityApplication
} from '../../../shared/models/CommunityApplication';
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
        const slug = request.params.communitySlug;

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
                    include: [
                        {
                            model: User,
                            as: 'creator'
                        }
                    ],
                    required: false
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

export function updateCommunity(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

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
                    include: [
                        {
                            model: User,
                            as: 'creator'
                        }
                    ],
                    required: false
                }
            ]
        });
        if (_.isNil(community)) {
            log.debug({ function: 'updateCommunity', slug, payload, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        log.debug({ function: 'updateCommunity', slug, payload, userUid, communityUid: community.uid }, 'Updating community');

        await community.update(payload, { allowed: ['name', 'tag', 'website'] });

        log.debug({ function: 'updateCommunity', slug, payload, userUid, communityUid: community.uid }, 'Successfully updated community');

        const detailedPublicCommunity = await community.toDetailedPublicObject();

        return {
            community: detailedPublicCommunity
        };
    })());
}

export function applyToCommunity(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
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

export function getCommunityApplicationList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;
        const status = _.includes(COMMUNITY_APPLICATION_STATUSES, request.query.status) ? request.query.status : undefined;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        if (!_.isNil(status)) {
            queryOptions.where = {
                status: status
            };
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityApplicationList', slug, userUid, status, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (_.isNil(queryOptions.where)) {
            queryOptions.where = {
                communityUid: community.uid
            };
        } else {
            queryOptions.where.communityUid = community.uid;
        }

        const result = await CommunityApplication.findAndCountAll(queryOptions);

        const applicationCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + applicationCount) < result.count;
        const applicationList = await Promise.map(result.rows, (application: CommunityApplication) => {
            return application.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: applicationCount,
            moreAvailable: moreAvailable,
            applications: applicationList
        };
    })());
}

export function updateCommunityApplication(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const applicationUid = request.params.applicationUid;
        const userUid = request.auth.credentials.user.uid;
        const status = _.includes([COMMUNITY_APPLICATION_STATUS_ACCEPTED, COMMUNITY_APPLICATION_STATUS_DENIED], request.payload.status) ? request.payload.status : undefined;

        if (_.isNil(status)) {
            log.debug({ function: 'updateCommunityApplication', slug, applicationUid, userUid, status }, 'Invalid status provided during community applicaiton update');
            throw Boom.badRequest('Invalid community application status');
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'updateCommunityApplication', slug, applicationUid, userUid, status }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const applications = await community.getApplications({ where: { uid: applicationUid } });
        if (_.isNil(applications) || _.isEmpty(applications)) {
            log.debug({ function: 'updateCommunityApplication', slug, applicationUid, userUid, status }, 'Community application with given UID not found');
            throw Boom.notFound('Community application not found');
        }
        let application = applications[0];

        if (application.status !== COMMUNITY_APPLICATION_STATUS_SUBMITTED) {
            log.debug(
                { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                'Community application has already been processed, cannot update');
            throw Boom.conflict('Community application already processed');
        }

        log.debug({ function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid }, 'Updating community application');

        return sequelize.transaction(async (t: Transaction) => {
            application = await application.update({ status });

            log.debug(
                { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                'Successfully updated community application');

            if (status === COMMUNITY_APPLICATION_STATUS_ACCEPTED) {
                log.debug(
                    { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                    'Community application was accepted, adding member');

                await community.addMember(application.userUid);

                log.debug(
                    { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                    'Successfully added community member');
            }

            const publicApplication = await application.toPublicObject();

            return {
                application: publicApplication
            };
        });
    })());
}

export function getCommunityMemberList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
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
        const slug = request.params.communitySlug;
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
