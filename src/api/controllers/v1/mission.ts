import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { col, fn, literal, Transaction } from 'sequelize';
import * as urlJoin from 'url-join';
import * as uuid from 'uuid';

import { Community } from '../../../shared/models/Community';
import { Mission } from '../../../shared/models/Mission';
import { IPublicMissionSlot, MissionSlot } from '../../../shared/models/MissionSlot';
import { IPublicMissionSlotGroup, MissionSlotGroup } from '../../../shared/models/MissionSlotGroup';
import { MissionSlotRegistration } from '../../../shared/models/MissionSlotRegistration';
import { Permission } from '../../../shared/models/Permission';
import { User } from '../../../shared/models/User';
import { instance as ImageService, MISSION_IMAGE_PATH } from '../../../shared/services/ImageService';
import { findPermission, parsePermissions } from '../../../shared/util/acl';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
// tslint:disable-next-line:import-name
import slugger from '../../../shared/util/slug';
const log = logger.child({ route: 'community', routeVersion: 'v1' });

/**
 * Handlers for V1 of mission endpoints
 */

export function getMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
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

        if (request.query.includeEnded === false) {
            queryOptions.where = {
                endTime: {
                    $gt: moment.utc()
                }
            };
        }

        if (_.isNil(userUid)) {
            if (_.isNil(queryOptions.where)) {
                queryOptions.where = {
                    visibility: 'public'
                };
            } else {
                queryOptions.where.visibility = 'public';
            }
        } else {
            queryOptions.where = _.defaults(
                {
                    $or: [
                        {
                            creatorUid: userUid
                        },
                        {
                            visibility: 'public'
                        },
                        {
                            visibility: 'hidden',
                            $or: [
                                {
                                    creatorUid: userUid
                                },
                                // tslint:disable-next-line:max-line-length
                                literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor' OR "permission" = '*')`)
                            ]
                        },
                        {
                            visibility: 'private',
                            creatorUid: userUid
                        }
                    ]
                },
                queryOptions.where);

            if (!_.isNil(userCommunityUid)) {
                queryOptions.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });
            }
        }

        const result = await Mission.findAndCountAll(queryOptions);

        const missionCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + missionCount) < result.count;
        const missionList = await Promise.map(result.rows, async (mission: Mission) => {
            const publicMission = await mission.toPublicObject();

            if (!_.isNil(userUid)) {
                const [isAssignedToAnySlot, isRegisteredForAnySlot] = await Promise.all([
                    mission.isUserAssignedToAnySlot(userUid),
                    mission.isUserRegisteredForAnySlot(userUid)
                ]);

                publicMission.isAssignedToAnySlot = isAssignedToAnySlot;
                publicMission.isRegisteredForAnySlot = isRegisteredForAnySlot;
            }

            return publicMission;
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

export function isSlugAvailable(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.query.slug;
        if (slug === 'slugAvailable') {
            log.debug({ function: 'isSlugAvailable', slug }, 'Received `slugAvailable` slug, rejecting');

            return { available: false };
        }

        const available = await Mission.isSlugAvailable(slug);

        return { available };
    })());
}

export function createMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        if (payload.slug === 'slugAvailable') {
            log.debug({ function: 'createMission', payload, userUid }, 'Received `slugAvailable` slug, rejecting');

            throw Boom.badRequest('Disallowed slug');
        }

        // Make sure payload is properly "slugged"
        payload.slug = slugger(payload.slug);

        const user = await User.findById(userUid, { include: [{ model: Community, as: 'community' }] });
        if (_.isNil(user)) {
            log.debug({ function: 'createMission', payload, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        payload.creatorUid = user.uid;

        if (!_.isNil(payload.addToCommunity)) {
            if (payload.addToCommunity === true && !_.isNil(user.communityUid)) {
                payload.communityUid = user.communityUid;
            }

            payload.addToCommunity = undefined;
            delete payload.addToCommunity;
        }

        payload.detailedDescription = await ImageService.parseMissionDescription(payload.slug, payload.detailedDescription);

        log.debug({ function: 'createMission', payload, userUid }, 'Creating new mission');

        return sequelize.transaction(async (t: Transaction) => {
            let mission: Mission;
            try {
                mission = await new Mission(payload).save();
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createMission', payload, userUid, err }, 'Received unique constraint error during mission creation');

                    throw Boom.conflict('Mission slug already exists');
                }

                log.warn({ function: 'createMission', payload, userUid, err }, 'Received error during mission creation');
                throw err;
            }

            log.debug({ function: 'createMission', payload, userUid, missionUid: mission.uid }, 'Created new mission, adding user as creator');

            try {
                await user.createPermission({ permission: `mission.${mission.slug}.creator` });
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug({ function: 'createMission', payload, userUid, err }, 'Received unique constraint error during creator permission creation');

                    throw Boom.conflict('Mission creator permission already exists');
                }

                log.warn({ function: 'createMission', payload, userUid, err }, 'Received error during creator permission creation');
                throw err;
            }

            log.debug({ function: 'createMission', payload, userUid, missionUid: mission.uid }, 'Successfully created new mission');

            const detailedPublicMission = await mission.toDetailedPublicObject();
            const token = await user.generateJWT();

            return {
                mission: detailedPublicMission,
                token: token
            };
        });
    })());
}

