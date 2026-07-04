// =========================
// WHITECASTLE SUPPORT SYSTEM — FINAL MERGED INDEX.JS
// =========================

// Load environment variables
require("dotenv").config();

// Discord.js v14
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

// File system
const fs = require("fs");
const path = require("path");

// Express keep-alive (Render requirement)
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("WhiteCastle Support Bot Running"));
app.listen(3000);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// =========================
// DATA FOLDER SETUP
// =========================

const dataFolder = path.join(__dirname, "data");
const transcriptsFolder = path.join(dataFolder, "transcripts");

if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
if (!fs.existsSync(transcriptsFolder)) fs.mkdirSync(transcriptsFolder);

// Auto-create JSON files if missing
const ticketsFile = path.join(dataFolder, "tickets.json");
const snippetsFile = path.join(dataFolder, "snippets.json");
const usersFile = path.join(dataFolder, "users.json");

if (!fs.existsSync(ticketsFile)) fs.writeFileSync(ticketsFile, "{}");
if (!fs.existsSync(snippetsFile)) fs.writeFileSync(snippetsFile, "{}");
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "{}");

// Load JSON data
let tickets = JSON.parse(fs.readFileSync(ticketsFile));
let snippets = JSON.parse(fs.readFileSync(snippetsFile));
let users = JSON.parse(fs.readFileSync(usersFile));

// =========================
// SAVE FUNCTIONS (Permanent)
// =========================

function saveTickets() {
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 4));
}

function saveSnippets() {
    fs.writeFileSync(snippetsFile, JSON.stringify(snippets, null, 4));
}

function saveUsers() {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 4));
}

// =========================
// TIMESTAMP FUNCTION
// =========================

function CSTTimestamp() {
    return new Date().toLocaleString("en-US", {
        timeZone: "America/Chicago"
    });
}

// =========================
// EMBED HELPERS (WhiteCastle Branding)
// =========================

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

// =========================
// BUTTON HELPERS
// =========================

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

// =========================
// DEPARTMENT SELECT MENU
// =========================

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

// =========================
// PART 1 COMPLETE
// =========================
console.log("WhiteCastle Rewrite — Part 1 Loaded");

// =========================
// WHITECASTLE SUPPORT SYSTEM — PART 2
// =========================

const PREFIX = process.env.PREFIX || "!";

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const GS_ROLE_ID = process.env.GS_ROLE_ID;
const PR_ROLE_ID = process.env.PR_ROLE_ID;
const S_ROLE_ID = process.env.S_ROLE_ID;
const LS_ROLE_ID = process.env.LS_ROLE_ID;

// Track pending open + close confirmations
const pendingOpen = new Map();
const pendingClose = new Map();

// =========================
// READY EVENT
// =========================

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag} — WhiteCastle Support System Online`);
});

// =========================
// DM MESSAGE HANDLER (Open Flow + Relay)
// =========================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // DM flow
    if (message.channel.type === 1) {
        const user = message.author;

        if (!pendingOpen.has(user.id)) {
            pendingOpen.set(user.id, true);

            const embed = wcEmbed("#2E6F40");
            wcAuthor(embed, user)
                .setTitle("Are you sure you would like to create a thread?")
                .setDescription("Creating a thread will send our moderators a ticket that will be chatted through.");

            await message.channel.send({
                embeds: [embed],
                components: [confirmButtons()]
            });

            return;
        }

        const userTickets = Object.entries(tickets).filter(
            ([, t]) => t.userId === user.id && !t.closed
        );

        if (userTickets.length === 0) return;

        const [ticketId] = userTickets[userTickets.length - 1];
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = guild.channels.cache.get(ticketId);
        if (!channel) return;

        const relayEmbed = wcEmbed("#2B2D31");
        wcAuthor(relayEmbed, user)
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
});

// =========================
// INTERACTION HANDLER
// =========================

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === "confirm_yes" || customId === "confirm_no") {
            if (interaction.channel.type !== 1) return;

            const user = interaction.user;

            if (customId === "confirm_no") {
                pendingOpen.delete(user.id);

                const cancelEmbed = wcEmbed("#2B2D31");
                wcAuthor(cancelEmbed, user)
                    .setTitle("Thread Creation Cancelled");

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
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "dept_select") {
            if (interaction.channel.type !== 1) return;

            const user = interaction.user;
            const selected = interaction.values[0];

            const guild = client.guilds.cache.first();
            const category = guild.channels.cache.get(TICKET_CATEGORY_ID);

            const channelName = `ticket-${selected}-${user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9\-]/g, "");

            const ticketChannel = await guild.channels.create({
                name: channelName,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: ["ViewChannel"] },
                    { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
                    { id: GS_ROLE_ID, allow: selected === "gs" ? ["ViewChannel", "SendMessages", "ReadMessageHistory"] : [] },
                    { id: PR_ROLE_ID, allow: selected === "pr" ? ["ViewChannel", "SendMessages", "ReadMessageHistory"] : [] },
                    { id: S_ROLE_ID, allow: selected === "s" ? ["ViewChannel", "SendMessages", "ReadMessageHistory"] : [] },
                    { id: LS_ROLE_ID, allow: selected === "ls" ? ["ViewChannel", "SendMessages", "ReadMessageHistory"] : [] }
                ]
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
                    `Use \`${PREFIX}close\` to close this ticket.`
                );

            await ticketChannel.send({ embeds: [ticketEmbed] });

            const dmEmbed = wcEmbed("#2B2D31");
            wcAuthor(dmEmbed, user)
                .setTitle("Thread Created")
                .setDescription("Your support thread has been created.");

            await interaction.update({
                embeds: [dmEmbed],
                components: []
            });

            pendingOpen.delete(user.id);

            return;
        }
    }
});

