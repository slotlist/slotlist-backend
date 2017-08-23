import * as Hapi from 'hapi';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as pjson from 'pjson';

import { STATUS_STATUS_RUNNING } from '../../routes/v1/status';

/**
 * Handlers for V1 of status endpoints
 */

export function getStatus(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        return {
            status: STATUS_STATUS_RUNNING,
            version: pjson.version,
            now: moment().utc().unix(),
            pong: _.isNil(request.query.ping) || _.isEmpty(request.query.ping) ? undefined : request.query.ping
        };
    })());
}
