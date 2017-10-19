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
            // Explicitly disable auth parsing here since invalid/expired JWTs being sent by the frontend would prevent the user from ever being able to log in again
            // See: https://github.com/MorpheusXAUT/slotlist-frontend/issues/14 and https://github.com/MorpheusXAUT/slotlist-backend/issues/6
            auth: false,
            description: 'Returns the redirect URL for Steam OpenID signin',
            notes: 'SSO callback returns to frontend, backend later verifies claims via POST to `/v1/auth/steam`. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'auth', 'steam'],
            response: {
                schema: Joi.object().required().keys({
                    url: Joi.string().uri().required().description('Steam OpenID URL to redirect to for signin')
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
            // Explicitly disable auth parsing here since invalid/expired JWTs being sent by the frontend would prevent the user from ever being able to log in again
            // See: https://github.com/MorpheusXAUT/slotlist-frontend/issues/14 and https://github.com/MorpheusXAUT/slotlist-backend/issues/6
            auth: false,
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
                    url: Joi.string().uri().required().description('Steam OpenID claims in URL form, as returned to the frontend')
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
                        403: {
                            description: 'The user account has been deactivated by an administrator',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User deactivated').required().description('Message further describing the error')
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
        method: 'POST',
        path: '/v1/auth/refresh',
        handler: controller.refreshJWT,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Refreshes the user\'s JWT',
            notes: 'Refreshes the user\'s JWT by generating a new one. The updated JWT includes the latest permissions and nickname changes - this endpoint should thus be used ' +
            'after every modifying change (e.g. nickname change, community association, permission grants, etc.). Regular user authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'auth', 'refresh', 'jwt', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                }
            },
            response: {
                schema: Joi.object().required().keys({
                    token: Joi.string().min(1).required().description('New JWT to use for authentication')
                }).label('RefreshJWTResponse').description('Response containing new JWT to use for authentication')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'User stored in JWT does not exist in database anymore',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User not found').required().description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'The user account has been deactivated by an administrator',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User deactivated').required().description('Message further describing the error')
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
                                message: Joi.string().equal('User not found').required().description('Message further describing the error')
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
                    user: userAccountDetailsSchema.required().description('Detailed user information including private data for the currently logged in account'),
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated account details')
                }).label('PatchAccountDetailsResponse').description('Response containing the updated account details including private information')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'User stored in JWT does not exist in database anymore',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User not found').required().description('Message further describing the error')
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
        method: 'POST',
        path: '/v1/auth/account/delete',
        handler: controller.deleteAccount,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes the user\'s account and all information associated, including mission data',
            notes: 'Deletes the user\'s account and all information associated, including mission data. This operation is final and requires "verification" by '
            + ' confirm the user\'s current nickname. Regular user authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'auth', 'account', 'delete', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    nickname: Joi.string().min(1).max(255).required().description('Exact current nickname of user, as a confirmation for the deletion').example('MorpheusXAUT')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteAccountResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'User stored in JWT does not exist in database anymore',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User not found').required().description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'The user account has been deactivated by an administrator',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('User deactivated').required().description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The nickname provided did not exactly match the user\'s current nickname',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Provided nickname does not match current nickname').required()
                                    .description('Message further describing the error')
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
    }
];
