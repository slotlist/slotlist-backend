import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for public mission information
 */
export const missionSchema = Joi.object().keys({
    title: Joi.string().min(1).max(255).required().description('Title of the mission').example('All of Altis'),
    slug: Joi.string().min(1).max(255).required().description('Slug used for uniquely identifying a mission in the frontend, easier to read than a UUID').example('all-of-altis'),
    shortDescription: Joi.string().min(1).required().description('Short description and summary of mission').example('Conquer all of Altis!'),
    startTime: Joi.date().required().description('Date and time the missions starts (slotting/briefing times are stored separately and available via mission details')
        .example('2017-09-02T17:00:00.000Z'),
    creator: userSchema.required().description('Creator of the mission')
}).required().label('Mission').description('Public mission information, as displayed in overview lists');

// Imported below public missionSchema so circular dependencies work
// communityDetailsSchema depends on missionSchema
import { communitySchema } from './community';

export const missionDetailsSchema = Joi.object().keys({
    title: Joi.string().min(1).max(255).required().description('Title of the mission').example('All of Altis'),
    slug: Joi.string().min(1).max(255).required().description('Slug used for uniquely identifying a mission in the frontend, easier to read than a UUID').example('all-of-altis'),
    description: Joi.string().min(1).required().description('Full description of the mission. Can contain HTML for formatting')
        .example('<h1>All of Altis</h1><h2>Tasks</h2><ol><li>Have fun!</li></ol>'),
    shortDescription: Joi.string().min(1).required().description('Short description and summary of mission').example('Conquer all of Altis!'),
    briefingTime: Joi.date().required().description('Date and time the mission briefing starts, in UTC. The briefing usually only includes players with leadership roles')
        .example('2017-09-02T16:00:00.000Z'),
    slottingTime: Joi.date().required().description('Date and time the mission slotting starts, in UTC. Players are encouraged to join the server and choose their reserved slot ' +
        'at this time').example('2017-09-02T16:00:00.000Z'),
    startTime: Joi.date().required().description('Date and time the missions starts, in UTC. Must be equal to or after `slottingTime`')
        .example('2017-09-02T17:00:00.000Z'),
    endTime: Joi.date().required().description('Estimated date and time the missions ends, in UTC. Must be equal to or after `startTime`, just an estimation by the mission ' +
        'creator. The actual end time might vary').example('2017-09-02T22:00:00.000Z'),
    repositoryUrl: Joi.string().allow(null).min(1).max(255).default(null).optional()
        .description('URL of the mod repository used for the mission. Can be null if no additional mods ' +
        'are required. Can contain HTML for formatting').example('http://spezialeinheit-luchs.de/repo/Arma3/baseConfig/.a3s/autoconfig'),
    techSupport: Joi.string().allow(null).min(1).default(null).optional()
        .description('Information regarding any technical support provided before the mission, can be null if not provided. Can contain HTML for formatting')
        .example('<div><strong>TechCheck</strong> available 3 days before mission, <strong>TechSupport</strong> available 2 hours before mission start </div>'),
    rules: Joi.string().allow(null).min(1).default(null).optional()
        .description('Additional ruleset for this mission, can be null if not applicable. Can contain HTML for formatting')
        .example('<ol><li>Be punctual, no join in progress!</li></ol>'),
    community: Joi.alternatives([communitySchema]).allow(null).default(null).optional().label('Community')
        .description('Community of the mission, if associated via user. Can be null if user is not assigned to community or removed mission association'),
    creator: userSchema.required().description('Creator of the mission')
}).required().label('MissionDetails').description('Detailed public mission information, as displayed on mission page. Include more detailed mission times, as well as a longer ' +
'description and additional information required for participating');
