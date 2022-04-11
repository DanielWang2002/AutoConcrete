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
let took_item
let isEnd = false
let original_position // start的地點
let hasDisconnected = false

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

                                original_position = bot.entity.position
                                // await bot.creative.flyTo(bot.entity.position.plus(new vec3(0, 2, 0)))
                                await bot.creative.startFlying()


                                // [座標相對位置, 材料名稱]
                                let mapart_map = await getItemNameMap(blocks, palette)
                                // 第一個相對位置
                                let previous_pos
                                for (let [i, j] of mapart_map) {
                                    previous_pos = new vec3(i)
                                    break
                                }


                                // 拿材料
                                await bot.chat(`/warp ${settings.Material_Warp}`)
                                // 等待10秒 避免網路不好的情況導致延遲
                                await new Promise(r => setTimeout(r, 5000))
                                await takeMaterial(bot, userID)
                                await bot.chat(`/back`)
                                await new Promise(r => setTimeout(r, 5000))


                                let new_m = await getMapof_InameANDPos()

                                // 開始蓋
                                await building(bot, mapart_map, previous_pos, userID, new_m)

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

                        case "cgm":
                            await cgm(bot)
                            break

                        case "test":
                            await bot.chat(`/warp ${settings.Material_Warp}`)
                            // 等待10秒 避免網路不好的情況導致延遲
                            await new Promise(r => setTimeout(r, 5000))
                            await takeMaterial(bot, userID)
                            await bot.chat(`/back`)
                            await new Promise(r => setTimeout(r, 5000))
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
            hasDisconnected = true
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

async function cgm(bot) {
    bot.chat(`/cgm`)
    await new Promise(r => setTimeout(r, 500))
    bot.chat(`/cgm`)
    await new Promise(r => setTimeout(r, 500))
}

async function takeMaterial(bot, userID) {

    try {

        const sm = settings.MaterialBox
        const position_of_material = new vec3(sm[0], sm[1], sm[2])
        let block = bot.blockAt(position_of_material)

        if (block.name === 'air') {
            isEnd = true
            return
        }

        let MaterialBox = await bot.openChest(block)
        let took_item_count = 0
        let took_item_name
        let took_item_type

        if (MaterialBox.containerItems().length !== 0) {

            try {
                for (let item of MaterialBox.containerItems()) {
                    took_item_count += item.count
                    took_item_name = item.name
                    took_item_type = item.type
                    took_item = item
                }
                await MaterialBox.withdraw(took_item_type, null, took_item_count)
                await MaterialBox.close()
                bot.chat(`/m ${userID} 已拿取 ${took_item_name} x${took_item_count}`)

            } catch (error) {
                cl(`拿取材料時發生錯誤: ${error}`)
            }

        } else {
            bot.chat(`/m ${userID} 材料盒為空，請檢查！`)
        }

    } catch (error) {
        cl(`拿取材料時發生錯誤: ${error}`)
    }

}

async function depositMaterial(bot, userID) {
    try {

        const sem = settings.extraMaterialBox
        const position_of_extraMaterialBox = new vec3(sem[0], sem[1], sem[2])
        let block = bot.blockAt(position_of_extraMaterialBox)

        let chest = await bot.openChest(block)
        let item_name
        let item_count = 0
        let item_type

        for (let item of bot.inventory.items()) {
            item_type = item.type
            item_name = item.name
            item_count += item.count
        }

        await chest.deposit(item_type, null, item_count)
        bot.chat(`/m ${userID} 已將多餘的 ${item_name} x${item_count} 放置到容器裡`)
        await chest.close()
    } catch (error) {
        cl(`放置多於材料時發生錯誤: ${error}`)
    }
}

