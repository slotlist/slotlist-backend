import * as bunyan from 'bunyan';
import * as Hapi from 'hapi';

/**
 * Modified Request type from Hapi to allow for bunyan logger inclusion
 *
 * @export
 * @class Request
 */
export class Request extends Hapi.Request {
    public bunyan: bunyan;
}
