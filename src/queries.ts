export default {
    listTables: "SHOW TABLES;",
    showDDLTable: (tableName: string) => `SHOW CREATE TABLE ${tableName}`,
    selectData: (tableName: string) => `SELECT * FROM ${tableName}`,
    createInsert: (tableName: string, columns: string[], values: Array<string | number>) => `INSERT INTO ${tableName}('${columns.join("','")}') VALUES('${values.join("','")}');`,
    showProcedures: () => `SHOW PROCEDURE STATUS`,
    showFunctions: () => `SHOW FUNCTION STATUS`,
    showCreateProcedure: (nameProcedure: string) => `SHOW CREATE PROCEDURE ${nameProcedure}`,
    showCreateFunction: (nameFunction: string) => `SHOW CREATE FUNCTION ${nameFunction}`
}