# ![Stix swagger](./stix-swagger.svg)

[![Slack Status](https://spoonx-slack.herokuapp.com/badge.svg)](https://spoonx-slack.herokuapp.com)


A first stab at a [stix](https://github.com/SpoonX/stix) module that generates swagger docs based on your stix app.

## todo

- Optional fields for Update model (all required are still required)
- Add query options as parameters (sort, limit, offset, etc)
- Get actual error format from ResponseService (fake a response to get layout)
- Create config for default swagger doc values.
- Allow for additional meta to be provided (decorator, or last arg on the route)
- Implement authentication types
- SwaggerMeta.compose(Entity, { auth: 'jwt' })
- Add link to stix-wetland docs explaining querying options
- Allow for fields to be marked as optional (createdAt and the likes)
- Add link on starting server. "api available here, docs available here"
- https://github.com/swagger-api/swagger-ui/blob/master/docs/usage/installation.md

## License

MIT.
