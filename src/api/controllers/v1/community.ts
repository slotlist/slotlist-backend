import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';

import { Community } from '../../../shared/models/Community';
import { Mission } from '../../../shared/models/Mission';
import { User } from '../../../shared/models/User';
import { log as logger } from '../../../shared/util/log';
const log = logger.child({ route: 'community', routeVersion: 'v1' });

/**
 * Handlers for V1 of community endpoints
 */

export function getCommunityList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const queryOptions = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        const result = await Community.findAndCountAll(queryOptions);

        const communityCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + communityCount) < result.count;
        const communityList = await Promise.map(result.rows, (community: Community) => {
            return community.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: communityCount,
            moreAvailable: moreAvailable,
            communities: communityList
        };
    })());
}

export function getCommunityDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;

        const community = await Community.findOne({
            where: { slug },
            include: [
                {
                    model: User,
                    as: 'members'
                },
                {
                    model: Mission,
                    as: 'missions',
                    where: {
                        endTime: {
                            $gt: moment.utc()
                        }
                    },
                    include: [
                        {
                            model: User,
                            as: 'creator'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(community)) {
            log.debug({ slug }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const publicCommunity = await community.toDetailedPublicObject();

        return {
            community: publicCommunity
        };
    })());
}

export function getCommunityMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;
        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset
        };

        if (request.query.includeEnded === false) {
            queryOptions.where = {
                endTime: {
                    $gt: moment.utc()
                }
            };
        }

        const community = await Community.findOne({ where: { slug }, attributes: ['uid'] });
        if (_.isNil(community)) {
            log.debug({ slug, queryOptions }, 'Community with given slug not found');
            throw Boom.notFound('Community not found');
        }

        const result = await Mission.findAndCountAll(queryOptions);

        const missionCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + missionCount) < result.count;
        const missionList = await Promise.map(result.rows, (mission: Mission) => {
            return mission.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: missionCount,
            moreAvailable: moreAvailable,
            missions: missionList
        };
    })());
}
