declare var Promise: any;
declare var require: any;
declare var __dirname: string;
declare var process: any;

import * as mysql from "mysql2/promise";
var fs = require('fs')
import config from "./config";
import queries from "./queries";

export class Dump {

	private connection: any
	private views: Array<string> = []

	constructor() {
		console.log("Running...");
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
		var wstream = fs.createWriteStream('out.sql', { encoding: "utf8" });

		// Sentence create db
		wstream.write(`CREATE DATABASE IF NOT EXISTS '${config.credentials.database}';\nUSE '${config.credentials.database}';\n`)

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
						console.log(error)

						if (config.exitOnError) {
							process.exit(1)
						}
						return reject(error)
					}

					counter++

					if (counter == countElementsDB) {
						// wstream.end()
						console.log("Success DDL!!!");
						return resolve()
					}
				})
			})
		}

		let generateStatementsInserts = () => {
			return new Promise((resolve: Function, reject: Function) => {
				// Generate statements inserts
				counter = 0
				rows.map(async (table: string): Promise<any> => {
					if (this.views.indexOf(table) == -1) {
						try {
							let [rowsTable, fieldsTable] = await this.connection.execute(queries.selectData(table));
							rowsTable = this.normalizeObject(rowsTable)

							// console.log("ROWS:", rowsTable);
							rowsTable.map((dataItem: any, index: number) => {
								let statInsert = queries.createInsert(table, Object.keys(dataItem), this.getOnlyValues(dataItem))
								wstream.write(`${statInsert}\n`)
								// console.log("Insert " + index + ":", statInsert);
							})
						} catch (error) {
							console.log(error)
							if (config.exitOnError) {
								process.exit(1)
							}
							return reject(error)
						}
					}

					counter++

					if (counter == countElementsDB) {
						// wstream.end()
						console.log("Success statements inserts!!!");
						return resolve()
					}
				})
			})
		}

		await generateDDLTablesViews()
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
			return l
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