export function getMissionDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        let userUid: string | null = null;
        let userCommunityUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;

            if (!_.isNil(request.auth.credentials.user.community)) {
                userCommunityUid = request.auth.credentials.user.community.uid;
            }
        }

        const queryOptions: any = {
            where: { slug },
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: User,
                    as: 'creator'
                }
            ]
        };

        if (_.isNil(userUid)) {
            queryOptions.where.visibility = 'public';
        } else {
            queryOptions.where = _.defaults(
                {
                    $or: [
                        {
                            creatorUid: userUid
                        },
                        {
                            visibility: 'public'
                        },
                        {
                            visibility: 'hidden',
                            $or: [
                                {
                                    creatorUid: userUid
                                },
                                // tslint:disable-next-line:max-line-length
                                literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor' OR "permission" = '*')`)
                            ]
                        },
                        {
                            visibility: 'private',
                            creatorUid: userUid
                        }
                    ]
                },
                queryOptions.where);

            if (!_.isNil(userCommunityUid)) {
                queryOptions.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });
            }
        }

        const mission = await Mission.findOne(queryOptions);
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionDetails', slug }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const detailedPublicMission = await mission.toDetailedPublicObject();

        return {
            mission: detailedPublicMission
        };
    })());
}

export function updateMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({
            where: { slug },
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: User,
                    as: 'creator'
                }
            ]
        });
        if (_.isNil(mission)) {
            log.debug({ function: 'updateMission', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.debug({ function: 'updateMission', slug, payload, userUid, missionUid: mission.uid }, 'Updating mission');

        if (_.isString(payload.detailedDescription) && !_.isEmpty(payload.detailedDescription)) {
            payload.detailedDescription = await ImageService.parseMissionDescription(slug, payload.detailedDescription);
        }

        await mission.update(payload, {
            allowed: ['title', 'detailedDescription', 'description', 'briefingTime', 'slottingTime', 'startTime', 'endTime', 'repositoryUrl', 'techSupport', 'rules', 'visibility']
        });

        log.debug({ function: 'updateMission', slug, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission');

        const detailedPublicMission = await mission.toDetailedPublicObject();

        return {
            mission: detailedPublicMission
        };
    })());
}

export function deleteMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'deleteMission', slug, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const mission = await Mission.findOne({ where: { slug } });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMission', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'deleteMission', slug, userUid, missionUid: mission.uid }, 'Deleting Mission');

            await Promise.all([
                mission.destroy(),
                Permission.destroy({ where: { permission: { $iLike: `mission.${slug}.%` } } }),
                ImageService.deleteAllMissionImages(urlJoin(MISSION_IMAGE_PATH, slug))
            ]);

            log.debug({ function: 'deleteMission', slug, userUid, missionUid: mission.uid }, 'Successfully deleted mission');

            await user.reload();
            const token = await user.generateJWT();

            return {
                success: true,
                token: token
            };
        });
    })());
}

