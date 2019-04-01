import { stream } from 'procurator';
import Joi from 'joi';
import {
  AbstractActionController,
  config,
  Config,
  ControllerManager,
  inject,
  RegisteredRouteInterface,
  RequestMethods,
  RouterService,
  ServerService,
} from 'stix';
import joiToOpenApi from 'joi-to-openapi';
import { Mapping } from 'wetland';
import { Key } from 'path-to-regexp';
import { getAssociatedEntity, WetlandService } from 'stix-wetland';
import * as path from 'path';
import * as fs from 'fs';
import { Gate, GateManagerConfigType } from 'stix-gates';
import { SecurityConfig, SecurityGate } from 'stix-security';
import { Schema, SchemaService } from 'stix-schema';

export class SwaggerController extends AbstractActionController {
  @inject(RouterService)
  private routerService: RouterService;

  @inject(WetlandService)
  private wetlandService: WetlandService;

  @inject(Config)
  private config: Config;

  @config('gate')
  private gateConfig: GateManagerConfigType;

  @config('security')
  private securityConfig: SecurityConfig;

  @inject(ControllerManager)
  private controllerManager: ControllerManager;

  @inject(ServerService)
  private serverService: ServerService;

  @inject(SchemaService)
  private schemaService: SchemaService;

  public async ui () {
    const ui = fs
      .createReadStream(path.resolve(__dirname, '..', '..', '..', 'static', 'index.html'))
      .pipe(stream({ url: this.serverService.getURL() + 'swagger/doc' }, false));

    return this.okResponse({}).html(ui);
  }

  public async doc () {
    const queryParameters: any = {};
    const paths: { [key: string]: any } = {};
    const tags: any = {};
    const components: any = {
      securitySchemes: {},
      schemas: {
        Error: {
          required: [ 'code', 'message' ],
          properties: {
            data: {
              type: 'object',
            },
            message: {
              type: 'string',
            },
          },
        },
      },
    };

    const routeToSwaggerPath = (route: string) => route.replace(/(:)(.*?)(\/|$)/g, '{$2}$3');

    const assembleSchema = (schemaSource: Schema) => {
      const { schema, name } = schemaSource;

      try {
        if (!(components.schemas as any)[name]) {
          (components.schemas as any)[name] = joiToOpenApi(schema.isJoi ? schema as Joi.AnySchema : Joi.object(schema as Joi.SchemaMap));
        }

        return true;
      } catch (error) {
        return false;
      }
    };

    const getFromSchema = (controller: any, action: string, source: 'body' | 'query'): any => {
      const resolvedController: any = this.controllerManager.getController(controller);
      const schemaRule = this.schemaService.getSchemaRule(resolvedController, action);

      return schemaRule ? schemaRule[source] : null;
    };

    const ensureFromSchema = (controller: any, action: string, source: 'body' | 'query'): any => {
      const schema = getFromSchema(controller, action, source);

      if (!schema) {
        return false;
      }

      if (assembleSchema(schema)) {
        return schema.name;
      }

      return false;
    };

    const ensureSchema = (controller: any, action: string, method: RequestMethods) => {
      // Schema takes precedence over entity
      const fromSchema = ensureFromSchema(controller, action, 'body');

      if (fromSchema) {
        return fromSchema;
      }

      const Entity = getAssociatedEntity(controller);

      if (!Entity) {
        return;
      }

      const mapping = this.wetlandService.getMapping(Entity);
      const schemaKey = (method === RequestMethods.Post ? 'New' : '') + mapping.getEntityName();

      if (!(components.schemas as any)[schemaKey]) {
        (components.schemas as any)[schemaKey] = makeEntitySchema(mapping);
      }

      return schemaKey;
    };

    const makeBody = (controller: any, schemaKey: string) => {
      const bodyDefinition: { description: string, required: boolean, content?: any } = {
        description: 'Data model for ' + controller.name,
        required: true,
      };

      if (schemaKey) {
        bodyDefinition.content = {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/' + schemaKey,
            },
          },
        }
      }

