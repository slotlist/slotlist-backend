import * as Joi from 'joi';

/**
 * Schema for public community information
 */
export const communitySchema = Joi.object().keys({
    name: Joi.string()
}).required().label('Community').description('Public community information, as displayed in overview lists');
