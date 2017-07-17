import * as Joi from 'joi';

/**
 * Schema for (decoded) JWT payloads
 */
export const jwtPayloadSchema = Joi.object().keys({
    user: Joi.object().keys({
        uid: Joi.string().guid().min(1).required().description('UID of the user the JWt has been issued for'),
        nickname: Joi.string().min(1).required().description('Nickname of the user the JWT has been issued for')
    }).required().description('Details of the user the JWT has been issued for'),
    permissions: Joi.array().items(Joi.string().min(1).optional().description('Permission string to allow')).required()
        .description('Permissions assigned to the user the JWT has been issued for'),
    iat: Joi.number().positive().integer().required().description('Unix timestamp at which the JWT was issued at'),
    nbf: Joi.number().positive().integer().required().description('Unix timestamp before which the JWT is not valid'),
    exp: Joi.number().positive().integer().required().description('Unix timestamp of the JWT\'s expiration'),
    aud: Joi.string().min(1).required().description('Audience the JWT was issued for'),
    iss: Joi.string().min(1).required().description('Entity that has issued the JWT'),
    sub: Joi.string().guid().required().description('Subject of the JWT, in this case the user\'s UID')
}).required().label('JWTPayload').description('Payload expected for each decoded JWT');
