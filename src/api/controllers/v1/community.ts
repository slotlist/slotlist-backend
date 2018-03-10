import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { col, fn, literal, Transaction } from 'sequelize';
import * as urlJoin from 'url-join';
import * as uuid from 'uuid';

import { Community } from '../../../shared/models/Community';
import {
    COMMUNITY_APPLICATION_STATUS_ACCEPTED,
    COMMUNITY_APPLICATION_STATUS_DENIED,
    COMMUNITY_APPLICATION_STATUS_SUBMITTED,
    COMMUNITY_APPLICATION_STATUSES,
    CommunityApplication
} from '../../../shared/models/CommunityApplication';
import { Mission } from '../../../shared/models/Mission';
import { Permission } from '../../../shared/models/Permission';
import { User } from '../../../shared/models/User';
import { COMMUNITY_LOGO_PATH, instance as ImageService } from '../../../shared/services/ImageService';
import { hasPermission } from '../../../shared/util/acl';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
// tslint:disable-next-line:import-name
import slugger from '../../../shared/util/slug';
const log = logger.child({ route: 'community', routeVersion: 'v1' });

/**
 * Handlers for V1 of community endpoints
 */

export function getCommunityList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [[fn('UPPER', col('name')), 'ASC']]
        };

        if (!_.isNil(request.query.search)) {
            queryOptions.where = {
                $or: [
                    {
                        name: {
                            $iLike: `%${request.query.search}%`
                        }
                    },
                    {
                        tag: {
                            $iLike: `%${request.query.search}%`
                        }
                    }
                ]
            };

            log.debug({ function: 'getCommunityList', queryOptions }, 'Including search parameter in query options');
        }

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
            total: result.count,
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
        const userUid = request.auth.credentials.user.uid;

        if (payload.slug === 'slugAvailable') {
            log.debug({ function: 'createCommunity', payload, userUid }, 'Received `slugAvailable` slug, rejecting');

            throw Boom.badRequest('Disallowed slug');
        }

        // Make sure payload is properly "slugged"
        payload.slug = slugger(payload.slug);

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'createCommunity', payload, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        log.debug({ function: 'createCommunity', payload, userUid }, 'Creating new community');

        return sequelize.transaction(async (t: Transaction) => {
            if (!_.isNil(user.communityUid)) {
                log.debug({ function: 'createCommunity', payload, userUid, communityUid: user.communityUid }, 'User is already in a community, removing associations first');

                if (_.isNil(user.community)) {
                    user.community = await user.getCommunity();
                }

                await Promise.all([
                    CommunityApplication.destroy({ where: { userUid, communityUid: user.communityUid } }),
                    Permission.destroy({ where: { userUid, permission: { $iLike: `community.${user.community.slug}.%` } } }),
                    user.community.removeMember(userUid)
                ]);

                log.debug({ function: 'createCommunity', payload, userUid, communityUid: user.communityUid }, 'Successfully removed old community associations from user');
            }

            let community: Community;
            try {
                community = await new Community(payload).save();
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createCommunity', payload, userUid, err }, 'Received unique constraint error during community creation');

                    throw Boom.conflict('Community slug already exists');
                }

                log.warn({ function: 'createCommunity', payload, userUid, err }, 'Received error during community creation');
                throw err;
            }

            log.debug({ function: 'createCommunity', payload, userUid, communityUid: community.uid }, 'Created new community, adding user as founder');

            try {
                await community.addLeader(user.uid, true);
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createCommunity', payload, userUid, err }, 'Received unique constraint error during founder permission creation');

                    throw Boom.conflict('Community founder permission already exists');
                }

                log.warn({ function: 'createCommunity', payload, userUid, err }, 'Received error during founder permission creation');
                throw err;
            }

            log.debug({ function: 'createCommunity', payload, userUid, communityUid: community.uid }, 'Successfully created new community');

            const detailedPublicCommunity = await community.toDetailedPublicObject();
            await user.reload();
            const token = await user.generateJWT();

            return {
                community: detailedPublicCommunity,
                token: token
            };
        });
    })());
}

