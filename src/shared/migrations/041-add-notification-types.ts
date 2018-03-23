import * as _ from 'lodash';

import { NOTIFICATION_TYPE_GENERIC, NOTIFICATION_TYPES } from '../types/notification';
import { changeEnum } from '../util/migrations';

/**
 * Adds announcement notification types to notificationType enum
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await changeEnum(queryInterface.sequelize, 'notifications', 'notificationType', NOTIFICATION_TYPES, NOTIFICATION_TYPE_GENERIC);
    },
    down: async (queryInterface: any): Promise<void> => {
        const notificationTypes = _.without(NOTIFICATION_TYPES, 'announcement.generic', 'announcement.update');

        await changeEnum(queryInterface.sequelize, 'notifications', 'notificationType', notificationTypes, NOTIFICATION_TYPE_GENERIC);
    }
};
