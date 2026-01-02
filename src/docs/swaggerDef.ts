import { SwaggerDefinition } from 'swagger-jsdoc';
import config from '../config/config';

const swaggerDef: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'PulseBoard API documentation',
    version: '1.0.0',
    license: {
      name: 'MIT',
      url: 'https://github.com/dawitYenew12/pulseBoard/blob/main/LICENSE',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/api/v1`,
    },
  ],
};

export default swaggerDef;
