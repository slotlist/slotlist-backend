import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for public community information
 */
export const communitySchema = Joi.object().keys({
    name: Joi.string().min(1).max(255).required().description('Name of the community').example('Spezialeinheit Luchs'),
    tag: Joi.string().min(1).max(255).required().description('Community tag (without square brackets, will be added by frontend)').example('SeL'),
    website: Joi.string().uri().allow(null).min(1).max(255).default(null).required().description('Website of the community, can be null if none exists')
        .example('http://spezialeinheit-luchs.de'),
    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
        .description('Slug used for uniquely identifying a community in the frontend, easier to read than a UUID').example('spezialeinheit-luchs')
}).required().label('Community').description('Public community information, as displayed in overview lists');

// Imported below public communitySchema so circular dependencies work
// missionDetailsSchema depends on communitySchema
import { missionSchema } from './mission';

export const communityDetailsSchema = communitySchema.keys({
    leaders: Joi.array().items(userSchema.optional()).required()
        .description('Community members holding leadership permissions. This includes users with permissions `community.SLUG.*`, ' +
        '`community.SLUG.founder` and `community.SLUG.leader`'),
    members: Joi.array().items(userSchema.optional()).required().description('Members currently associated with the community (excluding leaders)'),
    missions: Joi.array().items(missionSchema.optional()).required().description('Missions created by members of the community')
}).required().label('CommunityDetails')
    .description('Detailed public community information, as displayed on community profile. Includes leaders, members and missions created by members');
