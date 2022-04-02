const fs = require("fs")
const zlib = require("zlib")
const nbt = require("nbt")
const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
const request = require('request-promise');
const tokens = require('prismarine-tokens-fixed');  //讀取prismarine-tokens-fixed(驗證緩存)模塊
const vec3 = require('vec3')

const whitelist = config.whitelist

let opt = {
    host: config.ip,
    auth: config.auth,
    username: config.username,
    // tokensLocation: './bot_tokens.json',
    // tokensDebug: true,
    version: "1.18.1"
}

async function connects() {
    tokens.use(opt, function (_err, _opts) {
        if (_err) throw _err

        const bot = mineflayer.createBot(_opts)

        bot.once('spawn', () => {

            let mcData = require('minecraft-data')(bot.version)

            const UserID = bot.username




        })


    })
}