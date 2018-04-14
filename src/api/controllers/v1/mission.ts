import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { col, fn, literal, Transaction } from 'sequelize';
import * as urlJoin from 'url-join';
import * as uuid from 'uuid';

import { Community } from '../../../shared/models/Community';
import { Mission, MISSION_VISIBILITY_PRIVATE } from '../../../shared/models/Mission';
import { MissionAccess } from '../../../shared/models/MissionAccess';
import { IMissionSlotCreatePayload, IPublicMissionSlot, MissionSlot } from '../../../shared/models/MissionSlot';
import { IPublicMissionSlotGroup, MissionSlotGroup } from '../../../shared/models/MissionSlotGroup';
import { MissionSlotRegistration } from '../../../shared/models/MissionSlotRegistration';
import { IMissionSlotTemplateSlot, IMissionSlotTemplateSlotGroup, MissionSlotTemplate } from '../../../shared/models/MissionSlotTemplate';
import { Permission } from '../../../shared/models/Permission';
import { User } from '../../../shared/models/User';
import { instance as ImageService, MISSION_IMAGE_PATH } from '../../../shared/services/ImageService';
import { hasPermission } from '../../../shared/util/acl';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
// tslint:disable-next-line:import-name
import slugger from '../../../shared/util/slug';
const log = logger.child({ route: 'mission', routeVersion: 'v1' });

/**
 * Handlers for V1 of mission endpoints
 */

export function getMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
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
            order: [['startTime', 'ASC'], [fn('UPPER', col('title')), 'ASC']]
        };

        if (_.isNil(userUid)) {
            queryOptions.where = {
                visibility: 'public'
            };
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info({ function: 'getMissionList', userUid, hasPermission: true }, 'User has mission admin permissions, returning all missions');
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

        if (_.isNil(request.query.startDate)) {
            if (!_.isNil(request.query.search)) {
                queryOptions.where.title = {
                    $iLike: `%${request.query.search}%`
                };

                if (!_.isNil(request.query.communityUid)) {
                    queryOptions.where.communityUid = request.query.communityUid;
                } else if (!_.isNil(request.query.creatorUid)) {
                    queryOptions.where.creatorUid = request.query.creatorUid;
                }

                log.debug({ function: 'getMissionList', queryOptions, userUid }, 'Including search parameter in query options');
            } else if (request.query.includeEnded === false) {
                queryOptions.where.endTime = {
                    $gt: moment.utc()
                };
            }

            queryOptions.limit = request.query.limit;
            queryOptions.offset = request.query.offset;

            const result = await Mission.findAndCountAll(queryOptions);

            const missionCount = result.rows.length;
            const moreAvailable = (queryOptions.offset + missionCount) < result.count;
            const missionList = await Promise.map(result.rows, async (mission: Mission) => {
                const publicMission = await mission.toPublicObject(userUid, userCommunityUid);

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
        } else {
            if (_.isNil(request.query.endDate)) {
                throw Boom.badRequest('Mission filter end date must be provided if start date is set');
            }

            queryOptions.where.startTime = {
                $gte: moment(request.query.startDate).utc()
            };
            queryOptions.where.endTime = {
                $lte: moment(request.query.endDate).utc()
            };

            const missions = await Mission.findAll(queryOptions);

            const missionList = await Promise.map(missions, async (mission: Mission) => {
                const publicMission = await mission.toPublicObject(userUid, userCommunityUid);

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
                startDate: request.query.startDate,
                endDate: request.query.endDate,
                missions: missionList
            };
        }
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

        if (_.isString(payload.collapsedDescription) && !_.isEmpty(payload.collapsedDescription)) {
            payload.collapsedDescription = await ImageService.parseMissionDescription(payload.slug, payload.collapsedDescription);
        }

        payload.detailedDescription = await ImageService.parseMissionDescription(payload.slug, payload.detailedDescription);

        // Ensure list of required DLCs is always sorted/displayed the same way
        payload.requiredDLCs = _.sortBy(payload.requiredDLCs);

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
        const missionToken: string | null = request.query.missionToken;

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

        if (!_.isNil(missionToken)) {
            log.debug({ function: 'getMissionDetails', slug, userUid }, 'Mission token provided, using for mission visibility check');

            queryOptions.where.missionToken = missionToken;
        } else if (_.isNil(userUid)) {
            queryOptions.where.visibility = 'public';
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info({ function: 'getMissionDetails', slug, userUid, hasPermission: true }, 'User has mission admin permissions, returning mission details');
        } else {
            queryOptions.where.$or = [
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
            ];

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

        const mission = await Mission.findOne(queryOptions);
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionDetails', slug }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const detailedPublicMission = await mission.toDetailedPublicObject(userUid, userCommunityUid);

        return {
            mission: detailedPublicMission
        };
    })());
}

export function updateMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const suppressNotifications = request.payload.suppressNotifications === true;
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
            log.debug({ function: 'updateMission', slug, payload, suppressNotifications, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.debug({ function: 'updateMission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid }, 'Updating mission');

        if (_.isString(payload.collapsedDescription) && !_.isEmpty(payload.collapsedDescription)) {
            payload.collapsedDescription = await ImageService.parseMissionDescription(slug, payload.collapsedDescription);
        }
        if (_.isString(payload.detailedDescription) && !_.isEmpty(payload.detailedDescription)) {
            payload.detailedDescription = await ImageService.parseMissionDescription(slug, payload.detailedDescription);
        }

        let notifyUpdate: boolean = false;
        if ((!_.isNil(payload.briefingTime) && !moment(payload.briefingTime).isSame(mission.briefingTime)) ||
            (!_.isNil(payload.endTime) && !moment(payload.endTime).isSame(mission.endTime)) ||
            (!_.isNil(payload.slottingTime) && !moment(payload.slottingTime).isSame(mission.slottingTime)) ||
            (!_.isNil(payload.startTime) && !moment(payload.startTime).isSame(mission.startTime))) {
            notifyUpdate = true;
        }

        if (!_.isEmpty(payload.requiredDLCs)) {
            // Ensure list of required DLCs is always sorted/displayed the same way
            payload.requiredDLCs = _.sortBy(payload.requiredDLCs);
        }

        await mission.update(payload, {
            fields: [
                'title',
                'collapsedDescription',
                'detailedDescription',
                'description',
                'briefingTime',
                'slottingTime',
                'startTime',
                'endTime',
                'techSupport',
                'rules',
                'visibility',
                'gameServer',
                'voiceComms',
                'repositories',
                'slotsAutoAssignable',
                'requiredDLCs'
            ]
        });

        if (notifyUpdate && !suppressNotifications) {
            try {
                await mission.createMissionUpdatedNotifications();
            } catch (err) {
                log.warn(
                    { function: 'updateMission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid, err },
                    'Received error during mission updated notifications creation');
            }
        }

        log.debug({ function: 'updateMission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid }, 'Successfully updated mission');

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
            log.debug({ function: 'deleteMission', slug, userUid, missionUid: mission.uid }, 'Deleting mission');

            try {
                await mission.createMissionDeletedNotifications();
            } catch (err) {
                log.warn({ function: 'deleteMission', slug, userUid, missionUid: mission.uid, err }, 'Received error during mission deleted notifications creation');
            }

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

export function getMissionAccessList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
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
                },
                {
                    model: Community,
                    as: 'community'
                }
            ]
        };

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'getMissionAccessList', slug, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionAccessList', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        queryOptions.where = {
            missionUid: mission.uid
        };

        const result = await MissionAccess.findAndCountAll(queryOptions);

        const accessCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + accessCount) < result.count;
        const accessList = await Promise.map(result.rows, async (access: MissionAccess) => {
            return access.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: accessCount,
            total: result.count,
            moreAvailable: moreAvailable,
            accesses: accessList
        };
    })());
}

