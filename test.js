require("dotenv").config();
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fastifyFormbody = require("@fastify/formbody");

const app = Fastify();

(async () => {

    // Register plugins
    await app.register(cors, { origin: "*" });
    await app.register(fastifyFormbody);
    await app.register(require('@fastify/express')); // for socket.io compatibility



    app.get('/', function (request, reply) {
        reply.send({ hello: 'world' })
    })


    app.listen({ port: 3030, host: '0.0.0.0' }, (err) => {
        if (err) {
            app.log.error(err);
            process.exit(1);
        }
        console.log(`Socket server started at ${3030}`);
    });
})();