export function getCommunityDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        let userUid: string | null = null;
        let userCommunityUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;

            if (!_.isNil(request.auth.credentials.user.community)) {
                userCommunityUid = request.auth.credentials.user.community.uid;
            }
        }

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

        // Only include full community details if user is a member of the community or has community admin permissions
        let includeFullDetails = false;
        if (community.uid === userCommunityUid) {
            includeFullDetails = true;
        } else if (request.auth.isAuthenticated && hasPermission(request.auth.credentials.permissions, 'admin.community')) {
            log.info({ function: 'getCommunityDetails', slug, userUid, hasPermission: true }, 'User has community admin permissions, returning community details');
            includeFullDetails = true;
        }

        const detailedPublicCommunity = await community.toDetailedPublicObject(includeFullDetails);

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

        await community.update(payload, { fields: ['name', 'tag', 'website', 'gameServers', 'voiceComms', 'repositories'] });

        log.debug({ function: 'updateCommunity', slug, payload, userUid, communityUid: community.uid }, 'Successfully updated community');

        // User updating the community will either be a community member or an admin, so full details are always returned
        const detailedPublicCommunity = await community.toDetailedPublicObject(true);

        return {
            community: detailedPublicCommunity
        };
    })());
}

export function deleteCommunity(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'deleteCommunity', slug, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const community = await Community.findOne({ where: { slug } });
        if (_.isNil(community)) {
            log.debug({ function: 'deleteCommunity', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'deleteCommunity', slug, userUid, communityUid: community.uid }, 'Deleting community');

            try {
                await community.createCommunityDeletedNotifications();
            } catch (err) {
                log.warn({ function: 'deleteCommunity', slug, userUid, communityUid: community.uid, err }, 'Received error during community deleted notifications creation');
            }

            await Promise.all([
                community.destroy(),
                Permission.destroy({ where: { permission: { $iLike: `community.${slug}.%` } } })
            ]);

            log.debug({ function: 'deleteCommunity', slug, userUid, communityUid: community.uid }, 'Successfully deleted community');

            await user.reload();
            const token = await user.generateJWT();

            return {
                success: true,
                token: token
            };
        });
    })());
}

export function setCommunityLogo(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const imageType = request.payload.imageType;
        const image = request.payload.image;

        if (_.isNil(imageType) || _.isNil(image)) {
            log.debug({ function: 'setCommunityLogo', slug, userUid }, 'Missing community logo data, aborting');
            throw Boom.badRequest('Missing community logo data');
        }

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
            log.debug({ function: 'setCommunityLogo', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const imageFolder = urlJoin(COMMUNITY_LOGO_PATH, slug);
        const imageName = uuid.v4();

        const matches = ImageService.parseDataUrl(image);
        if (_.isNil(matches)) {
            log.debug({ function: 'setCommunityLogo', slug, userUid }, 'Community logo data did not match data URL regex, aborting');
            throw Boom.badRequest('Missing community logo data');
        }

        const imageData = Buffer.from(matches[4], 'base64');

        log.debug({ function: 'setCommunityLogo', slug, userUid, communityUid: community.uid, imageFolder, imageName }, 'Uploading community logo');

        const imageUrl = await ImageService.uploadImage(imageData, imageName, imageFolder, imageType);

        log.debug({ function: 'setCommunityLogo', slug, userUid, communityUid: community.uid, imageUrl }, 'Finished uploading community logo, updating community');

        await community.update({ logoUrl: imageUrl });

        log.debug({ function: 'setCommunityLogo', slug, userUid, communityUid: community.uid, imageUrl }, 'Successfully updated community');

        const detailedPublicCommunity = await community.toDetailedPublicObject();

        return {
            community: detailedPublicCommunity
        };
    })());
}

