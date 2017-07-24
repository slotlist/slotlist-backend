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
    creator: userSchema.description('Creator of the mission')
}).required().label('Mission').description('Public mission information, as displayed in overview lists');
