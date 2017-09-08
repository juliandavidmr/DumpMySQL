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

	constructor() {
		// console.log("Running...");
	}

	start() {
		this.generateDDL()
	}

	async getConnection(): Promise<any> {
		this.connection = await mysql.createConnection(config.credentials)
	}

	async generateDDL(): Promise<any> {
		await this.getConnection()

		let [rows, fields] = await this.connection.execute(queries.listTables);

		rows = this.normalizeObject(rows)
		rows = this.getOnlyValues(rows)
		const countElementsDB = rows.length  // Include tables & views
		let counter = 0

		// console.log("rows: ", rows);

		// Prepare file
		var wstream = fs.createWriteStream(config.credentials.dest, { encoding: "utf8" });

		// Sentence create db
		wstream.write(`CREATE DATABASE IF NOT EXISTS '${config.credentials.database}';\nUSE '${config.credentials.database}';\n`)

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
							wstream.write(`${ddl};\n\n`)
						})
					} catch (error) {
						if (config.showErrors) {
							console.log(error)
						}

						if (config.exitOnError) {
							process.exit(1)
							return reject(error)
						}
					}

					counter++

					if (counter == countElementsDB) {
						spinner.succeed("Success " + (counter - this.views.length) + " DDL Tables")
						// wstream.end()
						// console.log("Success " + (counter - this.views.length) + " DDL Tables")
						// console.log("Success " + this.views.length + " DDL Views")
						return resolve()
					}
				})
			})
		}

		let generateDDLProcedures = () => {
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
					wstream.write(`${ddlProcedure[0]["Create Procedure"]};\n\n`)
					counter++

					if (counter == proceduresListDDL.length) {
						spinner.succeed("Success " + counter + " DDL Procedures")
						// wstream.end()
						// console.log("Success " + counter + " DDL Procedures");
						return resolve()
					}
				})
			})
		}

		let generateDDLFunctions = () => {
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

					wstream.write(`${ddlProcedure[0]["Create Function"]};\n\n`)
					counter++

					if (counter == functionsListDDL.length) {
						spinner.succeed("Success " + counter + " DDL Functions")
						// wstream.end()
						// console.log("Success " + counter + " DDL Functions");
						return resolve()
					}
				})
			})
		}

		let generateStatementsInserts = () => {
			spinner.start("Loading inserts statements...")
			return new Promise((resolve: Function, reject: Function) => {
				// Generate statements inserts
				counter = 0
				let countInserts = 0
				rows.map(async (table: string): Promise<any> => {
					if (this.views.indexOf(table) == -1) {
						try {
							let [rowsTable, fieldsTable] = await this.connection.execute(queries.selectData(table));
							rowsTable = this.normalizeObject(rowsTable)

							// console.log("ROWS:", rowsTable);
							wstream.write(`-- Inserts ${table}\n`)
							rowsTable.map((dataItem: any, index: number) => {
								let statInsert = queries.createInsert(table, Object.keys(dataItem), this.getOnlyValues(dataItem))
								wstream.write(`${statInsert}\n`)

								spinner.text = "Created insert #" + countInserts++
								// console.log("Insert " + index + ":", statInsert);
							})
						} catch (error) {
							if (config.showErrors) {
								console.log(error)
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
						// wstream.end()
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