export function deleteCommunityLogo(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug } });
        if (_.isNil(community)) {
            log.debug({ function: 'deleteCommunityLogo', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const logoUrl = community.logoUrl;
        if (_.isNil(logoUrl)) {
            log.debug({ function: 'deleteCommunityLogo', slug, userUid }, 'Community does not have logo URL set, aborting');
            throw Boom.notFound('No community logo set');
        }

        const matches = ImageService.getImageUidFromUrl(logoUrl);
        if (_.isNil(matches) || _.isEmpty(matches)) {
            log.debug({ function: 'deleteCommunityLogo', slug, userUid }, 'Failed to parse image UID from logo URL, aborting');
            throw Boom.notFound('No community logo set');
        }
        const logoUid = matches[0];

        const imagePath = urlJoin(COMMUNITY_LOGO_PATH, slug, logoUid);

        log.debug({ function: 'deleteCommunityLogo', slug, userUid, communityUid: community.uid, imagePath }, 'Deleting community logo');

        await ImageService.deleteImage(imagePath);

        log.debug({ function: 'deleteCommunityLogo', slug, userUid, communityUid: community.uid, imagePath }, 'Removing community logo URL from community');

        await community.update({ logoUrl: null });

        log.debug({ function: 'deleteCommunityLogo', slug, userUid, communityUid: community.uid, imagePath }, 'Successfully updated community');

        return {
            success: true
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
            offset: request.query.offset,
            order: [['createdAt', 'ASC']]
        };

        if (!_.isNil(status)) {
            queryOptions.where = {
                status: status
            };
        } else if (request.query.includeProcessed === false) {
            queryOptions.where = {
                status: COMMUNITY_APPLICATION_STATUS_SUBMITTED
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
            total: result.count,
            moreAvailable: moreAvailable,
            applications: applicationList
        };
    })());
}

export function createCommunityApplication(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, include: [{ model: User, as: 'members' }] });
        if (_.isNil(community)) {
            log.debug({ function: 'createCommunityApplication', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (await community.hasMember(userUid)) {
            log.debug(
                { function: 'createCommunityApplication', slug, communityUid: community.uid, userUid },
                'User already is member of community, stopping to process application');
            throw Boom.conflict('Already member of community');
        }

        log.debug({ function: 'createCommunityApplication', slug, communityUid: community.uid, userUid }, 'Processing user application to community');

        let application: CommunityApplication;
        try {
            application = await community.createApplication({ userUid });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                log.debug(
                    { function: 'createCommunityApplication', slug, communityUid: community.uid, userUid, err },
                    'Received unique constraint error during community application creation');

                throw Boom.conflict('Community application already exists');
            }

            log.warn({ function: 'createCommunityApplication', slug, communityUid: community.uid, userUid, err }, 'Received error during community application creation');
            throw err;
        }

        try {
            await community.createApplicationSubmittedNotifications(userUid);
        } catch (err) {
            log.warn(
                { function: 'createCommunityApplication', slug, communityUid: community.uid, userUid, applicationUid: application.uid, err },
                'Received error during community application submitted notifications creation');
        }

        log.debug(
            { function: 'createCommunityApplication', slug, communityUid: community.uid, userUid, applicationUid: application.uid },
            'Successfully finished processing user application to community');

        return {
            status: application.status
        };
    })());
}

export function getCommunityApplicationStatus(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityApplicationStatus', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const applications = await community.getApplications({ where: { userUid: userUid } });
        if (_.isNil(applications) || _.isEmpty(applications)) {
            log.debug({ function: 'getCommunityApplicationStatus', slug, userUid, communityUid: community.uid }, 'Community application with given user UID not found');
            throw Boom.notFound('Community application not found');
        }
        const application = applications[0];

        const publicApplication = await application.toPublicObject();

        return {
            application: publicApplication
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

        const community = await Community.findOne({ where: { slug }, attributes: ['uid', 'slug', 'name'] });
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

            let accepted: boolean = false;
            if (status === COMMUNITY_APPLICATION_STATUS_ACCEPTED) {
                accepted = true;

                log.debug(
                    { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                    'Community application was accepted, adding member');

                await community.addMember(application.userUid);

                log.debug(
                    { function: 'updateCommunityApplication', slug, applicationUid, userUid, status, memberUid: application.userUid },
                    'Successfully added community member');
            }

            try {
                await community.createApplicationProcessedNotification(application.userUid, accepted);
            } catch (err) {
                log.warn(
                    { function: 'updateCommunityApplication', slug, applicationUid, userUid, err },
                    'Received error during community application processed notification creation');
            }

            const publicApplication = await application.toPublicObject();

            return {
                application: publicApplication
            };
        });
    })());
}