export function createMissionAccess(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionAccess', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        let targetCommunity: Community | null = null;
        if (!_.isNil(payload.communityUid)) {
            targetCommunity = await Community.findById(payload.communityUid, { attributes: ['uid'] });
            if (_.isNil(targetCommunity)) {
                log.debug({ function: 'createMissionAccess', slug, payload, userUid, missionUid: mission.uid }, 'Community with given UID not found for mission access');
                throw Boom.notFound('Community not found');
            }
        }

        let targetUser: User | null = null;
        if (!_.isNil(payload.userUid)) {
            targetUser = await User.findById(payload.userUid, { attributes: ['uid'] });
            if (_.isNil(targetUser)) {
                log.debug({ function: 'createMissionAccess', slug, payload, userUid, missionUid: mission.uid }, 'User with given UID not found for mission access');
                throw Boom.notFound('User not found');
            }
        }

        log.debug({ function: 'createMissionAccess', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission access');

        let missionAccess: MissionAccess;
        try {
            missionAccess = await MissionAccess.create({
                missionUid: mission.uid,
                communityUid: _.isNil(payload.communityUid) ? null : payload.communityUid,
                userUid: _.isNil(payload.userUid) ? null : payload.userUid
            });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                throw Boom.conflict('Mission access already exists');
            }

            throw err;
        }

        log.debug(
            { function: 'createMissionAccess', payload, userUid, missionUid: mission.uid, accessUid: missionAccess.uid },
            'Successfully created new mission access');

        const publicAccess = await missionAccess.toPublicObject();

        return {
            access: publicAccess
        };
    })());
}

