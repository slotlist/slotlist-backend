import * as Joi from 'joi';

import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import { missionSchema } from '../../../shared/schemas/mission';
import * as schemas from '../../../shared/schemas/user';
import * as controller from '../../controllers/v1/user';

/**
 * All routes regarding users
 */

export const LIMITS = {
    userMissionList: {
        default: 25,
        max: 100
    }
};

export const user = [
    {
        method: 'GET',
        path: '/v1/users/{uid}',
        handler: controller.getUserDetails,
        config: {
            auth: false,
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
                    uid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
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
        method: 'GET',
        path: '/v1/users/{uid}/missions',
        handler: controller.getUserMissionList,
        config: {
            auth: false,
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
                    uid: Joi.string().guid().length(36).required().description('UID of the user').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.userMissionList.max).default(LIMITS.userMissionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().required().default(false).description('Include ended missions in retrieved list, defaults to false').optional()
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
