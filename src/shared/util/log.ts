import * as bunyan from 'bunyan';
import * as _ from 'lodash';
import * as pjson from 'pjson';

import { Logging as LoggingConfig } from '../config/Config';

/**
 * Creates a bunyan logger to be used throughout the app
 */

const serializers: bunyan.Serializers = {
    err: bunyan.stdSerializers.err,
    req: (req: any) => {
        if (!req || !req.info) {
            return req;
        }

        const auth = _.cloneDeep(req.auth);
        const headers = _.cloneDeep(req.headers);
        if (_.isString(auth.token)) {
            auth.token = '***REDACTED***';
        }
        if (_.isString(headers.authorization)) {
            headers.authorization = '***REDACTED***';
        }

        return {
            auth: auth,
            headers: headers,
            id: req.id,
            info: req.info,
            method: req.method,
            mime: req.mime,
            params: req.params,
            path: req.path,
            payload: req.payload,
            query: req.query,
            state: req.state,
            url: req.url
        };
    },
    res: bunyan.stdSerializers.res,
    responsePayload: (responsePayload: any) => {
        const payload = _.cloneDeep(responsePayload);
        if (_.isString(payload.token)) {
            payload.token = '***REDACTED***';
        }

        return payload;
    },
    headers: (headers: any) => {
        const head = _.cloneDeep(headers);
        if (_.isString(head.authorization)) {
            head.authorization = '***REDACTED***';
        }

        return head;
    }
};

const streams: bunyan.Stream[] = [];
if (LoggingConfig.stdout) {
    streams.push({
        level: <any>LoggingConfig.stdout,
        stream: process.stdout
    });
}

_.each(LoggingConfig.files, (logFile: { path: string; level: string | number; }) => {
    streams.push({
        level: <any>logFile.level,
        path: logFile.path
    });
});

export const log = bunyan.createLogger({
    name: 'slotlist-backend',
    serializers: serializers,
    level: 'trace',
    src: LoggingConfig.src,
    version: pjson.version
});

// tslint:disable-next-line:no-default-export
export default log;
