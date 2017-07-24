import * as Joi from 'joi';

import * as schemas from '../../../shared/schemas/mission';
import * as controller from '../../controllers/v1/mission';

/**
 * All routes regarding missions
 */

export const LIMITS = {
    missionList: {
        default: 25,
        max: 100
    }
};

export const mission = [
    {
        method: 'GET',
        path: '/v1/missions',
        handler: controller.getMissionList,
        config: {
            auth: false,
            description: 'Returns a list of all currently created missions',
            notes: 'Returns a paginated list of all currently created mission. Up to 100 mission can be requested at once, pagination has to be used to retrieve the ' +
            'rest. By default, only missions that have not ended yet are being displayed. No authentication is required to access this endpoint.',
            tags: ['api', 'get', 'v1', 'missions', 'list'],
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionList.max).required()
                        .description('Limit for number of missions to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of missions to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionList.max).required()
                        .description('Actual number of missions returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more missions are available and can be retrieved using pagination'),
                    missions: Joi.array().items(schemas.missionSchema.optional()).required().description('List of missions retrieved')
                }).label('GetMissionListResponse').description('Response containing list of currently created missions')
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
                headers: Joi.object({
                    Authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionList.max).default(LIMITS.missionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().required().default(false).description('Include ended missions in retrieved list, defaults to false').optional()
                })
            }
        }
    },
    {
        method: 'GET',
        path: '/v1/missions/{slug}',
        handler: controller.getMissionDetails,
        config: {
            auth: false,
            description: 'Returns details about a specific mission',
            notes: 'Returns more detailed information about a specific mission, including more detailed mission times as well as a longer description and additional ' +
            'information required for participating. No authentication is required to access this endpoint.',
            tags: ['api', 'get', 'v1', 'missions', 'details'],
            response: {
                schema: Joi.object().required().keys({
                    mission: schemas.missionDetailsSchema
                }).label('GetMissionDetailsResponse').description('Response containing details of requested mission')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No mission with given slug was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found').required().description('Message further describing the error')
                            })
                        },
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
                headers: Joi.object({
                    Authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(),
                params: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).required().description('Slug of mission to retrieve').example('all-of-altis')
                })
            }
        }
    }
];
