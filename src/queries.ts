let prepareValues = (values: string[]) => {
    return values.map(v => {
        if (v.indexOf('\'') !== -1) {
            v = v.replace('\'', '\\\'')
        }
        return v
    })
    // values.join("','")
}

export default {
    listTables: "SHOW TABLES;",
    showDDLTable: (tableName: string) => `SHOW CREATE TABLE ${tableName}`,
    selectData: (tableName: string) => `SELECT * FROM ${tableName}`,
    createInsert: (tableName: string, columns: string[], values: Array<string>) => `INSERT INTO ${tableName}(${columns.join(",")}) VALUES('${prepareValues(values)}');`,
    showProcedures: () => `SHOW PROCEDURE STATUS`,
    showFunctions: () => `SHOW FUNCTION STATUS`,
    showCreateProcedure: (nameProcedure: string) => `SHOW CREATE PROCEDURE ${nameProcedure}`,
    showCreateFunction: (nameFunction: string) => `SHOW CREATE FUNCTION ${nameFunction}`,
    createDb: (nameDb: string) => `CREATE DATABASE IF NOT EXISTS '${nameDb}';\nUSE '${nameDb}';\n`
}