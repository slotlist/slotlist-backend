import * as Joi from 'joi';

import { COMMUNITY_APPLICATION_STATUS_SUBMITTED, COMMUNITY_APPLICATION_STATUSES } from '../models/CommunityApplication';
import { userSchema } from './user';

/**
 * Schema for public community application information
 */
export const communityApplicationSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the application').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    user: userSchema.required().description('User that applied to the community'),
    status: Joi.string().equal(COMMUNITY_APPLICATION_STATUSES).required()
        .description('Indicates the application\'s status. Applications are created with status `submitted` and can either be `accepted` or `denied`')
        .example(COMMUNITY_APPLICATION_STATUS_SUBMITTED)
});
