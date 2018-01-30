import * as Joi from 'joi';

/**
 * Schema for public mission server information
 */
export const missionServerInfoSchema = Joi.object().keys({
    hostname: Joi.string().min(1).required().description('Hostname of the server').example('example.com'),
    port: Joi.number().min(0).max(65535).required().description('Port of the server').example(2302),
    name: Joi.string().min(1).allow(null).default(null).optional().description('Optional name of the server, mostly useful for searching in server lists').example('SeL Event'),
    password: Joi.string().min(1).allow(null).default(null).optional().description('Optional password of the server. Set to `null` if no password is required').example('hunter2')
}).required().label('MissionServerInfo').description('Contains information about a server used during a mission. This could either be a gameserver or voice comms');
