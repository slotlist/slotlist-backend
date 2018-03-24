import * as Joi from 'joi';

import { ANNOUNCEMENT_TYPE_GENERIC, ANNOUNCEMENT_TYPE_UPDATE, ANNOUNCEMENT_TYPES } from '../models/Announcement';
import { userSchema } from './user';

/**
 * Schema for public announcement information
 */
export const announcementSchema = Joi.object().keys({
    uid: Joi.string().guid().length(36).required().description('UID of the announcement').example('e3af45b2-2ef8-4ece-bbcc-13e70f2b68a8'),
    title: Joi.string().min(1).max(255).required().description('Title of the announcement').example('Update 1.0.0 finally released'),
    content: Joi.string().min(1).required().description('Content of the announcement. Can contain HTML for formatting')
        .example('<h1>Update 1.0.0</h1><h2>Changelog</h2><ol><li>Added fancy stuff</li></ol>'),
    user: userSchema.required().description('Creator of the announcement'),
    createdAt: Joi.date().required().description('Date and time the announcement was created').example('2017-09-02T17:00:00.000Z'),
    visibleFrom: Joi.date().allow(null).default(null).optional().description('Date and time the announcement will be visible from. Can be `null` if the announcement ' +
        'should be immediately visible').example('2017-09-02T17:00:00.000Z'),
    announcementType: Joi.string().equal(ANNOUNCEMENT_TYPES).default(ANNOUNCEMENT_TYPE_GENERIC).required().description('Type of announcement, used to distinguish ' +
        'text/data to display').example(ANNOUNCEMENT_TYPE_UPDATE)
}).required().label('Announcement').description('Public announcement information, as displayed in the announcement list');
