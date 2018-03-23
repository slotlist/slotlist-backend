import * as Joi from 'joi';

import { ANNOUNCEMENT_TYPE_GENERIC, ANNOUNCEMENT_TYPES } from '../../../shared/models/Announcement';
import * as schemas from '../../../shared/schemas/announcement';
import { forbiddenSchema, internalServerErrorSchema } from '../../../shared/schemas/misc';
import * as controller from '../../controllers/v1/announcement';

/**
 * All routes regarding announcements
 */

export const LIMITS = {
    announcementList: {
        default: 25,
        max: 100
    }
};

export const announcement = [
    {
        method: 'GET',
        path: '/v1/announcements',
        handler: controller.getAnnouncementList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'optional'
            },
            description: 'Returns a list of all currently visible announcements',
            notes: 'Returns a paginated list of all currently visible announcements. Up to 100 announcements can be requested at once, pagination has to be used to retrieve the ' +
            'rest. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'announcements', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.announcementList.max).default(LIMITS.announcementList.default).optional()
                        .description('Limit for number of announcements to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().min(0).default(0).optional()
                        .description('Number of announcements to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.announcementList.max).optional()
                        .description('Limit for number of announcements to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).optional()
                        .description('Number of announcements to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.announcementList.max).optional()
                        .description('Actual number of announcements returned'),
                    total: Joi.number().integer().positive().allow(0).min(0).optional().description('Total number of announcements stored'),
                    moreAvailable: Joi.bool().optional().description('Indicates whether more announcements are available and can be retrieved using pagination'),
                    announcements: Joi.array().items(schemas.announcementSchema.optional()).required().description('List of announcements retrieved')
                }).label('GetAnnouncementListResponse').description('Response containing list of currently created announcements')
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
        path: '/v1/announcements',
        handler: controller.createAnnouncement,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Creates a new announcement',
            notes: 'Creates a new announcement and optionally sends a notification to all users. This endpoint can only be used by administrators with the `admin.announcement`' +
            'permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'post', 'v1', 'announcements', 'create', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).required().description('Title of the announcement').example('Update 1.0.0 finally released'),
                    content: Joi.string().min(1).required().description('Content of the announcement. Can contain HTML for formatting')
                        .example('<h1>Update 1.0.0</h1><h2>Changelog</h2><ol><li>Added fancy stuff</li></ol>'),
                    announcementType: Joi.string().equal(ANNOUNCEMENT_TYPES).required().description('Type of announcement to create, resulting in different display/notifications')
                        .example(ANNOUNCEMENT_TYPE_GENERIC),
                    visibleFrom: Joi.date().allow(null).default(null).optional().description('Date and time the announcement will be visible from. Can be `null` if the ' +
                        'announcement should be immediately visible').example('2017-09-02T17:00:00.000Z'),
                    sendNotifications: Joi.bool().required().description('Indicates whether notifications should be sent out to all users, depending on the announcement type')
                        .example(false)
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    announcement: schemas.announcementSchema
                }).label('CreateAnnouncementResponse').description('Response containing details of newly created announcement')
            },
            plugins: {
                acl: {
                    permissions: ['admin.announcement']
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
        path: '/v1/announcements/{announcementUid}',
        handler: controller.updateAnnouncement,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Updates an existing announcement',
            notes: 'Updates the mutable attributes of an announcement. This endpoint can only be used by administrators with the `admin.announcement` permission. ' +
            'Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'patch', 'v1', 'announcements', 'update', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    announcementUid: Joi.string().guid().length(36).required().description('UID of the announcement to update').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                }),
                payload: Joi.object().required().keys({
                    title: Joi.string().min(1).max(255).optional().description('New title of the announcement').example('Update 1.0.0 finally released'),
                    content: Joi.string().min(1).optional().description('New content of the announcement. Can contain HTML for formatting')
                        .example('<h1>Update 1.0.0</h1><h2>Changelog</h2><ol><li>Added fancy stuff</li></ol>'),
                    visibleFrom: Joi.date().allow(null).optional().description('New date and time the announcement will be visible from. Can be `null` if the ' +
                        'announcement should be immediately visible').example('2017-09-02T17:00:00.000Z')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    announcement: schemas.announcementSchema
                }).label('UpdateAnnouncementResponse').description('Response containing details of the updated announcement')
            },
            plugins: {
                acl: {
                    permissions: ['admin.announcement']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No announcement with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Announcement not found').required().description('Message further describing the error')
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
        path: '/v1/announcements/{announcementUid}',
        handler: controller.deleteAnnouncement,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Deletes an existing announcement',
            notes: 'Deletes an existing announcement, including all associated notifications. This endpoint can only be used by administrators with the `admin.announcement` ' +
            'permission. Regular user authentication with appropriate permissions is required to access this endpoint',
            tags: ['api', 'delete', 'v1', 'announcements', 'authenticated', 'restricted'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                params: Joi.object().required().keys({
                    announcementUid: Joi.string().guid().length(36).required().description('UID of the announcement to delete').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    success: Joi.bool().truthy().required().description('Indicates success of the delete operation (will never be false, since an error will be returned instead)')
                }).label('DeleteAnnouncementResponse').description('Response containing results of the delete operation')
            },
            plugins: {
                acl: {
                    permissions: ['admin.announcement']
                },
                'hapi-swagger': {
                    responses: {
                        403: {
                            description: 'A user without appropriate permissions is accessing the endpoint',
                            schema: forbiddenSchema
                        },
                        404: {
                            description: 'No announcement with given UID was found',
                            schema: Joi.object().required().keys({
                                statusCode: Joi.number().equal(404).required().description('HTTP status code caused by the error'),
                                error: Joi.string().equal('Not Found').required().description('HTTP status code text respresentation'),
                                message: Joi.string().equal('Announcement not found').required().description('Message further describing the error')
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
