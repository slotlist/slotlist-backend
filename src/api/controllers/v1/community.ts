import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';

import { Community } from '../../../shared/models/Community';
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

        const community = await Community.findOne({ where: { slug }, include: [{ all: true }] });
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
