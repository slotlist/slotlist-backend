import * as Joi from 'joi';

import * as controller from '../../controllers/v1/status';

/**
 * All routes regarding status checks
 */

export const STATUS_STATUS_ERROR = 'error';
export const STATUS_STATUS_RUNNING = 'running';
export const STATUS_STATUSES = [
    STATUS_STATUS_ERROR,
    STATUS_STATUS_RUNNING
];

export const status = [
    {
        method: 'GET',
        path: '/v1/status',
        handler: controller.getStatus,
        config: {
            // Explicitly disable auth parsing here since invalid/expired JWTs being sent by the frontend would prevent the user from being able to see the backend status
            auth: false,
            description: 'Returns the API server\'s current status',
            notes: 'Can be used for monitoring and uptime checks. Returns the API server\'s current status. No authentication is required to access this endpoint',
            tags: ['api', 'get', 'v1', 'status', 'trace'], // Add tag `trace` to set bunyan logging level for request to this endpoint to TRACE and effecticely hide them
            validate: {
                options: {
                    abortEarly: false
                },
                headers: Joi.object({
                    authorization: Joi.string().min(1).optional().description('`JWT <TOKEN>` used for authorization, optional').example('JWT <TOKEN>')
                }).unknown(true),
                query: Joi.object().required().keys({
                    ping: Joi.string().min(1).optional().description('Optional ping/pong value to reply with').example('alive')
                })
            },
            response: {
                schema: Joi.object().required().keys({
                    status: Joi.string().equal(STATUS_STATUSES).required().description('Status of the API server, will basically only be `running` anyways').example('running'),
                    version: Joi.string().min(1).required().description('Current backend version in semver format (excluding leading "v")').example('1.0.0-alpha'),
                    now: Joi.number().required().min(1).description('Current unix timestamp at time of status check').example(1504371600),
                    pong: Joi.string().min(1).optional().description('Optional ping/pong response value as provided via query').example('alive')
                }).label('GetStatusResponse').description('Response containing status resposne')
            }
        }
    }
];