export function deleteCommunityApplication(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const applicationUid = request.params.applicationUid;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, attributes: ['uid', 'slug', 'name'] });
        if (_.isNil(community)) {
            log.debug({ function: 'deleteCommunityApplication', slug, applicationUid, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const applications = await community.getApplications({ where: { uid: applicationUid } });
        if (_.isNil(applications) || _.isEmpty(applications)) {
            log.debug({ function: 'deleteCommunityApplication', slug, applicationUid, userUid, communityUid: community.uid }, 'Community application with given UID not found');
            throw Boom.notFound('Community application not found');
        }
        const application = applications[0];

        if (application.userUid !== userUid) {
            log.info(
                { function: 'deleteCommunityApplication', slug, applicationUid, userUid, communityUid: community.uid, applicationUserUid: application.userUid },
                'User tried to delete community application that was created by a different user, denying');
            throw Boom.forbidden();
        }

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'deleteCommunityApplication', slug, applicationUid, userUid, communityUid: community.uid }, 'Deleting community application');

            if (await community.hasMember(userUid)) {
                await Promise.all([
                    application.destroy(),
                    Permission.destroy({ where: { userUid, permission: { $iLike: `community.${slug}.%` } } }),
                    community.removeMember(userUid)
                ]);
            } else {
                await Promise.all([
                    application.destroy(),
                    Permission.destroy({ where: { userUid, permission: { $iLike: `community.${slug}.%` } } })
                ]);
            }

            try {
                await community.createApplicationDeletedNotifications(application.userUid);
            } catch (err) {
                log.warn(
                    { function: 'deleteCommunityApplication', slug, applicationUid, userUid, communityUid: community.uid, err },
                    'Received error during community application deleted notifications creation');
            }

            log.debug({ function: 'deleteCommunityApplication', slug, applicationUid, userUid, communityUid: community.uid }, 'Successfully deleted community application');

            return {
                success: true
            };
        });
    })());
}

export function removeCommunityMember(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const memberUid = request.params.memberUid;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, attributes: ['uid', 'slug', 'name'] });
        if (_.isNil(community)) {
            log.debug({ function: 'removeCommunityMember', slug, memberUid, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const members = await community.getMembers({ where: { uid: memberUid } });
        if (_.isNil(members) || _.isEmpty(members)) {
            log.debug({ function: 'removeCommunityMember', slug, memberUid, userUid, communityUid: community.uid }, 'Community member with given UID not found');
            throw Boom.notFound('Community member not found');
        }
        const member = members[0];

        if (await member.hasPermission(`community.${slug}.founder`)) {
            log.info({ function: 'removeCommunityMember', slug, memberUid, userUid, communityUid: community.uid }, 'User tried to remove community founder, denying');
            throw Boom.forbidden();
        }

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'removeCommunityMember', slug, memberUid, userUid, communityUid: community.uid }, 'Removing community member');

            await Promise.all([
                community.removeMember(memberUid),
                Permission.destroy({ where: { userUid: memberUid, permission: { $iLike: `community.${slug}.%` } } }),
                CommunityApplication.destroy({ where: { userUid: memberUid, communityUid: community.uid } })
            ]);

            try {
                await community.createApplicationRemovedNotification(memberUid);
            } catch (err) {
                log.warn(
                    { function: 'removeCommunityMember', slug, memberUid, userUid, communityUid: community.uid, err },
                    'Received error during community application removed notification creation');
            }

            log.debug({ function: 'removeCommunityMember', slug, memberUid, userUid, communityUid: community.uid }, 'Successfully removed community member');

            return {
                success: true
            };
        });
    })());
}

