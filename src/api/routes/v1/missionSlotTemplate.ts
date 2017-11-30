import * as Joi from 'joi';

import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import * as schemas from '../../../shared/schemas/missionSlotTemplate';
import * as controller from '../../controllers/v1/missionSlotTemplate';

import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN, MISSION_VISIBILITY_PUBLIC } from '../../../shared/models/Mission';

/**
 * All routes regarding mission slot templates
 */

export const LIMITS = {
    missionSlotTemplateList: {
        default: 25,
        max: 100
    }
};

export const missionSlotTemplate = [
    {
        method: 'GET',
        path: '/v1/missionSlotTemplates',
        handler: controller.getMissionSlotTemplateList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all available mission slot templates',
            notes: 'Returns a paginated list of all mission slot templates available to the user, including default templates. Up to 100 templates can be requested at once, ' +
            'pagination has to be used to retrieve the rest. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missionSlotTemplates', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionSlotTemplateList.max).default(LIMITS.missionSlotTemplateList.default).optional()
                        .description('Limit for number of mission slot templates to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of mission slot templates to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination ' +
                        'with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.missionSlotTemplateList.max).required()
                        .description('Limit for number of mission slot templates to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of mission slot templates to skip before retrieving new ones from database, as provided via query. Omitted if query including ' +
                        '`startDate` was executed'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.missionSlotTemplateList.max).required()
                        .description('Actual number of mission slot templates returned. Omitted if query including `startDate` was executed'),
                    total: Joi.number().integer().positive().allow(0).min(0).required().description('Total number of mission slot templates stored'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more mission slot templates are available and can be retrieved using pagination'),
                    slotTemplates: Joi.array().items(schemas.missionSlotTemplateSchema.optional()).required().description('List of mission slot templates retrieved')
                }).label('GetMissionSlotTemplateListResponse').description('Response containing list of currently available mission slot templates')
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
        path: '/v1/missionSlotTemplates',
        handler: controller.createMissionSlotTemplate,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new mission slot template with the provided data',
            notes: 'Creates a new mission slot template with the provided data, optionally already creating slot groups and slots. Regular user authentication is required to ' +
            'access this endpoint',
            tags: ['api', 'post', 'v1', 'missionSlotTemplates', 'create', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).required().description('Title of the mission slot template').example('Standard Rifle Squad'),
                    visibility: Joi.string().equal(MISSION_VISIBILITIES).default(MISSION_VISIBILITY_HIDDEN).required().description('Indicates the visibility setting ' +
                        'of a mission slot template, including the same settings as the mission visibilities').example(MISSION_VISIBILITY_PUBLIC),
                    slotGroups: Joi.array().items(schemas.missionSlotTemplateSlotGroupSchema.optional()).default([]).optional().description('Optional list of slot groups' +
                        'including slots that should be added immediately. The `orderNumber`s are assumed to be in a correct, appropriate order already - no reordering will be ' +
                        'done before saving the provided data')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slotTemplate: schemas.missionSlotTemplateDetailsSchema
                }).label('CreateMissionSlotTemplateResponse').description('Response containing details of newly created mission slot template')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        400: {
                            description: 'The `slotGroups` array provided contained invalid slot group or slot data',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Bad Request').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Invalid mission slot template data').required().description('Message further describing the error')
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
        path: '/v1/missionSlotTemplates/{slotTemplateUid}',
        handler: controller.getMissionSlotTemplateDetails,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns details of a mission slot template',
            notes: 'Returns details of a mission slot template, including a full slot group and slot list. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'missionSlotTemplates', 'details'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slotTemplateUid: Joi.string().guid().length(36).required().description('UID of the mission slot template').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slotTemplate: schemas.missionSlotTemplateDetailsSchema
                }).label('GetMissionSlotTemplateDetailsResponse').description('Response containing details of requested mission slot template')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No mission slot template with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot template not found').required().description('Message further describing the error')
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
        path: '/v1/missionSlotTemplates/{slotTemplateUid}',
        handler: controller.updateMissionSlotTemplate,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing mission slot template',
            notes: 'Updates an existing mission slot template, allowing for the title as well as the visibility to be changed. Regular user authentication is required to access ' +
            'this endpoint',
            tags: ['api', 'patch', 'v1', 'missionSlotTemplates', 'update', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slotTemplateUid: Joi.string().guid().length(36).required().description('UID of the mission slot template to update')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).optional().description('New title of the mission slot template').example('Standard Rifle Squad'),
                    visibility: Joi.string().equal(MISSION_VISIBILITIES).optional().description('New visibility setting ' +
                        'of a mission slot template, including the same settings as the mission visibilities').example(MISSION_VISIBILITY_PUBLIC),
                    slotGroups: Joi.array().items(schemas.missionSlotTemplateSlotGroupSchema.optional()).optional().description('Optional, *FULL* list of slot groups' +
                        'including slots that should be included in the template. The `orderNumber`s are assumed to be in a correct, appropriate order already - no reordering ' +
                        'will be done before saving the provided data. If changes to the slot groups or slots have been made, *ALL* slots *MUST* be provided since the stored' +
                        'values will be replaced')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    slotTemplate: schemas.missionSlotTemplateDetailsSchema
                }).label('UpdateMissionSlotTemplateResponse').description('Response containing details of updated mission slot template')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No mission slot template with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot template not found').required().description('Message further describing the error')
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
        path: '/v1/missionSlotTemplates/{slotTemplateUid}',
        handler: controller.deleteMissionSlotTemplate,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing mission slot template',
            notes: 'Deletes an existing mission slot template. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'missionSlotTemplate', 'authenticated'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    slotTemplateUid: Joi.string().guid().length(36).required().description('UID of the mission slot template to delete')
                        .example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteMissionSlotTemplateResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                'hapi-swagger': {
                    responses: {
                        404: {
                            description: 'No mission slot template with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Mission slot template not found').required().description('Message further describing the error')
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
