import * as bunyan from 'bunyan';
// tslint:disable-next-line
const StackdriverLogging = require('@google-cloud/logging-bunyan');
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
        if (_.isString(auth.artifacts)) {
            auth.artifacts = undefined;
            delete auth.artifacts;
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
            query: req.query,
            state: req.state,
            url: req.url
        };
    },
    res: bunyan.stdSerializers.res,
    payload: (payload: any) => {
        if (_.isNil(payload)) {
            return payload;
        }

        const pay = _.cloneDeep(payload);
        if (_.isString(pay.token)) {
            pay.token = '***REDACTED***';
        }
        if (_.isString(pay.detailedDescription)) {
            pay.detailedDescription = '***SNIP***';
        }
        if (_.isString(pay.collapsedDescription)) {
            pay.collapsedDescription = '***SNIP***';
        }
        if (!_.isNil(pay.image)) {
            pay.image = '***SNIP***';
        }

        return pay;
    },
    headers: (headers: any) => {
        const head = _.cloneDeep(headers);
        if (_.isString(head.authorization)) {
            head.authorization = '***REDACTED***';
        }

        return head;
    },
    credentials: (credentials: any) => {
        if (_.isNil(credentials)) {
            return credentials;
        }

        const cred = _.cloneDeep(credentials);
        if (_.isString(cred.token)) {
            cred.token = '***REDACTED***';
        }

        return cred;
    }
};

const streams: bunyan.Stream[] = [];
// tslint:disable-next-line:strict-boolean-expressions
if (LoggingConfig.stdout) {
    streams.push({
        level: <any>LoggingConfig.stdout,
        stream: process.stdout
    });
}

_.each(LoggingConfig.files, (logFile: { path: string; level: string | number }) => {
    streams.push({
        level: <any>logFile.level,
        path: logFile.path
    });
});

if (LoggingConfig.stackdriver) {
    const stackdriverLogging = StackdriverLogging();
    streams.push(stackdriverLogging.stream());
}

export const log = bunyan.createLogger({
    name: 'slotlist-backend',
    serializers: serializers,
    level: <any>LoggingConfig.stdout,
    src: LoggingConfig.src,
    version: pjson.version
});

// tslint:disable-next-line:no-default-export
export default log;
