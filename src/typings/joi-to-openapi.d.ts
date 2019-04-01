declare module 'joi-to-openapi' {
  import Joi from 'joi';

  export default function jsonToOpenAPI(schema: Joi.AnySchema): any;
}
