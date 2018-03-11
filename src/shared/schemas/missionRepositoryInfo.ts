import * as Joi from 'joi';

import { MISSION_REPOSITORY_TYPE_ARMA3SYNC, MISSION_REPOSITORY_TYPES } from '../types/mission';

/**
 * Schema for public mission repository information
 */
export const missionRepositoryInfoSchema = Joi.object().keys({
    name: Joi.string().min(1).required().description('Name of the repository, mostly useful for searching in repo lists').example('SeL Mainrepo'),
    kind: Joi.string().valid(MISSION_REPOSITORY_TYPES).required().description('Kind of mod repository, used for further distinguishment in the frontend')
        .example(MISSION_REPOSITORY_TYPE_ARMA3SYNC),
    url: Joi.string().uri().min(1).allow(null).default(null).optional().description('URL of the mod repository, must be a valid URI')
        .example('https://spezialeinheit-luchs.de/repo/Arma3/minimal/.a3s/autoconfig'),
    notes: Joi.string().min(1).allow(null).default(null).optional().description('Additional notes about the mod repository. Can contain HTML for formatting')
        .example('<a href="https://spezialeinheit-luchs.de/Mitspielen/Technik/Repo-Installation">How to install our mods</a>')
}).or('url', 'notes').required().label('MissionRepositoryInfo').description('Contains information about a mod repository used for a mission');
