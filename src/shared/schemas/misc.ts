import * as Joi from 'joi';

/**
 * Miscellaneous other schemas
 */
export const internalServerErrorSchema = Joi.object().keys({
    statusCode: Joi.number().equal(500).required().description('HTTP status code caused by the error'),
    error: Joi.string().equal('Internal Server Error').required().description('HTTP status code text respresentation'),
    message: Joi.string().required().description('Message further describing the error').example('An internal server error occurred')
}).required().label('InternalServerError').description('Information returned for Internal Server Error responses');
