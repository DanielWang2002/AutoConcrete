const fs = require("fs")
const nbt = require("prismarine-nbt")
const config = require(`${process.cwd()}/config.json`)
const settings = require(`${process.cwd()}/settings.json`)
const mineflayer = require('mineflayer')
const request = require('request-promise');
const tokens = require('prismarine-tokens-fixed');  //讀取prismarine-tokens-fixed(驗證緩存)模塊
const vec3 = require('vec3')
const {pathfinder, Movements, goals: {GoalNear}} = require('mineflayer-pathfinder')

/*TODO: - start 照材料盒順序去拿材料 跑一遍blocks 材料一樣就去該座標放置 如果無任何block為該材料 將身上材料放到特定箱子 重複以上動作
        - 放置方塊: bot.placeEntity(referenceBlock, faceVector)
        - 移動: pathfinder
        - 看能否調整bot移動速度: bot.physics
*/

const whitelist = config.whitelist
let mcData
let palette
let blocks

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

        bot.loadPlugin(pathfinder)

        bot.once('spawn', () => {

            mcData = require('minecraft-data')(bot.version)

        })


        bot.on("message", async function (jsonMsg) {
            console.log(getDateTime() + jsonMsg.toAnsi()) //顯示訊息在黑窗
            if (jsonMsg.toString().includes(`-> 您]`)) {
                let tmp = jsonMsg.toString().split(" ")
                // [ '[DanielWang_', '->', '您]', 'test' ]
                let userID = tmp[0].replace("[", "")
                let msg = tmp[3]
                let NBTFileName

                // 如果長度為4代表指令為stop..etc , 長度為5代表reload mapName
                if (tmp.length == 5) {
                    NBTFileName = tmp[4]
                }

                if (whitelist.includes(userID)) {
                    switch (msg) {

                        case "start":

                            try {

                                await LoadNBTFile('willsmith.nbt')
                                await bot.creative.flyTo(bot.entity.position.plus(new vec3(0, 2, 0)))

                                // [座標相對位置, 材料名稱]
                                let mapart_map = await getItemNameMap(blocks, palette)
                                // 第一個相對位置
                                let previous_pos
                                for (let [i, j] of mapart_map) {
                                    previous_pos = new vec3(i)
                                    break
                                }

                                for (let [i, j] of mapart_map) {
                                    try {
                                        // 材料方塊名稱
                                        let itemname = j.split(':')[1]
                                        // 目前地點
                                        let now_position = bot.entity.position
                                        let new_position = now_position.plus((new vec3(i).minus(previous_pos))).floor()
                                        previous_pos = new vec3(i)

                                        await bot.creative.flyTo(new_position)

                                        // 放置方塊
                                        let PlaceItem = bot.inventory.findInventoryItem(mcData.itemsByName[itemname].id, null, false)
                                        if (PlaceItem != null) {

                                            await bot.equip(PlaceItem, 'hand')

                                            for (let k = 0; k > -3; k--) {
                                                let target_block = bot.blockAt(new_position.minus(new vec3(k, 4, 0)))

                                                let target_block_name = await getMapValue(mapart_map, [i[0] + (-k), i[1], i[2]])

                                                if ((target_block_name === itemname) && (bot.blockAt(target_block.position).name === 'air')) {
                                                    await bot.placeBlock(target_block, new vec3(0, 1, 0))
                                                }
                                            }

                                        }
                                        /*
                                        1.到材料區拿材料盒子內物品(全拿)
                                        2.跑一遍所有座標 放置(包含放置的格子+2格)
                                        3.如果跑完所有座標 身上物品還有 那就拿到指定位置放置(代表是多的)
                                        4.如果沒跑完 身上物品就沒了 代表物品不夠 回去再拿一盒
                                         */
                                    } catch (e) {
                                        cl(e)
                                    }


                                    // await new Promise(r => setTimeout(r, 100))
                                }
                            } catch (err) {
                                console.log(`發生錯誤: ${err}`)
                            }

                        case "stop":

                            break

                        case "throw":
                            // 丟掉身上所有物品
                            for (let item of bot.inventory.items()) {
                                await throwItems(bot, item)
                            }

                            break

                        case "load":

                            await LoadNBTFile(NBTFileName)
                            bot.chat(`/m ${userID} 已載入NBT檔: ${NBTFileName}`)

                            break

                        case "test":
                            bot.chat(`/cgm`)
                            await new Promise(r => setTimeout(r, 500))
                            bot.chat(`/cgm`)

                            break
                    }
                }

            } else if (jsonMsg.toString().startsWith(`[系統] `) &&
                jsonMsg.toString().toLowerCase().includes(`想要你傳送到 該玩家 的位置!`) ||
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

function cl(msg) {
    console.log(getDateTime() + msg)
}

async function getMapValue(map, ar) {
    for (let [i, k] of map) {
        if ((i[0] === ar[0]) && (i[1] === ar[1]) && (i[2] === ar[2])) {
            return map.get(i).toString().split(":")[1]
        }
    }
}

async function takeMaterial(bot, material_name) {

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

async function throwItems(bot, item) {
    await bot.toss(item.type, item.metadata, item.count)
}

async function LoadNBTFile(FileName) {
    const f = await fs.readFileSync(FileName)
    const {parsed, type} = await nbt.parse(f, 'big')
    blocks = parsed.value.blocks.value.value
    palette = parsed.value.palette.value.value
}

// 回傳相對座標+物品名稱的Map
async function getItemNameMap(blocks, palette) {

    let Position_ItemName = new Map()

    let item_name = []

    for (let item of palette) {
        item_name.push(item.Name.value)
    }

    for (let i = 0; i < parseInt(blocks.length) - 1; i++) {
        Position_ItemName.set(blocks[i].pos.value.value, item_name[blocks[i].state.value])
    }

    return Position_ItemName

}

connects()