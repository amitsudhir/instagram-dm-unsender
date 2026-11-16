/** Bundle the source modules into a valid userscript. */

import fs from "fs"
import nodeResolve from "@rollup/plugin-node-resolve"

export default {
	input: "./src/runtime/userscript/main.js",
	output: {
		file: "./dist/instagram-dm-unsender.user.js",
		format: "iife",
		name: "InstagramDMUnsender",
		sourcemap: false
	},
	plugins: [
		{
			buildStart(){
				this.addWatchFile("./data/meta.json")
			},
			banner: () => {
				const metadata = JSON.parse(fs.readFileSync("./data/meta.json"))
				metadata.version = JSON.parse(fs.readFileSync("./package.json")).version
				let str = "// ==UserScript==\n"
				for(const property in metadata) {
					str += `\n// @${property}\t\t\t\t${metadata[property]}`
				}
				str += "\n\n// ==/UserScript==\n\n"
				return str
			}
		},
		nodeResolve(),
	]
}
