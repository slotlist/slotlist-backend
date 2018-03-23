import * as Joi from 'joi';

import { MISSION_REQUIRED_DLCS, MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN, MISSION_VISIBILITY_PUBLIC } from '../../../shared/models/Mission';
import { forbiddenSchema, internalServerErrorSchema } from '../../../shared/schemas/misc';
import * as schemas from '../../../shared/schemas/mission';
import { missionAccessSchema } from '../../../shared/schemas/missionAccess';
import { missionRepositoryInfoSchema } from '../../../shared/schemas/missionRepositoryInfo';
import { missionServerInfoSchema } from '../../../shared/schemas/missionServerInfo';
import { missionSlotSchema } from '../../../shared/schemas/missionSlot';
import { missionSlotGroupSchema } from '../../../shared/schemas/missionSlotGroup';
import { missionSlotRegistrationSchema } from '../../../shared/schemas/missionSlotRegistration';
import { permissionSchema } from '../../../shared/schemas/permission';
import * as controller from '../../controllers/v1/mission';

/**
 * All routes regarding missions
 */

export const LIMITS = {
    missionList: {
        default: 25,
        max: 100
    },
    missionAccessList: {
        default: 25,
        max: 100
    },
    missionPermissionList: {
        default: 25,
        max: 100
    },
    missionSlotList: {
        default: 25,
        max: 100
    },
    missionSlotRegistrationList: {
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
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all currently created missions',
            notes: 'Returns a paginated list of all currently created mission. Up to 100 mission can be requested at once, pagination has to be used to retrieve the ' +
            'rest. By default, only missions that have not ended yet are being displayed. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionList.max).default(LIMITS.missionList.default).optional()
                        .description('Limit for number of missions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)'),
                    includeEnded: Joi.boolean().default(false).optional().description('Include ended missions in retrieved list, defaults to false'),
                    startDate: Joi.date().allow(null).default(null).optional().description('Date and time (in UTC) to start retrieving missions from. Used for mission ' +
                        'calendar, to be used in conjunction with `endDate`. Endpoint ignores all other query parameters provided if a `startDate` has been provided'),
                    endDate: Joi.date().allow(null).default(null).optional().description('Date and time (in UTC) to end retrieving missions, inclusive. Used for mission ' +
                        'calendar, to be used in conjunction with `startDate`. Must be provided if `startDate` has been set'),
                    search: Joi.string().min(1).allow(null).default(null).optional().description('Value used for searching missions, retrieving only those that ' +
                        'have a title containing the provided value').example('altis'),
                    communityUid: Joi.string().min(1).allow(null).default(null).optional().description('Optional filter for mission search, restricting matches to only missions ' +
                        'associated with the community with the given UID. Only effective if a `search` value has been provided, mutually exclusive with the `creatorUid` ' +
                        'parameter').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    creatorUid: Joi.string().min(1).allow(null).default(null).optional().description('Optional filter for mission search, restricting matches to only missions ' +
                        'created by the user with the given UID. Only effective if a `search` value has been provided, mutually exclusive with the `communityUid` parameter')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionList.max).optional()
                        .description('Limit for number of missions to retrieve, as provided via query. Omitted if query including `startDate` was executed'),
                    offset: Joi.number().integer().positive().allow(0).min(0).optional()
                        .description('Number of missions to skip before retrieving new ones from database, as provided via query. Omitted if query including `startDate` was ' +
                        'executed'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionList.max).optional()
                        .description('Actual number of missions returned. Omitted if query including `startDate` was executed'),
                    total: Joi.number().integer().positive().allow(0).min(0).optional().description('Total number of missions stored. Omitted if query including `startDate` ' +
                        'was executed'),
                    moreAvailable: Joi.bool().optional().description('Indicates whether more missions are available and can be retrieved using pagination. Omitted if query ' +
                        'including `startDate` was executed'),
                    startDate: Joi.date().optional().description('Date and time (in UTC) missions where retrieved from, as provided via query. Omitted if no `startDate` was ' +
                        'set in the request'),
                    endDate: Joi.date().optional().description('Date and time (in UTC) missions retrievel ended at, as provided via query. Omitted if no `startDate` was set' +
                        ' in the request'),
                    missions: Joi.array().items(schemas.missionSchema.optional()).required().description('List of missions retrieved')
                }).label('GetMissionListResponse').description('Response containing list of currently created missions')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'A `startDate` value was set, but no `endDate` was provided',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission filter end date must be provided if start date is set').required()
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
        path: '/v1/missions/slugAvailable',
        handler: controller.isSlugAvailable,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Checks whether the given slug is available',
            notes: 'Checks whether the given slug is available and can be used for a new mission. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'slugAvailable'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug to check availability for').example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    available: Joi.boolean().required().description('Indicates whether the slug is available for usage')
                }).label('IsMissionSlugAvailableResponse').description('Response containing indicator if slug is available')
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
        path: '/v1/missions',
        handler: controller.createMission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new mission',
            notes: 'Creates a new mission and assigns the current user as its creator. The user can optionally also associate the mission with their community. ' +
            'Regular user authentication is required to access this endpoint',
            payload: {
                maxBytes: 15728640 // Payload size limit increased to 15 Mebibyte
            },
            tags: ['api', 'post', 'v1', 'missions', 'create', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).required().description('Title of the mission').example('All of Altis'),
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required()
                        .description('Slug used for uniquely identifying a mission in the frontend, easier to read than a UUID').example('all-of-altis'),
                    description: Joi.string().min(1).required().description('Short description and summary of mission').example('Conquer all of Altis!'),
                    detailedDescription: Joi.string().min(1).required().description('Full, detailed description of the mission. Can contain HTML for formatting')
                        .example('<h1>All of Altis</h1><h2>Tasks</h2><ol><li>Have fun!</li></ol>'),
                    collapsedDescription: Joi.string().allow(null).min(1).default(null).optional().description('Collapsed description of the mission, can be `null` if ' +
                        'not applicable. Can contain HTML for formatting').example('<h1>Lots of additional info</h1><div>Thank god this is collapsed!</div>'),
                    briefingTime: Joi.date().required().description('Date and time the mission briefing starts, in UTC. The briefing usually only includes players ' +
                        'with leadership roles').example('2017-09-02T16:00:00.000Z'),
                    slottingTime: Joi.date().required().description('Date and time the mission slotting starts, in UTC. Players are encouraged to join the server ' +
                        'and choose their reserved slot at this time').example('2017-09-02T16:00:00.000Z'),
                    startTime: Joi.date().required().description('Date and time the missions starts (slotting/briefing times are stored separately and available ' +
                        'via mission details)').example('2017-09-02T17:00:00.000Z'),
                    endTime: Joi.date().required().description('Estimated date and time the missions ends, in UTC. Must be equal to or after `startTime`, just an ' +
                        'estimation by the mission creator. The actual end time might vary').example('2017-09-02T22:00:00.000Z'),
                    techSupport: Joi.string().allow(null).min(1).default(null).optional()
                        .description('Information regarding any technical support provided before the mission, can be `null` if not provided. Can contain HTML for formatting')
                        .example('<div><strong>TechCheck</strong> available 3 days before mission, <strong>TechSupport</strong> available 2 hours before mission start </div>'),
                    rules: Joi.string().allow(null).min(1).default(null).optional()
                        .description('Additional ruleset for this mission, can be `null` if not applicable. Can contain HTML for formatting')
                        .example('<ol><li>Be punctual, no join in progress!</li></ol>'),
                    gameServer: missionServerInfoSchema.allow(null).default(null).optional(),
                    voiceComms: missionServerInfoSchema.allow(null).default(null).optional(),
                    repositories: Joi.array().items(missionRepositoryInfoSchema.optional()).default([]).optional(),
                    visibility: Joi.string().equal(MISSION_VISIBILITIES).default(MISSION_VISIBILITY_HIDDEN).optional()
                        .description('Sets the visibility setting of a mission. Missions with `public` visibility are visible to everyone, `hidden` missions are only ' +
                        'visible to the mission creator and assigned mission editors. The `community` visibility makes the mission visible to all members of the mission ' +
                        'creator\'s community. The `private` visibility setting restricts access to selected users, although this functionality is currently not implemented yet ' +
                        '(as of 2017-08-23)')
                        .example(MISSION_VISIBILITY_PUBLIC),
                    slotsAutoAssignable: Joi.bool().required().description('Indicates whether slots in the mission are auto-assignable. Auto-assignable slots do not require ' +
                        'confirmation by a mission editor, but are automatically assigned to the first registering user (who would have thought, what a good name choice!)')
                        .example(false),
                    requiredDLCs: Joi.array().items(Joi.string().equal(MISSION_REQUIRED_DLCS).optional()).required().description('List of DLCs required to participate in the ' +
                        'mission. Currently not used in any restrictions, but merely added as an indication to players').example(['apex', 'marksmen']),
                    addToCommunity: Joi.boolean().default(true).optional()
                        .description('Indicates whether the mission should also be associated with the user\'s community (if set), defaults to true')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    mission: schemas.missionDetailsSchema,
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated permissions')
                }).label('CreateMissionResponse').description('Response containing details of newly created mission')
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
                            description: 'A mission with the given slug already exists or the user already has mission creator permissions',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slug already exists', 'Mission creator permission already exists').required()
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
        path: '/v1/missions/{missionSlug}',
        handler: controller.getMissionDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns details about a specific mission',
            notes: 'Returns more detailed information about a specific mission, including more detailed mission times as well as a longer description and additional ' +
            'information required for participating. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'details'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve').example('all-of-altis')
                }),
                query: Joi.object().required().keys({
                    missionToken: Joi.string().min(1).allow(null).default(null).optional().description('Optional (mission) API token used for static authentication, only valid ' +
                        'for this mission. If provided, grants regular user access to the mission, even if its visibility is not public and no regular authentication was provided')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
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
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'PATCH',
        path: '/v1/missions/{missionSlug}',
        handler: controller.updateMission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing mission',
            notes: 'Updates the mutable attributes of a mission. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'missions', 'update', 'authenticated', 'restricted'],
            payload: {
                maxBytes: 15728640 // Payload size limit increased to 15 Mebibyte
            },
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to update').example('all-of-altis')
                }),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).optional().description('New title of the mission').example('All of Altis'),
                    description: Joi.string().min(1).optional().description('New short description and summary of mission').example('Conquer all of Altis!'),
                    detailedDescription: Joi.string().min(1).optional().description('New full, detailed description of the mission. Can contain HTML for formatting')
                        .example('<h1>All of Altis</h1><h2>Tasks</h2><ol><li>Have fun!</li></ol>'),
                    collapsedDescription: Joi.string().allow(null).min(1).optional().description('New collapsed description of the mission, can be `null` if not applicable. ' +
                        'Can contain HTML for formatting').example('<h1>Lots of additional info</h1><div>Thank god this is collapsed!</div>'),
                    briefingTime: Joi.date().optional().description('New date and time the mission briefing starts, in UTC. The briefing usually only includes players ' +
                        'with leadership roles').example('2017-09-02T16:00:00.000Z'),
                    slottingTime: Joi.date().optional().description('New date and time the mission slotting starts, in UTC. Players are encouraged to join the server ' +
                        'and choose their reserved slot at this time').example('2017-09-02T16:00:00.000Z'),
                    startTime: Joi.date().optional().description('New date and time the missions starts (slotting/briefing times are stored separately and available ' +
                        'via mission details)').example('2017-09-02T17:00:00.000Z'),
                    endTime: Joi.date().optional().description('New estimated date and time the missions ends, in UTC. Must be equal to or after `startTime`, just an ' +
                        'estimation by the mission creator. The actual end time might vary').example('2017-09-02T22:00:00.000Z'),
                    techSupport: Joi.string().allow(null).min(1).optional()
                        .description('New information regarding any technical support provided before the mission, can be `null` if not provided. Can contain HTML for formatting')
                        .example('<div><strong>TechCheck</strong> available 3 days before mission, <strong>TechSupport</strong> available 2 hours before mission start </div>'),
                    rules: Joi.string().allow(null).min(1).optional()
                        .description('New additional ruleset for this mission, can be `null` if not applicable. Can contain HTML for formatting')
                        .example('<ol><li>Be punctual, no join in progress!</li></ol>'),
                    gameServer: missionServerInfoSchema.allow(null).optional(),
                    voiceComms: missionServerInfoSchema.allow(null).optional(),
                    repositories: Joi.array().items(missionRepositoryInfoSchema.optional()).optional(),
                    visibility: Joi.string().equal(MISSION_VISIBILITIES).optional()
                        .description('New visibility setting for the mission. Missions with `public` visibility are visible to everyone, `hidden` missions are only ' +
                        'visible to the mission creator and assigned mission editors. The `community` visibility makes the mission visible to all members of the mission ' +
                        'creator\'s community. The `private` visibility setting restricts access to selected users, although this functionality is currently not implemented yet ' +
                        '(as of 2017-08-23)')
                        .example(MISSION_VISIBILITY_PUBLIC),
                    slotsAutoAssignable: Joi.bool().optional().description('New setting whether slots in the mission are auto-assignable. Auto-assignable slots do not require ' +
                        'confirmation by a mission editor, but are automatically assigned to the first registering user (who would have thought, what a good name choice!)')
                        .example(false),
                    requiredDLCs: Joi.array().items(Joi.string().equal(MISSION_REQUIRED_DLCS).optional()).optional().description('New list of DLCs required to participate in ' +
                        'the mission. Currently not used in any restrictions, but merely added as an indication to players').example(['apex', 'marksmen']),
                    suppressNotifications: Joi.boolean().default(false).optional().description('Allows for notifications caused by the endpoint changes to be suppressed. ' +
                        '"Destructive" actions such as slot unassignments, permission removals or mission deletions cannot be suppressed')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    mission: schemas.missionDetailsSchema
                }).label('UpdateMissionResponse').description('Response containing details of the updated mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
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
        path: '/v1/missions/{missionSlug}',
        handler: controller.deleteMission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission',
            notes: 'Deletes an existing mission, including all associated missions slots and mission slot registrations. This endpoint can only be used by mission creators. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete').example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)'),
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated permissions')
                }).label('DeleteMissionResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
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
        path: '/v1/missions/{missionSlug}/accesses',
        handler: controller.getMissionAccessList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of all accesses granted for the given mission',
            notes: 'Returns a list of all accesses granted for the given mission. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` ' +
            'permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'access', 'list', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve accesses for')
                        .example('all-of-altis')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionAccessList.max).default(LIMITS.missionAccessList.default).optional()
                        .description('Limit for number of accesses to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of access to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionAccessList.max).required()
                        .description('Limit for number of accesses to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of accesses to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionAccessList.max).required()
                        .description('Actual number of accesses returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of accesses stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more accesses are available and can be retrieved using pagination'),
                    accesses: Joi.array().items(missionAccessSchema.optional()).required().description('List of accesses retrieved')
                }).label('GetMissionAccessListResponse').description('Response containing list of accesses granted for the given mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
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
        method: 'POST',
        path: '/v1/missions/{missionSlug}/accesses',
        handler: controller.createMissionAccess,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new mission access for the given mission',
            notes: 'Creates a new mission access for the given mission. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'access', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create access for').example('all-of-altis')
                }),
                payload: Joi.object().keys({
                    communityUid: Joi.string().guid().length(36).optional().description('UID of the community to grant access to. Either `communityUid` or `userUid` can be ' +
                        'provided, never both at once').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    userUid: Joi.string().guid().length(36).optional().description('UID of the user to grant access to. Either `communityUid` or `userUid` can be provided, ' +
                        'never both at once').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }).xor('communityUid', 'userUid').required()
            },
            response: {
                schema: Joi.object().required().keys({
                    access: missionAccessSchema
                }).label('CreateMissionAccessResponse').description('Response containing details of newly created mission access')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no community/user with the provided UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Community not found', 'User not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The given user or community has already been granted access to this mission',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission access already exists').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/accesses/{missionAccessUid}',
        handler: controller.deleteMissionAccess,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission access',
            notes: 'Deletes an existing mission access. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. Regular user ' +
            'authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'access', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete access for').example('all-of-altis'),
                    missionAccessUid: Joi.string().guid().length(36).required().description('UID of the mission access to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionAccessResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no mission access with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission access not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/bannerImage',
        handler: controller.setMissionBannerImage,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Sets the mission\'s banner image to the uploaded file',
            notes: 'Sets the mission\'s banner image to the uploaded file - stored in GCP, max. image size is 2 Mebibyte. This endpoint can only be used by mission creators ' +
            'and users with the `mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'put', 'v1', 'missions', 'bannerImage', 'authenticated', 'restricted'],
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
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to set banner image for').example('all-of-altis')
                }),
                payload: Joi.object().required().keys({
                    imageType: Joi.string().equal('image/jpeg', 'image/png', 'image/gif').required().description('Type of image uploaded. Only jpeg, png and gif files allowed')
                        .example('image/png'),
                    image: Joi.string().uri().min(1).required().description('Image data encoded as a data URL. Maximum allowed upload size is 2 Mebibyte')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    mission: schemas.missionDetailsSchema
                }).label('SetMissionBannerImageResponse').description('Response containing details of the updated mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'Required mission banner image data is missing',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Missing mission banner image data').required().description('Message further describing the error')
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
        method: 'DELETE',
        path: '/v1/missions/{missionSlug}/bannerImage',
        handler: controller.deleteMissionBannerImage,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission banner image',
            notes: 'Deletes an existing mission banner image, also removing it from GCP storage. This endpoint can only be used by mission creators and users with the ' +
            '`mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'bannerImage', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete the mission image for')
                        .example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionBannerImageResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug was found or the mission did not have a mission banner image set',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'No mission banner image set').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/duplicate',
        handler: controller.duplicateMission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Duplicates an exiting mission',
            notes: 'Duplicates an existing mission using the provided new mission slug. All mission times can also be specified and thus overwritten, defaulting to the current ' +
            'mission\'s times if omitted. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. Regular user authentication ' +
            'with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'duplicate', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create permission for').example('all-of-altis')
                }),
                payload: Joi.object().keys({
                    slug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug to set for duplication mission, required')
                        .example('all-of-altis'),
                    visibility: Joi.string().equal(MISSION_VISIBILITIES).default(MISSION_VISIBILITY_HIDDEN).optional()
                        .description('Sets the visibility setting for the duplicated mission. Missions with `public` visibility are visible to everyone, `hidden` missions are ' +
                        'only visible to the mission creator and assigned mission editors. The `community` visibility makes the mission visible to all members of the mission ' +
                        'creator\'s community. The `private` visibility setting restricts access to selected users, although this functionality is currently not implemented yet ' +
                        '(as of 2017-08-23)')
                        .example(MISSION_VISIBILITY_PUBLIC),
                    title: Joi.string().min(1).max(255).allow(null).default(null).optional().description('Title for duplicated mission. If omitted, copies the current ' +
                        'mission\'s title').example('All of Altis'),
                    addToCommunity: Joi.boolean().allow(null).default(null).optional()
                        .description('Indicates whether the duplicated mission should also be associated with the user\'s community (if set). If omitted, copies the current ' +
                        'mission\'s community setting'),
                    briefingTime: Joi.date().allow(null).default(null).optional().description('Optional date and time the duplicated mission briefing starts, in UTC. If ' +
                        'omitted, the current mission times will be used').example('2017-09-02T16:00:00.000Z'),
                    slottingTime: Joi.date().allow(null).default(null).optional().description('Optional date and time the mission slotting starts, in UTC. If omitted, ' +
                        'the current mission times will be used').example('2017-09-02T16:00:00.000Z'),
                    startTime: Joi.date().allow(null).default(null).optional().description('Optional date and time the missions starts, in UTC. If omitted, the current ' +
                        'mission times will be used').example('2017-09-02T16:00:00.000Z'),
                    endTime: Joi.date().allow(null).default(null).optional().description('Optional estimated date and time the missions ends, in UTC. If omitted, the current ' +
                        'mission times will be used').example('2017-09-02T16:00:00.000Z')
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    mission: schemas.missionDetailsSchema,
                    token: Joi.string().min(1).required().description('Refreshed JWT including updated permissions')
                }).label('DuplicateMissionResponse').description('Response containing details of duplicated mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
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
                        409: {
                            description: 'A mission with the given slug already exists or the user already has mission creator permissions',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slug already exists', 'Mission creator permission already exists').required()
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
        path: '/v1/missions/{missionSlug}/permissions',
        handler: controller.getMissionPermissionList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of all permissions granted for the given mission',
            notes: 'Returns a list of permissions granted for the given mission. This endpoint can only be used by mission creators. Regular user authentication with ' +
            'appropriate permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'permission', 'list', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve permissions for')
                        .example('all-of-altis')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionPermissionList.max).default(LIMITS.missionPermissionList.default).optional()
                        .description('Limit for number of permissions to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of permissions to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionPermissionList.max).required()
                        .description('Limit for number of permissions to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of permissions to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionPermissionList.max).required()
                        .description('Actual number of permissions returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of permissions stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more permissions are available and can be retrieved using pagination'),
                    permissions: Joi.array().items(permissionSchema.optional()).required().description('List of permissions retrieved')
                }).label('GetMissionPermissionListResponse').description('Response containing list of permissions granted for the given mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
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
        method: 'POST',
        path: '/v1/missions/{missionSlug}/permissions',
        handler: controller.createMissionPermission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new mission permission for the given mission',
            notes: 'Creates a new mission permission for the given mission. This endpoint can only be used by mission creators. Regular user authentication with ' +
            'appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'permission', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create permission for').example('all-of-altis')
                }),
                payload: Joi.object().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user to grant permission to').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    permission: Joi.string().min(1).max(255).required().description('Permission to grant').example('mission.all-of-altis.editor'),
                    suppressNotifications: Joi.boolean().default(false).optional().description('Allows for notifications caused by the endpoint changes to be suppressed. ' +
                        '"Destructive" actions such as slot unassignments, permission removals or mission deletions cannot be suppressed')
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    permission: permissionSchema
                }).label('CreateMissionPermissionResponse').description('Response containing details of newly created mission permission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
                },
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'An invalid mission permission - not matching mission slug or allowed permissions - was provided',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Invalid mission permission').required().description('Message further describing the error')
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
                        409: {
                            description: 'The given mission permission has already been granted to the selected user',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission permission already exists').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/permissions/{permissionUid}',
        handler: controller.deleteMissionPermission,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission permission',
            notes: 'Deletes an existing mission permission. This endpoint can only be used by mission creators. Regular user authentication with appropriate permissions is ' +
            'required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'permission', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete permission for').example('all-of-altis'),
                    permissionUid: Joi.string().guid().length(36).required().description('UID of the mission permission to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionPermissionResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no mission permission with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission permission not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slotGroups',
        handler: controller.createMissionSlotGroup,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new mission slot group for the given mission',
            notes: 'Creates a new mission slot group for the given mission. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` ' +
            'permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'slot', 'group', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create slots for').example('all-of-altis')
                }),
                payload: Joi.object().keys({
                    title: Joi.string().min(1).max(255).required().description('Title of the slot group').example('Platoon Luchs'),
                    description: Joi.string().allow(null).min(1).default(null).required().description('Optional description of the mission slot group, explaining ' +
                        'the slot group\'s role or callsign').example('Leads the mission, callsign "Luchs"'),
                    insertAfter: Joi.number().integer().positive().allow(0).default(0).required().description('Order number of slot group the new group should be inserted ' +
                        'after. The order number created will be incremented by one and all higher order numbers adapted accordingly').example(9)
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    slotGroup: missionSlotGroupSchema
                }).label('CreateMissionSlotGroupResponse').description('Response containing details of newly created mission slot group')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
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
        method: 'PATCH',
        path: '/v1/missions/{missionSlug}/slotGroups/{slotGroupUid}',
        handler: controller.updateMissionSlotGroup,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updated an existing mission slot group',
            notes: 'Updates an existing mission slot group. This endpoint can only be used by mission creators and users with the ' +
            '`mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'missions', 'slot', 'group', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to update slot group for').example('all-of-altis'),
                    slotGroupUid: Joi.string().guid().length(36).required().description('UID of the mission slot group to update').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().keys({
                    title: Joi.string().min(1).max(255).optional().description('New title of the slot group').example('Platoon Luchs'),
                    description: Joi.string().allow(null).min(1).optional().description('New optional description of the mission slot group, explaining ' +
                        'the slot group\'s role or callsign').example('Leads the mission, callsign "Luchs"'),
                    moveAfter: Joi.number().integer().positive().allow(0).optional().description('Order number of the slot group the group should be moved after. Allows for ' +
                        'reordering of groups - all other order numbers will be adapted accordingly').example(9)
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    slotGroup: missionSlotGroupSchema
                }).label('UpdatedMissionSlotGroupResponse').description('Response containing details of updated mission slot group')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no mission slot group with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot group not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slotGroups/{slotGroupUid}',
        handler: controller.deleteMissionSlotGroup,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission slot group',
            notes: 'Deletes an existing mission slot group and all slots associated with it. This endpoint can only be used by mission creators and users with the ' +
            '`mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'slot', 'group', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete slot group for').example('all-of-altis'),
                    slotGroupUid: Joi.string().guid().length(36).required().description('UID of the mission slot group to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionSlotGroupResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no mission slot group with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot group not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slots',
        handler: controller.getMissionSlotList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all slots (in their respective slot groups) for the given mission',
            notes: 'Returns a list of slots (in their respective slot groups) for the given mission. Due to the separation into groups, no pagiation can be provided. No ' +
            'authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'slot', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve slots for').example('all-of-altis')
                }),
                query: Joi.object().required().keys({
                    missionToken: Joi.string().min(1).allow(null).default(null).optional().description('Optional (mission) API token used for static authentication, only valid ' +
                        'for this mission. If provided, grants regular user access to the mission, even if its visibility is not public and no regular authentication was provided')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slotGroups: Joi.array().items(missionSlotGroupSchema.optional()).required().description('List of mission slot groups retrieved')
                }).label('GetMissionSlotListResponse').description('Response containing the mission\'s slot list (in slot groups)')
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
                            schema: internalServerErrorSchema
                        }
                    }
                }
            }
        }
    },
    {
        method: 'POST',
        path: '/v1/missions/{missionSlug}/slots',
        handler: controller.createMissionSlot,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates one or multiple new slots for the given mission',
            notes: 'Creates one or multiple new slots for the given mission. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` ' +
            'permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'slot', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create slots for').example('all-of-altis')
                }),
                payload: Joi.array().min(1).items({
                    slotGroupUid: Joi.string().guid().length(36).required().description('UID of the slot group the slot should be added to')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    title: Joi.string().min(1).max(255).required().description('Title of the slot').example('Platoon Lead'),
                    difficulty: Joi.number().integer().positive().allow(0).min(0).max(4).required().description('Difficulity of the slot, ranging from 0 (easiest) ' +
                        'to 4 (hardest)').example(4),
                    description: Joi.string().allow(null).min(1).default(null).optional().description('Optional short description of the slot')
                        .example('Leads Platoon Luchs and coordinates logistics'),
                    detailedDescription: Joi.string().allow(null).min(1).default(null).optional().description('Detailed, optional description of the mission slot, further ' +
                        'explaining the responsibilities and the selected role').example('<div>Actually know what they are doing!</div>'),
                    restrictedCommunityUid: Joi.string().allow(null).guid().length(36).default(null).optional().description('UID of the community the slot is restricted to. ' +
                        'Setting this to `null` removes the restriction and opens the slot to everyone').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    reserve: Joi.bool().required().description('Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been ' +
                        'filled) or a regular one (false)').example(false),
                    blocked: Joi.bool().required().description('Indicates whether the slot is a blocked slot (true, no users can register) or a regular one (false). ' +
                        'Blocked slots can be used by mission creators to manually "assign" slots to community or users that choose not to use slotlist.info').example(false),
                    autoAssignable: Joi.bool().required().description('Indicates whether the slot is auto-assignable. Auto-assignable slots do not require confirmation by a ' +
                        'mission editor, but are automatically assigned to the first registering user (who would have thought, what a good name choice!)').example(false),
                    requiredDLCs: Joi.array().items(Joi.string().equal(MISSION_REQUIRED_DLCS).optional()).required().description('List of DLCs required to fulfil the duties ' +
                        'assigned to the slot. Currently not used in any restrictions, but merely added as an indication to players').example(['apex', 'marksmen']),
                    insertAfter: Joi.number().integer().positive().allow(0).default(0).required().description('Order number of slot the new slot should be inserted ' +
                        'after. The order number created will be incremented by one and all higher order numbers adapted accordingly').example(9),
                    duplicate: Joi.bool().optional().default(false).description('Indicates whether the slot is being created as a duplicate of an already existing one. ' +
                        'Duplicated slots are handled slightly differently, mainly regarding the `autoAssignable` setting')
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    slots: Joi.array().min(1).items(missionSlotSchema).required()
                }).label('CreateMissionSlotResponse').description('Response containing details of newly created mission slot')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
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
        method: 'PATCH',
        path: '/v1/missions/{missionSlug}/slots/{slotUid}',
        handler: controller.updateMissionSlot,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing mission slot',
            notes: 'Updates the mutable attributes of a mission slot. This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'missions', 'slot', 'update', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to update the slot for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to update').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).optional().description('New title of the slot').example('Platoon Lead'),
                    difficulty: Joi.number().integer().positive().allow(0).min(0).max(4).optional().description('New difficulity of the slot, ranging from 0 (easiest) ' +
                        'to 4 (hardest)').example(4),
                    description: Joi.string().allow(null).min(1).optional().description('New optional short description of the slot')
                        .example('Leads Platoon Luchs and coordinates logistics'),
                    detailedDescription: Joi.string().allow(null).min(1).optional().description('New detailed, optional description of the mission slot, further ' +
                        'explaining the responsibilities and the selected role').example('<div>Actually know what they are doing!</div>'),
                    restrictedCommunityUid: Joi.string().allow(null).guid().length(36).optional().description('New UID of the community the slot is restricted to. ' +
                        'Setting this to `null` removes the restriction and opens the slot to everyone').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    reserve: Joi.bool().optional().description('New indicator whether the slot is a reserve slot (true, will only be assigned if all other slots have been ' +
                        'filled) or a regular one (false)').example(false),
                    blocked: Joi.bool().optional().description('New indicator whether the slot is a blocked slot (true, no users can register) or a regular one (false). ' +
                        'Blocked slots can be used by mission creators to manually "assign" slots to community or users that choose not to use slotlist.info').example(false),
                    autoAssignable: Joi.bool().optional().description('New indicator whether the slot is auto-assignable. Auto-assignable slots do not require confirmation by a ' +
                        'mission editor, but are automatically assigned to the first registering user (who would have thought, what a good name choice!)').example(false),
                    requiredDLCs: Joi.array().items(Joi.string().equal(MISSION_REQUIRED_DLCS).optional()).optional().description('New list of DLCs required to fulfil the duties ' +
                        'assigned to the slot. Currently not used in any restrictions, but merely added as an indication to players').example(['apex', 'marksmen']),
                    externalAssignee: Joi.string().min(1).max(255).allow(null).optional().description('Nickname of external player assigned to the slot. Allows for slots ' +
                        'to be assigned to users not present in the database. Cannot be set if a user has been assigned and vice versa. Set to `null` to remove the external ' +
                        'assignee').example('MorpheusXAUT'),
                    moveAfter: Joi.number().integer().positive().allow(0).optional().description('Order number of the slot the slot should be moved after. Allows for ' +
                        'reordering of slots - all other order numbers will be adapted accordingly').example(9)
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slot: missionSlotSchema
                }).label('UpdateMissionSlotResponse').description('Response containing the updated mission slot')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug, slot with the given UID or no slot group with the slot\'s group UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found', 'Mission slot group not found').required()
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
        method: 'DELETE',
        path: '/v1/missions/{missionSlug}/slots/{slotUid}',
        handler: controller.deleteMissionSlot,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission slot',
            notes: 'Deletes an existing mission slot, including all associated mission slot registrations. This endpoint can only be used by mission creators and users with the ' +
            '`mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'slot', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete the slot for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionSlotResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no slot with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/assign',
        handler: controller.assignMissionSlot,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Assigns a user to an existing mission slot',
            notes: 'Assigns a user to an existing mission slot, creating a registration for them. This endpoint can only be used by mission creators and users with the ' +
            '`mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'slot', 'assign', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to assign user to slot')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to assign user to').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    userUid: Joi.string().guid().length(36).required().description('UID of the user to assign to the slot').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    force: Joi.bool().required().description('Forcing a slot assignment removes the currently assigned user - if any - as well as the select user\'s current ' +
                        'assignment'),
                    suppressNotifications: Joi.boolean().default(false).optional().description('Allows for notifications caused by the endpoint changes to be suppressed. ' +
                        '"Destructive" actions such as slot unassignments, permission removals or mission deletions cannot be suppressed')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slot: missionSlotSchema
                }).label('AssignMissionSlotResponse').description('Response containing the assigned mission slot')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint or the mission slot is marked as blocked',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(403).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Forbidden', 'Mission slot is blocked').required().description('Message further describing the error')
                            })
                        },
                        404: {
                            description: 'No mission with given slug, no slot with the given UID or no user with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found', 'User not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'If force assignment is not selected: the mission slot is already assigned to a user or the user is already assigned to a different slot',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot already assigned', 'User already assigned to another slot').required()
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
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/registrations',
        handler: controller.getMissionSlotRegistrationList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of registrations for the selected slot for the given mission',
            notes: 'Returns a paginated list of registrations for the selected slot for the given mission. This endpoint can be used by all users, however ' +
            'mission creators and users with the `mission.SLUG.editor` permission receive additional details. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'slot', 'registration', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve the slot registrations for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to retrieve registrations for')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionSlotRegistrationList.max).default(LIMITS.missionSlotRegistrationList.default).optional()
                        .description('Limit for number of registrations to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of registrations to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionSlotRegistrationList.max).required()
                        .description('Limit for number of registrations to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of registrations to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionSlotRegistrationList.max).required()
                        .description('Actual number of registrations returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more registrations are available and can be retrieved using pagination'),
                    registrations: Joi.array().items(missionSlotRegistrationSchema.optional()).required().description('List of mission slot registrations retrieved')
                }).label('GetMissionSlotRegistrationListResponse').description('Response containing the mission slot details')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No mission with given slug or no slot with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/registrations',
        handler: controller.createMissionSlotRegistration,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Registers for the selected slot for the specified mission',
            notes: 'Creates a new mission slot registration for the current user and the selected slot for the specified mission. An optional comment for the mission creator ' +
            'can be provided. Regular user authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'slot', 'registration', 'create', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to create the slot registration for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to create registration for')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    comment: Joi.string().allow(null).min(1).default(null).optional().description('Optional comment provided by the user during registration, can e.g. ' +
                        'be used to state preferences').example('Would prefer to lead platoon Luchs over Wolf')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    registration: missionSlotRegistrationSchema.required().description('Created mission slot registration')
                }).label('CreateMissionSlotRegistrationResponse').description('Response containing the newly created mission slot registration')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user tried to register for a blocked slot or a restricted slot without being a member of the restricted community',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(403).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot is blocked', 'Not a member of restricted community').required()
                                    .description('Message further describing the error')
                            })
                        },
                        404: {
                            description: 'No mission with given slug or no slot with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found').required().description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The slot already has an external assignee or a registration for this mission slot already exists for the user',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot can only either have assignee or external assignee', 'Mission slot registration already exists')
                                    .required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/registrations/{registrationUid}',
        handler: controller.updateMissionSlotRegistration,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing mission slot registration',
            notes: 'Updates the mutable attributes of a mission slot registration, allowing for registrations to be accepted or changed. Confirming a mission slot sets the ' +
            'assignee for the respective slot. Changing an already confirmed registration to unconfirmed removes the assignee again and allows for another assignment. ' +
            'This endpoint can only be used by mission creators and users with the `mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is ' +
            'required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'missions', 'slot', 'registration', 'update', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to update the slot registrations for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to update registrations for')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    registrationUid: Joi.string().guid().length(36).required().description('UID of the mission slot registration to update')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    confirmed: Joi.bool().required().description('Indicates whether the mission slot registration is confirmed by the mission creator').example(true),
                    suppressNotifications: Joi.boolean().default(false).optional().description('Allows for notifications caused by the endpoint changes to be suppressed. ' +
                        '"Destructive" actions such as slot unassignments, permission removals or mission deletions cannot be suppressed')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    registration: missionSlotRegistrationSchema.required().description('Updated mission slot registration')
                }).label('UpdateMissionSlotRegistrationResponse').description('Response containing the updated mission slot registration')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor', 'mission.{{missionSlug}}.slotlist.community']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no slot/registration with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found', 'Mission slot registration not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The mission slot is already assigned to a user or the user is already assigned to a different slot',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal(
                                    'Mission slot can only either have assignee or external assignee',
                                    'Mission slot already assigned',
                                    'User already assigned to another slot').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/registrations/{registrationUid}',
        handler: controller.deleteMissionSlotRegistration,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission slot registration',
            notes: 'Allows a user to delete their mission slot registration. Registrations can only be deleted by the user that created them or by mission creators and users' +
            'with the `mission.SLUG.editor` permission. Regular user authentication required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'slot', 'registration', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete the slot registrations for')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to delete registrations for')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
                    registrationUid: Joi.string().guid().length(36).required().description('UID of the mission slot registration to delete')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionSlotRegistrationResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user tried to delete a mission slot registration created by a different user',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no slot/registration with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found', 'Mission slot registration not found').required()
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
        method: 'POST',
        path: '/v1/missions/{missionSlug}/slots/{slotUid}/unassign',
        handler: controller.unassignMissionSlot,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Removes an existing assignment from a mission slot',
            notes: 'Removes an existing assignment from a mission slot, removing any regular or external assignee. This endpoint can only be used by mission creators and users ' +
            'with the `mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'slot', 'unassign', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to unassign slot')
                        .example('all-of-altis'),
                    slotUid: Joi.string().guid().length(36).required().description('UID of the mission slot to unassign').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slot: missionSlotSchema
                }).label('UnassignMissionSlotResponse').description('Response containing the unassigned mission slot')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor', 'mission.{{missionSlug}}.slotlist.community']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(403).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Forbidden').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Forbidden').required().description('Message further describing the error')
                            })
                        },
                        404: {
                            description: 'No mission with given slug or no slot with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot not found', 'User not found').required()
                                    .description('Message further describing the error')
                            })
                        },
                        409: {
                            description: 'The slot did not have any regular or external assignee',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(409).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Conflict').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot not assigned').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/slotTemplates/{slotTemplateUid}',
        handler: controller.applyMissionSlotTemplate,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Applies the selected mission slot template to the mission',
            notes: 'Applies the selected mission slot template to the mission, adding the slot groups and slots provided by it to the slotlist. This endpoint can only be ' +
            'used by mission creators and users with the `mission.SLUG.editor` permission. Regular user authentication with appropriate permissions is required to access this ' +
            'endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'slot', 'template', 'apply', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to apply slot template to').example('all-of-altis'),
                    slotTemplateUid: Joi.string().guid().length(36).required().description('UID of the mission slot template to apply')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().keys({
                    insertAfter: Joi.number().integer().positive().allow(0).default(0).required().description('Order number of slot group the mission slot template should be ' +
                        'applied after. The order number created will be incremented by one and all higher order numbers adapted accordingly').example(9)
                }).required()
            },
            response: {
                schema: Joi.object().required().keys({
                    slotGroups: Joi.array().items(missionSlotGroupSchema.optional()).required().description('List of mission slot groups created')
                }).label('ApplyMissionSlotTemplateResponse').description('Response containing the mission\'s slot list (in slot groups)')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator', 'mission.{{missionSlug}}.editor']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No mission with given slug or no mission slot template with the given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission not found', 'Mission slot template not found').required().description('Message further describing the error')
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
        path: '/v1/missions/{missionSlug}/token',
        handler: controller.getMissionToken,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns the mission API token used for static authentication',
            notes: 'Returns the mission API token used for static authentication, granting user access to this mission without requiring regular auth. This endpoint can only be ' +
            'used by mission creators. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missions', 'token', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to retrieve mission token for')
                        .example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    missionToken: Joi.string().min(1).allow(null).required().description('Mission token defined for this mission. Can be `null` if no token was generated yet')
                }).label('GetMissionTokenResponse').description('Response containing the current mission token for this mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
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
        method: 'POST',
        path: '/v1/missions/{missionSlug}/token',
        handler: controller.generateMissionToken,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Generates a new mission token',
            notes: 'Generates a new mission token for the current mission, overwriting and thus invalidating the current one. This endpoint can only be ' +
            'used by mission creators. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'missions', 'token', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to generate mission token for')
                        .example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    missionToken: Joi.string().min(1).allow(null).required().description('Mission token generated for this mission')
                }).label('GenerateMissionTokenResponse').description('Response containing the newly generated mission token for this mission')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
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
        path: '/v1/missions/{missionSlug}/token',
        handler: controller.deleteMissionToken,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes the mission token',
            notes: 'Deletes the mission token, performing no operation if no token was generated before. This endpoint can only be used by mission creators. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missions', 'token', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    missionSlug: Joi.string().min(1).max(255).disallow('slugAvailable').required().description('Slug of mission to delete token for').example('all-of-altis')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionTokenResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['mission.{{missionSlug}}.creator']
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
    }
];
