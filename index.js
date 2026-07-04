// =========================
// WHITECASTLE SUPPORT SYSTEM — FINAL INDEX.JS
// =========================

require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// UptimeRobot / Render keep-alive
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.json({
        embed: {
            title: "WhiteCastle Support System",
            description: "Bot is online and running. Use !help for commands.",
            color: 0x2E6F40,
            footer: {
                text: `WhiteCastle Support Systems | ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}`
            }
        }
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Uptime server running on port ${process.env.PORT}`);
});

// Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Data folders
const dataFolder = path.join(__dirname, "data");
const transcriptsFolder = path.join(dataFolder, "transcripts");

if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
if (!fs.existsSync(transcriptsFolder)) fs.mkdirSync(transcriptsFolder);

const ticketsFile = path.join(dataFolder, "tickets.json");
const snippetsFile = path.join(dataFolder, "snippets.json");
const usersFile = path.join(dataFolder, "users.json");

if (!fs.existsSync(ticketsFile)) fs.writeFileSync(ticketsFile, "{}");
if (!fs.existsSync(snippetsFile)) fs.writeFileSync(snippetsFile, "{}");
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "{}");

let tickets = JSON.parse(fs.readFileSync(ticketsFile));
let snippets = JSON.parse(fs.readFileSync(snippetsFile));
let users = JSON.parse(fs.readFileSync(usersFile));

function saveTickets() {
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 4));
}
function saveSnippets() {
    fs.writeFileSync(snippetsFile, JSON.stringify(snippets, null, 4));
}
function saveUsers() {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 4));
}

function CSTTimestamp() {
    return new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function wcFooter() {
    return `WhiteCastle Support Systems | ${CSTTimestamp()}`;
}

function wcEmbed(color) {
    return new EmbedBuilder().setColor(color).setFooter({ text: wcFooter() });
}

function wcAuthor(embed, user) {
    return embed.setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL()
    });
}

function confirmButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirm_yes")
            .setLabel("✔️")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("confirm_no")
            .setLabel("✖️")
            .setStyle(ButtonStyle.Danger)
    );
}

function departmentMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("dept_select")
            .setPlaceholder("Select a department")
            .addOptions([
                { label: "General Support", value: "gs" },
                { label: "Relations", value: "pr" },
                { label: "Staffing", value: "s" },
                { label: "Leadership Support", value: "ls" }
            ])
    );
}

function transferMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("transfer_select")
            .setPlaceholder("Transfer ticket to...")
            .addOptions([
                { label: "General Support", value: "gs" },
                { label: "Relations", value: "pr" },
                { label: "Staffing", value: "s" },
                { label: "Leadership Support", value: "ls" }
            ])
    );
}

const PREFIX = process.env.PREFIX || "!";
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const GS_ROLE_ID = process.env.GS_ROLE_ID;
const PR_ROLE_ID = process.env.PR_ROLE_ID;
const S_ROLE_ID = process.env.S_ROLE_ID;
const LS_ROLE_ID = process.env.LS_ROLE_ID;

const pendingOpen = new Map();   // userId -> true
const pendingClose = new Map();  // channelId -> true
const pendingTransfer = new Map(); // channelId -> true

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag} — WhiteCastle Support System Online`);

    const embed = wcEmbed("#2E6F40");
    embed
        .setTitle("WhiteCastle Support System Online")
        .setDescription("Bot is online and running.\nUse `!help` for commands.");

    console.log("Use !help for commands.");
});

