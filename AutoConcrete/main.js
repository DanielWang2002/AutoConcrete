const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
const vec3 = require('vec3')
const tokens = require("prismarine-tokens-fixed");

const whitelist = config.whitelist
const place_block_delay = settings.Place_Block_Delay
let mcData
let STOP = false

let opt = {
    host: config.ip,
    auth: config.auth,
    username: config.username,
    version: "1.18.1"
}

async function connects() {
    tokens.use(opt, function (_err, _opts) {
        if (_err) throw _err

        const bot = mineflayer.createBot(_opts)

        bot.once('spawn', async () => {
            mcData = require('minecraft-data')(bot.version)
        })
        bot.on("message", async function (jsonMsg) {

            cl(jsonMsg.toAnsi())

            if (jsonMsg.toString().includes(`-> 您]`)) {
                let tmp = jsonMsg.toString().split(" ")
                // [ '[DanielWang_', '->', '您]', 'test' ]
                let userID = tmp[0].replace("[", "")
                let msg = tmp[3]

                if (whitelist.includes(userID)) {

                    switch (msg) {

                        case "start":

                            STOP = false

                            bot.chat(`/m ${userID} 已開始放置混凝土 放置間隔為 ${place_block_delay / 1000} 秒`)

                            while (!STOP) {


                                // 在bot身上搜尋是否有混凝土粉末
                                let Concrete_type = null

                                for (const item of bot.inventory.items()) {
                                    if (item.name.includes('concrete_powder')) {
                                        Concrete_type = item.type
                                        break
                                    }
                                }

                                if (Concrete_type != null) {

                                    // 將粉末拿在手上
                                    await bot.equip(Concrete_type, 'hand')

                                    // 放置方塊
                                    const pbp = settings.Place_Block_Position
                                    const target_block = bot.blockAt(new vec3(pbp[0], pbp[1], pbp[2]))
                                    if (target_block.name === 'air' || target_block.name === 'water') await bot.placeBlock(bot.blockAt(target_block.position.minus(new vec3(0, 1, 0))), new vec3(0, 1, 0))
                                }

                                await sleep(place_block_delay)

                            }

                            break

                        case "stop":
                            bot.chat(`/m ${userID} 已停止放置混凝土`)
                            STOP = true
                            break

                        case "throw":

                            for (let item of bot.inventory.items()) {
                                await throwItems(bot, item)
                            }

                            break
                    }

                }

            }

            if (jsonMsg.toString().startsWith(`[系統] `) &&
                jsonMsg.toString().toLowerCase().includes(`想要你傳送到 該玩家 的位置`) ||
                jsonMsg.toString().toLowerCase().includes(`想要傳送到 你 的位置`)) {
                let msg = jsonMsg.toString().split(/ +/g);
                let playerid = msg[1]

                if (whitelist.includes(playerid)) {
                    bot.chat(`/tok`)
                } else {
                    bot.chat(`/tno`)
                }

            }

        })


        bot.on('kicked', console.log)
        bot.on('error', console.log)
        bot.on('end', () => {
            console.log(getDateTime())
            console.log(`連線中斷，將在5秒後嘗試重新連接伺服器！`)
            setTimeout(function () {
                connects();
            }, 5000)
        })

    })

}

async function takeConcrete(bot) {

    try {

        const chest = bot.blockAt(new vec3("1752", "64", "8967"))

        const openChest = await bot.openChest(chest)

        let Concrete_count = 0
        let Concrete_type
        let Concrete_Name

        for (let item of openChest.containerItems()) {

            Concrete_count += item.count
            Concrete_type = item.type

        }

        await openChest.withdraw(Concrete_type, null, Concrete_count)
        await openChest.close()
        cl(`已拿取 空蛋x${Concrete_count}`)

    } catch (error) {
        cl(`拿取混凝土粉末時發生錯誤: ${error}`)
    }

}

async function throwItems(bot, item) {
    try {
        await bot.toss(item.type, item.metadata, item.count)
    } catch (error) {
        cl(`丟棄身上物品時發生錯誤: ${error}`)
    }
}

function cl(msg) {
    console.log(getDateTime() + " " + msg)
}

async function sleep(ms) {
    await new Promise(r => setTimeout(r, ms))
}

function getDateTime() {

    let date = new Date();

    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    let year = date.getFullYear();

    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return "@" + year + "/" + month + "/" + day + " " + hour + ":" + min + ":" + sec;

}

connects()