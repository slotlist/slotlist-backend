import * as Joi from 'joi';

/**
 * Schema for public user information
 */
export const userSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    nickname: Joi.string().min(1).max(255).required().description('Nickname of the user (not guaranteed to be unique, can be freely changed)').example('MorpheusXAUT')
}).required().label('User').description('Public user information, as displayed in overview lists');

import { communitySchema } from './community';
import { missionSchema } from './mission';

export const userDetailsSchema = userSchema.keys({
    community: Joi.alternatives([communitySchema]).allow(null).default(null).optional().label('Community')
        .description('Community the user is associated with. Can be null if user is not assigned to community'),
    missions: Joi.array().items(missionSchema.optional()).required().label('Missions').description('List of missions created by the user')
}).required().label('UserDetails').description('Detailed user information, as displayed in user profiles');

export const userAccountDetails = userDetailsSchema.keys({
    permissions: Joi.array().items(Joi.string().min(1).max(255).required().description('Permission granted to user, in dotted notation')
        .example('community.spezialeinheit-luchs.leader')).required().description('List of permissions currently assigned to the user, in dotted notation')
}).required().label('UserAccountDetails').description('Detailed user information including private information, as displayed in the account panel');