// DM handler: open flow + relay
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === 1) {
        const user = message.author;

        // Check if user already has an open ticket
        const openTickets = Object.entries(tickets).filter(
            ([, t]) => t.userId === user.id && !t.closed
        );

        if (openTickets.length > 0) {
            // Relay DM to latest open ticket
            const [ticketId] = openTickets[openTickets.length - 1];
            const guild = client.guilds.cache.first();
            if (!guild) return;

            const channel = guild.channels.cache.get(ticketId);
            if (!channel) return;

            const relayEmbed = wcEmbed("#2B2D31");
            wcAuthor(relayEmbed, user)
                .setTitle("New Message from User")
                .setDescription(message.content || "[No content]");

            await channel.send({ embeds: [relayEmbed] });

            try { await message.react("✅"); } catch {}

            tickets[ticketId].messages.push({
                timestamp: new Date().toISOString(),
                author: "user",
                content: message.content || "",
                attachments: message.attachments.map(a => a.url)
            });
            saveTickets();

            return;
        }

        // No open ticket → send green open confirmation
        if (!pendingOpen.has(user.id)) {
            pendingOpen.set(user.id, true);

            const embed = wcEmbed("#2E6F40");
            wcAuthor(embed, user)
                .setTitle("Are you sure you would like to create a thread?")
                .setDescription(
                    "Creating a thread will send our moderators a ticket that will be chatted through.\n\n" +
                    "Use `!help` for staff commands."
                );

            await message.channel.send({
                embeds: [embed],
                components: [confirmButtons()]
            });

            return;
        }

        return;
    }
});

