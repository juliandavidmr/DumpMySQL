# DumpMySQL

Generate backup DDL from MySQL database.

- [x] Create database if not exits
- [x] Generate DDL tables, views, functions, procedures.
- [x] Generate statements inserts
- [x] Show loading
- [x] Typescript

## Usage
```bash
git clone https://github.com/juliandavidmr/DumpMySQL.git
cd DumpMySQL
npm install    # yarn
npm start      # yarn start

# Generate full ddl
# √ Success 389 DDL Tables
# √ Success 13 DDL Procedures
# √ Success 1 DDL Functions
# √ Success 527397 Inserts
```
> Configure [config.ts](./src/config.ts) file for credentials db

License MIT

_juliandavidmr_