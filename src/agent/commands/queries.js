import * as world from '../library/world.js';
import * as mc from '../../utils/mcdata.js';
import { getCommandDocs } from './index.js';
import convoManager from '../conversation.js';
import { checkLevelBlueprint, checkBlueprint } from '../tasks/construction_tasks.js';
import { load } from 'cheerio';

const pad = (str) => {
    return '\n' + str + '\n';
}

// queries are commands that just return strings and don't affect anything in the world
export const queryList = [
    {
        name: "!stats",
        description: "Get your bot's location, health, hunger, and time of day.", 
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'STATS';
            let pos = bot.entity.position;
            // display position to 2 decimal places
            res += `\n- Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
            // Gameplay
            res += `\n- Gamemode: ${bot.game.gameMode}`;
            res += `\n- Health: ${Math.round(bot.health)} / 20`;
            res += `\n- Hunger: ${Math.round(bot.food)} / 20`;
            res += `\n- Biome: ${world.getBiomeName(bot)}`;
            let weather = "Clear";
            if (bot.rainState > 0)
                weather = "Rain";
            if (bot.thunderState > 0)
                weather = "Thunderstorm";
            res += `\n- Weather: ${weather}`;
            // let block = bot.blockAt(pos);
            // res += `\n- Artficial light: ${block.skyLight}`;
            // res += `\n- Sky light: ${block.light}`;
            // light properties are bugged, they are not accurate


            if (bot.time.timeOfDay < 6000) {
                res += '\n- Time: Morning';
            } else if (bot.time.timeOfDay < 12000) {
                res += '\n- Time: Afternoon';
            } else {
                res += '\n- Time: Night';
            }

            // get the bot's current action
            let action = agent.actions.currentActionLabel;
            if (agent.isIdle())
                action = 'Idle';
            res += `\- Current Action: ${action}`;


            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            res += '\n- Nearby Human Players: ' + (players.length > 0 ? players.join(', ') : 'None.');
            res += '\n- Nearby Bot Players: ' + (bots.length > 0 ? bots.join(', ') : 'None.');

            res += '\n' + agent.bot.modes.getMiniDocs() + '\n';
            return pad(res);
        }
    },
    {
        name: "!inventory",
        description: "Get your bot's inventory.",
        perform: function (agent) {
            let bot = agent.bot;
            let inventory = world.getInventoryCounts(bot);
            let res = 'INVENTORY';
            for (const item in inventory) {
                if (inventory[item] && inventory[item] > 0)
                    res += `\n- ${item}: ${inventory[item]}`;
            }
            if (res === 'INVENTORY') {
                res += ': Nothing';
            }
            else if (agent.bot.game.gameMode === 'creative') {
                res += '\n(You have infinite items in creative mode. You do not need to gather resources!!)';
            }

            let helmet = bot.inventory.slots[5];
            let chestplate = bot.inventory.slots[6];
            let leggings = bot.inventory.slots[7];
            let boots = bot.inventory.slots[8];
            res += '\nWEARING: ';
            if (helmet)
                res += `\nHead: ${helmet.name}`;
            if (chestplate)
                res += `\nTorso: ${chestplate.name}`;
            if (leggings)
                res += `\nLegs: ${leggings.name}`;
            if (boots)
                res += `\nFeet: ${boots.name}`;
            if (!helmet && !chestplate && !leggings && !boots)
                res += 'Nothing';

            return pad(res);
        }
    },
    {
        name: "!nearbyBlocks",
        description: "Get the blocks near the bot.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'NEARBY_BLOCKS';
            let blocks = world.getNearestBlocks(bot);
            let block_details = new Set();
            
            for (let block of blocks) {
                let details = block.name;
                if (block.name === 'water' || block.name === 'lava') {
                    details += block.metadata === 0 ? ' (source)' : ' (flowing)';
                }
                block_details.add(details);
            }
            for (let details of block_details) {
                res += `\n- ${details}`;
            }
            if (block_details.size === 0) {
                res += ': none';
            } 
            else {
                res += '\n- ' + world.getSurroundingBlocks(bot).join('\n- ');
                res += `\n- First Solid Block Above Head: ${world.getFirstBlockAboveHead(bot, null, 32)}`;
            }
            return pad(res);
        }
    },
    {
        name: "!craftable",
        description: "Get the craftable items with the bot's inventory.",
        perform: function (agent) {
            let craftable = world.getCraftableItems(agent.bot);
            let res = 'CRAFTABLE_ITEMS';
            for (const item of craftable) {
                res += `\n- ${item}`;
            }
            if (res == 'CRAFTABLE_ITEMS') {
                res += ': none';
            }
            return pad(res);
        }
    },
    {
        name: "!entities",
        description: "Get the nearby players and entities.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'NEARBY_ENTITIES';
            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            for (const player of players) {
                res += `\n- Human player: ${player}`;
            }
            for (const bot of bots) {
                res += `\n- Bot player: ${bot}`;
            }

            let nearbyEntities = world.getNearbyEntities(bot);
            let entityCounts = {};
            let villagerIds = [];
            let babyVillagerIds = [];
            let villagerDetails = []; // Store detailed villager info including profession
            
            for (const entity of nearbyEntities) {
                if (entity.type === 'player' || entity.name === 'item')
                    continue;
                    
                if (!entityCounts[entity.name]) {
                    entityCounts[entity.name] = 0;
                }
                entityCounts[entity.name]++;
                
                if (entity.name === 'villager') {
                    if (entity.metadata && entity.metadata[16] === 1) {
                        babyVillagerIds.push(entity.id);
                    } else {
                        const profession = world.getVillagerProfession(entity);
                        villagerIds.push(entity.id);
                        villagerDetails.push({
                            id: entity.id,
                            profession: profession
                        });
                    }
                }
            }
            
            for (const [entityType, count] of Object.entries(entityCounts)) {
                if (entityType === 'villager') {
                    let villagerInfo = `${count} ${entityType}(s)`;
                    if (villagerDetails.length > 0) {
                        const detailStrings = villagerDetails.map(v => `(${v.id}:${v.profession})`);
                        villagerInfo += ` - Adults: ${detailStrings.join(', ')}`;
                    }
                    if (babyVillagerIds.length > 0) {
                        villagerInfo += ` - Baby IDs: ${babyVillagerIds.join(', ')} (babies cannot trade)`;
                    }
                    res += `\n- entities: ${villagerInfo}`;
                } else {
                    res += `\n- entities: ${count} ${entityType}(s)`;
                }
            }
            
            if (res == 'NEARBY_ENTITIES') {
                res += ': none';
            }
            return pad(res);
        }
    },
    {
        name: "!modes",
        description: "Get all available modes and their docs and see which are on/off.",
        perform: function (agent) {
            return agent.bot.modes.getDocs();
        }
    },
    {
        name: '!savedPlaces',
        description: 'List all saved locations.',
        perform: async function (agent) {
            return "Saved place names: " + agent.memory_bank.getKeys();
        }
    },
    {
        name: '!advancements',
        description: 'Check your current advancement progress and see what achievements you can work towards.',
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'ADVANCEMENTS';
            
            // Check if bot has advancement data
            if (bot.advancements && Object.keys(bot.advancements).length > 0) {
                res += '\n- Completed Advancements:';
                let completedCount = 0;
                for (const [id, advancement] of Object.entries(bot.advancements)) {
                    if (advancement.done) {
                        res += `\n  ✓ ${advancement.display?.title || id}`;
                        completedCount++;
                    }
                }
                if (completedCount === 0) {
                    res += '\n  None completed yet';
                }
                
                res += '\n- Available to work on:';
                let availableCount = 0;
                for (const [id, advancement] of Object.entries(bot.advancements)) {
                    if (!advancement.done && advancement.display) {
                        res += `\n  ○ ${advancement.display.title}`;
                        if (advancement.display.description) {
                            res += ` - ${advancement.display.description}`;
                        }
                        availableCount++;
                    }
                }
                if (availableCount === 0) {
                    res += '\n  No advancements available to display';
                }
            } else {
                res += '\n- Advancement data not available yet.';
                res += '\n- This is normal for new players. Advancements will appear as you complete tasks.';
                res += '\n- Try these basic tasks to unlock your first advancements:';
                res += '\n  • Break a block (any block)';
                res += '\n  • Craft a crafting table';
                res += '\n  • Make wooden tools';
                res += '\n  • Mine stone with a pickaxe';
                res += '\n- Use !inventory to see what you can craft';
            }
            
            return pad(res);
        }
    },
    {
        name: '!getStarted',
        description: 'Get a step-by-step guide to start working on your first advancements.',
        perform: function (agent) {
            let bot = agent.bot;
            let res = 'GETTING STARTED WITH ADVANCEMENTS';
            
            // Check inventory to give personalized advice
            const inventory = bot.inventory.items();
            const hasWood = inventory.some(item => item.name.includes('log') || item.name.includes('plank'));
            const hasStone = inventory.some(item => item.name.includes('stone') || item.name.includes('cobblestone'));
            const hasCraftingTable = inventory.some(item => item.name === 'crafting_table');
            const hasTools = inventory.some(item => item.name.includes('pickaxe') || item.name.includes('axe') || item.name.includes('shovel'));
            
            res += '\n- Current Status:';
            res += `\n  • Wood/Planks: ${hasWood ? '✓ Have' : '✗ Need'}`;
            res += `\n  • Stone: ${hasStone ? '✓ Have' : '✗ Need'}`;
            res += `\n  • Crafting Table: ${hasCraftingTable ? '✓ Have' : '✗ Need'}`;
            res += `\n  • Tools: ${hasTools ? '✓ Have' : '✗ Need'}`;
            
            res += '\n- Next Steps:';
            if (!hasWood) {
                res += '\n  1. Find and break a tree to get wood';
                res += '\n  2. Use !nearbyBlocks to find trees nearby';
            } else if (!hasCraftingTable) {
                res += '\n  1. Craft a crafting table: !craft("crafting_table", 1)';
            } else if (!hasTools) {
                res += '\n  1. Craft wooden tools: !craft("wooden_pickaxe", 1)';
                res += '\n  2. Then craft: !craft("wooden_axe", 1)';
                res += '\n  3. And: !craft("wooden_shovel", 1)';
            } else if (!hasStone) {
                res += '\n  1. Mine stone with your pickaxe: !mine("stone", 10)';
                res += '\n  2. Then craft stone tools for better efficiency';
            } else {
                res += '\n  ✓ You have the basics! Try exploring or building to unlock more advancements.';
                res += '\n  • Use !nearbyBlocks to explore your surroundings';
                res += '\n  • Try !craftRecipe to see what you can make';
            }
            
            return pad(res);
        }
    },
    {
        name: '!learnFromMistakes',
        description: 'Analyze recent failures and suggest better approaches to avoid repeating mistakes.',
        perform: function (agent) {
            let res = 'LEARNING FROM MISTAKES';
            
            // Get recent memory to analyze patterns
            const memory = agent.memory_bank.memory;
            const recentTurns = agent.history?.turns || [];
            
            res += '\n- Recent Issues Detected:';
            
            // Check for common failure patterns
            const hasCobblestoneIssue = memory.includes('cobblestone') && memory.includes('Failed');
            const hasToolIssue = memory.includes('tools') && memory.includes('break');
            const hasCraftingIssue = memory.includes('craft') && memory.includes('resource');
            
            if (hasCobblestoneIssue) {
                res += '\n  ⚠️ COBBLESTONE PROBLEM: You keep trying to get cobblestone but failing.';
                res += '\n     SOLUTION: You need a pickaxe to break stone into cobblestone.';
                res += '\n     Try: !craft("wooden_pickaxe", 1) first, then mine stone.';
            }
            
            if (hasToolIssue) {
                res += '\n  ⚠️ TOOL PROBLEM: You need tools to break blocks.';
                res += '\n     SOLUTION: Craft wooden tools first before trying to mine.';
                res += '\n     Order: Pickaxe → Axe → Shovel';
            }
            
            if (hasCraftingIssue) {
                res += '\n  ⚠️ CRAFTING PROBLEM: You\'re trying to craft without the right materials.';
                res += '\n     SOLUTION: Check what you have with !inventory, then gather missing materials.';
            }
            
            // Analyze recent turns for repeated failures
            const recentFailures = recentTurns.filter(turn => 
                turn.role === 'system' && 
                (turn.content.includes('Failed') || turn.content.includes('Error') || turn.content.includes('Cannot'))
            );
            
            if (recentFailures.length > 2) {
                res += '\n  ⚠️ REPEATED FAILURES: You\'ve failed the same action multiple times.';
                res += '\n     SOLUTION: Try a different approach or gather prerequisites first.';
                res += '\n     Use !getStarted for a step-by-step guide.';
            }
            
            res += '\n- Smart Approach:';
            res += '\n  1. Always check !inventory before crafting';
            res += '\n  2. Craft tools in order: wood → stone → iron';
            res += '\n  3. If something fails 3 times, try a different approach';
            res += '\n  4. Use !nearbyBlocks to find resources nearby';
            
            return pad(res);
        }
    },
    {
        name: '!breakLoop',
        description: 'Break out of repetitive behavior and try a completely different approach.',
        perform: function (agent) {
            let res = 'BREAKING OUT OF LOOP';
            
            // Get current inventory and suggest alternative approaches
            const inventory = agent.bot.inventory.items();
            const hasWood = inventory.some(item => item.name.includes('log') || item.name.includes('plank'));
            const hasStone = inventory.some(item => item.name.includes('stone') || item.name.includes('cobblestone'));
            const hasCraftingTable = inventory.some(item => item.name === 'crafting_table');
            const hasTools = inventory.some(item => item.name.includes('pickaxe') || item.name.includes('axe') || item.name.includes('shovel'));
            
            res += '\n- Current Situation Analysis:';
            res += `\n  • Wood: ${hasWood ? '✓' : '✗'}`;
            res += `\n  • Stone: ${hasStone ? '✓' : '✗'}`;
            res += `\n  • Crafting Table: ${hasCraftingTable ? '✓' : '✗'}`;
            res += `\n  • Tools: ${hasTools ? '✓' : '✗'}`;
            
            res += '\n- Alternative Strategies:';
            
            if (!hasWood && !hasTools) {
                res += '\n  1. PUNCH TREES: You can break leaves and logs with your bare hands!';
                res += '\n     Try: !punchTree or find a tree and break it manually';
                res += '\n  2. EXPLORE: Look for different resources in other areas';
                res += '\n     Try: !nearbyBlocks to see what\'s available';
            } else if (hasWood && !hasCraftingTable) {
                res += '\n  1. CRAFT TABLE: Make a crafting table from wood planks';
                res += '\n     Try: !craft("crafting_table", 1)';
                res += '\n  2. EXPLORE: Look for villages or structures with crafting tables';
            } else if (hasCraftingTable && !hasTools) {
                res += '\n  1. WOODEN TOOLS: Craft basic tools from wood';
                res += '\n     Try: !craft("wooden_pickaxe", 1)';
                res += '\n  2. EXPLORE: Look for tools in chests or villages';
            } else if (hasTools && !hasStone) {
                res += '\n  1. MINE STONE: Use your pickaxe to mine stone blocks';
                res += '\n     Try: !mine("stone", 5) or !digDown(10)';
                res += '\n  2. EXPLORE: Look for exposed stone in caves or cliffs';
            } else {
                res += '\n  1. EXPLORE: You have basics, try exploring new areas';
                res += '\n     Try: !nearbyBlocks or !explore';
                res += '\n  2. BUILD: Try building something to unlock building advancements';
                res += '\n  3. CRAFT: Try crafting more advanced items';
            }
            
            res += '\n- Emergency Options:';
            res += '\n  • !goToPlayer("firelemon333", 3) - Go to human for help';
            res += '\n  • !explore - Random exploration';
            res += '\n  • !nearbyBlocks - See what\'s around you';
            res += '\n  • !inventory - Check what you actually have';
            
            return pad(res);
        }
    }, 
    {
        name: '!checkBlueprintLevel',
        description: 'Check if the level is complete and what blocks still need to be placed for the blueprint',
        params: {
            'levelNum': { type: 'int', description: 'The level number to check.', domain: [0, Number.MAX_SAFE_INTEGER] }
        },
        perform: function (agent, levelNum) {
            let res = checkLevelBlueprint(agent, levelNum);
            console.log(res);
            return pad(res);
        }
    }, 
    {
        name: '!checkBlueprint',
        description: 'Check what blocks still need to be placed for the blueprint',
        perform: function (agent) {
            let res = checkBlueprint(agent);
            return pad(res);
        }
    }, 
    {
        name: '!getBlueprint',
        description: 'Get the blueprint for the building',
        perform: function (agent) {
            let res = agent.task.blueprint.explain();
            return pad(res);
        }
    }, 
    {
        name: '!getBlueprintLevel',
        description: 'Get the blueprint for the building',
        params: {
            'levelNum': { type: 'int', description: 'The level number to check.', domain: [0, Number.MAX_SAFE_INTEGER] }
        },
        perform: function (agent, levelNum) {
            let res = agent.task.blueprint.explainLevel(levelNum);
            console.log(res);
            return pad(res);
        }
    },
    {
        name: '!getCraftingPlan',
        description: "Provides a comprehensive crafting plan for a specified item. This includes a breakdown of required ingredients, the exact quantities needed, and an analysis of missing ingredients or extra items needed based on the bot's current inventory.",
        params: {
            targetItem: { 
                type: 'string', 
                description: 'The item that we are trying to craft' 
            },
            quantity: { 
                type: 'int',
                description: 'The quantity of the item that we are trying to craft',
                optional: true,
                domain: [1, Infinity, '[)'], // Quantity must be at least 1,
                default: 1
            }
        },
        perform: function (agent, targetItem, quantity = 1) {
            let bot = agent.bot;

            // Fetch the bot's inventory
            const curr_inventory = world.getInventoryCounts(bot); 
            const target_item = targetItem;
            let existingCount = curr_inventory[target_item] || 0;
            let prefixMessage = '';
            if (existingCount > 0) {
                curr_inventory[target_item] -= existingCount;
                prefixMessage = `You already have ${existingCount} ${target_item} in your inventory. If you need to craft more,\n`;
            }

            // Generate crafting plan
            try {
                let craftingPlan = mc.getDetailedCraftingPlan(target_item, quantity, curr_inventory);
                craftingPlan = prefixMessage + craftingPlan;
                return pad(craftingPlan);
            } catch (error) {
                console.error("Error generating crafting plan:", error);
                return `An error occurred while generating the crafting plan: ${error.message}`;
            }
            
            
        },
    },
    {
        name: '!searchWiki',
        description: 'Search the Minecraft Wiki for the given query.',
        params: {
            'query': { type: 'string', description: 'The query to search for.' }
        },
        perform: async function (agent, query) {
            const url = `https://minecraft.wiki/w/${query}`
            try {
                const response = await fetch(url);
                if (response.status === 404) {
                  return `${query} was not found on the Minecraft Wiki. Try adjusting your search term.`;
                }
                const html = await response.text();
                const $ = load(html);
            
                const parserOutput = $("div.mw-parser-output");
                
                parserOutput.find("table.navbox").remove();

                const divContent = parserOutput.text();
            
                return divContent.trim();
              } catch (error) {
                console.error("Error fetching or parsing HTML:", error);
                return `The following error occurred: ${error}`
              }
        }
    },
    {
        name: '!help',
        description: 'Lists all available commands and their descriptions.',
        perform: async function (agent) {
            return getCommandDocs(agent);
        }
    },
];
