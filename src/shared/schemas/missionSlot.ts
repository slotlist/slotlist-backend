import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for public mission slot information
 */
export const missionSlotSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the slot').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    missionUid: Joi.string().guid().length(36).required().description('UID of the slot\'s mission').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    title: Joi.string().min(1).max(255).required().description('Title of the slot').example('Platoon Lead'),
    orderNumber: Joi.number().integer().positive().allow(0).min(0).required().description('Order number for sorting slotlist').example(0),
    difficulty: Joi.number().integer().positive().allow(0).min(0).max(4).required().description('Difficulity of the slot, ranging from 0 (easiest) to 4 (hardest)').example(4),
    description: Joi.string().allow(null).min(1).default(null).optional().description('Detailed, optional description of the mission slot, further explaining ' +
        'the responsibilities and the selected role').example('<div>Actually know what they are doing!</div>'),
    shortDescription: Joi.string().allow(null).min(1).optional().description('Optional short description of the slot').example('Leads Platoon Luchs and coordinates logistics'),
    restricted: Joi.bool().required().description('Indicates whether the slot is restricted (true, not available for public registration) or whether everyone can register (false)')
        .example(true),
    reserve: Joi.bool().required().description('Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been filled) or a ' +
        'regular one (false)').example(false),
    assignee: userSchema.allow(null).optional().description('User the slot has been assigned to. Can be null if no final assignment has been completed yet'),
    registrationUid: Joi.string().guid().length(36).optional().description('Optional UID of the mission slot registration that the user retrieving the mission slotlist has ' +
        'performed for the current slot. Omitted for unauthenticated users or slots the user didn\' register for').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
}).required().label('MissionSlot').description('Public mission slot information, as displayed in slotlists');