// Interaction handler: open confirm, dept select, close confirm, transfer select
client.on("interactionCreate", async (interaction) => {
    const isDM = interaction.channel.type === 1;

    // OPEN / CLOSE CONFIRM BUTTONS
    if (interaction.isButton()) {
        const { customId } = interaction;

        // DM open flow
        if (isDM && (customId === "confirm_yes" || customId === "confirm_no")) {
            const user = interaction.user;

            if (!pendingOpen.has(user.id)) return;

            if (customId === "confirm_no") {
                pendingOpen.delete(user.id);

                const cancelEmbed = wcEmbed("#2B2D31");
                wcAuthor(cancelEmbed, user)
                    .setTitle("Thread Creation Cancelled")
                    .setDescription("You have cancelled the creation of a support thread.");

                await interaction.update({
                    embeds: [cancelEmbed],
                    components: []
                });

                return;
            }

            const deptEmbed = wcEmbed("#2B2D31");
            wcAuthor(deptEmbed, user)
                .setTitle("Select a Department")
                .setDescription("Please choose the department that best fits your issue.");

            await interaction.update({
                embeds: [deptEmbed],
                components: [departmentMenu()]
            });

            return;
        }

        // Guild close flow
        if (!isDM && (customId === "confirm_yes" || customId === "confirm_no")) {
            const channel = interaction.channel;
            const ticketId = channel.id;

            if (!pendingClose.has(ticketId)) return;

            if (customId === "confirm_no") {
                pendingClose.delete(ticketId);

                const embed = wcEmbed("#2B2D31");
                wcAuthor(embed, interaction.user)
                    .setTitle("Ticket Close Cancelled")
                    .setDescription("This ticket will remain open.");

                return interaction.update({
                    embeds: [embed],
                    components: []
                });
            }

            const ticket = tickets[ticketId];
            ticket.closed = new Date().toISOString();
            saveTickets();

            const transcriptPath = path.join(
                transcriptsFolder,
                `transcript-${ticketId}.txt`
            );

            let transcriptText = `Transcript for ticket ${ticketId}\nGenerated: ${new Date().toISOString()}\n\n`;

            for (const msg of ticket.messages) {
                transcriptText += `[${msg.timestamp}] ${msg.author}: ${msg.content}\n`;
            }

            fs.writeFileSync(transcriptPath, transcriptText);

            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = wcEmbed("#ED4245");
                logEmbed
                    .setTitle("Ticket Closed")
                    .setDescription(`Ticket <#${ticketId}> has been closed.`);

                await logChannel.send({
                    embeds: [logEmbed],
                    files: [transcriptPath]
                });
            }

            const embed = wcEmbed("#ED4245");
            wcAuthor(embed, interaction.user)
                .setTitle("Ticket Closed")
                .setDescription("This ticket has been closed and a transcript has been generated.");

            await interaction.update({
                embeds: [embed],
                components: []
            });

            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 2000);

            pendingClose.delete(ticketId);

            return;
        }
    }

    // DEPARTMENT SELECT (ticket creation) + TRANSFER SELECT
    if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        // Ticket creation from DM
        if (customId === "dept_select") {
            if (!isDM) return;

            const user = interaction.user;
            const selected = interaction.values[0];

            const guild = client.guilds.cache.first();
            if (!guild) {
                const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("Support guild not found.");
                await interaction.reply({ embeds: [errEmbed], ephemeral: true });
                return;
            }

            const category = guild.channels.cache.get(TICKET_CATEGORY_ID);
            if (!category) {
                const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("Ticket category not found.");
                await interaction.reply({ embeds: [errEmbed], ephemeral: true });
                return;
            }

            const channelName = `ticket-${selected}-${user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9\-]/g, "");

            const permsBase = [
                { id: guild.id, deny: ["ViewChannel"] },
                { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
            ];

            let deptRoleId = null;
            if (selected === "gs") deptRoleId = GS_ROLE_ID;
            if (selected === "pr") deptRoleId = PR_ROLE_ID;
            if (selected === "s") deptRoleId = S_ROLE_ID;
            if (selected === "ls") deptRoleId = LS_ROLE_ID;

            if (deptRoleId) {
                permsBase.push({
                    id: deptRoleId,
                    allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
                });
            }

            const ticketChannel = await guild.channels.create({
                name: channelName,
                parent: category.id,
                permissionOverwrites: permsBase
            });

            tickets[ticketChannel.id] = {
                userId: user.id,
                department: selected,
                created: new Date().toISOString(),
                closed: null,
                claimedBy: null,
                transfers: [],
                messages: []
            };
            saveTickets();

            if (!users[user.id]) {
                users[user.id] = {
                    ticketsOpened: 0,
                    lastTicket: null
                };
            }
            users[user.id].ticketsOpened += 1;
            users[user.id].lastTicket = ticketChannel.id;
            saveUsers();

            const ticketEmbed = wcEmbed("#2B2D31");
            wcAuthor(ticketEmbed, user)
                .setTitle("New Support Ticket Created")
                .setDescription(
                    `A new support ticket has been created for **${user.username}**.\n\n` +
                    `**Department:** ${selected.toUpperCase()}\n` +
                    `Use \`${PREFIX}reply\` to respond.\n` +
                    `Use \`${PREFIX}transfer\` to move this ticket.\n` +
                    `Use \`${PREFIX}close\` to close this ticket.`
                );

            await ticketChannel.send({ embeds: [ticketEmbed] });

            const dmEmbed = wcEmbed("#2E6F40");
            wcAuthor(dmEmbed, user)
                .setTitle("Thread Created")
                .setDescription("Your support thread has been created. Our moderators will respond shortly.");

            await interaction.update({
                embeds: [dmEmbed],
                components: []
            });

            pendingOpen.delete(user.id);

            return;
        }

        // Transfer select in guild
        if (customId === "transfer_select") {
            if (isDM) return;

            const channel = interaction.channel;
            const ticketId = channel.id;
            if (!tickets[ticketId]) return;
            if (!pendingTransfer.has(ticketId)) return;

            const selected = interaction.values[0];
            const guild = interaction.guild;

            let newDeptRoleId = null;
            let newDeptLabel = "";
            if (selected === "gs") { newDeptRoleId = GS_ROLE_ID; newDeptLabel = "General Support"; }
            if (selected === "pr") { newDeptRoleId = PR_ROLE_ID; newDeptLabel = "Relations"; }
            if (selected === "s") { newDeptRoleId = S_ROLE_ID; newDeptLabel = "Staffing"; }
            if (selected === "ls") { newDeptRoleId = LS_ROLE_ID; newDeptLabel = "Leadership Support"; }

            if (!newDeptRoleId) {
                const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("Invalid department selected.");
                await interaction.reply({ embeds: [errEmbed], ephemeral: true });
                return;
            }

            // Switch visibility: remove old dept role, add new dept role
            const overwrites = channel.permissionOverwrites.cache;

            const deptRoles = [GS_ROLE_ID, PR_ROLE_ID, S_ROLE_ID, LS_ROLE_ID].filter(Boolean);

            const newOverwrites = overwrites.map(po => ({
                id: po.id,
                allow: po.allow.bitfield,
                deny: po.deny.bitfield,
                type: po.type
            })).filter(po => !deptRoles.includes(po.id));

            newOverwrites.push({
                id: newDeptRoleId,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
                deny: []
            });

            await channel.permissionOverwrites.set(newOverwrites);

            const oldDept = tickets[ticketId].department;
            tickets[ticketId].department = selected;
            tickets[ticketId].transfers.push({
                from: oldDept,
                to: selected,
                by: interaction.user.id,
                timestamp: new Date().toISOString()
            });
            saveTickets();

            const successEmbed = wcEmbed("#2E6F40");
            successEmbed
                .setTitle("Ticket Transferred")
                .setDescription(
                    `This ticket has been transferred to **${newDeptLabel}**.\n\n` +
                    `Transferred by: <@${interaction.user.id}>`
                );

            await interaction.update({
                embeds: [successEmbed],
                components: []
            });

            // Ping new department role
            await channel.send({
                content: `<@&${newDeptRoleId}>`,
                embeds: [
                    wcEmbed("#2E6F40")
                        .setTitle("New Ticket Assigned")
                        .setDescription("This ticket has been transferred to your department.")
                ]
            });

            // Log transfer
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = wcEmbed("#2E6F40");
                logEmbed
                    .setTitle("Ticket Transferred")
                    .setDescription(
                        `Ticket <#${ticketId}> transferred.\n\n` +
                        `From: **${oldDept?.toUpperCase() || "N/A"}**\n` +
                        `To: **${selected.toUpperCase()}**\n` +
                        `By: <@${interaction.user.id}>`
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }

            pendingTransfer.delete(ticketId);

            return;
        }
    }
});

