import * as Hapi from 'hapi';
import * as moment from 'moment';

import { Notification } from '../../../shared/models/Notification';

/**
 * Handlers for V1 of notification endpoints
 */

export function getNotificationList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.user.uid;

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [['createdAt', 'DESC']],
            where: {
                userUid
            }
        };

        if (!request.query.includeSeen) {
            queryOptions.where.seenAt = null;
        }

        const result = await Notification.findAndCountAll(queryOptions);

        const notificationCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + notificationCount) < result.count;
        const notificationList = await Promise.map(result.rows, async (notification: Notification) => {
            return notification.toPublicObject();
        });

        await Promise.map(result.rows, (notification: Notification) => {
            return notification.update({ seenAt: moment.utc() });
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: notificationCount,
            total: result.count,
            moreAvailable: moreAvailable,
            notifications: notificationList
        };
    })());
}

export function getUnseenNotificationCount(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const userUid: string = request.auth.credentials.user.uid;

        const queryOptions: any = {
            where: {
                userUid,
                seenAt: null
            }
        };

        const unseenNotificationCount = await Notification.count(queryOptions);

        return {
            unseen: unseenNotificationCount
        };
    })());
}
