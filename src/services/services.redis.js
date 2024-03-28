const Redis = require("ioredis");
const redis = new Redis({
  host: "redis", // Use 'redis' as the hostname to connect to the Redis service
  port: 6379,
});

module.exports = redis;
