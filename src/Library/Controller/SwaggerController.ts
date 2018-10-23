import procurator from 'procurator';
import {
  AbstractActionController,
  Config,
  inject,
  RegisteredRouteInterface,
  RequestMethods,
  RouterService,
  ServerService,
} from 'stix';
import { Mapping } from 'wetland';
import { Key } from 'path-to-regexp';
import { getAssociatedEntity, WetlandService } from 'stix-wetland';
import * as path from 'path';
import * as fs from 'fs';

export class SwaggerController extends AbstractActionController {
  @inject(RouterService)
  private routerService: RouterService;

  @inject(WetlandService)
  private wetlandService: WetlandService;

  @inject(Config)
  private config: Config;

  @inject(ServerService)
  private serverService: ServerService;

  public async ui () {
    const ui = fs
      .createReadStream(path.resolve(__dirname, '..', '..', '..', 'static', 'index.html'))
      .pipe(procurator({ url: this.serverService.getURL() + 'swagger/doc' }, false));

    return this.okResponse({}).html(ui);
  }

  public async doc () {
    const queryParameters: any = {};
    const paths: { [key: string]: any } = {};
    const tags: any = {};
    const components = {
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

    const ensureSchema = (controller: any, method: RequestMethods) => {
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
      return {
        description: 'Data model for ' + controller.name,
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/' + schemaKey,
            },
          },
        },
      };
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
        const schemaKey = ensureSchema(route.controller, method);
        const tagName = route.controller.name.replace(/Controller$/, '');

        paths[routeKey] = paths[routeKey] || {};

        tags[tagName] = {
          name: tagName,
          description: `Routes for ${tagName}`,
        };

        const path: any = (paths[routeKey][route.method.toLowerCase()] = {});

        Object.assign(path, {
          tags: [ tagName ],
          description: `${route.action}`,
          operationId: [ route.method, route.controller.name, route.action ].join('_'),
          responses: makeResponses(tagName, schemaKey, method),
        });

        const parameters = [];

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

        if (parameters.length) {
          path.parameters = parameters;
        }

        if (requestMethodsWithBody.indexOf(method) > -1) {
          path.requestBody = makeBody(route.controller, schemaKey);
        }
      });

      return paths;
    };

    const makeParameters = (keys: Key[], availableIn = 'path') => {
      return keys.map((key: Key & { type?: string }) => ({
        name: key.name,
        in: availableIn,
        description: key.name + ' value.',
        required: !key.optional,
        schema: {
          type: key.type || (/(Id|_id|^id)$/.test(key.name as string) ? 'integer' : 'string'),
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
            url: 'http://localhost:' + this.config.of<any>('server').port,
          },
        ],
        components,
        paths: makePaths(this.routerService.getRegisteredRoutes()),
      };
    };

    return this.okResponse(gitSumSwag());
  }
}
