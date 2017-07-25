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
 * Handlers for V1 of user endpoints
 */

export function getUserDetails(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid = request.params.uid;

        const user = await User.findById(userUid, {
            include: [
                {
                    model: Community,
                    as: 'community'
                },
                {
                    model: Mission,
                    as: 'missions'
                }
            ]
        });
        if (_.isNil(user)) {
            log.debug({ function: 'getUserDetails', userUid }, 'User with given UID not found');
            throw Boom.notFound('User not found');
        }

        const detailedPublicUser = await user.toDetailedPublicObject();

        return {
            user: detailedPublicUser
        };
    })());
}

export function getUserMissionList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid = request.params.uid;
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

        const user = await User.findById(userUid);
        if (_.isNil(user)) {
            log.debug({ function: 'getUserMissionList', userUid, queryOptions }, 'User with given UID not found');
            throw Boom.notFound('User not found');
        }

        _.assign(queryOptions.where, { creatorUid: user.uid });

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