export function deleteMissionAccess(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const missionAccessUid = request.params.missionAccessUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionAccess', slug, missionAccessUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const missionAccess = await MissionAccess.findOne({ where: { uid: missionAccessUid, missionUid: mission.uid } });
        if (_.isNil(missionAccess)) {
            log.debug({ function: 'deleteMissionAccess', slug, missionAccessUid, userUid, missionUid: mission.uid }, 'Mission access with given UID not found');
            throw Boom.notFound('Mission access not found');
        }

        log.debug({ function: 'deleteMissionAccess', slug, missionAccessUid, userUid, missionUid: mission.uid }, 'Deleting mission access');

        await missionAccess.destroy();

        log.debug({ function: 'deleteMissionAccess', slug, missionAccessUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission access');

        return {
            success: true
        };
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

export function duplicateMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        let payload = request.payload;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        if (payload.slug === 'slugAvailable') {
            log.debug({ function: 'duplicateMission', payload, userUid }, 'Received `slugAvailable` slug, rejecting');

            throw Boom.badRequest('Disallowed slug');
        }

        // Make sure payload is properly "slugged"
        payload.slug = slugger(payload.slug);

        const user = await User.findById(userUid, { include: [{ model: Community, as: 'community' }] });
        if (_.isNil(user)) {
            log.debug({ function: 'duplicateMission', payload, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        const currentMission = await Mission.findOne({
            where: { slug },
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: User,
                    as: 'creator'
                },
                {
                    model: MissionSlotGroup,
                    as: 'slotGroups',
                    include: [
                        {
                            model: MissionSlot,
                            as: 'slots'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(currentMission)) {
            log.debug({ function: 'duplicateMission', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        payload.creatorUid = userUid;
        payload = _.defaults(payload, (<any>currentMission).dataValues);

        if (!_.isNil(payload.addToCommunity)) {
            if (payload.addToCommunity === true && !_.isNil(userCommunityUid)) {
                payload.communityUid = userCommunityUid;
            } else if (payload.addToCommunity === false) {
                payload.communityUid = undefined;
                delete payload.communityUid;
            }

            payload.addToCommunity = undefined;
            delete payload.addToCommunity;
        } else if (!_.isNil(currentMission.communityUid)) {
            payload.communityUid = currentMission.communityUid;
        }

        payload.uid = undefined;
        delete payload.uid;

        if (_.isNil(payload.title)) {
            payload.title = currentMission.title;
        }
        if (_.isNil(payload.briefingTime)) {
            payload.briefingTime = currentMission.briefingTime;
        }
        if (_.isNil(payload.endTime)) {
            payload.endTime = currentMission.endTime;
        }
        if (_.isNil(payload.slottingTime)) {
            payload.slottingTime = currentMission.slottingTime;
        }
        if (_.isNil(payload.startTime)) {
            payload.startTime = currentMission.startTime;
        }

        // tslint:disable-next-line:max-func-body-length
        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid }, 'Duplicating mission');

            let mission: Mission;
            try {
                mission = await Mission.create(payload);
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug(
                        { function: 'duplicateMission', slug, payload, userUid, currentMissionUid: currentMission.uid, err },
                        'Received unique constraint error during mission duplication');

                    throw Boom.conflict('Mission slug already exists');
                }

                log.warn({ function: 'duplicateMission', slug, payload, userUid, currentMissionUid: currentMission.uid, err }, 'Received error during mission duplication');
                throw err;
            }

            log.debug(
                { function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid },
                'Created new mission, duplicating slot groups and slots');

            if (_.isNil(currentMission.slotGroups)) {
                currentMission.slotGroups = await currentMission.getSlotGroups();
            }

            await Promise.map(currentMission.slotGroups, async (currentSlotGroup: MissionSlotGroup) => {
                log.debug(
                    { function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid, currentSlotGroupUid: currentSlotGroup.uid },
                    'Duplicating slot group');

                const slotGroupPayload = (<any>currentSlotGroup).dataValues;
                slotGroupPayload.uid = undefined;
                delete slotGroupPayload.uid;

                const slotGroup = await mission.createSlotGroup(slotGroupPayload);

                log.debug(
                    {
                        function: 'duplicateMission',
                        slug,
                        userUid,
                        currentMissionUid: currentMission.uid,
                        missionUid: mission.uid,
                        currentSlotGroupUid: currentSlotGroup.uid,
                        slotGroupUid: slotGroup.uid
                    },
                    'Created new mission slot group, duplicating slots');

                if (_.isNil(currentSlotGroup.slots)) {
                    currentSlotGroup.slots = await currentSlotGroup.getSlots();
                }

                await Promise.map(currentSlotGroup.slots, async (currentSlot: MissionSlot) => {
                    log.debug(
                        {
                            function: 'duplicateMission',
                            slug,
                            userUid,
                            currentMissionUid: currentMission.uid,
                            missionUid: mission.uid,
                            currentSlotGroupUid: currentSlotGroup.uid,
                            slotGroupUid: slotGroup.uid,
                            currentSlotUid: currentSlot.uid
                        },
                        'Duplicating mission slot');

                    const slotPayload = (<any>currentSlot).dataValues;
                    slotPayload.uid = undefined;
                    delete slotPayload.uid;

                    if (!_.isNil(slotPayload.assigneeUid)) {
                        slotPayload.assigneeUid = null;
                    }

                    const slot = await slotGroup.createSlot(slotPayload);

                    log.debug(
                        {
                            function: 'duplicateMission',
                            slug,
                            userUid,
                            currentMissionUid: currentMission.uid,
                            missionUid: mission.uid,
                            currentSlotGroupUid: currentSlotGroup.uid,
                            slotGroupUid: slotGroup.uid,
                            currentSlotUid: currentSlot.uid,
                            slotUid: slot.uid
                        },
                        'Duplicated mission slot');
                });
            });

            await mission.recalculateSlotOrderNumbers();

            log.debug(
                { function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid },
                'Created new mission, adding user as creator');

            try {
                await user.createPermission({ permission: `mission.${mission.slug}.creator` });
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    log.debug(
                        { function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid, err },
                        'Received unique constraint error during creator permission creation');

                    throw Boom.conflict('Mission creator permission already exists');
                }

                log.warn(
                    { function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid, err },
                    'Received error during creator permission creation');
                throw err;
            }

            log.debug({ function: 'duplicateMission', slug, userUid, currentMissionUid: currentMission.uid, missionUid: mission.uid }, 'Successfully duplicated mission');

            const detailedPublicMission = await mission.toDetailedPublicObject();
            const token = await user.generateJWT();

            return {
                mission: detailedPublicMission,
                token: token
            };
        });
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

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
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
        const suppressNotifications = request.payload.suppressNotifications === true;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionPermission', slug, payload, suppressNotifications, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        if (!Permission.isValidMissionPermission(slug, payload.permission)) {
            log.warn(
                { function: 'createMissionPermission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid },
                'Tried to create invalid mission permission, rejecting');
            throw Boom.badRequest('Invalid mission permission');
        }

        const targetUser = await User.findOne({ where: { uid: payload.userUid }, attributes: ['uid', 'nickname', 'communityUid'] });
        if (_.isNil(targetUser)) {
            log.debug(
                { function: 'createMissionPermission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid },
                'Mission permission target user with given UID not found');
            throw Boom.notFound('User not found');
        }

        log.debug({ function: 'createMissionPermission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid }, 'Creating new mission permission');

        let permission: Permission;
        try {
            permission = await Permission.create({ userUid: payload.userUid, permission: payload.permission });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                throw Boom.conflict('Mission permission already exists');
            }

            throw err;
        }

        if (!suppressNotifications) {
            try {
                await mission.createPermissionNotification(targetUser, payload.permission, true);
            } catch (err) {
                log.warn(
                    { function: 'createMissionPermission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid, permissionUid: permission.uid, err },
                    'Received error during mission permission granted notification creation');
            }
        }

        log.debug(
            { function: 'createMissionPermission', slug, payload, suppressNotifications, userUid, missionUid: mission.uid, permissionUid: permission.uid },
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

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const permission = await Permission.findOne({
            where: {
                uid: permissionUid,
                permission: {
                    $or: [`mission.${slug}.editor`, `mission.${slug}.slotlist.community`]
                }
            }
        });
        if (_.isNil(permission)) {
            log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Mission permission with given UID not found');
            throw Boom.notFound('Mission permission not found');
        }

        log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Deleting mission permission');

        const permissionUserUid = permission.userUid;
        const permissionPermission = permission.permission;

        await permission.destroy();

        try {
            await mission.createPermissionNotification(permissionUserUid, permissionPermission, false);
        } catch (err) {
            log.warn(
                { function: 'createMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid },
                'Received error during mission permission revoked notification creation');
        }

        log.debug({ function: 'deleteMissionPermission', slug, permissionUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission permission');

        return {
            success: true
        };
    })());
}

export function getMissionSlotList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
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
        const missionToken: string | null = request.query.missionToken;

        const queryOptionsMission: any = {
            where: { slug },
            attributes: ['uid']
        };

        if (!_.isNil(missionToken)) {
            log.debug({ function: 'getMissionSlotList', slug, userUid }, 'Mission token provided, using for mission visibility check');

            queryOptionsMission.where.missionToken = missionToken;
        } else if (_.isNil(userUid)) {
            queryOptionsMission.where.visibility = 'public';
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info({ function: 'getMissionSlotList', slug, userUid, hasPermission: true }, 'User has mission admin permissions, returning full mission list');
        } else {
            queryOptionsMission.where.$or = [
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
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptionsMission.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });

                // $or[3] === visibility: 'private', add check for user's community UID.
                // Has to be done after userCommunityUid has been checked for `null` since every mission access entry granted to a user has `communityUid: null`,
                // which would result in incorrect access being granted for communities
                queryOptionsMission.where.$or[3].$or.push(
                    // tslint:disable-next-line:max-line-length
                    literal(`${sequelize.escape(userCommunityUid)} IN (SELECT "communityUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "communityUid" = ${sequelize.escape(userCommunityUid)})`)
                );
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

        const currentSlotGroups = _.sortBy(await mission.getSlotGroups(), 'orderNumber');
        const orderNumber = payload.insertAfter + 1;

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'createMissionSlotGroup', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission slot group');

            if (payload.insertAfter !== currentSlotGroups.length) {
                log.debug({ function: 'createMissionSlotGroup', slug, payload, userUid, missionUid: mission.uid }, 'Mission slot group will be inserted in between current groups');

                await Promise.map(currentSlotGroups, (slotGroup: MissionSlotGroup) => {
                    if (slotGroup.orderNumber < orderNumber) {
                        return slotGroup;
                    }

                    return slotGroup.increment('orderNumber');
                });
            }

            const newSlotGroup = await mission.createSlotGroup({
                title: payload.title,
                description: payload.description,
                orderNumber
            });

            log.debug(
                { function: 'createMissionSlotGroup', slug, payload, userUid, missionUid: mission.uid, missionSlotGroupUid: newSlotGroup.uid },
                'Successfully created new mission slot group');

            const publicSlotGroup = await newSlotGroup.toPublicObject();

            return {
                slotGroup: publicSlotGroup
            };
        });
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

        return sequelize.transaction(async (t: Transaction) => {
            if (_.isNil(payload.moveAfter)) {
                log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot group');
                await slotGroup.update(payload, { fields: ['title', 'description'] });
            } else {
                log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid }, 'Reordering mission slot group');

                const currentSlotGroups = _.sortBy(await mission.getSlotGroups(), 'orderNumber');
                const oldOrderNumber = slotGroup.orderNumber;
                const increment = payload.moveAfter < oldOrderNumber;
                const orderNumber = increment ? payload.moveAfter + 1 : payload.moveAfter; // Moving a slot group from a higher order number to a lower one requires a +1 addition

                await Promise.each(currentSlotGroups, (group: MissionSlotGroup) => {
                    if (group.orderNumber === oldOrderNumber) {
                        // Skip update of actually affected group, will be done in separate call later
                        return group;
                    }

                    if (increment && group.orderNumber >= orderNumber && group.orderNumber < oldOrderNumber) {
                        return group.increment('orderNumber');
                    } else if (!increment && group.orderNumber <= orderNumber && group.orderNumber > oldOrderNumber) {
                        return group.decrement('orderNumber');
                    } else {
                        // Slot groups unaffected by change remain unmodified
                        return group;
                    }
                });

                payload.orderNumber = orderNumber;

                await slotGroup.update(payload, { fields: ['title', 'description', 'orderNumber'] });

                log.debug(
                    { function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid, orderNumber, oldOrderNumber },
                    'Successfully reordered mission slot group, recalculating mission slot order numbers');

                await mission.recalculateSlotOrderNumbers();
            }

            log.debug({ function: 'updateMissionSlotGroup', slug, slotGroupUid, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission slot group');

            const publicSlotGroup = await slotGroup.toPublicObject();

            return {
                slotGroup: publicSlotGroup
            };
        });
    })());
}

export function deleteMissionSlotGroup(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotGroupUid = request.params.slotGroupUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slotGroups = _.sortBy(await mission.getSlotGroups(), 'orderNumber');
        const slotGroup = _.find(slotGroups, { uid: slotGroupUid });
        if (_.isNil(slotGroup)) {
            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Mission slot group with given UID not found');
            throw Boom.notFound('Mission slot group not found');
        }

        const orderNumber = slotGroup.orderNumber;

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Deleting mission slot group');

            const slotsWithAssignees = await MissionSlot.findAll({
                where: {
                    slotGroupUid: slotGroup.uid,
                    $not: {
                        assigneeUid: null
                    }
                },
                attributes: ['assigneeUid', 'title']
            });

            await slotGroup.destroy();

            let slotGroupOrderNumber = 1;
            const slotGroupsToUpdate: MissionSlotGroup[] = [];
            _.each(slotGroups, (group: MissionSlotGroup) => {
                if (group.orderNumber === orderNumber) {
                    return;
                }

                if (group.orderNumber !== slotGroupOrderNumber) {
                    slotGroupsToUpdate.push(group.set({ orderNumber: slotGroupOrderNumber }));
                }

                slotGroupOrderNumber += 1;
            });

            await Promise.map(slotGroupsToUpdate, (group: MissionSlotGroup) => {
                return group.save();
            });

            if (!_.isEmpty(slotsWithAssignees)) {
                try {
                    await Promise.map(slotsWithAssignees, (slot: MissionSlot) => {
                        return mission.createSlotAssignmentChangedNotification(<string>slot.assigneeUid, slot.title, false);
                    });
                } catch (err) {
                    log.warn(
                        { function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid, orderNumber, err },
                        'Received error during mission slot unassignment notification creation');
                }
            }

            log.debug(
                { function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid, orderNumber },
                'Successfully adapted mission slot group ordering, recalculating mission slot order numbers');

            await mission.recalculateSlotOrderNumbers();

            log.debug({ function: 'deleteMissionSlotGroup', slug, slotGroupUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission slot group');

            return {
                success: true
            };
        });
    })());
}

