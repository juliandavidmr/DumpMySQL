export default {
    listTables: "SHOW TABLES;",
    showDDLTable: (tableName: string) => `SHOW CREATE TABLE ${tableName}`,
    selectData: (tableName: string) => `SELECT * FROM ${tableName}`,
    createInsert: (tableName: string, columns: string[], values: Array<string | number>) => `INSERT INTO ${tableName}('${columns.join("','")}') VALUES('${values.join("','")}');`
}