export function setMissionBannerImage(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        const imageType = request.payload.imageType;
        const image = request.payload.image;

        if (_.isNil(imageType) || _.isNil(image)) {
            log.debug({ function: 'setMissionBannerImage', slug, userUid }, 'Missing mission banner image data, aborting');
            throw Boom.badRequest('Missing mission banner image data');
        }

        const mission = await Mission.findOne({
            where: { slug },
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: User,
                    as: 'creator'
                }
            ]
        });
        if (_.isNil(mission)) {
            log.debug({ function: 'setMissionBannerImage', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const imageFolder = urlJoin(MISSION_IMAGE_PATH, slug);
        const imageName = uuid.v4();

        const matches = ImageService.parseDataUrl(image);
        if (_.isNil(matches)) {
            log.debug({ function: 'setMissionBannerImage', slug, userUid }, 'Mission banner image data did not match data URL regex, aborting');
            throw Boom.badRequest('Missing mission banner image data');
        }

        const imageData = Buffer.from(matches[4], 'base64');

        log.debug({ function: 'setMissionBannerImage', slug, userUid, missionUid: mission.uid, imageFolder, imageName }, 'Uploading mission banner image');

        const imageUrl = await ImageService.uploadImage(imageData, imageName, imageFolder, imageType);

        log.debug({ function: 'setMissionBannerImage', slug, userUid, missionUid: mission.uid, imageUrl }, 'Finished uploading mission banner image, updating mission');

        await mission.update({ bannerImageUrl: imageUrl });

        log.debug({ function: 'setMissionBannerImage', slug, userUid, missionUid: mission.uid, imageUrl }, 'Successfully updated mission');

        const detailedPublicMission = await mission.toDetailedPublicObject();

        return {
            mission: detailedPublicMission
        };
    })());
}

export function deleteMissionBannerImage(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug } });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionBannerImage', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const bannerImageUrl = mission.bannerImageUrl;
        if (_.isNil(bannerImageUrl)) {
            log.debug({ function: 'deleteMissionBannerImage', slug, userUid }, 'Mission does not have banner image URL set, aborting');
            throw Boom.notFound('No mission banner image set');
        }

        const matches = ImageService.getImageUidFromUrl(bannerImageUrl);
        if (_.isNil(matches) || _.isEmpty(matches)) {
            log.debug({ function: 'deleteMissionBannerImage', slug, userUid }, 'Failed to parse image UID from banner image URL, aborting');
            throw Boom.notFound('No mission banner image set');
        }
        const bannerImageUid = matches[0];

        const imagePath = urlJoin(MISSION_IMAGE_PATH, slug, bannerImageUid);

        log.debug({ function: 'deleteMissionBannerImage', slug, userUid, missionUid: mission.uid, imagePath }, 'Deleting mission banner image');

        await ImageService.deleteImage(imagePath);

        log.debug({ function: 'deleteMissionBannerImage', slug, userUid, missionUid: mission.uid, imagePath }, 'Removing mission banner image URL from mission');

        await mission.update({ bannerImageUrl: null });

        log.debug({ function: 'deleteMissionBannerImage', slug, userUid, missionUid: mission.uid, imagePath }, 'Successfully updated mission');

        return {
            success: true
        };
    })());
}

export function getMissionPermissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            where: { permission: { $like: `mission.${slug}.%` } },
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
            log.debug({ function: 'getMissionPermissionList', slug, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const mission = await Mission.findOne({ where: { slug } });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionPermissionList', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
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

export function createMissionPermission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionPermission', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        if (!Permission.isValidMissionPermission(slug, payload.permission)) {
            log.warn({ function: 'createMissionPermission', slug, payload, userUid, missionUid: mission.uid }, 'Tried to create invalid mission permission, rejecting');
            throw Boom.badRequest('Invalid mission permission');
        }

        log.debug({ function: 'createMissionPermission', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission permission');

        let permission: Permission;
        try {
            permission = await Permission.create({ userUid: payload.userUid, permission: payload.permission });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                throw Boom.conflict('Mission permission already exists');
            }

            throw err;
        }

        log.debug(
            { function: 'createMissionPermission', payload, userUid, missionUid: mission.uid, permissionUid: permission.uid },
            'Successfully created new mission permission');

        const publicPermission = await permission.toPublicObject();

        return {
            permission: publicPermission
        };
    })());
}

export function deleteMissionPermission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const permissionUid = request.params.permissionUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const permission = await Permission.findOne({
            where: {
                uid: permissionUid,
                permission: `mission.${slug}.editor`
            }
        });
        if (_.isNil(permission)) {
            log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Mission permission with given UID not found');
            throw Boom.notFound('Mission permission not found');
        }

        log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Deleting mission permission');

        await permission.destroy();

        log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission permission');

        return {
            success: true
        };
    })());
}

