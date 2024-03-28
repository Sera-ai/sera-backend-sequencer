const crypto = require("crypto");

// Function to generate a unique key for each request based on host, path, and method
const generateRequestKey = (host, path, method) => `${host}:${path}:${method}`;

// Function to hash response data for comparison
const hashResponseData = (responseData) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(responseData))
    .digest("hex");

// Update request metrics stored in Redis
const updateRequestMetrics = async (host, path, method, responseData) => {
  const key = generateRequestKey(host, path, method);
  const responseHash = hashResponseData(responseData);
  const metricsKey = `metrics:${key}`;
  const responseKey = `response:${key}`;

  // Check if this request hash matches the previous one stored in Redis
  const lastResponseHash = await redis.get(responseKey);
  if (lastResponseHash !== responseHash) {
    await redis.set(responseKey, responseHash, "EX", 60); // Reset response hash with a TTL of 60 seconds
    await redis.set(metricsKey, "0", "EX", 10); // Reset metrics counter with a TTL of 10 seconds
  }

  // Increment request count
  const count = await redis.incr(metricsKey);

  return {
    count,
    responseHash: lastResponseHash === responseHash ? responseHash : null,
  };
};

// Decide cache TTL based on updated metrics from Redis
const decideCacheTTL = ({ count, responseHash }) => {
  const rps = count / 10; // Assuming metrics are reset every 10 seconds

  if (rps > 1 && responseHash) {
    return 10; // 10 seconds TTL for high RPS with identical responses
  } else if (rps > 0.01 && responseHash) {
    return 30; // 30 seconds TTL for moderate RPS with identical responses
  }
  return 0; // No caching
};

const cachingMiddleware = async (req, res, next) => {
  const { host, path, method } = req;
  const cacheKey = `cache:${generateRequestKey(host, path, method)}`;

  // Attempt to get cached response
  const cachedResponse = await redis.get(cacheKey);
  if (cachedResponse) {
    console.log(`Serving from cache: ${cacheKey}`);
    return res.send(JSON.parse(cachedResponse));
  }

  // Save original res.send
  const originalSend = res.send.bind(res);

  // Monkey patch res.send to capture response data
  res.send = async (responseData) => {
    // Perform caching operations
    const metrics = await updateRequestMetrics(
      host,
      path,
      method,
      responseData
    );
    const ttl = decideCacheTTL(metrics);

    if (ttl > 0) {
      console.log(`Caching response with TTL of ${ttl} seconds`);
      await redis.set(cacheKey, JSON.stringify(responseData), "EX", ttl);
    }

    // Call the original res.send
    originalSend(responseData);
  };

  next(); // proceed to the next middleware/route handler
};


module.exports = {
    updateRequestMetrics,
    decideCacheTTL,
    cachingMiddleware
  };