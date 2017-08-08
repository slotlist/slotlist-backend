import * as Joi from 'joi';

import { userSchema } from './user';

/**
 * Schema for (decoded) JWT payloads
 */
export const jwtPayloadSchema = Joi.object().keys({
    user: userSchema.required().description('Details of the user the JWT has been issued for'),
    permissions: Joi.array().items(Joi.string().min(1).max(255).optional().description('Permission granted to user, in dotted notation')
        .example('community.spezialeinheit-luchs.leader')).required().description('List of permissions currently assigned to the user, in dotted notation'),
    iat: Joi.number().positive().integer().required().description('Unix timestamp at which the JWT was issued at'),
    nbf: Joi.number().positive().integer().required().description('Unix timestamp before which the JWT is not valid'),
    exp: Joi.number().positive().integer().required().description('Unix timestamp of the JWT\'s expiration'),
    aud: Joi.string().min(1).required().description('Audience the JWT was issued for'),
    iss: Joi.string().min(1).required().description('Entity that has issued the JWT'),
    sub: Joi.string().guid().required().description('Subject of the JWT, in this case the user\'s UID')
}).required().label('JWTPayload').description('Payload expected for each decoded JWT');