export function createMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'visibility', 'slotsAutoAssignable'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionSlot', slug, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        if (!payload.autoAssignable && mission.slotsAutoAssignable && !payload.duplicate) {
            log.debug({ function: 'createMissionSlot', slug, payload, userUid }, 'Mission has auto-assignable setting enabled, marking slot as auto-assignable');
            payload.autoAssignable = true;
        }

        // Ensure list of required DLCs is always sorted/displayed the same way
        payload.requiredDLCs = _.sortBy(payload.requiredDLCs);

        log.debug({ function: 'createMissionSlot', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission slots');

        return sequelize.transaction(async (t: Transaction) => {
            const slots = await Promise.mapSeries(payload, async (load: IMissionSlotCreatePayload) => {
                log.debug({ function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid }, 'Creating new mission slot');

                const slot = await mission.createSlot(load);

                log.debug(
                    { function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid, missionSlotUid: slot.uid },
                    'Successfully created new mission slot');

                return slot;
            });

            log.debug({ function: 'createMissionSlot', payload, userUid, missionUid: mission.uid, missionSlotCount: slots.length }, 'Recalculating mission slot order numbers');

            await mission.recalculateSlotOrderNumbers();

            const restrictedCommunityUids = (<string[]>_.filter(_.map(slots, 'restrictedCommunityUid'), (uid: string | null) => !_.isNil(uid)));
            if (!_.isEmpty(restrictedCommunityUids) && mission.visibility === MISSION_VISIBILITY_PRIVATE) {
                await Promise.map(restrictedCommunityUids, async (restrictedCommunityUid: string) => {
                    log.debug(
                        { function: 'createMissionSlot', slug, payload, userUid, missionUid: mission.uid, communityUid: restrictedCommunityUid },
                        'Mission slot payload contained restricted community UID and mission is private, checking if mission access already exists for community');

                    const missionAccessCount = await MissionAccess.count({ where: { missionUid: mission.uid, communityUid: restrictedCommunityUid } });
                    if (missionAccessCount === 0) {
                        log.debug(
                            { function: 'createMissionSlot', slug, payload, userUid, missionUid: mission.uid, communityUid: payload.restrictedCommunityUid },
                            'Mission access does not exist for community provided in mission slot payload, creating');

                        await MissionAccess.create({
                            missionUid: mission.uid,
                            communityUid: restrictedCommunityUid
                        });
                    }
                });
            }

            log.debug({ function: 'createMissionSlot', payload, userUid, missionUid: mission.uid, missionSlotCount: slots.length }, 'Successfully created new mission slots');

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
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'visibility'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        if (!_.isNil(slot.assigneeUid) && !_.isNil(payload.externalAssignee)) {
            log.debug(
                { function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid },
                'User tried to assign an external assignee to a slot with an assignee, rejecting');
            throw Boom.conflict('Mission slot can only either have assignee or external assignee');
        }

        return sequelize.transaction(async (t: Transaction) => {
            // Ensure list of required DLCs is always sorted/displayed the same way
            payload.requiredDLCs = _.sortBy(payload.requiredDLCs);

            if (_.isNil(payload.moveAfter)) {
                log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot');

                await slot.update(payload, {
                    fields: [
                        'title',
                        'difficulty',
                        'description',
                        'detailedDescription',
                        'restrictedCommunityUid',
                        'reserve',
                        'blocked',
                        'autoAssignable',
                        'requiredDLCs',
                        'externalAssignee'
                    ]
                });
            } else {
                log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Reordering mission slot');

                const slotGroups = await mission.getSlotGroups({ where: { uid: slot.slotGroupUid } });
                if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
                    log.debug(
                        { function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid, slotGroupUid: slot.slotGroupUid },
                        'Mission slot group with given UID not found');
                    throw Boom.notFound('Mission slot group not found');
                }
                const slotGroup = slotGroups[0];

                const currentSlots = _.sortBy(await slotGroup.getSlots(), 'orderNumber');
                const oldOrderNumber = slot.orderNumber;
                const increment = payload.moveAfter < oldOrderNumber;
                const orderNumber = increment ? payload.moveAfter + 1 : payload.moveAfter; // Moving a slot from a higher order number to a lower one requires a +1 addition

                await Promise.each(currentSlots, (missionSlot: MissionSlot) => {
                    if (missionSlot.orderNumber === oldOrderNumber) {
                        // Skip update of actually affected slot, will be done in separate call later
                        return missionSlot;
                    }

                    if (increment && missionSlot.orderNumber >= orderNumber && missionSlot.orderNumber < oldOrderNumber) {
                        return missionSlot.increment('orderNumber');
                    } else if (!increment && missionSlot.orderNumber <= orderNumber && missionSlot.orderNumber > oldOrderNumber) {
                        return missionSlot.decrement('orderNumber');
                    } else {
                        // Slots unaffected by change remain unmodified
                        return missionSlot;
                    }
                });

                payload.orderNumber = orderNumber;

                await slot.update(payload, {
                    fields: [
                        'title',
                        'difficulty',
                        'description',
                        'detailedDescription',
                        'restrictedCommunityUid',
                        'reserve',
                        'blocked',
                        'autoAssignable',
                        'orderNumber',
                        'requiredDLCs',
                        'externalAssignee'
                    ]
                });

                log.debug(
                    { function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid, orderNumber, oldOrderNumber },
                    'Successfully reordered mission slot, recalculating mission slot order numbers');

                await mission.recalculateSlotOrderNumbers();
            }

            if (!_.isNil(payload.restrictedCommunityUid) && mission.visibility === MISSION_VISIBILITY_PRIVATE) {
                log.debug(
                    { function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid, communityUid: payload.restrictedCommunityUid },
                    'Mission slot payload contained restricted community UID and mission is private, checking if mission access already exists for community');

                const missionAccessCount = await MissionAccess.count({ where: { missionUid: mission.uid, communityUid: payload.restrictedCommunityUid } });
                if (missionAccessCount === 0) {
                    log.debug(
                        { function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid, communityUid: payload.restrictedCommunityUid },
                        'Mission access does not exist for community provided in mission slot payload, creating');

                    await MissionAccess.create({
                        missionUid: mission.uid,
                        communityUid: payload.restrictedCommunityUid
                    });
                }
            }

            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission slot');

            const publicMissionSlot = await slot.toPublicObject();

            return {
                slot: publicMissionSlot
            };
        });
    })());
}

