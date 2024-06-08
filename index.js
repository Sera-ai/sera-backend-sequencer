const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const build = require('./src/routes/routes.build');
const analytics = require('./src/routes/routes.analytics');

const app = express();
const http = require('http');
const server = http.createServer(app);

app.use(cors(), express.json(), bodyParser.urlencoded({ extended: true }), bodyParser.json());

app.use('/analytics', analytics);
app.use('/builder', build);

server.listen(process.env.BE_SEQUENCER_PORT, () => {
    console.log(`Sequencer Started at ${process.env.BE_SEQUENCER_PORT}`);
});