export function getMissionSlotList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;

        let userUid: string | null = null;
        let userCommunityUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;

            if (!_.isNil(request.auth.credentials.user.community)) {
                userCommunityUid = request.auth.credentials.user.community.uid;
            }
        }

        const queryOptionsMission: any = {
            where: { slug },
            attributes: ['uid']
        };

        if (_.isNil(userUid)) {
            queryOptionsMission.where.visibility = 'public';
        } else {
            queryOptionsMission.where = _.defaults(
                {
                    $or: [
                        {
                            creatorUid: userUid
                        },
                        {
                            visibility: 'public'
                        },
                        {
                            visibility: 'hidden',
                            $or: [
                                {
                                    creatorUid: userUid
                                },
                                // tslint:disable-next-line:max-line-length
                                literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor' OR "permission" = '*')`)
                            ]
                        },
                        {
                            visibility: 'private',
                            creatorUid: userUid
                        }
                    ]
                },
                queryOptionsMission.where);

            if (!_.isNil(userCommunityUid)) {
                queryOptionsMission.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });
            }
        }

        const mission = await Mission.findOne(queryOptionsMission);
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotList', slug, queryOptionsMission, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        let missionSlotGroups = await mission.getSlotGroups();
        missionSlotGroups = _.orderBy(missionSlotGroups, ['orderNumber', (g: MissionSlotGroup) => { return g.title.toUpperCase(); }], ['asc', 'asc']);

        const publicMissionSlotGroups = await Promise.map(missionSlotGroups, (slotGroup: MissionSlotGroup) => {
            return slotGroup.toPublicObject();
        });

        const slotUids = _.reduce(
            publicMissionSlotGroups,
            (uids: string[], slotGroup: IPublicMissionSlotGroup) => {
                return uids.concat(_.map(slotGroup.slots, (slot: IPublicMissionSlot) => {
                    return slot.uid;
                }));
            },
            []);

        let registrations: MissionSlotRegistration[] = [];
        if (!_.isNil(userUid)) {
            log.debug({ function: 'getMissionSlotList', slug, queryOptionsMission, userUid }, 'Retrieving registered slots for authenticated user');

            registrations = await MissionSlotRegistration.findAll({
                where: {
                    slotUid: {
                        $in: slotUids
                    },
                    userUid: userUid
                }
            });
        }

        _.each(publicMissionSlotGroups, (slotGroup: IPublicMissionSlotGroup) => {
            _.each(slotGroup.slots, (slot: IPublicMissionSlot) => {
                const registration = _.find(registrations, { slotUid: slot.uid });
                if (!_.isNil(registration)) {
                    slot.registrationUid = registration.uid;
                }
            });
        });

        return {
            slotGroups: publicMissionSlotGroups
        };
    })());
}

export function createMissionSlotGroup(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionSlotGroup', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.debug({ function: 'createMissionSlotGroup', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission slot group');

        const slotGroup = await mission.createSlotGroup(payload);

        log.debug(
            { function: 'createMissionSlotGroup', payload, userUid, missionUid: mission.uid, missionSlotGroupUid: slotGroup.uid },
            'Successfully created new mission slot group');

        const publicSlotGroup = await slotGroup.toPublicObject();

        return {
            slotGroup: publicSlotGroup
        };
    })());
}

export function updateMissionSlotGroup(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotGroupUid = request.params.slotGroupUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slotGroups = await mission.getSlotGroups({ where: { uid: slotGroupUid } });
        if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
            log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Mission slot group with given UID not found');
            throw Boom.notFound('Mission slot group not found');
        }
        const slotGroup = slotGroups[0];

        log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot group');

        await slotGroup.update(payload, { allowed: ['title', 'orderNumber', 'description'] });

        log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission slot group');

        const publicSlotGroup = await slotGroup.toPublicObject();

        return {
            slotGroup: publicSlotGroup
        };
    })());
}

export function deleteMissionSlotGroup(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotGroupUid = request.params.slotGroupUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slotGroups = await mission.getSlotGroups({ where: { uid: slotGroupUid } });
        if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Mission slot group with given UID not found');
            throw Boom.notFound('Mission slot group not found');
        }
        const slotGroup = slotGroups[0];

        log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Deleting mission slot group');

        await slotGroup.destroy();

        log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission slot group');

        return {
            success: true
        };
    })());
}

export function createMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionSlot', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.debug({ function: 'createMissionSlot', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission slots');

        return sequelize.transaction(async (t: Transaction) => {
            const slots = await Promise.map(payload, async (load: any) => {
                log.debug({ function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid }, 'Creating new mission slot');

                const slot = await mission.createSlot(load);

                log.debug(
                    { function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid, missionSlotUid: slot.uid },
                    'Successfully created new mission slot');

                return slot;
            });

            log.debug({ function: 'createMission', payload, userUid, missionUid: mission.uid, missionSlotCount: slots.length }, 'Successfully created new mission slots');

            const publicMissionSlots = await Promise.map(slots, (slot: MissionSlot) => {
                return slot.toPublicObject();
            });

            return {
                slots: publicMissionSlots
            };
        });
    })());
}

