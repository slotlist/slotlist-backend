import * as Joi from 'joi';

import * as schemas from '../../../shared/schemas/community';
import * as controller from '../../controllers/v1/community';

/**
 * All routes regarding communities
 */

export const LIMITS = {
    communityList: {
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
            auth: false,
            description: 'Returns a list of all currently created communities',
            notes: 'Returns a paginated list of all currently created communities. Up to 100 communities can be requested at once, pagination has to be used to retrieve the ' +
            'rest. No authentication is required to access this endpoint.',
            tags: ['api', 'get', 'v1', 'communities'],
            response: {
                schema: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityList.max).required()
                        .description('Limit for number of communities to retrieve, as provided via query'),
                    offset: Joi.number().integer().positive().allow(0).min(0).required()
                        .description('Number of communities to skip before retrieving new ones from database, as provided via query'),
                    count: Joi.number().integer().positive().allow(0).min(0).max(LIMITS.communityList.max).required()
                        .description('Actual number of communities returned'),
                    moreAvailable: Joi.bool().required().description('Indicates whether more tournaments are available and can be retrieved using pagination'),
                    communities: Joi.array().items(schemas.communitySchema.optional()).required().description('List of communities retrieved')
                }).label('GetCommunityListResponse').description('Response containing list of currently created communities')
            },
            validate: {
                options: {
                    abortEarly: false
                },
                query: Joi.object().required().keys({
                    limit: Joi.number().integer().positive().min(1).max(LIMITS.communityList.max).default(LIMITS.communityList.default).optional()
                        .description('Limit for number of communities to retrieve, defaults to 25 (used for pagination in combination with offset)'),
                    offset: Joi.number().integer().positive().allow(0).min(0).default(0).optional()
                        .description('Number of communities to skip before retrieving new ones from database, defaults to 0 (used for pagination in combination with limit)')
                })
            }
        }
    },
    {
        method: 'GET',
        path: '/v1/communities/{slug}',
        handler: controller.getCommunityDetails,
        config: {
            auth: false,
            description: 'Returns a details about a specific community',
            notes: 'Returns more detailed information about a specific community, including a short list of currently announced missions as well as a member list. ' +
            'No authentication is required to access this endpoint.',
            tags: ['api', 'get', 'v1', 'communities', 'details'],
            response: {
                schema: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID URL to redirect to for signin')
                }).label('GetSteamLoginRedirectURLResponse').description('Response containing Steam OpenID URL to redirect user to')
            }
        }
    }
];
