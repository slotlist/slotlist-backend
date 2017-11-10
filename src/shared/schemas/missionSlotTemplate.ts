import * as Joi from 'joi';

import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN, MISSION_VISIBILITY_PUBLIC } from '../models/Mission';
import { userSchema } from './user';

/**
 * Schema for public mission slot template information
 */
export const missionSlotTemplateSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the mission slot template').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    title: Joi.string().min(1).max(255).required().description('Title of the mission slot template').example('Standard Rifle Squad'),
    slotGroupCount: Joi.number().integer().positive().allow(0).min(0).required().description('Number of slot groups defined in the mission slot template').example(1),
    slotCount: Joi.number().integer().positive().allow(0).min(0).description('Total number of slots defined across all slot groups in the mission slot template')
        .example(10),
    visibility: Joi.string().equal(MISSION_VISIBILITIES).default(MISSION_VISIBILITY_HIDDEN).required().description('Indicates the visibility setting ' +
        'of a mission slot template, including the same settings as the mission visibilities').example(MISSION_VISIBILITY_PUBLIC),
    creator: userSchema.description('User the slot template has been created by')
}).required().label('MissionSlotTemplate').description('Public mission slot template information, as displayed in overview lists');

export const missionSlotTemplateSlotSchema = Joi.object().keys({
    blocked: Joi.bool().required().description('Indicates whether the slot is a blocked slot (true, no users can register) or a regular one (false). Blocked slots can be ' +
        'used by mission creators to manually "assign" slots to community or users that choose not to use slotlist.info').example(false),
    description: Joi.string().allow(null).min(1).optional().description('Optional short description of the slot').example('Leads Platoon Luchs and coordinates logistics'),
    detailedDescription: Joi.string().allow(null).min(1).default(null).optional().description('Detailed, optional description of the mission slot, further explaining ' +
        'the responsibilities and the selected role').example('<div>Actually know what they are doing!</div>'),
    difficulty: Joi.number().integer().positive().allow(0).min(0).max(4).required().description('Difficulity of the slot, ranging from 0 (easiest) to 4 (hardest)').example(4),
    orderNumber: Joi.number().integer().positive().allow(0).min(0).required().description('Order number for sorting slotlist').example(0),
    title: Joi.string().min(1).max(255).required().description('Title of the slot').example('Platoon Lead'),
    reserve: Joi.bool().required().description('Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been filled) or a ' +
        'regular one (false)').example(false)
}).required().label('MissionSlotTemplateSlot').description('Information about a specific slot in a mission slot template slot group');

export const missionSlotTemplateSlotGroupSchema = Joi.object().keys({
    title: Joi.string().min(1).max(255).required().description('Title of the slot group').example('Rifle Squad "Luchs"'),
    orderNumber: Joi.number().integer().positive().allow(0).min(0).required().description('Order number for sorting slotlist').example(0),
    description: Joi.string().allow(null).min(1).default(null).optional().description('Optional description of the mission slot group, providing details about the group')
        .example('Spearhead of the operation, contains the most awesome people'),
    slots: Joi.array().items(missionSlotTemplateSlotSchema.optional()).required().description('List of mission slots assigned to this template slot group')
}).required().label('MissionSlotTemplateSlotGroup').description('Information about a specific slot group in a mission slot template');

export const missionSlotTemplateDetailsSchema = missionSlotTemplateSchema.keys({
    slotGroups: Joi.array().items(missionSlotTemplateSlotGroupSchema.optional()).required().description('List of slot groups defined for mission template')
}).required().label('MissionSlot').description('Detailed public mission slot information, as displayed on template details page');
