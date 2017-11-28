import * as Joi from 'joi';

import { internalServerErrorSchema } from '../../../shared/schemas/misc';
import * as schemas from '../../../shared/schemas/notification';
import * as controller from '../../controllers/v1/notification';

/**
 * All routes regarding notifications
 */

export const LIMITS = {
    notificationList: {
        default: 50,
        max: 250
    }
};

export const notifications = [
    {
        method: 'GET',
        path: '/v1/notifications',
        handler: controller.getNotificationList,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns a list of all notifications for the user',
            notes: 'Returns a list of all notifications for the user, only including unseen ones by default. Since retrieving a notification will mark it as seen immediately, ' +
            'no pagination is available for this endpoint. Regular user authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'notifications', 'list'],
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).required().description('`JWT <TOKEN>` used for authorization, required').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    includeSeen: Joi.bool().default(false).optional().description('Toggles whether already seen notifications should also be included in the retrieved list')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    notifications: Joi.array().items(schemas.notificationSchema.optional()).required().description('List of notifications retrieved')
                }).label('GetNotificationListResponse').description('Response containing list of currently unseen notifications')
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
        path: '/v1/notifications/unseen',
        handler: controller.getUnseenNotificationCount,
        config: {
            auth: {
                strategy: 'jwt',
                mode: 'required'
            },
            description: 'Returns the number of unseen notifications for the user',
            notes: 'Returns the number of unseen notifications for the user. Regular user authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'notifications', 'unseen', 'count'],
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
                    unseen: Joi.number().integer().positive().allow(0).min(0).required().description('Number of unseen notifications')
                }).label('GetUnseenNotificationCountResposne').description('Response containing count of unseen notifications')
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
    }
];
