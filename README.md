# jsexector

A Node.js code executor with HTTP API, designed to run code in isolated environments and return generated files via URLs.

## Features

- **HTTP API**: Execute code via POST requests
- **Isolated Environment**: Each task runs in a separate directory
- **Dependency Management**: Automatically install required libraries
- **File Management**: Generate files and return accessible URLs
- **Task Organization**: Tasks are organized by year/month/day folders
- **Security**: Token-based authentication, execution time limits, and memory limits
- **Docker Support**: Containerized deployment

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Docker (optional for containerized deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/visolleon/jsexecutor.git
   cd jsexecutor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

The application can be configured via environment variables:

- `API_TOKEN`: Authentication token (default: `your-default-token`)
- `FILE_URL_PREFIX`: Prefix for file URLs (default: `http://localhost:3001`)
- `SERVER_HOST`: Server hostname (default: `localhost`)
- `SERVER_PORT`: Server port (default: `3001`)
- `REQUEST_BODY_LIMIT`: Request body size limit (default: `256kb`)
- `NODE_ENV`: Environment mode (default: `development`)

### Usage

#### Running the Server

```bash
# Start the server
npm start

# Or with custom environment variables
API_TOKEN=your-secret-token FILE_URL_PREFIX=http://your-domain.com npm start
```

#### Using the API

Send a POST request to `/execute` with the following JSON payload:

```json
{
  "code": "const fs = require('fs'); fs.writeFileSync('output.txt', 'Hello World');",
  "libraries": ["lodash"]
}
```

Include the `Authorization` header with your token:

```
Authorization: Bearer your-token
```

#### Example Response

```json
{
  "taskId": "adeee4df-a70b-4bfe-95e6-546eae2378d2",
  "files": [
    {
      "filename": "output.txt",
      "url": "http://localhost:3001/tasks/2026/04/22/adeee4df-a70b-4bfe-95e6-546eae2378d2/output.txt"
    }
  ]
}
```

## Docker Deployment

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# Stop the service
docker-compose down
```

### Using Makefile

```bash
# Build the Docker image
make build

# Run the container
make run

# Stop the container
make stop

# Push the image to Docker Hub
make tag
make push
```

## Project Structure

```
jsexector/
├── server.js          # Main server file
├── package.json       # Project configuration
├── Dockerfile         # Docker build file
├── docker-compose.yml # Docker Compose configuration
├── Makefile           # Make commands
└── tasks/             # Task files (auto-generated)
```

## Security

- **Token Authentication**: All API requests require a valid token
- **Execution Limits**: Code runs with time and memory limits
- **Dependency Filtering**: Restricts dangerous packages
- **Isolated Environment**: Each task runs in a separate directory

## License

MIT
