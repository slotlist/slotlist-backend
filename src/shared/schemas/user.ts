import * as Joi from 'joi';

/**
 * Schema for public user information
 */
export const userSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    nickname: Joi.string().min(1).max(255).required().description('Nickname of the user (not guaranteed to be unique, can be freely changed)').example('MorpheusXAUT'),
    // Community schema is duplicated here due to cyclic references
    community: Joi.alternatives([Joi.object().keys({
        uid: Joi.string().guid().length(36).required().description('UID of the community').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
        name: Joi.string().min(1).max(255).required().description('Name of the community').example('Spezialeinheit Luchs'),
        tag: Joi.string().min(1).max(255).required().description('Community tag (without square brackets, will be added by frontend)').example('SeL'),
        website: Joi.string().uri().allow(null).min(1).max(255).default(null).optional().description('Website of the community, can be `null` if none exists')
            .example('http://spezialeinheit-luchs.de'),
        slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
            .description('Slug used for uniquely identifying a community in the frontend, easier to read than a UUID').example('spezialeinheit-luchs'),
        logoUrl: Joi.string().allow(null).uri().min(1).default(null).description('Optional URL of logo to be displayed on community details')
            .example('https://example.org/logo.png')
    }).label('Community').description('Public community information, as displayed in overview lists')]).allow(null).default(null).optional().label('Community')
        .description('Community the user is associated with. Can be `null` if user is not assigned to community'),
    steamId: Joi.string().min(1).optional().description('Steam ID of the user. Only returned for admins with the user admin permission').example('76561198002621790'),
    active: Joi.bool().optional().description('Indicates whether the user account is active and thus useable. Only returned for admins with the user admin permission')
}).required().label('User').description('Public user information, as displayed in overview lists');

import { missionSchema } from './mission';

export const userDetailsSchema = userSchema.keys({
    missions: Joi.array().items(missionSchema.optional()).required().label('Missions').description('List of missions created by the user')
}).required().label('UserDetails').description('Detailed user information, as displayed in user profiles');

export const userAccountDetailsSchema = userDetailsSchema.keys({
    permissions: Joi.array().items(Joi.string().min(1).max(255).optional().description('Permission granted to user, in dotted notation')
        .example('community.spezialeinheit-luchs.leader')).required().description('List of permissions currently assigned to the user, in dotted notation')
}).required().label('UserAccountDetails').description('Detailed user information including private information, as displayed in the account panel');