export function getCommunityMemberList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [[fn('UPPER', col('nickname')), 'ASC']]
        };

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityMemberList', slug, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        queryOptions.where = {
            communityUid: community.uid
        };

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
        let userUid: string | null = null;
        let userCommunityUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;

            if (!_.isNil(request.auth.credentials.user.community)) {
                userCommunityUid = request.auth.credentials.user.community.uid;
            }
        }

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [['startTime', 'ASC'], [fn('UPPER', col('title')), 'ASC']]
        };

        if (_.isNil(userUid)) {
            queryOptions.where = {
                visibility: 'public'
            };
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info({ function: 'getCommunityMissionList', slug, userUid, hasPermission: true }, 'User has mission admin permissions, returning all community missions');
            queryOptions.where = {};
        } else {
            queryOptions.where = {
                $or: [
                    {
                        creatorUid: userUid
                    },
                    {
                        visibility: 'public'
                    },
                    {
                        $or: [
                            // tslint:disable-next-line:max-line-length
                            literal(`${sequelize.escape(userUid)} IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor')`)
                        ]
                    },
                    {
                        visibility: 'private',
                        $or: [
                            // tslint:disable-next-line:max-line-length
                            literal(`${sequelize.escape(userUid)} IN (SELECT "userUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "userUid" = ${sequelize.escape(userUid)})`)
                        ]
                    }
                ]
            };

            if (!_.isNil(userCommunityUid)) {
                queryOptions.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });

                // $or[3] === visibility: 'private', add check for user's community UID.
                // Has to be done after userCommunityUid has been checked for `null` since every mission access entry granted to a user has `communityUid: null`,
                // which would result in incorrect access being granted for communities
                queryOptions.where.$or[3].$or.push(
                    // tslint:disable-next-line:max-line-length
                    literal(`${sequelize.escape(userCommunityUid)} IN (SELECT "communityUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "communityUid" = ${sequelize.escape(userCommunityUid)})`)
                );
            }
        }

        if (request.query.includeEnded === false) {
            queryOptions.where.endTime = {
                $gt: moment.utc()
            };
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityMissionList', slug, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        queryOptions.where.communityUid = community.uid;

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
            total: result.count,
            moreAvailable: moreAvailable,
            missions: missionList
        };
    })());
}

export function getCommunityPermissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            where: { permission: { $like: `community.${slug}.%` } },
            include: [
                {
                    model: User,
                    as: 'user',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        };

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'getCommunityPermissionList', slug, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityPermissionList', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const result = await Permission.findAndCountAll(queryOptions);

        const permissionCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + permissionCount) < result.count;
        const permissionList = await Promise.map(result.rows, async (permission: Permission) => {
            return permission.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: permissionCount,
            total: result.count,
            moreAvailable: moreAvailable,
            permissions: permissionList
        };
    })());
}