// Staff commands
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.trim().split(" ");
    const cmd = args.shift().toLowerCase();

    // HELP
    if (cmd === `${PREFIX}help`) {
        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, message.author)
            .setTitle("WhiteCastle Staff Commands")
            .setDescription(
                `\`${PREFIX}reply <msg>\` — reply to user\n` +
                `\`${PREFIX}areply <msg>\` — anonymous reply\n` +
                `\`${PREFIX}snippet add <name>\` — save snippet (last message)\n` +
                `\`${PREFIX}snippet <name>\` — send snippet to user\n` +
                `\`${PREFIX}snippets\` — list snippets\n` +
                `\`${PREFIX}transfer\` — transfer ticket to another department\n` +
                `\`${PREFIX}close\` — close ticket and generate transcript`
            );

        await message.channel.send({ embeds: [embed] });
        return;
    }

    const ticketId = message.channel.id;
    const ticket = tickets[ticketId];

    // REPLY
    if (cmd === `${PREFIX}reply`) {
        if (!ticket || ticket.closed) return;

        const userId = ticket.userId;
        const user = await client.users.fetch(userId);

        const replyText = args.join(" ");
        if (!replyText) {
            const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("You must provide a message.");
            await message.channel.send({ embeds: [errEmbed] });
            return;
        }

        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, message.author)
            .setTitle("Staff Reply")
            .setDescription(replyText);

        await message.channel.send({ embeds: [embed] });

        const dmEmbed = wcEmbed("#2B2D31");
        dmAuthor = wcAuthor(dmEmbed, message.author)
            .setTitle("Support Response")
            .setDescription(replyText);

        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        ticket.messages.push({
            timestamp: new Date().toISOString(),
            author: "staff",
            content: replyText,
            attachments: []
        });
        saveTickets();

        return;
    }

    // ANONYMOUS REPLY
    if (cmd === `${PREFIX}areply`) {
        if (!ticket || ticket.closed) return;

        const userId = ticket.userId;
        const user = await client.users.fetch(userId);

        const replyText = args.join(" ");
        if (!replyText) {
            const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("You must provide a message.");
            await message.channel.send({ embeds: [errEmbed] });
            return;
        }

        const embed = wcEmbed("#2B2D31");
        embed.setAuthor({
            name: "WhiteCastle Staff",
            iconURL: client.user.displayAvatarURL()
        }).setTitle("Staff Reply").setDescription(replyText);

        await message.channel.send({ embeds: [embed] });

        const dmEmbed = wcEmbed("#2B2D31");
        dmEmbed.setAuthor({
            name: "WhiteCastle Staff",
            iconURL: client.user.displayAvatarURL()
        }).setTitle("Support Response").setDescription(replyText);

        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        ticket.messages.push({
            timestamp: new Date().toISOString(),
            author: "staff",
            content: replyText,
            attachments: []
        });
        saveTickets();

        return;
    }

    // SNIPPET
    if (cmd === `${PREFIX}snippet`) {
        const sub = args.shift();

        if (sub === "add") {
            const name = args.shift();
            if (!name) {
                const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("Provide a snippet name.");
                await message.channel.send({ embeds: [errEmbed] });
                return;
            }

            const lastMsg = message.channel.lastMessage;
            if (!lastMsg) {
                const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("No message found to save.");
                await message.channel.send({ embeds: [errEmbed] });
                return;
            }

            snippets[name] = lastMsg.content;
            saveSnippets();

            const embed = wcEmbed("#2E6F40").setTitle("Snippet Saved").setDescription(`Snippet **${name}** saved.`);
            await message.channel.send({ embeds: [embed] });

            return;
        }

        const name = sub;
        if (!snippets[name]) {
            const errEmbed = wcEmbed("#ED4245").setTitle("Error").setDescription("Snippet not found.");
            await message.channel.send({ embeds: [errEmbed] });
            return;
        }

        if (!ticket) return;

        const userId = ticket.userId;
        const user = await client.users.fetch(userId);

        const dmEmbed = wcEmbed("#2B2D31");
        wcAuthor(dmEmbed, message.author)
            .setTitle("Support Message")
            .setDescription(snippets[name]);

        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        const embed = wcEmbed("#2E6F40").setTitle("Snippet Sent").setDescription(`Snippet **${name}** sent to user.`);
        await message.channel.send({ embeds: [embed] });

        return;
    }

    // SNIPPETS LIST
    if (cmd === `${PREFIX}snippets`) {
        const list = Object.keys(snippets).map(s => `• ${s}`).join("\n") || "None";

        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, message.author)
            .setTitle("Saved Snippets")
            .setDescription(list);

        await message.channel.send({ embeds: [embed] });
        return;
    }

    // TRANSFER
    if (cmd === `${PREFIX}transfer`) {
        if (!ticket || ticket.closed) return;

        pendingTransfer.set(ticketId, true);

        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, message.author)
            .setTitle("Transfer Ticket")
            .setDescription("Select the department to transfer this ticket to.");

        await message.channel.send({
            embeds: [embed],
            components: [transferMenu()]
        });

        return;
    }

    // CLOSE
    if (cmd === `${PREFIX}close`) {
        if (!ticket || ticket.closed) return;

        pendingClose.set(ticketId, true);

        const embed = wcEmbed("#ED4245");
        wcAuthor(embed, message.author)
            .setTitle("Are you sure you want to close this ticket?")
            .setDescription("This will generate a transcript and delete the channel.");

        await message.channel.send({
            embeds: [embed],
            components: [confirmButtons()]
        });

        return;
    }
});

// Login
client.login(process.env.TOKEN);

console.log("WhiteCastle Support System — FULL FINAL BUILD LOADED");

