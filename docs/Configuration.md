# Configuration
This file provides information about all configuration available for slotlist-backend.

## Config values
All configuration is handled via environment variables, a full list can be found in the `dev.env` file in the root of the repository.

| Variable | Description | Default |
|---|---|---|
| CONFIG_DATABASE_HOST | Hostname of PostgreSQL database | db |
| CONFIG_DATABASE_PORT | Port of PostgreSQL database | 5432 |
| CONFIG_DATABASE_DATABASE | Name of database to use | slotlist-backend |
| CONFIG_DATABASE_USERNAME | Username for PostgreSQL authentication | slotlist-backend |
| CONFIG_DATABASE_PASSWORD | Password for PostgreSQL authentication | slotlist-backend |
| CONFIG_HTTP_ADDRESS | IP address to bind HTTP server to | 0.0.0.0 |
| CONFIG_HTTP_HOST | Hostname for HTTP server to listen for | localhost |
| CONFIG_HTTP_PORT | Port to bind HTTP server to | 3000 |
| CONFIG_HTTP_SCHEME | Local HTTP/HTTPS binding for server | http |
| CONFIG_HTTP_OPSINTERVAL | Interval in milliseconds for reporting stats | 900000 |
| CONFIG_HTTP_PUBLICSCHEME | Public HTTP/HTTPS binding for server | http |
| CONFIG_HTTP_PUBLICHOST | Publically accessible address of server | localhost:3000 |
| CONFIG_JWT_ALGORITHMS | List of algorithms to assign for JWT signing | HS256 |
| CONFIG_JWT_AUDIENCE | Target audience for JWTs | http://localhost:4000 |
| CONFIG_JWT_EXPIRESIN | Expiration duration for JWTs | 3d |
| CONFIG_JWT_ISSUER | Issuer for JWTs | http://localhost:4000 |
| CONFIG_JWT_SECRET | Secret used for signing JWTs | supersecret |
| CONFIG_LOGGING_FILES_0_PATH | Path of log file | logs/slotlist-backend.log |
| CONFIG_LOGGING_FILES_0_LEVEL | Bunyan log level for log file | debug |
| CONFIG_LOGGING_SRC | Enables logging of source line | true |
| CONFIG_LOGGING_STDOUT | Bunyan log level for stdout | debug |
| CONFIG_LOGGING_STACKDRIVER | Enables logging to Stackdriver | false |
| CONFIG_STEAM_OPENID_CALLBACKURL | Callback URL for Steam OpenID | http://localhost:4000/login |
| CONFIG_STEAM_OPENID_REALM | Address to use as OpenID realm | http://localhost:4000 |
| CONFIG_STEAM_API_SECRET | API secret for Steam OpenID |   |
| CONFIG_STORAGE_BUCKETNAME | Name of GCP storage bucket |   |
| CONFIG_STORAGE_PROJECTID | Name/ID of GCP project |   |
| CONFIG_STORAGE_KEYFILENAME | Path to GCP credentials file | /credentials/credentials.json |
| DEFAULT_ADMIN_UID | UUIDv4 of default admin user |   |
| DEFAULT_ADMIN_STEAMID | Steam ID of default admin user |   |
| DEFAULT_ADMIN_NICKNAME | Nickname of default admin user |   |
| NODE_ENV | Environment for app to run in | development |
| SENTRY_DSN | DSN for Sentry reporting |   |

### Logging configuration
slotlist-backend uses [bunyan](https://github.com/trentm/node-bunyan) to generate structured logs, which can easily be fed to e.g. elasticsearch or any other log processing and parsing software. Thus, all logs will be in JSON and will be printed to `stdout` by default.  
Using `CONFIG_LOGGING_STDOUT`, you can define the log level for standard output logging - you can create one or multiple log files by defining environment variables in the format of `CONFIG_LOGGING_FILES_X_PATH` and `CONFIG_LOGGING_FILES_X_LEVEL`, where `X` would be a number starting from 0.  
For example, you could define one logfile only containing `error` and `fatal` messages as well as a second one that contains all `debug` and above:
```sh
CONFIG_LOGGING_FILES_0_PATH=logs/slotlist-backend-error.log
CONFIG_LOGGING_FILES_0_LEVEL=error
CONFIG_LOGGING_FILES_1_PATH=logs/slotlist-backend-debug.log
CONFIG_LOGGING_FILES_1_LEVEL=debug
```

### Steam OpenID configuration
slotlist-backend uses the [Steam OpenID provider](https://steamcommunity.com/dev) as an authentication source. You can find more information about Steam OpenID [here](https://steamcommunity.com/dev).  
In order to run slotlist-backend, you will need to generate an API key [by filling out this form](http://steamcommunity.com/dev/apikey). The API key is required to access the Steam API and fetch the authenticated user's public profile information. Note that the provided domain name does not necessarily have to match your public hostname for the slotlist project.