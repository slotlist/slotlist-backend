import * as Joi from 'joi';

import { missionSlotSchema } from './missionSlot';

/**
 * Schema for public mission slot group information
 */
export const missionSlotGroupSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the slot group').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    missionUid: Joi.string().guid().length(36).required().description('UID of the slot groups\'s mission').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    title: Joi.string().min(1).max(255).required().description('Title of the slot group').example('Rifle Squad "Luchs"'),
    orderNumber: Joi.number().integer().positive().allow(0).min(0).required().description('Order number for sorting slotlist').example(0),
    description: Joi.string().allow(null).min(1).default(null).optional().description('Optional description of the mission slot group, providing details about the group')
        .example('Spearhead of the operation, contains the most awesome people'),
    slots: Joi.array().items(missionSlotSchema.optional()).required().description('List of mission slots assigned to this slot group')
}).required().label('MissionSlotGroup').description('Public mission slot group information, as displayed in slotlists');