// =========================
// PART 2 COMPLETE
// =========================
console.log("WhiteCastle Rewrite — Part 2 Loaded");

// =========================
// WHITECASTLE SUPPORT SYSTEM — PART 3
// =========================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.split(" ");
    const cmd = args.shift().toLowerCase();

    if (cmd === `${PREFIX}reply`) {
        const ticketId = message.channel.id;
        if (!tickets[ticketId] || tickets[ticketId].closed) return;

        const userId = tickets[ticketId].userId;
        const user = await client.users.fetch(userId);

        const replyText = args.join(" ");
        if (!replyText) return message.reply("You must provide a message.");

        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, message.author).setDescription(replyText);
        await message.channel.send({ embeds: [embed] });

        const dmEmbed = wcEmbed("#2B2D31");
        wcAuthor(dmEmbed, message.author).setDescription(replyText);
        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        tickets[ticketId].messages.push({
            timestamp: new Date().toISOString(),
            author: "staff",
            content: replyText,
            attachments: []
        });
        saveTickets();

        return;
    }

    if (cmd === `${PREFIX}areply`) {
        const ticketId = message.channel.id;
        if (!tickets[ticketId] || tickets[ticketId].closed) return;

        const userId = tickets[ticketId].userId;
        const user = await client.users.fetch(userId);

        const replyText = args.join(" ");
        if (!replyText) return message.reply("You must provide a message.");

        const embed = wcEmbed("#2B2D31");
        embed.setAuthor({
            name: "WhiteCastle Staff",
            iconURL: client.user.displayAvatarURL()
        }).setDescription(replyText);

        await message.channel.send({ embeds: [embed] });

        const dmEmbed = wcEmbed("#2B2D31");
        dmEmbed.setAuthor({
            name: "WhiteCastle Staff",
            iconURL: client.user.displayAvatarURL()
        }).setDescription(replyText);

        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        tickets[ticketId].messages.push({
            timestamp: new Date().toISOString(),
            author: "staff",
            content: replyText,
            attachments: []
        });
        saveTickets();

        return;
    }

    if (cmd === `${PREFIX}snippet`) {
        const sub = args.shift();

        if (sub === "add") {
            const name = args.shift();
            if (!name) return message.reply("Provide a snippet name.");

            const lastMsg = message.channel.lastMessage;
            if (!lastMsg) return message.reply("No message found.");

            snippets[name] = lastMsg.content;
            saveSnippets();

            return message.reply(`Snippet **${name}** saved.`);
        }

        const name = sub;
        if (!snippets[name]) return message.reply("Snippet not found.");

        const ticketId = message.channel.id;
        if (!tickets[ticketId]) return;

        const userId = tickets[ticketId].userId;
        const user = await client.users.fetch(userId);

        const dmEmbed = wcEmbed("#2B2D31");
        wcAuthor(dmEmbed, message.author).setDescription(snippets[name]);

        try { await user.send({ embeds: [dmEmbed] }); } catch {}

        return message.reply(`Snippet **${name}** sent to user.`);
    }

    if (cmd === `${PREFIX}snippets`) {
        const list = Object.keys(snippets).map(s => `• ${s}`).join("\n") || "None";
        return message.reply(`**Saved Snippets:**\n${list}`);
    }

    if (cmd === `${PREFIX}help`) {
        return message.reply(
            "**WhiteCastle Staff Commands:**\n" +
            `\`${PREFIX}reply <msg>\` — reply to user\n` +
            `\`${PREFIX}areply <msg>\` — anonymous reply\n` +
            `\`${PREFIX}snippet add <name>\` — save snippet\n` +
            `\`${PREFIX}snippet <name>\` — send snippet\n` +
            `\`${PREFIX}snippets\` — list snippets\n` +
            `\`${PREFIX}close\` — close ticket`
        );
    }

    if (cmd === `${PREFIX}close`) {
        const ticketId = message.channel.id;
        if (!tickets[ticketId] || tickets[ticketId].closed) return;

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

// =========================
// CLOSE CONFIRMATION BUTTONS
// =========================

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    const channel = interaction.channel;
    const ticketId = channel.id;

    if (!pendingClose.has(ticketId)) return;

    if (customId === "confirm_no") {
        pendingClose.delete(ticketId);

        const embed = wcEmbed("#2B2D31");
        wcAuthor(embed, interaction.user)
            .setTitle("Ticket Close Cancelled");

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
        await logChannel.send({
            content: `Transcript for ticket ${ticketId}`,
            files: [transcriptPath]
        });
    }

    const embed = wcEmbed("#ED4245");
    wcAuthor(embed, interaction.user)
        .setTitle("Ticket Closed");

    await interaction.update({
        embeds: [embed],
        components: []
    });

    setTimeout(() => {
        channel.delete().catch(() => {});
    }, 2000);

    pendingClose.delete(ticketId);
});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);

// =========================
// FINAL MERGED FILE COMPLETE
// =========================
console.log("WhiteCastle Support System — FULL BUILD LOADED");