      return bodyDefinition;
    };

    const makeResponses = (resourceName: string, schemaKey: string, method: RequestMethods) => {
      const resourceResonse: any = {
        description: resourceName + ' response',
      };

      if (schemaKey) {
        resourceResonse.content = {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/' + schemaKey,
            },
          },
        };
      }

      return {
        [method === RequestMethods.Post ? '201' : '200']: resourceResonse,
        default: {
          description: 'unexpected error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      };
    };

    const allowedTypes = [ 'array', 'boolean', 'integer', 'number', 'object', 'string' ];

    const makeEntitySchema = (mapping: Mapping<Object>) => {
      const fields = mapping.getFields();
      const scheme: any = {
        required: [],
        properties: {},
      };

      const entityParameters: any = [];

      Object.keys(fields).forEach(property => {
        const field = fields[property];

        if (field.primary) {
          return;
        }

        const required = !field.nullable && !field.defaultTo && !field.generatedValue;
        const swaggerType = allowedTypes.indexOf(field.type) === -1 ? 'string' : field.type;

        if (required) {
          scheme.required.push(property);
        }

        scheme.properties[property] = {
          type: swaggerType,
        };

        entityParameters.push({
          name: property,
          optional: true,
          type: swaggerType,
        });
      });

      queryParameters[mapping.getEntityName()] = makeParameters(entityParameters, 'query');

      return scheme;
    };

    const requestMethodsWithBody = [ RequestMethods.Post, RequestMethods.Put, RequestMethods.Patch ];

    const makePaths = (routes: RegisteredRouteInterface[]) => {
      routes.forEach((route: RegisteredRouteInterface) => {
        const routeKey = routeToSwaggerPath((route as any).route);
        const method = route.method as RequestMethods;
        const schemaKey = ensureSchema(route.controller, route.action, method);
        const tagName = route.controller.name.replace(/Controller$/, '');

        paths[routeKey] = paths[routeKey] || {};

        tags[tagName] = {
          name: tagName,
          description: `Routes for ${tagName}`,
        };

        const path: any = (paths[routeKey][route.method.toLowerCase()] = {});
        const controller = this.controllerManager.get(route.controller) as any;
        const applicableGates = [].concat(Gate.applicableGates(controller, route.action, this.gateConfig.rules));
        const security = applicableGates.reduce((securitySchemes: any, gate: typeof SecurityGate) => {
          if (gate.prototype && gate.prototype instanceof SecurityGate) {
            const key = gate.getConfigKey();

            components.securitySchemes[key] = this.securityConfig.schemes[key].scheme;

            securitySchemes[key] = [];
          }

          return securitySchemes;
        }, {});

        if (Object.keys(security).length) {
          path.security = [security];
        }

        Object.assign(path, {
          tags: [ tagName ],
          description: `${route.action}`,
          operationId: [ route.method, route.controller.name, route.action ].join('_'),
          responses: makeResponses(tagName, schemaKey, method),
        });

        const parameters = [];

        const schema = getFromSchema(route.controller, route.action,'query');

        if (schema) {
          parameters.push(...makeSchemaParameters(joiToOpenApi(schema.schema.isJoi ? schema.schema : Joi.object(schema.schema))));
        } else {
          if (route.action === 'find') {
            try {
              const Entity = getAssociatedEntity(route.controller);

              if (!Entity) {
                return;
              }

              const mapping = this.wetlandService.getMapping(Entity);

              parameters.push(...queryParameters[mapping.getEntityName()]);
            } catch (error) {
              // Lol, ignored!
            }
          }

          if (Array.isArray(route.keys) && route.keys.length) {
            parameters.push(...makeParameters(route.keys));
          }
        }

        if (parameters.length) {
          path.parameters = parameters;
        }

        if (requestMethodsWithBody.indexOf(method) > -1) {
          path.requestBody = makeBody(route.controller, schemaKey);
        }
      });

      return paths;
    };

    const makeSchemaParameters = (schemaObject: any) => {
      return Reflect.ownKeys(schemaObject.properties).map((property: string) => {
        return {
          name: property,
          in: 'query',
          description: property + ' value.',
          required: schemaObject.required.includes(property),
          schema: schemaObject.properties[property],
        };
      });
    };

    const makeParameters = (keys: Key[], availableIn = 'path') => {
      return keys.map((key: Key & { type?: string }) => ({
        name: key.name,
        in: availableIn,
        description: key.name + ' value.',
        required: !key.optional,
        schema: {
          type: key.type || 'string',
        },
      }));
    };

    const gitSumSwag = () => {
      return {
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'Stix API generated swagger docs.',
          description: 'Docs generated with some late-night written hacky garbage code.',
          contact: {
            name: 'RWOverdijk',
            email: 'wesley@spoonx.studio',
            url: 'https://spoonx.studio/',
          },
        },
        tags: Object.values(tags),
        servers: [
          {
            url: this.serverService.getURL(),
          },
        ],
        components,
        paths: makePaths(this.routerService.getRegisteredRoutes()),
      };
    };

    return this.okResponse(gitSumSwag());
  }
}