export function createCommunityPermission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, attributes: ['uid', 'slug', 'name'] });
        if (_.isNil(community)) {
            log.debug({ function: 'createCommunityPermission', slug, payload, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (!Permission.isValidCommunityPermission(slug, payload.permission)) {
            log.warn({ function: 'createCommunityPermission', slug, payload, userUid, communityUid: community.uid }, 'Tried to create invalid community permission, rejecting');
            throw Boom.badRequest('Invalid community permission');
        }

        const targetUser = await User.findOne({ where: { uid: payload.userUid }, attributes: ['uid', 'nickname', 'communityUid'] });
        if (_.isNil(targetUser)) {
            log.debug({ function: 'createCommunityPermission', slug, payload, userUid, communityUid: community.uid }, 'Community permission target user with given UID not found');
            throw Boom.notFound('User not found');
        }

        log.debug({ function: 'createCommunityPermission', slug, payload, userUid, communityUid: community.uid }, 'Creating new community permission');

        let permission: Permission;
        try {
            permission = await Permission.create({ userUid: payload.userUid, permission: payload.permission });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                throw Boom.conflict('Community permission already exists');
            }

            throw err;
        }

        try {
            await community.createPermissionNotification(targetUser, payload.permission, true);
        } catch (err) {
            log.warn(
                { function: 'createCommunityPermission', payload, userUid, communityUid: community.uid, permissionUid: permission.uid, err },
                'Received error during community permission granted notification creation');
        }

        log.debug(
            { function: 'createCommunityPermission', payload, userUid, communityUid: community.uid, permissionUid: permission.uid },
            'Successfully created new community permission');

        const publicPermission = await permission.toPublicObject();

        return {
            permission: publicPermission
        };
    })());
}

export function deleteCommunityPermission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const permissionUid = request.params.permissionUid;
        const userUid = request.auth.credentials.user.uid;

        const community = await Community.findOne({ where: { slug }, attributes: ['uid', 'slug', 'name'] });
        if (_.isNil(community)) {
            log.debug({ function: 'deleteCommunityPermission', slug, permissionUid, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const permission = await Permission.findOne({
            where: {
                uid: permissionUid,
                permission: {
                    $or: [`community.${slug}.leader`, `community.${slug}.recruitment`]
                }
            }
        });
        if (_.isNil(permission)) {
            log.debug({ function: 'deleteCommunityPermission', slug, permissionUid, userUid, communityUid: community.uid }, 'Community permission with given UID not found');
            throw Boom.notFound('Community permission not found');
        }

        log.debug({ function: 'deleteCommunityPermission', slug, permissionUid, userUid, communityUid: community.uid }, 'Deleting community permission');

        const permissionUserUid = permission.userUid;
        const permissionPermission = permission.permission;

        await permission.destroy();

        try {
            await community.createPermissionNotification(permissionUserUid, permissionPermission, false);
        } catch (err) {
            log.warn(
                { function: 'deleteCommunityPermission', slug, permissionUid, userUid, communityUid: community.uid, err },
                'Received error during community permission removed notification creation');
        }

        log.debug({ function: 'deleteCommunityPermission', slug, permissionUid, userUid, communityUid: community.uid }, 'Successfully deleted community permission');

        return {
            success: true
        };
    })());
}

export function getCommunityRepositories(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        } else {
            log.debug({ function: 'getCommunityRepositories', slug, userUid }, 'User is not member of any community, preventing access to community repositories');
            throw Boom.forbidden();
        }

        const community = await Community.findOne({
            where: { slug },
            attributes: ['uid', 'repositories']
        });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityRepositories', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (userCommunityUid !== community.uid) {
            log.debug(
                { function: 'getCommunityRepositories', slug, userUid, userCommunityUid, communityUid: community.uid },
                'User is not member of community, preventing access to community repositories');
            throw Boom.forbidden();
        }

        return {
            repositories: community.repositories
        };
    })());
}

export function getCommunityServers(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.communitySlug;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        } else {
            log.debug({ function: 'getCommunityServers', slug, userUid }, 'User is not member of any community, preventing access to community servers');
            throw Boom.forbidden();
        }

        const community = await Community.findOne({
            where: { slug },
            attributes: ['uid', 'gameServers', 'voiceComms']
        });
        if (_.isNil(community)) {
            log.debug({ function: 'getCommunityServers', slug, userUid }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        if (userCommunityUid !== community.uid) {
            log.debug(
                { function: 'getCommunityServers', slug, userUid, userCommunityUid, communityUid: community.uid },
                'User is not member of community, preventing access to community servers');
            throw Boom.forbidden();
        }

        return {
            gameServers: community.gameServers,
            voiceComms: community.voiceComms
        };
    })());
}
