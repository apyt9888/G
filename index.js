const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ================== DATABASE ==================
let data = {
  warnEmoji: "🍥",
  modRoles: [],
  logChannel: null,
  messages: [],
  warns: {},
  usedMessages: {}
};

if (fs.existsSync('./data.json')) {
  data = JSON.parse(fs.readFileSync('./data.json'));
}

function save() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// ================== SLASH COMMANDS ==================
const commands = [

  new SlashCommandBuilder()
    .setName('setwarnemoji')
    .setDescription('تحديد ايموجي التحذير')
    .addStringOption(o =>
      o.setName('emoji')
       .setDescription('الايموجي')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setmodroles')
    .setDescription('تحديد 6 رتب')
    .addRoleOption(o => o.setName('role1').setDescription('رتبة 1').setRequired(true))
    .addRoleOption(o => o.setName('role2').setDescription('رتبة 2'))
    .addRoleOption(o => o.setName('role3').setDescription('رتبة 3'))
    .addRoleOption(o => o.setName('role4').setDescription('رتبة 4'))
    .addRoleOption(o => o.setName('role5').setDescription('رتبة 5'))
    .addRoleOption(o => o.setName('role6').setDescription('رتبة 6')),

  new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('تحديد روم اللوق')
    .addChannelOption(o =>
      o.setName('channel')
       .setDescription('روم اللوق')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setmessages')
    .setDescription('تحديد 5 رسائل')
    .addStringOption(o => o.setName('m1').setDescription('رسالة 1').setRequired(true))
    .addStringOption(o => o.setName('m2').setDescription('رسالة 2').setRequired(true))
    .addStringOption(o => o.setName('m3').setDescription('رسالة 3').setRequired(true))
    .addStringOption(o => o.setName('m4').setDescription('رسالة 4').setRequired(true))
    .addStringOption(o => o.setName('m5').setDescription('رسالة 5').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('حذف تحذيرات شخص')
    .addUserOption(o =>
      o.setName('user')
       .setDescription('الشخص')
       .setRequired(true)
    )
];

// تسجيل الأوامر
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Commands Registered");
  } catch (e) {
    console.log(e);
  }
})();

// ================== COMMAND HANDLER ==================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: '❌ Admin فقط', ephemeral: true });
  }

  if (interaction.commandName === 'setwarnemoji') {
    data.warnEmoji = interaction.options.getString('emoji');
    save();
    interaction.reply('✅ تم');
  }

  if (interaction.commandName === 'setmodroles') {
    data.modRoles = [];
    for (let i = 1; i <= 6; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) data.modRoles.push(role.id);
    }
    save();
    interaction.reply('✅ تم حفظ الرتب');
  }

  if (interaction.commandName === 'setlogchannel') {
    data.logChannel = interaction.options.getChannel('channel').id;
    save();
    interaction.reply('✅ تم');
  }

  if (interaction.commandName === 'setmessages') {
    data.messages = [
      interaction.options.getString('m1'),
      interaction.options.getString('m2'),
      interaction.options.getString('m3'),
      interaction.options.getString('m4'),
      interaction.options.getString('m5')
    ];
    save();
    interaction.reply('✅ تم حفظ الرسائل');
  }

  if (interaction.commandName === 'clearwarns') {
    const user = interaction.options.getUser('user');
    data.warns[user.id] = 0;
    save();
    interaction.reply(`✅ تم تصفير تحذيرات ${user}`);
  }
});

// ================== REACTION ==================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== data.warnEmoji) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    const hasPermission =
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      data.modRoles.some(r => member.roles.cache.has(r));

    if (!hasPermission) {
      await reaction.users.remove(user.id);
      return;
    }

    const msg = reaction.message;

    if (!data.usedMessages[msg.id]) data.usedMessages[msg.id] = [];
    if (data.usedMessages[msg.id].includes(user.id)) return;

    data.usedMessages[msg.id].push(user.id);

    const target = msg.author;

    await msg.delete();

    if (!data.warns[target.id]) data.warns[target.id] = 0;
    data.warns[target.id]++;

    const count = data.warns[target.id];

    const randomMsg = data.messages[Math.floor(Math.random() * data.messages.length)];
    msg.channel.send(`<@${target.id}> ${randomMsg}`);

    if (data.logChannel) {
      const ch = guild.channels.cache.get(data.logChannel);
      if (ch) {
        ch.send(`⚠️ ${target.tag} | Warn: ${count} | By: ${user.tag}`);
      }
    }

    if (count >= 3) {
      const targetMember = await guild.members.fetch(target.id);
      await targetMember.timeout(2 * 60 * 60 * 1000, '3 warns');

      msg.channel.send(`⏱️ <@${target.id}> تم إعطاؤه تايم أوت ساعتين`);

      data.warns[target.id] = 0;
    }

    save();

  } catch (e) {
    console.log(e);
  }
});

client.login(TOKEN);
