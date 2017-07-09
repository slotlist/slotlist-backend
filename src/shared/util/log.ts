import * as bunyan from 'bunyan';
import * as _ from 'lodash';
import * as pjson from 'pjson';

import { Logging as LoggingConfig } from '../config/Config';

/**
 * Creates a bunyan logger to be used throughout the app
 */

const serializers: bunyan.Serializers = {
    err: bunyan.stdSerializers.err,
    req: bunyan.stdSerializers.req,
    res: bunyan.stdSerializers.res
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
