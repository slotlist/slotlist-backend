import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import { col, fn, literal } from 'sequelize';

import { Community } from '../../../shared/models/Community';
import { MissionSlotTemplate } from '../../../shared/models/MissionSlotTemplate';
import { User } from '../../../shared/models/User';
import { hasPermission } from '../../../shared/util/acl';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
// tslint:disable-next-line:import-name
const log = logger.child({ route: 'missionSlotTemplate', routeVersion: 'v1' });

/**
 * Handlers for V1 of mission slot template endpoints
 */

export function getMissionSlotTemplateList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
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
            order: [[fn('UPPER', col('title')), 'ASC']],
            include: [
                {
                    model: User,
                    as: 'creator',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        };

        if (_.isNil(userUid)) {
            queryOptions.where = {
                visibility: 'public'
            };
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info({ function: 'getMissionSlotTemplateList', userUid, hasPermission: true }, 'User has mission admin permissions, returning all mission slot templates');
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
                        visibility: 'private',
                        creatorUid: userUid
                    }
                ]
            };

            if (!_.isNil(userCommunityUid)) {
                queryOptions.where.$or.push({
                    visibility: 'community',
                    creatorUid: {
                        $in: [literal(`SELECT "uid" FROM "users" WHERE "communityUid" = ${sequelize.escape(userCommunityUid)}`)]
                    }
                });
            }
        }

        const result = await MissionSlotTemplate.findAndCountAll(queryOptions);

        const slotTemplateCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + slotTemplateCount) < result.count;
        const slotTemplateList = await Promise.map(result.rows, async (slotTemplate: MissionSlotTemplate) => {
            return slotTemplate.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: slotTemplateCount,
            total: result.count,
            moreAvailable: moreAvailable,
            slotTemplates: slotTemplateList
        };
    })());
}

export function createMissionSlotTemplate(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        payload.creatorUid = userUid;

        log.debug({ function: 'createMissionSlotTemplate', payload, userUid }, 'Creating new mission slot template');

        const slotTemplate = await MissionSlotTemplate.create(payload);

        log.debug({ function: 'createMissionSlotTemplate', payload, userUid, slotTemplateUid: slotTemplate.uid }, 'Successfully created new mission slot template');

        const detailedPublicMissionSlotTemplate = await slotTemplate.toDetailedPublicObject();

        return {
            slotTemplate: detailedPublicMissionSlotTemplate
        };
    })());
}

export function getMissionSlotTemplateDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slotTemplateUid = request.params.slotTemplateUid;
        let userUid: string | null = null;
        let userCommunityUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;

            if (!_.isNil(request.auth.credentials.user.community)) {
                userCommunityUid = request.auth.credentials.user.community.uid;
            }
        }

        const queryOptions: any = {
            where: { uid: slotTemplateUid },
            include: [
                {
                    model: User,
                    as: 'creator',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        };

        if (_.isNil(userUid)) {
            queryOptions.where.visibility = 'public';
        } else if (hasPermission(request.auth.credentials.permissions, 'admin.mission')) {
            log.info(
                { function: 'getMissionSlotTemplateDetails', slotTemplateUid, userUid, hasPermission: true },
                'User has mission admin permissions, returning mission slot template details');
        } else {
            queryOptions.where.$or = [
                {
                    creatorUid: userUid
                },
                {
                    visibility: 'public'
                },
                {
                    visibility: 'private',
                    creatorUid: userUid
                }
            ];

            if (!_.isNil(userCommunityUid)) {
                queryOptions.where.$or.push({
                    visibility: 'community',
                    creatorUid: {
                        $in: [literal(`SELECT "uid" FROM "users" WHERE "communityUid" = ${sequelize.escape(userCommunityUid)}`)]
                    }
                });
            }
        }

        const slotTemplate = await MissionSlotTemplate.findOne(queryOptions);
        if (_.isNil(slotTemplate)) {
            log.debug({ function: 'getMissionSlotTemplateDetails', slotTemplateUid, userUid }, 'Mission slot template with given UID not found');
            throw Boom.notFound('Mission slot template not found');
        }

        const detailedPublicMissionSlot = await slotTemplate.toDetailedPublicObject();

        return {
            slotTemplate: detailedPublicMissionSlot
        };
    })());
}

export function updateMissionSlotTemplate(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slotTemplateUid = request.params.slotTemplateUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const slotTemplate = await MissionSlotTemplate.findOne({
            where: {
                uid: slotTemplateUid,
                creatorUid: userUid
            },
            include: [
                {
                    model: User,
                    as: 'creator',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(slotTemplate)) {
            log.debug({ function: 'updateMissionSlotTemplate', slotTemplateUid, payload, userUid }, 'Mission slot template with given UID not found');
            throw Boom.notFound('Mission slot template not found');
        }

        log.debug({ function: 'updateMissionSlotTemplate', slotTemplateUid, payload, userUid }, 'Updating mission slot template');

        await slotTemplate.update(payload, { fields: ['slotGroups', 'title', 'visibility'] });

        log.debug({ function: 'updateMission', slotTemplateUid, payload, userUid }, 'Successfully updated mission slot template');

        const detailedPublicMissionSlot = await slotTemplate.toDetailedPublicObject();

        return {
            slotTemplate: detailedPublicMissionSlot
        };
    })());
}

export function deleteMissionSlotTemplate(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slotTemplateUid = request.params.slotTemplateUid;
        const userUid = request.auth.credentials.user.uid;

        const slotTemplate = await MissionSlotTemplate.findOne({ where: { uid: slotTemplateUid, creatorUid: userUid } });
        if (_.isNil(slotTemplate)) {
            log.debug({ function: 'deleteMissionSlotTemplate', slotTemplateUid, userUid }, 'Mission slot template with given UID not found');
            throw Boom.notFound('Mission slot template not found');
        }

        log.debug({ function: 'deleteMissionSlotTemplate', slotTemplateUid, userUid }, 'Deleting mission slot template');

        await slotTemplate.destroy();

        log.debug({ function: 'deleteMissionSlotTemplate', slotTemplateUid, userUid }, 'Successfully deleted mission slot template');

        return {
            success: true
        };
    })());
}
