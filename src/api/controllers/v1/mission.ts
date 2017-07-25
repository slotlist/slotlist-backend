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
 * Handlers for V1 of mission endpoints
 */

export function getMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
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

export function getMissionDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const slug = request.params.slug;

        const mission = await Mission.findOne({
            where: { slug },
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: User,
                    as: 'creator'
                }
            ]
        });
        if (_.isNil(mission)) {
            log.debug({ function: 'getMissionDetails', slug }, 'Mission with given slug not found');
            throw Boom.notFound('Mission not found');
        }

        const detailedPublicMission = await mission.toDetailedPublicObject();

        return {
            mission: detailedPublicMission
        };
    })());
}
