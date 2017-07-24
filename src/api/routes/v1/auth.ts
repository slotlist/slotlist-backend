import * as Joi from 'joi';

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
            auth: false,
            description: 'Returns the redirect URL for Steam OpenID signin',
            notes: 'SSO callback returns to frontend, backend later verifies claims via POST to `/v1/auth/steam`',
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
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(500).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Internal Server Error').required().description('HTTP status code text respresentation'),
                                message: Joi.string().required().description('Message further describing the error').example('An internal server error occurred')
                            })
                        }
                    }
                }
            }
        }
    },
    {
        method: 'post',
        path: '/v1/auth/steam',
        handler: controller.verifySteamLogin,
        config: {
            auth: false,
            description: 'Verifies the provided Steam OpenID claims and returns a JWT on success',
            notes: 'After the verification call to Steam\'s OpenID provider succeedes, the current user database will be checked for the ' +
            'SteamID. If the user does not exist, their public Steam information will be retrieved and a new entry created. A JWT with ' +
            'the user\'s nickname as well as permissions is then returned',
            tags: ['api', 'post', 'v1', 'auth', 'steam', 'verify', 'jwt'],
            response: {
                schema: Joi.object().required().keys({
                    token: Joi.string().required().min(1).description('JWT to use for authentication')
                }).label('VerifySteamLoginResponse').description('Response containing JWT to use for authentication')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        500: {
                            description: 'An error occured while processing the request',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(500).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Internal Server Error').required().description('HTTP status code text respresentation'),
                                message: Joi.string().required().description('Message further describing the error').example('An internal server error occurred')
                            })
                        }
                    }
                }
            },
            validate: {
                options: {
                    abortEarly: false
                },
                payload: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID claims in URL form, as returned to the frontend')
                }).label('VerifySteamLogin')
            }
        }
    }
];
