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
            where: {
                userUid
            },
            order: [['createdAt', 'DESC']]
        };

        if (!request.query.includeSeen) {
            queryOptions.where.seenAt = null;
        }

        const notifications = await Notification.findAll(queryOptions);

        const publicNotifications = await Promise.map(notifications, async (notification: Notification) => {
            return notification.toPublicObject();
        });

        await Promise.map(notifications, (notification: Notification) => {
            return notification.update({ seenAt: moment.utc() });
        });

        return {
            notifications: publicNotifications
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