export function deleteMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const orderNumber = slot.orderNumber;

        const slotGroups = await mission.getSlotGroups({ where: { uid: slot.slotGroupUid } });
        if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
            log.debug(
                { function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid, slotGroupUid: slot.slotGroupUid },
                'Mission slot group with given UID not found');
            throw Boom.notFound('Mission slot group not found');
        }
        const slotGroup = slotGroups[0];

        const currentSlots = _.orderBy(await slotGroup.getSlots(), 'orderNumber');

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Deleting mission slot');

            const slotAssigneeUid = slot.assigneeUid;
            const slotTitle = slot.title;

            await slot.destroy();

            let slotOrderNumber = 1;
            const slotsToUpdate: MissionSlot[] = [];
            _.each(currentSlots, (missionSlot: MissionSlot) => {
                if (missionSlot.orderNumber === orderNumber) {
                    return;
                }

                if (missionSlot.orderNumber !== slotOrderNumber) {
                    slotsToUpdate.push(missionSlot.set({ orderNumber: slotOrderNumber }));
                }

                slotOrderNumber += 1;
            });

            await Promise.map(slotsToUpdate, (missionSlot: MissionSlot) => {
                return missionSlot.save();
            });

            log.debug(
                { function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid, orderNumber },
                'Successfully adapted mission slot ordering, recalculating mission slot order numbers');

            await mission.recalculateSlotOrderNumbers();

            if (!_.isNil(slotAssigneeUid)) {
                try {
                    await mission.createSlotAssignmentChangedNotification(slotAssigneeUid, slotTitle, false);
                } catch (err) {
                    log.warn(
                        { function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid, err },
                        'Received error during mission slot unassignment notification creation');
                }
            }

            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Successfully deleted mission slot');

            return {
                success: true
            };
        });
    })());
}

