require("dotenv").config();
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fastifyFormbody = require("@fastify/formbody");

const networkRoutes = require("./src/routes/routes.network");
const eventRoutes = require("./src/routes/routes.events");

const app = Fastify();

(async () => {
  // Register plugins
  await app.register(cors, { origin: "*" });
  await app.register(fastifyFormbody);
  await app.register(require('@fastify/express')); // For middleware compatibility

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
