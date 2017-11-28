import * as Joi from 'joi';

import { NOTIFICATION_TYPE_GENERIC, NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED, NOTIFICATION_TYPES } from '../types/notification';

export const notificationDataCommunityApplicationSchema = Joi.object().keys({
    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community the status of the application was changed for')
        .example('spezialeinheit-luchs'),
    communityName: Joi.string().min(1).max(255).required().description('Name of the community the status of the application was changed for').example('Spezialeinheit Luchs'),
    userUid: Joi.string().guid().length(36).required().description('UID of the user the application was created for').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    userNickname: Joi.string().min(1).max(255).required().description('Nickname of the user the application was created for').example('MorpheusXAUT')
});

export const notificationDataCommunitySchema = Joi.object().keys({
    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community that was modified').example('spezialeinheit-luchs'),
    communityName: Joi.string().min(1).max(255).required().description('Name of the community that was modified').example('Spezialeinheit Luchs')
});

export const notificationDataGenericSchema = Joi.object().keys({
    message: Joi.string().min(1).required().description('Generic notification message to display')
});

export const notificationDataMissionSchema = Joi.object().keys({
    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission that was modified')
        .example('all-of-altis'),
    missionTitle: Joi.string().min(1).max(255).required().description('Title of the mission that was modified').example('All of Altis')
});

export const notificationDataMissionSlotSchema = Joi.object().keys({
    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission the slot assignment was changed for')
        .example('all-of-altis'),
    missionTitle: Joi.string().min(1).max(255).required().description('Title of the mission the slot assignment was changed for').example('All of Altis'),
    slotTitle: Joi.string().min(1).max(255).required().description('Title of the slot the assignment was changed for').example('Platoon Lead'),
    userUid: Joi.string().guid().length(36).required().description('UID of the user the slot assignment was created for').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    userNickname: Joi.string().min(1).max(255).required().description('Nickname of the user the slot assignment was created for').example('MorpheusXAUT'),
    userCommunityTag: Joi.string().min(1).max(255).allow(null).default(null).optional().description('Community tag of the user the slot assignment was created for, if set')
        .example('SeL')
});

export const notificationDataPermissionSchema = Joi.object().keys({
    permission: Joi.string().min(1).max(255).required().description('Permission that was changed').example('mission.all-of-altis.creator'),
    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').optional().description('Slug of community the permission was changed for. Only present if the ' +
        'permission changed as a community permission').example('spezialeinheit-luchs'),
    communityName: Joi.string().min(1).max(255).optional().description('Name of the community the permission was changed for. Only present if the permission changed was a ' +
        'community permission').example('Spezialeinheit Luchs'),
    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').optional().description('Slug of mission the permission was changed for. Only present if the permission ' +
        'changed was a mission permission').example('all-of-altis'),
    missionTitle: Joi.string().min(1).max(255).optional().description('Title of the mission the permission was changed for. Only present if the permission changed was a ' +
        'mission permission').example('All of Altis')
});

export const notificationDataSchema = Joi.alternatives(
    notificationDataCommunityApplicationSchema,
    notificationDataCommunitySchema,
    notificationDataGenericSchema,
    notificationDataMissionSchema,
    notificationDataMissionSlotSchema,
    notificationDataPermissionSchema);

/**
 * Schema for public notification information
 */
export const notificationSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the notification').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    notificationType: Joi.string().equal(NOTIFICATION_TYPES).default(NOTIFICATION_TYPE_GENERIC).required().description('Type of notifcation, used to distinguish ' +
        'text/data to display').example(NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED),
    data: notificationDataSchema.required().description('Additional data provided for each notification, depending on the `notificationType`'),
    seenAt: Joi.date().allow(null).default(null).required().description('Date and time the notification has been marked as seen at (in UTC)').example('2017-09-02T17:00:00.000Z'),
    createdAt: Joi.date().required().description('Date and time the notification has been created at (in UTC)').example('2017-09-02T17:00:00.000Z')
}).required().label('Notification').description('Public notification information, as displayed in the notification list');
