import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Transaction } from 'sequelize';

import { Community } from '../../../shared/models/Community';
import { Mission } from '../../../shared/models/Mission';
import { MissionSlot } from '../../../shared/models/MissionSlot';
import { MissionSlotRegistration } from '../../../shared/models/MissionSlotRegistration';
import { User } from '../../../shared/models/User';
import { log as logger } from '../../../shared/util/log';
import { sequelize } from '../../../shared/util/sequelize';
const log = logger.child({ route: 'community', routeVersion: 'v1' });

/**
 * Handlers for V1 of mission endpoints
 */

export function getMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
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

        const user = await User.findById(userUid, { include: [{ model: Community, as: 'community' }] });
        if (_.isNil(user)) {
            log.debug({ function: 'createMission', payload, userUid }, 'User not find during community creation');

            throw Boom.notFound('User not found');
        }

        payload.creatorUid = user.uid;

        if (!_.isNil(payload.addToCommunity)) {
            if (payload.addToCommunity === true && !_.isNil(user.communityUid)) {
                payload.communityUid = user.communityUid;
            }

            payload.addToCommunity = undefined;
            delete payload.addToCommunity;
        }

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

            return {
                mission: detailedPublicMission
            };
        });
    })());
}

export function getMissionDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;

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

        await mission.update(payload, {
            allowed: ['title', 'description', 'shortdescription', 'briefingTime', 'slottingTime', 'startTime', 'endTime', 'repositoryUrl', 'techSupport', 'rules']
        });

        log.debug({ function: 'updateMission', slug, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission');

        const detailedPublicMission = await mission.toDetailedPublicObject();

        return {
            mission: detailedPublicMission
        };
    })());
}

export function getMissionSlotList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotList', slug, queryOptions }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        queryOptions.where = {
            missionUid: mission.uid
        };

        const result = await MissionSlot.findAndCountAll(queryOptions);

        const slotCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + slotCount) < result.count;
        const slotList = await Promise.map(result.rows, (slot: MissionSlot) => {
            return slot.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: slotCount,
            moreAvailable: moreAvailable,
            slots: slotList
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

        // Assign mission UID to every slot to be created
        _.each(payload, (slot: any) => {
            slot.missionUid = mission.uid;
        });

        log.debug({ function: 'createMissionSlot', slug, payload, userUid, missionUid: mission.uid }, 'Creating new mission slots');

        return sequelize.transaction(async (t: Transaction) => {
            const slots = await Promise.map(payload, async (load: any) => {
                log.debug({ function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid }, 'Creating new mission slot');

                const slot = await new MissionSlot(load).save();

                log.debug(
                    { function: 'createMissionSlot', slug, payload: load, userUid, missionUid: mission.uid, missionSlotUid: slot.uid },
                    'Successfully created new mission slot');

                return slot;
            });

            log.debug({ function: 'createMission', payload, userUid, missionUid: mission.uid, missionSlotCount: slots.length }, 'Successfully created new mission slots');

            const detailedPublicSlots = await Promise.map(slots, (slot: MissionSlot) => {
                return slot.toDetailedPublicObject();
            });

            return {
                slots: detailedPublicSlots
            };
        });
    })());
}

export function getMissionSlotDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotDetails', slug, slotUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'getMissionSlotDetails', slug, slotUid, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const publicMissionSlot = await slots[0].toDetailedPublicObject();

        return {
            slot: publicMissionSlot
        };
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

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

        log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot');

        await slot.update(payload, { allowed: ['title', 'orderNumber', 'difficulty', 'shortDescription', 'description', 'restricted', 'reserve'] });

        log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Successfully updated mission slot');

        const publicMissionSlot = await slot.toDetailedPublicObject();

        return {
            slot: publicMissionSlot
        };
    })());
}

export function getMissionSlotRegistrationList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const userUid = request.auth.credentials.user.uid;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            slotUid
        };

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotRegistrations', slug, slotUid, userUid, queryOptions }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'getMissionSlotRegistrations', slug, slotUid, userUid, queryOptions, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }

        const result = await MissionSlotRegistration.findAndCountAll(queryOptions);

        const registrationCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + registrationCount) < result.count;
        const registrationList = await Promise.map(result.rows, (registration: MissionSlotRegistration) => {
            return registration.toPublicObject();
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
