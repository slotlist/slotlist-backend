import * as Joi from 'joi';

import { MISSION_REQUIRED_DLCS } from '../models/Mission';

import { communitySchema } from './community';
import { userSchema } from './user';

/**
 * Schema for public mission slot information
 */
export const missionSlotSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the slot').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    slotGroupUid: Joi.string().guid().length(36).required().description('UID of the slot\'s slot group').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    title: Joi.string().min(1).max(255).required().description('Title of the slot').example('Platoon Lead'),
    orderNumber: Joi.number().integer().positive().allow(0).min(0).required().description('Order number for sorting slotlist').example(0),
    difficulty: Joi.number().integer().positive().allow(0).min(0).max(4).required().description('Difficulity of the slot, ranging from 0 (easiest) to 4 (hardest)').example(4),
    detailedDescription: Joi.string().allow(null).min(1).default(null).optional().description('Detailed, optional description of the mission slot, further explaining ' +
        'the responsibilities and the selected role').example('<div>Actually know what they are doing!</div>'),
    description: Joi.string().allow(null).min(1).optional().description('Optional short description of the slot').example('Leads Platoon Luchs and coordinates logistics'),
    reserve: Joi.bool().required().description('Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been filled) or a ' +
        'regular one (false)').example(false),
    blocked: Joi.bool().required().description('Indicates whether the slot is a blocked slot (true, no users can register) or a regular one (false). Blocked slots can be ' +
        'used by mission creators to manually "assign" slots to community or users that choose not to use slotlist.info').example(false),
    autoAssignable: Joi.bool().required().description('Indicates whether the slot is auto-assignable. Auto-assignable slots do not require confirmation by a mission editor, but ' +
        'are automatically assigned to the first registering user (who would have thought, what a good name choice!)').example(false),
    restrictedCommunity: communitySchema.allow(null).default(null).optional().description('Community the slot has been restricted to. If a value is set, only members of ' +
        'this community can register for the slot. If `null` is returned, no restrictions apply and everyone can register'),
    requiredDLCs: Joi.array().items(Joi.string().equal(MISSION_REQUIRED_DLCS).optional()).required().description('List of DLCs required to fulfil the duties assigned to the ' +
        'slot. Currently not used in any restrictions, but merely added as an indication to players.'),
    assignee: userSchema.allow(null).optional().description('User the slot has been assigned to. Can be `null` if no final assignment has been completed yet'),
    externalAssignee: Joi.string().min(1).max(255).allow(null).default(null).optional().description('Nickname of external player assigned to the slot. Allows for slots to ' +
        'be assigned to users not present in the database. Cannot be set at the same time as an `assigneeUid` and vice versa. Can be `null` if no external player has been ' +
        'assigned').example('MorpheusXAUT'),
    registrationUid: Joi.string().guid().length(36).optional().description('Optional UID of the mission slot registration that the user retrieving the mission slotlist has ' +
        'performed for the current slot. Omitted for unauthenticated users or slots the user didn\' register for').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    registrationCount: Joi.number().integer().positive().allow(0).min(0).required().description('Number of registrations currently submitted for this slot').example(0)
}).required().label('MissionSlot').description('Public mission slot information, as displayed in slotlists');