export function updateMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot');

        await slot.update(payload, { allowed: ['title', 'orderNumber', 'difficulty', 'description', 'detailedDescription', 'restricted', 'reserve'] });

        log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission slot');

        const publicMissionSlot = await slot.toPublicObject();

        return {
            slot: publicMissionSlot
        };
    })());
}

export function deleteMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Deleting mission slot');

        await slot.destroy();

        log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission slot');

        return {
            success: true
        };
    })());
}

export function getMissionSlotRegistrationList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        let userUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;
        }
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            where: { slotUid },
            order: [['slotUid', 'ASC'], ['createdAt', 'ASC']]
        };

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotRegistrations', slug, slotUid, userUid, queryOptions }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        let includeDetails: boolean = false;
        if (!_.isNil(userUid)) {
            const requiredPermissions = [`mission.${slug}.creator`, `mission.${slug}.editor`];
            const parsedPermissions = parsePermissions(request.auth.credentials.permissions);
            if (_.has(parsedPermissions, '*')) {
                log.debug(
                    { function: 'getMissionSlotRegistrationList', requiredPermissions, credentials: request.auth.credentials, userUid: userUid, hasPermission: true },
                    'User has global wildcard permission, returning slot registration details');

                includeDetails = true;
            }

            const foundPermissions: string[] = _.filter(requiredPermissions, (requiredPermission: string) => {
                return findPermission(parsedPermissions, requiredPermission);
            });

            if (foundPermissions.length > 0) {
                log.debug(
                    { function: 'getMissionSlotRegistrationList', requiredPermissions, credentials: request.auth.credentials, userUid: userUid, hasPermission: true },
                    'User has mission creator or editor permission, returning slot registration details');

                includeDetails = true;
            }
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'getMissionSlotRegistrations', slug, slotUid, userUid, queryOptions, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const result = await MissionSlotRegistration.findAndCountAll(queryOptions);

        const registrationCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + registrationCount) < result.count;
        const registrationList = await Promise.map(result.rows, (registration: MissionSlotRegistration) => {
            return registration.toPublicObject(includeDetails);
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: registrationCount,
            moreAvailable: moreAvailable,
            registrations: registrationList
        };
    })());
}

export function createMissionSlotRegistration(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        payload.userUid = userUid;

        const queryOptionsMission: any = {
            where: {
                slug,
                $or: [
                    {
                        creatorUid: userUid
                    },
                    {
                        visibility: 'public'
                    },
                    {
                        visibility: 'hidden',
                        $or: [
                            {
                                creatorUid: userUid
                            },
                            // tslint:disable-next-line:max-line-length
                            literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor' OR "permission" = '*')`)
                        ]
                    },
                    {
                        visibility: 'private',
                        creatorUid: userUid
                    }
                ]
            },
            attributes: ['uid']
        };

        if (!_.isNil(userCommunityUid)) {
            queryOptionsMission.where.$or.push({
                visibility: 'community',
                communityUid: userCommunityUid
            });
        }

        const mission = await Mission.findOne(queryOptionsMission);
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        if (!_.isNil(slot.restrictedCommunityUid) && !_.isEqual(userCommunityUid, slot.restrictedCommunityUid)) {
            log.debug(
                {
                    function: 'createMissionSlotRegistration',
                    slug, slotUid, payload, userUid, missionUid: mission.uid, userCommunityUid, restrictedCommunityUid: slot.restrictedCommunityUid
                },
                'User tried to register for a restricted slot, but is not member of the restricted community, rejecting');
            throw Boom.forbidden('Not a member of restricted community');
        }

        log.debug({ function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Creating new mission slot registration');

        let registration: MissionSlotRegistration;
        try {
            registration = await slot.createRegistration(payload);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                log.debug(
                    { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, err },
                    'Received unique constraint error during mission slot registration creation');

                throw Boom.conflict('Mission slot registration already exists');
            }

            log.warn(
                { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, err },
                'Received error during mission slot registration creation');
            throw err;
        }

        log.debug(
            { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, registrationUid: registration.uid },
            'Successfully created new mission slot registration');

        const publicMissionSlotRegistration = await registration.toPublicObject();

        return {
            registration: publicMissionSlotRegistration
        };
    })());
}