export function assignMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;
        const userNickname = request.auth.credentials.user.nickname;
        const targetUserUid = request.payload.userUid;
        const forceAssignment = request.payload.force;
        const suppressNotifications = request.payload.suppressNotifications === true;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug(
                { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        if (slot.blocked) {
            log.debug(
                { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                'User tried to assign to a blocked slot, rejecting');
            throw Boom.notFound('Mission slot is blocked');
        }

        const targetUser = await User.findById(targetUserUid);
        if (_.isNil(targetUser)) {
            log.debug(
                { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                'User with given UID not found');
            throw Boom.notFound('User not found');
        }

        const targetUserAssignedSlot = await MissionSlot.findOne({
            where: {
                assigneeUid: targetUserUid
            },
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                slug
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        return sequelize.transaction(async (t: Transaction) => {
            if (!forceAssignment) {
                if (!_.isNil(slot.assigneeUid)) {
                    log.debug(
                        {
                            function: 'assignMissionSlot',
                            slug,
                            slotUid,
                            userUid,
                            targetUserUid,
                            forceAssignment,
                            suppressNotifications,
                            missionUid: mission.uid,
                            previousAssigneeUid: slot.assigneeUid
                        },
                        'Slot has previous assignee and force assignment is disabled, rejecting');
                    throw Boom.conflict('Mission slot already assigned');
                } else if (!_.isNil(targetUserAssignedSlot)) {
                    log.debug(
                        {
                            function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid,
                            assignedSlotUid: targetUserAssignedSlot.uid
                        },
                        'Target user is already assigned and force assignment is disabled, rejecting');
                    throw Boom.conflict('User already assigned to another slot');
                } else if (!_.isNil(slot.externalAssignee)) {
                    log.debug(
                        { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                        'Slot already has external assignee and force assignment is disabled, rejecting');
                    throw Boom.conflict('Mission slot can only either have assignee or external assignee');
                }
            } else {
                if (!_.isNil(slot.assigneeUid)) {
                    log.debug(
                        {
                            function: 'assignMissionSlot',
                            slug,
                            slotUid,
                            userUid,
                            targetUserUid,
                            forceAssignment,
                            suppressNotifications,
                            missionUid: mission.uid,
                            previousAssigneeUid: slot.assigneeUid
                        },
                        'Slot has previous assignee, removing association and updating registration');

                    await Promise.all([
                        slot.update({ assigneeUid: null }),
                        MissionSlotRegistration.update({ confirmed: false }, { where: { slotUid } })
                    ]);
                } else if (!_.isNil(slot.externalAssignee)) {
                    log.debug(
                        { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                        'Slot already has external assignee, removing before assignment');
                    await slot.update({ externalAssignee: null });
                }

                if (!_.isNil(targetUserAssignedSlot)) {
                    log.debug(
                        {
                            function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid,
                            assignedSlotUid: targetUserAssignedSlot.uid
                        },
                        'Target user is already assigned, removing association and updating registration');

                    await Promise.all([
                        targetUserAssignedSlot.update({ assigneeUid: null }),
                        MissionSlotRegistration.update({ confirmed: false }, { where: { slotUid: targetUserAssignedSlot.uid } })
                    ]);
                }
            }

            log.debug(
                { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                'Assigning mission slot');

            await Promise.all([
                MissionSlotRegistration.upsert({
                    slotUid,
                    userUid: targetUserUid,
                    confirmed: true,
                    comment: `Assigned by mission editor '${userNickname}'`
                }), // run an upsert here since the user might already have a registration for the selected slot
                slot.update({ assigneeUid: targetUserUid })
            ]);

            if (!suppressNotifications) {
                try {
                    await mission.createSlotAssignmentChangedNotification(targetUserUid, slot.title, true);
                } catch (err) {
                    log.warn(
                        { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid, err },
                        'Received error during mission slot assignment notification creation');
                }
            }

            log.debug(
                { function: 'assignMissionSlot', slug, slotUid, userUid, targetUserUid, forceAssignment, suppressNotifications, missionUid: mission.uid },
                'Successfully assigned mission slot');

            const publicMissionSlot = await slot.toPublicObject();

            return {
                slot: publicMissionSlot
            };
        });
    })());
}

export function getMissionSlotRegistrationList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
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
            where: { slotUid },
            order: [['slotUid', 'ASC'], ['createdAt', 'ASC']],
            include: [
                {
                    model: MissionSlot,
                    as: 'slot',
                    attributes: ['restrictedCommunityUid']
                }
            ]
        };

        const queryOptionsMission: any = {
            where: { slug },
            attributes: ['uid']
        };

        if (_.isNil(userUid)) {
            queryOptionsMission.where.visibility = 'public';
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info(
                { function: 'getMissionSlotRegistrationList', slug, slotUid, userUid, hasPermission: true },
                'User has mission admin permissions, returning all mission slot registrations');
        } else {
            queryOptionsMission.where.$or = [
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
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptionsMission.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });

                // $or[3] === visibility: 'private', add check for user's community UID.
                // Has to be done after userCommunityUid has been checked for `null` since every mission access entry granted to a user has `communityUid: null`,
                // which would result in incorrect access being granted for communities
                queryOptionsMission.where.$or[3].$or.push(
                    // tslint:disable-next-line:max-line-length
                    literal(`${sequelize.escape(userCommunityUid)} IN (SELECT "communityUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "communityUid" = ${sequelize.escape(userCommunityUid)})`)
                );
            }
        }

        const mission = await Mission.findOne(queryOptionsMission);
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotRegistrations', slug, slotUid, userUid, queryOptions }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        let includeFullDetails: boolean = false;
        let includeCommunityDetails: boolean = false;
        if (!_.isNil(userUid) && hasPermission(request.auth.credentials.permissions, ['admin.mission', `mission.${slug}.creator`, `mission.${slug}.editor`])) {
            log.debug(
                { function: 'getMissionSlotRegistrationList', credentials: request.auth.credentials, userUid: userUid, hasPermission: true },
                'User has mission creator, editor or admin permission, returning full slot registration details');

            includeFullDetails = true;
        } else if (!_.isNil(userUid) && hasPermission(request.auth.credentials.permissions, `mission.${slug}.slotlist.community`) && !_.isNil(userCommunityUid)) {
            log.debug(
                { function: 'getMissionSlotRegistrationList', credentials: request.auth.credentials, userUid: userUid, userCommunityUid, hasPermission: true },
                'User has mission slotlist community permission, returning slot registration details for slots restricted to community');

            includeCommunityDetails = true;
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
            return registration.toPublicObject(includeFullDetails ||
                (includeCommunityDetails && !_.isNil(registration.slot) && userCommunityUid === registration.slot.restrictedCommunityUid));
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
    // tslint:disable-next-line:max-func-body-length
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
            where: { slug },
            attributes: ['uid', 'slug', 'title']
        };

        if (_.isNil(userUid)) {
            queryOptionsMission.where.visibility = 'public';
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info(
                { function: 'createMissionSlotRegistration', slug, slotUid, userUid, hasPermission: true },
                'User has mission admin permissions, allowing all slot registrations');
        } else {
            queryOptionsMission.where.$or = [
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
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptionsMission.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });

                // $or[3] === visibility: 'private', add check for user's community UID.
                // Has to be done after userCommunityUid has been checked for `null` since every mission access entry granted to a user has `communityUid: null`,
                // which would result in incorrect access being granted for communities
                queryOptionsMission.where.$or[3].$or.push(
                    // tslint:disable-next-line:max-line-length
                    literal(`${sequelize.escape(userCommunityUid)} IN (SELECT "communityUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "communityUid" = ${sequelize.escape(userCommunityUid)})`)
                );
            }
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

        if (slot.blocked) {
            log.debug(
                { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, userCommunityUid },
                'User tried to register for a blocked slot, rejecting');
            throw Boom.forbidden('Mission slot is blocked');
        } else if (!_.isNil(slot.externalAssignee)) {
            log.debug(
                { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, userCommunityUid },
                'User tried to register for a slot with an external assignee, rejecting');
            throw Boom.conflict('Mission slot can only either have assignee or external assignee');
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

        const registrationCount = await MissionSlotRegistration.count({ where: { slotUid: slot.uid } });

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

        if (slot.autoAssignable) {
            const isUserAssignedToAnySlot = await mission.isUserAssignedToAnySlot(registration.userUid);
            if (registrationCount === 0 && !isUserAssignedToAnySlot) {
                logger.debug(
                    { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, registrationUid: registration.uid },
                    'Mission slot is auto-assignable and has no registrations, assigning');

                await Promise.all([
                    slot.setAssignee(registration.userUid),
                    registration.update({ confirmed: true })
                ]);

                try {
                    await mission.createSlotAssignmentChangedNotification(registration.userUid, slot.title, true);
                } catch (err) {
                    log.warn(
                        { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, registrationUid: registration.uid, err },
                        'Received error during mission slot assignment notification creation');
                }
            } else {
                logger.debug(
                    {
                        function: 'createMissionSlotRegistration',
                        slug,
                        slotUid,
                        payload,
                        userUid,
                        missionUid: mission.uid,
                        registrationUid: registration.uid,
                        registrationCount,
                        isUserAssignedToAnySlot
                    },
                    'Mission slot is auto-assignable, but already has registrations or user is already assigned to a slot in the mission. Continuing without auto-assignment');
            }
        }

        try {
            await mission.createSlotRegistrationSubmittedNotifications(userUid, slot.title);
        } catch (err) {
            log.warn(
                { function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid, registrationUid: registration.uid, err },
                'Received error during mission slot registration submitted notifications creation');
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
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const registrationUid = request.params.registrationUid;
        const confirmed = request.payload.confirmed === true;
        const suppressNotifications = request.payload.suppressNotifications === true;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid },
                'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        if (!_.isNil(slot.externalAssignee)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                'Mission slot already has external assignee, rejecting registration update');
            throw Boom.conflict('Mission slot can only either have assignee or external assignee');
        }

        const registrations = await slot.getRegistrations({ where: { uid: registrationUid } });
        if (_.isNil(registrations) || _.isEmpty(registrations)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                'Mission slot registration with given UID not found');
            throw Boom.notFound('Mission slot registration not found');
        }
        const registration = registrations[0];

        if (!hasPermission(request.auth.credentials.permissions, [`mission.${slug}.creator`, `mission.${slug}.editor`])) {
            if (_.isNil(userCommunityUid)) {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                    'User has mission slotlist community permission, but is not associated with any community. Rejecting slot registration update');
                throw Boom.forbidden();
            }

            if (userCommunityUid !== slot.restrictedCommunityUid) {
                log.debug(
                    {
                        function: 'updateMissionSlotRegistration',
                        slug,
                        slotUid,
                        registrationUid,
                        confirmed,
                        suppressNotifications,
                        userUid,
                        missionUid: mission.uid,
                        userCommunityUid,
                        restrictedCommunityUid: slot.restrictedCommunityUid
                    },
                    'User has mission slotlist community permission, but tried to update slot restricted to different community. Rejecting slot registration update');
                throw Boom.forbidden();
            }

            log.debug(
                {
                    function: 'updateMissionSlotRegistration',
                    slug,
                    slotUid,
                    registrationUid,
                    confirmed,
                    suppressNotifications,
                    userUid,
                    missionUid: mission.uid,
                    userCommunityUid,
                    restrictedCommunityUid: slot.restrictedCommunityUid
                },
                'User has mission slotlist community permission and is member of community the slot is restricted to. Allowing slot registration update');
        }

        // tslint:disable-next-line:max-func-body-length
        return sequelize.transaction(async (t: Transaction) => {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                'Updating mission slot registration');

            if (confirmed && registration.confirmed) {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                    'Mission slot registration is already confirmed, silently ignoring update');
            } else if (confirmed && !registration.confirmed && !_.isNil(slot.assigneeUid)) {
                log.debug(
                    {
                        function: 'updateMissionSlotRegistration',
                        slug,
                        slotUid,
                        registrationUid,
                        confirmed,
                        suppressNotifications,
                        userUid,
                        missionUid: mission.uid,
                        assigneeUid: slot.assigneeUid
                    },
                    'Mission slot already has assignee, rejecting confirmation');
                throw Boom.conflict('Mission slot already assigned');
            } else if (confirmed && !registration.confirmed && _.isNil(slot.assigneeUid)) {
                if (await mission.isUserAssignedToAnySlot(registration.userUid)) {
                    log.debug(
                        { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                        'User is already assigned to another slot, rejecting confirmation');
                    throw Boom.conflict('User already assigned to another slot');
                }

                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                    'Confirming mission slot registration');

                await Promise.all([
                    slot.setAssignee(registration.userUid),
                    registration.update({ confirmed })
                ]);

                if (!suppressNotifications) {
                    try {
                        await mission.createSlotAssignmentChangedNotification(registration.userUid, slot.title, true);
                    } catch (err) {
                        log.warn(
                            { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid, err },
                            'Received error during mission slot assignment notification creation');
                    }
                }

                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                    'Successfully confirmed mission slot registration');
            } else if (!confirmed && registration.confirmed) {
                log.debug(
                    {
                        function: 'updateMissionSlotRegistration',
                        slug,
                        slotUid,
                        registrationUid,
                        confirmed,
                        suppressNotifications,
                        userUid,
                        missionUid: mission.uid,
                        assigneeUid: slot.assigneeUid
                    },
                    'Revoking mission slot registration confirmation');

                if (slot.assigneeUid === registration.userUid) {
                    await Promise.all([
                        slot.update({ assigneeUid: null }),
                        registration.update({ confirmed })
                    ]);

                    log.debug(
                        {
                            function: 'updateMissionSlotRegistration',
                            slug,
                            slotUid,
                            registrationUid,
                            confirmed,
                            suppressNotifications,
                            userUid,
                            missionUid: mission.uid,
                            assigneeUid: slot.assigneeUid
                        },
                        'Successfully revoked mission slot registration confirmation');
                } else {
                    log.debug(
                        {
                            function: 'updateMissionSlotRegistration',
                            slug,
                            slotUid,
                            registrationUid,
                            confirmed,
                            suppressNotifications,
                            userUid,
                            missionUid: mission.uid,
                            assigneeUid: slot.assigneeUid
                        },
                        'Mission slot assignee does not match registration user, only updating registration');

                    await registration.update({ confirmed });
                }

                try {
                    await mission.createSlotAssignmentChangedNotification(registration.userUid, slot.title, false);
                } catch (err) {
                    log.warn(
                        {
                            function: 'updateMissionSlotRegistration',
                            slug,
                            slotUid,
                            registrationUid,
                            confirmed,
                            userUid,
                            missionUid: mission.uid,
                            assigneeUid: slot.assigneeUid,
                            err
                        },
                        'Received error during mission slot unassignment notification creation');
                }
            } else {
                log.debug(
                    { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, suppressNotifications, userUid, missionUid: mission.uid },
                    'Mission slot registration already is not confirmed, silently ignoring update');
            }

            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, suppressNotifications, confirmed, userUid, missionUid: mission.uid },
                'Successfully updated mission slot registration');

            const publicMissionSlotRegistration = await registration.toPublicObject();

            return {
                registration: publicMissionSlotRegistration
            };
        });
    })());
}

