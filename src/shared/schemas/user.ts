import * as Joi from 'joi';

/**
 * Schema for public user information
 */
export const userSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    nickname: Joi.string().min(1).max(255).required().description('Nickname of the user (not guaranteed to be unique, can be freely changed)').example('MorpheusXAUT')
}).required().label('User').description('Public user information, as displayed in overview lists');
