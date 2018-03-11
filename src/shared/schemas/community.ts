import * as Joi from 'joi';

import { missionRepositoryInfoSchema } from './missionRepositoryInfo';
import { missionServerInfoSchema } from './missionServerInfo';

/**
 * Schema for public community information
 */
export const communitySchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the community').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    name: Joi.string().min(1).max(255).required().description('Name of the community').example('Spezialeinheit Luchs'),
    tag: Joi.string().min(1).max(255).required().description('Community tag (without square brackets, will be added by frontend)').example('SeL'),
    website: Joi.string().uri().allow(null).min(1).max(255).default(null).optional().description('Website of the community, can be `null` if none exists')
        .example('http://spezialeinheit-luchs.de'),
    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
        .description('Slug used for uniquely identifying a community in the frontend, easier to read than a UUID').example('spezialeinheit-luchs'),
    logoUrl: Joi.string().allow(null).uri().min(1).default(null).description('Optional URL of logo to be displayed on community details')
        .example('https://example.org/logo.png')
}).required().label('Community').description('Public community information, as displayed in overview lists');

// Imported below public communitySchema so circular dependencies work
// missionDetailsSchema depends on communitySchema
import { missionSchema } from './mission';
import { userSchema } from './user';

export const communityDetailsSchema = communitySchema.keys({
    leaders: Joi.array().items(userSchema.optional()).required()
        .description('Community members holding leadership permissions. This includes users with permissions `community.SLUG.*`, ' +
        '`community.SLUG.founder` and `community.SLUG.leader`'),
    members: Joi.array().items(userSchema.optional()).required().description('Members currently associated with the community (excluding leaders)'),
    missions: Joi.array().items(missionSchema.optional()).required().description('Missions created by members of the community'),
    gameServers: Joi.array().items(missionServerInfoSchema.optional()).optional().description('List of gameservers defined for the community. Will only be present ' +
        'for community members'),
    voiceComms: Joi.array().items(missionServerInfoSchema.optional()).optional().description('List of voice comms defined for the community. Will only be present ' +
        'for community members'),
    repositories: Joi.array().items(missionRepositoryInfoSchema.optional()).optional().description('List of mod repositories defined for the community. Will only be present ' +
        'for community members')
}).required().label('CommunityDetails')
    .description('Detailed public community information, as displayed on community profile. Includes leaders, members and missions created by members');
