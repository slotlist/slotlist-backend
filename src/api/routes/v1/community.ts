import * as Joi from 'joi';

import * as schemas from '../../../shared/schemas/community';
import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import { missionSchema } from '../../../shared/schemas/mission';
import * as controller from '../../controllers/v1/community';

/**
 * All routes regarding communities
 */

export const LIMITS = {
    communityList: {
        default: 25,
        max: 100
    },
    communityMissionList: {
        default: 25,
        max: 100
    }
};

export const community = [
    {
        method: 'GET',
        path: '/v1/communities',
        handler: controller.getCommunityList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all currently created communities',
            notes: 'Returns a paginated list of all currently created communities. Up to 100 communities can be requested at once, pagination has to be used to retrieve the ' +
            'rest. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityList.max).default(LIMITS.communityList.default).optional()
                        .description('Limit for number of communities to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of communities to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityList.max).required()
                        .description('Limit for number of communities to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of communities to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityList.max).required()
                        .description('Actual number of communities returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more communities are available and can be retrieved using pagination'),
                    communities: Joi.array().items(schemas.communitySchema.optional()).required().description('List of communities retrieved')
                }).label('GetCommunityListResponse').description('Response containing list of currently created communities')
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
        path: '/v1/communities/slugAvailable',
        handler: controller.isSlugAvailable,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Checks whether the given slug is available',
            notes: 'Checks whether the given slug is available and can be used for a new community. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'slugAvailable'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug to check availability for').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    available: Joi.boolean().required().description('Indicates whether the slug is available for usage')
                }).label('IsCommunitySlugAvailableResponse').description('Response containing indicator if slug is available')
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
        path: '/v1/communities',
        handler: controller.createCommunity,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new community',
            notes: 'Creates a new community and assigns the current user as its founder. Regular user authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'communities', 'create', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    name: Joi.string().min(1).max(255).required().description('Name of the community').example('Spezialeinheit Luchs'),
                    tag: Joi.string().min(1).max(255).required().description('Community tag (without square brackets, will be added by frontend)').example('SeL'),
                    website: Joi.string().uri().allow(null).min(1).max(255).default(null).optional().description('Website of the community, can be null if none exists')
                        .example('http://spezialeinheit-luchs.de'),
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
                        .description('Slug used for uniquely identifying a community in the frontend, easier to read than a UUID').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema
                }).label('CreateCommunityResponse').description('Response containing details of newly created community')
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
        path: '/v1/communities/{slug}',
        handler: controller.getCommunityDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns details about a specific community',
            notes: 'Returns more detailed information about a specific community, including a short list of currently announced missions as well as a member list. ' +
            'No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'details'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema
                }).label('GetCommunityDetailsResponse').description('Response containing details of requested community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No community with given slug was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found').required().description('Message further describing the error')
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
        path: '/v1/communities/{slug}/apply',
        handler: controller.getCommunityDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Applies to join the specified community',
            notes: 'Applies to join the specified community, has to be approved by community leader or members with the `community.SLUG.recruitment` permission. ' +
            'Regular user authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'communities', 'apply', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to apply to').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema
                }).label('GetCommunityDetailsResponse').description('Response containing details of requested community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No community with given slug was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found').required().description('Message further describing the error')
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
        path: '/v1/communities/{slug}/missions',
        handler: controller.getCommunityMissionList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of missions for a specific community',
            notes: 'Returns a paginated list of missions for a specific community, including already completed ones. Allows for mission lists to be ' +
            'refresh without having to fetch all other community details. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'mission', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve').example('spezialeinheit-luchs')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityMissionList.max).default(LIMITS.communityMissionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().required().default(false).description('Include ended missions in retrieved list, defaults to false').optional()
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityMissionList.max).required()
                        .description('Limit for number of missions to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of missions to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityMissionList.max).required()
                        .description('Actual number of missions returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more missions are available and can be retrieved using pagination'),
                    missions: Joi.array().items(missionSchema.optional()).required().description('List of missions retrieved')
                }).label('GetCommunityMissionListResponse').description('Response containing list of missions assigned to the community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No community with given slug was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found').required().description('Message further describing the error')
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
