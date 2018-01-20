import * as Joi from 'joi';

import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import { missionSchema } from '../../../shared/schemas/mission';
import * as schemas from '../../../shared/schemas/user';
import * as controller from '../../controllers/v1/user';

/**
 * All routes regarding users
 */

export const LIMITS = {
    userList: {
        default: 25,
        max: 100
    },
    userMissionList: {
        default: 25,
        max: 100
    }
};

export const user = [
    {
        method: 'GET',
        path: '/v1/users',
        handler: controller.getUserList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all currently existing users',
            notes: 'Returns a paginated list of all currently existing users. Up to 100 users can be requested at once, pagination has to be used to retrieve the ' +
            'rest. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'users', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.userList.max).default(LIMITS.userList.default).optional()
                        .description('Limit for number of users to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of users to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    search: Joi.string().min(1).allow(null).default(null).optional().description('Value used for searching users, retrieving only those that ' +
                        'have a nickname containing the provided value').example('morpheus'),
                    communityUid: Joi.string().min(1).allow(null).default(null).optional().description('Optional filter for user search, restricting matches to only members ' +
                        'of the community with the given UID. Only effective if a `search` value has been provided').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.userList.max).required()
                        .description('Limit for number of users to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of users to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.userList.max).required()
                        .description('Actual number of users returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of users stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more users are available and can be retrieved using pagination'),
                    users: Joi.array().items(schemas.userSchema.optional()).required().description('List of users retrieved')
                }).label('GetUserListResponse').description('Response containing list of currently existing users')
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
        path: '/v1/users/{userUid}',
        handler: controller.getUserDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns details about a specific user',
            notes: 'Returns more detailed information about a specific user, including a list of created missions. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'users', 'details'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    user: schemas.userDetailsSchema
                }).label('GetUserDetailsResponse').description('Response containing details of requested user')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No user with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
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
        path: '/v1/users/{userUid}',
        handler: controller.modifyUserDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Allows administrators to modify the details of a specific user',
            notes: 'Allows administrators to modify the details of a specific user such as their nickname as well as to activate and deactivate their account. This endpoint' +
            'can only be used by administrators with the `admin.user` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'users', 'update', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user to update').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    nickname: Joi.string().min(1).max(255).optional().description('New nickname to set for user').example('MorpheusXAUT'),
                    active: Joi.bool().optional().description('New account status to set for user. Setting `false` disables a user\'s account and prevents them from logging in')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    user: schemas.userSchema
                }).label('ModifyUserDetailsResponse').description('Response containing updated details of user')
            },
            plugins: {
                acl: {
                    permissions: ['admin.user']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'An admin tried updating another admin account or a user without appropriate permissions is accessing the endpoint',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Forbidden').required().description('Message further describing the error')
                            })
                        },
                        404: {
                            description: 'No user with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
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
        method: 'DELETE',
        path: '/v1/users/{userUid}',
        handler: controller.deleteUser,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Allows administrators to delete a specific user',
            notes: 'Allows administrators to delete a specific user, permanentely removing all data related to their account from the database. This endpoint' +
            'can only be used by administrators with the `admin.user` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'users', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteUserResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['admin.user']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'An admin tried deleting another admin account or a user without appropriate permissions is accessing the endpoint',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Forbidden').required().description('Message further describing the error')
                            })
                        },
                        404: {
                            description: 'No user with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
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
        method: 'GET',
        path: '/v1/users/{userUid}/missions',
        handler: controller.getUserMissionList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of missions for a specific user',
            notes: 'Returns a paginated list of missions for a specific user, including already completed ones. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'users', 'mission', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.userMissionList.max).default(LIMITS.userMissionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().default(false).optional().description('Include ended missions in retrieved list, defaults to false')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.userMissionList.max).required()
                        .description('Limit for number of missions to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of missions to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.userMissionList.max).required()
                        .description('Actual number of missions returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more missions are available and can be retrieved using pagination'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of missions stored for this user'),
                    missions: Joi.array().items(missionSchema.optional()).required().description('List of missions retrieved')
                }).label('GetUserMissionListResponse').description('Response containing list of missions created by the user')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No user with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
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
    }
];
