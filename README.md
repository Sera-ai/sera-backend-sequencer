
# Sera Backend Sequencer

![Node.js](https://img.shields.io/badge/Node.js-Fastify-green?logo=node.js) ![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)

## Overview

Welcome to the **Sera Backend Sequencer** repository. This project is a Fastify Node.js server designed to handle backend sequencing tasks efficiently. The repository includes Docker support and GitHub Actions workflows for CI/CD.

## Table of Contents

- [Sera Backend Sequencer](#sera-backend-sequencer)
  - [Overview](#overview)
  - [Features](#features)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [Running the Server](#running-the-server)
    - [Docker Setup](#docker-setup)
  - [Project Structure](#project-structure)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- Fastify for fast and low overhead web server.
- Modular route and helper structure.
- Docker support for containerized deployment.
- GitHub Actions for continuous integration and deployment.
- WebSocket for real-time communication.

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/get-started)
- [Git](https://git-scm.com/)

### Setup

1. **Clone the repository**:
    ```sh
    git clone https://github.com/Sera-ai/sera-backend-sequencer.git
    cd sera-backend-sequencer
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

### Running the Server

1. **Start the development server**:
    ```sh
    npm run dev
    ```

2. Open your browser and navigate to `http://localhost:3000` to see the application running.

### Docker Setup

1. **Build the Docker image**:
    ```sh
    docker build -t sera-backend-sequencer .
    ```

2. **Run the Docker container**:
    ```sh
    docker run -p 3000:3000 sera-backend-sequencer
    ```

3. Open your browser and navigate to `http://localhost:3000` to see the application running.

## Project Structure

    sera-backend-sequencer/
    │ .gitignore
    │ Dockerfile
    │ index.js
    │ nodemon.json
    │ package.json
    ├───.github/
    │ └───workflows/
    │ └───docker-build.yml
    └───src/
    ├───helpers/
    │ ├───helpers.database.js
    │ ├───helpers.learning.js
    │ └───helpers.sequence.js
    ├───routes/
    │ ├───routes.events.js
    │ └───routes.network.js
    ├───scripts/
    │ ├───scripts.js.eventNode.js
    │ └───scripts.lua.apinode.js
    └───templates/
    ├───main.js.template
    └───main.lua.template

- **.github/workflows/**: GitHub Actions workflows for CI/CD.
- **src/helpers/**: Helper functions for database, learning, and sequencing-related tasks.
- **src/routes/**: Route handlers for events and network.
- **src/scripts/**: Scripts for handling specific tasks.
- **src/templates/**: Template files for JavaScript and Lua.
