import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for public mission slot registration information
 */
export const missionSlotRegistrationSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).optional().description('UID of the slot, only included for mission creators and editors').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    confirmed: Joi.bool().required().description('Indicates whether the mission slot registration has been confirmed by the mission creator and the user has been assigned ' +
        'to the slot').example(false),
    comment: Joi.string().allow(null).min(1).optional().description('Optional comment provided by the user during registration, can e.g. be used to state preferences. ' +
        'Only included for mission creators and editors').example('Would prefer to lead platoon Luchs over Wolf'),
    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot the reservation was made for').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    user: userSchema.description('User that registered for the slot'),
    createdAt: Joi.date().required().description('Date and time the slot registration was created, can be used to determine which user registered for a slot first')
        .example('2017-09-01T17:00:00.000Z')
}).required().label('MissionSlotRegistration').description('Public mission slot registration information, as displayed in slotlists');
