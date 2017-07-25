import * as Joi from 'joi';

import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import { userAccountDetailsSchema } from '../../../shared/schemas/user';
import * as controller from '../../controllers/v1/auth';

/**
 * All routes regarding authentication
 */
export const auth = [
    {
        method: 'GET',
        path: '/v1/auth/steam',
        handler: controller.getSteamLoginRedirectURL,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns the redirect URL for Steam OpenID signin',
            notes: 'SSO callback returns to frontend, backend later verifies claims via POST to `/v1/auth/steam`. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'auth', 'steam'],
            response: {
                schema: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID URL to redirect to for signin')
                }).label('GetSteamLoginRedirectURLResponse').description('Response containing Steam OpenID URL to redirect user to')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        500: {
                            description: 'An error occured while processing the request',
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'POST',
        path: '/v1/auth/steam',
        handler: controller.verifySteamLogin,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Verifies the provided Steam OpenID claims and returns a JWT on success',
            notes: 'After the verification call to Steam\'s OpenID provider succeedes, the current user database will be checked for the ' +
            'SteamID. If the user does not exist, their public Steam information will be retrieved and a new entry created. A JWT with ' +
            'the user\'s nickname as well as permissions is then returned. No authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'auth', 'steam', 'verify', 'jwt'],
            validate: {
                options: {
                    abortEarly: false
                },
                payload: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID claims in URL form, as returned to the frontend')
                }).label('VerifySteamLogin')
            },
            response: {
                schema: Joi.object().required().keys({
                    token: Joi.string().min(1).required().description('JWT to use for authentication')
                }).label('VerifySteamLoginResponse').description('Response containing JWT to use for authentication')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        500: {
                            description: 'An error occured while processing the request',
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'GET',
        path: '/v1/auth/account',
        handler: controller.getAccountDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns the user\'s account details',
            notes: 'Returns the user\'s account information, providing an overview over the currently logged in user as well as modifications available. ' +
            'Regular user authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'auth', 'account', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true)
            },
            response: {
                schema: Joi.object().required().keys({
                    user: userAccountDetailsSchema.required().description('Detailed user information including private data for the currently logged in account')
                }).label('GetAccountDetailsResponse').description('Response containing the user\'s account details including private information')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'User stored in JWT does not exist in database anymore',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Current user not found').required().description('Message further describing the error')
                            })
                        },
                        500: {
                            description: 'An error occured while processing the request',
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'PATCH',
        path: '/v1/auth/account',
        handler: controller.patchAccountDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Modifies the user\'s mutable account details',
            notes: 'Allows for modification of the user\'s mutable account information - users can update their nickname. '
            + 'Regular user authentication is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'auth', 'account', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    nickname: Joi.string().min(1).max(255).optional().description('New nickname to set for current user').example('MorpheusXAUT')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    user: userAccountDetailsSchema.required().description('Detailed user information including private data for the currently logged in account')
                }).label('PatchAccountDetailsResponse').description('Response containing the updated account details including private information')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        500: {
                            description: 'An error occured while processing the request',
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    }
];
