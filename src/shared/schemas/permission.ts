import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for public permission information
 */
export const permissionSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the permission').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    permission: Joi.string().min(1).max(255).required().description('Permission in dotted notation').example('mission.all-of-altis.creator'),
    user: userSchema.required().description('User the permission has been granted to')
}).required().label('Permission').description('Public permission information, as displayed in permission lists');
