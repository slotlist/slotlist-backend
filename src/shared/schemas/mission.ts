import * as Joi from 'joi';

import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN, MISSION_VISIBILITY_PUBLIC } from '../models/Mission';
import { userSchema } from './user';

/**
 * Schema for public mission information
 */
export const missionSchema = Joi.object().keys({
    title: Joi.string().min(1).max(255).required().description('Title of the mission').example('All of Altis'),
    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
        .description('Slug used for uniquely identifying a mission in the frontend, easier to read than a UUID').example('all-of-altis'),
    startTime: Joi.date().required().description('Date and time the missions starts (slotting/briefing times are stored separately and available via mission details')
        .example('2017-09-02T17:00:00.000Z'),
    endTime: Joi.date().required().description('Estimated date and time the missions ends, in UTC. Must be equal to or after `startTime`, just an estimation by the mission ' +
        'creator. The actual end time might vary').example('2017-09-02T22:00:00.000Z'),
    creator: userSchema.required().description('Creator of the mission'),
    slotCounts: Joi.object().keys({
        assigned: Joi.number().integer().positive().allow(0).min(0).description('Number of slots with assignments').example(9),
        blocked: Joi.number().integer().positive().allow(0).min(0).description('Number of blocked slots').example(9),
        external: Joi.number().integer().positive().allow(0).min(0).description('Number of slots assigned to external users').example(9),
        open: Joi.number().integer().positive().allow(0).min(0).description('Number of slots without an assignment or any registrations, including slots restricted to the ' +
            'user\'s community').example(9),
        reserve: Joi.number().integer().positive().allow(0).min(0).description('Number of reserve slots').example(9),
        restricted: Joi.number().integer().positive().allow(0).min(0).description('Number of restricted slots').example(9),
        total: Joi.number().integer().positive().allow(0).min(0).description('Total number of slots created for the mission').example(9),
        unassigned: Joi.number().integer().positive().allow(0).min(0).description('Number of slots with registrations that have not been assigned yet').example(9)
    }).required().label('slotCounts').description('Slot counts for the mission, including number of slots with different states such as `open`, `unassigned` or `assigned`'),
    isAssignedToAnySlot: Joi.bool().optional().description('Indicates whether the user is assigned to any slot in the mission. Only present for requests by authenticated users')
        .example(true),
    isRegisteredForAnySlot: Joi.bool().optional().description('Indicates whether the user is registered for any slot in the mission. Only present for requests by ' +
        'authenticated users').example(true)
}).required().label('Mission').description('Public mission information, as displayed in overview lists');

// Imported below public missionSchema so circular dependencies work
// communityDetailsSchema depends on missionSchema
import { communitySchema } from './community';

export const missionServerInfoSchema = Joi.object().keys({
    hostname: Joi.string().min(1).required().description('Hostname of the server').example('example.com'),
    port: Joi.number().min(0).max(65535).required().description('Port of the server').example(2302),
    password: Joi.string().min(1).allow(null).default(null).optional().description('Optional password of the server. Set to `null` if no password is required').example('hunter2')
}).required().label('MissionServerInfo').description('Contains information about a server used during a mission. This could either be a gameserver or voice comms');

export const missionDetailsSchema = missionSchema.keys({
    description: Joi.string().min(1).required().description('Short (plaintext) description and summary of mission').example('Conquer all of Altis!'),
    detailedDescription: Joi.string().min(1).required().description('Full, detailed description of the mission. Can contain HTML for formatting')
        .example('<h1>All of Altis</h1><h2>Tasks</h2><ol><li>Have fun!</li></ol>'),
    bannerImageUrl: Joi.string().allow(null).uri().min(1).default(null).description('Optional URL of banner image to be displayed on mission details')
        .example('https://example.org/banner.png'),
    briefingTime: Joi.date().required().description('Date and time the mission briefing starts, in UTC. The briefing usually only includes players with leadership roles')
        .example('2017-09-02T16:00:00.000Z'),
    slottingTime: Joi.date().required().description('Date and time the mission slotting starts, in UTC. Players are encouraged to join the server and choose their reserved slot ' +
        'at this time').example('2017-09-02T16:00:00.000Z'),
    repositoryUrl: Joi.string().allow(null).min(1).default(null).optional()
        .description('URL of the mod repository used for the mission. Can be null if no additional mods are required. Can contain HTML for formatting')
        .example('<a href="http://spezialeinheit-luchs.de/repo/Arma3/baseConfig/.a3s/autoconfig">SeL main repo</a>'),
    techSupport: Joi.string().allow(null).min(1).default(null).optional()
        .description('Information regarding any technical support provided before the mission, can be null if not provided. Can contain HTML for formatting')
        .example('<div><strong>TechCheck</strong> available 3 days before mission, <strong>TechSupport</strong> available 2 hours before mission start </div>'),
    rules: Joi.string().allow(null).min(1).default(null).optional()
        .description('Additional ruleset for this mission, can be null if not applicable. Can contain HTML for formatting')
        .example('<ol><li>Be punctual, no join in progress!</li></ol>'),
    gameServer: missionServerInfoSchema.allow(null).default(null).optional(),
    voiceComms: missionServerInfoSchema.allow(null).default(null).optional(),
    visibility: Joi.string().equal(MISSION_VISIBILITIES).default(MISSION_VISIBILITY_HIDDEN).required()
        .description('Indicates the visibility setting of a mission. Missions with `public` visibility are visible to everyone, `hidden` missions are only visible to the ' +
        'mission creator and assigned mission editors. The `community` visibility makes the mission visible to all members of the mission creator\'s community. The `private` ' +
        'visibility setting restricts access to selected users, although this functionality is currently not implemented yet (as of 2017-08-23)')
        .example(MISSION_VISIBILITY_PUBLIC),
    community: communitySchema.allow(null).default(null).optional().label('Community')
        .description('Community of the mission, if associated via user. Can be null if user is not assigned to community or removed mission association')
}).required().label('MissionDetails').description('Detailed public mission information, as displayed on mission page. Include more detailed mission times, as well as a longer ' +
'description and additional information required for participating');