export function deleteMissionSlotRegistration(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
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
                slug
            },
            attributes: ['uid', 'slug', 'title']
        };

        if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info(
                { function: 'deleteMissionSlotRegistration', slug, slotUid, registrationUid, userUid, hasPermission: true },
                'User has mission admin permissions, returning mission details');
        } else {
            queryOptionsMission.where.$or = [
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
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptionsMission.where.$or.push({
                    visibility: 'community',
                    communityUid: userCommunityUid
                });

                // $or[3] === visibility: 'private', add check for user's community UID.
                // Has to be done after userCommunityUid has been checked for `null` since every mission access entry granted to a user has `communityUid: null`,
                // which would result in incorrect access being granted for communities
                queryOptionsMission.where.$or[3].$or.push(
                    // tslint:disable-next-line:max-line-length
                    literal(`${sequelize.escape(userCommunityUid)} IN (SELECT "communityUid" FROM "missionAccesses" WHERE "missionUid" = "Mission"."uid" AND "communityUid" = ${sequelize.escape(userCommunityUid)})`)
                );
            }
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
            if (hasPermission(request.auth.credentials.permissions, ['admin.mission', `mission.${slug}.creator`, `mission.${slug}.editor`])) {
                log.debug(
                    {
                        function: 'deleteMissionSlotRegistration',
                        slug,
                        slotUid,
                        userUid,
                        registrationUid,
                        missionUid: mission.uid,
                        registrationUserUid: registration.userUid,
                        credentials: request.auth.credentials
                    },
                    'User has mission creator, editor or admin permission, allowing mission slot registration deletion');
            } else {
                log.info(
                    { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                    'User tried to delete mission slot registration that was created by a different user, denying');
                throw Boom.forbidden();
            }
        }

        return sequelize.transaction(async (t: Transaction) => {
            if (registration.confirmed) {
                log.debug(
                    { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                    'Mission slot registration is confirmed, checking slot assignee');

                if (slot.assigneeUid === registration.userUid) {
                    log.debug(
                        { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                        'Mission slot assignee is registration user, removing association and deleting mission slot registration');

                    await Promise.all([
                        slot.update({ assigneeUid: null }),
                        registration.destroy()
                    ]);
                } else {
                    log.debug(
                        {
                            function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid,
                            registrationUserUid: registration.userUid, assigneeUid: slot.assigneeUid
                        },
                        'Mission slot assignee is different user, only deleting mission slot registration');

                    await registration.destroy();
                }
            } else {
                log.debug(
                    { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                    'Mission slot registration is not confirmed, only deleting mission slot registration');

                await registration.destroy();
            }

            if (registration.userUid === userUid) {
                try {
                    await mission.createSlotRegistrationRemovedNotifications(userUid, slot.title);
                } catch (err) {
                    log.warn(
                        {
                            function: 'deleteMissionSlotRegistration',
                            slug,
                            slotUid,
                            userUid,
                            registrationUid,
                            missionUid: mission.uid,
                            registrationUserUid: registration.userUid
                        },
                        'Received error during mission slot registration deleted notifications creation');
                }
            }

            log.debug(
                { function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid, registrationUserUid: registration.userUid },
                'Successfully deleted mission slot registration');

            return {
                success: true
            };
        });
    })());
}

