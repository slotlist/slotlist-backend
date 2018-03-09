import * as Joi from 'joi';

import { communitySchema } from './community';
import { userSchema } from './user';

/**
 * Schema for public mission access information
 */
export const missionAccessSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the mission access').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    missionUid: Joi.string().guid().length(36).required().description('UID of the mission access has been granted to').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    community: communitySchema.allow(null).optional().description('Community the access has been granted to. Can be `null` if access has been granted to an user instead'),
    user: userSchema.allow(null).optional().description('User the access has been granted to. Can be `null` if access has been granted to a community instead')
}).required().label('MissionAccess').description('Public mission access information, as displayed in access lists');