export function updateMissionSlotRegistration(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const registrationUid = request.params.registrationUid;
        const confirmed = request.payload.confirmed === true;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const registrations = await slot.getRegistrations({ where: { uid: registrationUid } });
        if (_.isNil(registrations) || _.isEmpty(registrations)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                'Mission slot registration with given UID not found');
            throw Boom.notFound('Mission slot registration not found');
        }
        const registration = registrations[0];

        return sequelize.transaction(async (t: Transaction) => {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                'Updating mission slot registration');

            if (confirmed && registration.confirmed) {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                    'Mission slot registration is already confirmed, silently ignoring update');
            } else if (confirmed && !registration.confirmed && !_.isNil(slot.assigneeUid)) {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                    'Mission slot already has assignee, rejecting confirmation');
                throw Boom.conflict('Mission slot already assigned');
            } else if (confirmed && !registration.confirmed && _.isNil(slot.assigneeUid)) {
                if (await mission.isUserAssignedToAnySlot(registration.userUid)) {
                    log.debug(
                        { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                        'User is already assigned to another slot, rejecting confirmation');
                    throw Boom.conflict('User already assigned to another slot');
                }

                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                    'Confirming mission slot registration');

                await Promise.all([
                    slot.setAssignee(registration.userUid),
                    registration.update({ confirmed })
                ]);

                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                    'Successfully confirmed mission slot registration');
            } else if (!confirmed && registration.confirmed) {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                    'Revoking mission slot registration confirmation');

                if (slot.assigneeUid === registration.userUid) {
                    await Promise.all([
                        slot.update({ assigneeUid: null }),
                        registration.update({ confirmed })
                    ]);

                    log.debug(
                        { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                        'Successfully revoked mission slot registration confirmation');
                } else {
                    log.debug(
                        { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                        'Mission slot assignee does not match registration user, only updating registration');

                    await registration.update({ confirmed });
                }
            } else {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                    'Mission slot registration already is not confirmed, silently ignoring update');
            }

            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                'Successfully updated mission slot registration');

            const publicMissionSlotRegistration = await registration.toPublicObject();

            return {
                registration: publicMissionSlotRegistration
            };
        });
    })());
}

export function deleteMissionSlotRegistration(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const registrationUid = request.params.registrationUid;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        const queryOptionsMission: any = {
            where: {
                slug,
                $or: [
                    {
                        creatorUid: userUid
                    },
                    {
                        visibility: 'public'
                    },
                    {
                        visibility: 'hidden',
                        $or: [
                            {
                                creatorUid: userUid
                            },
                            // tslint:disable-next-line:max-line-length
                            literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "Mission"."slug" || '.editor' OR "permission" = '*')`)
                        ]
                    },
                    {
                        visibility: 'private',
                        creatorUid: userUid
                    }
                ]
            },
            attributes: ['uid']
        };

        if (!_.isNil(userCommunityUid)) {
            queryOptionsMission.where.$or.push({
                visibility: 'community',
                communityUid: userCommunityUid
            });
        }

        const mission = await Mission.findOne(queryOptionsMission);
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlotRegistration', slug, slotUid, registrationUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const registrations = await slot.getRegistrations({ where: { uid: registrationUid } });
        if (_.isNil(registrations) || _.isEmpty(registrations)) {
            log.debug(
                { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid },
                'Mission slot registration with given UID not found');
            throw Boom.notFound('Mission slot registration not found');
        }
        const registration = registrations[0];

        if (registration.userUid !== userUid) {
            log.info(
                { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                'User tried to delete mission slot registration that was created by a different user, denying');
            throw Boom.forbidden();
        }

        return sequelize.transaction(async (t: Transaction) => {
            if (registration.confirmed) {
                log.debug(
                    { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid },
                    'Mission slot registration is confirmed, checking slot assignee');

                if (slot.assigneeUid === userUid) {
                    log.debug(
                        { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid },
                        'Mission slot assignee is current user, removing association and deleting mission slot registration');

                    await Promise.all([
                        slot.update({ assigneeUid: null }),
                        registration.destroy()
                    ]);
                } else {
                    log.debug(
                        { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                        'Mission slot assignee is different user, only deleting mission slot registration');

                    await registration.destroy();
                }
            } else {
                log.debug(
                    { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid },
                    'Mission slot registration is not confirmed, only deleting mission slot registration');

                await registration.destroy();
            }

            log.debug(
                { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid },
                'Successfully deleted mission slot registration');

            return {
                success: true
            };
        });
    })());
}
