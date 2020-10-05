import Relay from "./client.mjs"
import fetch from "node-fetch"
import WebSocket from "ws"
/*
let fetch = require("node-fetch")
let WebSocket = require("ws")
*/

let relay = new Relay(fetch, WebSocket)
export default relay