async function building(bot, mapart_map, previous_pos, userID, new_m) {

    await cgm(bot)
    let now_position = bot.entity.position

    for (let [name, pos] of new_m) {

        // 材料盒拿的物品與當前座標ARRAY的物品相同
        if (name === took_item.name) {

            // i = 材料name的每一座標
            for (let i of pos) {
                try {

                    // 目前地點
                    // let new_position = now_position.plus((new vec3(i).minus(previous_pos))).floor()
                    // previous_pos = new vec3(i)
                    //
                    // now_position = new_position

                    let new_position = original_position.plus(new vec3(i).floor()).minus(new vec3(0, 2, 0))

                    // 將takeMaterial的材料拿到手上
                    let PlaceItem = bot.inventory.findInventoryItem(mcData.itemsByName[took_item.name].id, null, false)

                    if (PlaceItem != null) {

                        await bot.equip(PlaceItem, 'hand')

                        if ((bot.blockAt(new_position.minus(new vec3(0, 4, 0))).name === 'air') && (await getMapValue(mapart_map, [i[0], i[1], i[2]]) === took_item.name)) {

                            for (let k = 0; k > -3; k--) {
                                bot.inventory.findInventoryItem(mcData.itemsByName[took_item.name].id, null, false)

                                let target_block = bot.blockAt(new_position.minus(new vec3(k, 4, 0)))

                                let target_block_name = await getMapValue(mapart_map, [i[0] + (-k), i[1], i[2]])

                                if ((target_block_name === took_item.name) && (bot.blockAt(target_block.position).name === 'air')) {

                                    if (took_item.name.includes("log")) {

                                        await bot.creative.flyTo(new_position)
                                        await bot.placeBlock(target_block, new vec3(1, 1, 0))

                                    } else {

                                        await bot.creative.flyTo(new_position)
                                        await bot.placeBlock(target_block, new vec3(0, 1, 0))

                                    }

                                }
                            }

                        }


                    } else {

                        await bot.chat(`/warp ${settings.Material_Warp}`)
                        // 等待10秒 避免網路不好的情況導致延遲
                        await new Promise(r => setTimeout(r, 5000))
                        await takeMaterial(bot, userID)
                        await bot.chat(`/back`)
                        await new Promise(r => setTimeout(r, 5000))


                    }
                    /*
                    1.到材料區拿材料盒子內物品(全拿)
                    2.跑一遍所有座標 放置(包含放置的格子+2格)
                    3.如果跑完所有座標 身上物品還有 那就拿到指定位置放置(代表是多的)
                    4.如果沒跑完 身上物品就沒了 代表物品不夠 回去再拿一盒
                     */
                } catch (error) {
                    cl(`建造地圖畫時發生錯誤: ${error}`)
                }

                await new Promise(r => setTimeout(r, 50))
            }
        }


    }


    // 跑完所有座標 身上還有物品 代表是多的 拿到指定位置放置
    let bot_inv_items_count = 0
    for (let item of bot.inventory.items()) {
        bot_inv_items_count += item.count
    }

    if (bot_inv_items_count > 0) {

        try {
            await bot.chat(`/warp ${settings.Material_Warp}`)
            // 等待5秒 避免網路不好的情況導致延遲
            await new Promise(r => setTimeout(r, 5000))
            await depositMaterial(bot, userID)
            await new Promise(r => setTimeout(r, 5000))
            await takeMaterial(bot, userID)
            await new Promise(r => setTimeout(r, 2000))

        } catch (error) {
            cl(`放置多於材料時發生錯誤: ${error}`)
        }

    }

    if (isEnd) {
        cl(`地圖畫已完成!`)
        bot.chat(`/m ${userID} 地圖畫已完成!`)
    } else {
        await cgm(bot)
        await bot.creative.flyTo(original_position)
        await building(bot, mapart_map, previous_pos, userID, new_m)
    }

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
    try {
        await bot.toss(item.type, item.metadata, item.count)
    } catch (error) {
        cl(`丟棄身上物品時發生錯誤: ${error}`)
    }
}

async function getMapof_InameANDPos() {

    let time1 = performance.now()

    let m = await getItemNameMap(blocks, palette)
    let new_m = new Map()

    for (let material of palette) {
        new_m.set(material.Name.value.toString().split(":")[1], [])
    }

    for (let [i, j] of m) {
        let itemname = j.toString().split(":")[1]
        for (let [k, h] of new_m) {
            if (k === itemname) {
                h.push(i)
            }
        }
    }

    let time2 = performance.now()
    cl(`計算座標及材料花費了 ${(time2 - time1) / 1000} 秒`)

    return new_m

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