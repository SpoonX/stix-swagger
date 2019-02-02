export type SwaggerConfigType = Partial<{
  defaultSecurityScheme: string;
  paths: PathsType;
  security: SecurityType;
  securitySchemes: {
    [schemeKey: string]: HttpType | ApiKeyType | OpenIDType | OAuth2Type;
  };
}>;

export type SecurityType = { [schemeKey: string]: string[] };

export type PathsType = {
  [route: string]: {
    [method: string]: PathType;
  };
};

export type PathType = Partial<{
  summary: string;
  description: string;
  security: SecurityType;
  responses: ResponseType[];
  parameters: ParameterType[];
  tags: string[];
  operationId: string;
}>;

export type TypesType = 'string' | 'integer' | 'object' | 'array';

export type ParameterType = Partial<{
  in: 'path' | 'query' | 'header' | 'cookie';
  name: string;
  allowEmptyValue: boolean;
  schema: Partial<{
    type: TypesType;
    enum: string[] | number[];
    format: any;
    nullable: boolean;
    minimum: number;
    properties: {
      [key: string]: {
        type: TypesType;
      };
    };
    items: {
      type: TypesType;
    };
    maximum: number;
    default: any;
  }>;
  explode: boolean;
  style: 'simple' | 'label' | 'matrix' | 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  examples: {
    [exampleKey: string]: Partial<{
      summary: string;
      value: any;
    }>;
  };
  required: boolean;
  description: string;
}>;

export type ResponseType = {
  [statusCode: string]: {
    description: string;
  };
};

export type HttpType = {
  type: 'http';
  scheme: 'bearer' | 'basic';
};

export type ApiKeyType = {
  type: 'apiKey';
  in: 'header' | 'query' | 'cookie';
  name: string;
};

export type OpenIDType = {
  type: 'openIdConnect';
  openIdConnectUrl: string;
};

export type OAuth2Type = {
  type: 'oauth2';
  flows: any;
};
