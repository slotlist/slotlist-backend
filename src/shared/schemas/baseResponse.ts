import * as Joi from 'joi';

/**
 * Base response schema for every API call, including success status and completion/error messages
 */
export const baseResponse = Joi.object().required().keys({
    success: Joi.boolean().required().description('Indicates whether the request was successful'),
    message: Joi.string().when('success', { is: true, then: Joi.optional(), otherwise: Joi.forbidden() })
        .description('Optional message providing information about the operation\'s completion if the request succeeded'),
    error: Joi.string().when('success', { is: false, then: Joi.optional(), otherwise: Joi.forbidden() })
        .description('Optional message providing information about the error cause if the request failed')
}).label('BaseResponse').meta({
    className: 'BaseResponse'
}).description('Base response schema returned for every API call');
