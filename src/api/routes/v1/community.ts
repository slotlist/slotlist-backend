import * as Joi from 'joi';

import {
    COMMUNITY_APPLICATION_STATUS_ACCEPTED,
    COMMUNITY_APPLICATION_STATUS_DENIED,
    COMMUNITY_APPLICATION_STATUS_SUBMITTED,
    COMMUNITY_APPLICATION_STATUSES
} from '../../../shared/models/CommunityApplication';
import * as schemas from '../../../shared/schemas/community';
import { communityApplicationSchema } from '../../../shared/schemas/communityApplication';
import { forbiddenSchema, internalServerErrorSchema } from '../../../shared/schemas/misc';
import { missionSchema } from '../../../shared/schemas/mission';
import { missionRepositoryInfoSchema } from '../../../shared/schemas/missionRepositoryInfo';
import { missionServerInfoSchema } from '../../../shared/schemas/missionServerInfo';
import { permissionSchema } from '../../../shared/schemas/permission';
import { userSchema } from '../../../shared/schemas/user';
import * as controller from '../../controllers/v1/community';

/**
 * All routes regarding communities
 */

export const LIMITS = {
    communityList: {
        default: 25,
        max: 100
    },
    communityApplicationList: {
        default: 25,
        max: 100
    },
    communityMissionList: {
        default: 25,
        max: 100
    },
    communityPermissionList: {
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
                        .description('Number of communities to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    search: Joi.string().min(1).allow(null).default(null).optional().description('Value used for searching communities, retrieving only those that ' +
                        'have a name or tag containing the provided value').example('spezialein')
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
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of communities stored'),
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
                    website: Joi.string().uri().allow(null).min(1).max(255).default(null).optional().description('Website of the community, can be `null` if none exists')
                        .example('http://spezialeinheit-luchs.de'),
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
                        .description('Slug used for uniquely identifying a community in the frontend, easier to read than a UUID').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema,
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated permissions')
                }).label('CreateCommunityResponse').description('Response containing details of newly created community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'The user from the provided JWT was not found in the database',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Token user not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'A community with the given slug already exists or the user already has community founder permissions',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community slug already exists', 'Community founder permission already exists').required()
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
    },
    {
        method: 'GET',
        path: '/v1/communities/{communitySlug}',
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
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve').example('spezialeinheit-luchs')
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
        method: 'PATCH',
        path: '/v1/communities/{communitySlug}',
        handler: controller.updateCommunity,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing community',
            notes: 'Updates the mutable attributes of a community. This endpoint can only be used by community leaders. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'communities', 'update', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to update').example('spezialeinheit-luchs')
                }),
                payload: Joi.object().required().keys({
                    name: Joi.string().min(1).max(255).optional().description('New name of the community').example('Spezialeinheit Luchs'),
                    tag: Joi.string().min(1).max(255).optional().description('New community tag (without square brackets, will be added by frontend)').example('SeL'),
                    website: Joi.string().uri().allow(null).min(1).max(255).optional().description('New website of the community, can be `null` if none exists')
                        .example('http://spezialeinheit-luchs.de'),
                    gameServers: Joi.array().items(missionServerInfoSchema.optional()).optional().description('New array of game servers to define for the community. Set to ' +
                        'an empty array to remove all entries'),
                    voiceComms: Joi.array().items(missionServerInfoSchema.optional()).optional().description('New array of voice comms to define for the community. Set to ' +
                        'an empty array to remove all entries'),
                    repositories: Joi.array().items(missionRepositoryInfoSchema.optional()).optional().description('New array of mod repositories to define for the community. ' +
                        'Set to an empty array to remove all entries')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema
                }).label('UpdateCommunityResponse').description('Response containing details of the updated community')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'DELETE',
        path: '/v1/communities/{communitySlug}',
        handler: controller.deleteCommunity,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing community',
            notes: 'Deletes an existing community, including all associated applications. Removes all assocations with users and missions and deletes all community-related ' +
            'permissions. This endpoint can only be used by community founders. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'communities', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to delete').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)'),
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated permissions')
                }).label('DeleteCommunityResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder']
                },
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'The user from the provided JWT was not found in the database',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Token user not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'GET',
        path: '/v1/communities/{communitySlug}/applications',
        handler: controller.getCommunityApplicationList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Retrieves a list of applications to the community',
            notes: 'Returns a paginated list of users that have applied to the community. This endpoint can only be used by community leaders or members with the ' +
            '`community.SLUG.recruitment` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'application', 'list', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve applications for')
                        .example('spezialeinheit-luchs')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityApplicationList.max).default(LIMITS.communityApplicationList.default).optional()
                        .description('Limit for number of applications to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of applications to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    status: Joi.string().equal(COMMUNITY_APPLICATION_STATUSES).optional().description('Allows for filtering of applications with the selected status. Takes ' +
                        'preference over `includeProcessed` flag').example(COMMUNITY_APPLICATION_STATUS_SUBMITTED),
                    includeProcessed: Joi.boolean().default(false).optional().description('Include processed applications (accepted/denied) in retrieved list, defaults to ' +
                        'false. Is overwritten by `status` parameter').optional()
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityApplicationList.max).required()
                        .description('Limit for number of applications to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of applications to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityApplicationList.max).required()
                        .description('Actual number of applications returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of community applications stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more applications are available and can be retrieved using pagination'),
                    applications: Joi.array().items(communityApplicationSchema.optional()).required().description('List of applications retrieved')
                }).label('GetCommunityApplicationListResponse').description('Response containing the community\'s list of applications')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader', 'community.{{communitySlug}}.recruitment']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
        path: '/v1/communities/{communitySlug}/applications',
        handler: controller.createCommunityApplication,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Applies to join the specified community',
            notes: 'Applies to join the specified community, has to be approved by community leader or members with the `community.SLUG.recruitment` permission. ' +
            'Regular user authentication is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'communities', 'application', 'create', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to apply to').example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    status: Joi.string().equal(COMMUNITY_APPLICATION_STATUSES).required()
                        .description('Indicates the application\'s status. Applications are created with status `submitted` and can either be `accepted` or `denied`')
                        .example(COMMUNITY_APPLICATION_STATUS_SUBMITTED)
                }).label('CreateCommunityApplicationResponse').description('Response containing the community application status')
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
                        409: {
                            description: 'The user is already a member of this community or an application for this community already exists',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Already member of community', 'Community application already exists').required()
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
    },
    {
        method: 'GET',
        path: '/v1/communities/{communitySlug}/applications/status',
        handler: controller.getCommunityApplicationStatus,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Retrieve the status of a user\'s community application',
            notes: 'Retrieves the status of a user\'s community application, also returning the community application UID used for deleting the application. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'application', 'status', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to get the application status for')
                        .example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    application: communityApplicationSchema.description('Community application status')
                }).label('GetCommunityApplicationStatusResponse').description('Response containing the application status')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No community with given slug or no application with the given user UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'Community application not found').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/applications/{applicationUid}',
        handler: controller.updateCommunityApplication,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing application to the community',
            notes: 'Updates an existing application to the community, accepting or denying it. This endpoint can only be used by community leaders or members with the ' +
            '`community.SLUG.recruitment` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'communities', 'application', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to update the application for')
                        .example('spezialeinheit-luchs'),
                    applicationUid: Joi.string().guid().length(36).required().description('UID of the community application to update')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    status: Joi.string().equal(COMMUNITY_APPLICATION_STATUS_ACCEPTED, COMMUNITY_APPLICATION_STATUS_DENIED).required()
                        .description('Indicates whether the application should be accepted or denied').example(COMMUNITY_APPLICATION_STATUS_ACCEPTED)
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    application: communityApplicationSchema.description('Updated community application instance')
                }).label('UpdateCommunityApplicationResponse').description('Response containing the updated application')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader', 'community.{{communitySlug}}.recruitment']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug or no application with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'Community application not found').required().description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The community application has already been accepted or denied',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community application already processed').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/applications/{applicationUid}',
        handler: controller.deleteCommunityApplication,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing application to the community',
            notes: 'Allows a user to delete their community application, also removing the user from the community if they were a member and deleting all their ' +
            'community permissions. Applications can only be deleted by the user that created them. Regular user authentication required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'communities', 'application', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to delete the application for')
                        .example('spezialeinheit-luchs'),
                    applicationUid: Joi.string().guid().length(36).required().description('UID of the community application to delete')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteCommunityApplicationResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user tried to delete a community application created by a different user',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug or no application with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'Community application not found').required().description('Message further describing the error')
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
        method: 'PUT',
        path: '/v1/communities/{communitySlug}/logo',
        handler: controller.setCommunityLogo,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Sets the community\'s logo to the uploaded file',
            notes: 'Sets the community\'s logo to the uploaded file - stored in GCP, max. image size is 2 Mebibyte. This endpoint can only be used by community founders ' +
            'and users with the `community.SLUG.leader` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'put', 'v1', 'communities', 'logo', 'authenticated', 'restricted'],
            payload: {
                maxBytes: 2097152 // Payload size limit increased to 2 Mebibyte
            },
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to set logo for')
                        .example('spezialeinheit-luchs')
                }),
                payload: Joi.object().required().keys({
                    imageType: Joi.string().equal('image/jpeg', 'image/png', 'image/gif').required().description('Type of image uploaded. Only jpeg, png and gif files allowed')
                        .example('image/png'),
                    image: Joi.string().uri().min(1).required().description('Image data encoded as a data URL. Maximum allowed upload size is 2 Mebibyte')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    community: schemas.communityDetailsSchema
                }).label('SetCommunityLogoResponse').description('Response containing details of the updated community')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader']
                },
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'Required community logo data is missing',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Missing community logo data').required().description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
        method: 'DELETE',
        path: '/v1/communities/{communitySlug}/logo',
        handler: controller.deleteCommunityLogo,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing community logo',
            notes: 'Deletes an existing community logo, also removing it from GCP storage. This endpoint can only be used by community founders and users with the ' +
            '`community.SLUG.leader` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'communities', 'logo', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to delete the logo for')
                        .example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteCommunityLogoResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug was found or the community did not have a logo set',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'No community logo set').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/members',
        handler: controller.getCommunityMemberList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of members of a specific community',
            notes: 'Returns a paginated list of members of a specific community, including leadership. Allows for member lists to be ' +
            'refresh without having to fetch all other community details. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'member', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve').example('spezialeinheit-luchs')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityMissionList.max).default(LIMITS.communityMissionList.default).optional()
                        .description('Limit for number of members to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of members to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityMissionList.max).required()
                        .description('Limit for number of members to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of members to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityMissionList.max).required()
                        .description('Actual number of members returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more members are available and can be retrieved using pagination'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of missions stored for this community'),
                    members: Joi.array().items(userSchema.optional()).required().description('List of members retrieved')
                }).label('GetCommunityMemberListResponse').description('Response containing list of members assigned to the community')
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
        method: 'DELETE',
        path: '/v1/communities/{communitySlug}/members/{memberUid}',
        handler: controller.removeCommunityMember,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Removes a member from the community',
            notes: 'Removes a member from the community, also deleting their community application as well as all community permissions. This endpoint can only be used by ' +
            'community leaders - community founders can not be removed by anyone beside admins. Regular user authentication with appropriate permissions is required to access ' +
            'this endpoint',
            tags: ['api', 'delete', 'v1', 'communities', 'member', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to remove member from')
                        .example('spezialeinheit-luchs'),
                    memberUid: Joi.string().guid().length(36).required().description('UID of the member to remove from the community')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('RemoveCommunityMemberResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder', 'community.{{communitySlug}}.leader']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint or tried to remove a community founder',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug or member with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'Community member not found').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/missions',
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
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve').example('spezialeinheit-luchs')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityMissionList.max).default(LIMITS.communityMissionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().default(false).optional().description('Include ended missions in retrieved list, defaults to false')
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
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of community missions stored'),
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
    },
    {
        method: 'GET',
        path: '/v1/communities/{communitySlug}/permissions',
        handler: controller.getCommunityPermissionList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of all permissions granted for the given community',
            notes: 'Returns a list of permissions granted for the given community. This endpoint can only be used by community founders. Regular user authentication with ' +
            'appropriate  permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'permission', 'list', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve permissions for')
                        .example('spezialeinheit-luchs')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityPermissionList.max).default(LIMITS.communityPermissionList.default).optional()
                        .description('Limit for number of permissions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of permissions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityPermissionList.max).required()
                        .description('Limit for number of permissions to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of permissions to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityPermissionList.max).required()
                        .description('Actual number of permissions returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of permissions stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more permissions are available and can be retrieved using pagination'),
                    permissions: Joi.array().items(permissionSchema.optional()).required().description('List of permissions retrieved')
                }).label('GetCommunityPermissionListResponse').description('Response containing list of permissions granted for the given community')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder']
                },
                'hapi-swagger': {
                    responses: {
                        401: {
                            description: 'The user from the provided JWT was not found in the database',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(401).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Unauthorized').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Token user not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
        path: '/v1/communities/{communitySlug}/permissions',
        handler: controller.createCommunityPermission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new community permission for the given community',
            notes: 'Creates a new community permission for the given community. This endpoint can only be used by community founders. Regular user authentication with ' +
            'appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'communities', 'permission', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to create permission for')
                        .example('spezialeinheit-luchs')
                }),
                payload: Joi.object().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user to grant permission to').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    permission: Joi.string().min(1).max(255).required().description('Permission to grant').example('community.spezialeinheit-luchs.leader')
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    permission: permissionSchema
                }).label('CreateCommunityPermissionResponse').description('Response containing details of newly created community permission')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder']
                },
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'An invalid community permission - not matching community slug or allowed permissions - was provided',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Invalid community permission').required().description('Message further describing the error')
                            })
                        },
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug or no target user with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'User not found').required().description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The given community permission has already been granted to the selected user',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community permission already exists').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/permissions/{permissionUid}',
        handler: controller.deleteCommunityPermission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing community permission',
            notes: 'Deletes an existing community permission. This endpoint can only be used by community founders. Regular user authentication with appropriate permissions is ' +
            'required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'communities', 'permission', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to delete permission for')
                        .example('spezialeinheit-luchs'),
                    permissionUid: Joi.string().guid().length(36).required().description('UID of the community permission to delete')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteCommunityPermissionResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['community.{{communitySlug}}.founder']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No community with given slug or no community permission with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Community not found', 'Community permission not found').required().description('Message further describing the error')
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
        path: '/v1/communities/{communitySlug}/repositories',
        handler: controller.getCommunityRepositories,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of mod repositories defined for a specific community',
            notes: 'Returns a list of mod repositories defined for a specific community, allowing for mission creators to quickly fill out the mission\'s mod repo ' +
            'repo information. This endpoint is only accessible to community members. Regular user authentication with appropriate permissions is required to access this ' +
            'endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'repositories', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve repositories for')
                        .example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    repositories: Joi.array().required().items(missionRepositoryInfoSchema.optional()).description('List of mod repositories defined for the community')
                }).label('GetCommunityRepositoriesResponse').description('Response containing lists of repositories defined for the community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
        path: '/v1/communities/{communitySlug}/servers',
        handler: controller.getCommunityServers,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of game and voice comms servers defined for a specific community',
            notes: 'Returns a list of game and voice comms servers defined for a specific community, allowing for mission creators to quickly fill out the mission\'s ' +
            'gameserver and voice comms information. This endpoint is only accessible to community members. Regular user authentication with appropriate permissions is ' +
            'required to access this endpoint',
            tags: ['api', 'get', 'v1', 'communities', 'servers', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    communitySlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of community to retrieve servers for')
                        .example('spezialeinheit-luchs')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    gameServers: Joi.array().required().items(missionServerInfoSchema.optional()).description('List of game servers defined for the community'),
                    voiceComms: Joi.array().required().items(missionServerInfoSchema.optional()).description('List of voice comms servers defined for the community')
                }).label('GetCommunityServersResponse').description('Response containing lists of servers defined for the community')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
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