export function unassignMissionSlot(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid', 'slug', 'title'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slot = await mission.findSlot(slotUid);
        if (_.isNil(slot)) {
            log.debug({ function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        if (_.isNil(slot.assigneeUid) && _.isNil(slot.externalAssignee)) {
            log.debug({ function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid }, 'Mission slot has no regular or external assignee');
            throw Boom.conflict('Mission slot not assigned');
        }

        if (!hasPermission(request.auth.credentials.permissions, [`mission.${slug}.creator`, `mission.${slug}.editor`])) {
            if (_.isNil(userCommunityUid)) {
                log.debug(
                    { function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid },
                    'User has mission slotlist community permission, but is not associated with any community. Rejecting slot unassignment');
                throw Boom.forbidden();
            }

            if (userCommunityUid !== slot.restrictedCommunityUid) {
                log.debug(
                    {
                        function: 'unassignMissionSlot',
                        slug,
                        slotUid,
                        userUid,
                        userCommunityUid,
                        missionUid: mission.uid,
                        restrictedCommunityUid: slot.restrictedCommunityUid
                    },
                    'User has mission slotlist community permission, but tried to unassign slot restricted to different community. Rejecting slot unassignment');
                throw Boom.forbidden();
            }

            log.debug(
                {
                    function: 'unassignMissionSlot',
                    slug,
                    slotUid,
                    userUid,
                    userCommunityUid,
                    missionUid: mission.uid,
                    restrictedCommunityUid: slot.restrictedCommunityUid
                },
                'User has mission slotlist community permission and is member of community the slot is restricted to. Allowing slot unassignment');
        }

        return sequelize.transaction(async (t: Transaction) => {
            log.debug({ function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid }, 'Unassigning mission slot');

            if (!_.isNil(slot.assigneeUid)) {
                const targetUserUid = slot.assigneeUid;

                log.debug(
                    { function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                    'Unassigning user from mission slot and updating registration');

                const slotRegistration = await MissionSlotRegistration.findOne({ where: { userUid: slot.assigneeUid, slotUid: slot.uid } });
                if (_.isNil(slotRegistration)) {
                    log.debug(
                        { function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid, assigneeUid: slot.assigneeUid },
                        'Mission slot registration for assignee was not found');
                    throw Boom.notFound('Mission slot registration not found');
                }

                await Promise.all([
                    slot.update({ assigneeUid: null }),
                    slotRegistration.update({ confirmed: false })
                ]);

                try {
                    await mission.createSlotAssignmentChangedNotification(targetUserUid, slot.title, false);
                } catch (err) {
                    log.warn(
                        { function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid, targetUserUid, err },
                        'Received error during mission slot unassignment notification creation');
                }
            } else {
                log.debug(
                    { function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid, externalAssignee: slot.externalAssignee },
                    'Unassigning external user from mission slot');

                await slot.update({ externalAssignee: null });
            }

            log.debug({ function: 'unassignMissionSlot', slug, slotUid, userUid, userCommunityUid, missionUid: mission.uid }, 'Successfully unassigned mission slot');

            const publicMissionSlot = await slot.toPublicObject();

            return {
                slot: publicMissionSlot
            };
        });
    })());
}

export function applyMissionSlotTemplate(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    // tslint:disable-next-line:max-func-body-length
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotTemplateUid = request.params.slotTemplateUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;
        let userCommunityUid: string | null = null;
        if (!_.isNil(request.auth.credentials.user.community)) {
            userCommunityUid = request.auth.credentials.user.community.uid;
        }

        const mission = await Mission.findOne({
            where: {
                slug
            },
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroups',
                    include: [
                        {
                            model: MissionSlot,
                            as: 'slots'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlotRegistration', slug, slotTemplateUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const queryOptionsSlotTemplate: any = {
            where: {
                uid: slotTemplateUid
            }
        };

        if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info(
                { function: 'applyMissionSlotTemplate', slug, slotTemplateUid, payload, userUid, hasPermission: true },
                'User has mission admin permissions, allowing mission slot template application');
        } else {
            queryOptionsSlotTemplate.where.$or = [
                {
                    creatorUid: userUid
                },
                {
                    visibility: 'public'
                }
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptionsSlotTemplate.where.$or.push({
                    visibility: 'community',
                    creatorUid: {
                        $in: [literal(`SELECT "uid" FROM "users" WHERE "communityUid" = ${sequelize.escape(userCommunityUid)}`)]
                    }
                });
            }
        }

        const slotTemplate = await MissionSlotTemplate.findOne(queryOptionsSlotTemplate);
        if (_.isNil(slotTemplate)) {
            log.debug({ function: 'applyMissionSlotTemplate', slug, slotTemplateUid, payload, userUid }, 'Mission slot template with given UID not found');
            throw Boom.notFound('Mission slot template not found');
        }

        if (_.isNil(mission.slotGroups)) {
            mission.slotGroups = await mission.getSlotGroups();
        }

        const slotTemplateGroupCount = slotTemplate.slotGroups.length;
        const currentSlotGroups = _.sortBy(mission.slotGroups, 'orderNumber');
        const orderNumber = payload.insertAfter + 1;

        return sequelize.transaction(async (t: Transaction) => {
            log.debug(
                { function: 'applyMissionSlotTemplate', slug, slotTemplateUid, payload, userUid, missionUid: mission.uid, slotGroupCount: slotTemplateGroupCount },
                'Applying mission slot template');

            if (payload.insertAfter !== currentSlotGroups.length) {
                log.debug(
                    { function: 'createMissionSlotGroup', slug, slotTemplateUid, payload, userUid, missionUid: mission.uid },
                    'Mission slot template will be inserted in between current groups');

                await Promise.map(currentSlotGroups, (slotGroup: MissionSlotGroup) => {
                    if (slotGroup.orderNumber < orderNumber) {
                        return slotGroup;
                    }

                    return slotGroup.increment('orderNumber', { by: slotTemplateGroupCount });
                });
            }

            await Promise.map(slotTemplate.slotGroups, async (slotGroup: IMissionSlotTemplateSlotGroup, index: number) => {
                log.debug(
                    { function: 'applyMissionSlotTemplate', payload, slotTemplateUid, userUid, missionUid: mission.uid },
                    'Creating new mission slot group from template');

                slotGroup.orderNumber = orderNumber + index;

                const newSlotGroup = await mission.createSlotGroup(slotGroup);

                log.debug(
                    {
                        function: 'applyMissionSlotTemplate',
                        payload,
                        slotTemplateUid,
                        userUid,
                        missionUid: mission.uid,
                        missionSlotGroupUid: newSlotGroup.uid,
                        slotCount: slotGroup.slots.length
                    },
                    'Successfully created new mission slot group from template, creating slots');

                await Promise.map(slotGroup.slots, async (slot: IMissionSlotTemplateSlot) => {
                    log.debug(
                        { function: 'applyMissionSlotTemplate', payload, slotTemplateUid, userUid, missionUid: mission.uid, missionSlotGroupUid: newSlotGroup.uid },
                        'Creating new mission slot from template');

                    const newSlot = await newSlotGroup.createSlot(slot);

                    log.debug(
                        {
                            function: 'applyMissionSlotTemplate',
                            payload,
                            slotTemplateUid,
                            userUid,
                            missionUid: mission.uid,
                            missionSlotGroupUid: newSlotGroup.uid,
                            missionSlotUid: newSlot.uid
                        },
                        'Successfully created new mission slot from template');
                });

                log.debug(
                    {
                        function: 'applyMissionSlotTemplate',
                        payload,
                        slotTemplateUid,
                        userUid,
                        missionUid: mission.uid,
                        missionSlotGroupUid: newSlotGroup.uid,
                        slotCount: slotGroup.slots.length
                    },
                    'Successfully created mission slot group and slots from template');
            });

            log.debug(
                { function: 'applyMissionSlotTemplate', slug, slotTemplateUid, payload, userUid, missionUid: mission.uid, slotGroupCount: slotTemplateGroupCount },
                'Successfully applied mission slot template, recalculating slot order numbers');

            await mission.recalculateSlotOrderNumbers();

            log.debug(
                { function: 'applyMissionSlotTemplate', slug, slotTemplateUid, payload, userUid, missionUid: mission.uid },
                'Successfully applied mission slot template');

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
            registrations = await MissionSlotRegistration.findAll({
                where: {
                    slotUid: {
                        $in: slotUids
                    },
                    userUid: userUid
                }
            });

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
        });
    })());
}

export function getMissionToken(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid: string = request.auth.credentials.user.uid;

        const queryOptions: any = {
            where: { slug },
            attributes: ['uid', 'missionToken']
        };

        const mission = await Mission.findOne(queryOptions);
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionToken', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        return {
            missionToken: mission.missionToken
        };
    })());
}

export function generateMissionToken(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid: string = request.auth.credentials.user.uid;

        const queryOptions: any = {
            where: { slug },
            attributes: ['uid', 'missionToken']
        };

        let mission = await Mission.findOne(queryOptions);
        if (_.isNil(mission)) {
            log.debug({ function: 'generateMissionToken', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.info({ function: 'generateMissionToken', slug, userUid }, 'Generating new mission token');

        mission = await mission.generateMissionToken();

        return {
            missionToken: mission.missionToken
        };
    })());
}

export function deleteMissionToken(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid: string = request.auth.credentials.user.uid;

        const queryOptions: any = {
            where: { slug },
            attributes: ['uid', 'missionToken']
        };

        const mission = await Mission.findOne(queryOptions);
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionToken', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.info({ function: 'deleteMissionToken', slug, userUid }, 'Deleting mission token');

        await mission.update({ missionToken: null });

        return {
            success: true
        };
    })());
}
