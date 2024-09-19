import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyExpress from '@fastify/express';

import networkRoutes from './src/routes/routes.network.js';
import eventRoutes from './src/routes/routes.events.js';

const app = Fastify();

(async () => {
  // Register plugins
  await app.register(cors, { origin: '*' });
  await app.register(fastifyFormbody);
  await app.register(fastifyExpress); // For middleware compatibility

  // Define the routes, this assumes the routes are in Fastify format.
  app.register((instance, opts, done) => {
    networkRoutes(instance, opts, done);
    done();
  }, { prefix: '/builder' });

  app.register((instance, opts, done) => {
    eventRoutes(instance, opts, done);
    done();
  }, { prefix: '/event' });

  // Start the server
  const port = process.env.BE_SEQUENCER_PORT;
  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    console.log(`Sequencer Started at ${port}`);
  });
})();
