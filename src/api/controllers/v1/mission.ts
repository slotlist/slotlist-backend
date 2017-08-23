import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { col, fn, literal, Transaction } from 'sequelize';

import { Community } from '../../../shared/models/Community';
import { Mission } from '../../../shared/models/Mission';
import { MissionSlot } from '../../../shared/models/MissionSlot';
import { MissionSlotRegistration } from '../../../shared/models/MissionSlotRegistration';
import { User } from '../../../shared/models/User';
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
            queryOptions.where.visibility = 'public';
        } else {
            queryOptions.where = _.defaults(
                {
                    $or: [
                        {
                            visibility: 'public'
                        },
                        {
                            visibility: 'hidden',
                            $or: [
                                {
                                    creatorUid: userUid
                                },
                                literal(`'${userUid}' IN (SELECT "userUid" FROM "permissions" WHERE "permission" = 'mission.' || "slug" || '.editor' OR "permission" = '*')`)
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

        // Make sure payload is properly "slugged"
        payload.slug = slugger(payload.slug);

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

export function deleteMission(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const userUid = request.auth.credentials.user.uid;

        log.debug({ function: 'deleteMission', slug, userUid }, 'Deleting mission');

        const deleted = await Mission.destroy({ where: { slug } });
        if (deleted <= 0) {
            log.debug({ function: 'deleteMission', slug, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        log.debug({ function: 'deleteMission', slug, userUid, deleted }, 'Successfully deleted mission');

        return {
            success: true
        };
    })());
}

export function getMissionSlotList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [['orderNumber', 'ASC'], [fn('UPPER', col('title')), 'ASC']]
        };
        let userUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;
        }

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionSlotList', slug, queryOptions, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        let registrations: MissionSlotRegistration[] = [];
        if (!_.isNil(userUid)) {
            log.debug({ function: 'getMissionSlotList', slug, queryOptions, userUid }, 'Retrieving registered slots for authenticated user');

            registrations = await MissionSlotRegistration.findAll({
                include: [
                    {
                        model: MissionSlot,
                        as: 'slot',
                        where: {
                            missionUid: mission.uid
                        }
                    }
                ]
            });
        }

        queryOptions.where = {
            missionUid: mission.uid
        };

        const result = await MissionSlot.findAndCountAll(queryOptions);

        const slotCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + slotCount) < result.count;
        const slotList = await Promise.map(result.rows, async (slot: MissionSlot) => {
            const publicSlot = await slot.toPublicObject();

            const registration = _.find(registrations, { slotUid: slot.uid });
            if (!_.isNil(registration)) {
                (<any>publicSlot).registrationUid = registration.uid;
            }

            return publicSlot;
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

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

        log.debug({ function: 'updateMissionSlot', slug, slotUid, payload, userUid, missionUid: mission.uid }, 'Updating mission slot');

        await slot.update(payload, { allowed: ['title', 'orderNumber', 'difficulty', 'shortDescription', 'description', 'restricted', 'reserve'] });

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

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'deleteMissionSlot', slug, slotUid, userUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

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
        const userUid = request.auth.credentials.user.uid;
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

export function createMissionSlotRegistration(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.missionSlug;
        const slotUid = request.params.slotUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        payload.userUid = userUid;

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'createMissionSlotRegistration', slug, slotUid, payload, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, payload, userUid, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

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

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug(
                { function: 'updateMissionSlotRegistration', slug, slotUid, registrationUid, confirmed, userUid, missionUid: mission.uid },
                'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

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

        const mission = await Mission.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(mission)) {
            log.debug({ function: 'deleteMissionSlotRegistration', slug, slotUid, registrationUid, userUid }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const slots = await mission.getSlots({ where: { uid: slotUid } });
        if (_.isNil(slots) || _.isEmpty(slots)) {
            log.debug({ function: 'deleteMissionSlotRegistration', slug, slotUid, userUid, registrationUid, missionUid: mission.uid }, 'Mission slot with given UID not found');
            throw Boom.notFound('Mission slot not found');
        }
        const slot = slots[0];

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
