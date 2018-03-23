import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { col, fn } from 'sequelize';

import { Announcement } from '../../../shared/models/Announcement';
import { Community } from '../../../shared/models/Community';
import { Notification } from '../../../shared/models/Notification';
import { User } from '../../../shared/models/User';
import { hasPermission } from '../../../shared/util/acl';
import { log as logger } from '../../../shared/util/log';
const log = logger.child({ route: 'announcement', routeVersion: 'v1' });

/**
 * Handlers for V1 of announcement endpoints
 */

export function getAnnouncementList(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        let userUid: string | null = null;
        if (request.auth.isAuthenticated) {
            userUid = request.auth.credentials.user.uid;
        }

        const queryOptions: any = {
            limit: request.query.limit,
            offset: request.query.offset,
            order: [['createdAt', 'DESC'], [fn('UPPER', col('title')), 'ASC']],
            where: {
                $or: [
                    {
                        visibleFrom: null
                    },
                    {
                        visibleFrom: {
                            $lte: moment.utc()
                        }
                    }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        };

        if (!_.isNil(userUid) && hasPermission(request.auth.credentials.permissions, 'admin.announcement')) {
            log.info({ function: 'getAnnouncementList', userUid, hasPermission: true }, 'User has announcement admin permissions, returning all announcements');
            queryOptions.where = {};
        }

        const result = await Announcement.findAndCountAll(queryOptions);

        const announcementCount = result.rows.length;
        const moreAvailable = (queryOptions.offset + announcementCount) < result.count;
        const announcementList = await Promise.map(result.rows, async (announcement: Announcement) => {
            return announcement.toPublicObject();
        });

        return {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            count: announcementCount,
            total: result.count,
            moreAvailable: moreAvailable,
            announcements: announcementList
        };
    })());
}

export function createAnnouncement(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const user = await User.findById(userUid, { include: [{ model: Community, as: 'community' }] });
        if (_.isNil(user)) {
            log.debug({ function: 'createAnnouncement', payload, userUid }, 'User from decoded JWT not found');
            throw Boom.unauthorized('Token user not found');
        }

        payload.userUid = user.uid;

        log.debug({ function: 'createAnnouncement', payload, userUid, sendNotifications: payload.sendNotifications }, 'Creating new announcement');

        const announcement = payload.sendNotifications ?
            await Announcement.createAndNotify(payload.title, payload.content, payload.announcementType, payload.visibleFrom, payload.userUid) :
            await new Announcement(payload).save();

        log.debug({ function: 'createAnnouncement', payload, userUid, announcementUid: announcement.uid }, 'Successfully created new annoucement');

        const publicAnnouncement = await announcement.toPublicObject();

        return {
            announcement: publicAnnouncement
        };
    })());
}

export function updateAnnouncement(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const announcementUid = request.params.announcementUid;
        const payload = request.payload;
        const userUid = request.auth.credentials.user.uid;

        const announcement = await Announcement.findById(announcementUid, {
            include: [
                {
                    model: User,
                    as: 'user',
                    include: [
                        {
                            model: Community,
                            as: 'community'
                        }
                    ]
                }
            ]
        });
        if (_.isNil(announcement)) {
            log.debug({ function: 'updateAnnouncement', announcementUid, payload, userUid }, 'Announcement with given UID not found');
            throw Boom.notFound('Announcement not found');
        }

        log.debug({ function: 'updateAnnouncement', announcementUid, payload, userUid }, 'Updating announcement');

        await announcement.update(payload, {
            fields: [
                'title',
                'content',
                'visibleFrom'
            ]
        });

        log.debug({ function: 'updateAnnouncement', announcementUid, payload, userUid }, 'Successfully updated mission');

        const publicAnnouncement = await announcement.toPublicObject();

        return {
            announcement: publicAnnouncement
        };
    })());
}

export function deleteAnnouncement(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const announcementUid = request.params.announcementUid;
        const userUid = request.auth.credentials.user.uid;

        const announcement = await Announcement.findById(announcementUid);
        if (_.isNil(announcement)) {
            log.debug({ function: 'deleteAnnouncement', announcementUid, userUid }, 'Announcement with given UID not found');
            throw Boom.notFound('Announcement not found');
        }

        log.debug({ function: 'deleteAnnouncement', announcementUid, userUid }, 'Deleting announcement');

        await announcement.destroy();

        log.debug({ function: 'deleteAnnouncement', announcementUid, userUid }, 'Deleting announcement notifications');

        const deletedNotificationCount = await Notification.destroy({
            where: {
                data: {
                    announcementUid: announcement.uid
                }
            }
        });

        log.debug({ function: 'deleteAnnouncement', announcementUid, userUid, deletedNotificationCount }, 'Successfully deleted announcement notifications');

        return {
            success: true
        };
    })());
}
