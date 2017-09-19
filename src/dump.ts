declare var Promise: any;
declare var require: any;
declare var __dirname: string;
declare var process: any;

import * as mysql from "mysql2/promise"
var fs = require('fs')
import config from "./config"
import queries from "./queries"
const ora = require('ora');
const spinner = ora('Loading database...').start();

export class Dump {

	private connection: any
	private views: Array<string> = []
	private wstream: any

	constructor() {
		// console.log("Running...");
	}

	start() {
		this.generateDDL()
	}

	private async getConnection(): Promise<any> {
		this.connection = await mysql.createConnection(config.credentials)
	}

	private createFile() {
		// Prepare file
		this.wstream = fs.createWriteStream(config.credentials.dest, { encoding: "utf8" });
	}

	private async generateDDL(): Promise<any> {
		await this.getConnection()

		let [rows, fields] = await this.connection.execute(queries.listTables);

		rows = this.normalizeObject(rows)
		rows = this.getOnlyValues(rows)
		const countElementsDB = rows.length  // Include tables & views
		let counter = 0

		// console.log("rows: ", rows);

		this.createFile()

		// Sentence create db
		this.wstream.write(queries.createDb(config.credentials.database))

		spinner.text = 'Loading DDL Tables'

		let generateDDLTablesViews = (): Promise<any> => {
			return new Promise((resolve: Function, reject: Function) => {
				// Generate ddl tables, views
				rows.map(async (table: string): Promise<any> => {
					try {
						let [rowsddl] = await this.connection.execute(queries.showDDLTable(table));
						rowsddl = this.normalizeObject(rowsddl)
						this.fillOnlyViews(rowsddl)
						rowsddl = this.getDDLItems(rowsddl)
						rowsddl.map((ddl: string) => {
							this.wstream.write(`${ddl};\n\n`)
						})
					} catch (error) {
						if (config.showErrors) {
							console.error(error)
						}

						if (config.exitOnError) {
							process.exit(1)
							return reject(error)
						}
					}

					counter++

					if (counter == countElementsDB) {
						spinner.succeed("Success " + (counter - this.views.length) + " DDL Tables")
						// this.wstream.end()
						// console.log("Success " + (counter - this.views.length) + " DDL Tables")
						// console.log("Success " + this.views.length + " DDL Views")
						return resolve()
					}
				})
			})
		}

		let generateDDLProcedures = (): Promise<any> => {
			spinner.start("Loading procedures...")

			return new Promise(async (resolve: Function, reject: Function): Promise<any> => {
				// Generate statements inserts
				counter = 0
				let [rowsProcedures] = await this.connection.execute(queries.showProcedures());
				rowsProcedures = this.normalizeObject(rowsProcedures)

				let proceduresListDDL: Array<string> = []

				rowsProcedures.map((it: any) => {
					if (it["Db"] == config.credentials.database) { // only database actual
						proceduresListDDL.push(it["Name"])
					}
				})

				// console.log("Procedures:", proceduresListDDL);
				proceduresListDDL.map(async (prc): Promise<any> => {
					let [ddlProcedure] = await this.connection.execute(queries.showCreateProcedure(prc));
					ddlProcedure = this.normalizeObject(ddlProcedure)
					// console.log("DDL PR: ", ddlProcedure[0]["Create Procedure"])		
					this.wstream.write(`${ddlProcedure[0]["Create Procedure"]};\n\n`)
					counter++

					if (counter == proceduresListDDL.length) {
						spinner.succeed("Success " + counter + " DDL Procedures")
						// this.wstream.end()
						// console.log("Success " + counter + " DDL Procedures");
						return resolve()
					}
				})
			})
		}

		let generateDDLFunctions = (): Promise<any> => {
			spinner.start("Loading functions...")

			return new Promise(async (resolve: Function, reject: Function): Promise<any> => {
				// Generate statements inserts
				counter = 0
				let [rowsFunctions] = await this.connection.execute(queries.showFunctions());
				rowsFunctions = this.normalizeObject(rowsFunctions)

				let functionsListDDL: Array<string> = []

				// console.log("Functions:", rowsFunctions);

				rowsFunctions.map((it: any) => {
					if (it["Db"] == config.credentials.database) { // only database actual
						functionsListDDL.push(it["Name"])
					}
				})

				functionsListDDL.map(async (fun): Promise<any> => {
					// console.log("NAME procedure: ", fun);

					let [ddlProcedure] = await this.connection.execute(queries.showCreateFunction(fun));
					ddlProcedure = this.normalizeObject(ddlProcedure)
					// console.log("DDL FN: ", ddlProcedure)	

					this.wstream.write(`${ddlProcedure[0]["Create Function"]};\n\n`)
					counter++

					if (counter == functionsListDDL.length) {
						spinner.succeed("Success " + counter + " DDL Functions")
						// this.wstream.end()
						// console.log("Success " + counter + " DDL Functions");
						return resolve()
					}
				})
			})
		}

		let generateStatementsInserts = (): Promise<any> => {
			spinner.start("Loading inserts statements...")
			return new Promise((resolve: Function, reject: Function) => {
				// Generate statements inserts
				counter = 0
				let countInserts = 0
				rows.map(async (table: string): Promise<any> => {
					if (this.views.indexOf(table) == -1) {
						try {
							// console.log(`Prepare table ${table}`);

							let [rowsTable] = await this.connection.execute(queries.selectData(table));
							rowsTable = this.normalizeObject(rowsTable) as Array<any>

							// console.log("ROWS:", rowsTable);
							this.wstream.write(`-- Inserts ${table}\n`)

							rowsTable.map((dataItem: any) => {
								let columns = Object.keys(dataItem)
								let values = this.getOnlyValues(dataItem)

								for (var v in values) {
									if (v.indexOf('\'') !== -1) {
										v = v.replace('\'', '\\\'');
									}
								}

								if (Array.isArray(columns) && Array.isArray(values)) {
									let statementInsert = "INSERT INTO " + table + "(" + columns.join(",") + ") VALUES('" + values.join('\',\'') + "');";
									// let statementInsert = queries.createInsert(table, columns, values)
									// console.log(">", statementInsert)

									this.wstream.write(`${statementInsert}\n`)

									spinner.text = "Created insert #" + countInserts++
									// console.log("Insert " + index + ":", statementInsert);
								}
							})
						} catch (error) {
							if (config.showErrors) {
								console.error(error)
							}

							if (config.exitOnError) {
								process.exit(1)

								return reject(error)
							}
						}
					}

					counter++

					if (counter == countElementsDB) {
						spinner.succeed("Success " + countInserts + " statements inserts")
						// this.wstream.end()
						// console.log("Success statements inserts");
						return resolve()
					}
				})
			})
		}

		await generateDDLTablesViews()
		await generateDDLProcedures()
		await generateDDLFunctions()
		await generateStatementsInserts()
	}

	fillOnlyViews(arg0: any[]): void {
		arg0.map(x => {
			if (x.View) {
				this.views.push(x.View)
			}
		})
	}

	private getDDLItems(items: any[]): string[] {
		return items.map(it => it["Create Table"] || it["Create View"])
	}

	private normalizeObject(objMysql: any): any {
		return JSON.parse(JSON.stringify(objMysql))
	}

	private getOnlyValues(list: any) {
		let l: string[] = []
		if (Array.isArray(list)) {
			list.map(it => {
				for (var key in it) {
					if (it.hasOwnProperty(key)) {
						l.push(it[key])
					}
				}
			})
		} else if (typeof list === 'object') {
			for (var key in list) {
				if (list.hasOwnProperty(key)) {
					var element = list[key];
					l.push(element)
				}
			}
		}
		return l
	}
}